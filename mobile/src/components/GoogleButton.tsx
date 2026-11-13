import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { googleSignIn } from '../api/client';
import { colors, radius, space, text } from '../theme';
import { AuthResult } from '../types';

WebBrowser.maybeCompleteAuthSession(); // finishes the Google sign-in when the browser hands back to the app

// OAuth client IDs from Google Cloud (not secrets). Without the one for this platform the button is hidden.
const IDS = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || undefined,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
};
const configured = Platform.select({ android: !!IDS.androidClientId, ios: !!IDS.iosClientId, default: !!IDS.webClientId });

// "Continue with Google". Google verifies the person, then the backend checks Google's token and signs them in.
export function GoogleButton(props: { onDone: (auth: AuthResult) => Promise<void> | void; onError: (message: string) => void }) {
  if (!configured) return null;
  return <GoogleButtonInner {...props} />;
}

function GoogleButtonInner({
  onDone,
  onError,
}: {
  onDone: (auth: AuthResult) => Promise<void> | void;
  onError: (message: string) => void;
}) {
  const [request, response, prompt] = Google.useIdTokenAuthRequest(IDS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!response) return;
    if (response.type === 'success') {
      const idToken = response.params.id_token;
      if (!idToken) {
        onError('Google did not confirm your account. Please try again.');
        setBusy(false);
        return;
      }
      googleSignIn(idToken)
        .then(onDone)
        .catch((e) => {
          onError(e instanceof Error ? e.message : 'Google sign-in failed.');
          setBusy(false);
        });
    } else {
      if (response.type === 'error') onError('Google sign-in failed. Please try again.');
      setBusy(false); // cancelled or dismissed: nothing to say
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  return (
    <>
      <View style={styles.or}>
        <View style={styles.line} />
        <Text style={[text.caption, { marginHorizontal: space.s }]}>or</Text>
        <View style={styles.line} />
      </View>
      <Pressable
        style={[styles.button, (!request || busy) && { opacity: 0.6 }]}
        disabled={!request || busy}
        onPress={() => {
          setBusy(true);
          prompt().catch(() => setBusy(false));
        }}
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        accessibilityState={{ disabled: !request || busy, busy }}
      >
        {busy ? <ActivityIndicator color={colors.ink} /> : <Text style={[text.heading, { color: colors.primary }]}>G</Text>}
        <Text style={text.bodyStrong}>Continue with Google</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  or: { flexDirection: 'row', alignItems: 'center', marginVertical: space.m },
  line: { flex: 1, height: 1, backgroundColor: colors.line },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s,
    borderRadius: radius.pill,
    minHeight: 56,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
});

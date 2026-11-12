import { AtkinsonHyperlegibleNext_400Regular, AtkinsonHyperlegibleNext_700Bold } from '@expo-google-fonts/atkinson-hyperlegible-next';
import { BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque';
import { useFonts } from 'expo-font';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { getProfile, SESSION_EXPIRED } from './src/api/client';
import { clearSession, loadSession, Session } from './src/auth/session';
import { registerForPush, unregisterForPush } from './src/push';
import { Button, Empty } from './src/components/ui';
import CaretakerHome from './src/screens/CaretakerHome';
import ElderlyHome from './src/screens/ElderlyHome';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import UserHome from './src/screens/UserHome';
import { colors, space } from './src/theme';
import { Profile } from './src/types';

// Keep the splash screen up until the saved session (and role) has loaded.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<'login' | 'register'>('login');
  const [loadError, setLoadError] = useState('');
  // The app's two typefaces. If they fail to load the system font is used, so the app still opens.
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    AtkinsonHyperlegibleNext_400Regular,
    AtkinsonHyperlegibleNext_700Bold,
  });

  const sessionRef = useRef<Session | null>(null);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const signOut = useCallback(async () => {
    if (sessionRef.current) await unregisterForPush(sessionRef.current.token); // no notifications for a signed-out account
    await clearSession();
    setSession(null);
    setProfile(null);
    setScreen('login');
  }, []);

  // Always fetch the role fresh: it can change when a family adds this person's email.
  const refresh = useCallback(
    async (s: Session) => {
      setLoadError('');
      try {
        setProfile(await getProfile(s.token));
      } catch (e) {
        if (e instanceof Error && e.message === SESSION_EXPIRED) await signOut();
        else setLoadError('Check your connection.');
      }
    },
    [signOut],
  );

  useEffect(() => {
    loadSession().then((s) => {
      setSession(s);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (session) refresh(session);
  }, [session, refresh]);

  // Once signed in (role known), let this phone receive notifications for new alerts and messages.
  const signedInToken = profile ? session?.token : undefined;
  useEffect(() => {
    if (signedInToken) registerForPush(signedInToken);
  }, [signedInToken]);

  const loading = !ready || (!fontsLoaded && !fontError) || (session && !profile && !loadError);

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.secondary} />
      </View>
    );
  }

  let content;
  if (!session) {
    content =
      screen === 'login' ? (
        <LoginScreen onLoggedIn={setSession} onRegister={() => setScreen('register')} />
      ) : (
        <RegisterScreen onLoggedIn={setSession} onBack={() => setScreen('login')} />
      );
  } else if (!profile) {
    content = (
      <View style={styles.center}>
        <View style={{ alignSelf: 'stretch', gap: space.s }}>
          <Empty icon="wifiOff" title="Can't reach MzaziCare" body={loadError} />
          <Button title="Try again" icon="refresh" onPress={() => refresh(session)} />
          <Button title="Sign out" variant="soft" onPress={signOut} />
        </View>
      </View>
    );
  } else if (profile.role === 'caretaker') {
    content = <CaretakerHome token={session.token} profile={profile} onSignOut={signOut} />;
  } else if (profile.role === 'elderly') {
    content = <ElderlyHome token={session.token} profile={profile} onSignOut={signOut} />;
  } else {
    content = (
      <UserHome token={session.token} profile={profile} onChanged={() => refresh(session)} onSignOut={signOut} />
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      {content}
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: space.l,
  },
});

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { clearSession, loadSession, Session } from './src/auth/session';
import LoginScreen from './src/screens/LoginScreen';
import { colors, spacing } from './src/theme';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadSession().then((s) => {
      setSession(s);
      setReady(true);
    });
  }, []);

  async function logout() {
    await clearSession();
    setSession(null);
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      {session ? (
        <View style={styles.center}>
          <Text style={styles.welcome}>Welcome, {session.name}</Text>
          <Text style={styles.muted}>Home screen coming next.</Text>
          <Pressable onPress={logout} style={{ marginTop: spacing.lg }}>
            <Text style={styles.link}>Sign out</Text>
          </Pressable>
        </View>
      ) : (
        <LoginScreen onLoggedIn={setSession} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  welcome: { fontSize: 22, fontWeight: '700', color: colors.text },
  muted: { color: colors.textMuted, marginTop: spacing.sm },
  link: { color: colors.primary, fontWeight: '600' },
});

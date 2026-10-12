import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { getProfile, SESSION_EXPIRED } from './src/api/client';
import { clearSession, loadSession, Session } from './src/auth/session';
import { Button } from './src/components/ui';
import CaretakerHome from './src/screens/CaretakerHome';
import ElderlyHome from './src/screens/ElderlyHome';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import UserHome from './src/screens/UserHome';
import { colors, spacing } from './src/theme';
import { Profile } from './src/types';

// Keep the splash screen up until the saved session (and role) has loaded.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<'login' | 'register'>('login');
  const [loadError, setLoadError] = useState('');

  const signOut = useCallback(async () => {
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
        else setLoadError('Could not load your account. Check your connection.');
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

  const loading = !ready || (session && !profile && !loadError);

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
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
        <Text style={styles.error}>{loadError}</Text>
        <View style={{ width: 200, gap: spacing.sm }}>
          <Button title="Try again" onPress={() => refresh(session)} />
          <Button title="Sign out" variant="secondary" onPress={signOut} />
        </View>
      </View>
    );
  } else if (profile.role === 'caretaker') {
    content = <CaretakerHome profile={profile} onSignOut={signOut} />;
  } else if (profile.role === 'elderly') {
    content = <ElderlyHome profile={profile} onSignOut={signOut} />;
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
    padding: spacing.lg,
  },
  error: { color: colors.textMuted, marginBottom: spacing.md, textAlign: 'center' },
});

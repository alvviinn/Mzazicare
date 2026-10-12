import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { login } from '../api/client';
import { saveSession, Session } from '../auth/session';
import { Button, Card, ErrorText, Field, Logo } from '../components/ui';
import { colors, spacing } from '../theme';

type Props = { onLoggedIn: (s: Session) => void; onRegister: () => void };

export default function LoginScreen({ onLoggedIn, onRegister }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  async function submit() {
    if (loading) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    setError('');
    setLoading(true);
    try {
      onLoggedIn(await saveSession(await login(email.trim(), password)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Logo />
        <Card>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <Field
            ref={passwordRef}
            label="Password"
            secure
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            autoComplete="password"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
          <ErrorText>{error}</ErrorText>
          <Button title="Sign in" onPress={submit} loading={loading} />
        </Card>

        <Pressable onPress={onRegister} style={styles.switch}>
          <Text style={styles.muted}>
            Don't have an account? <Text style={styles.link}>Create one</Text>
          </Text>
        </Pressable>
        <Text style={styles.footnote}>You will stay signed in on this device for 3 months.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  switch: { alignItems: 'center', marginTop: spacing.lg },
  muted: { color: colors.textMuted, fontSize: 15 },
  link: { color: colors.primary, fontWeight: '600' },
  footnote: { textAlign: 'center', color: colors.textMuted, fontSize: 13, marginTop: spacing.md },
});

import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInputInstance } from 'react-native';
import { register } from '../api/client';
import { saveSession, Session } from '../auth/session';
import { Button, Card, ErrorText, Field, Logo } from '../components/ui';
import { colors, spacing } from '../theme';

type Props = { onLoggedIn: (s: Session) => void; onBack: () => void };

export default function RegisterScreen({ onLoggedIn, onBack }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const confirmRef = useRef<TextInputInstance>(null);

  async function submit() {
    if (loading) return;
    if (name.trim().length < 2) return setError('Enter your full name.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setError('');
    setLoading(true);
    try {
      onLoggedIn(await saveSession(await register(name, email.trim(), password)));
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
            label="Full name"
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            autoCapitalize="words"
            autoComplete="name"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
          />
          <Field
            ref={emailRef}
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
            placeholder="At least 6 characters"
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
          />
          <Field
            ref={confirmRef}
            label="Confirm password"
            secure
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Repeat your password"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
          <ErrorText>{error}</ErrorText>
          <Button title="Create account" onPress={submit} loading={loading} />
        </Card>

        <Pressable onPress={onBack} style={styles.switch}>
          <Text style={styles.muted}>
            Already have an account? <Text style={styles.link}>Sign in</Text>
          </Text>
        </Pressable>
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
});

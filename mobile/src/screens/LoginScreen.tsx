import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInputInstance } from 'react-native';
import { login } from '../api/client';
import { saveSession, Session } from '../auth/session';
import { AuthFrame } from '../components/AuthFrame';
import { CodeStep } from '../components/CodeStep';
import { GoogleButton } from '../components/GoogleButton';
import { Button, ErrorText, Field } from '../components/ui';
import { colors, space, TAP, text } from '../theme';
import { AuthResult, CodeChallenge } from '../types';

type Props = { onLoggedIn: (s: Session) => void; onRegister: () => void };

export default function LoginScreen({ onLoggedIn, onRegister }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<CodeChallenge | null>(null); // waiting for the emailed code
  const passwordRef = useRef<TextInputInstance>(null);

  async function submit() {
    if (loading) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    setError('');
    setLoading(true);
    try {
      const result = await login(email.trim(), password);
      if ('two_factor' in result) {
        setPending(result);
        setLoading(false);
      } else {
        await finish(result);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setLoading(false);
    }
  }

  async function finish(auth: AuthResult) {
    onLoggedIn(await saveSession(auth));
  }

  if (pending) {
    return (
      <AuthFrame title="Check your email">
        <CodeStep start={pending} onDone={finish} onCancel={() => setPending(null)} />
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title="Sign in">
      <Field
        label="Email"
        icon="mail"
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
        icon="lock"
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
      <GoogleButton onDone={finish} onError={setError} />

      <Pressable onPress={onRegister} style={styles.switch} accessibilityRole="button" accessibilityLabel="Create an account">
        <Text style={text.body}>
          New here? <Text style={styles.link}>Create account</Text>
        </Text>
      </Pressable>
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  switch: { alignItems: 'center', justifyContent: 'center', marginTop: space.m, minHeight: TAP },
  link: { ...text.bodyStrong, color: colors.secondary },
});

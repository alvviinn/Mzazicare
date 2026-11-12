import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInputInstance } from 'react-native';
import { register } from '../api/client';
import { saveSession, Session } from '../auth/session';
import { AuthFrame } from '../components/AuthFrame';
import { CodeStep } from '../components/CodeStep';
import { GoogleButton } from '../components/GoogleButton';
import { Button, ErrorText, Field } from '../components/ui';
import { colors, fonts, spacing, TAP, text } from '../theme';
import { AuthResult, CodeChallenge } from '../types';

type Props = { onLoggedIn: (s: Session) => void; onBack: () => void };

export default function RegisterScreen({ onLoggedIn, onBack }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<CodeChallenge | null>(null); // waiting for the emailed code
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
      const result = await register(name, email.trim(), password);
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
    <AuthFrame title="Create account">
      <Field
        label="Full name"
        icon="account-outline"
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
        icon="email-outline"
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
        icon="lock-outline"
        secure
        value={password}
        onChangeText={setPassword}
        placeholder="6+ characters"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
      />
      <Field
        ref={confirmRef}
        label="Confirm password"
        icon="lock-check-outline"
        secure
        value={confirm}
        onChangeText={setConfirm}
        placeholder="Repeat it"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <ErrorText>{error}</ErrorText>
      <Button title="Create account" onPress={submit} loading={loading} />
      <GoogleButton onDone={finish} onError={setError} />

      <Pressable onPress={onBack} style={styles.switch} accessibilityRole="button" accessibilityLabel="Sign in to an existing account">
        <Text style={text.body}>
          Have an account? <Text style={styles.link}>Sign in</Text>
        </Text>
      </Pressable>
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  switch: { alignItems: 'center', justifyContent: 'center', marginTop: spacing.md, minHeight: TAP },
  link: { fontFamily: fonts.bodyBold, color: colors.primaryInk },
});

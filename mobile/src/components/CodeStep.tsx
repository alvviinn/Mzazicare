import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { resendCode, verifyCode } from '../api/client';
import { colors, spacing } from '../theme';
import { AuthResult, CodeChallenge } from '../types';
import { Button, Card, ErrorText, Field } from './ui';

const RESEND_AFTER_S = 30;

// The second sign-in step for accounts created after two-step sign-in was added: the code that was emailed.
export function CodeStep({
  start,
  onDone,
  onCancel,
}: {
  start: CodeChallenge;
  onDone: (auth: AuthResult) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [challenge, setChallenge] = useState(start);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [wait, setWait] = useState(RESEND_AFTER_S);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function submit() {
    if (loading) return;
    const digits = code.replace(/\D/g, '');
    if (digits.length !== 6) return setError('Enter the 6-digit code from the email.');
    setError('');
    setLoading(true);
    try {
      await onDone(await verifyCode(challenge.challenge, digits));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setLoading(false);
    }
  }

  async function resend() {
    setError('');
    setNote('');
    try {
      setChallenge(await resendCode(challenge.challenge));
      setCode('');
      setNote('A new code is on its way. The old one no longer works.');
      setWait(RESEND_AFTER_S);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send a new code.');
    }
  }

  return (
    <Card>
      <Text style={styles.title}>Check your email</Text>
      <Text style={styles.hint}>
        We sent a 6-digit code to {challenge.sent_to}. It works for {Math.round(challenge.expires_in / 60)} minutes.
      </Text>
      <Field
        label="Code"
        value={code}
        onChangeText={setCode}
        placeholder="123456"
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={7}
        returnKeyType="go"
        onSubmitEditing={submit}
        autoFocus
      />
      <ErrorText>{error}</ErrorText>
      {!!note && <Text style={styles.note}>{note}</Text>}
      <Button title="Continue" onPress={submit} loading={loading} />
      <Pressable onPress={resend} disabled={wait > 0} style={styles.link}>
        <Text style={[styles.linkText, wait > 0 && { color: colors.textMuted }]}>
          {wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
        </Text>
      </Pressable>
      <Pressable onPress={onCancel} style={styles.link}>
        <Text style={styles.back}>Back</Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  hint: { color: colors.textMuted, fontSize: 14, marginTop: spacing.xs, marginBottom: spacing.md },
  note: { color: colors.primary, fontSize: 14, marginBottom: spacing.md },
  link: { alignItems: 'center', marginTop: spacing.md },
  linkText: { color: colors.primary, fontWeight: '600', fontSize: 15 },
  back: { color: colors.textMuted, fontSize: 15 },
});

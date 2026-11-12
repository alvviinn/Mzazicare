import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputInstance, View } from 'react-native';
import { resendCode, verifyCode } from '../api/client';
import { colors, radius, space, TAP, text } from '../theme';
import { AuthResult, CodeChallenge } from '../types';
import { Icon } from './Icon';
import { Button, ErrorText } from './ui';

const RESEND_AFTER_S = 30;
const LEN = 6;

// The second sign-in step: the 6-digit code that was emailed, shown as six boxes.
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
  const input = useRef<TextInputInstance>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  async function submit(value = code) {
    if (loading) return;
    const digits = value.replace(/\D/g, '');
    if (digits.length !== LEN) return setError('Enter the 6-digit code from the email.');
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
      setNote('New code sent. The old one no longer works.');
      setWait(RESEND_AFTER_S);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send a new code.');
    }
  }

  const digits = code.replace(/\D/g, '').slice(0, LEN);

  return (
    <View>
      <View style={styles.to}>
        <Icon name="mailSent" />
        <Text style={[text.body, { flex: 1 }]} numberOfLines={1}>
          {challenge.sent_to}
        </Text>
        <Text style={text.caption}>{Math.round(challenge.expires_in / 60)} min</Text>
      </View>

      {/* six visible boxes over one real input */}
      <Pressable onPress={() => input.current?.focus()} style={styles.boxes} accessible={false}>
        {Array.from({ length: LEN }, (_, i) => (
          <View key={i} style={[styles.box, i === digits.length && styles.boxNow, !!digits[i] && styles.boxFull]}>
            <Text style={text.display}>{digits[i] ?? ''}</Text>
          </View>
        ))}
        <TextInput
          ref={input}
          value={digits}
          onChangeText={(v) => {
            const d = v.replace(/\D/g, '').slice(0, LEN);
            setCode(d);
            if (d.length === LEN) submit(d);
          }}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={LEN}
          autoFocus
          style={styles.hidden}
          accessibilityLabel="6-digit code"
        />
      </Pressable>

      <ErrorText>{error}</ErrorText>
      {!!note && <Text style={[text.caption, { color: colors.ink, marginBottom: space.m }]}>{note}</Text>}
      <Button title="Continue" onPress={() => submit()} loading={loading} />
      <Pressable
        onPress={resend}
        disabled={wait > 0}
        style={styles.link}
        accessibilityRole="button"
        accessibilityState={{ disabled: wait > 0 }}
      >
        <Text style={[text.bodyStrong, { color: wait > 0 ? colors.inkMuted : colors.secondary }]}>
          {wait > 0 ? `Resend in ${wait}s` : 'Resend code'}
        </Text>
      </Pressable>
      <Pressable onPress={onCancel} style={styles.link} accessibilityRole="button" accessibilityLabel="Back to sign in">
        <Text style={text.caption}>Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  to: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    backgroundColor: colors.secondaryTint,
    borderRadius: radius.small,
    padding: space.m,
    marginBottom: space.l,
  },
  boxes: { flexDirection: 'row', gap: space.s, marginBottom: space.m },
  box: {
    flex: 1,
    aspectRatio: 0.8,
    maxHeight: 64,
    borderRadius: radius.small,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  boxNow: { borderColor: colors.secondary },
  boxFull: { borderColor: colors.ink },
  hidden: { position: 'absolute', opacity: 0, width: '100%', height: '100%' },
  link: { alignItems: 'center', justifyContent: 'center', marginTop: space.s, minHeight: TAP },
});

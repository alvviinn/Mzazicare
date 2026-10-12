import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { login } from '../api/auth';
import { saveSession, Session } from '../auth/session';
import { colors, radius, spacing } from '../theme';

type Props = { onLoggedIn: (s: Session) => void };

export default function LoginScreen({ onLoggedIn }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  async function submit() {
    if (loading) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await login(email.trim(), password);
      onLoggedIn(await saveSession(result));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>M</Text>
          </View>
          <Text style={styles.title}>MzaziCare</Text>
          <Text style={styles.subtitle}>Caring for our parents, together.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          <Text style={[styles.label, { marginTop: spacing.md }]}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              ref={passwordRef}
              style={[styles.input, styles.passwordInput]}
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="password"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.toggle}>
              <Text style={styles.toggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && { backgroundColor: colors.primaryDark },
              loading && { opacity: 0.7 },
            ]}
            onPress={submit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>Sign in</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.footnote}>You will stay signed in on this device for 3 months.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  header: { alignItems: 'center', marginBottom: spacing.xl },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logoText: { color: colors.onPrimary, fontSize: 32, fontWeight: '700' },
  title: { fontSize: 28, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 15, color: colors.textMuted, marginTop: spacing.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
  },
  passwordRow: { justifyContent: 'center' },
  passwordInput: { paddingRight: 64 },
  toggle: { position: 'absolute', right: spacing.md },
  toggleText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  error: { color: colors.danger, marginTop: spacing.md, fontSize: 14 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  buttonText: { color: colors.onPrimary, fontSize: 16, fontWeight: '600' },
  footnote: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 13,
    marginTop: spacing.lg,
  },
});

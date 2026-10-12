import { forwardRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { colors, radius, spacing } from '../theme';

type FieldProps = TextInputProps & { label: string; secure?: boolean };

// Labelled text input. `secure` adds a Show/Hide toggle for passwords.
export const Field = forwardRef<TextInput, FieldProps>(({ label, secure, style, ...props }, ref) => {
  const [hidden, setHidden] = useState(true);
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <View style={{ justifyContent: 'center' }}>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          {...props}
          secureTextEntry={secure ? hidden : props.secureTextEntry}
          style={[styles.input, secure && { paddingRight: 64 }, style]}
        />
        {secure && (
          <Pressable onPress={() => setHidden((v) => !v)} style={styles.toggle}>
            <Text style={styles.toggleText}>{hidden ? 'Show' : 'Hide'}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
});

export function Button({
  title,
  onPress,
  loading,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
}) {
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : styles.buttonSecondary,
        pressed && { opacity: 0.85 },
        loading && { opacity: 0.7 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? colors.onPrimary : colors.primary} />
      ) : (
        <Text style={[styles.buttonText, { color: primary ? colors.onPrimary : colors.primary }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function ErrorText({ children }: { children?: string }) {
  return children ? <Text style={styles.error}>{children}</Text> : null;
}

export function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function Logo() {
  return (
    <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>M</Text>
      </View>
      <Text style={styles.title}>MzaziCare</Text>
      <Text style={styles.subtitle}>Caring for our parents, together.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  toggle: { position: 'absolute', right: spacing.md },
  toggleText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  button: { borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: { backgroundColor: colors.primarySoft },
  buttonText: { fontSize: 16, fontWeight: '600' },
  error: { color: colors.danger, marginBottom: spacing.md, fontSize: 14 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
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
});

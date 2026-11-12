import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing, text, TOP_INSET } from '../theme';
import { Stripe } from './ui';

// The frame for sign in, register and the emailed code: brand on a peach band, the form on a raised sheet.
export function AuthFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.band}>
          <View style={styles.brandRow}>
            <View style={styles.mark}>
              <Text style={styles.markText}>M</Text>
            </View>
            <Text style={styles.word}>MzaziCare</Text>
          </View>
          <Text style={styles.tagline}>Care for Mzazi, from anywhere.</Text>
          <Stripe height={8} style={{ marginTop: spacing.lg, width: 132 }} />
        </View>
        <View style={styles.sheet}>
          <Text style={[text.h1, { marginBottom: spacing.lg }]} accessibilityRole="header">
            {title}
          </Text>
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.primarySoft },
  scroll: { flexGrow: 1 },
  band: { paddingTop: TOP_INSET + spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms },
  mark: {
    width: 48,
    height: 48,
    borderRadius: radius.sm + 2,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: { fontFamily: fonts.display, fontSize: 26, color: colors.onPrimary },
  word: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
  tagline: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, color: colors.text, marginTop: spacing.xl, letterSpacing: -0.8 },
  sheet: {
    flexGrow: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg + 8,
    borderTopRightRadius: radius.lg + 8,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
});

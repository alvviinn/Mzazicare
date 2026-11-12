import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, on, radius, space, text, TOP_INSET } from '../theme';

// The frame for sign in, register and the emailed code: brand on a marigold-tint band, the form below.
export function AuthFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.band}>
          <View style={styles.brandRow}>
            <View style={styles.mark}>
              <Text style={[text.heading, { color: on.secondary }]}>M</Text>
            </View>
            <Text style={text.heading}>MzaziCare</Text>
          </View>
          <Text style={[text.display, styles.tagline]}>Care for Mzazi, from anywhere.</Text>
        </View>
        <View style={styles.sheet}>
          <Text style={[text.display, { marginBottom: space.l }]} accessibilityRole="header">
            {title}
          </Text>
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.primaryTint },
  scroll: { flexGrow: 1 },
  band: { paddingTop: TOP_INSET + space.l, paddingHorizontal: space.l, paddingBottom: space.xl },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  mark: { width: 48, height: 48, borderRadius: radius.small, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
  tagline: { marginTop: space.xl },
  sheet: {
    flexGrow: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: space.l,
    paddingBottom: space.xxl,
  },
});

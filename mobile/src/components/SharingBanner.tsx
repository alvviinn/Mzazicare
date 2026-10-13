import { StyleSheet, Text, View } from 'react-native';
import { SharingStatus } from '../location/useLocationSharing';
import { colors, radius, spacing } from '../theme';

const MESSAGES: Record<SharingStatus, { text: string; ok: boolean }> = {
  starting: { text: 'Starting location sharing…', ok: true },
  sharing: { text: 'Location sharing is on. Keep MzaziCare open during visits.', ok: true },
  denied: { text: 'Location permission is off. Turn it on in your phone settings so visits can be verified.', ok: false },
  error: { text: "Can't get your location or reach the server. Check that GPS and internet are on.", ok: false },
};

export function SharingBanner({ status }: { status: SharingStatus }) {
  const m = MESSAGES[status];
  return (
    <View style={[styles.box, { backgroundColor: m.ok ? colors.primarySoft : colors.warningSoft }]}>
      <Text style={[styles.text, { color: m.ok ? colors.primary : colors.warning }]}>
        {m.ok ? '📍 ' : '⚠️ '}
        {m.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.md, padding: spacing.sm + 4, marginBottom: spacing.md },
  text: { fontSize: 13 },
});

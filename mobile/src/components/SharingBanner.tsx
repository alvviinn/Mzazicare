import { StyleSheet, Text, View } from 'react-native';
import { SharingStatus } from '../location/useLocationSharing';
import { colors, radius, spacing } from '../theme';
import { Icon } from './Icon';

const MESSAGES: Record<'en' | 'sw', Record<SharingStatus, { text: string; ok: boolean }>> = {
  en: {
    starting: { text: 'Starting location sharing…', ok: true },
    sharing: { text: 'Location sharing is on. Keep MzaziCare open during visits.', ok: true },
    denied: { text: 'Location permission is off. Turn it on in your phone settings so visits can be verified.', ok: false },
    error: { text: "Can't get your location or reach the server. Check that GPS and internet are on.", ok: false },
  },
  sw: {
    starting: { text: 'Inaanza kushiriki mahali…', ok: true },
    sharing: { text: 'Kushiriki mahali kumewashwa. Weka MzaziCare wazi wakati wa ziara.', ok: true },
    denied: { text: 'Ruhusa ya mahali imezimwa. Iwashe kwenye mipangilio ya simu yako.', ok: false },
    error: { text: 'Mahali au intaneti havipatikani. Hakikisha GPS na intaneti vimewashwa.', ok: false },
  },
};

export function SharingBanner({
  status,
  lang = 'en',
  scale = 1,
}: {
  status: SharingStatus;
  lang?: 'en' | 'sw';
  scale?: number;
}) {
  const m = MESSAGES[lang][status];
  const color = m.ok ? colors.primary : colors.warning;
  return (
    <View style={[styles.box, { backgroundColor: m.ok ? colors.primarySoft : colors.warningSoft }]}>
      <Icon name={m.ok ? 'map-marker-outline' : 'alert-outline'} size={18 * scale} color={color} />
      <Text style={[styles.text, { color, fontSize: 13 * scale }]}>{m.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.md, padding: spacing.sm + 4, marginTop: spacing.sm },
  text: { flex: 1 },
});

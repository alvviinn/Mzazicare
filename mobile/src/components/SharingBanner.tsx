import { StyleSheet, Text, View } from 'react-native';
import { SharingStatus } from '../location/useLocationSharing';
import { colors, icon, radius, scaled, space, text } from '../theme';
import { Icon } from './Icon';

// Short on screen; the full sentence is read out by screen readers.
const MESSAGES: Record<'en' | 'sw', Record<SharingStatus, { text: string; long: string; ok: boolean }>> = {
  en: {
    starting: { text: 'Starting location…', long: 'Starting location sharing.', ok: true },
    sharing: { text: 'Location on', long: 'Location sharing is on. Keep MzaziCare open during visits.', ok: true },
    denied: {
      text: 'Location off · turn on in Settings',
      long: 'Location permission is off. Turn it on in your phone settings so visits can be verified.',
      ok: false,
    },
    error: { text: 'No GPS or internet', long: "Can't get your location or reach the server. Check that GPS and internet are on.", ok: false },
  },
  sw: {
    starting: { text: 'Inaanza mahali…', long: 'Inaanza kushiriki mahali.', ok: true },
    sharing: { text: 'Mahali kumewashwa', long: 'Kushiriki mahali kumewashwa. Weka MzaziCare wazi wakati wa ziara.', ok: true },
    denied: {
      text: 'Mahali kumezimwa · washa kwenye Mipangilio',
      long: 'Ruhusa ya mahali imezimwa. Iwashe kwenye mipangilio ya simu yako.',
      ok: false,
    },
    error: { text: 'Hakuna GPS au intaneti', long: 'Mahali au intaneti havipatikani. Hakikisha GPS na intaneti vimewashwa.', ok: false },
  },
};

// Location status. Fine: a quiet surface pill. A problem: attention = marigold tint, ink text, an icon.
export function SharingBanner({ status, lang = 'en', scale = 1 }: { status: SharingStatus; lang?: 'en' | 'sw'; scale?: number }) {
  const m = MESSAGES[lang][status];
  return (
    <View
      style={[styles.box, { backgroundColor: m.ok ? colors.surface : colors.primaryTint }]}
      accessible
      accessibilityLabel={m.long}
      accessibilityRole={m.ok ? undefined : 'alert'}
    >
      <Icon name={m.ok ? 'pinCheck' : 'pinOff'} size={icon.s * scale} color={m.ok ? colors.success : colors.ink} />
      <Text style={[scaled(text.captionStrong, scale), { flexShrink: 1 }]}>{m.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    borderRadius: radius.pill,
    paddingVertical: space.s,
    paddingHorizontal: space.m,
    marginTop: space.m,
    alignSelf: 'flex-start',
  },
});

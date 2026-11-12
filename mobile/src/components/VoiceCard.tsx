import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Voice } from '../audio/useVoiceMonitoring';
import { colors, fonts, iconSize, radius, spacing, TAP, text, type } from '../theme';
import { Icon, IconName } from './Icon';
import { Button, Card, LiveDot } from './ui';

type Lang = 'en' | 'sw';

// Consent is the one place that keeps its full meaning: three short promises, each with an icon.
const TEXT: Record<Lang, { title: string; points: [IconName, string][]; [k: string]: unknown }> = {
  en: {
    title: 'Voice tone',
    lead: 'Lets the family see how visits feel.',
    points: [
      ['map-marker-check-outline', 'Only during a verified visit'],
      ['microphone-off', 'Tone only · nothing recorded or written down'],
      ['account-multiple-check-outline', 'Starts when both agree · stop anytime'],
    ],
    agree: 'I agree',
    on_now: 'Listening · visit in progress',
    no_shift: 'Off until a visit starts',
    other: 'Waiting for the other person',
    on: 'Agreed · only during visits',
    off: 'Turn off',
    off_title: 'Turn off voice monitoring?',
    off_body: 'Nothing will be listened to until you agree again.',
    cancel: 'Cancel',
    mic: 'Microphone is off in phone settings',
    fail: 'Could not save your choice. Check your connection.',
  },
  sw: {
    title: 'Sauti',
    lead: 'Familia inaona jinsi ziara zinavyoenda.',
    points: [
      ['map-marker-check-outline', 'Wakati wa ziara iliyothibitishwa tu'],
      ['microphone-off', 'Sauti tu · hakuna rekodi wala maandishi'],
      ['account-multiple-check-outline', 'Huanza mkikubali nyote · zima wakati wowote'],
    ],
    agree: 'Nakubali',
    on_now: 'Inasikiliza · ziara inaendelea',
    no_shift: 'Imezimwa hadi ziara ianze',
    other: 'Inasubiri mtu mwingine',
    on: 'Umekubali · wakati wa ziara tu',
    off: 'Zima',
    off_title: 'Kuzima ufuatiliaji wa sauti?',
    off_body: 'Hakuna kitakachosikilizwa hadi ukubali tena.',
    cancel: 'Ghairi',
    mic: 'Maikrofoni imezimwa kwenye mipangilio',
    fail: 'Haikuweza kuhifadhi chaguo lako. Angalia mtandao.',
  },
};

// Asks for consent, and afterwards shows plainly whether the microphone is on.
export function VoiceCard({ voice, lang = 'en', scale = 1 }: { voice: Voice; lang?: Lang; scale?: number }) {
  const [busy, setBusy] = useState(false);
  const x = TEXT[lang] as (typeof TEXT)['en'] & Record<string, string>;
  if (voice.consent === null) return null;

  async function change(agree: boolean) {
    setBusy(true);
    try {
      await voice.setConsent(agree);
    } catch {
      Alert.alert(x.title, x.fail);
    } finally {
      setBusy(false);
    }
  }

  function confirmOff() {
    Alert.alert(x.off_title, x.off_body, [
      { text: x.cancel, style: 'cancel' },
      { text: x.off, style: 'destructive', onPress: () => change(false) },
    ]);
  }

  const f = (n: number) => Math.round(n * scale);

  if (!voice.consent) {
    return (
      <Card tint="butter" style={{ marginTop: spacing.ms }}>
        <View style={styles.head}>
          <View style={styles.icon}>
            <Icon name="waveform" size={iconSize.inline * scale} color={colors.butterInk} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[text.h2, { fontSize: f(type.h2), lineHeight: f(26) }]}>{x.title}</Text>
            <Text style={[text.small, { color: colors.butterInk, fontSize: f(type.small), lineHeight: f(20) }]}>{x.lead}</Text>
          </View>
        </View>
        <View style={{ gap: spacing.sm, marginVertical: spacing.md }}>
          {x.points.map(([icon, p]) => (
            <View key={p} style={styles.point}>
              <Icon name={icon} size={18 * scale} color={colors.text} />
              <Text style={[text.body, { flex: 1, fontSize: f(type.body), lineHeight: f(23) }]}>{p}</Text>
            </View>
          ))}
        </View>
        <Button title={x.agree} variant="sage" icon="check" onPress={() => change(true)} loading={busy} />
      </Card>
    );
  }

  const status = voice.recording
    ? x.on_now
    : voice.reason === 'other_has_not_agreed'
      ? x.other
      : voice.reason === 'no_shift'
        ? x.no_shift
        : x.on;
  return (
    <Card tint={voice.recording ? 'sage' : 'surface'} style={{ marginTop: spacing.ms }} padded={false}>
      <View style={styles.compact}>
        <View style={[styles.icon, { backgroundColor: voice.recording ? colors.surface : colors.sunken }]}>
          {voice.recording ? <LiveDot color={colors.sage} /> : <Icon name="waveform" size={iconSize.inline * scale} color={colors.textMuted} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[text.bodyStrong, { fontSize: f(type.body), lineHeight: f(23) }]}>{x.title}</Text>
          <Text style={[text.small, { fontSize: f(type.small), lineHeight: f(20) }]}>{status}</Text>
          {voice.micDenied && <Text style={[styles.warn, { fontSize: f(type.small) }]}>{x.mic}</Text>}
        </View>
        <Pressable
          onPress={confirmOff}
          disabled={busy}
          style={styles.off}
          accessibilityRole="button"
          accessibilityLabel={`${x.off}: ${x.title}`}
        >
          <Text style={[styles.offText, { fontSize: f(type.small) }]}>{x.off}</Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  point: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms },
  compact: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms, padding: spacing.ms, paddingLeft: spacing.md },
  warn: { fontFamily: fonts.bodyBold, color: colors.danger, marginTop: 2 },
  off: { minHeight: TAP, minWidth: TAP, paddingHorizontal: spacing.ms, borderRadius: radius.pill, justifyContent: 'center', alignItems: 'center' },
  offText: { fontFamily: fonts.bodyBold, color: colors.primaryInk },
});

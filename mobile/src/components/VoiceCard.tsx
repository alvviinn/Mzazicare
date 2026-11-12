import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Voice } from '../audio/useVoiceMonitoring';
import { colors, icon, radius, scaled, space, TAP, text } from '../theme';
import { Icon, IconName } from './Icon';
import { Button, Card } from './ui';

type Lang = 'en' | 'sw';
type Words = {
  title: string;
  lead: string;
  points: [IconName, string][];
  agree: string;
  on_now: string;
  no_shift: string;
  other: string;
  on: string;
  off: string;
  off_title: string;
  off_body: string;
  cancel: string;
  mic: string;
  fail: string;
};

// Consent keeps its full meaning: three short promises, each with an icon.
const TEXT: Record<Lang, Words> = {
  en: {
    title: 'Voice tone',
    lead: 'Lets the family see how visits feel.',
    points: [
      ['pinCheck', 'Only during a verified visit'],
      ['micOff', 'Tone only · nothing recorded or written down'],
      ['people', 'Starts when both agree · stop anytime'],
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
      ['pinCheck', 'Wakati wa ziara iliyothibitishwa tu'],
      ['micOff', 'Sauti tu · hakuna rekodi wala maandishi'],
      ['people', 'Huanza mkikubali nyote · zima wakati wowote'],
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
  const x = TEXT[lang];
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

  if (!voice.consent) {
    return (
      <Card tint="secondary" style={{ marginTop: space.m }}>
        <View style={styles.head}>
          <View style={styles.icon}>
            <Icon name="waveform" size={icon.s * scale} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={scaled(text.heading, scale)}>{x.title}</Text>
            <Text style={scaled(text.caption, scale)}>{x.lead}</Text>
          </View>
        </View>
        <View style={styles.points}>
          {x.points.map(([name, p]) => (
            <View key={p} style={styles.point}>
              <Icon name={name} size={icon.s * scale} />
              <Text style={[scaled(text.body, scale), { flex: 1 }]}>{p}</Text>
            </View>
          ))}
        </View>
        <Button title={x.agree} variant="secondary" icon="check" onPress={() => change(true)} loading={busy} />
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
    <Card tint={voice.recording ? 'primary' : 'surface'} style={{ marginTop: space.m }} padded={false}>
      <View style={styles.compact}>
        <View style={[styles.icon, { backgroundColor: voice.recording ? colors.surface : colors.secondaryTint }]}>
          <Icon name={voice.recording ? 'mic' : 'waveform'} size={icon.s * scale} color={voice.recording ? colors.success : colors.ink} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={scaled(text.bodyStrong, scale)}>{x.title}</Text>
          <Text style={scaled(text.caption, scale)}>{status}</Text>
          {voice.micDenied && <Text style={[scaled(text.captionStrong, scale), { color: colors.error }]}>{x.mic}</Text>}
        </View>
        <Pressable onPress={confirmOff} disabled={busy} style={styles.off} accessibilityRole="button" accessibilityLabel={`${x.off}: ${x.title}`}>
          <Text style={[scaled(text.captionStrong, scale), { color: colors.secondary }]}>{x.off}</Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  icon: { width: TAP, height: TAP, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  points: { gap: space.s, marginVertical: space.m },
  point: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  compact: { flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m },
  off: { minHeight: TAP, minWidth: TAP, paddingHorizontal: space.s, borderRadius: radius.pill, justifyContent: 'center', alignItems: 'center' },
});

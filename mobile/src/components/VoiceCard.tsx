import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Voice } from '../audio/useVoiceMonitoring';
import { colors, radius, spacing } from '../theme';
import { Icon } from './Icon';
import { Button } from './ui';

type Lang = 'en' | 'sw';

const TEXT: Record<Lang, Record<string, string>> = {
  en: {
    title: 'Voice tone monitoring',
    ask:
      'While the caretaker is with the elderly person, both phones can listen to how the voices sound (calm, happy, stressed or angry) so the family can see how visits go.\n\n' +
      '• Only during a verified visit. Never at home or after the visit ends.\n' +
      '• The tone only: no words are written down and no recording is kept.\n' +
      '• It starts only when BOTH of you have agreed, and you can switch it off at any time.',
    agree: 'I agree',
    on_now: 'Listening now: a visit is in progress',
    no_shift: 'Not listening. It only listens during a visit.',
    other: 'Waiting for the other person to agree before anything is listened to.',
    you: 'You have switched this off.',
    on: 'You have agreed. It listens only during visits.',
    off: 'Turn off',
    off_title: 'Turn off voice monitoring?',
    off_body: 'Nothing will be listened to until you agree again.',
    cancel: 'Cancel',
    mic: 'Microphone permission is off. Turn it on in your phone settings.',
    fail: 'Could not save your choice. Check your connection.',
  },
  sw: {
    title: 'Ufuatiliaji wa sauti',
    ask:
      'Mlezi akiwa na mzee, simu zote mbili zinaweza kusikiliza jinsi sauti zinavyosikika (tulivu, furaha, wasiwasi au hasira) ili familia ione jinsi ziara zinavyoenda.\n\n' +
      '• Wakati wa ziara iliyothibitishwa tu. Kamwe nyumbani au baada ya ziara.\n' +
      '• Sauti tu: hakuna maneno yanayoandikwa wala rekodi inayohifadhiwa.\n' +
      '• Huanza tu wakati NYOTE mmekubali, na unaweza kuizima wakati wowote.',
    agree: 'Nakubali',
    on_now: 'Inasikiliza sasa: ziara inaendelea',
    no_shift: 'Haisikilizi. Inasikiliza wakati wa ziara tu.',
    other: 'Inasubiri mtu mwingine akubali kabla ya kusikiliza chochote.',
    you: 'Umezima huduma hii.',
    on: 'Umekubali. Inasikiliza wakati wa ziara tu.',
    off: 'Zima',
    off_title: 'Kuzima ufuatiliaji wa sauti?',
    off_body: 'Hakuna kitakachosikilizwa hadi ukubali tena.',
    cancel: 'Ghairi',
    mic: 'Ruhusa ya maikrofoni imezimwa. Iwashe kwenye mipangilio ya simu.',
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
      <View style={styles.card}>
        <View style={styles.head}>
          <Icon name="microphone-outline" size={24 * scale} />
          <Text style={[styles.title, { fontSize: 17 * scale }]}>{x.title}</Text>
        </View>
        <Text style={[styles.body, { fontSize: 14 * scale }]}>{x.ask}</Text>
        <Button title={x.agree} onPress={() => change(true)} loading={busy} />
      </View>
    );
  }

  const status = voice.recording ? x.on_now : voice.reason === 'other_has_not_agreed' ? x.other : voice.reason === 'no_shift' ? x.no_shift : x.on;
  return (
    <View style={[styles.card, voice.recording && styles.live]}>
      <View style={styles.head}>
        <Icon
          name={voice.recording ? 'microphone' : 'microphone-outline'}
          size={24 * scale}
          color={voice.recording ? colors.danger : colors.primary}
        />
        <Text style={[styles.title, { fontSize: 17 * scale }]}>{x.title}</Text>
      </View>
      <Text style={[styles.body, { fontSize: 14 * scale }]}>{status}</Text>
      {voice.micDenied && <Text style={[styles.warn, { fontSize: 13 * scale }]}>{x.mic}</Text>}
      <Text onPress={busy ? undefined : confirmOff} style={[styles.link, { fontSize: 14 * scale }]}>
        {x.off}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  live: { borderColor: colors.danger },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  title: { fontWeight: '700', color: colors.text },
  body: { color: colors.text, marginBottom: spacing.md },
  warn: { color: colors.warning, marginBottom: spacing.sm },
  link: { color: colors.primary, fontWeight: '600' },
});

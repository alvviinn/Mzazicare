import { useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { askBatteryUnrestricted, batteryUnrestricted } from '../../modules/mic-keeper';
import { colors, icon, radius, scaled, space, text } from '../theme';
import { Icon } from './Icon';
import { Button } from './ui';

// Android's battery saving puts MzaziCare to sleep when it has not been opened for a while: location stops,
// so visits are not seen and shifts do not start or end. Shown on the caretaker's and the elder's phone until
// the app is "Unrestricted"; one tap shows Android's own question.
const TEXT = {
  en: {
    title: 'Keep MzaziCare awake',
    body: 'Your phone may put MzaziCare to sleep when it is not opened for a while, and then visits are not recorded. Allow it to run in the background.',
    button: 'Allow',
  },
  sw: {
    title: 'Usiruhusu MzaziCare ilale',
    body: 'Simu yako inaweza kuilaza MzaziCare isipofunguliwa kwa muda, na ziara hazirekodiwi. Iruhusu ifanye kazi chinichini.',
    button: 'Ruhusu',
  },
};

export function BatteryNotice({ lang = 'en', scale = 1 }: { lang?: 'en' | 'sw'; scale?: number }) {
  const [ok, setOk] = useState(batteryUnrestricted);

  // Check again when the person comes back from Android's question or the settings.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setOk(batteryUnrestricted());
    });
    return () => sub.remove();
  }, []);

  if (ok) return null;
  const t = TEXT[lang];
  return (
    <View style={styles.box} accessibilityRole="alert">
      <View style={styles.head}>
        <Icon name="battery" size={icon.s * scale} color={colors.warning} />
        <Text style={[scaled(text.captionStrong, scale), { flexShrink: 1 }]}>{t.title}</Text>
      </View>
      <Text style={scaled(text.caption, scale)}>{t.body}</Text>
      <Button title={t.button} icon="battery" variant="secondary" onPress={() => askBatteryUnrestricted()} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.warningTint,
    borderRadius: radius.card,
    padding: space.m,
    gap: space.s,
    marginTop: space.m,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.s },
});

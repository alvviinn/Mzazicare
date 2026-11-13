import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getElderHome, sendCheckIn, sendSos, takeMedicine } from '../api/client';
import { useVoiceMonitoring } from '../audio/useVoiceMonitoring';
import { Icon, IconName, MOOD_ICON } from '../components/Icon';
import { SharingBanner } from '../components/SharingBanner';
import { Avatar, Button, Card, haptic, OfflineBanner, PressScale, Sheet } from '../components/ui';
import { VoiceCard } from '../components/VoiceCard';
import { Lang, t } from '../elder/i18n';
import { SCALES, useElderPrefs } from '../elder/prefs';
import { fmtTime } from '../format';
import { useLocationSharing } from '../location/useLocationSharing';
import { usePushTap } from '../push';
import { colors, icon, on, radius, scaled, space, TAP, text, textOnInk, TOP_INSET } from '../theme';
import { ElderHome, Medicine, Mood, Profile } from '../types';
import ChatScreen from './ChatScreen';

type Props = { token: string; profile: Profile; onSignOut: () => void };
type Status = ElderHome['caretaker']['status'];

// Mood faces alternate the two tints; icons stay ink.
const MOODS: { key: Mood; bg: string }[] = [
  { key: 'good', bg: colors.primaryTint },
  { key: 'okay', bg: colors.secondaryTint },
  { key: 'unwell', bg: colors.primaryTint },
];

const CARETAKER_ICON: Record<Status, { icon: IconName; color: string }> = {
  here: { icon: 'wave', color: colors.success },
  away: { icon: 'fall', color: colors.ink },
  left: { icon: 'checkCircle', color: colors.success },
  not_arrived: { icon: 'hourglass', color: colors.ink },
  none: { icon: 'person', color: colors.inkMuted },
};

const MED_ICON: Record<Medicine['state'], { icon: IconName; color: string }> = {
  taken: { icon: 'checkCircle', color: colors.success },
  due: { icon: 'bellRing', color: colors.ink },
  missed: { icon: 'alert', color: colors.error },
  later: { icon: 'clock', color: colors.inkMuted },
};

// 12-hour clock for "08:00" style values
function clock12(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export default function ElderlyHome({ token, profile, onSignOut }: Props) {
  const prefs = useElderPrefs();
  const { lang, scale } = prefs;
  // The same four text sizes, multiplied by the chosen text size.
  const T = {
    display: scaled(text.display, scale),
    heading: scaled(text.heading, scale),
    body: scaled(text.body, scale),
    bodyStrong: scaled(text.bodyStrong, scale),
    caption: scaled(text.caption, scale),
    captionStrong: scaled(text.captionStrong, scale),
  };

  const [home, setHome] = useState<ElderHome | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [pickingMood, setPickingMood] = useState(false);
  const [settings, setSettings] = useState(false);

  // This phone is the centre of the 15 m geofence that confirms the caretaker is with you.
  const sharing = useLocationSharing(token);
  const voice = useVoiceMonitoring(token);

  const load = useCallback(async () => {
    try {
      setHome(await getElderHome(token));
      setError(false);
    } catch {
      setError(true);
    }
  }, [token]);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function chooseMood(mood: Mood) {
    haptic.success();
    setPickingMood(false);
    try {
      await sendCheckIn(token, mood);
      await load();
    } catch {
      setError(true);
    }
  }

  async function take(m: Medicine) {
    haptic.success();
    setHome((h) => (h ? { ...h, medicines: h.medicines.map((x) => (x.id === m.id ? { ...x, taken: true, state: 'taken' } : x)) } : h));
    try {
      await takeMedicine(token, m.id);
    } catch {
      load();
    }
  }

  function askForHelp() {
    haptic.warn();
    Alert.alert(t(lang, 'help_title'), t(lang, 'help_body'), [
      { text: t(lang, 'no'), style: 'cancel' },
      {
        text: t(lang, 'yes_send'),
        style: 'destructive',
        onPress: async () => {
          try {
            await sendSos(token);
            Alert.alert(t(lang, 'sent'), t(lang, 'help_sent'));
          } catch {
            Alert.alert(t(lang, 'help_failed'));
          }
        },
      },
    ]);
  }

  // Tapping a message notification opens the chat with the family.
  usePushTap((tap) => {
    if (tap.type === 'chat') setChatOpen(true);
  });

  if (chatOpen && profile.sponsor) {
    return <ChatScreen token={token} peer={profile.sponsor} onBack={() => setChatOpen(false)} />;
  }

  const hour = new Date().getHours();
  const greeting = t(lang, hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening');
  const today = new Date().toLocaleDateString(lang === 'sw' ? 'sw-KE' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  const ct = home?.caretaker;
  const ctName = ct?.name?.split(' ')[0] ?? '';
  const mood = home?.mood_today;
  const showMoodButtons = !mood || pickingMood;
  const familyName = profile.sponsor?.name.split(' ')[0] ?? '';
  const caretakerLine = ct ? (ct.status === 'none' ? t(lang, 'caretaker_none') : t(lang, `caretaker_${ct.status}`, ctName)) : '';

  // Everyone linked to this person.
  const people: { name: string; role: string; invited: boolean }[] = [];
  if (profile.sponsor) people.push({ name: profile.sponsor.name, role: t(lang, 'family'), invited: false });
  profile.caretakers.forEach((c) => people.push({ name: c.name ?? c.email, role: t(lang, 'caretaker'), invited: c.status === 'pending' }));

  return (
    <View style={styles.flex}>
      <OfflineBanner />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={T.caption}>{today}</Text>
            <Text style={T.display} accessibilityRole="header">
              {greeting}, {profile.name.split(' ')[0]}
            </Text>
          </View>
          <PressScale
            onPress={() => setSettings(true)}
            style={styles.aa}
            accessibilityRole="button"
            accessibilityLabel={`${t(lang, 'text_size')}, ${t(lang, 'language')}`}
          >
            <Icon name="textSize" size={icon.m} />
          </PressScale>
        </View>

        {error && !home && (
          <Card style={{ marginBottom: space.m }}>
            <View style={styles.rowGap}>
              <Icon name="wifiOff" color={colors.error} />
              <Text style={[T.bodyStrong, { flex: 1 }]}>{t(lang, 'load_error')}</Text>
            </View>
          </Card>
        )}

        {/* Right now: is my caretaker here? */}
        {ct && (
          <Card tint="ink" style={{ marginBottom: space.m }}>
            <View style={styles.rowGap} accessible accessibilityLabel={caretakerLine}>
              <View style={styles.heroIcon}>
                <Icon name={CARETAKER_ICON[ct.status].icon} size={icon.l} color={CARETAKER_ICON[ct.status].color} />
              </View>
              <Text style={[scaled(textOnInk.heading, scale), { flex: 1 }]}>{caretakerLine}</Text>
            </View>
          </Card>
        )}

        {/* How are you feeling? Three big faces. */}
        <Card style={{ marginBottom: space.m }}>
          <Text style={T.heading}>{t(lang, 'feeling_q')}</Text>
          {showMoodButtons ? (
            <View style={styles.moods}>
              {MOODS.map((m) => (
                <PressScale
                  key={m.key}
                  style={[styles.mood, { backgroundColor: m.bg }]}
                  onPress={() => chooseMood(m.key)}
                  accessibilityRole="button"
                  accessibilityLabel={t(lang, m.key)}
                >
                  <Icon name={MOOD_ICON[m.key]} size={icon.l * scale} />
                  <Text style={T.bodyStrong}>{t(lang, m.key)}</Text>
                </PressScale>
              ))}
            </View>
          ) : (
            <View style={styles.answer}>
              <View style={[styles.answerIcon, { backgroundColor: MOODS.find((m) => m.key === mood!.mood)?.bg }]}>
                <Icon name={MOOD_ICON[mood!.mood]} size={icon.l} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={T.bodyStrong}>{t(lang, mood!.mood)}</Text>
                <Text style={T.caption}>
                  {fmtTime(mood!.at)} · {t(lang, mood!.mood === 'unwell' ? 'feeling_unwell_thanks' : 'feeling_thanks')}
                </Text>
              </View>
              <Pressable onPress={() => setPickingMood(true)} style={styles.change} accessibilityRole="button" accessibilityLabel={t(lang, 'change')}>
                <Text style={[T.captionStrong, { color: colors.primary }]}>{t(lang, 'change')}</Text>
              </Pressable>
            </View>
          )}
        </Card>

        {/* Medicines: one card each, the button in reach. */}
        {!!home?.medicines.length && (
          <>
            <Text style={[T.heading, { marginBottom: space.s }]}>{t(lang, 'medicine_title')}</Text>
            {home.medicines.map((m) => {
              const v = MED_ICON[m.state];
              const due = m.state === 'due' || m.state === 'missed';
              return (
                <Card key={m.id} tint={due ? 'primary' : 'surface'} style={{ marginBottom: space.s }}>
                  <View style={styles.rowGap}>
                    <View style={styles.medTime}>
                      <Icon name={v.icon} size={icon.m} color={v.color} />
                      <Text style={T.captionStrong}>{clock12(m.time)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={T.bodyStrong}>{m.name}</Text>
                      <Text style={due ? scaled(text.captionInk, scale) : T.caption}>
                        {[m.dose || null, m.state === 'later' ? t(lang, 'later_at', clock12(m.time)) : t(lang, m.state === 'taken' ? 'taken' : m.state === 'due' ? 'due_now' : 'missed')]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                  </View>
                  {!m.taken && (
                    <View style={{ marginTop: space.m }}>
                      <Button
                        title={t(lang, 'took_it')}
                        icon="check"
                        variant={due ? 'secondary' : 'soft'}
                        onPress={() => take(m)}
                        accessibilityLabel={`${t(lang, 'took_it')}: ${m.name}`}
                      />
                    </View>
                  )}
                </Card>
              );
            })}
          </>
        )}

        {/* Stay in touch */}
        {profile.sponsor && (
          <PressScale style={styles.msg} onPress={() => setChatOpen(true)} accessibilityRole="button" accessibilityLabel={t(lang, 'msg_family', familyName)}>
            <Avatar name={profile.sponsor.name} size={48} />
            <Text style={[T.bodyStrong, { flex: 1, color: on.secondary }]}>{t(lang, 'msg_family', familyName)}</Text>
            <Icon name="chat" size={icon.m} color={on.secondary} />
          </PressScale>
        )}

        {people.length > 0 && (
          <View style={styles.people}>
            {people.map((p, i) => (
              <View key={`${p.name}-${i}`} style={styles.person} accessible accessibilityLabel={`${p.name}, ${p.role}${p.invited ? `, ${t(lang, 'invited')}` : ''}`}>
                <Avatar name={p.name} size={56} />
                <Text style={T.captionStrong} numberOfLines={1}>
                  {p.name.split(' ')[0]}
                </Text>
                <Text style={T.caption}>{p.invited ? t(lang, 'invited') : p.role}</Text>
              </View>
            ))}
          </View>
        )}

        <VoiceCard voice={voice} lang={lang} scale={scale} />
        <SharingBanner status={sharing.status} lang={lang} scale={scale} />
      </ScrollView>

      {/* Always on screen: the emergency button */}
      <View style={styles.sosBar}>
        <PressScale style={styles.sos} onPress={askForHelp} accessibilityRole="button" accessibilityLabel={t(lang, 'help_button')}>
          <View style={styles.sosIcon}>
            <Icon name="siren" size={icon.m} color={colors.error} />
          </View>
          <Text style={[T.heading, { color: on.error }]}>{t(lang, 'help_button')}</Text>
        </PressScale>
      </View>

      <Sheet visible={settings} onClose={() => setSettings(false)} title={t(lang, 'text_size')}>
        <View style={styles.options}>
          {SCALES.map((k, i) => (
            <PressScale
              key={i}
              onPress={() => {
                haptic.tap();
                prefs.setScaleIndex(i);
              }}
              style={[styles.option, { backgroundColor: prefs.scaleIndex === i ? colors.primaryTint : colors.secondaryTint }]}
              accessibilityRole="radio"
              accessibilityState={{ selected: prefs.scaleIndex === i }}
              accessibilityLabel={`${t(lang, 'text_size')} ${i + 1}`}
            >
              <Text style={scaled(text.heading, k)}>A</Text>
            </PressScale>
          ))}
        </View>

        <Text style={[text.heading, styles.sheetTitle]}>{t(lang, 'language')}</Text>
        <View style={styles.options}>
          {(['en', 'sw'] as Lang[]).map((l) => (
            <PressScale
              key={l}
              onPress={() => {
                haptic.tap();
                prefs.setLang(l);
              }}
              style={[styles.option, { backgroundColor: lang === l ? colors.primaryTint : colors.secondaryTint }]}
              accessibilityRole="radio"
              accessibilityState={{ selected: lang === l }}
              accessibilityLabel={l === 'en' ? 'English' : 'Kiswahili'}
            >
              <Text style={text.bodyStrong}>{l === 'en' ? 'English' : 'Kiswahili'}</Text>
            </PressScale>
          ))}
        </View>

        <Text style={[text.heading, styles.sheetTitle]}>{t(lang, 'why_location')}</Text>
        <Text style={text.body}>{t(lang, 'phone_body')}</Text>

        <View style={{ marginTop: space.l }}>
          <Button title={t(lang, 'sign_out')} icon="logout" variant="soft" onPress={onSignOut} />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: space.m, paddingTop: TOP_INSET, paddingBottom: space.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.m, marginBottom: space.l },
  aa: { width: 56, height: 56, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  heroIcon: { width: 72, height: 72, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },

  moods: { flexDirection: 'row', gap: space.s, marginTop: space.m },
  mood: { flex: 1, alignItems: 'center', gap: space.s, paddingVertical: space.l, borderRadius: radius.small },
  answer: { flexDirection: 'row', alignItems: 'center', gap: space.m, marginTop: space.m },
  answerIcon: { width: 56, height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  change: { minHeight: TAP, minWidth: TAP, justifyContent: 'center', alignItems: 'center' },

  medTime: { width: 88, alignItems: 'center', gap: space.s, backgroundColor: colors.surface, borderRadius: radius.small, paddingVertical: space.s },

  msg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    backgroundColor: colors.secondary,
    borderRadius: radius.pill,
    padding: space.s,
    paddingRight: space.l,
    minHeight: 64,
    marginTop: space.s,
  },

  people: { flexDirection: 'row', flexWrap: 'wrap', gap: space.m, marginTop: space.l },
  person: { width: 80, alignItems: 'center', gap: space.s },

  sosBar: { paddingHorizontal: space.m, paddingTop: space.s, paddingBottom: space.m, backgroundColor: colors.background },
  sos: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.m,
    backgroundColor: colors.error,
    borderRadius: radius.pill,
    minHeight: 72,
    paddingHorizontal: space.m,
  },
  sosIcon: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },

  options: { flexDirection: 'row', gap: space.s },
  option: { flex: 1, minHeight: 64, borderRadius: radius.small, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { marginTop: space.l, marginBottom: space.s },
});

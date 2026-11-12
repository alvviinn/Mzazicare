import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getElderHome, sendCheckIn, sendSos, takeMedicine } from '../api/client';
import { useVoiceMonitoring } from '../audio/useVoiceMonitoring';
import { Icon, IconName, MOOD_ICON } from '../components/Icon';
import { SharingBanner } from '../components/SharingBanner';
import { Avatar, Button, Card, haptic, OfflineBanner, PressScale, Sheet, Stripe } from '../components/ui';
import { VoiceCard } from '../components/VoiceCard';
import { Lang, t } from '../elder/i18n';
import { SCALES, useElderPrefs } from '../elder/prefs';
import { fmtTime } from '../format';
import { useLocationSharing } from '../location/useLocationSharing';
import { colors, fonts, radius, spacing, TAP, text, TOP_INSET } from '../theme';
import { ElderHome, Medicine, Mood, Profile } from '../types';
import ChatScreen from './ChatScreen';

type Props = { token: string; profile: Profile; onSignOut: () => void };
type Status = ElderHome['caretaker']['status'];

const MOODS: { key: Mood; bg: string; fg: string }[] = [
  { key: 'good', bg: colors.sageSoft, fg: colors.sage },
  { key: 'okay', bg: colors.butter, fg: colors.butterInk },
  { key: 'unwell', bg: colors.primarySoft, fg: colors.primaryInk },
];

const CARETAKER_VISUAL: Record<Status, { icon: IconName; bg: string; fg: string }> = {
  here: { icon: 'hand-wave-outline', bg: colors.sageSoft, fg: colors.sage },
  away: { icon: 'walk', bg: colors.butter, fg: colors.butterInk },
  left: { icon: 'check-circle-outline', bg: colors.surface, fg: colors.sage },
  not_arrived: { icon: 'timer-sand', bg: colors.surface, fg: colors.textMuted },
  none: { icon: 'account-outline', bg: colors.surface, fg: colors.textMuted },
};

const MED_VISUAL: Record<Medicine['state'], { icon: IconName; color: string }> = {
  taken: { icon: 'check-circle', color: colors.sage },
  due: { icon: 'bell-ring-outline', color: colors.primaryInk },
  missed: { icon: 'alert-circle-outline', color: colors.danger },
  later: { icon: 'clock-outline', color: colors.textMuted },
};

// 12-hour clock for "08:00" style values
function clock12(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export default function ElderlyHome({ token, profile, onSignOut }: Props) {
  const prefs = useElderPrefs();
  const { lang, scale } = prefs;
  const f = (n: number) => Math.round(n * scale); // scaled size

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
    setHome((h) =>
      h ? { ...h, medicines: h.medicines.map((x) => (x.id === m.id ? { ...x, taken: true, state: 'taken' } : x)) } : h,
    );
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

  // Everyone linked to this person.
  const people: { name: string; role: string; invited: boolean }[] = [];
  if (profile.sponsor) people.push({ name: profile.sponsor.name, role: t(lang, 'family'), invited: false });
  profile.caretakers.forEach((c) => people.push({ name: c.name ?? c.email, role: t(lang, 'caretaker'), invited: c.status === 'pending' }));

  const big = { fontSize: f(26), lineHeight: f(32) };
  const body = { fontSize: f(17), lineHeight: f(24) };
  const small = { fontSize: f(15), lineHeight: f(21) };

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
            <Text style={[text.small, small]}>{today}</Text>
            <Text style={[text.h1, { fontSize: f(30), lineHeight: f(36) }]} accessibilityRole="header">
              {greeting}, {profile.name.split(' ')[0]}
            </Text>
          </View>
          <PressScale
            onPress={() => setSettings(true)}
            style={styles.aa}
            accessibilityRole="button"
            accessibilityLabel={`${t(lang, 'text_size')}, ${t(lang, 'language')}`}
          >
            <Text style={styles.aaText}>Aa</Text>
          </PressScale>
        </View>
        <Stripe height={6} style={{ width: 96, marginBottom: spacing.lg }} />

        {error && !home && (
          <Card tint="danger" style={{ marginBottom: spacing.md }}>
            <Text style={[text.bodyStrong, body, { color: colors.danger }]}>{t(lang, 'load_error')}</Text>
          </Card>
        )}

        {/* Right now: is my caretaker here? */}
        {ct && (
          <Card raised style={{ backgroundColor: CARETAKER_VISUAL[ct.status].bg, marginBottom: spacing.md }}>
            <View style={styles.heroRow} accessible accessibilityLabel={ct.status === 'none' ? t(lang, 'caretaker_none') : t(lang, `caretaker_${ct.status}`, ctName)}>
              <View style={[styles.heroIcon, { width: f(72), height: f(72), borderRadius: f(36) }]}>
                <Icon name={CARETAKER_VISUAL[ct.status].icon} size={f(36)} color={CARETAKER_VISUAL[ct.status].fg} />
              </View>
              <Text style={[text.h1, big, { flex: 1 }]}>
                {ct.status === 'none' ? t(lang, 'caretaker_none') : t(lang, `caretaker_${ct.status}`, ctName)}
              </Text>
            </View>
          </Card>
        )}

        {/* How are you feeling? Three big faces. */}
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[text.h2, { fontSize: f(21), lineHeight: f(27) }]}>{t(lang, 'feeling_q')}</Text>
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
                  <Icon name={MOOD_ICON[m.key]} size={f(48)} color={m.fg} />
                  <Text style={[text.bodyStrong, body, { color: m.fg }]}>{t(lang, m.key)}</Text>
                </PressScale>
              ))}
            </View>
          ) : (
            <View style={styles.answer}>
              <View style={[styles.answerIcon, { backgroundColor: MOODS.find((m) => m.key === mood!.mood)?.bg }]}>
                <Icon name={MOOD_ICON[mood!.mood]} size={f(36)} color={MOODS.find((m) => m.key === mood!.mood)?.fg} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[text.bodyStrong, body]}>{t(lang, mood!.mood)}</Text>
                <Text style={[text.small, small]}>
                  {fmtTime(mood!.at)} · {t(lang, mood!.mood === 'unwell' ? 'feeling_unwell_thanks' : 'feeling_thanks')}
                </Text>
              </View>
              <Pressable onPress={() => setPickingMood(true)} style={styles.change} accessibilityRole="button" accessibilityLabel={t(lang, 'change')}>
                <Text style={[styles.link, small]}>{t(lang, 'change')}</Text>
              </Pressable>
            </View>
          )}
        </Card>

        {/* Medicines: one card each, the button in reach. */}
        {!!home?.medicines.length && (
          <>
            <Text style={[text.h2, { fontSize: f(21), lineHeight: f(27), marginBottom: spacing.ms }]}>{t(lang, 'medicine_title')}</Text>
            {home.medicines.map((m) => {
              const v = MED_VISUAL[m.state];
              const due = m.state === 'due' || m.state === 'missed';
              return (
                <Card key={m.id} tint={m.taken ? 'sage' : due ? 'peach' : 'surface'} style={{ marginBottom: spacing.ms }}>
                  <View style={styles.med}>
                    <View style={styles.medTime}>
                      <Icon name={v.icon} size={f(26)} color={v.color} />
                      <Text style={[styles.medClock, { fontSize: f(14) }]}>{clock12(m.time)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[text.bodyStrong, body]}>{m.name}</Text>
                      <Text style={[text.small, small, { color: v.color }]}>
                        {[m.dose || null, m.state === 'later' ? t(lang, 'later_at', clock12(m.time)) : t(lang, m.state === 'taken' ? 'taken' : m.state === 'due' ? 'due_now' : 'missed')]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                  </View>
                  {!m.taken && (
                    <View style={{ marginTop: spacing.ms }}>
                      <Button
                        title={t(lang, 'took_it')}
                        icon="check"
                        variant={due ? 'primary' : 'secondary'}
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
          <PressScale
            style={styles.msg}
            onPress={() => setChatOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t(lang, 'msg_family', familyName)}
          >
            <Avatar name={profile.sponsor.name} size={f(48)} ring={colors.surface} />
            <Text style={[styles.msgText, { fontSize: f(19) }]}>{t(lang, 'msg_family', familyName)}</Text>
            <Icon name="message-text" size={f(26)} color={colors.onPrimary} />
          </PressScale>
        )}

        {people.length > 0 && (
          <View style={styles.people}>
            {people.map((p, i) => (
              <View key={`${p.name}-${i}`} style={styles.person} accessible accessibilityLabel={`${p.name}, ${p.role}${p.invited ? `, ${t(lang, 'invited')}` : ''}`}>
                <Avatar name={p.name} size={f(52)} />
                <Text style={[text.smallStrong, small]} numberOfLines={1}>
                  {p.name.split(' ')[0]}
                </Text>
                <Text style={[text.caption, { fontSize: f(12) }]}>{p.invited ? t(lang, 'invited') : p.role}</Text>
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
            <Icon name="alarm-light" size={f(26)} color={colors.danger} />
          </View>
          <Text style={[styles.sosText, { fontSize: f(22) }]}>{t(lang, 'help_button')}</Text>
        </PressScale>
      </View>

      <Sheet visible={settings} onClose={() => setSettings(false)} title={t(lang, 'text_size')}>
        <View style={styles.sizes}>
          {SCALES.map((_, i) => (
            <PressScale
              key={i}
              onPress={() => {
                haptic.tap();
                prefs.setScaleIndex(i);
              }}
              style={[styles.size, prefs.scaleIndex === i && styles.sizeOn]}
              accessibilityRole="radio"
              accessibilityState={{ selected: prefs.scaleIndex === i }}
              accessibilityLabel={`${t(lang, 'text_size')} ${i + 1}`}
            >
              <Text style={[styles.sizeText, { fontSize: 18 + i * 8 }, prefs.scaleIndex === i && { color: colors.onPrimary }]}>A</Text>
            </PressScale>
          ))}
        </View>

        <Text style={[text.h2, { marginTop: spacing.lg, marginBottom: spacing.ms }]}>{t(lang, 'language')}</Text>
        <View style={styles.sizes}>
          {(['en', 'sw'] as Lang[]).map((l) => (
            <PressScale
              key={l}
              onPress={() => {
                haptic.tap();
                prefs.setLang(l);
              }}
              style={[styles.size, lang === l && styles.sizeOn]}
              accessibilityRole="radio"
              accessibilityState={{ selected: lang === l }}
              accessibilityLabel={l === 'en' ? 'English' : 'Kiswahili'}
            >
              <Text style={[text.bodyStrong, lang === l && { color: colors.onPrimary }]}>{l === 'en' ? 'English' : 'Kiswahili'}</Text>
            </PressScale>
          ))}
        </View>

        <Text style={[text.h2, { marginTop: spacing.lg }]}>{t(lang, 'why_location')}</Text>
        <Text style={[text.body, { marginTop: spacing.xs }]}>{t(lang, 'phone_body')}</Text>

        <View style={{ marginTop: spacing.lg }}>
          <Button title={t(lang, 'sign_out')} icon="logout" variant="quiet" onPress={onSignOut} />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.md, paddingTop: TOP_INSET, paddingBottom: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms, marginBottom: spacing.ms },
  aa: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  aaText: { fontFamily: fonts.display, fontSize: 22, color: colors.text },

  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroIcon: { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },

  moods: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  mood: { flex: 1, alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.lg, borderRadius: radius.lg },
  answer: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms, marginTop: spacing.md },
  answerIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  change: { minHeight: TAP, minWidth: TAP, justifyContent: 'center', alignItems: 'center' },
  link: { fontFamily: fonts.bodyBold, color: colors.primaryInk },

  med: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  medTime: { width: 76, alignItems: 'center', gap: 2, backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: spacing.sm },
  medClock: { fontFamily: fonts.bodyBold, color: colors.text },

  msg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    backgroundColor: colors.sage,
    borderRadius: radius.pill,
    padding: spacing.sm,
    paddingRight: spacing.lg,
    minHeight: 68,
    marginTop: spacing.sm,
  },
  msgText: { flex: 1, fontFamily: fonts.bodyBold, color: colors.onPrimary },

  people: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.lg },
  person: { width: 80, alignItems: 'center', gap: 4 },

  sosBar: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md, backgroundColor: colors.background },
  sos: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.ms,
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    minHeight: 72,
    paddingHorizontal: spacing.md,
  },
  sosIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  sosText: { fontFamily: fonts.display, color: colors.onPrimary },

  sizes: { flexDirection: 'row', gap: spacing.sm },
  size: { flex: 1, minHeight: 64, borderRadius: radius.lg, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  sizeOn: { backgroundColor: colors.text },
  sizeText: { fontFamily: fonts.display, color: colors.text },
});

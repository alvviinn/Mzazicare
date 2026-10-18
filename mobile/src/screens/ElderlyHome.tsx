import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getElderHome, sendCheckIn, sendSos, takeMedicine } from '../api/client';
import { FamilyCard } from '../components/HomeShell';
import { SharingBanner } from '../components/SharingBanner';
import { Icon, IconName, MOOD_ICON } from '../components/Icon';
import { Card } from '../components/ui';
import { Lang, t } from '../elder/i18n';
import { useElderPrefs } from '../elder/prefs';
import { fmtTime } from '../format';
import { useLocationSharing } from '../location/useLocationSharing';
import { colors, radius, spacing } from '../theme';
import { ElderHome, Medicine, Mood, Profile } from '../types';
import ChatScreen from './ChatScreen';

type Props = { token: string; profile: Profile; onSignOut: () => void };

const MOODS: { key: Mood; color: string }[] = [
  { key: 'good', color: colors.success },
  { key: 'okay', color: colors.textMuted },
  { key: 'unwell', color: colors.warning },
];

const CARETAKER_ICON: Record<ElderHome['caretaker']['status'], { icon: IconName; color: string }> = {
  here: { icon: 'hand-wave-outline', color: colors.success },
  away: { icon: 'walk', color: colors.warning },
  left: { icon: 'check-circle-outline', color: colors.primary },
  not_arrived: { icon: 'timer-sand', color: colors.textMuted },
  none: { icon: 'account-outline', color: colors.textMuted },
};

// 12-hour clock for "08:00" style values
function clock12(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export default function ElderlyHome({ token, profile, onSignOut }: Props) {
  const prefs = useElderPrefs();
  const { lang, scale } = prefs;
  const f = (n: number) => Math.round(n * scale); // scaled font size

  const [home, setHome] = useState<ElderHome | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [pickingMood, setPickingMood] = useState(false);

  // This phone is the centre of the 15 m geofence that confirms the caretaker is with you.
  const sharing = useLocationSharing(token);

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
    setPickingMood(false);
    try {
      await sendCheckIn(token, mood);
      await load();
    } catch {
      setError(true);
    }
  }

  async function take(m: Medicine) {
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
  const today = new Date().toLocaleDateString(lang === 'sw' ? 'sw-KE' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const ct = home?.caretaker;
  const ctName = ct?.name?.split(' ')[0] ?? '';
  const mood = home?.mood_today;
  const showMoodButtons = !mood || pickingMood;
  const familyName = profile.sponsor?.name.split(' ')[0];

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        {/* Greeting + comfort settings */}
        <Text style={[styles.greeting, { fontSize: f(30) }]}>
          {greeting}, {profile.name.split(' ')[0]}
        </Text>
        <Text style={[styles.date, { fontSize: f(17) }]}>{today}</Text>

        <View style={styles.prefs}>
          <Pressable style={styles.pref} onPress={prefs.cycleScale} accessibilityLabel="Text size">
            <Text style={[styles.prefText, { fontSize: 14 + prefs.scaleIndex * 4 }]}>A</Text>
          </Pressable>
          {(['en', 'sw'] as Lang[]).map((l) => (
            <Pressable key={l} style={[styles.pref, lang === l && styles.prefOn]} onPress={() => prefs.setLang(l)}>
              <Text style={[styles.prefText, lang === l && { color: colors.onPrimary }]}>
                {l === 'en' ? 'English' : 'Kiswahili'}
              </Text>
            </Pressable>
          ))}
        </View>

        {error && !home && <Text style={[styles.error, { fontSize: f(16) }]}>{t(lang, 'load_error')}</Text>}

        {/* Is my caretaker here? */}
        {ct && (
          <Card>
            <View style={styles.row}>
              <View
                style={[
                  styles.badge,
                  { width: f(56), height: f(56), borderRadius: f(28), backgroundColor: CARETAKER_ICON[ct.status].color + '22' },
                ]}
              >
                <Icon name={CARETAKER_ICON[ct.status].icon} size={f(30)} color={CARETAKER_ICON[ct.status].color} />
              </View>
              <Text style={[styles.big, { fontSize: f(22), flex: 1 }]}>
                {ct.status === 'none' ? t(lang, 'caretaker_none') : t(lang, `caretaker_${ct.status}`, ctName)}
              </Text>
            </View>
          </Card>
        )}

        {/* How are you feeling? */}
        <Card>
          <Text style={[styles.big, { fontSize: f(22) }]}>{t(lang, 'feeling_q')}</Text>
          {showMoodButtons ? (
            <View style={styles.moods}>
              {MOODS.map((m) => (
                <Pressable key={m.key} style={styles.mood} onPress={() => chooseMood(m.key)}>
                  <Icon name={MOOD_ICON[m.key]} size={f(48)} color={m.color} />
                  <Text style={[styles.moodLabel, { fontSize: f(16) }]}>{t(lang, m.key)}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View>
              <View style={[styles.row, { marginTop: spacing.md }]}>
                <Icon
                  name={MOOD_ICON[mood!.mood]}
                  size={f(30)}
                  color={MOODS.find((m) => m.key === mood!.mood)?.color ?? colors.primary}
                />
                <Text style={[styles.answer, { fontSize: f(18), marginTop: 0, marginLeft: spacing.sm }]}>
                  {t(lang, mood!.mood)} · {fmtTime(mood!.at)}
                </Text>
              </View>
              <Text style={[styles.muted, { fontSize: f(16) }]}>
                {t(lang, mood!.mood === 'unwell' ? 'feeling_unwell_thanks' : 'feeling_thanks')}
              </Text>
              <Pressable onPress={() => setPickingMood(true)} style={{ marginTop: spacing.sm }}>
                <Text style={[styles.link, { fontSize: f(16) }]}>{t(lang, 'change')}</Text>
              </Pressable>
            </View>
          )}
        </Card>

        {/* Today's medicine */}
        {!!home?.medicines.length && (
          <Card>
            <View style={styles.row}>
              <Icon name="pill" size={f(26)} />
              <Text style={[styles.big, { fontSize: f(22), marginLeft: spacing.sm }]}>{t(lang, 'medicine_title')}</Text>
            </View>
            {home.medicines.map((m, i) => (
              <View key={m.id} style={[styles.medRow, i > 0 && styles.rowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.medName, { fontSize: f(19) }]}>{m.name}</Text>
                  {!!m.dose && <Text style={[styles.muted, { fontSize: f(15) }]}>{m.dose}</Text>}
                  <Text
                    style={[
                      styles.muted,
                      { fontSize: f(15) },
                      m.state === 'due' && { color: colors.warning, fontWeight: '700' },
                      m.state === 'missed' && { color: colors.danger, fontWeight: '700' },
                    ]}
                  >
                    {m.state === 'later'
                      ? t(lang, 'later_at', clock12(m.time))
                      : m.state === 'taken'
                      ? t(lang, 'taken')
                      : t(lang, m.state === 'due' ? 'due_now' : 'missed')}
                  </Text>
                </View>
                {!m.taken && (
                  <Pressable style={styles.tookBtn} onPress={() => take(m)}>
                    <Text style={[styles.tookText, { fontSize: f(16) }]}>{t(lang, 'took_it')}</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </Card>
        )}

        {/* Talk to family */}
        {profile.sponsor && (
          <Pressable style={styles.msgBtn} onPress={() => setChatOpen(true)}>
            <View style={styles.btnRow}>
              <Icon name="message-text-outline" size={f(26)} color={colors.onPrimary} />
              <Text style={[styles.msgText, { fontSize: f(20), marginLeft: spacing.sm }]}>
                {t(lang, 'msg_family', familyName ?? '')}
              </Text>
            </View>
          </Pressable>
        )}

        {/* People around me */}
        <Text style={[styles.section, { fontSize: f(20) }]}>{t(lang, 'circle_title')}</Text>
        <FamilyCard profile={{ ...profile, elderly: profile.elderly.filter((e) => e.email !== profile.email) }} />

        {/* Why the phone shares its location */}
        <Card>
          <View style={styles.row}>
            <Icon name="map-marker-outline" size={f(22)} />
            <Text style={[styles.big, { fontSize: f(18), marginLeft: spacing.sm }]}>{t(lang, 'phone_title')}</Text>
          </View>
          <Text style={[styles.muted, { fontSize: f(15), marginTop: spacing.xs }]}>{t(lang, 'phone_body')}</Text>
          <SharingBanner status={sharing.status} lang={lang} scale={scale} />
        </Card>

        <Pressable onPress={onSignOut} style={{ alignSelf: 'center', padding: spacing.md }}>
          <Text style={[styles.link, { fontSize: f(15) }]}>{t(lang, 'sign_out')}</Text>
        </Pressable>
      </ScrollView>

      {/* Always on screen: the emergency button */}
      <View style={styles.sosBar}>
        <Pressable style={({ pressed }) => [styles.sos, pressed && { opacity: 0.85 }]} onPress={askForHelp}>
          <View style={styles.btnRow}>
            <Icon name="alarm-light-outline" size={f(28)} color={colors.onPrimary} />
            <Text style={[styles.sosText, { fontSize: f(22), marginLeft: spacing.sm }]}>{t(lang, 'help_button')}</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingTop: spacing.xl + spacing.lg, paddingBottom: spacing.xl },
  greeting: { fontWeight: '700', color: colors.text },
  date: { color: colors.textMuted, marginTop: 2 },
  prefs: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md },
  pref: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 44,
    alignItems: 'center',
  },
  prefOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  prefText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  error: { color: colors.danger, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  btnRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  badge: { alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  big: { fontWeight: '700', color: colors.text },
  muted: { color: colors.textMuted, marginTop: 2 },
  answer: { fontWeight: '700', color: colors.primary, marginTop: spacing.md },
  link: { color: colors.primary, fontWeight: '700' },
  moods: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  mood: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
  },
  moodLabel: { color: colors.text, fontWeight: '600', marginTop: 4 },
  medRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  medName: { fontWeight: '700', color: colors.text },
  tookBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    marginLeft: spacing.sm,
  },
  tookText: { color: colors.onPrimary, fontWeight: '700' },
  msgBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 20,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  msgText: { color: colors.onPrimary, fontWeight: '700' },
  section: { fontWeight: '700', color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  sosBar: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sos: { backgroundColor: colors.danger, borderRadius: radius.lg, paddingVertical: 20, alignItems: 'center' },
  sosText: { color: colors.onPrimary, fontWeight: '800', letterSpacing: 0.5 },
});

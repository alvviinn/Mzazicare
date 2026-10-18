import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getElderHome, sendCheckIn, sendSos, takeMedicine } from '../api/client';
import { Icon, IconName, MOOD_ICON } from '../components/Icon';
import { SharingBanner } from '../components/SharingBanner';
import { Lang, t } from '../elder/i18n';
import { SCALES, useElderPrefs } from '../elder/prefs';
import { fmtTime } from '../format';
import { useLocationSharing } from '../location/useLocationSharing';
import { colors, radius, spacing } from '../theme';
import { ElderHome, Medicine, Mood, Profile } from '../types';
import ChatScreen from './ChatScreen';

type Props = { token: string; profile: Profile; onSignOut: () => void };
type Status = ElderHome['caretaker']['status'];

const MOODS: { key: Mood; color: string }[] = [
  { key: 'good', color: colors.success },
  { key: 'okay', color: colors.textMuted },
  { key: 'unwell', color: colors.warning },
];

const CARETAKER_VISUAL: Record<Status, { icon: IconName; color: string }> = {
  here: { icon: 'hand-wave-outline', color: colors.success },
  away: { icon: 'walk', color: colors.warning },
  left: { icon: 'check-circle-outline', color: colors.primary },
  not_arrived: { icon: 'timer-sand', color: colors.textMuted },
  none: { icon: 'account-outline', color: colors.textMuted },
};

const MED_VISUAL: Record<Medicine['state'], { icon: IconName; color: string }> = {
  taken: { icon: 'check-circle', color: colors.success },
  due: { icon: 'clock-alert-outline', color: colors.warning },
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
  const f = (n: number) => Math.round(n * scale); // scaled font size

  const [home, setHome] = useState<ElderHome | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [pickingMood, setPickingMood] = useState(false);
  const [showWhy, setShowWhy] = useState(false);

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
  const familyName = profile.sponsor?.name.split(' ')[0] ?? '';

  // Everyone linked to this person, in one simple list.
  const people: { name: string; role: string; invited: boolean }[] = [];
  if (profile.sponsor) people.push({ name: profile.sponsor.name, role: t(lang, 'family'), invited: false });
  profile.caretakers.forEach((c) =>
    people.push({ name: c.name ?? c.email, role: t(lang, 'caretaker'), invited: c.status === 'pending' }),
  );

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        {/* ── Header ─────────────────────────────── */}
        <Text style={[styles.greeting, { fontSize: f(30) }]}>
          {greeting}, {profile.name.split(' ')[0]}
        </Text>
        <Text style={[styles.date, { fontSize: f(17) }]}>{today}</Text>

        {/* ── Comfort settings: text size and language ── */}
        <View style={styles.settings}>
          <View style={styles.settingGroup}>
            <Text style={styles.settingLabel}>{t(lang, 'text_size')}</Text>
            <View style={styles.segment}>
              {SCALES.map((_, i) => (
                <Pressable
                  key={i}
                  accessibilityLabel={`${t(lang, 'text_size')} ${i + 1}`}
                  onPress={() => prefs.setScaleIndex(i)}
                  style={[styles.seg, prefs.scaleIndex === i && styles.segOn]}
                >
                  <Text style={[styles.segText, { fontSize: 13 + i * 4 }, prefs.scaleIndex === i && styles.segTextOn]}>A</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.settingGroup}>
            <Text style={styles.settingLabel}>{t(lang, 'language')}</Text>
            <View style={styles.segment}>
              {(['en', 'sw'] as Lang[]).map((l) => (
                <Pressable key={l} onPress={() => prefs.setLang(l)} style={[styles.seg, lang === l && styles.segOn]}>
                  <Text style={[styles.segText, lang === l && styles.segTextOn]}>{l === 'en' ? 'English' : 'Kiswahili'}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {error && !home && <Text style={[styles.error, { fontSize: f(16) }]}>{t(lang, 'load_error')}</Text>}

        {/* ── Right now ──────────────────────────── */}
        <Section title={t(lang, 'right_now')} size={f(19)} />
        {ct && (
          <View style={[styles.card, styles.hero, { borderLeftColor: CARETAKER_VISUAL[ct.status].color }]}>
            <View
              style={[
                styles.badge,
                { width: f(60), height: f(60), borderRadius: f(30), backgroundColor: CARETAKER_VISUAL[ct.status].color + '22' },
              ]}
            >
              <Icon name={CARETAKER_VISUAL[ct.status].icon} size={f(32)} color={CARETAKER_VISUAL[ct.status].color} />
            </View>
            <Text style={[styles.heroText, { fontSize: f(22) }]}>
              {ct.status === 'none' ? t(lang, 'caretaker_none') : t(lang, `caretaker_${ct.status}`, ctName)}
            </Text>
          </View>
        )}

        {/* ── Today ──────────────────────────────── */}
        <Section title={t(lang, 'today')} size={f(19)} />

        <View style={styles.card}>
          <Text style={[styles.cardTitle, { fontSize: f(20) }]}>{t(lang, 'feeling_q')}</Text>
          {showMoodButtons ? (
            <View style={styles.moods}>
              {MOODS.map((m) => (
                <Pressable key={m.key} style={styles.mood} onPress={() => chooseMood(m.key)}>
                  <Icon name={MOOD_ICON[m.key]} size={f(46)} color={m.color} />
                  <Text style={[styles.moodLabel, { fontSize: f(16) }]}>{t(lang, m.key)}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <>
              <View style={styles.answerRow}>
                <Icon
                  name={MOOD_ICON[mood!.mood]}
                  size={f(34)}
                  color={MOODS.find((m) => m.key === mood!.mood)?.color ?? colors.primary}
                />
                <View style={{ marginLeft: spacing.md, flex: 1 }}>
                  <Text style={[styles.answerTitle, { fontSize: f(19) }]}>{t(lang, mood!.mood)}</Text>
                  <Text style={[styles.muted, { fontSize: f(15) }]}>
                    {fmtTime(mood!.at)} · {t(lang, mood!.mood === 'unwell' ? 'feeling_unwell_thanks' : 'feeling_thanks')}
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => setPickingMood(true)} style={styles.linkBtn}>
                <Text style={[styles.link, { fontSize: f(16) }]}>{t(lang, 'change')}</Text>
              </Pressable>
            </>
          )}
        </View>

        {!!home?.medicines.length && (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Icon name="pill" size={f(26)} />
              <Text style={[styles.cardTitle, { fontSize: f(20), marginLeft: spacing.sm }]}>{t(lang, 'medicine_title')}</Text>
            </View>
            {home.medicines.map((m, i) => {
              const v = MED_VISUAL[m.state];
              return (
                <View key={m.id} style={[styles.medRow, i > 0 && styles.rowBorder]}>
                  <Icon name={v.icon} size={f(28)} color={v.color} />
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text style={[styles.medName, { fontSize: f(19) }]}>{m.name}</Text>
                    <Text style={[styles.muted, { fontSize: f(15) }]}>
                      {[m.dose, m.state === 'later' || m.state === 'taken' ? clock12(m.time) : null].filter(Boolean).join(' · ')}
                    </Text>
                    <Text
                      style={[
                        styles.medState,
                        { fontSize: f(15), color: v.color },
                      ]}
                    >
                      {m.state === 'later' ? t(lang, 'later_at', clock12(m.time)) : t(lang, m.state === 'taken' ? 'taken' : m.state === 'due' ? 'due_now' : 'missed')}
                    </Text>
                  </View>
                  {!m.taken && (
                    <Pressable style={styles.tookBtn} onPress={() => take(m)}>
                      <Text style={[styles.tookText, { fontSize: f(16) }]}>{t(lang, 'took_it')}</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* ── Stay in touch ──────────────────────── */}
        <Section title={t(lang, 'stay_in_touch')} size={f(19)} />

        {profile.sponsor && (
          <Pressable style={({ pressed }) => [styles.msgBtn, pressed && { opacity: 0.9 }]} onPress={() => setChatOpen(true)}>
            <Icon name="message-text-outline" size={f(26)} color={colors.onPrimary} />
            <Text style={[styles.msgText, { fontSize: f(20) }]}>{t(lang, 'msg_family', familyName)}</Text>
          </Pressable>
        )}

        {people.length > 0 && (
          <View style={[styles.card, { marginTop: spacing.md }]}>
            {people.map((p, i) => (
              <View key={`${p.name}-${i}`} style={[styles.personRow, i > 0 && styles.rowBorder]}>
                <View style={[styles.avatar, { width: f(44), height: f(44), borderRadius: f(22) }]}>
                  <Text style={[styles.avatarText, { fontSize: f(18) }]}>{p.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.personName, { fontSize: f(18) }]}>{p.name}</Text>
                  <Text style={[styles.muted, { fontSize: f(14) }]}>
                    {p.role}
                    {p.invited ? ` · ${t(lang, 'invited')}` : ''}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── About ──────────────────────────────── */}
        <Section title={t(lang, 'about')} size={f(19)} />
        <View style={styles.card}>
          <Pressable onPress={() => setShowWhy((v) => !v)} style={styles.cardHead}>
            <Icon name="map-marker-outline" size={f(24)} />
            <Text style={[styles.whyTitle, { fontSize: f(17) }]}>{t(lang, 'why_location')}</Text>
            <Icon name={showWhy ? 'chevron-up' : 'chevron-down'} size={f(24)} color={colors.textMuted} />
          </Pressable>
          {showWhy && <Text style={[styles.muted, { fontSize: f(15), marginTop: spacing.sm }]}>{t(lang, 'phone_body')}</Text>}
          <SharingBanner status={sharing.status} lang={lang} scale={scale} />
        </View>

        <Pressable onPress={onSignOut} style={styles.signOut}>
          <Icon name="logout" size={f(20)} color={colors.textMuted} />
          <Text style={[styles.signOutText, { fontSize: f(16) }]}>{t(lang, 'sign_out')}</Text>
        </Pressable>
      </ScrollView>

      {/* Always on screen: the emergency button */}
      <View style={styles.sosBar}>
        <Pressable style={({ pressed }) => [styles.sos, pressed && { opacity: 0.85 }]} onPress={askForHelp}>
          <Icon name="alarm-light-outline" size={f(28)} color={colors.onPrimary} />
          <Text style={[styles.sosText, { fontSize: f(22) }]}>{t(lang, 'help_button')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Section({ title, size }: { title: string; size: number }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.section, { fontSize: size }]}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingTop: spacing.xl + spacing.lg, paddingBottom: spacing.xl },

  greeting: { fontWeight: '700', color: colors.text },
  date: { color: colors.textMuted, marginTop: 2 },

  settings: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingGroup: { flex: 1 },
  settingLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 6 },
  segment: { flexDirection: 'row', backgroundColor: colors.background, borderRadius: radius.md, padding: 3 },
  seg: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 7, borderRadius: radius.md - 3 },
  segOn: { backgroundColor: colors.primary },
  segText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  segTextOn: { color: colors.onPrimary },

  error: { color: colors.danger, marginTop: spacing.md },

  sectionRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.md },
  section: { fontWeight: '700', color: colors.text },
  sectionLine: { flex: 1, height: 1, backgroundColor: colors.border, marginLeft: spacing.md },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontWeight: '700', color: colors.text, flexShrink: 1 },
  muted: { color: colors.textMuted, marginTop: 2 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },

  hero: { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 6 },
  badge: { alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  heroText: { flex: 1, fontWeight: '700', color: colors.text },

  moods: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  mood: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
  },
  moodLabel: { color: colors.text, fontWeight: '600', marginTop: 4 },
  answerRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  answerTitle: { fontWeight: '700', color: colors.text },
  linkBtn: { alignSelf: 'flex-start', marginTop: spacing.md, paddingVertical: 4 },
  link: { color: colors.primary, fontWeight: '700' },

  medRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  medName: { fontWeight: '700', color: colors.text },
  medState: { fontWeight: '600', marginTop: 2 },
  tookBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    marginLeft: spacing.sm,
  },
  tookText: { color: colors.onPrimary, fontWeight: '700' },

  msgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 20,
  },
  msgText: { color: colors.onPrimary, fontWeight: '700' },

  personRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  avatar: {
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: { color: colors.primary, fontWeight: '700' },
  personName: { fontWeight: '600', color: colors.text },

  whyTitle: { flex: 1, fontWeight: '600', color: colors.text, marginLeft: spacing.sm, marginRight: spacing.sm },

  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  signOutText: { color: colors.textMuted, fontWeight: '600' },

  sosBar: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sos: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.danger,
    borderRadius: radius.lg,
    paddingVertical: 20,
  },
  sosText: { color: colors.onPrimary, fontWeight: '800', letterSpacing: 0.5 },
});

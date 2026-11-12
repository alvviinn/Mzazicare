import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { resolveAlert } from '../../api/client';
import { Icon, IconName, MOOD_ICON, TONE_ICON } from '../../components/Icon';
import { ProofPhoto } from '../../components/ProofPhoto';
import { ShiftRow } from '../../components/ShiftRow';
import { TaskHistory } from '../../components/TaskHistory';
import {
  Avatar,
  Button,
  Card,
  ErrorState,
  haptic,
  Loading,
  PressScale,
  Ring,
  Row,
  Section,
  Segmented,
  Sheet,
  StatusPill,
  Stepper,
  Stripe,
} from '../../components/ui';
import { fmtDuration, fmtTime, timeAgo } from '../../format';
import { colors, fonts, iconSize, radius, spacing, TAP, text, toneColors, type } from '../../theme';
import { AlertItem, Dashboard, Profile } from '../../types';

type Props = {
  token: string;
  profile: Profile;
  dash: Dashboard | null;
  error: string;
  onChanged: () => void;
  onGoPeople: () => void;
  onGoShifts: () => void;
  onGoTone: () => void;
  onOpenShift: (id: number) => void;
};

type SheetKind = 'meds' | 'mood' | 'chores' | 'past' | null;

export default function Overview({ token, profile, dash, error, onChanged, onGoPeople, onGoShifts, onGoTone, onOpenShift }: Props) {
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [choreView, setChoreView] = useState<'today' | 'history'>('today');

  if (!dash) {
    return error ? <ErrorState message={`Couldn't load the overview. ${error}`} onRetry={onChanged} /> : <Loading label="Loading your care overview" />;
  }
  const openAlerts = dash.alerts.filter((a) => a.status === 'open');
  const pastAlerts = dash.alerts.filter((a) => a.status !== 'open');
  const alertCards = openAlerts.map((a) => <AlertCard key={a.id} alert={a} token={token} onChanged={onChanged} />);

  // An emergency can arrive before a caretaker is linked, so alerts show here too.
  if (!dash.matched) {
    return (
      <>
        {alertCards}
        <Onboarding profile={profile} onGoPeople={onGoPeople} />
      </>
    );
  }

  const chores = dash.today.chores;
  const doneChores = chores.filter((c) => c.is_done).length;
  const meds = dash.medicines;
  const mood = dash.wellbeing[0];
  const tone = dash.tones.dominant ? dash.tones.items[0] : null;
  const close = () => setSheet(null);

  return (
    <>
      {dash.demo && (
        <View style={{ marginBottom: spacing.ms }}>
          <StatusPill label="Sample data" tone="butter" />
        </View>
      )}

      {alertCards}

      <TodayCard dash={dash} onOpenShift={onOpenShift} />

      {/* Bento: two rows, the wide tile swaps sides so the grid never reads as identical boxes. */}
      <View style={styles.bento}>
        <PressScale
          onPress={() => setSheet('meds')}
          style={[styles.tile, styles.tileWide, { backgroundColor: colors.primarySoft }]}
          accessibilityRole="button"
          accessibilityLabel={meds.total ? `Medicines: ${meds.taken} of ${meds.total} taken` : 'Medicines: none set'}
        >
          <Ring value={meds.taken} total={meds.total} size={64} stroke={8} color={colors.primary} track={colors.surface}>
            <Icon name="pill" size={22} color={colors.primaryInk} />
          </Ring>
          <View style={{ flex: 1 }}>
            <Text style={styles.tileNum}>{meds.total ? `${meds.taken}/${meds.total}` : '–'}</Text>
            <Text style={[text.small, { color: colors.primaryInk }]}>Medicines</Text>
          </View>
        </PressScale>
        <PressScale
          onPress={() => setSheet('mood')}
          style={[styles.tile, { backgroundColor: colors.butter }]}
          accessibilityRole="button"
          accessibilityLabel={mood?.mood ? `${mood.name} feels ${mood.label}` : 'Mood: no check-in yet'}
        >
          <Icon name={mood?.mood ? MOOD_ICON[mood.mood] : 'emoticon-outline'} size={iconSize.hero} color={mood?.mood === 'unwell' ? colors.danger : colors.butterInk} />
          <View>
            <Text style={text.bodyStrong} numberOfLines={1}>
              {mood?.mood ? mood.label : 'No check-in'}
            </Text>
            <Text style={[text.small, { color: colors.butterInk }]}>Mood</Text>
          </View>
        </PressScale>
      </View>
      <View style={styles.bento}>
        <PressScale
          onPress={onGoTone}
          style={[styles.tile, { backgroundColor: colors.surface }]}
          accessibilityRole="button"
          accessibilityLabel={tone ? `Voice tone: mostly ${tone.label}, ${tone.percent}%` : 'Voice tone: nothing heard yet'}
        >
          <Icon name={tone ? TONE_ICON[tone.tone] : 'waveform'} size={iconSize.hero} color={tone ? toneColors[tone.tone] : colors.textMuted} />
          <View>
            <Text style={text.bodyStrong} numberOfLines={1}>
              {tone ? tone.label : 'Quiet'}
            </Text>
            <Text style={text.small}>Tone · week</Text>
          </View>
        </PressScale>
        <PressScale
          onPress={() => setSheet('chores')}
          style={[styles.tile, styles.tileWide, { backgroundColor: colors.sageSoft }]}
          accessibilityRole="button"
          accessibilityLabel={`Chores today: ${doneChores} of ${chores.length} done`}
        >
          <Ring value={doneChores} total={chores.length} size={64} stroke={8} color={colors.sage} track={colors.surface}>
            <Icon name="broom" size={22} color={colors.sage} />
          </Ring>
          <View style={{ flex: 1 }}>
            <Text style={styles.tileNum}>{chores.length ? `${doneChores}/${chores.length}` : '0'}</Text>
            <Text style={[text.small, { color: colors.sage }]}>Chores</Text>
          </View>
        </PressScale>
      </View>

      <Section title="This week" />
      <Card>
        <View style={styles.week}>
          <Stat value={fmtDuration(dash.stats.avg_visit_minutes)} label="Avg / day" />
          <View style={styles.weekLine} />
          <Stat value={String(dash.stats.visits_7d)} label="Days" />
          <View style={styles.weekLine} />
          <Stat value={dash.stats.chore_rate_7d === null ? '–' : `${dash.stats.chore_rate_7d}%`} label="Chores" />
        </View>
      </Card>

      <Section title="Recent shifts" action="See all" onAction={onGoShifts} />
      <Card padded={false} style={{ paddingHorizontal: spacing.md }}>
        {dash.recent_shifts.length === 0 ? (
          <Row first leading={<Icon name="calendar-blank-outline" size={iconSize.inline} color={colors.textMuted} />} title="No shifts this week" />
        ) : (
          dash.recent_shifts
            .slice(0, 3)
            .map((s, i) => <ShiftRow key={s.id} shift={s} showCaretaker first={i === 0} onPress={() => onOpenShift(s.id)} />)
        )}
      </Card>

      {pastAlerts.length > 0 && (
        <Pressable
          onPress={() => setSheet('past')}
          style={styles.pastLink}
          accessibilityRole="button"
          accessibilityLabel={`Past alerts, ${pastAlerts.length}`}
        >
          <Icon name="bell-check-outline" size={iconSize.inline} color={colors.textMuted} />
          <Text style={[text.smallStrong, { flex: 1 }]}>Past alerts · {pastAlerts.length}</Text>
          <Icon name="chevron-right" size={iconSize.inline} color={colors.textMuted} />
        </Pressable>
      )}

      {/* ---- sheets ---- */}

      <Sheet visible={sheet === 'meds'} onClose={close} title="Medicines">
        {meds.total === 0 ? (
          <Empty2 icon="pill" title="No reminders yet" action="Add in People" onAction={() => (close(), onGoPeople())} />
        ) : (
          meds.items.map((m, i) => {
            const v = MED_STATE[m.state];
            return (
              <Row
                key={m.id}
                first={i === 0}
                leading={<Icon name={v.icon} size={26} color={v.color} />}
                title={m.dose ? `${m.name} · ${m.dose}` : m.name}
                subtitle={`${m.elderly.split(' ')[0]} · ${m.time}`}
                trailing={<StatusPill label={m.state === 'taken' && m.taken_at ? fmtTime(m.taken_at) : v.label} tone={v.tone} />}
              />
            );
          })
        )}
      </Sheet>

      <Sheet visible={sheet === 'mood'} onClose={close} title="How they feel">
        {dash.wellbeing.map((w, i) => (
          <Row
            key={w.name}
            first={i === 0}
            leading={
              <Icon
                name={w.mood ? MOOD_ICON[w.mood] : 'help-circle-outline'}
                size={40}
                color={w.mood === 'unwell' ? colors.danger : w.mood ? colors.sage : colors.textMuted}
              />
            }
            title={w.name}
            subtitle={w.mood ? `${w.label} · ${fmtTime(w.at!)}` : 'No check-in today'}
          />
        ))}
      </Sheet>

      <Sheet visible={sheet === 'chores'} onClose={close} title="Chores">
        <Segmented
          options={[
            { key: 'today', label: 'Today' },
            { key: 'history', label: 'History' },
          ]}
          value={choreView}
          onChange={setChoreView}
        />
        {choreView === 'history' ? (
          <TaskHistory token={token} showCaretaker />
        ) : chores.length === 0 ? (
          <Empty2 icon="broom" title="Nothing yet today" />
        ) : (
          chores.map((c, i) => (
            <Row
              key={c.id}
              first={i === 0}
              leading={<Icon name={c.is_done ? 'check-circle' : 'circle-outline'} size={26} color={c.is_done ? colors.sage : colors.borderStrong} />}
              title={c.description}
              strike={false}
              subtitle={[c.done_at ? fmtTime(c.done_at) : null, c.assigned_by_me ? 'by you' : c.assigned_by ? `by ${c.assigned_by.split(' ')[0]}` : null]
                .filter(Boolean)
                .join(' · ')}
              trailing={
                c.completion_id !== null ? (
                  <ProofPhoto token={token} completionId={c.completion_id} caption={`${c.description} · ${c.caretaker}`} size={48} />
                ) : undefined
              }
            />
          ))
        )}
      </Sheet>

      <Sheet visible={sheet === 'past'} onClose={close} title="Past alerts">
        {pastAlerts.map((a, i) => (
          <Row
            key={a.id}
            first={i === 0}
            leading={<Icon name={a.status === 'confirmed' ? 'check-decagram-outline' : 'close-circle-outline'} size={24} color={colors.textMuted} />}
            title={a.label}
            subtitle={`${a.status === 'confirmed' ? 'Confirmed' : 'Dismissed'} · ${timeAgo(a.created_at)}`}
          />
        ))}
      </Sheet>
    </>
  );
}

const MED_STATE: Record<Dashboard['medicines']['items'][number]['state'], { icon: IconName; color: string; label: string; tone: 'sage' | 'butter' | 'danger' | 'quiet' }> = {
  taken: { icon: 'check-circle', color: colors.sage, label: 'Taken', tone: 'sage' },
  due: { icon: 'clock-alert-outline', color: colors.butterInk, label: 'Due now', tone: 'butter' },
  missed: { icon: 'alert-circle-outline', color: colors.danger, label: 'Not taken', tone: 'danger' },
  later: { icon: 'clock-outline', color: colors.textMuted, label: 'Later', tone: 'quiet' },
};

function Empty2({ icon, title, action, onAction }: { icon: IconName; title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.empty2}>
      <Icon name={icon} size={iconSize.hero} color={colors.textMuted} />
      <Text style={text.h2}>{title}</Text>
      {action && onAction && <Button title={action} variant="secondary" size="md" onPress={onAction} />}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={text.caption}>{label}</Text>
    </View>
  );
}

// Shown before the family has linked both a caretaker and an elderly person.
function Onboarding({ profile, onGoPeople }: { profile: Profile; onGoPeople: () => void }) {
  const step = (title: string, icon: IconName, list: Profile['caretakers']) => {
    const active = list.some((m) => m.status === 'active');
    const invited = list.some((m) => m.status === 'pending');
    return { title, icon, state: active ? 'Linked' : invited ? 'Invited' : 'Not yet', done: active, invited };
  };
  const steps = [step('Caretaker', 'account-heart-outline', profile.caretakers), step('Elder', 'human-cane', profile.elderly)];

  return (
    <Card tint="peach" raised>
      <Text style={text.h1}>Set up your circle</Text>
      <Text style={[text.small, { marginTop: 2 }]}>Two people, then this fills up.</Text>
      <View style={styles.setup}>
        {steps.map((s) => (
          <View key={s.title} style={styles.setupStep}>
            <View style={[styles.setupIcon, s.done && { backgroundColor: colors.sage }]}>
              <Icon name={s.done ? 'check-bold' : s.icon} size={iconSize.large} color={s.done ? colors.onPrimary : colors.primaryInk} />
            </View>
            <Text style={text.bodyStrong}>{s.title}</Text>
            <StatusPill label={s.state} tone={s.done ? 'sage' : s.invited ? 'butter' : 'quiet'} />
          </View>
        ))}
      </View>
      <Button title="Add people" icon="account-plus-outline" onPress={onGoPeople} />
      <Stripe height={4} style={{ marginTop: spacing.lg, width: 96, alignSelf: 'center' }} />
    </Card>
  );
}

// The live tracker: who is with your loved one, for how long, and where in the day they are.
function TodayCard({ dash, onOpenShift }: { dash: Dashboard; onOpenShift: (id: number) => void }) {
  const { status, shifts } = dash.today;
  const s = shifts[0];
  const live = status === 'on_shift';
  const paused = status === 'paused' || status === 'away';
  const label = {
    on_shift: 'On shift',
    paused: 'On a break',
    away: 'Away',
    waiting: 'Not arrived',
    completed: 'Finished',
    none: 'No shift yet',
  }[status];
  const step = status === 'none' || status === 'waiting' ? 0 : status === 'completed' ? 2 : 1;
  const since = s
    ? status === 'completed'
      ? `${fmtTime(s.start)} – ${s.end ? fmtTime(s.end) : ''}`
      : paused && s.left
        ? `out since ${fmtTime(s.left)}`
        : s.arrived
          ? `since ${fmtTime(s.arrived)}`
          : ''
    : '';

  const body = (
    <Card tint={live ? 'sage' : paused ? 'butter' : 'surface'} raised style={{ marginBottom: spacing.ms }}>
      <View style={styles.todayTop}>
        {s ? <Avatar name={s.caretaker} size={48} ring={colors.surface} /> : <Avatar name="?" size={48} />}
        <View style={{ flex: 1 }}>
          <Text style={text.h2} numberOfLines={1}>
            {s ? s.caretaker.split(' ')[0] : 'Today'}
          </Text>
          <Text style={text.small} numberOfLines={1}>
            {s ? `with ${s.elderly.split(' ')[0]}${since ? ` · ${since}` : ''}` : 'Nobody has arrived'}
          </Text>
        </View>
        <StatusPill label={label} tone={live ? 'sage' : paused ? 'butter' : 'quiet'} live={live} />
      </View>
      {s && (
        <View style={{ marginTop: spacing.md }}>
          <Text style={text.number}>{fmtDuration(s.minutes)}</Text>
          <Text style={text.small}>{['active today', s.breaks ? `${s.breaks} break${s.breaks === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ')}</Text>
        </View>
      )}
      <View style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
        <Stepper steps={['Arrive', 'On shift', 'Done']} current={step} color={paused ? colors.butterInk : colors.sage} />
      </View>
    </Card>
  );
  return s ? (
    <PressScale
      onPress={() => onOpenShift(s.id)}
      scaleTo={0.985}
      accessibilityRole="button"
      accessibilityLabel={`${s.caretaker}: ${label}. Active ${fmtDuration(s.minutes)}`}
      accessibilityHint="Opens today's timeline"
    >
      {body}
    </PressScale>
  ) : (
    body
  );
}

const SEVERITY: Record<number, { text: string; tone: 'danger' | 'butter' | 'quiet' }> = {
  3: { text: 'Emergency', tone: 'danger' },
  2: { text: 'High', tone: 'butter' },
  1: { text: 'Check', tone: 'quiet' },
};

function AlertCard({ alert, token, onChanged }: { alert: AlertItem; token: string; onChanged: () => void }) {
  const [busy, setBusy] = useState<'confirmed' | 'dismissed' | null>(null);
  const [error, setError] = useState('');
  async function act(status: 'confirmed' | 'dismissed') {
    setBusy(status);
    setError('');
    try {
      await resolveAlert(token, alert.id, status);
      haptic.success();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the alert. Try again.');
    } finally {
      setBusy(null);
    }
  }
  const sos = alert.kind === 'sos';
  const sev = SEVERITY[alert.severity] ?? SEVERITY[1];
  const yes = sos ? 'Handled' : alert.kind === 'unwell' ? 'Noted' : 'Confirm';
  const no = sos ? 'False alarm' : 'Dismiss';
  const pos = alert.position;
  return (
    <Card tint="danger" raised={sos} style={[{ marginBottom: spacing.ms }, sos && styles.sos]}>
      <View accessibilityRole={sos ? 'alert' : undefined}>
        <View style={styles.alertHead}>
          <StatusPill label={sev.text} tone={sev.tone} live={sos} />
          <Text style={[text.small, { marginLeft: 'auto' }]}>{timeAgo(alert.created_at)}</Text>
        </View>
        <Text style={[text.h2, { marginTop: spacing.sm }]}>{alert.label}</Text>
        <Text style={text.body}>{alert.message}</Text>
        {!!alert.patient && <Text style={text.small}>{alert.patient}</Text>}
      </View>

      {/* The evidence, before the decision. */}
      {(pos || alert.confidence !== null) && (
        <View style={styles.evidence}>
          {pos && (
            <Pressable
              onPress={() => Linking.openURL(`geo:${pos.latitude},${pos.longitude}?q=${pos.latitude},${pos.longitude}`)}
              style={styles.evChip}
              accessibilityRole="link"
              accessibilityLabel={`Open the position in Maps. GPS accuracy ${pos.accuracy !== null ? `${Math.round(pos.accuracy)} metres` : 'unknown'}`}
            >
              <Icon name="map-marker-outline" size={18} color={colors.primaryInk} />
              <Text style={styles.evText}>Map{pos.accuracy !== null ? ` · ±${Math.round(pos.accuracy)} m` : ''}</Text>
            </Pressable>
          )}
          {alert.confidence !== null && (
            <View style={styles.evChip} accessible accessibilityLabel={`Voice model: ${Math.round(alert.confidence * 100)}% of the speech sounded angry`}>
              <Icon name="waveform" size={18} color={colors.textMuted} />
              <Text style={[styles.evText, { color: colors.text }]}>{Math.round(alert.confidence * 100)}% angry</Text>
            </View>
          )}
        </View>
      )}

      {!!error && <Text style={[text.small, { color: colors.danger, marginTop: spacing.sm }]}>{error}</Text>}
      <View style={styles.alertActions}>
        <View style={{ flex: 1 }}>
          <Button title={yes} variant={sos ? 'danger' : 'ink'} size="md" onPress={() => act('confirmed')} loading={busy === 'confirmed'} disabled={busy !== null} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title={no} variant="quiet" size="md" onPress={() => act('dismissed')} loading={busy === 'dismissed'} disabled={busy !== null} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  bento: { flexDirection: 'row', gap: spacing.ms, marginBottom: spacing.ms },
  tile: { flex: 1, borderRadius: radius.lg, padding: spacing.md, minHeight: 124, justifyContent: 'space-between' },
  tileWide: { flex: 1.5, flexDirection: 'row', alignItems: 'center', gap: spacing.ms, justifyContent: 'flex-start' },
  tileNum: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, color: colors.text },
  week: { flexDirection: 'row', alignItems: 'center' },
  weekLine: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.border },
  statValue: { fontFamily: fonts.display, fontSize: type.h2, color: colors.text },
  pastLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: TAP, marginTop: spacing.md, paddingHorizontal: spacing.xs },
  empty2: { alignItems: 'center', gap: spacing.ms, paddingVertical: spacing.lg },

  setup: { flexDirection: 'row', gap: spacing.ms, marginVertical: spacing.lg },
  setupStep: { flex: 1, alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md },
  setupIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },

  todayTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms },

  sos: { borderWidth: 2, borderColor: colors.danger },
  alertHead: { flexDirection: 'row', alignItems: 'center' },
  evidence: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.ms },
  evChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.ms,
    minHeight: 40,
  },
  evText: { fontFamily: fonts.bodyBold, fontSize: type.small, color: colors.primaryInk },
  alertActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});

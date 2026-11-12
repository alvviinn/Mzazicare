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
  PillTone,
  PressScale,
  Ring,
  Row,
  Section,
  Segmented,
  Sheet,
  StatusPill,
  Stepper,
} from '../../components/ui';
import { fmtDuration, fmtTime, timeAgo } from '../../format';
import { colors, icon, on, radius, space, TAP, text } from '../../theme';
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
  onChat: (p: { name: string; email: string }) => void;
};

type SheetKind = 'meds' | 'mood' | 'chores' | 'past' | null;

export default function Overview({ token, profile, dash, error, onChanged, onGoPeople, onGoShifts, onGoTone, onOpenShift, onChat }: Props) {
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
        <View style={{ marginBottom: space.s }}>
          <StatusPill label="Sample data" tone="secondary" />
        </View>
      )}

      {alertCards}

      <TodayCard dash={dash} onOpenShift={onOpenShift} onChat={onChat} />

      {/* Two rows of tiles; the wide tile swaps sides and the tints alternate, so it never reads as a grid of equals. */}
      <View style={styles.bento}>
        <PressScale
          onPress={() => setSheet('meds')}
          style={[styles.tile, styles.tileWide, { backgroundColor: colors.primaryTint }]}
          accessibilityRole="button"
          accessibilityLabel={meds.total ? `Medicines: ${meds.taken} of ${meds.total} taken` : 'Medicines: none set'}
        >
          <Ring value={meds.taken} total={meds.total} size={64}>
            <Icon name="pill" />
          </Ring>
          <View style={styles.flex}>
            <Text style={text.display}>{meds.total ? `${meds.taken}/${meds.total}` : '–'}</Text>
            <Text style={text.caption}>Medicines</Text>
          </View>
        </PressScale>
        <PressScale
          onPress={() => setSheet('mood')}
          style={[styles.tile, { backgroundColor: colors.secondaryTint }]}
          accessibilityRole="button"
          accessibilityLabel={mood?.mood ? `${mood.name} feels ${mood.label}` : 'Mood: no check-in yet'}
        >
          <Icon name={mood?.mood ? MOOD_ICON[mood.mood] : 'neutral'} size={icon.l} color={mood?.mood === 'unwell' ? colors.error : colors.ink} />
          <View>
            <Text style={text.bodyStrong} numberOfLines={1}>
              {mood?.mood ? mood.label : 'No check-in'}
            </Text>
            <Text style={text.caption}>Mood</Text>
          </View>
        </PressScale>
      </View>
      <View style={styles.bento}>
        <PressScale
          onPress={onGoTone}
          style={[styles.tile, { backgroundColor: colors.secondaryTint }]}
          accessibilityRole="button"
          accessibilityLabel={tone ? `Voice tone: mostly ${tone.label}, ${tone.percent}%` : 'Voice tone: nothing heard yet'}
        >
          <Icon name={tone ? TONE_ICON[tone.tone] : 'waveform'} size={icon.l} />
          <View>
            <Text style={text.bodyStrong} numberOfLines={1}>
              {tone ? tone.label : 'Quiet'}
            </Text>
            <Text style={text.caption}>Tone · week</Text>
          </View>
        </PressScale>
        <PressScale
          onPress={() => setSheet('chores')}
          style={[styles.tile, styles.tileWide, { backgroundColor: colors.primaryTint }]}
          accessibilityRole="button"
          accessibilityLabel={`Tasks today: ${doneChores} of ${chores.length} done`}
        >
          <Ring value={doneChores} total={chores.length} size={64}>
            <Icon name="chores" />
          </Ring>
          <View style={styles.flex}>
            <Text style={text.display}>{chores.length ? `${doneChores}/${chores.length}` : '0'}</Text>
            <Text style={text.caption}>Tasks</Text>
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
          <Stat value={dash.stats.chore_rate_7d === null ? '–' : `${dash.stats.chore_rate_7d}%`} label="Tasks" />
        </View>
      </Card>

      <Section title="Recent shifts" action="See all" onAction={onGoShifts} />
      <Card padded={false} style={styles.list}>
        {dash.recent_shifts.length === 0 ? (
          <Row first leading={<Icon name="calendar" color={colors.inkMuted} />} title="No shifts this week" />
        ) : (
          dash.recent_shifts.slice(0, 3).map((s, i) => <ShiftRow key={s.id} shift={s} showCaretaker first={i === 0} onPress={() => onOpenShift(s.id)} />)
        )}
      </Card>

      {pastAlerts.length > 0 && (
        <Pressable onPress={() => setSheet('past')} style={styles.pastLink} accessibilityRole="button" accessibilityLabel={`Past alerts, ${pastAlerts.length}`}>
          <Icon name="bellCheck" color={colors.inkMuted} />
          <Text style={[text.captionStrong, styles.flex]}>Past alerts · {pastAlerts.length}</Text>
          <Icon name="chevron" color={colors.inkMuted} />
        </Pressable>
      )}

      {/* ---- sheets ---- */}

      <Sheet visible={sheet === 'meds'} onClose={close} title="Medicines">
        {meds.total === 0 ? (
          <SheetEmpty icon="pill" title="No reminders yet" action="Add in People" onAction={() => (close(), onGoPeople())} />
        ) : (
          meds.items.map((m, i) => {
            const v = MED_STATE[m.state];
            return (
              <Row
                key={m.id}
                first={i === 0}
                leading={<Icon name={v.icon} size={icon.m} color={v.color} />}
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
            leading={<Icon name={w.mood ? MOOD_ICON[w.mood] : 'neutral'} size={icon.l} color={w.mood === 'unwell' ? colors.error : w.mood ? colors.ink : colors.inkMuted} />}
            title={w.name}
            subtitle={w.mood ? `${w.label} · ${fmtTime(w.at!)}` : 'No check-in today'}
          />
        ))}
      </Sheet>

      <Sheet visible={sheet === 'chores'} onClose={close} title="Tasks today">
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
          <SheetEmpty icon="chores" title="Nothing yet today" />
        ) : (
          chores.map((c, i) => (
            <Row
              key={c.id}
              first={i === 0}
              leading={<Icon name={c.is_done ? 'checkCircle' : 'circle'} size={icon.m} color={c.is_done ? colors.success : colors.inkMuted} />}
              title={c.description}
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
            leading={<Icon name={a.status === 'confirmed' ? 'verified' : 'circleX'} color={colors.inkMuted} />}
            title={a.label}
            subtitle={`${a.status === 'confirmed' ? 'Confirmed' : 'Dismissed'} · ${timeAgo(a.created_at)}`}
          />
        ))}
      </Sheet>
    </>
  );
}

const MED_STATE: Record<Dashboard['medicines']['items'][number]['state'], { icon: IconName; color: string; label: string; tone: PillTone }> = {
  taken: { icon: 'checkCircle', color: colors.success, label: 'Taken', tone: 'success' },
  due: { icon: 'clockAlert', color: colors.ink, label: 'Due now', tone: 'ink' },
  missed: { icon: 'alert', color: colors.error, label: 'Not taken', tone: 'error' },
  later: { icon: 'clock', color: colors.inkMuted, label: 'Later', tone: 'muted' },
};

function SheetEmpty({ icon: glyph, title, action, onAction }: { icon: IconName; title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sheetEmpty}>
      <Icon name={glyph} size={icon.l} color={colors.inkMuted} />
      <Text style={text.heading}>{title}</Text>
      {action && onAction && <Button title={action} variant="secondary" onPress={onAction} />}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={text.heading} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={text.caption}>{label}</Text>
    </View>
  );
}

// Shown before the family has linked both a caretaker and an elderly person.
function Onboarding({ profile, onGoPeople }: { profile: Profile; onGoPeople: () => void }) {
  const step = (title: string, glyph: IconName, list: Profile['caretakers']) => {
    const active = list.some((m) => m.status === 'active');
    const invited = list.some((m) => m.status === 'pending');
    return { title, glyph, state: active ? 'Linked' : invited ? 'Invited' : 'Not yet', done: active, invited };
  };
  const steps = [step('Caretaker', 'carer', profile.caretakers), step('Elder', 'elder', profile.elderly)];

  return (
    <Card tint="primary">
      <Text style={text.display}>Set up your circle</Text>
      <Text style={text.caption}>Two people, then this fills up.</Text>
      <View style={styles.setup}>
        {steps.map((s) => (
          <View key={s.title} style={styles.setupStep}>
            <View style={[styles.setupIcon, s.done && { backgroundColor: colors.success }]}>
              <Icon name={s.done ? 'check' : s.glyph} size={icon.m} color={s.done ? on.success : colors.ink} />
            </View>
            <Text style={text.bodyStrong}>{s.title}</Text>
            <StatusPill label={s.state} tone={s.done ? 'success' : s.invited ? 'secondary' : 'muted'} />
          </View>
        ))}
      </View>
      <Button title="Add people" icon="personAdd" onPress={onGoPeople} />
    </Card>
  );
}

// The live tracker: who is with your loved one, for how long, where in the day they are, and the way to reach them.
function TodayCard({
  dash,
  onOpenShift,
  onChat,
}: {
  dash: Dashboard;
  onOpenShift: (id: number) => void;
  onChat: (p: { name: string; email: string }) => void;
}) {
  const { status, shifts } = dash.today;
  const s = shifts[0];
  const live = status === 'on_shift';
  const paused = status === 'paused' || status === 'away';
  const label = { on_shift: 'On shift', paused: 'On a break', away: 'Away', waiting: 'Not arrived', completed: 'Finished', none: 'No shift yet' }[status];
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
  const carer = s ? dash.caretakers.find((c) => c.name === s.caretaker) ?? dash.caretakers[0] : dash.caretakers[0];

  return (
    <Card tint="primary" style={{ marginBottom: space.s }}>
      <View style={styles.todayTop}>
        <Avatar name={s ? s.caretaker : carer?.name ?? '?'} size={48} solid />
        <View style={styles.flex}>
          <Text style={text.heading} numberOfLines={1}>
            {s ? s.caretaker.split(' ')[0] : 'Today'}
          </Text>
          <Text style={text.caption} numberOfLines={1}>
            {s ? `with ${s.elderly.split(' ')[0]}${since ? ` · ${since}` : ''}` : 'Nobody has arrived'}
          </Text>
        </View>
        <StatusPill label={label} tone={live ? 'success' : paused ? 'ink' : 'muted'} />
      </View>
      {s && (
        <View style={{ marginTop: space.m }} accessible accessibilityLabel={`Active ${fmtDuration(s.minutes)} today`}>
          <Text style={text.display}>{fmtDuration(s.minutes)}</Text>
          <Text style={text.caption}>{['active today', s.breaks ? `${s.breaks} break${s.breaks === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ')}</Text>
        </View>
      )}
      <View style={{ marginTop: space.l }}>
        <Stepper steps={['Arrive', 'On shift', 'Done']} current={step} />
      </View>
      {s && (
        <Pressable
          onPress={() => onOpenShift(s.id)}
          style={styles.timeline}
          accessibilityRole="button"
          accessibilityLabel="Today's timeline"
        >
          <Icon name="clock" color={colors.secondary} />
          <Text style={[text.captionStrong, styles.flex, { color: colors.secondary }]}>Timeline</Text>
          <Icon name="chevron" color={colors.secondary} />
        </Pressable>
      )}
      {carer && (
        <View style={{ marginTop: space.s }}>
          <Button title={`Message ${carer.name.split(' ')[0]}`} icon="chat" onPress={() => onChat({ name: carer.name, email: carer.email })} />
        </View>
      )}
    </Card>
  );
}

const SEVERITY: Record<number, { text: string; tone: PillTone }> = {
  3: { text: 'Emergency', tone: 'error' },
  2: { text: 'High', tone: 'ink' },
  1: { text: 'Check', tone: 'muted' },
};

// Attention = marigold tint with ink text and an icon. The evidence comes before the decision.
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
    <Card tint="primary" style={{ marginBottom: space.s }}>
      <View accessibilityRole={sos ? 'alert' : undefined}>
        <View style={styles.alertHead}>
          <Icon name={sos ? 'siren' : 'bellRing'} color={sos ? colors.error : colors.ink} />
          <StatusPill label={sev.text} tone={sev.tone} />
          <Text style={[text.caption, { marginLeft: 'auto' }]}>{timeAgo(alert.created_at)}</Text>
        </View>
        <Text style={[text.heading, { marginTop: space.s }]}>{alert.label}</Text>
        <Text style={text.body}>{alert.message}</Text>
        {!!alert.patient && <Text style={text.caption}>{alert.patient}</Text>}
      </View>

      {(pos || alert.confidence !== null) && (
        <View style={styles.evidence}>
          {pos && (
            <Pressable
              onPress={() => Linking.openURL(`geo:${pos.latitude},${pos.longitude}?q=${pos.latitude},${pos.longitude}`)}
              style={styles.evChip}
              accessibilityRole="link"
              accessibilityLabel={`Open the position in Maps. GPS accuracy ${pos.accuracy !== null ? `${Math.round(pos.accuracy)} metres` : 'unknown'}`}
            >
              <Icon name="pin" color={colors.secondary} />
              <Text style={[text.captionStrong, { color: colors.secondary }]}>Map{pos.accuracy !== null ? ` · ±${Math.round(pos.accuracy)} m` : ''}</Text>
            </Pressable>
          )}
          {alert.confidence !== null && (
            <View style={styles.evChip} accessible accessibilityLabel={`Voice model: ${Math.round(alert.confidence * 100)}% of the speech sounded angry`}>
              <Icon name="waveform" />
              <Text style={text.captionStrong}>{Math.round(alert.confidence * 100)}% angry</Text>
            </View>
          )}
        </View>
      )}

      {!!error && <Text style={[text.caption, { color: colors.error, marginTop: space.s }]}>{error}</Text>}
      <View style={styles.alertActions}>
        <View style={styles.flex}>
          <Button title={yes} variant={sos ? 'danger' : 'secondary'} onPress={() => act('confirmed')} loading={busy === 'confirmed'} disabled={busy !== null} />
        </View>
        <View style={styles.flex}>
          <Button title={no} variant="soft" onPress={() => act('dismissed')} loading={busy === 'dismissed'} disabled={busy !== null} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bento: { flexDirection: 'row', gap: space.s, marginBottom: space.s },
  tile: { flex: 1, borderRadius: radius.card, padding: space.m, minHeight: 128, justifyContent: 'space-between' },
  tileWide: { flex: 1.5, flexDirection: 'row', alignItems: 'center', gap: space.m, justifyContent: 'flex-start' },
  week: { flexDirection: 'row', alignItems: 'center' },
  weekLine: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.line },
  stat: { flex: 1, alignItems: 'center' },
  list: { paddingHorizontal: space.m },
  pastLink: { flexDirection: 'row', alignItems: 'center', gap: space.s, minHeight: TAP, marginTop: space.m, paddingHorizontal: space.s },
  sheetEmpty: { alignItems: 'center', gap: space.m, paddingVertical: space.l, alignSelf: 'stretch' },

  setup: { flexDirection: 'row', gap: space.s, marginVertical: space.l },
  setupStep: { flex: 1, alignItems: 'center', gap: space.s, backgroundColor: colors.surface, borderRadius: radius.small, padding: space.m },
  setupIcon: { width: 56, height: 56, borderRadius: radius.pill, backgroundColor: colors.secondaryTint, alignItems: 'center', justifyContent: 'center' },

  todayTop: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  timeline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    minHeight: TAP,
    marginTop: space.m,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },

  alertHead: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  evidence: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s, marginTop: space.m },
  evChip: { flexDirection: 'row', alignItems: 'center', gap: space.s, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: space.m, minHeight: 40 },
  alertActions: { flexDirection: 'row', gap: space.s, marginTop: space.m },
});

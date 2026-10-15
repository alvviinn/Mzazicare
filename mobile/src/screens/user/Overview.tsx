import { StyleSheet, Text, View } from 'react-native';
import { resolveAlert } from '../../api/client';
import { SectionTitle } from '../../components/HomeShell';
import { Button, Card } from '../../components/ui';
import { fmtDay, fmtDuration, fmtTime, timeAgo } from '../../format';
import { colors, radius, spacing, toneColors } from '../../theme';
import { AlertItem, Dashboard, Profile } from '../../types';

type Props = {
  token: string;
  profile: Profile;
  dash: Dashboard | null;
  error: string;
  onChanged: () => void;
  onGoPeople: () => void;
};

export default function Overview({ token, profile, dash, error, onChanged, onGoPeople }: Props) {
  if (!dash) {
    return <Text style={styles.muted}>{error || 'Loading your care overview…'}</Text>;
  }
  const openAlerts = dash.alerts.filter((a) => a.status === 'open');
  const alertCards = openAlerts.length > 0 && (
    <>
      <SectionTitle>Needs your attention</SectionTitle>
      {openAlerts.map((a) => (
        <AlertCard key={a.id} alert={a} token={token} onChanged={onChanged} />
      ))}
    </>
  );

  // An emergency can arrive before a caretaker is linked, so alerts show here too.
  if (!dash.matched) {
    return (
      <>
        {alertCards}
        <Onboarding profile={profile} onGoPeople={onGoPeople} />
      </>
    );
  }

  const doneChores = dash.today.chores.filter((c) => c.is_done).length;

  return (
    <>
      {dash.demo && (
        <View style={styles.demo}>
          <Text style={styles.demoText}>
            Sample data. Real visits, chores and tones will appear once your caretaker starts shifts in the app.
          </Text>
        </View>
      )}

      {alertCards}

      <TodayCard dash={dash} />

      <View style={styles.tiles}>
        <Tile value={fmtDuration(dash.stats.avg_visit_minutes)} label="Avg. time per visit" />
        <Tile value={String(dash.stats.visits_7d)} label="Visits this week" />
        <Tile value={dash.stats.chore_rate_7d === null ? '–' : `${dash.stats.chore_rate_7d}%`} label="Chores done" />
      </View>

      <SectionTitle>How they are today</SectionTitle>
      <Card>
        {dash.wellbeing.map((w, i) => (
          <View key={w.name} style={[styles.visitRow, i > 0 && styles.rowBorder]}>
            <Text style={styles.bigEmoji}>{w.emoji ?? '❔'}</Text>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.visitTitle}>{w.name}</Text>
              <Text style={styles.small}>
                {w.mood ? `Feeling ${w.label?.toLowerCase()} · checked in ${fmtTime(w.at!)}` : "Hasn't checked in yet today"}
              </Text>
            </View>
          </View>
        ))}
      </Card>

      <SectionTitle>Medicines</SectionTitle>
      <Card>
        {dash.medicines.total === 0 ? (
          <Text style={styles.muted}>No medicine reminders yet. Add some in the People tab.</Text>
        ) : (
          <>
            <Text style={styles.progress}>
              {dash.medicines.taken} of {dash.medicines.total} taken today
            </Text>
            {dash.medicines.items.map((m, i) => (
              <View key={m.id} style={[styles.visitRow, i > 0 && styles.rowBorder]}>
                <Text style={[styles.check, { color: m.taken ? colors.success : colors.border }]}>{m.taken ? '✔' : '○'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.visitTitle}>
                    {m.name}
                    {m.dose ? ` · ${m.dose}` : ''}
                  </Text>
                  <Text style={styles.small}>
                    {m.elderly} · {m.time}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.small,
                    m.state === 'missed' && { color: colors.danger, fontWeight: '700' },
                    m.state === 'due' && { color: colors.warning, fontWeight: '700' },
                  ]}
                >
                  {m.state === 'taken' && m.taken_at ? `Taken ${fmtTime(m.taken_at)}` : m.state === 'missed' ? 'Not taken' : m.state === 'due' ? 'Due now' : 'Later'}
                </Text>
              </View>
            ))}
          </>
        )}
      </Card>

      <SectionTitle>Today's chores</SectionTitle>
      <Card>
        {dash.today.chores.length === 0 ? (
          <Text style={styles.muted}>No chores logged yet today.</Text>
        ) : (
          <>
            <Text style={styles.progress}>
              {doneChores} of {dash.today.chores.length} done
            </Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${(100 * doneChores) / dash.today.chores.length}%` }]} />
            </View>
            {dash.today.chores.map((c, i) => (
              <View key={i} style={styles.choreRow}>
                <Text style={[styles.check, { color: c.is_done ? colors.success : colors.border }]}>
                  {c.is_done ? '✔' : '○'}
                </Text>
                <Text style={[styles.choreText, !c.is_done && { color: colors.textMuted }]}>{c.description}</Text>
                {c.done_at && <Text style={styles.small}>{fmtTime(c.done_at)}</Text>}
              </View>
            ))}
          </>
        )}
      </Card>

      <SectionTitle>Service quality (voice tone)</SectionTitle>
      <ToneCard tones={dash.tones} />

      <SectionTitle>Recent visits</SectionTitle>
      <Card>
        {dash.recent_shifts.length === 0 ? (
          <Text style={styles.muted}>No visits in the last 7 days.</Text>
        ) : (
          dash.recent_shifts.map((s, i) => (
            <View key={s.id} style={[styles.visitRow, i > 0 && styles.rowBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.visitTitle}>
                  {fmtDay(s.start)} · {s.caretaker}
                </Text>
                <Text style={styles.small}>
                  {fmtTime(s.start)} – {s.end ? fmtTime(s.end) : 'ongoing'} · {fmtDuration(s.minutes)} ·{' '}
                  {s.chores_done}/{s.chores_total} chores
                </Text>
              </View>
              {s.dominant_emoji && <Text style={styles.emoji}>{s.dominant_emoji}</Text>}
            </View>
          ))
        )}
      </Card>

      {dash.alerts.some((a) => a.status !== 'open') && (
        <>
          <SectionTitle>Past alerts</SectionTitle>
          <Card>
            {dash.alerts
              .filter((a) => a.status !== 'open')
              .map((a, i) => (
                <View key={a.id} style={[styles.visitRow, i > 0 && styles.rowBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.visitTitle}>{a.label}</Text>
                    <Text style={styles.small}>{a.message}</Text>
                  </View>
                  <Text style={styles.small}>{a.status === 'confirmed' ? 'Confirmed' : 'Dismissed'}</Text>
                </View>
              ))}
          </Card>
        </>
      )}
    </>
  );
}

// Shown before the family has linked both a caretaker and an elderly person.
function Onboarding({ profile, onGoPeople }: { profile: Profile; onGoPeople: () => void }) {
  const step = (title: string, list: Profile['caretakers']) => {
    const active = list.some((m) => m.status === 'active');
    const invited = list.some((m) => m.status === 'pending');
    return { title, state: active ? 'Linked' : invited ? 'Invited, waiting for them to register' : 'Not added yet', done: active };
  };
  const steps = [step('Add a caretaker', profile.caretakers), step('Add an elderly person', profile.elderly)];

  return (
    <>
      <Card>
        <Text style={styles.cardTitle}>Set up your care circle</Text>
        <Text style={styles.muted}>
          Once you've linked a caretaker and the person they care for, this page fills with their care updates.
        </Text>
        {steps.map((s) => (
          <View key={s.title} style={styles.stepRow}>
            <Text style={[styles.check, { color: s.done ? colors.success : colors.border }]}>{s.done ? '✔' : '○'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.visitTitle}>{s.title}</Text>
              <Text style={styles.small}>{s.state}</Text>
            </View>
          </View>
        ))}
        <View style={{ marginTop: spacing.md }}>
          <Button title="Add people" onPress={onGoPeople} />
        </View>
      </Card>

      <SectionTitle>What you'll see here</SectionTitle>
      <Card>
        {[
          ['🕗', 'When your caretaker arrives and leaves, and how long visits last'],
          ['✅', 'Which chores were done each day'],
          ['😊', 'The tone of voice during care, shown as emojis with percentages'],
          ['🔔', 'Alerts you can confirm or dismiss'],
          ['💬', 'Separate private chats with your caretaker and your elderly loved one'],
        ].map(([icon, text]) => (
          <View key={text} style={styles.stepRow}>
            <Text style={styles.emoji}>{icon}</Text>
            <Text style={[styles.choreText, { flex: 1 }]}>{text}</Text>
          </View>
        ))}
      </Card>
    </>
  );
}

function TodayCard({ dash }: { dash: Dashboard }) {
  const { status, shifts } = dash.today;
  const s = shifts[0];
  let headline = 'No visit yet today';
  let detail = 'Nobody has started a shift today.';
  if (status === 'on_shift' && s) {
    headline = `${s.caretaker} is on shift`;
    detail = `Verified with ${s.elderly} since ${fmtTime(s.start)} · ${fmtDuration(s.minutes)} counted so far`;
  } else if (status === 'paused' && s) {
    headline = `${s.caretaker} stepped away`;
    detail = `Not within 15 m of ${s.elderly}. The timer is paused at ${fmtDuration(s.minutes)} and resumes when they return.`;
  } else if (status === 'completed' && s) {
    headline = `${s.caretaker}'s visit is complete`;
    detail = `${fmtTime(s.start)} – ${s.end ? fmtTime(s.end) : ''} · ${fmtDuration(s.minutes)}`;
  }
  const dotColor = status === 'on_shift' ? colors.success : status === 'paused' ? colors.warning : colors.border;
  return (
    <Card>
      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={styles.cardTitle}>{headline}</Text>
      </View>
      <Text style={[styles.muted, { marginTop: spacing.xs }]}>{detail}</Text>
    </Card>
  );
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

const QUALITY: Record<string, { text: string; color: string; bg: string }> = {
  good: { text: 'Good', color: colors.success, bg: colors.primarySoft },
  fair: { text: 'Fair', color: colors.warning, bg: colors.warningSoft },
  needs_attention: { text: 'Needs attention', color: colors.danger, bg: colors.dangerSoft },
};

function ToneCard({ tones }: { tones: Dashboard['tones'] }) {
  if (!tones.items.length || !tones.dominant) {
    return (
      <Card>
        <Text style={styles.muted}>Tone results appear after a caretaker's first shift with voice monitoring.</Text>
      </Card>
    );
  }
  const top = tones.items[0];
  const q = tones.quality ? QUALITY[tones.quality] : null;
  return (
    <Card>
      <View style={styles.statusRow}>
        <Text style={styles.bigEmoji}>{top.emoji}</Text>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={styles.cardTitle}>Mostly {top.label.toLowerCase()}</Text>
          <Text style={styles.small}>Dominant tone this week · {top.percent}%</Text>
        </View>
        {q && (
          <View style={[styles.pill, { backgroundColor: q.bg }]}>
            <Text style={[styles.pillText, { color: q.color }]}>{q.text}</Text>
          </View>
        )}
      </View>
      <View style={{ marginTop: spacing.md }}>
        {tones.items.map((t) => (
          <View key={t.tone} style={styles.toneRow}>
            <Text style={styles.toneEmoji}>{t.emoji}</Text>
            <Text style={styles.toneLabel}>{t.label}</Text>
            <View style={styles.toneTrack}>
              <View style={[styles.fill, { width: `${t.percent}%`, backgroundColor: toneColors[t.tone] }]} />
            </View>
            <Text style={styles.tonePct}>{t.percent}%</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function AlertCard({ alert, token, onChanged }: { alert: AlertItem; token: string; onChanged: () => void }) {
  async function act(status: 'confirmed' | 'dismissed') {
    await resolveAlert(token, alert.id, status);
    onChanged();
  }
  const sos = alert.kind === 'sos';
  const yes = sos ? 'Handled' : alert.kind === 'unwell' ? 'Noted' : 'Confirm';
  const no = sos ? 'False alarm' : 'Dismiss';
  return (
    <View style={[styles.alert, sos && styles.sosAlert]}>
      <Text style={[styles.alertTitle, sos && { fontSize: 18 }]}>
        {sos ? '🆘 ' : ''}
        {alert.label} · <Text style={styles.small}>{timeAgo(alert.created_at)}</Text>
      </Text>
      <Text style={styles.alertBody}>{alert.message}</Text>
      {sos && <Text style={styles.alertBody}>Call them or message them now. Their chat is in the Chats tab.</Text>}
      <View style={styles.alertActions}>
        <View style={{ flex: 1 }}>
          <Button title={yes} onPress={() => act('confirmed')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title={no} variant="secondary" onPress={() => act('dismissed')} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.textMuted, fontSize: 14 },
  small: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text, flexShrink: 1 },
  demo: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    marginBottom: spacing.md,
  },
  demoText: { color: colors.warning, fontSize: 13 },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.sm },
  tiles: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  tileValue: { fontSize: 20, fontWeight: '700', color: colors.primary },
  tileLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  progress: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.primarySoft, overflow: 'hidden', marginBottom: spacing.sm },
  fill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  choreRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  check: { fontSize: 16, width: 26 },
  choreText: { fontSize: 15, color: colors.text, flex: 1 },
  stepRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  visitRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  visitTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  emoji: { fontSize: 22, marginRight: spacing.sm },
  bigEmoji: { fontSize: 44 },
  pill: { borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: '700' },
  toneRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  toneEmoji: { fontSize: 18, width: 30 },
  toneLabel: { width: 70, fontSize: 13, color: colors.text },
  toneTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.primarySoft, overflow: 'hidden' },
  tonePct: { width: 42, textAlign: 'right', fontSize: 13, fontWeight: '600', color: colors.text },
  alert: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  sosAlert: { borderWidth: 2, borderColor: colors.danger },
  alertTitle: { fontSize: 15, fontWeight: '700', color: colors.danger },
  alertBody: { fontSize: 14, color: colors.text, marginTop: spacing.xs },
  alertActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});

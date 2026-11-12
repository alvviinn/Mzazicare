import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { addMedicine, addMember, assignTask, deleteMedicine, deleteTask } from '../../api/client';
import { Icon } from '../../components/Icon';
import { ProofPhoto } from '../../components/ProofPhoto';
import {
  Avatar,
  Button,
  Card,
  Chip,
  ErrorText,
  Field,
  haptic,
  IconButton,
  Loading,
  PressScale,
  Row,
  Section,
  Sheet,
} from '../../components/ui';
import { fmtTime } from '../../format';
import { colors, fonts, iconSize, radius, spacing, text, type } from '../../theme';
import { Dashboard, Medicine, Profile, TodayTask } from '../../types';

type Props = {
  token: string;
  profile: Profile;
  dash: Dashboard | null;
  onChanged: () => Promise<void>;
  onMedicinesChanged: () => void;
};

type Open = 'person' | 'medicine' | 'task' | null;

export default function PeopleTab({ token, profile, dash, onChanged, onMedicinesChanged }: Props) {
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);

  const people = [
    ...profile.caretakers.map((m) => ({ ...m, role: 'Caretaker' })),
    ...profile.elderly.map((m) => ({ ...m, role: 'Elder' })),
  ];

  return (
    <>
      {/* The circle, like a contacts row: tap + to add someone. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.circle}>
        <PressScale onPress={() => setOpen('person')} style={styles.person} accessibilityRole="button" accessibilityLabel="Add a person">
          <View style={styles.addCircle}>
            <Icon name="plus" size={iconSize.large} color={colors.onPrimary} />
          </View>
          <Text style={text.smallStrong}>Add</Text>
        </PressScale>
        {people.map((p) => (
          <View key={p.email} style={styles.person} accessible accessibilityLabel={`${p.name ?? p.email}, ${p.role}${p.status === 'pending' ? ', invited' : ''}`}>
            <View>
              <Avatar name={p.name ?? p.email} size={64} />
              {p.status === 'pending' && (
                <View style={styles.pendingDot}>
                  <Icon name="clock-outline" size={12} color={colors.butterInk} />
                </View>
              )}
            </View>
            <Text style={text.smallStrong} numberOfLines={1}>
              {(p.name ?? p.email).split(/[ @]/)[0]}
            </Text>
            <Text style={text.caption}>{p.status === 'pending' ? 'Invited' : p.role}</Text>
          </View>
        ))}
      </ScrollView>

      {!dash ? (
        <Loading label="Loading" lines={2} />
      ) : (
        <>
          <Section title="Medicines" action={dash.elderly.length ? 'Add' : undefined} onAction={() => setOpen('medicine')} />
          <MedicineList token={token} dash={dash} onChanged={onMedicinesChanged} onAdd={() => setOpen('medicine')} />

          <Section title="Tasks you set" action={dash.caretakers.length ? 'Add' : undefined} onAction={() => setOpen('task')} />
          <TaskList token={token} dash={dash} onChanged={onMedicinesChanged} onAdd={() => setOpen('task')} />
        </>
      )}

      <Sheet visible={open === 'person'} onClose={close} title="Add a person">
        <AddPerson token={token} onChanged={onChanged} onDone={close} />
      </Sheet>
      {dash && (
        <>
          <Sheet visible={open === 'medicine'} onClose={close} title="Medicine reminder">
            <AddMedicine token={token} dash={dash} onChanged={onMedicinesChanged} onDone={close} />
          </Sheet>
          <Sheet visible={open === 'task'} onClose={close} title="Task for the caretaker">
            <AddTask token={token} dash={dash} onChanged={onMedicinesChanged} onDone={close} />
          </Sheet>
        </>
      )}
    </>
  );
}

// ---------- lists ----------

function MedicineList({ token, dash, onChanged, onAdd }: { token: string; dash: Dashboard; onChanged: () => void; onAdd: () => void }) {
  function remove(m: Medicine) {
    Alert.alert('Remove reminder?', `${m.name} for ${m.elderly}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMedicine(token, m.id);
          } finally {
            onChanged();
          }
        },
      },
    ]);
  }

  if (!dash.elderly.length) return <Hint icon="human-cane" label="Link an elder first" />;
  if (!dash.medicines.items.length) return <AddCard icon="pill" label="Add a reminder" tint={colors.primarySoft} ink={colors.primaryInk} onPress={onAdd} />;

  return (
    <Card padded={false} style={styles.list}>
      {dash.medicines.items.map((m, i) => (
        <Row
          key={m.id}
          first={i === 0}
          leading={
            <View style={[styles.time, { backgroundColor: colors.primarySoft }]}>
              <Text style={styles.timeText}>{m.time}</Text>
            </View>
          }
          title={m.dose ? `${m.name} · ${m.dose}` : m.name}
          subtitle={`${m.elderly.split(' ')[0]} · daily`}
          trailing={<IconButton icon="trash-can-outline" label={`Delete reminder ${m.name}`} onPress={() => remove(m)} size={40} />}
        />
      ))}
    </Card>
  );
}

function TaskList({ token, dash, onChanged, onAdd }: { token: string; dash: Dashboard; onChanged: () => void; onAdd: () => void }) {
  const mine = dash.today.chores.filter((t) => t.assigned_by_me);

  function remove(t: TodayTask) {
    Alert.alert('Remove task?', `"${t.description}" for ${t.caretaker}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTask(token, t.id);
          } finally {
            onChanged();
          }
        },
      },
    ]);
  }

  if (!dash.caretakers.length) return <Hint icon="account-heart-outline" label="Link a caretaker first" />;
  if (!mine.length) return <AddCard icon="clipboard-plus-outline" label="Give a task" tint={colors.sageSoft} ink={colors.sage} onPress={onAdd} />;

  return (
    <Card padded={false} style={styles.list}>
      {mine.map((t, i) => (
        <Row
          key={t.id}
          first={i === 0}
          leading={<Icon name={t.is_done ? 'check-circle' : 'circle-outline'} size={26} color={t.is_done ? colors.sage : colors.borderStrong} />}
          title={t.description}
          subtitle={[t.caretaker.split(' ')[0], t.recurring ? 'weekdays' : 'once', t.done_at ? `done ${fmtTime(t.done_at)}` : null].filter(Boolean).join(' · ')}
          trailing={
            <View style={styles.trail}>
              {t.completion_id !== null && <ProofPhoto token={token} completionId={t.completion_id} caption={`${t.description} · ${t.caretaker}`} size={40} />}
              <IconButton icon="trash-can-outline" label={`Delete task ${t.description}`} onPress={() => remove(t)} size={40} />
            </View>
          }
        />
      ))}
    </Card>
  );
}

function Hint({ icon, label }: { icon: React.ComponentProps<typeof Icon>['name']; label: string }) {
  return (
    <Card tint="sunken">
      <View style={styles.hint}>
        <Icon name={icon} size={iconSize.inline} color={colors.textMuted} />
        <Text style={text.small}>{label}</Text>
      </View>
    </Card>
  );
}

function AddCard({
  icon,
  label,
  tint,
  ink,
  onPress,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  tint: string;
  ink: string;
  onPress: () => void;
}) {
  return (
    <PressScale onPress={onPress} style={[styles.addCard, { backgroundColor: tint }]} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.addIcon}>
        <Icon name={icon} size={iconSize.large} color={ink} />
      </View>
      <Text style={[text.bodyStrong, { flex: 1, color: ink }]}>{label}</Text>
      <Icon name="plus" size={iconSize.inline} color={ink} />
    </PressScale>
  );
}

// ---------- forms (inside sheets) ----------

function AddPerson({ token, onChanged, onDone }: { token: string; onChanged: () => Promise<void>; onDone: () => void }) {
  const [role, setRole] = useState<'caretaker' | 'elderly'>('caretaker');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
    setError('');
    setLoading(true);
    try {
      await addMember(token, email.trim(), role);
      setEmail('');
      haptic.success();
      await onChanged();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <View style={styles.roles}>
        <RoleTile on={role === 'caretaker'} icon="account-heart-outline" label="Caretaker" onPress={() => setRole('caretaker')} />
        <RoleTile on={role === 'elderly'} icon="human-cane" label="Elder" onPress={() => setRole('elderly')} />
      </View>
      <Field
        label="Their email"
        icon="email-outline"
        value={email}
        onChangeText={setEmail}
        placeholder="name@example.com"
        keyboardType="email-address"
        returnKeyType="done"
        onSubmitEditing={submit}
        accessibilityHint="If they have no account yet, they are linked when they register."
      />
      <ErrorText>{error}</ErrorText>
      <Button title={role === 'caretaker' ? 'Add caretaker' : 'Add elder'} icon="account-plus-outline" onPress={submit} loading={loading} />
    </>
  );
}

function RoleTile({ on, icon, label, onPress }: { on: boolean; icon: React.ComponentProps<typeof Icon>['name']; label: string; onPress: () => void }) {
  return (
    <PressScale
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={[styles.role, on && styles.roleOn]}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
    >
      <Icon name={icon} size={iconSize.large} color={on ? colors.onPrimary : colors.text} />
      <Text style={[text.bodyStrong, on && { color: colors.onPrimary }]}>{label}</Text>
    </PressScale>
  );
}

function AddMedicine({ token, dash, onChanged, onDone }: { token: string; dash: Dashboard; onChanged: () => void; onDone: () => void }) {
  const elders = dash.elderly;
  const [who, setWho] = useState(elders[0]?.email ?? '');
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [time, setTime] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function add() {
    if (!name.trim()) return setError('Enter the medicine name.');
    if (!/^\d{1,2}:\d{2}$/.test(time.trim())) return setError('Enter the time like 08:00 or 20:30.');
    setError('');
    setLoading(true);
    try {
      await addMedicine(token, { elderly_email: who || elders[0].email, name: name.trim(), dose: dose.trim(), time: time.trim() });
      setName('');
      setDose('');
      setTime('');
      haptic.success();
      onChanged();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {elders.length > 1 && (
        <View style={styles.chips}>
          {elders.map((e) => (
            <Chip key={e.email} label={e.name} selected={who === e.email} onPress={() => setWho(e.email)} accessibilityLabel={`For ${e.name}`} />
          ))}
        </View>
      )}
      <Field label="Medicine" icon="pill" value={name} onChangeText={setName} placeholder="e.g. Blood pressure tablet" autoCapitalize="sentences" />
      <View style={styles.pair}>
        <View style={{ flex: 1 }}>
          <Field label="Dose" value={dose} onChangeText={setDose} placeholder="1 tablet" autoCapitalize="sentences" />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Time (24 h)"
            icon="clock-outline"
            value={time}
            onChangeText={setTime}
            placeholder="08:00"
            keyboardType="numbers-and-punctuation"
            returnKeyType="done"
            onSubmitEditing={add}
          />
        </View>
      </View>
      <View style={styles.chips}>
        {['07:00', '08:00', '13:00', '20:00'].map((h) => (
          <Chip key={h} label={h} selected={time === h} onPress={() => setTime(h)} accessibilityLabel={`Time ${h}`} />
        ))}
      </View>
      <ErrorText>{error}</ErrorText>
      <Button title="Add reminder" icon="bell-plus-outline" onPress={add} loading={loading} />
    </>
  );
}

function AddTask({ token, dash, onChanged, onDone }: { token: string; dash: Dashboard; onChanged: () => void; onDone: () => void }) {
  const carers = dash.caretakers;
  const [who, setWho] = useState(carers[0]?.email ?? '');
  const [title, setTitle] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function add() {
    if (!title.trim()) return setError('Write the task first.');
    setError('');
    setLoading(true);
    try {
      await assignTask(token, { caretaker_email: who || carers[0].email, title: title.trim(), recurring });
      setTitle('');
      setRecurring(false);
      haptic.success();
      onChanged();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {carers.length > 1 && (
        <View style={styles.chips}>
          {carers.map((c) => (
            <Chip key={c.email} label={c.name} selected={who === c.email} onPress={() => setWho(c.email)} accessibilityLabel={`For ${c.name}`} />
          ))}
        </View>
      )}
      <Field
        label="Task"
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. A short walk after lunch"
        autoCapitalize="sentences"
        maxLength={200}
        returnKeyType="done"
        onSubmitEditing={add}
        accessibilityHint="The caretaker ticks it off with a photo, which you can see here."
      />
      <View style={styles.chips}>
        <Chip label="Just today" icon="calendar-today" selected={!recurring} onPress={() => setRecurring(false)} />
        <Chip label="Every weekday" icon="repeat" selected={recurring} onPress={() => setRecurring(true)} />
      </View>
      <View style={styles.photoNote}>
        <Icon name="camera-outline" size={18} color={colors.textMuted} />
        <Text style={text.small}>Done = photo proof</Text>
      </View>
      <ErrorText>{error}</ErrorText>
      <Button title="Give task" icon="send" onPress={add} loading={loading} />
    </>
  );
}

const styles = StyleSheet.create({
  circle: { gap: spacing.md, paddingVertical: spacing.xs, paddingRight: spacing.md },
  person: { width: 72, alignItems: 'center', gap: 4 },
  addCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  pendingDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.butter,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingHorizontal: spacing.md },
  time: { width: 60, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  timeText: { fontFamily: fonts.display, fontSize: type.body, color: colors.primaryInk },
  trail: { flexDirection: 'row', alignItems: 'center' },
  hint: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  addCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms, borderRadius: radius.lg, padding: spacing.md, minHeight: 76 },
  addIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  roles: { flexDirection: 'row', gap: spacing.ms, marginBottom: spacing.lg },
  role: { flex: 1, alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface },
  roleOn: { backgroundColor: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  pair: { flexDirection: 'row', gap: spacing.ms },
  photoNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
});

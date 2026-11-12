import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { addMedicine, addMember, assignTask, deleteMedicine, deleteTask } from '../../api/client';
import { Icon, IconName } from '../../components/Icon';
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
import { colors, icon, on, radius, space, text } from '../../theme';
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
            <Icon name="plus" size={icon.l} color={on.primary} />
          </View>
          <Text style={text.captionStrong}>Add</Text>
        </PressScale>
        {people.map((p) => (
          <View key={p.email} style={styles.person} accessible accessibilityLabel={`${p.name ?? p.email}, ${p.role}${p.status === 'pending' ? ', invited' : ''}`}>
            <View>
              <Avatar name={p.name ?? p.email} size={64} />
              {p.status === 'pending' && (
                <View style={styles.pendingDot}>
                  <Icon name="clock" size={icon.xs} />
                </View>
              )}
            </View>
            <Text style={text.captionStrong} numberOfLines={1}>
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

  if (!dash.elderly.length) return <Hint glyph="elder" label="Link an elder first" />;
  if (!dash.medicines.items.length) return <AddCard glyph="pill" label="Add a reminder" tint={colors.primaryTint} onPress={onAdd} />;

  return (
    <Card padded={false} style={styles.list}>
      {dash.medicines.items.map((m, i) => (
        <Row
          key={m.id}
          first={i === 0}
          leading={
            <View style={styles.time}>
              <Text style={text.bodyStrong}>{m.time}</Text>
            </View>
          }
          title={m.dose ? `${m.name} · ${m.dose}` : m.name}
          subtitle={`${m.elderly.split(' ')[0]} · daily`}
          trailing={<IconButton icon="trash" label={`Delete reminder ${m.name}`} onPress={() => remove(m)} />}
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

  if (!dash.caretakers.length) return <Hint glyph="carer" label="Link a caretaker first" />;
  if (!mine.length) return <AddCard glyph="clipboardPlus" label="Give a task" tint={colors.secondaryTint} onPress={onAdd} />;

  return (
    <Card padded={false} style={styles.list}>
      {mine.map((t, i) => (
        <Row
          key={t.id}
          first={i === 0}
          leading={<Icon name={t.is_done ? 'checkCircle' : 'circle'} size={icon.m} color={t.is_done ? colors.success : colors.inkMuted} />}
          title={t.description}
          subtitle={[t.caretaker.split(' ')[0], t.recurring ? 'weekdays' : 'once', t.done_at ? `done ${fmtTime(t.done_at)}` : null].filter(Boolean).join(' · ')}
          trailing={
            <View style={styles.trail}>
              {t.completion_id !== null && <ProofPhoto token={token} completionId={t.completion_id} caption={`${t.description} · ${t.caretaker}`} size={40} />}
              <IconButton icon="trash" label={`Delete task ${t.description}`} onPress={() => remove(t)} />
            </View>
          }
        />
      ))}
    </Card>
  );
}

function Hint({ glyph, label }: { glyph: IconName; label: string }) {
  return (
    <Card>
      <View style={styles.hint}>
        <Icon name={glyph} color={colors.inkMuted} />
        <Text style={text.caption}>{label}</Text>
      </View>
    </Card>
  );
}

function AddCard({ glyph, label, tint, onPress }: { glyph: IconName; label: string; tint: string; onPress: () => void }) {
  return (
    <PressScale onPress={onPress} style={[styles.addCard, { backgroundColor: tint }]} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.addIcon}>
        <Icon name={glyph} size={icon.m} />
      </View>
      <Text style={[text.bodyStrong, { flex: 1 }]}>{label}</Text>
      <Icon name="plus" />
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
        <RoleTile selected={role === 'caretaker'} glyph="carer" label="Caretaker" onPress={() => setRole('caretaker')} />
        <RoleTile selected={role === 'elderly'} glyph="elder" label="Elder" onPress={() => setRole('elderly')} />
      </View>
      <Field
        label="Their email"
        icon="mail"
        value={email}
        onChangeText={setEmail}
        placeholder="name@example.com"
        keyboardType="email-address"
        returnKeyType="done"
        onSubmitEditing={submit}
        accessibilityHint="If they have no account yet, they are linked when they register."
      />
      <ErrorText>{error}</ErrorText>
      <Button title={role === 'caretaker' ? 'Add caretaker' : 'Add elder'} icon="personAdd" onPress={submit} loading={loading} />
    </>
  );
}

// Choosing a role: category tiles in mulberry tint; the chosen one turns marigold tint with a tick.
function RoleTile({ selected, glyph, label, onPress }: { selected: boolean; glyph: IconName; label: string; onPress: () => void }) {
  return (
    <PressScale
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={[styles.role, { backgroundColor: selected ? colors.primaryTint : colors.secondaryTint }]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Icon name={selected ? 'checkCircle' : glyph} size={icon.l} />
      <Text style={text.bodyStrong}>{label}</Text>
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
            icon="clock"
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
      <Button title="Add reminder" icon="bellPlus" onPress={add} loading={loading} />
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
        <Chip label="Just today" icon="calendarToday" selected={!recurring} onPress={() => setRecurring(false)} />
        <Chip label="Every weekday" icon="repeat" selected={recurring} onPress={() => setRecurring(true)} />
      </View>
      <View style={styles.photoNote}>
        <Icon name="camera" color={colors.inkMuted} />
        <Text style={text.caption}>Ticked off with a photo</Text>
      </View>
      <ErrorText>{error}</ErrorText>
      <Button title="Give task" icon="send" onPress={add} loading={loading} />
    </>
  );
}

const styles = StyleSheet.create({
  circle: { gap: space.m, paddingVertical: space.s, paddingRight: space.m },
  person: { width: 72, alignItems: 'center', gap: space.s },
  addCircle: { width: 64, height: 64, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  pendingDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingHorizontal: space.m },
  time: { width: 64, height: 40, borderRadius: radius.small, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  trail: { flexDirection: 'row', alignItems: 'center' },
  hint: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  addCard: { flexDirection: 'row', alignItems: 'center', gap: space.m, borderRadius: radius.card, padding: space.m, minHeight: 80 },
  addIcon: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  roles: { flexDirection: 'row', gap: space.s, marginBottom: space.l },
  role: { flex: 1, alignItems: 'center', gap: space.s, paddingVertical: space.l, borderRadius: radius.small },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s, marginBottom: space.m },
  pair: { flexDirection: 'row', gap: space.s },
  photoNote: { flexDirection: 'row', alignItems: 'center', gap: space.s, marginBottom: space.m },
});

import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { addMedicine, addMember, deleteMedicine } from '../../api/client';
import { FamilyCard, SectionTitle } from '../../components/HomeShell';
import { Button, Card, ErrorText, Field } from '../../components/ui';
import { colors, radius, spacing } from '../../theme';
import { Dashboard, Medicine, Profile } from '../../types';

type Props = {
  token: string;
  profile: Profile;
  dash: Dashboard | null;
  onChanged: () => Promise<void>;
  onMedicinesChanged: () => void;
};

function AddPerson({
  token,
  role,
  title,
  hint,
  onChanged,
}: {
  token: string;
  role: 'caretaker' | 'elderly';
  title: string;
  hint: string;
  onChanged: () => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
    setError('');
    setDone('');
    setLoading(true);
    try {
      await addMember(token, email.trim(), role);
      setDone(`${email.trim()} added.`);
      setEmail('');
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.hint}>{hint}</Text>
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="name@example.com"
        keyboardType="email-address"
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <ErrorText>{error}</ErrorText>
      {!!done && <Text style={styles.success}>{done}</Text>}
      <Button title="Add" onPress={submit} loading={loading} />
    </Card>
  );
}

function MedicineSection({
  token,
  dash,
  onMedicinesChanged,
}: {
  token: string;
  dash: Dashboard;
  onMedicinesChanged: () => void;
}) {
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
      onMedicinesChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

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
            onMedicinesChanged();
          }
        },
      },
    ]);
  }

  if (!elders.length) {
    return (
      <Card>
        <Text style={styles.hint}>Once an elderly person is linked to you, you can set their medicine reminders here.</Text>
      </Card>
    );
  }

  return (
    <>
      {dash.medicines.items.length > 0 && (
        <Card>
          {dash.medicines.items.map((m, i) => (
            <View key={m.id} style={[styles.medRow, i > 0 && styles.medBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.medName}>
                  {m.name}
                  {m.dose ? ` · ${m.dose}` : ''}
                </Text>
                <Text style={styles.hintSmall}>
                  {m.elderly} · every day at {m.time}
                </Text>
              </View>
              <Pressable onPress={() => remove(m)} hitSlop={10}>
                <Text style={styles.remove}>✕</Text>
              </Pressable>
            </View>
          ))}
        </Card>
      )}
      <View style={{ height: spacing.md }} />
      <Card>
        <Text style={styles.cardTitle}>Add a medicine reminder</Text>
        <Text style={styles.hint}>They will see it on their home screen each day and can tap "I took it".</Text>
        {elders.length > 1 && (
          <View style={styles.chips}>
            {elders.map((e) => (
              <Pressable key={e.email} onPress={() => setWho(e.email)} style={[styles.chip, who === e.email && styles.chipOn]}>
                <Text style={[styles.chipText, who === e.email && { color: colors.onPrimary }]}>{e.name}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <Field label="Medicine" value={name} onChangeText={setName} placeholder="e.g. Blood pressure tablet" autoCapitalize="sentences" />
        <Field label="Dose (optional)" value={dose} onChangeText={setDose} placeholder="e.g. 1 tablet" autoCapitalize="sentences" />
        <Field
          label="Time (24-hour)"
          value={time}
          onChangeText={setTime}
          placeholder="08:00"
          keyboardType="numbers-and-punctuation"
          returnKeyType="done"
          onSubmitEditing={add}
        />
        <ErrorText>{error}</ErrorText>
        <Button title="Add reminder" onPress={add} loading={loading} />
      </Card>
    </>
  );
}

export default function PeopleTab({ token, profile, dash, onChanged, onMedicinesChanged }: Props) {
  return (
    <>
      <SectionTitle>Your care circle</SectionTitle>
      <FamilyCard profile={profile} />

      <SectionTitle>Medicine reminders</SectionTitle>
      {dash ? (
        <MedicineSection token={token} dash={dash} onMedicinesChanged={onMedicinesChanged} />
      ) : (
        <Text style={styles.hint}>Loading…</Text>
      )}

      <SectionTitle>Add people</SectionTitle>
      <AddPerson
        token={token}
        role="caretaker"
        title="Add a caretaker"
        hint="If they already have an account it becomes a caretaker account. Otherwise it is set up when they register."
        onChanged={onChanged}
      />
      <View style={{ height: spacing.md }} />
      <AddPerson
        token={token}
        role="elderly"
        title="Add an elderly person"
        hint="Their account will see their own care home screen, linked to you and your caretakers."
        onChanged={onChanged}
      />
    </>
  );
}

const styles = StyleSheet.create({
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  hint: { color: colors.textMuted, fontSize: 14, marginTop: spacing.xs, marginBottom: spacing.md },
  hintSmall: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  medRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  medBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  medName: { fontSize: 15, fontWeight: '600', color: colors.text },
  remove: { color: colors.textMuted, fontSize: 18, paddingLeft: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.background,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.primary, fontWeight: '600' },
  success: { color: colors.primary, marginBottom: spacing.md, fontSize: 14 },
});

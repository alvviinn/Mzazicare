import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { addMember } from '../api/client';
import { FamilyCard, HomeShell, SectionTitle } from '../components/HomeShell';
import { Button, Card, ErrorText, Field } from '../components/ui';
import { colors, spacing } from '../theme';
import { Profile } from '../types';

type Props = { token: string; profile: Profile; onChanged: () => Promise<void>; onSignOut: () => void };

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

export default function UserHome({ token, profile, onChanged, onSignOut }: Props) {
  return (
    <HomeShell profile={profile} onSignOut={onSignOut}>
      <Card>
        <Text style={styles.cardTitle}>Care overview</Text>
        <Text style={styles.hint}>
          {profile.caretakers.length} caretaker{profile.caretakers.length === 1 ? '' : 's'} ·{' '}
          {profile.elderly.length} elderly {profile.elderly.length === 1 ? 'person' : 'people'}
        </Text>
      </Card>

      <SectionTitle>Your care circle</SectionTitle>
      <FamilyCard profile={profile} />

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
    </HomeShell>
  );
}

const styles = StyleSheet.create({
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  hint: { color: colors.textMuted, fontSize: 14, marginTop: spacing.xs, marginBottom: spacing.md },
  success: { color: colors.primary, marginBottom: spacing.md, fontSize: 14 },
});

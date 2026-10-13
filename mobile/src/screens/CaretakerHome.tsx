import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { FamilyCard, HomeShell, SectionTitle } from '../components/HomeShell';
import { Button, Card } from '../components/ui';
import { colors, spacing } from '../theme';
import { Profile } from '../types';
import ChatScreen from './ChatScreen';

type Props = { token: string; profile: Profile; onSignOut: () => void };

export default function CaretakerHome({ token, profile, onSignOut }: Props) {
  const [chatOpen, setChatOpen] = useState(false);
  const elderly = profile.elderly.filter((e) => e.status === 'active');

  if (chatOpen && profile.sponsor) {
    return <ChatScreen token={token} peer={profile.sponsor} onBack={() => setChatOpen(false)} />;
  }

  return (
    <HomeShell profile={profile} onSignOut={onSignOut}>
      <Card>
        <Text style={styles.title}>Your care shift</Text>
        <Text style={styles.hint}>
          {elderly.length === 0
            ? 'No elderly person has been linked to you yet.'
            : `You are caring for ${elderly.map((e) => e.name).join(', ')}.`}{' '}
          Shift check-in, checklist and the triage assistant will appear here.
        </Text>
      </Card>

      {profile.sponsor && (
        <Card>
          <Text style={styles.title}>Family</Text>
          <Text style={styles.hint}>Send {profile.sponsor.name} an update or ask a question.</Text>
          <Button title={`Message ${profile.sponsor.name.split(' ')[0]}`} onPress={() => setChatOpen(true)} />
        </Card>
      )}

      <SectionTitle>People you work with</SectionTitle>
      <FamilyCard profile={{ ...profile, caretakers: profile.caretakers.filter((c) => c.email !== profile.email) }} />
    </HomeShell>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  hint: { color: colors.textMuted, fontSize: 14, marginTop: spacing.xs, marginBottom: spacing.sm },
});

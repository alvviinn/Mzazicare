import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { FamilyCard, HomeShell, SectionTitle } from '../components/HomeShell';
import { Button, Card } from '../components/ui';
import { colors, spacing } from '../theme';
import { Profile } from '../types';
import ChatScreen from './ChatScreen';

type Props = { token: string; profile: Profile; onSignOut: () => void };

export default function ElderlyHome({ token, profile, onSignOut }: Props) {
  const [chatOpen, setChatOpen] = useState(false);

  if (chatOpen && profile.sponsor) {
    return <ChatScreen token={token} peer={profile.sponsor} onBack={() => setChatOpen(false)} />;
  }

  return (
    <HomeShell profile={profile} onSignOut={onSignOut}>
      <Card>
        <Text style={styles.title}>You are in good hands</Text>
        <Text style={styles.hint}>
          Your family and caretakers are listed below. Your daily care updates will appear here.
        </Text>
      </Card>

      {profile.sponsor && (
        <Card>
          <Text style={styles.title}>Talk to your family</Text>
          <Text style={styles.hint}>Send {profile.sponsor.name} a message any time.</Text>
          <Button title={`Message ${profile.sponsor.name.split(' ')[0]}`} onPress={() => setChatOpen(true)} />
        </Card>
      )}

      <SectionTitle>Your care circle</SectionTitle>
      <FamilyCard profile={{ ...profile, elderly: profile.elderly.filter((e) => e.email !== profile.email) }} />
    </HomeShell>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  hint: { color: colors.textMuted, fontSize: 14, marginTop: spacing.xs, marginBottom: spacing.sm },
});

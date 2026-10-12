import { StyleSheet, Text } from 'react-native';
import { FamilyCard, HomeShell, SectionTitle } from '../components/HomeShell';
import { Card } from '../components/ui';
import { colors, spacing } from '../theme';
import { Profile } from '../types';

export default function CaretakerHome({ profile, onSignOut }: { profile: Profile; onSignOut: () => void }) {
  const elderly = profile.elderly.filter((e) => e.status === 'active');
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
      <SectionTitle>People you work with</SectionTitle>
      <FamilyCard profile={{ ...profile, caretakers: profile.caretakers.filter((c) => c.email !== profile.email) }} />
    </HomeShell>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  hint: { color: colors.textMuted, fontSize: 14, marginTop: spacing.xs },
});

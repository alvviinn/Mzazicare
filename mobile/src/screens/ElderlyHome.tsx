import { StyleSheet, Text } from 'react-native';
import { FamilyCard, HomeShell, SectionTitle } from '../components/HomeShell';
import { Card } from '../components/ui';
import { colors, spacing } from '../theme';
import { Profile } from '../types';

export default function ElderlyHome({ profile, onSignOut }: { profile: Profile; onSignOut: () => void }) {
  return (
    <HomeShell profile={profile} onSignOut={onSignOut}>
      <Card>
        <Text style={styles.title}>You are in good hands</Text>
        <Text style={styles.hint}>
          Your family and caretakers are listed below. Your daily care updates will appear here.
        </Text>
      </Card>
      <SectionTitle>Your care circle</SectionTitle>
      <FamilyCard profile={{ ...profile, elderly: profile.elderly.filter((e) => e.email !== profile.email) }} />
    </HomeShell>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  hint: { color: colors.textMuted, fontSize: 14, marginTop: spacing.xs },
});

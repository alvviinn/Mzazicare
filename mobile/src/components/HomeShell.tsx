import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Profile, Role } from '../types';
import { colors, radius, spacing } from '../theme';
import { Card } from './ui';

const ROLE_LABEL: Record<Role, string> = {
  user: 'Family account',
  caretaker: 'Caretaker',
  elderly: 'Elderly care recipient',
};

// Common frame for every role's home screen: greeting, role badge, content, sign out.
export function HomeShell({
  profile,
  onSignOut,
  children,
  footer,
  refreshing,
  onRefresh,
}: {
  profile: Profile;
  onSignOut: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode; // fixed bar under the scrolling content (e.g. tabs)
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.container}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          ) : undefined
        }
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>Hello, {profile.name.split(' ')[0]}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{ROLE_LABEL[profile.role]}</Text>
            </View>
          </View>
          <Pressable onPress={onSignOut}>
            <Text style={styles.signOut}>Sign out</Text>
          </Pressable>
        </View>
        {children}
      </ScrollView>
      {footer}
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.section}>{children}</Text>;
}

// Read-only list of the people linked through the same family account.
export function FamilyCard({ profile }: { profile: Profile }) {
  const rows: { label: string; name: string; sub: string; pending?: boolean }[] = [];
  if (profile.sponsor) {
    rows.push({ label: 'Family account', name: profile.sponsor.name, sub: profile.sponsor.email });
  }
  profile.caretakers.forEach((m) =>
    rows.push({ label: 'Caretaker', name: m.name ?? m.email, sub: m.email, pending: m.status === 'pending' }),
  );
  profile.elderly.forEach((m) =>
    rows.push({ label: 'Elderly', name: m.name ?? m.email, sub: m.email, pending: m.status === 'pending' }),
  );

  return (
    <Card>
      {rows.length === 0 ? (
        <Text style={styles.empty}>Nobody is linked yet.</Text>
      ) : (
        rows.map((r, i) => (
          <View key={`${r.sub}-${i}`} style={[styles.row, i > 0 && styles.rowBorder]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowName}>{r.name}</Text>
              <Text style={styles.rowSub}>{r.sub}</Text>
            </View>
            <Text style={styles.rowTag}>{r.pending ? `${r.label} · invited` : r.label}</Text>
          </View>
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingTop: spacing.xl + spacing.lg },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.lg },
  hello: { fontSize: 26, fontWeight: '700', color: colors.text },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: spacing.sm,
  },
  badgeText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  signOut: { color: colors.primary, fontWeight: '600', marginTop: spacing.xs },
  section: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  empty: { color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rowName: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  rowTag: { fontSize: 12, color: colors.textMuted, marginLeft: spacing.sm },
});

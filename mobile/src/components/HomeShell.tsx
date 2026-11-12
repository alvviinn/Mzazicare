import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { t } from '../strings';
import { colors, spacing, TAP, text, TOP_INSET } from '../theme';
import { Profile } from '../types';
import { Icon } from './Icon';
import { Avatar, Button, Card, OfflineBanner, Row, Sheet } from './ui';

// Common frame for the caretaker and family homes: greeting, avatar (opens the account sheet), content, footer.
export function HomeShell({
  profile,
  onSignOut,
  children,
  footer,
  overlay,
  refreshing,
  onRefresh,
  title,
}: {
  profile: Profile;
  onSignOut: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode; // fixed under the scrolling content (main action, tabs)
  overlay?: React.ReactNode; // a toast, drawn above the footer
  refreshing?: boolean;
  onRefresh?: () => void;
  title?: string; // a tab's own title instead of the greeting
}) {
  const [account, setAccount] = useState(false);
  const first = profile.name.split(' ')[0];
  const day = new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' });

  return (
    <View style={styles.flex}>
      <OfflineBanner />
      <View style={styles.flex}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.container}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
            ) : undefined
          }
        >
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={text.small}>{title ? t.roles[profile.role] : day}</Text>
              <Text style={text.h1} accessibilityRole="header" numberOfLines={1}>
                {title ?? t.common.hello(first)}
              </Text>
            </View>
            <Pressable
              onPress={() => setAccount(true)}
              style={styles.me}
              accessibilityRole="button"
              accessibilityLabel={`${t.common.account}: ${profile.name}`}
            >
              <Avatar name={profile.name} size={46} />
            </Pressable>
          </View>
          {children}
        </ScrollView>
        {overlay}
      </View>
      {footer}

      <AccountSheet profile={profile} visible={account} onClose={() => setAccount(false)} onSignOut={onSignOut} />
    </View>
  );
}

function AccountSheet({
  profile,
  visible,
  onClose,
  onSignOut,
}: {
  profile: Profile;
  visible: boolean;
  onClose: () => void;
  onSignOut: () => void;
}) {
  function confirmSignOut() {
    Alert.alert(t.common.signOutConfirm, t.common.signOutBody, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.signOut, style: 'destructive', onPress: onSignOut },
    ]);
  }
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.meHead}>
        <Avatar name={profile.name} size={72} />
        <Text style={[text.h1, { marginTop: spacing.sm }]}>{profile.name}</Text>
        <Text style={text.small}>
          {t.roles[profile.role]} · {profile.email}
        </Text>
      </View>
      <Text style={[text.h2, { marginTop: spacing.lg, marginBottom: spacing.xs }]}>{t.common.circle}</Text>
      <FamilyCard profile={profile} />
      <View style={{ marginTop: spacing.lg }}>
        <Button title={t.common.signOut} icon="logout" variant="quiet" onPress={confirmSignOut} />
      </View>
    </Sheet>
  );
}

// The people linked through the same family account, as avatar rows.
export function FamilyCard({ profile, tint = 'surface' }: { profile: Profile; tint?: 'surface' | 'sunken' }) {
  const rows: { label: string; name: string; sub: string; pending?: boolean }[] = [];
  if (profile.sponsor) rows.push({ label: t.roles.user, name: profile.sponsor.name, sub: profile.sponsor.email });
  profile.caretakers.forEach((m) =>
    rows.push({ label: t.roles.caretaker, name: m.name ?? m.email, sub: m.email, pending: m.status === 'pending' }),
  );
  profile.elderly.forEach((m) =>
    rows.push({ label: t.roles.elderly, name: m.name ?? m.email, sub: m.email, pending: m.status === 'pending' }),
  );

  return (
    <Card tint={tint} padded={false} style={{ paddingHorizontal: spacing.md }}>
      {rows.length === 0 ? (
        <Row first leading={<Icon name="account-multiple-plus-outline" size={24} color={colors.textMuted} />} title={t.common.nobodyLinked} />
      ) : (
        rows.map((r, i) => (
          <Row
            key={`${r.sub}-${i}`}
            first={i === 0}
            leading={<Avatar name={r.name} size={40} />}
            title={r.name}
            subtitle={r.pending ? `${r.label} · ${t.common.invited}` : r.label}
            accessibilityLabel={`${r.name}, ${r.label}${r.pending ? ', invited' : ''}`}
          />
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: spacing.md, paddingTop: TOP_INSET, paddingBottom: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, gap: spacing.ms },
  me: { minWidth: TAP, minHeight: TAP, alignItems: 'center', justifyContent: 'center' },
  meHead: { alignItems: 'center', paddingTop: spacing.sm },
});

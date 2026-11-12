import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { t } from '../strings';
import { colors, space, TAP, text, TOP_INSET } from '../theme';
import { Profile } from '../types';
import { Icon } from './Icon';
import { Avatar, Button, Card, OfflineBanner, Row, Sheet } from './ui';

// Common frame for the caretaker and family homes: title, avatar (opens the account sheet), content, footer.
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
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.secondary} colors={[colors.secondary]} />
            ) : undefined
          }
        >
          <View style={styles.header}>
            <View style={styles.flex}>
              <Text style={text.caption}>{title ? t.roles[profile.role] : day}</Text>
              <Text style={text.display} accessibilityRole="header" numberOfLines={1}>
                {title ?? t.common.hello(first)}
              </Text>
            </View>
            <Pressable
              onPress={() => setAccount(true)}
              style={styles.me}
              accessibilityRole="button"
              accessibilityLabel={`${t.common.account}: ${profile.name}`}
            >
              <Avatar name={profile.name} size={48} />
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
        <Text style={text.heading}>{profile.name}</Text>
        <Text style={text.caption}>
          {t.roles[profile.role]} · {profile.email}
        </Text>
      </View>
      <Text style={[text.heading, styles.circleTitle]}>{t.common.circle}</Text>
      <FamilyCard profile={profile} />
      <View style={{ marginTop: space.l }}>
        <Button title={t.common.signOut} icon="logout" variant="soft" onPress={confirmSignOut} />
      </View>
    </Sheet>
  );
}

// The people linked through the same family account, as avatar rows.
export function FamilyCard({ profile }: { profile: Profile }) {
  const rows: { label: string; name: string; sub: string; pending?: boolean }[] = [];
  if (profile.sponsor) rows.push({ label: t.roles.user, name: profile.sponsor.name, sub: profile.sponsor.email });
  profile.caretakers.forEach((m) =>
    rows.push({ label: t.roles.caretaker, name: m.name ?? m.email, sub: m.email, pending: m.status === 'pending' }),
  );
  profile.elderly.forEach((m) =>
    rows.push({ label: t.roles.elderly, name: m.name ?? m.email, sub: m.email, pending: m.status === 'pending' }),
  );

  return (
    <Card tint="secondary" padded={false} style={{ paddingHorizontal: space.m }}>
      {rows.length === 0 ? (
        <Row first leading={<Icon name="personAdd" color={colors.inkMuted} />} title={t.common.nobodyLinked} />
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
  container: { paddingHorizontal: space.m, paddingTop: TOP_INSET, paddingBottom: space.xl },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: space.l, gap: space.m },
  me: { minWidth: TAP, minHeight: TAP, alignItems: 'center', justifyContent: 'center' },
  meHead: { alignItems: 'center', gap: space.s, paddingTop: space.s },
  circleTitle: { marginTop: space.l, marginBottom: space.s },
});

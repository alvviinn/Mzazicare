import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getDashboard } from '../api/client';
import { HomeShell } from '../components/HomeShell';
import { colors, spacing } from '../theme';
import { Dashboard, Profile } from '../types';
import ChatScreen from './ChatScreen';
import ChatsTab from './user/ChatsTab';
import Overview from './user/Overview';
import PeopleTab from './user/PeopleTab';

type Props = { token: string; profile: Profile; onChanged: () => Promise<void>; onSignOut: () => void };
type Tab = 'overview' | 'chats' | 'people';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: '🏠' },
  { key: 'chats', label: 'Chats', icon: '💬' },
  { key: 'people', label: 'People', icon: '👥' },
];

export default function UserHome({ token, profile, onChanged, onSignOut }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [chatPeer, setChatPeer] = useState<{ name: string; email: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setDash(await getDashboard(token));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the dashboard.');
    }
  }, [token]);

  // Load on open, keep fresh every 30s, and reload when coming back from a chat or changing the circle.
  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load, chatPeer, profile]);

  async function refresh() {
    setRefreshing(true);
    await Promise.all([load(), onChanged()]);
    setRefreshing(false);
  }

  if (chatPeer) {
    return <ChatScreen token={token} peer={chatPeer} onBack={() => setChatPeer(null)} />;
  }

  const unread = dash ? [...dash.caretakers, ...dash.elderly].reduce((n, p) => n + p.unread, 0) : 0;

  const footer = (
    <View style={styles.tabBar}>
      {TABS.map((t) => (
        <Pressable key={t.key} style={styles.tab} onPress={() => setTab(t.key)}>
          <Text style={styles.tabIcon}>{t.icon}</Text>
          <Text style={[styles.tabLabel, tab === t.key && styles.tabActive]}>{t.label}</Text>
          {t.key === 'chats' && unread > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread}</Text>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );

  return (
    <HomeShell profile={profile} onSignOut={onSignOut} footer={footer} refreshing={refreshing} onRefresh={refresh}>
      {tab === 'overview' && (
        <Overview
          token={token}
          profile={profile}
          dash={dash}
          error={error}
          onChanged={load}
          onGoPeople={() => setTab('people')}
        />
      )}
      {tab === 'chats' && <ChatsTab dash={dash} onOpen={setChatPeer} onGoPeople={() => setTab('people')} />}
      {tab === 'people' && <PeopleTab token={token} profile={profile} onChanged={onChanged} />}
    </HomeShell>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: spacing.sm,
  },
  tab: { flex: 1, alignItems: 'center', paddingTop: spacing.sm },
  tabIcon: { fontSize: 20 },
  tabLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  tabActive: { color: colors.primary, fontWeight: '700' },
  badge: {
    position: 'absolute',
    top: 2,
    right: '28%',
    backgroundColor: colors.danger,
    borderRadius: 9,
    minWidth: 18,
    paddingHorizontal: 4,
  },
  badgeText: { color: colors.onPrimary, fontSize: 11, fontWeight: '700', textAlign: 'center' },
});

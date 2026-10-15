import { useCallback, useEffect, useState } from 'react';
import { getDashboard } from '../api/client';
import { HomeShell } from '../components/HomeShell';
import { TabBar, TabDef } from '../components/TabBar';
import { Dashboard, Profile } from '../types';
import ChatScreen from './ChatScreen';
import ChatsTab from './user/ChatsTab';
import Overview from './user/Overview';
import PeopleTab from './user/PeopleTab';

type Props = { token: string; profile: Profile; onChanged: () => Promise<void>; onSignOut: () => void };
type Tab = 'overview' | 'chats' | 'people';

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

  // Load on open, keep fresh every 15s (live shift status), and reload when coming back from a chat
  // or when the care circle changes.
  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
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
  const tabs: TabDef<Tab>[] = [
    { key: 'overview', label: 'Overview', icon: '🏠' },
    { key: 'chats', label: 'Chats', icon: '💬', badge: unread },
    { key: 'people', label: 'People', icon: '👥' },
  ];

  return (
    <HomeShell
      profile={profile}
      onSignOut={onSignOut}
      footer={<TabBar tabs={tabs} active={tab} onChange={setTab} />}
      refreshing={refreshing}
      onRefresh={refresh}
    >
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
      {tab === 'people' && (
        <PeopleTab token={token} profile={profile} dash={dash} onChanged={onChanged} onMedicinesChanged={load} />
      )}
    </HomeShell>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { getShiftState } from '../api/client';
import { FamilyCard, HomeShell, SectionTitle } from '../components/HomeShell';
import { TabBar, TabDef } from '../components/TabBar';
import { useLocationSharing } from '../location/useLocationSharing';
import { Profile, ShiftState } from '../types';
import ChatScreen from './ChatScreen';
import HoursTab from './caretaker/HoursTab';
import ShiftTab from './caretaker/ShiftTab';
import TasksTab from './caretaker/TasksTab';

type Props = { token: string; profile: Profile; onSignOut: () => void };
type Tab = 'shift' | 'tasks' | 'hours';

const TABS: TabDef<Tab>[] = [
  { key: 'shift', label: 'Shift', icon: '🕗' },
  { key: 'tasks', label: 'Tasks', icon: '✅' },
  { key: 'hours', label: 'Hours', icon: '📊' },
];

export default function CaretakerHome({ token, profile, onSignOut }: Props) {
  const [tab, setTab] = useState<Tab>('shift');
  const [state, setState] = useState<ShiftState | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // This phone reports its position; the server compares it with the elder's phone.
  const sharing = useLocationSharing(token);

  const load = useCallback(async () => {
    try {
      setState(await getShiftState(token));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your shift.');
    }
  }, [token]);

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (chatOpen && profile.sponsor) {
    return <ChatScreen token={token} peer={profile.sponsor} onBack={() => setChatOpen(false)} />;
  }

  return (
    <HomeShell
      profile={profile}
      onSignOut={onSignOut}
      footer={<TabBar tabs={TABS} active={tab} onChange={setTab} />}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {tab === 'shift' && (
        <>
          <ShiftTab
            token={token}
            state={state}
            error={error}
            sharing={sharing.status}
            sponsorName={profile.sponsor?.name ?? null}
            onChanged={load}
            onChat={() => setChatOpen(true)}
          />
          <SectionTitle>People you work with</SectionTitle>
          <FamilyCard
            profile={{ ...profile, caretakers: profile.caretakers.filter((c) => c.email !== profile.email) }}
          />
        </>
      )}
      {tab === 'tasks' && <TasksTab token={token} />}
      {tab === 'hours' && <HoursTab token={token} />}
    </HomeShell>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { getShiftState } from '../api/client';
import { FamilyCard, HomeShell, SectionTitle } from '../components/HomeShell';
import { TabBar, TabDef } from '../components/TabBar';
import { useVoiceMonitoring } from '../audio/useVoiceMonitoring';
import { VoiceCard } from '../components/VoiceCard';
import { useLocationSharing } from '../location/useLocationSharing';
import { Profile, ShiftState } from '../types';
import ChatScreen from './ChatScreen';
import ShiftDetailScreen from './ShiftDetailScreen';
import HoursTab from './caretaker/HoursTab';
import ShiftTab from './caretaker/ShiftTab';
import TasksTab from './caretaker/TasksTab';

type Props = { token: string; profile: Profile; onSignOut: () => void };
type Tab = 'shift' | 'tasks' | 'hours';

const TABS: TabDef<Tab>[] = [
  { key: 'shift', label: 'Shift', icon: 'clock-outline' },
  { key: 'tasks', label: 'Tasks', icon: 'format-list-checks' },
  { key: 'hours', label: 'Hours', icon: 'chart-box-outline' },
];

export default function CaretakerHome({ token, profile, onSignOut }: Props) {
  const [tab, setTab] = useState<Tab>('shift');
  const [state, setState] = useState<ShiftState | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [shiftId, setShiftId] = useState<number | null>(null); // the day's shift being looked at

  // This phone reports its position; the server compares it with the elder's phone.
  const sharing = useLocationSharing(token);
  // Short voice clips, only during a verified visit and only if both people agreed (the server decides).
  const voice = useVoiceMonitoring(token);

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
  }, [load, shiftId]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (chatOpen && profile.sponsor) {
    return <ChatScreen token={token} peer={profile.sponsor} onBack={() => setChatOpen(false)} />;
  }
  if (shiftId !== null) {
    return <ShiftDetailScreen token={token} shiftId={shiftId} onBack={() => setShiftId(null)} />;
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
          <VoiceCard voice={voice} />
          <ShiftTab
            token={token}
            state={state}
            error={error}
            sharing={sharing.status}
            sponsorName={profile.sponsor?.name ?? null}
            onChanged={load}
            onChat={() => setChatOpen(true)}
            onOpenShift={setShiftId}
          />
          <SectionTitle>People you work with</SectionTitle>
          <FamilyCard
            profile={{ ...profile, caretakers: profile.caretakers.filter((c) => c.email !== profile.email) }}
          />
        </>
      )}
      {tab === 'tasks' && <TasksTab token={token} />}
      {tab === 'hours' && <HoursTab token={token} onOpenShift={setShiftId} />}
    </HomeShell>
  );
}

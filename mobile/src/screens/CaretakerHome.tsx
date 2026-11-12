import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { getHours, getShiftState, getTasks } from '../api/client';
import { useVoiceMonitoring } from '../audio/useVoiceMonitoring';
import { HomeShell } from '../components/HomeShell';
import { TabBar, TabDef } from '../components/TabBar';
import { Toast } from '../components/ui';
import { VoiceCard } from '../components/VoiceCard';
import { useLocationSharing } from '../location/useLocationSharing';
import { flush, loadQueue, startAutoSync } from '../offline/taskQueue';
import { usePushTap } from '../push';
import { t } from '../strings';
import { Profile, ShiftState } from '../types';
import ChatScreen from './ChatScreen';
import ShiftDetailScreen from './ShiftDetailScreen';
import FirstAidTab, { FirstAidChat } from './caretaker/FirstAidTab';
import HoursTab from './caretaker/HoursTab';
import ShiftTab, { ShiftActionBar, useShiftAction } from './caretaker/ShiftTab';
import TasksTab from './caretaker/TasksTab';

type Props = { token: string; profile: Profile; onSignOut: () => void };
type Tab = 'shift' | 'tasks' | 'hours' | 'firstaid';

const TABS: TabDef<Tab>[] = [
  { key: 'shift', label: t.tabs.shift, icon: 'home' },
  { key: 'tasks', label: t.tabs.tasks, icon: 'tasks' },
  { key: 'hours', label: t.tabs.hours, icon: 'clock' },
  { key: 'firstaid', label: t.tabs.firstAid, icon: 'firstAid' },
];

export type Notice = { message: string; actionLabel?: string; onAction?: () => void };

export default function CaretakerHome({ token, profile, onSignOut }: Props) {
  const [tab, setTab] = useState<Tab>('shift');
  const [state, setState] = useState<ShiftState | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [shiftId, setShiftId] = useState<number | null>(null); // the day's shift being looked at
  const [firstAid, setFirstAid] = useState<FirstAidChat>({ entries: [], lang: 'en' }); // kept while switching tabs
  const [askFocus, setAskFocus] = useState(false); // opened from the "What's happening?" bar
  const [notice, setNotice] = useState<Notice | null>(null);
  const [summary, setSummary] = useState<{ tasks: { done: number; total: number } | null; week: number | null }>({
    tasks: null,
    week: null,
  });
  const tokenRef = useRef(token);
  tokenRef.current = token;

  // This phone reports its position; the server compares it with the elder's phone.
  const sharing = useLocationSharing(token);
  // Short voice clips, only during a verified visit and only if both people agreed (the server decides).
  const voice = useVoiceMonitoring(token);

  const load = useCallback(async () => {
    try {
      setState(await getShiftState(token));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '');
    }
  }, [token]);

  // The two numbers on the Today tiles. Failures leave a dash; the tabs themselves show the errors.
  const loadSummary = useCallback(async () => {
    const [tasks, hours] = await Promise.allSettled([getTasks(token), getHours(token)]);
    setSummary({
      tasks: tasks.status === 'fulfilled' ? { done: tasks.value.filter((x) => x.is_done).length, total: tasks.value.length } : null,
      week: hours.status === 'fulfilled' ? hours.value.week : null,
    });
  }, [token]);

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load, shiftId]);

  useEffect(() => {
    if (tab !== 'shift') return;
    loadSummary();
    const id = setInterval(loadSummary, 30000);
    return () => clearInterval(id);
  }, [tab, loadSummary]);

  // Task changes made offline are kept on the phone and sent when the server is reachable again.
  useEffect(() => {
    loadQueue().then(() => flush(token));
    return startAutoSync(() => tokenRef.current);
  }, [token]);

  const notify = useCallback((message: string) => setNotice({ message }), []);
  const hide = useCallback(() => setNotice(null), []);
  const action = useShiftAction(token, load, notify);

  // Tapping a notification: a message opens the family chat, an emergency opens Today (with its banner).
  usePushTap((tap) => {
    setShiftId(null);
    if (tap.type === 'chat') setChatOpen(true);
    else {
      setChatOpen(false);
      setTab('shift');
      load();
    }
  });

  async function refresh() {
    setRefreshing(true);
    await Promise.all([load(), loadSummary(), flush(token)]);
    setRefreshing(false);
  }

  if (chatOpen && profile.sponsor) {
    return <ChatScreen token={token} peer={profile.sponsor} onBack={() => setChatOpen(false)} />;
  }
  if (shiftId !== null) {
    return <ShiftDetailScreen token={token} shiftId={shiftId} onBack={() => setShiftId(null)} />;
  }

  const go = (next: Tab) => {
    setAskFocus(false);
    setTab(next);
  };
  const tabBar = <TabBar tabs={TABS} active={tab} onChange={go} />;
  if (tab === 'firstaid') {
    return <FirstAidTab token={token} chat={firstAid} onChange={setFirstAid} footer={tabBar} autoFocus={askFocus} />;
  }

  return (
    <HomeShell
      profile={profile}
      onSignOut={onSignOut}
      title={tab === 'tasks' ? t.tabs.tasks : tab === 'hours' ? t.tabs.hours : undefined}
      footer={
        <View>
          {tab === 'shift' && <ShiftActionBar state={state} action={action} />}
          {tabBar}
        </View>
      }
      overlay={notice && <Toast key={notice.message} {...notice} onHide={hide} />}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {tab === 'shift' && (
        <ShiftTab
          state={state}
          error={error}
          sharing={sharing.status}
          sponsorName={profile.sponsor?.name ?? null}
          tasks={summary.tasks}
          weekMinutes={summary.week}
          onRetry={load}
          onChat={() => setChatOpen(true)}
          onOpenShift={setShiftId}
          onAsk={() => {
            setAskFocus(true);
            setTab('firstaid');
          }}
          onTasks={() => go('tasks')}
          onHours={() => go('hours')}
          voiceCard={<VoiceCard voice={voice} />}
        />
      )}
      {tab === 'tasks' && <TasksTab token={token} caretaker={profile.name} onNotice={setNotice} />}
      {tab === 'hours' && <HoursTab token={token} onOpenShift={setShiftId} />}
    </HomeShell>
  );
}

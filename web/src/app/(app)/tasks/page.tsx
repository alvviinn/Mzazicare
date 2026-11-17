'use client';

import { ClipboardCheck, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ProofPhoto } from '@/components/ProofPhoto';
import { Empty, ErrorNote, Loading, PageHead, Row, Section, Segmented } from '@/components/ui';
import { getTaskHistory } from '@/lib/api';
import { useToken } from '@/lib/auth';
import { fmtDay, fmtTime } from '@/lib/format';
import { TaskRecord } from '@/lib/types';

const RANGES = [7, 30, 90];

// Every task the caretakers ticked off, newest first, grouped by day, each with its proof photo.
export default function TaskHistoryPage() {
  const token = useToken();
  const [days, setDays] = useState(30);
  const [items, setItems] = useState<TaskRecord[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError('');
    getTaskHistory(token, days)
      .then((h) => !cancelled && setItems(h.items))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Could not load the task history.'));
    return () => {
      cancelled = true;
    };
  }, [token, days]);

  const groups: { day: string; items: TaskRecord[] }[] = [];
  for (const r of items ?? []) {
    const day = fmtDay(r.done_at);
    if (groups[groups.length - 1]?.day !== day) groups.push({ day, items: [] });
    groups[groups.length - 1].items.push(r);
  }

  return (
    <>
      <PageHead
        kicker={items ? `${items.length} task${items.length === 1 ? '' : 's'} done in the last ${days} days` : `Last ${days} days`}
        title="Task history"
        right={<Segmented label="Period" options={RANGES.map((d) => ({ key: d, label: `${d} days` }))} value={days} onChange={setDays} />}
      />
      <ErrorNote message={error} />
      {items === null && !error && <Loading label="Loading task history…" />}
      {items !== null && groups.length === 0 && (
        <div className="card">
          <Empty icon={ClipboardCheck} title={`No tasks done in the last ${days} days`}>
            Each task the caretaker ticks off shows here with its photo.
          </Empty>
        </div>
      )}
      {groups.map((g) => (
        <section key={g.day}>
          <Section
            title={
              <>
                {g.day} <span className="caption">· {g.items.length} done</span>
              </>
            }
          />
          <div className="card list">
            {g.items.map((r) => (
              <Row
                key={r.id}
                leading={<ProofPhoto completionId={r.id} caption={`${r.title} · ${r.caretaker} · ${fmtDay(r.done_at)} ${fmtTime(r.done_at)}`} size={64} />}
                title={r.title}
                subtitle={`Done ${fmtTime(r.done_at)} by ${r.caretaker}${r.assigned_by ? ` · set by ${r.assigned_by}` : ' · their own task'}${r.recurring ? ' · every working day' : ''}`}
              />
            ))}
          </div>
        </section>
      ))}
      <p className="caption note with-icon">
        <ShieldCheck className="icon-xs" aria-hidden />A caretaker can only tick a task off while they are with your loved one, and must take a photo to do it.
      </p>
    </>
  );
}

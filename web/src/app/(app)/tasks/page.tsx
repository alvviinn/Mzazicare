'use client';

import { useEffect, useState } from 'react';
import { ProofPhoto } from '@/components/ProofPhoto';
import { ErrorNote, Loading, PageHead } from '@/components/ui';
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
        title="Task history"
        sub={items ? `Last ${days} days · ${items.length} task${items.length === 1 ? '' : 's'} done` : `Last ${days} days`}
        right={
          <div className="ranges">
            {RANGES.map((d) => (
              <button key={d} className={days === d ? '' : 'secondary'} onClick={() => setDays(d)} aria-pressed={days === d}>
                {d} days
              </button>
            ))}
          </div>
        }
      />
      <ErrorNote message={error} />
      {items === null && !error && <Loading label="Loading task history…" />}
      {items !== null && groups.length === 0 && (
        <div className="card muted" style={{ marginTop: 18 }}>
          No tasks were done in the last {days} days.
        </div>
      )}
      {groups.map((g) => (
        <section key={g.day}>
          <h2>
            {g.day} <span className="muted small">· {g.items.length} done</span>
          </h2>
          <div className="card divided">
            {g.items.map((r) => (
              <div className="row" key={r.id}>
                <ProofPhoto completionId={r.id} caption={`${r.title} · ${r.caretaker} · ${fmtDay(r.done_at)} ${fmtTime(r.done_at)}`} size={64} />
                <div className="grow">
                  <b>{r.title}</b>
                  <div className="muted small">
                    Done {fmtTime(r.done_at)} by {r.caretaker}
                    {r.assigned_by ? ` · set by ${r.assigned_by}` : ' · their own task'}
                    {r.recurring ? ' · every working day' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
      <p className="muted small">
        A caretaker can only tick a task off while they are with the elderly person, and must take a photo to do it.
      </p>
    </>
  );
}

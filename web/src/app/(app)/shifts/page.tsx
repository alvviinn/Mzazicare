'use client';

import { PageHead, ShiftTable } from '@/components/ui';
import { getShifts } from '@/lib/api';
import { usePolling } from '@/lib/auth';
import { fmtDuration } from '@/lib/format';

// Every day's shift for the last 30 days. A shift is one day: breaks do not end it.
export default function ShiftsPage() {
  const { data: shifts, error } = usePolling((t) => getShifts(t, 30), 20000);
  if (!shifts) return <p className="muted">{error || 'Loading…'}</p>;
  const total = shifts.reduce((n, s) => n + s.minutes, 0);

  return (
    <>
      <PageHead
        title="Shifts"
        sub={`Last 30 days · ${shifts.length} day${shifts.length === 1 ? '' : 's'} · ${fmtDuration(total)} active in total`}
      />
      <div className="card" style={{ marginTop: 18 }}>
        <ShiftTable shifts={shifts} />
        <p className="muted small" style={{ marginBottom: 0 }}>
          One shift per day. Stepping out is a break and the same shift continues when they return. Click a day for the full timeline.
        </p>
      </div>
    </>
  );
}

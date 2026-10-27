'use client';

import { FormEvent, useState } from 'react';
import { ErrorNote, PageHead, Pill } from '@/components/ui';
import { addMedicine, addMember, deleteMedicine } from '@/lib/api';
import { useAuth, useToken } from '@/lib/auth';
import { useDashboard } from '@/lib/dashboard';
import { Dashboard, Member } from '@/lib/types';

function MemberList({ title, list }: { title: string; list: Member[] }) {
  return (
    <div className="card divided">
      <h3>{title}</h3>
      {list.length === 0 && <span className="muted">Nobody added yet.</span>}
      {list.map((m) => (
        <div className="row" key={m.email}>
          <span className="avatar">{(m.name ?? m.email).charAt(0).toUpperCase()}</span>
          <div className="grow">
            <b>{m.name ?? m.email}</b>
            {m.name && <div className="muted small">{m.email}</div>}
          </div>
          <Pill tone={m.status === 'active' ? 'good' : 'quiet'}>
            {m.status === 'active' ? 'Linked' : 'Invited, waiting for them to register'}
          </Pill>
        </div>
      ))}
    </div>
  );
}

function AddPerson({ role, title, hint, onChanged }: { role: 'caretaker' | 'elderly'; title: string; hint: string; onChanged: () => Promise<void> }) {
  const token = useToken();
  const { refreshProfile } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
    setError('');
    setDone('');
    setBusy(true);
    try {
      await addMember(token, email.trim(), role);
      setDone(`${email.trim()} added.`);
      setEmail('');
      await Promise.all([onChanged(), refreshProfile()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h3>{title}</h3>
      <p className="muted small" style={{ margin: '4px 0 0' }}>{hint}</p>
      <label htmlFor={`email-${role}`}>Email</label>
      <input id={`email-${role}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
      <ErrorNote message={error} />
      {done && <p className="ok">{done}</p>}
      <p style={{ marginBottom: 0 }}>
        <button type="submit" disabled={busy}>
          {busy ? 'Adding…' : 'Add'}
        </button>
      </p>
    </form>
  );
}

function Medicines({ dash, onChanged }: { dash: Dashboard; onChanged: () => Promise<void> }) {
  const token = useToken();
  const elders = dash.elderly;
  const [who, setWho] = useState(elders[0]?.email ?? '');
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [time, setTime] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!elders.length) {
    return <div className="card muted">Once an elderly person is linked to you, you can set their medicine reminders here.</div>;
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Enter the medicine name.');
    if (!/^\d{1,2}:\d{2}$/.test(time.trim())) return setError('Enter the time like 08:00 or 20:30.');
    setError('');
    setBusy(true);
    try {
      await addMedicine(token, { elderly_email: who || elders[0].email, name: name.trim(), dose: dose.trim(), time: time.trim() });
      setName('');
      setDose('');
      setTime('');
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number, label: string) {
    if (!window.confirm(`Remove the reminder for ${label}?`)) return;
    try {
      await deleteMedicine(token, id);
    } finally {
      await onChanged();
    }
  }

  return (
    <div className="grid two">
      <div className="card divided">
        <h3>Reminders</h3>
        {dash.medicines.items.length === 0 && <span className="muted">No reminders yet.</span>}
        {dash.medicines.items.map((m) => (
          <div className="row" key={m.id}>
            <div className="grow">
              <b>
                {m.name}
                {m.dose ? ` · ${m.dose}` : ''}
              </b>
              <div className="muted small">
                {m.elderly} · every day at {m.time}
              </div>
            </div>
            <button className="danger" onClick={() => remove(m.id, `${m.name} (${m.elderly})`)}>
              Remove
            </button>
          </div>
        ))}
      </div>
      <form className="card" onSubmit={add}>
        <h3>Add a medicine reminder</h3>
        <p className="muted small" style={{ margin: '4px 0 0' }}>
          They will see it on their home screen each day and can tap &quot;I took it&quot;.
        </p>
        {elders.length > 1 && (
          <>
            <label htmlFor="who">For</label>
            <select id="who" value={who} onChange={(e) => setWho(e.target.value)}>
              {elders.map((el) => (
                <option key={el.email} value={el.email}>
                  {el.name}
                </option>
              ))}
            </select>
          </>
        )}
        <label htmlFor="med">Medicine</label>
        <input id="med" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Blood pressure tablet" />
        <label htmlFor="dose">Dose (optional)</label>
        <input id="dose" value={dose} onChange={(e) => setDose(e.target.value)} placeholder="e.g. 1 tablet" />
        <label htmlFor="time">Time (24-hour)</label>
        <input id="time" value={time} onChange={(e) => setTime(e.target.value)} placeholder="08:00" />
        <ErrorNote message={error} />
        <p style={{ marginBottom: 0 }}>
          <button type="submit" disabled={busy}>
            {busy ? 'Adding…' : 'Add reminder'}
          </button>
        </p>
      </form>
    </div>
  );
}

export default function PeoplePage() {
  const { profile } = useAuth();
  const { dash, reload } = useDashboard();
  if (!profile) return null;

  return (
    <>
      <PageHead title="People" sub="Your care circle and the medicine reminders for your loved one." />

      <h2>Your care circle</h2>
      <div className="grid two">
        <MemberList title="Caretakers" list={profile.caretakers} />
        <MemberList title="Elderly" list={profile.elderly} />
      </div>

      <h2>Medicine reminders</h2>
      {dash ? <Medicines dash={dash} onChanged={reload} /> : <p className="muted">Loading…</p>}

      <h2>Add people</h2>
      <div className="grid two">
        <AddPerson
          role="caretaker"
          title="Add a caretaker"
          hint="If they already have an account it becomes a caretaker account. Otherwise it is set up when they register."
          onChanged={reload}
        />
        <AddPerson
          role="elderly"
          title="Add an elderly person"
          hint="Their account will see their own care home screen, linked to you and your caretakers."
          onChanged={reload}
        />
      </div>
    </>
  );
}

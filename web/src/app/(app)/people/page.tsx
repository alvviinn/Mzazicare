'use client';

import { Circle, CircleCheck, ClipboardPlus, HeartHandshake, Armchair, Pill as PillIcon, Plus, Repeat, Trash2, UserRoundPlus } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { ProofPhoto } from '@/components/ProofPhoto';
import { Avatar, Dialog, Empty, ErrorNote, Loading, PageHead, Pill, Row, Section, Segmented } from '@/components/ui';
import { addMedicine, addMember, assignTask, deleteMedicine, deleteTask } from '@/lib/api';
import { useAuth, useToken } from '@/lib/auth';
import { useDashboard } from '@/lib/dashboard';
import { fmtTime } from '@/lib/format';
import { Dashboard, Member } from '@/lib/types';

type Open = 'person' | 'medicine' | 'task' | null;

function MemberList({ title, Icon, list }: { title: string; Icon: typeof HeartHandshake; list: Member[] }) {
  return (
    <div className="card list">
      <h3 className="card-title">
        <Icon className="icon" aria-hidden />
        {title}
      </h3>
      {list.length === 0 && <p className="caption">Nobody added yet.</p>}
      {list.map((m) => (
        <Row
          key={m.email}
          leading={<Avatar name={m.name ?? m.email} size={44} />}
          title={m.name ?? m.email}
          subtitle={m.name ? m.email : undefined}
          trailing={<Pill tone={m.status === 'active' ? 'success' : 'secondary'}>{m.status === 'active' ? 'Linked' : 'Invited'}</Pill>}
        />
      ))}
      {list.some((m) => m.status !== 'active') && <p className="caption">Invited people are linked as soon as they register with that email.</p>}
    </div>
  );
}

function AddPerson({ onChanged, onDone }: { onChanged: () => Promise<void>; onDone: () => void }) {
  const token = useToken();
  const { refreshProfile } = useAuth();
  const [role, setRole] = useState<'caretaker' | 'elderly'>('caretaker');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
    setError('');
    setBusy(true);
    try {
      await addMember(token, email.trim(), role);
      await Promise.all([onChanged(), refreshProfile()]);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="form">
      <Segmented
        label="Who are you adding?"
        options={[
          { key: 'caretaker', label: 'Caretaker' },
          { key: 'elderly', label: 'Elder' },
        ]}
        value={role}
        onChange={setRole}
      />
      <p className="caption">
        {role === 'caretaker'
          ? 'If they already have an account it becomes a caretaker account. Otherwise it is set up when they register.'
          : 'Their account will see their own care home screen, linked to you and your caretakers.'}
      </p>
      <label htmlFor="person-email">Email</label>
      <input id="person-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoFocus />
      <ErrorNote message={error} />
      <button type="submit" className="btn primary block" disabled={busy} aria-busy={busy}>
        <UserRoundPlus className="icon" aria-hidden />
        {busy ? 'Adding…' : role === 'caretaker' ? 'Add caretaker' : 'Add elder'}
      </button>
    </form>
  );
}

function AddMedicine({ dash, onChanged, onDone }: { dash: Dashboard; onChanged: () => Promise<void>; onDone: () => void }) {
  const token = useToken();
  const elders = dash.elderly;
  const [who, setWho] = useState(elders[0]?.email ?? '');
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [time, setTime] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Enter the medicine name.');
    if (!/^\d{1,2}:\d{2}$/.test(time.trim())) return setError('Enter the time like 08:00 or 20:30.');
    setError('');
    setBusy(true);
    try {
      await addMedicine(token, { elderly_email: who || elders[0].email, name: name.trim(), dose: dose.trim(), time: time.trim() });
      await onChanged();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={add} className="form">
      <p className="caption">They will see it on their home screen each day and can tap &quot;I took it&quot;.</p>
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
      <input id="med" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Blood pressure tablet" autoFocus />
      <div className="form-row">
        <div>
          <label htmlFor="dose">Dose (optional)</label>
          <input id="dose" value={dose} onChange={(e) => setDose(e.target.value)} placeholder="1 tablet" />
        </div>
        <div>
          <label htmlFor="time">Time (24-hour)</label>
          <input id="time" value={time} onChange={(e) => setTime(e.target.value)} placeholder="08:00" inputMode="numeric" />
        </div>
      </div>
      <ErrorNote message={error} />
      <button type="submit" className="btn primary block" disabled={busy} aria-busy={busy}>
        <PillIcon className="icon" aria-hidden />
        {busy ? 'Adding…' : 'Add reminder'}
      </button>
    </form>
  );
}

function AssignTask({ dash, onChanged, onDone }: { dash: Dashboard; onChanged: () => Promise<void>; onDone: () => void }) {
  const token = useToken();
  const carers = dash.caretakers;
  const [who, setWho] = useState(carers[0]?.email ?? '');
  const [title, setTitle] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError('Write the task first.');
    setError('');
    setBusy(true);
    try {
      await assignTask(token, { caretaker_email: who || carers[0].email, title: title.trim(), recurring });
      await onChanged();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={add} className="form">
      <p className="caption">It appears on their task list. To tick it off they must be with your loved one and take a photo, which you can see here and in Task history.</p>
      {carers.length > 1 && (
        <>
          <label htmlFor="carer">For</label>
          <select id="carer" value={who} onChange={(e) => setWho(e.target.value)}>
            {carers.map((c) => (
              <option key={c.email} value={c.email}>
                {c.name}
              </option>
            ))}
          </select>
        </>
      )}
      <label htmlFor="task">Task</label>
      <input id="task" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Take her for a short walk" autoFocus />
      <Segmented
        label="How often"
        options={[
          { key: 'once', label: 'Once' },
          { key: 'repeat', label: 'Every working day' },
        ]}
        value={recurring ? 'repeat' : 'once'}
        onChange={(k) => setRecurring(k === 'repeat')}
      />
      <ErrorNote message={error} />
      <button type="submit" className="btn primary block" disabled={busy} aria-busy={busy}>
        <ClipboardPlus className="icon" aria-hidden />
        {busy ? 'Assigning…' : 'Assign task'}
      </button>
    </form>
  );
}

export default function PeoplePage() {
  const token = useToken();
  const { profile } = useAuth();
  const { dash, reload } = useDashboard();
  const [open, setOpen] = useState<Open>(null);
  const [error, setError] = useState('');
  if (!profile) return null;
  const close = () => setOpen(null);

  async function remove(kind: 'medicine' | 'task', id: number, label: string) {
    if (!window.confirm(kind === 'medicine' ? `Remove the reminder for ${label}?` : `Remove the task "${label}"?`)) return;
    setError('');
    try {
      await (kind === 'medicine' ? deleteMedicine(token, id) : deleteTask(token, id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove it. Try again.');
    } finally {
      await reload();
    }
  }

  const mine = dash ? dash.today.chores.filter((t) => t.assigned_by_me) : [];

  return (
    <>
      <PageHead
        kicker="Your care circle"
        title="People"
        right={
          <button type="button" className="btn primary" onClick={() => setOpen('person')}>
            <UserRoundPlus className="icon" aria-hidden />
            Add a person
          </button>
        }
      />
      <ErrorNote message={error} />

      <div className="grid two">
        <MemberList title="Caretakers" Icon={HeartHandshake} list={profile.caretakers} />
        <MemberList title="Elderly" Icon={Armchair} list={profile.elderly} />
      </div>

      <div className="grid two">
        <div id="medicines">
          <Section
            title="Medicine reminders"
            action={
              dash?.elderly.length ? (
                <button type="button" className="btn soft small" onClick={() => setOpen('medicine')}>
                  <Plus className="icon" aria-hidden />
                  Add reminder
                </button>
              ) : undefined
            }
          />
          <div className="card list">
            {!dash ? (
              <Loading label="Loading…" />
            ) : !dash.elderly.length ? (
              <Empty icon={PillIcon} title="No elder linked yet">
                Once an elderly person is linked to you, you can set their medicine reminders here.
              </Empty>
            ) : dash.medicines.items.length === 0 ? (
              <Empty icon={PillIcon} title="No reminders yet">
                Add one and it shows on their phone each day.
              </Empty>
            ) : (
              dash.medicines.items.map((m) => (
                <Row
                  key={m.id}
                  leading={
                    <span className="row-icon">
                      <PillIcon className="icon" aria-hidden />
                    </span>
                  }
                  title={m.dose ? `${m.name} · ${m.dose}` : m.name}
                  subtitle={`${m.elderly} · every day at ${m.time}`}
                  trailing={
                    <button type="button" className="icon-btn danger" onClick={() => remove('medicine', m.id, `${m.name} (${m.elderly})`)} aria-label={`Remove reminder ${m.name}`} title="Remove">
                      <Trash2 className="icon" aria-hidden />
                    </button>
                  }
                />
              ))
            )}
          </div>
        </div>

        <div>
          <Section
            title="Tasks you set today"
            action={
              dash?.caretakers.length ? (
                <button type="button" className="btn soft small" onClick={() => setOpen('task')}>
                  <Plus className="icon" aria-hidden />
                  Give a task
                </button>
              ) : undefined
            }
          />
          <div className="card list">
            {!dash ? (
              <Loading label="Loading…" />
            ) : !dash.caretakers.length ? (
              <Empty icon={ClipboardPlus} title="No caretaker linked yet">
                Once a caretaker is linked to you, you can give them tasks here.
              </Empty>
            ) : mine.length === 0 ? (
              <Empty icon={ClipboardPlus} title="No tasks from you today">
                Give the caretaker a task and it appears on their list.
              </Empty>
            ) : (
              mine.map((t) => (
                <Row
                  key={t.id}
                  leading={
                    t.is_done ? (
                      <CircleCheck className="icon-m" style={{ color: 'var(--success)' }} aria-label="Done" />
                    ) : (
                      <Circle className="icon-m" style={{ color: 'var(--ink-muted)' }} aria-label="Not done" />
                    )
                  }
                  title={t.description}
                  subtitle={
                    <>
                      {t.caretaker} · {t.recurring ? <><Repeat className="icon-xs inline" aria-hidden /> every working day</> : 'once'}
                      {t.done_at ? ` · done ${fmtTime(t.done_at)}` : ''}
                    </>
                  }
                  trailing={
                    <span className="row-end">
                      {t.completion_id !== null && <ProofPhoto completionId={t.completion_id} caption={`${t.description} · ${t.caretaker}`} size={48} />}
                      <button type="button" className="icon-btn danger" onClick={() => remove('task', t.id, t.description)} aria-label={`Remove task ${t.description}`} title="Remove">
                        <Trash2 className="icon" aria-hidden />
                      </button>
                    </span>
                  }
                />
              ))
            )}
          </div>
        </div>
      </div>

      <Dialog open={open === 'person'} onClose={close} title="Add a person">
        <AddPerson onChanged={reload} onDone={close} />
      </Dialog>
      {dash && (
        <>
          <Dialog open={open === 'medicine'} onClose={close} title="Medicine reminder">
            <AddMedicine dash={dash} onChanged={reload} onDone={close} />
          </Dialog>
          <Dialog open={open === 'task'} onClose={close} title="Task for the caretaker">
            <AssignTask dash={dash} onChanged={reload} onDone={close} />
          </Dialog>
        </>
      )}
    </>
  );
}

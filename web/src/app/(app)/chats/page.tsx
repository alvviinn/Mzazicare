'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { PageHead } from '@/components/ui';
import { getMessages, sendMessage } from '@/lib/api';
import { useToken } from '@/lib/auth';
import { useDashboard } from '@/lib/dashboard';
import { fmtTime } from '@/lib/format';
import { ChatMessage, ChatPerson } from '@/lib/types';

// Separate private chats: one with each caretaker and one with each elderly person.
export default function ChatsPage() {
  const { dash, reload } = useDashboard();
  const [peer, setPeer] = useState<ChatPerson | null>(null);

  if (!dash) return <p className="muted">Loading…</p>;
  const people = [...dash.caretakers, ...dash.elderly];
  if (!people.length) {
    return (
      <>
        <PageHead title="Chats" />
        <div className="card" style={{ marginTop: 18 }}>
          <h3>No chats yet</h3>
          <p className="muted">
            You can chat with your caretaker and your elderly loved one once they&apos;ve registered and been linked to you.{' '}
            <Link href="/people">Add people →</Link>
          </p>
        </div>
      </>
    );
  }

  const current = peer ?? people[0];
  return (
    <>
      <PageHead title="Chats" sub="Private conversations with each person in your care circle." />
      <div className="chat" style={{ marginTop: 18 }}>
        <div className="people">
          {dash.caretakers.length > 0 && <div className="muted small" style={{ padding: '10px 14px 4px' }}>Caretakers</div>}
          {dash.caretakers.map((p) => (
            <PersonButton key={p.email} p={p} on={p.email === current.email} onPick={() => setPeer(p)} />
          ))}
          {dash.elderly.length > 0 && <div className="muted small" style={{ padding: '10px 14px 4px' }}>Elderly</div>}
          {dash.elderly.map((p) => (
            <PersonButton key={p.email} p={p} on={p.email === current.email} onPick={() => setPeer(p)} />
          ))}
        </div>
        <Thread key={current.email} peer={current} onRead={reload} />
      </div>
    </>
  );
}

function PersonButton({ p, on, onPick }: { p: ChatPerson; on: boolean; onPick: () => void }) {
  return (
    <button className={`person${on ? ' on' : ''}`} onClick={onPick}>
      <span className="avatar">{p.name.charAt(0).toUpperCase()}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <b style={{ display: 'block' }}>{p.name}</b>
        <span className="muted small" style={{ wordBreak: 'break-all' }}>{p.email}</span>
      </span>
      {p.unread > 0 && <span className="badge">{p.unread}</span>}
    </button>
  );
}

function Thread({ peer, onRead }: { peer: ChatPerson; onRead: () => Promise<void> }) {
  const token = useToken();
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const count = useRef(0);

  const load = useCallback(async () => {
    try {
      const m = await getMessages(token, peer.email);
      setMessages(m);
      setError('');
      if (peer.unread > 0) onRead(); // opening the chat marks their messages as read
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the messages.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, peer.email]);

  useEffect(() => {
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (messages && messages.length !== count.current) {
      count.current = messages.length;
      end.current?.scrollIntoView({ block: 'end' });
    }
  }, [messages]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const m = await sendMessage(token, peer.email, body);
      setMessages((prev) => [...(prev ?? []), m]);
      setText('');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the message.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="thread">
      <div className="row" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <span className="avatar">{peer.name.charAt(0).toUpperCase()}</span>
        <b>{peer.name}</b>
      </div>
      <div className="messages">
        {messages === null && <span className="muted">Loading…</span>}
        {messages?.length === 0 && <span className="muted">No messages yet. Say hello.</span>}
        {messages?.map((m) => (
          <div key={m.id} className={`msg${m.mine ? ' mine' : ''}`}>
            {m.body}
            <time>{fmtTime(m.created_at)}</time>
          </div>
        ))}
        <div ref={end} />
      </div>
      {error && <p className="error" style={{ padding: '0 16px' }}>{error}</p>}
      <form className="composer" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message" maxLength={1000} />
        <button type="submit" disabled={sending || !text.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

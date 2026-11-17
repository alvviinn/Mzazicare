'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowUp, MessageSquareText } from 'lucide-react';
import { FormEvent, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Avatar, Empty, ErrorNote, Loading, PageHead } from '@/components/ui';
import { getMessages, sendMessage } from '@/lib/api';
import { useToken } from '@/lib/auth';
import { useDashboard } from '@/lib/dashboard';
import { firstName, fmtTime } from '@/lib/format';
import { ChatMessage, ChatPerson } from '@/lib/types';

// Separate private chats: one with each caretaker and one with each elderly person.
// /chats?with=<email> opens that person's chat (the "Message" button on Home).
export default function ChatsPage() {
  return (
    <Suspense fallback={<Loading label="Loading chats…" />}>
      <Chats />
    </Suspense>
  );
}

function Chats() {
  const { dash, reload } = useDashboard();
  const wanted = useSearchParams().get('with');
  const [picked, setPicked] = useState<string | null>(wanted);

  if (!dash) return <Loading label="Loading chats…" />;
  const people = [...dash.caretakers, ...dash.elderly];
  if (!people.length) {
    return (
      <>
        <PageHead kicker="Your care circle" title="Chats" />
        <div className="card">
          <Empty icon={MessageSquareText} title="No chats yet">
            You can chat with your caretaker and your loved one once they&apos;ve registered and been linked to you. <Link href="/people">Add people</Link>
          </Empty>
        </div>
      </>
    );
  }

  const current = people.find((p) => p.email === picked) ?? people[0];
  return (
    <>
      <PageHead kicker="Private, one conversation per person" title="Chats" />
      {/* on a phone-width screen only one pane shows: the list, or the open conversation */}
      <div className={`chat${picked ? ' has-peer' : ''}`}>
        <div className="people" role="list" aria-label="People">
          {dash.caretakers.length > 0 && <div className="people-group caption">Caretakers</div>}
          {dash.caretakers.map((p) => (
            <PersonButton key={p.email} p={p} on={p.email === current.email} onPick={() => setPicked(p.email)} />
          ))}
          {dash.elderly.length > 0 && <div className="people-group caption">Elderly</div>}
          {dash.elderly.map((p) => (
            <PersonButton key={p.email} p={p} on={p.email === current.email} onPick={() => setPicked(p.email)} />
          ))}
        </div>
        <Thread key={current.email} peer={current} onRead={reload} onBack={() => setPicked(null)} />
      </div>
    </>
  );
}

function PersonButton({ p, on, onPick }: { p: ChatPerson; on: boolean; onPick: () => void }) {
  return (
    <button type="button" role="listitem" className={`person${on ? ' on' : ''}`} onClick={onPick} aria-current={on ? 'true' : undefined} aria-label={p.unread ? `${p.name}, ${p.unread} unread` : p.name}>
      <Avatar name={p.name} size={44} />
      <span className="grow">
        <span className="strong ellipsis">{p.name}</span>
        <span className="caption ellipsis">{p.email}</span>
      </span>
      {p.unread > 0 && <span className="badge">{p.unread}</span>}
    </button>
  );
}

function Thread({ peer, onRead, onBack }: { peer: ChatPerson; onRead: () => Promise<void>; onBack: () => void }) {
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
      <div className="thread-head">
        <button type="button" className="icon-btn back" onClick={onBack} aria-label="Back to people">
          <ArrowLeft className="icon" aria-hidden />
        </button>
        <Avatar name={peer.name} size={40} />
        <h2 className="strong">{peer.name}</h2>
      </div>
      <div className="messages" aria-live="polite">
        {messages === null && <Loading label="Loading messages…" />}
        {messages?.length === 0 && (
          <div className="say-hi">
            <Avatar name={peer.name} size={72} />
            <b className="heading">Say hi to {firstName(peer.name)}</b>
          </div>
        )}
        {messages?.map((m) => (
          <div key={m.id} className={`msg${m.mine ? ' mine' : ''}`}>
            {m.body}
            <time dateTime={m.created_at}>{fmtTime(m.created_at)}</time>
          </div>
        ))}
        <div ref={end} />
      </div>
      {error && (
        <div style={{ padding: '0 var(--m)' }}>
          <ErrorNote message={error} />
        </div>
      )}
      <form className="composer" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message" maxLength={1000} aria-label={`Message to ${peer.name}`} />
        <button type="submit" className="send" disabled={sending || !text.trim()} aria-label="Send message" aria-busy={sending}>
          {sending ? <span className="spinner on-primary" aria-hidden /> : <ArrowUp className="icon" aria-hidden />}
        </button>
      </form>
    </div>
  );
}

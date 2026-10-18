import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getMessages, sendMessage } from '../api/client';
import { fmtTime } from '../format';
import { colors, radius, spacing } from '../theme';
import { ChatMessage } from '../types';

type Props = { token: string; peer: { name: string; email: string }; onBack: () => void };

// One-to-one chat. New messages are picked up by polling every few seconds.
export default function ChatScreen({ token, peer, onBack }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      setMessages(await getMessages(token, peer.email));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load messages.');
    }
  }, [token, peer.email]);

  useEffect(() => {
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [load]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const m = await sendMessage(token, peer.email, body);
      setMessages((prev) => [...prev, m]);
      setText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Message not sent.');
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {peer.name}
        </Text>
        <View style={{ width: 48 }} />
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        style={styles.flex}
        contentContainerStyle={{ padding: spacing.md, flexGrow: 1, justifyContent: 'flex-end' }}
        data={[...messages].reverse()}
        inverted
        keyExtractor={(m) => String(m.id)}
        ListEmptyComponent={<Text style={styles.empty}>No messages yet. Say hello.</Text>}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.mine ? styles.mine : styles.theirs]}>
            <Text style={[styles.body, item.mine && { color: colors.onPrimary }]}>{item.body}</Text>
            <Text style={[styles.time, item.mine && { color: '#CFE5E0' }]}>{fmtTime(item.created_at)}</Text>
          </View>
        )}
      />

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Type a message"
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={2000}
        />
        <Pressable onPress={send} disabled={sending || !text.trim()} style={[styles.send, !text.trim() && { opacity: 0.5 }]}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl + spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { color: colors.primary, fontSize: 16, fontWeight: '600', width: 48 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text, flex: 1, textAlign: 'center' },
  error: { color: colors.danger, textAlign: 'center', padding: spacing.sm, fontSize: 13 },
  empty: { color: colors.textMuted, textAlign: 'center', transform: [{ scaleY: -1 }], marginTop: spacing.lg },
  bubble: { maxWidth: '80%', borderRadius: radius.lg, padding: spacing.sm + 4, marginBottom: spacing.sm },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  body: { fontSize: 15, color: colors.text },
  time: { fontSize: 11, color: colors.textMuted, marginTop: 2, alignSelf: 'flex-end' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
  },
  send: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12 },
  sendText: { color: colors.onPrimary, fontWeight: '600' },
});

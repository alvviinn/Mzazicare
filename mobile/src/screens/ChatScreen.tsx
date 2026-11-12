import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { getMessages, sendMessage } from '../api/client';
import { Icon } from '../components/Icon';
import { Avatar, haptic, Loading, PressScale, ScreenHeader } from '../components/ui';
import { fmtTime } from '../format';
import { NETWORK_ERROR } from '../net';
import { colors, icon, on, radius, space, text } from '../theme';
import { ChatMessage } from '../types';

type Props = { token: string; peer: { name: string; email: string }; onBack: () => void };

// One-to-one chat. New messages are picked up by polling every few seconds.
export default function ChatScreen({ token, peer, onBack }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const first = peer.name.split(' ')[0];

  const load = useCallback(async () => {
    try {
      setMessages(await getMessages(token, peer.email));
      setLoaded(true);
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
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    try {
      const m = await sendMessage(token, peer.email, body);
      setMessages((prev) => [...prev, m]);
      setDraft('');
      haptic.tap();
    } catch (e) {
      const why = e instanceof Error ? e.message : '';
      setError(why === NETWORK_ERROR ? "Not sent · you're offline. Your text is still here." : `Not sent. ${why}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title={peer.name} onBack={onBack} right={<Avatar name={peer.name} size={40} />} />

      {!!error && (
        <View style={styles.error} accessibilityLiveRegion="polite">
          <Icon name="alert" color={colors.error} />
          <Text style={[text.caption, { color: colors.error, flex: 1 }]}>{error}</Text>
        </View>
      )}

      <FlatList
        style={styles.flex}
        contentContainerStyle={styles.list}
        data={[...messages].reverse()}
        inverted
        keyExtractor={(m) => String(m.id)}
        ListEmptyComponent={
          loaded ? (
            <View style={styles.empty}>
              <Avatar name={peer.name} size={72} />
              <Text style={text.heading}>{`Say hi to ${first}`}</Text>
            </View>
          ) : (
            <View style={{ transform: [{ scaleY: -1 }] }}>
              <Loading label="Loading messages" lines={2} />
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.mine ? styles.mine : styles.theirs]}>
            <Text style={[text.body, item.mine && { color: on.secondary }]}>{item.body}</Text>
            <Text style={[text.caption, styles.time, item.mine && { color: on.secondary }]}>{fmtTime(item.created_at)}</Text>
          </View>
        )}
      />

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message"
          accessibilityLabel={`Message to ${peer.name}`}
          placeholderTextColor={colors.inkMuted}
          multiline
          maxLength={2000}
        />
        <PressScale
          onPress={send}
          disabled={sending || !draft.trim()}
          style={[styles.send, !draft.trim() && styles.sendOff]}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: sending || !draft.trim(), busy: sending }}
        >
          {sending ? <ActivityIndicator color={on.primary} /> : <Icon name="send" size={icon.m} color={!draft.trim() ? colors.inkMuted : on.primary} />}
        </PressScale>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  list: { padding: space.m, flexGrow: 1, justifyContent: 'flex-end' },
  error: { flexDirection: 'row', alignItems: 'center', gap: space.s, paddingHorizontal: space.m, paddingVertical: space.s, backgroundColor: colors.surface },
  empty: { alignItems: 'center', gap: space.s, transform: [{ scaleY: -1 }], marginTop: space.xl },
  bubble: { maxWidth: '80%', borderRadius: radius.card, paddingHorizontal: space.m, paddingVertical: space.s, marginBottom: space.s },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.secondary },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface },
  time: { alignSelf: 'flex-end' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', padding: space.m, paddingTop: space.s, gap: space.s },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 56,
    borderRadius: radius.card,
    paddingHorizontal: space.m,
    paddingVertical: space.m,
    fontFamily: text.body.fontFamily,
    fontSize: text.body.fontSize,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  send: { backgroundColor: colors.primary, borderRadius: radius.pill, width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  sendOff: { backgroundColor: colors.line },
});

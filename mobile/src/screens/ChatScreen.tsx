import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { getMessages, sendMessage } from '../api/client';
import { Icon } from '../components/Icon';
import { Avatar, haptic, Loading, PressScale, ScreenHeader } from '../components/ui';
import { fmtTime } from '../format';
import { NETWORK_ERROR } from '../net';
import { colors, fonts, iconSize, radius, spacing, text, type } from '../theme';
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
          <Icon name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={[text.small, { color: colors.danger, flex: 1 }]}>{error}</Text>
        </View>
      )}

      <FlatList
        style={styles.flex}
        contentContainerStyle={{ padding: spacing.md, flexGrow: 1, justifyContent: 'flex-end' }}
        data={[...messages].reverse()}
        inverted
        keyExtractor={(m) => String(m.id)}
        ListEmptyComponent={
          loaded ? (
            <View style={styles.empty}>
              <Avatar name={peer.name} size={72} />
              <Text style={[text.h2, { marginTop: spacing.sm }]}>{`Say hi to ${first}`}</Text>
            </View>
          ) : (
            <View style={{ transform: [{ scaleY: -1 }] }}>
              <Loading label="Loading messages" lines={2} />
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.mine ? styles.mine : styles.theirs]}>
            <Text style={[text.body, item.mine && { color: colors.onPrimary }]}>{item.body}</Text>
            <Text style={[styles.time, item.mine && { color: colors.primarySoft }]}>{fmtTime(item.created_at)}</Text>
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
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={2000}
        />
        <PressScale
          onPress={send}
          disabled={sending || !draft.trim()}
          scaleTo={0.9}
          style={[styles.send, !draft.trim() && styles.sendOff]}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: sending || !draft.trim(), busy: sending }}
        >
          {sending ? <ActivityIndicator color={colors.onPrimary} /> : <Icon name="arrow-up" size={iconSize.inline} color={colors.onPrimary} />}
        </PressScale>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  error: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.dangerSoft },
  empty: { alignItems: 'center', transform: [{ scaleY: -1 }], marginTop: spacing.xl },
  bubble: { maxWidth: '80%', borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.ms, marginBottom: spacing.sm },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderBottomLeftRadius: 6 },
  time: { fontFamily: fonts.body, fontSize: type.caption, color: colors.textMuted, marginTop: 2, alignSelf: 'flex-end' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', padding: spacing.md, paddingTop: spacing.sm, gap: spacing.sm },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 52,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.ms + 2,
    fontFamily: fonts.body,
    fontSize: type.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  send: { backgroundColor: colors.primary, borderRadius: 26, width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  sendOff: { backgroundColor: colors.textDisabled },
});

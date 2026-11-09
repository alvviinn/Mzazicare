import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { askFirstAid } from '../../api/client';
import { Icon } from '../../components/Icon';
import { colors, radius, spacing } from '../../theme';
import { FirstAidReply } from '../../types';

export type FirstAidEntry =
  | { id: number; from: 'me'; text: string }
  | { id: number; from: 'guide'; reply: FirstAidReply };

export type FirstAidChat = { entries: FirstAidEntry[]; lang: 'en' | 'sw' };

type Props = {
  token: string;
  chat: FirstAidChat; // kept by the parent so switching tabs does not lose the conversation
  onChange: (chat: FirstAidChat) => void;
  footer: React.ReactNode;
};

const QUICK: Record<'en' | 'sw', { label: string; topic: string }[]> = {
  en: [
    { label: 'Not breathing', topic: 'cpr' },
    { label: 'Choking', topic: 'choking_severe' },
    { label: 'Chest pain', topic: 'heart_attack' },
    { label: 'Stroke signs', topic: 'stroke' },
    { label: 'A fall', topic: 'fall' },
    { label: 'Heavy bleeding', topic: 'severe_bleeding' },
    { label: 'Burn', topic: 'burns' },
    { label: 'Low sugar', topic: 'low_blood_sugar' },
    { label: 'Fit / seizure', topic: 'seizure' },
    { label: 'Fainted', topic: 'fainting' },
  ],
  sw: [
    { label: 'Hapumui', topic: 'cpr' },
    { label: 'Amekabwa', topic: 'choking_severe' },
    { label: 'Maumivu ya kifua', topic: 'heart_attack' },
    { label: 'Dalili za kiharusi', topic: 'stroke' },
    { label: 'Ameanguka', topic: 'fall' },
    { label: 'Damu nyingi', topic: 'severe_bleeding' },
    { label: 'Kuungua', topic: 'burns' },
    { label: 'Sukari imeshuka', topic: 'low_blood_sugar' },
    { label: 'Kifafa', topic: 'seizure' },
    { label: 'Amezirai', topic: 'fainting' },
  ],
};

const WORDS = {
  en: {
    title: 'First aid guide',
    call: 'Call 999',
    intro: 'Describe what is happening, in English or Kiswahili, or tap a situation below. In an emergency, call 999 or 112 first.',
    placeholder: 'e.g. "she fell and hit her head"',
    steps: 'What to do',
    avoid: 'Do not',
    callNow: 'Call 999 now',
    source: 'Based on Red Cross / IFRC first-aid guidelines. Not a diagnosis.',
    thinking: 'Finding the right steps…',
  },
  sw: {
    title: 'Mwongozo wa huduma ya kwanza',
    call: 'Piga 999',
    intro: 'Eleza kinachoendelea, kwa Kiswahili au Kiingereza, au gusa hali mojawapo hapa chini. Wakati wa dharura, piga 999 au 112 kwanza.',
    placeholder: 'mf. "ameanguka akagonga kichwa"',
    steps: 'Cha kufanya',
    avoid: 'Usifanye',
    callNow: 'Piga 999 sasa',
    source: 'Kwa mujibu wa miongozo ya huduma ya kwanza ya Red Cross / IFRC. Si uchunguzi wa daktari.',
    thinking: 'Natafuta hatua sahihi…',
  },
};

const call999 = () => Linking.openURL('tel:999');

// A caretaker asks for first-aid help and gets steps from the vetted guide (see ml/firstaid).
export default function FirstAidTab({ token, chat, onChange, footer }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const nextId = useRef(chat.entries.length + 1);
  const w = WORDS[chat.lang];
  const lastReply = [...chat.entries].reverse().find((e) => e.from === 'guide') as
    | { reply: FirstAidReply }
    | undefined;

  async function ask(body: { message?: string; topic?: string }, shown: string) {
    if (busy) return;
    const mine: FirstAidEntry = { id: nextId.current++, from: 'me', text: shown };
    let entries = [...chat.entries, mine];
    onChange({ ...chat, entries });
    setBusy(true);
    setError('');
    try {
      const awaiting = lastReply?.reply.followup && lastReply.reply.topic ? lastReply.reply.topic : null;
      const reply = await askFirstAid(token, { ...body, awaiting, lang: body.topic ? chat.lang : undefined });
      entries = [...entries, { id: nextId.current++, from: 'guide', reply }];
      onChange({ entries, lang: body.message ? reply.lang : chat.lang }); // follow the language they typed in
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not get an answer. Call 999 or 112 if it is an emergency.');
    } finally {
      setBusy(false);
    }
  }

  function send() {
    const message = text.trim();
    if (!message) return;
    setText('');
    ask({ message }, message);
  }

  const toggleLang = () => onChange({ ...chat, lang: chat.lang === 'en' ? 'sw' : 'en' });

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {w.title}
        </Text>
        <Pressable onPress={toggleLang} style={styles.lang} hitSlop={8} accessibilityLabel="Change language">
          <Text style={[styles.langText, chat.lang === 'en' && styles.langOn]}>EN</Text>
          <Text style={styles.langText}>|</Text>
          <Text style={[styles.langText, chat.lang === 'sw' && styles.langOn]}>SW</Text>
        </Pressable>
        <Pressable onPress={call999} style={styles.callBtn} accessibilityLabel={w.call}>
          <Icon name="phone" size={16} color={colors.onPrimary} />
          <Text style={styles.callText}>{w.call}</Text>
        </Pressable>
      </View>

      <FlatList
        style={styles.flex}
        contentContainerStyle={{ padding: spacing.md, flexGrow: 1, justifyContent: 'flex-end' }}
        data={[...chat.entries].reverse()}
        inverted
        keyExtractor={(e) => String(e.id)}
        ListHeaderComponent={
          busy ? (
            <View style={[styles.bubble, styles.theirs, styles.row]}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.muted}> {w.thinking}</Text>
            </View>
          ) : undefined
        }
        ListFooterComponent={
          <View style={styles.welcome}>
            <Text style={styles.body}>{w.intro}</Text>
            <View style={styles.chips}>
              {QUICK[chat.lang].map((q) => (
                <Chip key={q.topic} label={q.label} onPress={() => ask({ topic: q.topic }, q.label)} />
              ))}
            </View>
            <Text style={styles.source}>{w.source}</Text>
          </View>
        }
        renderItem={({ item }) =>
          item.from === 'me' ? (
            <View style={[styles.bubble, styles.mine]}>
              <Text style={[styles.body, { color: colors.onPrimary }]}>{item.text}</Text>
            </View>
          ) : (
            <GuideBubble
              reply={item.reply}
              words={WORDS[item.reply.lang]}
              latest={item === lastReply}
              onPick={(o) => ask({ topic: o.topic }, o.label)}
            />
          )
        }
      />

      {!!error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={w.placeholder}
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={500}
        />
        <Pressable onPress={send} disabled={busy || !text.trim()} style={[styles.send, (!text.trim() || busy) && { opacity: 0.5 }]}>
          <Icon name="send" size={20} color={colors.onPrimary} />
        </Pressable>
      </View>
      {footer}
    </KeyboardAvoidingView>
  );
}

function GuideBubble({
  reply,
  words,
  latest,
  onPick,
}: {
  reply: FirstAidReply;
  words: (typeof WORDS)['en'];
  latest: boolean;
  onPick: (o: { label: string; topic: string }) => void;
}) {
  const answer = reply.kind === 'answer';
  return (
    <View style={[styles.bubble, styles.theirs, styles.guide]}>
      {reply.emergency && !!reply.urgent && (
        <Pressable onPress={call999} style={styles.urgent}>
          <Icon name="alert" size={18} color={colors.danger} />
          <Text style={styles.urgentText}>{reply.urgent}</Text>
          <View style={styles.urgentCall}>
            <Icon name="phone" size={14} color={colors.onPrimary} />
            <Text style={styles.urgentCallText}>{words.callNow}</Text>
          </View>
        </Pressable>
      )}
      {answer ? (
        <>
          {!!reply.title && <Text style={styles.topic}>{reply.title}</Text>}
          {!!reply.opener && <Text style={styles.opener}>{reply.opener}</Text>}
          {!reply.emergency && !!reply.urgent && <Text style={styles.warn}>{reply.urgent}</Text>}
          {!!reply.intro && <Text style={styles.body}>{reply.intro}</Text>}
          <Text style={styles.heading}>{words.steps}</Text>
          {reply.steps?.map((s, i) => (
            <View key={i} style={styles.step}>
              <Text style={styles.stepNo}>{i + 1}</Text>
              <Text style={[styles.body, styles.flex1]}>{s}</Text>
            </View>
          ))}
          {!!reply.avoid?.length && <Text style={[styles.heading, { color: colors.danger }]}>{words.avoid}</Text>}
          {reply.avoid?.map((s, i) => (
            <View key={i} style={styles.step}>
              <Icon name="close-circle-outline" size={16} color={colors.danger} />
              <Text style={[styles.body, styles.flex1]}>{s}</Text>
            </View>
          ))}
          {!!reply.after && <Text style={[styles.body, styles.after]}>{reply.after}</Text>}
        </>
      ) : (
        <Text style={styles.body}>{reply.kind === 'clarify' ? reply.followup?.question : reply.text}</Text>
      )}
      {!!reply.followup && (
        <>
          {answer && <Text style={styles.question}>{reply.followup.question}</Text>}
          <View style={styles.chips}>
            {reply.followup.options.map((o) => (
              <Chip key={o.topic + o.label} label={o.label} onPress={() => onPick(o)} disabled={!latest} />
            ))}
          </View>
        </>
      )}
      {reply.kind === 'clarify' && !!reply.hint && <Text style={styles.muted}>{reply.hint}</Text>}
      {answer && <Text style={styles.note}>{reply.note}</Text>}
    </View>
  );
}

function Chip({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.chip, disabled && { opacity: 0.45 }]}>
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  flex1: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl + spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, flex: 1 },
  lang: { flexDirection: 'row', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  langText: { color: colors.textMuted, fontWeight: '600' },
  langOn: { color: colors.primary },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  callText: { color: colors.onPrimary, fontWeight: '700' },
  welcome: { marginBottom: spacing.md, gap: spacing.sm },
  bubble: { maxWidth: '88%', borderRadius: radius.lg, padding: spacing.sm + 4, marginBottom: spacing.sm },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  guide: { maxWidth: '95%', gap: 6 },
  body: { fontSize: 15, color: colors.text, lineHeight: 21 },
  muted: { fontSize: 13, color: colors.textMuted },
  topic: { fontSize: 12, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  opener: { fontSize: 15, fontWeight: '600', color: colors.text },
  warn: { fontSize: 14, color: colors.warning, fontWeight: '600' },
  heading: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: spacing.xs },
  step: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  stepNo: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primarySoft,
    color: colors.primary,
    textAlign: 'center',
    fontWeight: '700',
    lineHeight: 22,
    fontSize: 13,
  },
  after: { fontStyle: 'italic' },
  question: { fontSize: 15, fontWeight: '600', color: colors.text, marginTop: spacing.xs },
  note: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  source: { fontSize: 12, color: colors.textMuted },
  urgent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  urgentText: { flex: 1, minWidth: 160, color: colors.danger, fontWeight: '700', fontSize: 14 },
  urgentCall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  urgentCallText: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  chipText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  error: { color: colors.danger, textAlign: 'center', padding: spacing.sm, fontSize: 13 },
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
});

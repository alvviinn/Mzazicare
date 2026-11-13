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
import { Icon, IconName } from '../../components/Icon';
import { Chip, haptic, OfflineBanner, PressScale } from '../../components/ui';
import { colors, icon, on, radius, space, TAP, text, TOP_INSET } from '../../theme';
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
  autoFocus?: boolean; // opened from the "What's happening?" bar on Today
};

// The first four are the life-threatening ones: big tiles. The rest are chips.
const QUICK: Record<'en' | 'sw', { label: string; topic: string; icon: IconName }[]> = {
  en: [
    { label: 'Not breathing', topic: 'cpr', icon: 'cpr' },
    { label: 'Choking', topic: 'choking_severe', icon: 'choking' },
    { label: 'Chest pain', topic: 'heart_attack', icon: 'chestPain' },
    { label: 'Stroke signs', topic: 'stroke', icon: 'stroke' },
    { label: 'A fall', topic: 'fall', icon: 'fall' },
    { label: 'Heavy bleeding', topic: 'severe_bleeding', icon: 'bleeding' },
    { label: 'Burn', topic: 'burns', icon: 'burn' },
    { label: 'Low sugar', topic: 'low_blood_sugar', icon: 'sugar' },
    { label: 'Fit / seizure', topic: 'seizure', icon: 'seizure' },
    { label: 'Fainted', topic: 'fainting', icon: 'faint' },
  ],
  sw: [
    { label: 'Hapumui', topic: 'cpr', icon: 'cpr' },
    { label: 'Amekabwa', topic: 'choking_severe', icon: 'choking' },
    { label: 'Maumivu ya kifua', topic: 'heart_attack', icon: 'chestPain' },
    { label: 'Dalili za kiharusi', topic: 'stroke', icon: 'stroke' },
    { label: 'Ameanguka', topic: 'fall', icon: 'fall' },
    { label: 'Damu nyingi', topic: 'severe_bleeding', icon: 'bleeding' },
    { label: 'Kuungua', topic: 'burns', icon: 'burn' },
    { label: 'Sukari imeshuka', topic: 'low_blood_sugar', icon: 'sugar' },
    { label: 'Kifafa', topic: 'seizure', icon: 'seizure' },
    { label: 'Amezirai', topic: 'fainting', icon: 'faint' },
  ],
};

const WORDS = {
  en: {
    title: 'First aid',
    call: 'Call 999',
    intro: 'Describe it, or tap one.',
    urgentNow: 'Life-threatening',
    more: 'Other situations',
    placeholder: 'e.g. "she fell and hit her head"',
    steps: 'What to do',
    avoid: 'Do not',
    callNow: 'Call 999 now',
    source: 'Red Cross / IFRC guidelines · not a diagnosis',
    thinking: 'Finding the right steps…',
  },
  sw: {
    title: 'Huduma ya kwanza',
    call: 'Piga 999',
    intro: 'Eleza, au gusa mojawapo.',
    urgentNow: 'Hatari ya maisha',
    more: 'Hali nyingine',
    placeholder: 'mf. "ameanguka akagonga kichwa"',
    steps: 'Cha kufanya',
    avoid: 'Usifanye',
    callNow: 'Piga 999 sasa',
    source: 'Miongozo ya Red Cross / IFRC · si uchunguzi wa daktari',
    thinking: 'Natafuta hatua sahihi…',
  },
};

const call999 = () => {
  haptic.warn();
  Linking.openURL('tel:999');
};
const CHECK_YES = '__check_yes'; // the "Yes, in danger" option of the safety question (see ml/firstaid/assistant.py)

// A caretaker asks for first-aid help and gets steps from the vetted guide (see ml/firstaid).
export default function FirstAidTab({ token, chat, onChange, footer, autoFocus }: Props) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const nextId = useRef(chat.entries.length + 1);
  const w = WORDS[chat.lang];
  const lastReply = [...chat.entries].reverse().find((e) => e.from === 'guide') as
    | { reply: FirstAidReply }
    | undefined;

  async function ask(body: { message?: string; topic?: string; check?: 'yes' | 'no' }, shown: string) {
    if (busy) return;
    const mine: FirstAidEntry = { id: nextId.current++, from: 'me', text: shown };
    let entries = [...chat.entries, mine];
    onChange({ ...chat, entries });
    setBusy(true);
    setError('');
    try {
      const awaiting = lastReply?.reply.followup && lastReply.reply.topic ? lastReply.reply.topic : null;
      const keepLang = body.topic || body.check; // a tapped button keeps the conversation's language
      const reply = await askFirstAid(token, { ...body, awaiting, lang: keepLang ? chat.lang : undefined });
      entries = [...entries, { id: nextId.current++, from: 'guide', reply }];
      onChange({ entries, lang: keepLang ? chat.lang : reply.lang }); // follow the language they typed in
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not get an answer. Call 999 or 112 if it is an emergency.');
    } finally {
      setBusy(false);
    }
  }

  function send() {
    const message = draft.trim();
    if (!message) return;
    setDraft('');
    ask({ message }, message);
  }

  const toggleLang = () => {
    haptic.tap();
    onChange({ ...chat, lang: chat.lang === 'en' ? 'sw' : 'en' });
  };
  const quick = QUICK[chat.lang];

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={[text.display, { flex: 1 }]} numberOfLines={1} accessibilityRole="header">
          {w.title}
        </Text>
        <Pressable
          onPress={toggleLang}
          style={styles.lang}
          accessibilityRole="button"
          accessibilityLabel={chat.lang === 'en' ? 'Language: English. Switch to Kiswahili' : 'Lugha: Kiswahili. Badilisha kuwa Kiingereza'}
        >
          <Text style={[text.captionStrong, styles.langItem, chat.lang === 'en' ? styles.langOn : styles.langOff]}>EN</Text>
          <Text style={[text.captionStrong, styles.langItem, chat.lang === 'sw' ? styles.langOn : styles.langOff]}>SW</Text>
        </Pressable>
        <PressScale onPress={call999} style={styles.callBtn} accessibilityRole="button" accessibilityLabel={w.call}>
          <Icon name="phone" color={on.error} />
          <Text style={[text.bodyStrong, { color: on.error }]}>999</Text>
        </PressScale>
      </View>
      <OfflineBanner />

      <FlatList
        style={styles.flex}
        contentContainerStyle={styles.list}
        data={[...chat.entries].reverse()}
        inverted
        keyboardShouldPersistTaps="handled"
        keyExtractor={(e) => String(e.id)}
        ListHeaderComponent={
          busy ? (
            <View style={[styles.bubble, styles.theirs, styles.row]}>
              <ActivityIndicator color={colors.primary} />
              <Text style={text.caption}>{w.thinking}</Text>
            </View>
          ) : undefined
        }
        ListFooterComponent={
          <View style={styles.welcome}>
            <Text style={text.body}>{w.intro}</Text>
            {/* the four life-threatening situations: big tiles, alternating the two tints, ink icons */}
            <View style={styles.grid}>
              {quick.slice(0, 4).map((q, i) => (
                <PressScale
                  key={q.topic}
                  onPress={() => {
                    haptic.press();
                    ask({ topic: q.topic }, q.label);
                  }}
                  style={[styles.tile, { backgroundColor: i % 3 === 0 ? colors.primaryTint : colors.secondaryTint }]}
                  accessibilityRole="button"
                  accessibilityLabel={`${w.urgentNow}: ${q.label}`}
                >
                  <View style={styles.tileIcon}>
                    <Icon name={q.icon} size={icon.m} />
                  </View>
                  <Text style={text.bodyStrong} numberOfLines={2}>
                    {q.label}
                  </Text>
                </PressScale>
              ))}
            </View>
            <Text style={text.captionStrong}>{w.more}</Text>
            <View style={styles.chips}>
              {quick.slice(4).map((q) => (
                <Chip key={q.topic} label={q.label} icon={q.icon} onPress={() => ask({ topic: q.topic }, q.label)} />
              ))}
            </View>
            <View style={styles.row}>
              <Icon name="shield" size={icon.xs} color={colors.inkMuted} />
              <Text style={text.caption}>{w.source}</Text>
            </View>
          </View>
        }
        renderItem={({ item }) =>
          item.from === 'me' ? (
            <View style={[styles.bubble, styles.mine]}>
              <Text style={[text.body, { color: on.secondary }]}>{item.text}</Text>
            </View>
          ) : (
            <GuideBubble
              reply={item.reply}
              words={WORDS[item.reply.lang]}
              latest={item === lastReply}
              onPick={(o) =>
                item.reply.kind === 'check' && item.reply.check_message
                  ? ask({ message: item.reply.check_message, check: o.topic === CHECK_YES ? 'yes' : 'no' }, o.label)
                  : ask({ topic: o.topic }, o.label)
              }
            />
          )
        }
      />

      {!!error && (
        <View style={styles.error} accessibilityLiveRegion="polite">
          <Icon name="alert" color={colors.error} />
          <Text style={[text.caption, { color: colors.error, flex: 1 }]}>{error}</Text>
        </View>
      )}
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={w.placeholder}
          placeholderTextColor={colors.inkMuted}
          multiline
          maxLength={500}
          autoFocus={autoFocus}
          accessibilityLabel={w.placeholder}
        />
        <PressScale
          onPress={send}
          disabled={busy || !draft.trim()}
          style={[styles.send, (!draft.trim() || busy) && styles.sendOff]}
          accessibilityRole="button"
          accessibilityLabel={chat.lang === 'sw' ? 'Tuma' : 'Send'}
          accessibilityState={{ disabled: busy || !draft.trim(), busy }}
        >
          {busy ? <ActivityIndicator color={on.primary} /> : <Icon name="send" color={!draft.trim() ? colors.inkMuted : on.primary} />}
        </PressScale>
      </View>
      {footer}
    </KeyboardAvoidingView>
  );
}

// A red band that calls 999 when tapped: for emergencies and for the danger banner above advice.
function Urgent({ message, callLabel }: { message: string; callLabel: string }) {
  return (
    <Pressable onPress={call999} style={styles.urgent} accessibilityRole="button" accessibilityLabel={`${message} ${callLabel}`}>
      <Icon name="warning" color={on.error} />
      <Text style={[text.bodyStrong, styles.urgentText]}>{message}</Text>
      <View style={styles.urgentCall}>
        <Icon name="phone" size={icon.xs} color={colors.error} />
        <Text style={[text.captionStrong, { color: colors.error }]}>{callLabel}</Text>
      </View>
    </Pressable>
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
      {reply.emergency && !!reply.urgent && <Urgent message={reply.urgent} callLabel={words.callNow} />}
      {!reply.emergency && !!reply.danger_banner && <Urgent message={reply.danger_banner} callLabel={words.callNow} />}
      {answer ? (
        <>
          {!!reply.title && <Text style={text.heading}>{reply.title}</Text>}
          {!!reply.opener && <Text style={text.bodyStrong}>{reply.opener}</Text>}
          {!reply.emergency && !!reply.urgent && (
            <View style={styles.attention}>
              <Icon name="warning" color={colors.warning} />
              <Text style={[text.captionStrong, { flex: 1 }]}>{reply.urgent}</Text>
            </View>
          )}
          {!!reply.intro && <Text style={text.body}>{reply.intro}</Text>}
          <Text style={text.captionStrong}>{words.steps}</Text>
          {reply.steps?.map((s, i) => (
            <View key={i} style={styles.step}>
              <View style={styles.stepNo}>
                <Text style={text.captionStrong}>{i + 1}</Text>
              </View>
              <Text style={[text.body, styles.flex1]}>{s}</Text>
            </View>
          ))}
          {!!reply.avoid?.length && <Text style={[text.captionStrong, { color: colors.error }]}>{words.avoid}</Text>}
          {reply.avoid?.map((s, i) => (
            <View key={i} style={styles.step}>
              <Icon name="circleX" color={colors.error} />
              <Text style={[text.body, styles.flex1]}>{s}</Text>
            </View>
          ))}
          {!!reply.after && (
            <View style={styles.after}>
              <Icon name="info" color={colors.primary} />
              <Text style={[text.body, styles.flex1]}>{reply.after}</Text>
            </View>
          )}
        </>
      ) : reply.kind === 'check' ? (
        <View style={styles.row}>
          <Icon name="warning" color={colors.error} />
          <Text style={[text.bodyStrong, styles.flex1]}>{reply.text}</Text>
        </View>
      ) : (
        <Text style={text.body}>{reply.kind === 'clarify' ? reply.followup?.question : reply.text}</Text>
      )}
      {!!reply.followup && (
        <>
          {answer && <Text style={text.bodyStrong}>{reply.followup.question}</Text>}
          <View style={styles.chips}>
            {reply.followup.options.map((o) => (
              <Chip key={o.topic + o.label} label={o.label} onPress={() => onPick(o)} disabled={!latest} danger={o.topic === CHECK_YES} />
            ))}
          </View>
        </>
      )}
      {reply.kind === 'check' && (
        <Pressable onPress={call999} style={styles.checkCall} accessibilityRole="button" accessibilityLabel={words.callNow}>
          <Icon name="phone" color={colors.error} />
          <Text style={[text.bodyStrong, { color: colors.error }]}>{words.callNow}</Text>
        </Pressable>
      )}
      {reply.kind === 'clarify' && !!reply.hint && <Text style={text.caption}>{reply.hint}</Text>}
      {answer && <Text style={text.caption}>{reply.note}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  flex1: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.s, paddingHorizontal: space.m, paddingTop: TOP_INSET, paddingBottom: space.s },
  lang: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.line, borderRadius: radius.pill, padding: space.s },
  langItem: { paddingHorizontal: space.m, paddingVertical: space.s, borderRadius: radius.pill, overflow: 'hidden' },
  langOn: { color: colors.ink, backgroundColor: colors.surface },
  langOff: { color: colors.inkMuted },
  callBtn: { flexDirection: 'row', alignItems: 'center', gap: space.s, backgroundColor: colors.error, borderRadius: radius.pill, paddingHorizontal: space.m, minHeight: TAP },

  list: { padding: space.m, flexGrow: 1, justifyContent: 'flex-end' },
  welcome: { marginBottom: space.m, gap: space.m },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  tile: { flexGrow: 1, flexBasis: '45%', minHeight: 104, borderRadius: radius.card, padding: space.m, justifyContent: 'space-between' },
  tileIcon: { width: TAP, height: TAP, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },

  bubble: { maxWidth: '86%', borderRadius: radius.card, padding: space.m, marginBottom: space.s },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.secondary },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface },
  guide: { maxWidth: '96%', gap: space.s },
  attention: { flexDirection: 'row', alignItems: 'center', gap: space.s, backgroundColor: colors.warningTint, borderRadius: radius.small, padding: space.s },
  step: { flexDirection: 'row', gap: space.m, alignItems: 'flex-start' },
  stepNo: { width: 24, height: 24, borderRadius: radius.pill, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  after: { flexDirection: 'row', gap: space.s, backgroundColor: colors.secondaryTint, borderRadius: radius.small, padding: space.m },

  urgent: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.s, backgroundColor: colors.error, borderRadius: radius.small, padding: space.m },
  urgentText: { flex: 1, minWidth: 160, color: on.error },
  urgentCall: { flexDirection: 'row', alignItems: 'center', gap: space.s, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: space.m, minHeight: 40 },
  checkCall: { flexDirection: 'row', alignItems: 'center', gap: space.s, minHeight: TAP, alignSelf: 'flex-start' },

  error: { flexDirection: 'row', alignItems: 'center', gap: space.s, paddingHorizontal: space.m, paddingVertical: space.s, backgroundColor: colors.surface },
  composer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: space.m, paddingTop: space.s, gap: space.s },
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

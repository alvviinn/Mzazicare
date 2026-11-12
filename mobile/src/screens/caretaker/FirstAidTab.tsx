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
import { colors, fonts, iconSize, radius, spacing, TAP, text, TOP_INSET, type } from '../../theme';
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
    { label: 'Not breathing', topic: 'cpr', icon: 'heart-pulse' },
    { label: 'Choking', topic: 'choking_severe', icon: 'lungs' },
    { label: 'Chest pain', topic: 'heart_attack', icon: 'heart-flash' },
    { label: 'Stroke signs', topic: 'stroke', icon: 'head-alert-outline' },
    { label: 'A fall', topic: 'fall', icon: 'human-cane' },
    { label: 'Heavy bleeding', topic: 'severe_bleeding', icon: 'water-alert-outline' },
    { label: 'Burn', topic: 'burns', icon: 'fire' },
    { label: 'Low sugar', topic: 'low_blood_sugar', icon: 'spoon-sugar' },
    { label: 'Fit / seizure', topic: 'seizure', icon: 'flash-alert-outline' },
    { label: 'Fainted', topic: 'fainting', icon: 'sleep' },
  ],
  sw: [
    { label: 'Hapumui', topic: 'cpr', icon: 'heart-pulse' },
    { label: 'Amekabwa', topic: 'choking_severe', icon: 'lungs' },
    { label: 'Maumivu ya kifua', topic: 'heart_attack', icon: 'heart-flash' },
    { label: 'Dalili za kiharusi', topic: 'stroke', icon: 'head-alert-outline' },
    { label: 'Ameanguka', topic: 'fall', icon: 'human-cane' },
    { label: 'Damu nyingi', topic: 'severe_bleeding', icon: 'water-alert-outline' },
    { label: 'Kuungua', topic: 'burns', icon: 'fire' },
    { label: 'Sukari imeshuka', topic: 'low_blood_sugar', icon: 'spoon-sugar' },
    { label: 'Kifafa', topic: 'seizure', icon: 'flash-alert-outline' },
    { label: 'Amezirai', topic: 'fainting', icon: 'sleep' },
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
        <Text style={[text.h1, { flex: 1 }]} numberOfLines={1} accessibilityRole="header">
          {w.title}
        </Text>
        <Pressable
          onPress={toggleLang}
          style={styles.lang}
          accessibilityRole="button"
          accessibilityLabel={chat.lang === 'en' ? 'Language: English. Switch to Kiswahili' : 'Lugha: Kiswahili. Badilisha kuwa Kiingereza'}
        >
          <Text style={[styles.langText, chat.lang === 'en' && styles.langOn]}>EN</Text>
          <Text style={[styles.langText, chat.lang === 'sw' && styles.langOn]}>SW</Text>
        </Pressable>
        <PressScale onPress={call999} style={styles.callBtn} accessibilityRole="button" accessibilityLabel={w.call}>
          <Icon name="phone" size={iconSize.inline} color={colors.onPrimary} />
          <Text style={styles.callText}>999</Text>
        </PressScale>
      </View>
      <OfflineBanner />

      <FlatList
        style={styles.flex}
        contentContainerStyle={{ padding: spacing.md, flexGrow: 1, justifyContent: 'flex-end' }}
        data={[...chat.entries].reverse()}
        inverted
        keyboardShouldPersistTaps="handled"
        keyExtractor={(e) => String(e.id)}
        ListHeaderComponent={
          busy ? (
            <View style={[styles.bubble, styles.theirs, styles.row]}>
              <ActivityIndicator color={colors.primary} />
              <Text style={text.small}> {w.thinking}</Text>
            </View>
          ) : undefined
        }
        ListFooterComponent={
          <View style={styles.welcome}>
            <Text style={text.body}>{w.intro}</Text>
            <View style={styles.grid}>
              {quick.slice(0, 4).map((q) => (
                <PressScale
                  key={q.topic}
                  onPress={() => {
                    haptic.press();
                    ask({ topic: q.topic }, q.label);
                  }}
                  style={styles.tile}
                  accessibilityRole="button"
                  accessibilityLabel={`${w.urgentNow}: ${q.label}`}
                >
                  <View style={styles.tileIcon}>
                    <Icon name={q.icon} size={iconSize.large} color={colors.danger} />
                  </View>
                  <Text style={text.bodyStrong} numberOfLines={2}>
                    {q.label}
                  </Text>
                </PressScale>
              ))}
            </View>
            <Text style={[text.smallStrong, { marginTop: spacing.xs }]}>{w.more}</Text>
            <View style={styles.chips}>
              {quick.slice(4).map((q) => (
                <Chip key={q.topic} label={q.label} icon={q.icon} onPress={() => ask({ topic: q.topic }, q.label)} />
              ))}
            </View>
            <View style={styles.source}>
              <Icon name="shield-check-outline" size={16} color={colors.textMuted} />
              <Text style={text.small}>{w.source}</Text>
            </View>
          </View>
        }
        renderItem={({ item }) =>
          item.from === 'me' ? (
            <View style={[styles.bubble, styles.mine]}>
              <Text style={[text.body, { color: colors.onPrimary }]}>{item.text}</Text>
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
          <Icon name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={[text.small, { color: colors.danger, flex: 1 }]}>{error}</Text>
        </View>
      )}
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={w.placeholder}
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={500}
          autoFocus={autoFocus}
          accessibilityLabel={w.placeholder}
        />
        <PressScale
          onPress={send}
          disabled={busy || !draft.trim()}
          scaleTo={0.9}
          style={[styles.send, (!draft.trim() || busy) && styles.sendOff]}
          accessibilityRole="button"
          accessibilityLabel={chat.lang === 'sw' ? 'Tuma' : 'Send'}
          accessibilityState={{ disabled: busy || !draft.trim(), busy }}
        >
          {busy ? <ActivityIndicator color={colors.onPrimary} /> : <Icon name="arrow-up" size={iconSize.inline} color={colors.onPrimary} />}
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
      <Icon name="alert" size={iconSize.inline} color={colors.danger} />
      <Text style={styles.urgentText}>{message}</Text>
      <View style={styles.urgentCall}>
        <Icon name="phone" size={16} color={colors.onPrimary} />
        <Text style={styles.urgentCallText}>{callLabel}</Text>
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
          {!!reply.title && <Text style={text.h2}>{reply.title}</Text>}
          {!!reply.opener && <Text style={text.bodyStrong}>{reply.opener}</Text>}
          {!reply.emergency && !!reply.urgent && <Text style={styles.warn}>{reply.urgent}</Text>}
          {!!reply.intro && <Text style={text.body}>{reply.intro}</Text>}
          <Text style={styles.heading}>{words.steps}</Text>
          {reply.steps?.map((s, i) => (
            <View key={i} style={styles.step}>
              <View style={styles.stepNo}>
                <Text style={styles.stepNoText}>{i + 1}</Text>
              </View>
              <Text style={[text.body, styles.flex1]}>{s}</Text>
            </View>
          ))}
          {!!reply.avoid?.length && <Text style={[styles.heading, { color: colors.danger }]}>{words.avoid}</Text>}
          {reply.avoid?.map((s, i) => (
            <View key={i} style={styles.step}>
              <Icon name="close-circle" size={20} color={colors.danger} />
              <Text style={[text.body, styles.flex1]}>{s}</Text>
            </View>
          ))}
          {!!reply.after && (
            <View style={styles.after}>
              <Icon name="information-outline" size={18} color={colors.sage} />
              <Text style={[text.body, styles.flex1]}>{reply.after}</Text>
            </View>
          )}
        </>
      ) : reply.kind === 'check' ? (
        <View style={styles.row}>
          <Icon name="alert" size={iconSize.inline} color={colors.danger} />
          <Text style={[text.bodyStrong, styles.flex1, { marginLeft: spacing.sm }]}>{reply.text}</Text>
        </View>
      ) : (
        <Text style={text.body}>{reply.kind === 'clarify' ? reply.followup?.question : reply.text}</Text>
      )}
      {!!reply.followup && (
        <>
          {answer && <Text style={[text.bodyStrong, { marginTop: spacing.xs }]}>{reply.followup.question}</Text>}
          <View style={styles.chips}>
            {reply.followup.options.map((o) => (
              <Chip
                key={o.topic + o.label}
                label={o.label}
                onPress={() => onPick(o)}
                disabled={!latest}
                tone={o.topic === CHECK_YES ? 'danger' : 'plain'}
              />
            ))}
          </View>
        </>
      )}
      {reply.kind === 'check' && (
        <Pressable onPress={call999} style={styles.checkCall} accessibilityRole="button" accessibilityLabel={words.callNow}>
          <Icon name="phone" size={16} color={colors.danger} />
          <Text style={styles.checkCallText}>{words.callNow}</Text>
        </Pressable>
      )}
      {reply.kind === 'clarify' && !!reply.hint && <Text style={text.small}>{reply.hint}</Text>}
      {answer && <Text style={[text.small, { marginTop: spacing.xs }]}>{reply.note}</Text>}
    </View>
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
    paddingTop: TOP_INSET,
    paddingBottom: spacing.sm,
  },
  lang: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.sunken,
    borderRadius: radius.pill,
    padding: 4,
    minHeight: TAP - 4,
  },
  langText: {
    fontFamily: fonts.bodyBold,
    fontSize: type.small,
    color: colors.textMuted,
    paddingHorizontal: spacing.ms,
    paddingVertical: 6,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  langOn: { color: colors.text, backgroundColor: colors.surface },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    minHeight: TAP,
  },
  callText: { fontFamily: fonts.display, color: colors.onPrimary, fontSize: type.body + 2 },

  welcome: { marginBottom: spacing.md, gap: spacing.ms },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 104,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  tileIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  source: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  bubble: { maxWidth: '86%', borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderBottomLeftRadius: 6 },
  guide: { maxWidth: '96%', gap: spacing.sm },
  warn: { fontFamily: fonts.bodyBold, fontSize: type.small, color: colors.butterInk },
  heading: { ...text.smallStrong, marginTop: spacing.xs },
  step: { flexDirection: 'row', gap: spacing.ms, alignItems: 'flex-start' },
  stepNo: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  stepNoText: { fontFamily: fonts.display, fontSize: type.small, color: colors.primaryInk },
  after: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.sageSoft, borderRadius: radius.md, padding: spacing.ms },

  urgent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.ms,
  },
  urgentText: { flex: 1, minWidth: 160, fontFamily: fonts.bodyBold, fontSize: type.body, color: colors.danger },
  urgentCall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.ms,
    minHeight: TAP - 8,
  },
  urgentCallText: { fontFamily: fonts.bodyBold, fontSize: type.small, color: colors.onPrimary },
  checkCall: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: TAP, alignSelf: 'flex-start' },
  checkCallText: { fontFamily: fonts.bodyBold, fontSize: type.body, color: colors.danger },

  error: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.dangerSoft },
  composer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.sm },
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

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SectionTitle } from '../../components/HomeShell';
import { Card } from '../../components/ui';
import { colors, radius, spacing } from '../../theme';
import { ChatPerson, Dashboard } from '../../types';

type Props = { dash: Dashboard | null; onOpen: (p: { name: string; email: string }) => void; onGoPeople: () => void };

// Separate private chats: one with each caretaker and one with each elderly person.
export default function ChatsTab({ dash, onOpen, onGoPeople }: Props) {
  if (!dash) return <Text style={styles.muted}>Loading…</Text>;
  if (!dash.caretakers.length && !dash.elderly.length) {
    return (
      <Card>
        <Text style={styles.title}>No chats yet</Text>
        <Text style={styles.muted}>
          You can chat with your caretaker and your elderly loved one once they've registered and been linked to you.
        </Text>
        <Pressable onPress={onGoPeople} style={{ marginTop: spacing.md }}>
          <Text style={styles.link}>Add people →</Text>
        </Pressable>
      </Card>
    );
  }
  return (
    <>
      {dash.caretakers.length > 0 && <Group title="Caretakers" list={dash.caretakers} onOpen={onOpen} />}
      {dash.elderly.length > 0 && <Group title="Elderly" list={dash.elderly} onOpen={onOpen} />}
    </>
  );
}

function Group({ title, list, onOpen }: { title: string; list: ChatPerson[]; onOpen: Props['onOpen'] }) {
  return (
    <>
      <SectionTitle>{title}</SectionTitle>
      <Card>
        {list.map((p, i) => (
          <Pressable key={p.email} onPress={() => onOpen(p)} style={[styles.row, i > 0 && styles.rowBorder]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{p.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{p.name}</Text>
              <Text style={styles.sub}>{p.email}</Text>
            </View>
            {p.unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{p.unread}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  muted: { color: colors.textMuted, fontSize: 14 },
  link: { color: colors.primary, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  sub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  badge: { backgroundColor: colors.primary, borderRadius: radius.md, minWidth: 24, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { color: colors.onPrimary, fontSize: 12, fontWeight: '700', textAlign: 'center' },
});

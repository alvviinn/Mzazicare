import { StyleSheet, Text, View } from 'react-native';
import { Avatar, Card, Empty, Loading, Row, Section } from '../../components/ui';
import { colors, fonts, radius, spacing, type } from '../../theme';
import { ChatPerson, Dashboard } from '../../types';

type Props = { dash: Dashboard | null; onOpen: (p: { name: string; email: string }) => void; onGoPeople: () => void };

// Separate private chats: one with each caretaker and one with each elderly person.
export default function ChatsTab({ dash, onOpen, onGoPeople }: Props) {
  if (!dash) return <Loading label="Loading chats" />;
  if (!dash.caretakers.length && !dash.elderly.length) {
    return <Empty icon="message-text-outline" title="No chats yet" body="Add people to start talking." action="Add people" onAction={onGoPeople} tint="peach" />;
  }
  return (
    <>
      {dash.caretakers.length > 0 && <Group title="Caretakers" list={dash.caretakers} onOpen={onOpen} />}
      {dash.elderly.length > 0 && <Group title="Elders" list={dash.elderly} onOpen={onOpen} />}
    </>
  );
}

function Group({ title, list, onOpen }: { title: string; list: ChatPerson[]; onOpen: Props['onOpen'] }) {
  return (
    <>
      <Section title={title} />
      <Card padded={false} style={{ paddingHorizontal: spacing.md }}>
        {list.map((p, i) => (
          <Row
            key={p.email}
            first={i === 0}
            onPress={() => onOpen(p)}
            leading={<Avatar name={p.name} size={48} />}
            title={p.name}
            subtitle={p.unread ? `${p.unread} new` : 'Open chat'}
            accessibilityLabel={`Chat with ${p.name}${p.unread ? `, ${p.unread} unread` : ''}`}
            trailing={
              p.unread > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{p.unread}</Text>
                </View>
              ) : undefined
            }
          />
        ))}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    minWidth: 26,
    height: 26,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.onPrimary, fontFamily: fonts.bodyBold, fontSize: type.small },
});

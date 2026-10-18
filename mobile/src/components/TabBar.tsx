import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import { Icon, IconName } from './Icon';

export type TabDef<K extends string> = { key: K; label: string; icon: IconName; badge?: number };

export function TabBar<K extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: TabDef<K>[];
  active: K;
  onChange: (key: K) => void;
}) {
  return (
    <View style={styles.bar}>
      {tabs.map((t) => (
        <Pressable key={t.key} style={styles.tab} onPress={() => onChange(t.key)}>
          <Icon name={t.icon} size={24} color={active === t.key ? colors.primary : colors.textMuted} />
          <Text style={[styles.label, active === t.key && styles.active]}>{t.label}</Text>
          {!!t.badge && t.badge > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{t.badge}</Text>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: spacing.sm,
  },
  tab: { flex: 1, alignItems: 'center', paddingTop: spacing.sm },
  label: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  active: { color: colors.primary, fontWeight: '700' },
  badge: {
    position: 'absolute',
    top: 2,
    right: '28%',
    backgroundColor: colors.danger,
    borderRadius: 9,
    minWidth: 18,
    paddingHorizontal: 4,
  },
  badgeText: { color: colors.onPrimary, fontSize: 11, fontWeight: '700', textAlign: 'center' },
});

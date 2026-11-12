import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, iconSize, radius, shadow, spacing, TAP, type } from '../theme';
import { Icon, IconName } from './Icon';
import { haptic } from './ui';

export type TabDef<K extends string> = { key: K; label: string; icon: IconName; activeIcon?: IconName; badge?: number };

// A floating pill bar. The active tab is a filled ink capsule; every tab keeps its label.
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
    <View style={styles.wrap}>
      <View style={[styles.bar, shadow.float]} accessibilityRole="tablist">
        {tabs.map((t) => {
          const on = active === t.key;
          return (
            <Pressable
              key={t.key}
              style={styles.tab}
              onPress={() => {
                if (!on) haptic.tap();
                onChange(t.key);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t.badge ? `${t.label}, ${t.badge} new` : t.label}
            >
              <View style={[styles.face, on && styles.faceOn]}>
                <Icon name={on ? (t.activeIcon ?? t.icon) : t.icon} size={iconSize.tab} color={on ? colors.surface : colors.textMuted} />
                {!!t.badge && t.badge > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{t.badge > 9 ? '9+' : t.badge}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.ms, paddingBottom: spacing.ms, paddingTop: spacing.xs, backgroundColor: colors.background },
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg + 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: TAP + 12 },
  face: { width: 52, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  faceOn: { backgroundColor: colors.text },
  label: { fontFamily: fonts.bodyMedium, fontSize: type.caption, color: colors.textMuted, marginTop: 3 },
  labelOn: { fontFamily: fonts.bodyBold, color: colors.text },
  badge: {
    position: 'absolute',
    top: -2,
    right: 4,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  badgeText: { color: colors.onPrimary, fontFamily: fonts.bodyBold, fontSize: 10 },
});

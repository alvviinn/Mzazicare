import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, icon, on, radius, shadow, space, TAP, text } from '../theme';
import { Icon, IconName } from './Icon';
import { haptic } from './ui';

export type TabDef<K extends string> = { key: K; label: string; icon: IconName; badge?: number };

// A floating bar. The active item is the cobalt capsule with a white icon; every item keeps its label.
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
          const sel = active === t.key;
          return (
            <Pressable
              key={t.key}
              style={styles.tab}
              onPress={() => {
                if (!sel) haptic.tap();
                onChange(t.key);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: sel }}
              accessibilityLabel={t.badge ? `${t.label}, ${t.badge} new` : t.label}
            >
              <View style={[styles.face, sel && { backgroundColor: colors.primary }]}>
                <Icon name={t.icon} size={icon.m} color={sel ? on.primary : colors.inkMuted} />
                {!!t.badge && t.badge > 0 && (
                  <View style={styles.badge}>
                    <Text style={[text.captionStrong, { color: on.secondary }]}>{t.badge > 9 ? '9+' : t.badge}</Text>
                  </View>
                )}
              </View>
              <Text style={[text.caption, sel && { color: colors.ink }, sel && text.captionStrong]} numberOfLines={1}>
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
  wrap: { paddingHorizontal: space.m, paddingBottom: space.s, paddingTop: space.s, backgroundColor: colors.background },
  bar: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.card, paddingVertical: space.s },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: TAP + space.m, gap: space.s },
  face: { width: 56, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -space.s,
    right: 0,
    backgroundColor: colors.secondary,
    borderRadius: radius.pill,
    minWidth: 24,
    height: 24,
    paddingHorizontal: space.s,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
});

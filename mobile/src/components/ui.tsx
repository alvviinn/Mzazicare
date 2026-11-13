// The component kit. Every screen is built from these; every value comes from theme.ts.
import * as Haptics from 'expo-haptics';
import { forwardRef, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  PressableProps,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputInstance,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useOnline } from '../net';
import { t } from '../strings';
import { colors, fonts, icon, motion, on, radius, shade, shadow, size, space, TAP, text, textOnInk, TOP_INSET } from '../theme';
import { Icon, IconName } from './Icon';

// ---------- feel ----------

let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled()
  .then((v) => (reduceMotion = v))
  .catch(() => {});
AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => (reduceMotion = v));

// Every animation: the one easing curve and one of the two durations.
const animate = (v: Animated.Value, toValue: number, duration: number, done?: () => void) =>
  Animated.timing(v, { toValue, duration: reduceMotion ? 0 : duration, easing: motion.easing, useNativeDriver: true }).start(done);

export const haptic = {
  tap: () => Haptics.selectionAsync().catch(() => {}),
  press: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warn: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
};

// A Pressable that sinks slightly under the finger. One animated element, so layout styles apply as on a View.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
export function PressScale({
  style,
  children,
  onPressIn,
  onPressOut,
  ...props
}: PressableProps & { style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const [scale] = useState(() => new Animated.Value(1));
  return (
    <AnimatedPressable
      {...props}
      onPressIn={(e) => {
        animate(scale, 0.97, motion.fast);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animate(scale, 1, motion.fast);
        onPressOut?.(e);
      }}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}

// ---------- buttons ----------

type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'danger' | 'light';
const BUTTON: Record<ButtonVariant, { bg: string; fg: string }> = {
  primary: { bg: colors.primary, fg: on.primary }, // cobalt, white text: the ONE main action on a screen
  secondary: { bg: colors.secondary, fg: on.secondary }, // cornflower, ink text
  soft: { bg: colors.primaryTint, fg: colors.ink },
  danger: { bg: colors.error, fg: on.error },
  light: { bg: colors.surface, fg: colors.ink }, // a white button, for use on the ink hero
};

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  icon: iconName,
  accessibilityLabel,
  accessibilityHint,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  icon?: IconName;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const v = BUTTON[variant];
  const off = disabled || loading;
  const fg = disabled && !loading ? colors.inkMuted : v.fg;
  return (
    <PressScale
      onPress={() => {
        haptic.press();
        onPress();
      }}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={[styles.button, { backgroundColor: disabled && !loading ? colors.line : v.bg }]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.row8}>
          {iconName && <Icon name={iconName} size={icon.s} color={fg} />}
          <Text style={[text.bodyStrong, { color: fg }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
      )}
    </PressScale>
  );
}

// A round icon-only button. Always has a spoken label.
export function IconButton({
  icon: iconName,
  label,
  onPress,
  tone = 'plain',
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: 'plain' | 'surface' | 'primary' | 'secondary';
  disabled?: boolean;
}) {
  const bg = { plain: 'transparent', surface: colors.surface, primary: colors.primary, secondary: colors.secondary }[tone];
  const fg = tone === 'primary' ? on.primary : tone === 'secondary' ? on.secondary : colors.ink;
  return (
    <PressScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={[styles.iconBtn, { backgroundColor: disabled ? colors.line : bg }]}
    >
      <Icon name={iconName} size={icon.s} color={disabled ? colors.inkMuted : fg} />
    </PressScale>
  );
}

// ---------- chips and segmented control ----------

// Unselected: outlined. Selected: cobalt tint with a tick. `danger`: a red fill for the one risky answer.
export function Chip({
  label,
  onPress,
  selected,
  icon: iconName,
  danger,
  disabled,
  accessibilityLabel,
}: {
  label: string;
  onPress?: () => void;
  selected?: boolean;
  icon?: IconName;
  danger?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const fg = danger ? on.error : colors.ink;
  return (
    <PressScale
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      disabled={disabled || !onPress}
      accessibilityRole={selected === undefined ? 'button' : 'radio'}
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        styles.chip,
        danger ? { backgroundColor: colors.error } : selected ? { backgroundColor: colors.primaryTint } : styles.chipOutline,
        disabled && { opacity: 0.5 },
      ]}
    >
      {selected ? <Icon name="check" size={icon.s} color={fg} /> : iconName ? <Icon name={iconName} size={icon.s} color={fg} /> : null}
      <Text style={[text.captionStrong, { color: fg }]}>{label}</Text>
    </PressScale>
  );
}

export function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
}) {
  return (
    <View style={styles.segment} accessibilityRole="tablist">
      {options.map((o) => {
        const sel = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => {
              haptic.tap();
              onChange(o.key);
            }}
            style={[styles.segmentItem, sel && styles.segmentOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: sel }}
            accessibilityLabel={o.label}
          >
            <Text style={[text.captionStrong, { color: sel ? colors.ink : colors.inkMuted }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- surfaces ----------

export type Tint = 'surface' | 'primary' | 'secondary' | 'ink' | 'warning';
export const TINT: Record<Tint, string> = {
  surface: colors.surface,
  primary: colors.primaryTint,
  secondary: colors.secondaryTint,
  ink: colors.ink, // the hero: at most one per screen, white text (textOnInk)
  warning: colors.warningTint, // attention: ink text and an amber or red icon
};

// A soft panel. Cards sit on tints, never on shadows or borders.
export function Card({
  children,
  tint = 'surface',
  padded = true,
  style,
}: {
  children: React.ReactNode;
  tint?: Tint;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, { backgroundColor: TINT[tint] }, padded && { padding: space.m }, style]}>{children}</View>;
}

// Section heading with an optional link on the right ("See all").
export function Section({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.section}>
      <Text style={text.heading} accessibilityRole="header">
        {title}
      </Text>
      {action && onAction && (
        <Pressable onPress={onAction} style={styles.sectionAction} accessibilityRole="button" accessibilityLabel={action}>
          <Text style={[text.captionStrong, { color: colors.primary }]}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

// A list row: leading visual, one or two lines, trailing content. Pressable when onPress is given.
export function Row({
  leading,
  title,
  subtitle,
  trailing,
  onPress,
  first,
  accessibilityLabel,
  accessibilityHint,
  strike,
}: {
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  first?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  strike?: boolean;
}) {
  const body = (
    <>
      {leading}
      <View style={styles.flex}>
        <Text style={[text.bodyStrong, strike && styles.strike]} numberOfLines={2}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={text.caption} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
      {trailing}
      {onPress && !trailing && <Icon name="chevron" size={icon.s} color={colors.inkMuted} />}
    </>
  );
  const style = [styles.row, !first && styles.rowLine];
  return onPress ? (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [...style, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join('. ')}
      accessibilityHint={accessibilityHint}
    >
      {body}
    </Pressable>
  ) : (
    <View style={style} accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel}>
      {body}
    </View>
  );
}

// Initial in a tinted circle. The tint comes from the name, so a person keeps their colour everywhere.
export function Avatar({ name, size: d = 48, solid }: { name: string; size?: number; solid?: boolean }) {
  const n = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  const tint = solid
    ? { bg: colors.secondary, fg: on.secondary }
    : n % 2
      ? { bg: colors.secondaryTint, fg: colors.ink }
      : { bg: colors.primaryTint, fg: colors.ink };
  return (
    <View
      style={[styles.center, { width: d, height: d, borderRadius: radius.pill, backgroundColor: tint.bg }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[d >= 64 ? text.display : text.heading, { color: tint.fg }]}>{name.trim().charAt(0).toUpperCase()}</Text>
    </View>
  );
}

// A status in words with a dot, never colour alone. Sits on `surface` so it reads on any tint and on the hero.
// The dot carries the status colour; the words are ink (green, amber and cornflower fail as small text).
export type PillTone = 'success' | 'ink' | 'muted' | 'error' | 'secondary' | 'warning';
const PILL: Record<PillTone, { dot: string; text: string }> = {
  success: { dot: colors.success, text: colors.ink },
  ink: { dot: colors.ink, text: colors.ink },
  muted: { dot: colors.inkMuted, text: colors.inkMuted },
  error: { dot: colors.error, text: colors.error },
  secondary: { dot: colors.secondary, text: colors.ink },
  warning: { dot: colors.warning, text: colors.ink },
};
export function StatusPill({ label, tone }: { label: string; tone: PillTone }) {
  const c = PILL[tone];
  return (
    <View style={styles.pill}>
      <View style={[styles.dot, { backgroundColor: c.dot }]} />
      <Text style={[text.captionStrong, { color: c.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// ---------- data visuals ----------

// A progress ring with the figure or an icon in the middle. Cobalt arc on light cards (6.8:1, readable on its own);
// `onInk` for the hero: a cornflower arc on a cobalt track.
export function Ring({
  value,
  total,
  size: d = 64,
  track = colors.surface,
  onInk,
  children,
}: {
  value: number;
  total: number;
  size?: number;
  track?: string;
  onInk?: boolean;
  children?: React.ReactNode;
}) {
  const stroke = d >= 80 ? 8 : 6;
  const r = (d - stroke) / 2;
  const c = 2 * Math.PI * r;
  const share = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <View style={[styles.center, { width: d, height: d }]}>
      <Svg width={d} height={d} style={StyleSheet.absoluteFill}>
        <Circle cx={d / 2} cy={d / 2} r={r} stroke={onInk ? colors.primary : track} strokeWidth={stroke} fill="none" />
        {share > 0 && (
          <Circle
            cx={d / 2}
            cy={d / 2}
            r={r}
            stroke={onInk ? colors.secondary : colors.primary}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c * share} ${c}`}
            transform={`rotate(-90 ${d / 2} ${d / 2})`}
          />
        )}
      </Svg>
      {children}
    </View>
  );
}

// Live progress through a day, like an order tracker: done steps ticked, the current one ringed.
// `onInk` for the hero: cornflower progress and white labels; otherwise cobalt progress.
export function Stepper({ steps, current, onInk }: { steps: string[]; current: number; onInk?: boolean }) {
  const accent = onInk ? colors.secondary : colors.primary;
  const rest = onInk ? colors.primary : colors.line;
  const label = onInk ? textOnInk.caption : text.caption;
  const strong = onInk ? textOnInk.captionStrong : text.captionStrong;
  return (
    <View style={styles.stepper} accessible accessibilityLabel={`${steps[Math.max(0, current)] ?? ''}. Step ${current + 1} of ${steps.length}`}>
      {steps.map((s, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <View key={s} style={styles.step}>
            <View style={styles.stepTrack}>
              <View style={[styles.stepLine, { backgroundColor: i === 0 ? 'transparent' : i <= current ? accent : rest }]} />
              <View
                style={[
                  styles.stepDot,
                  { borderColor: rest, backgroundColor: onInk ? colors.ink : colors.surface },
                  done && { backgroundColor: accent, borderColor: accent },
                  now && { borderColor: accent, borderWidth: 6 },
                ]}
              >
                {done && <Icon name="check" size={icon.xs} color={onInk ? on.secondary : on.primary} />}
              </View>
              <View
                style={[styles.stepLine, { backgroundColor: i === steps.length - 1 ? 'transparent' : i < current ? accent : rest }]}
              />
            </View>
            <Text style={done || now ? strong : label} numberOfLines={1}>
              {s}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ---------- inputs ----------

type FieldProps = TextInputProps & { label: string; secure?: boolean; icon?: IconName };

// Input on surface with a line border; cobalt border while typing. `secure` adds a show/hide eye.
export const Field = forwardRef<TextInputInstance, FieldProps>(function Field({ label, secure, icon: iconName, style, ...props }, ref) {
  const [hidden, setHidden] = useState(true);
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ marginBottom: space.m }}>
      <Text style={[text.captionStrong, { marginBottom: space.s }]}>{label}</Text>
      <View style={[styles.inputWrap, focus && { borderColor: colors.primary }]}>
        {iconName && <Icon name={iconName} size={icon.s} color={colors.inkMuted} />}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.inkMuted}
          autoCapitalize="none"
          accessibilityLabel={label}
          {...props}
          onFocus={(e) => {
            setFocus(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocus(false);
            props.onBlur?.(e);
          }}
          secureTextEntry={secure ? hidden : props.secureTextEntry}
          style={[styles.input, style]}
        />
        {secure && (
          <Pressable
            onPress={() => setHidden((v) => !v)}
            style={styles.eye}
            accessibilityRole="button"
            accessibilityLabel={hidden ? t.common.showPassword : t.common.hidePassword}
          >
            <Icon name={hidden ? 'eye' : 'eyeOff'} size={icon.s} color={colors.inkMuted} />
          </Pressable>
        )}
      </View>
    </View>
  );
});

export function ErrorText({ children }: { children?: string }) {
  return children ? (
    <View style={[styles.row8, styles.errorRow]} accessibilityLiveRegion="polite">
      <Icon name="alert" size={icon.s} color={colors.error} />
      <Text style={[text.captionStrong, { flex: 1 }]}>{children}</Text>
    </View>
  ) : null;
}

// ---------- states ----------

// A skeleton while data loads: the shape of what is coming, in line colour, gently breathing.
export function Loading({ label, lines = 3 }: { label: string; lines?: number }) {
  const [fade] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(fade, { toValue: 0.5, duration: motion.slow, easing: motion.easing, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: motion.slow, easing: motion.easing, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [fade]);
  return (
    <Animated.View style={{ opacity: fade, gap: space.s }} accessible accessibilityLabel={label} accessibilityLiveRegion="polite">
      <View style={[styles.skel, { height: 128 }]} />
      {Array.from({ length: lines - 1 }, (_, i) => (
        <View key={i} style={[styles.skel, { height: 64, width: i % 2 ? '70%' : '100%' }]} />
      ))}
    </Animated.View>
  );
}

// What went wrong and a way to try again.
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card>
      <View style={styles.state} accessibilityLiveRegion="polite">
        <View style={[styles.stateIcon, { backgroundColor: colors.primaryTint }]}>
          <Icon name="wifiOff" size={icon.m} color={colors.error} />
        </View>
        <Text style={[text.body, { textAlign: 'center' }]}>{message}</Text>
        {onRetry && (
          <View style={{ alignSelf: 'stretch' }}>
            <Button title={t.common.tryAgain} variant="soft" icon="refresh" onPress={onRetry} />
          </View>
        )}
      </View>
    </Card>
  );
}

// An empty list: an icon, a short title, at most one line, and the action that fills it.
export function Empty({
  icon: iconName,
  title,
  body,
  action,
  onAction,
  tint = 'surface',
}: {
  icon: IconName;
  title: string;
  body?: string;
  action?: string;
  onAction?: () => void;
  tint?: Tint;
}) {
  return (
    <Card tint={tint}>
      <View style={styles.state}>
        <View style={[styles.stateIcon, { backgroundColor: tint === 'surface' ? colors.secondaryTint : colors.surface }]}>
          <Icon name={iconName} size={icon.m} />
        </View>
        <Text style={[text.heading, { textAlign: 'center' }]}>{title}</Text>
        {!!body && <Text style={[tint === 'surface' ? text.caption : text.captionInk, { textAlign: 'center' }]}>{body}</Text>}
        {action && onAction && (
          <View style={{ alignSelf: 'stretch' }}>
            <Button title={action} variant="secondary" onPress={onAction} />
          </View>
        )}
      </View>
    </Card>
  );
}

// Slim strip shown while the server can't be reached: warning tint, ink text, an amber icon.
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <View style={styles.offline} accessibilityLiveRegion="polite" accessibilityRole="alert" accessibilityLabel={t.common.offlineLong}>
      <Icon name="offline" size={icon.s} color={colors.warning} />
      <Text style={text.captionStrong}>{t.common.offline}</Text>
    </View>
  );
}

// A short confirmation that slides up from the bottom ("Done at 10:42 · Undo").
export function Toast({
  message,
  actionLabel,
  onAction,
  onHide,
  ms = 5000,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onHide: () => void;
  ms?: number;
}) {
  const [y] = useState(() => new Animated.Value(space.xl));
  const [fade] = useState(() => new Animated.Value(0));
  useEffect(() => {
    animate(fade, 1, motion.slow);
    animate(y, 0, motion.slow);
    const id = setTimeout(onHide, ms);
    return () => clearTimeout(id);
  }, [message, ms, onHide, fade, y]);
  return (
    <Animated.View
      style={[styles.toast, shadow.float, { opacity: fade, transform: [{ translateY: y }] }]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <Icon name="checkCircle" size={icon.s} color={on.secondary} />
      <Text style={[text.body, { flex: 1, color: on.secondary }]}>{message}</Text>
      {actionLabel && onAction && (
        <Pressable
          onPress={() => {
            onAction();
            onHide();
          }}
          style={styles.toastAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={[text.bodyStrong, { color: on.secondary, textDecorationLine: 'underline' }]}>{actionLabel}</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

// A small "Not synced" mark for items waiting to be sent.
export function PendingTag() {
  return (
    <View style={styles.row8} accessibilityLabel={t.common.notSynced}>
      <Icon name="upload" size={icon.s} color={colors.inkMuted} />
      <Text style={text.caption}>{t.common.notSynced}</Text>
    </View>
  );
}

// ---------- structure ----------

// Top bar of a sub-screen. The Android back button does the same as the on-screen one.
export function ScreenHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);
  return (
    <View style={{ backgroundColor: colors.background }}>
      <View style={styles.header}>
        <IconButton icon="back" label={t.common.back} onPress={onBack} tone="surface" />
        <Text style={[text.heading, styles.flex]} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        {right}
      </View>
      <OfflineBanner />
    </View>
  );
}

// A bottom sheet: slides up; drag the handle down, tap outside or press back to close. Used for every form.
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const [y] = useState(() => new Animated.Value(600));
  const [mounted, setMounted] = useState(visible);
  // Mount as soon as it should show (state adjusted during render); unmount after the slide-out.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      y.setValue(600);
      animate(y, 0, motion.slow);
    } else if (mounted) {
      animate(y, 600, motion.slow, () => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const [pan] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > space.s,
      onPanResponderMove: (_, g) => g.dy > 0 && y.setValue(g.dy),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 110 || g.vy > 1.2) onClose();
        else animate(y, 0, motion.fast);
      },
    }),
  );

  if (!mounted) return null;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel={t.common.close} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.sheetWrap} pointerEvents="box-none">
        <Animated.View style={[styles.sheet, shadow.float, { transform: [{ translateY: y }] }]}>
          <View {...pan.panHandlers} style={styles.sheetGrab}>
            <View style={styles.handle} />
            {!!title && (
              <View style={[styles.row8, { marginBottom: space.m }]}>
                <Text style={[text.heading, styles.flex]} accessibilityRole="header">
                  {title}
                </Text>
                <IconButton icon="close" label={t.common.close} onPress={onClose} />
              </View>
            )}
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetBody}>
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  row8: { flexDirection: 'row', alignItems: 'center', gap: space.s },

  button: {
    minHeight: 56,
    borderRadius: radius.pill,
    paddingHorizontal: space.l,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  iconBtn: { width: TAP, height: TAP, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },

  chip: { flexDirection: 'row', alignItems: 'center', gap: space.s, minHeight: TAP, paddingHorizontal: space.m, borderRadius: radius.pill },
  chipOutline: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },

  segment: { flexDirection: 'row', backgroundColor: colors.line, borderRadius: radius.pill, padding: space.s, marginBottom: space.m },
  segmentItem: { flex: 1, minHeight: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: colors.surface },

  card: { borderRadius: radius.card },

  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.l, marginBottom: space.s },
  sectionAction: { minHeight: TAP, justifyContent: 'center', paddingLeft: space.m },

  row: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 64, paddingVertical: space.s },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  strike: { textDecorationLine: 'line-through', color: colors.inkMuted },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    borderRadius: radius.pill,
    paddingHorizontal: space.m,
    minHeight: 32,
    alignSelf: 'flex-start',
    flexShrink: 1,
    backgroundColor: colors.surface,
  },
  dot: { width: space.s, height: space.s, borderRadius: radius.pill },

  stepper: { flexDirection: 'row' },
  step: { flex: 1, alignItems: 'center', gap: space.s },
  stepTrack: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  stepLine: { flex: 1, height: 3 },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    minHeight: 56,
    borderRadius: radius.small,
    backgroundColor: colors.surface,
    paddingLeft: space.m,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  input: {
    flex: 1,
    minHeight: 52,
    paddingRight: space.m,
    paddingVertical: space.s,
    fontFamily: fonts.body,
    fontSize: size.body,
    color: colors.ink,
    ...(Platform.OS === 'web' ? { outlineWidth: 0 } : null), // the border shows focus instead
  },
  eye: { width: TAP, height: TAP, alignItems: 'center', justifyContent: 'center' },
  errorRow: { alignItems: 'flex-start', marginBottom: space.m },

  skel: { borderRadius: radius.card, backgroundColor: colors.line },
  state: { alignItems: 'center', gap: space.s, paddingVertical: space.s },
  stateIcon: { width: 64, height: 64, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },

  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s,
    backgroundColor: colors.warningTint,
    paddingHorizontal: space.m,
    paddingVertical: space.s,
  },

  toast: {
    position: 'absolute',
    left: space.m,
    right: space.m,
    bottom: space.m,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    backgroundColor: colors.secondary,
    borderRadius: radius.pill,
    paddingLeft: space.m,
    minHeight: 56,
  },
  toastAction: { minWidth: TAP + space.l, height: 56, alignItems: 'center', justifyContent: 'center', paddingRight: space.s },

  header: { flexDirection: 'row', alignItems: 'center', gap: space.s, paddingTop: TOP_INSET, paddingHorizontal: space.m, paddingBottom: space.s },

  scrim: { ...StyleSheet.absoluteFill, backgroundColor: shade.scrim },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, maxHeight: '92%' },
  sheetGrab: { paddingTop: space.s, paddingHorizontal: space.l },
  handle: { alignSelf: 'center', width: 48, height: 4, borderRadius: radius.pill, backgroundColor: colors.line, marginBottom: space.s },
  sheetBody: { paddingHorizontal: space.l, paddingBottom: space.xl },
});

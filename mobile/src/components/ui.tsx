// The component kit. Every screen is built from these; colours, type and sizes come from theme.ts only.
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
import { colors, fonts, iconSize, motion, radius, shadow, spacing, stripe, TAP, text, TOP_INSET, type } from '../theme';
import { Icon, IconName } from './Icon';

// ---------- feel ----------

let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled()
  .then((v) => (reduceMotion = v))
  .catch(() => {});
AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => (reduceMotion = v));

export const haptic = {
  tap: () => Haptics.selectionAsync().catch(() => {}),
  press: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warn: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
};

// A Pressable that sinks slightly under the finger. Used for every tappable card, tile and button.
// One animated element, so layout styles (flex, margins) apply exactly as on a plain View.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
export function PressScale({
  style,
  children,
  onPressIn,
  onPressOut,
  scaleTo = 0.97,
  ...props
}: PressableProps & { style?: StyleProp<ViewStyle>; children: React.ReactNode; scaleTo?: number }) {
  const [scale] = useState(() => new Animated.Value(1));
  const to = (v: number) =>
    reduceMotion
      ? undefined
      : Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: v === 1 ? 6 : 0 }).start();
  return (
    <AnimatedPressable
      {...props}
      onPressIn={(e) => {
        to(scaleTo);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(1);
        onPressOut?.(e);
      }}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}

// ---------- buttons ----------

type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger' | 'sage' | 'ink';

const BUTTON: Record<ButtonVariant, { bg: string; fg: string }> = {
  primary: { bg: colors.primary, fg: colors.onPrimary },
  sage: { bg: colors.sage, fg: colors.onPrimary },
  danger: { bg: colors.danger, fg: colors.onPrimary },
  ink: { bg: colors.text, fg: colors.surface },
  secondary: { bg: colors.primarySoft, fg: colors.primaryInk },
  quiet: { bg: colors.sunken, fg: colors.text },
};

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  icon,
  size = 'lg',
  accessibilityLabel,
  accessibilityHint,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  icon?: IconName;
  size?: 'lg' | 'md';
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const v = BUTTON[variant];
  const off = disabled || loading;
  const fg = disabled && !loading ? colors.textDisabled : v.fg;
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
      style={[
        styles.button,
        size === 'md' && styles.buttonMd,
        { backgroundColor: disabled && !loading ? colors.sunken : v.bg },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.buttonInner}>
          {icon && <Icon name={icon} size={iconSize.inline} color={fg} />}
          <Text style={[styles.buttonText, { color: fg }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
      )}
    </PressScale>
  );
}

// A round icon-only button. Always has a spoken label.
export function IconButton({
  icon,
  label,
  onPress,
  tone = 'plain',
  size = TAP,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: 'plain' | 'soft' | 'primary' | 'danger';
  size?: number;
  disabled?: boolean;
}) {
  const bg = { plain: 'transparent', soft: colors.sunken, primary: colors.primary, danger: colors.danger }[tone];
  const fg = tone === 'primary' || tone === 'danger' ? colors.onPrimary : colors.text;
  return (
    <PressScale
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.9}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={[styles.iconBtn, { width: Math.max(size, TAP), height: Math.max(size, TAP) }]}
    >
      <View style={[styles.iconBtnFace, { width: size, height: size, backgroundColor: disabled ? colors.sunken : bg }]}>
        <Icon name={icon} size={iconSize.inline} color={disabled ? colors.textDisabled : fg} />
      </View>
    </PressScale>
  );
}

// ---------- chips and segmented control ----------

export function Chip({
  label,
  onPress,
  selected,
  icon,
  tone = 'plain',
  disabled,
  accessibilityLabel,
}: {
  label: string;
  onPress?: () => void;
  selected?: boolean;
  icon?: IconName;
  tone?: 'plain' | 'danger';
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const on = selected || tone === 'danger';
  const bg = tone === 'danger' ? colors.danger : selected ? colors.text : colors.surface;
  const fg = on ? colors.onPrimary : colors.text;
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
      style={[styles.chip, { backgroundColor: bg, opacity: disabled ? 0.5 : 1 }, !on && styles.chipLine]}
    >
      {icon && <Icon name={icon} size={18} color={fg} />}
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
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
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => {
              haptic.tap();
              onChange(o.key);
            }}
            style={[styles.segmentItem, on && styles.segmentOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
          >
            <Text style={[styles.segmentText, on && { color: colors.text }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- surfaces ----------

export type Tint = 'surface' | 'peach' | 'sage' | 'butter' | 'danger' | 'sunken';
export const TINT: Record<Tint, string> = {
  surface: colors.surface,
  peach: colors.primarySoft,
  sage: colors.sageSoft,
  butter: colors.butter,
  danger: colors.dangerSoft,
  sunken: colors.sunken,
};

// A soft panel. `raised` adds the one floating shadow (hero cards only). No borders.
export function Card({
  children,
  tint = 'surface',
  raised,
  padded = true,
  style,
}: {
  children: React.ReactNode;
  tint?: Tint;
  raised?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.card, { backgroundColor: TINT[tint] }, padded && styles.cardPad, raised && shadow.float, style]}>
      {children}
    </View>
  );
}

// The kanga-cloth band: the app's signature. Decorative, hidden from screen readers.
export function Stripe({ height = 6, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.stripe, { height }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {stripe.map((c, i) => (
        <View key={i} style={{ flex: i === 0 ? 3 : i === 2 ? 2 : 1, backgroundColor: c }} />
      ))}
    </View>
  );
}

// Section heading with an optional action on the right ("See all").
export function Section({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.section}>
      <Text style={text.h2} accessibilityRole="header">
        {title}
      </Text>
      {action && onAction && (
        <Pressable onPress={onAction} style={styles.sectionAction} accessibilityRole="button" accessibilityLabel={action}>
          <Text style={styles.link}>{action}</Text>
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
      <View style={{ flex: 1 }}>
        <Text style={[text.bodyStrong, strike && styles.strike]} numberOfLines={2}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={text.small} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
      {trailing}
      {onPress && !trailing && <Icon name="chevron-right" size={iconSize.inline} color={colors.textMuted} />}
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
const AVATAR_TINTS = [
  { bg: colors.primarySoft, fg: colors.primaryInk },
  { bg: colors.sageSoft, fg: colors.sage },
  { bg: colors.butter, fg: colors.butterInk },
];
export function Avatar({ name, size = 44, ring }: { name: string; size?: number; ring?: string }) {
  const n = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  const tint = AVATAR_TINTS[n % AVATAR_TINTS.length];
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: tint.bg },
        ring ? { borderWidth: 2.5, borderColor: ring } : null,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={{ fontFamily: fonts.display, fontSize: size * 0.42, color: tint.fg }}>{name.trim().charAt(0).toUpperCase()}</Text>
    </View>
  );
}

// A status in words with a dot, never colour alone.
export function StatusPill({
  label,
  tone,
  live,
}: {
  label: string;
  tone: 'sage' | 'butter' | 'danger' | 'quiet' | 'peach';
  live?: boolean;
}) {
  const map = {
    sage: { bg: colors.sageSoft, fg: colors.sage },
    butter: { bg: colors.butter, fg: colors.butterInk },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    quiet: { bg: colors.sunken, fg: colors.textMuted },
    peach: { bg: colors.primarySoft, fg: colors.primaryInk },
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: map.bg }]}>
      {live ? <LiveDot color={map.fg} /> : <View style={[styles.dot, { backgroundColor: map.fg }]} />}
      <Text style={[styles.pillText, { color: map.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// A softly pulsing dot for "live" states.
export function LiveDot({ color = colors.sage }: { color?: string }) {
  const pulse = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={{ width: 10, height: 10, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: color,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }],
        }}
      />
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  );
}

// ---------- data visuals ----------

// A progress ring with the figure in the middle.
export function Ring({
  value,
  total,
  size = 64,
  stroke = 7,
  color = colors.sage,
  track = colors.surface,
  children,
}: {
  value: number;
  total: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const share = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        {share > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c * share} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      {children}
    </View>
  );
}

// Live progress through a day, like an order tracker: done steps filled, the current one ringed.
export function Stepper({ steps, current, color = colors.sage }: { steps: string[]; current: number; color?: string }) {
  return (
    <View
      style={styles.stepper}
      accessible
      accessibilityLabel={`${steps[Math.max(0, current)] ?? ''}. Step ${current + 1} of ${steps.length}`}
    >
      {steps.map((s, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <View key={s} style={styles.step}>
            <View style={styles.stepTrack}>
              <View style={[styles.stepLine, { backgroundColor: i === 0 ? 'transparent' : i <= current ? color : colors.border }]} />
              <View
                style={[
                  styles.stepDot,
                  done && { backgroundColor: color, borderColor: color },
                  now && { borderColor: color, borderWidth: 4, backgroundColor: colors.surface },
                ]}
              />
              <View
                style={[
                  styles.stepLine,
                  { backgroundColor: i === steps.length - 1 ? 'transparent' : i < current ? color : colors.border },
                ]}
              />
            </View>
            <Text style={[styles.stepText, (done || now) && { color: colors.text }]} numberOfLines={1}>
              {s}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// A slim horizontal progress bar.
export function Bar({ share, color = colors.sage, track = colors.sunken }: { share: number; color?: string; track?: string }) {
  return (
    <View style={[styles.bar, { backgroundColor: track }]}>
      <View style={[styles.barFill, { width: `${Math.max(0, Math.min(100, share * 100))}%`, backgroundColor: color }]} />
    </View>
  );
}

// ---------- inputs ----------

type FieldProps = TextInputProps & { label: string; secure?: boolean; icon?: IconName };

// Filled input with its label above. `secure` adds a show/hide eye.
export const Field = forwardRef<TextInputInstance, FieldProps>(({ label, secure, icon, style, ...props }, ref) => {
  const [hidden, setHidden] = useState(true);
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, focus && styles.inputFocus]}>
        {icon && <Icon name={icon} size={iconSize.inline} color={colors.textMuted} />}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textMuted}
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
            <Icon name={hidden ? 'eye-outline' : 'eye-off-outline'} size={iconSize.inline} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
    </View>
  );
});

export function ErrorText({ children }: { children?: string }) {
  return children ? (
    <View style={styles.errorRow} accessibilityLiveRegion="polite">
      <Icon name="alert-circle-outline" size={18} color={colors.danger} />
      <Text style={styles.error}>{children}</Text>
    </View>
  ) : null;
}

// ---------- states ----------

// A skeleton while data loads: the shape of what is coming, gently breathing.
export function Loading({ label, lines = 3 }: { label: string; lines?: number }) {
  const fade = useState(() => new Animated.Value(0.5))[0];
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [fade]);
  return (
    <Animated.View style={{ opacity: fade, gap: spacing.ms }} accessible accessibilityLabel={label} accessibilityLiveRegion="polite">
      <View style={[styles.skel, { height: 132 }]} />
      {Array.from({ length: lines - 1 }, (_, i) => (
        <View key={i} style={[styles.skel, { height: 64, width: i % 2 ? '70%' : '100%' }]} />
      ))}
    </Animated.View>
  );
}

// What went wrong and a way to try again.
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card tint="danger">
      <View style={styles.state} accessibilityLiveRegion="polite">
        <View style={[styles.stateIcon, { backgroundColor: colors.surface }]}>
          <Icon name="wifi-strength-alert-outline" size={iconSize.large} color={colors.danger} />
        </View>
        <Text style={[text.body, { textAlign: 'center' }]}>{message}</Text>
        {onRetry && <Button title={t.common.tryAgain} variant="quiet" size="md" icon="refresh" onPress={onRetry} />}
      </View>
    </Card>
  );
}

// An empty list: a friendly icon, a short title, at most one line, and the action that fills it.
export function Empty({
  icon,
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
        <View style={styles.stateIcon}>
          <Icon name={icon} size={iconSize.large} color={colors.primaryInk} />
        </View>
        <Text style={[text.h2, { textAlign: 'center' }]}>{title}</Text>
        {!!body && <Text style={[text.small, { textAlign: 'center' }]}>{body}</Text>}
        {action && onAction && (
          <View style={{ alignSelf: 'stretch', marginTop: spacing.xs }}>
            <Button title={action} variant="secondary" size="md" onPress={onAction} />
          </View>
        )}
      </View>
    </Card>
  );
}

// Slim strip shown while the server can't be reached.
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <View style={styles.offline} accessibilityLiveRegion="polite" accessibilityRole="alert" accessibilityLabel={t.common.offlineLong}>
      <Icon name="cloud-off-outline" size={18} color={colors.butterInk} />
      <Text style={styles.offlineText}>{t.common.offline}</Text>
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
  const y = useState(() => new Animated.Value(reduceMotion ? 0 : 40))[0];
  const fade = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: motion.base, useNativeDriver: true }),
      Animated.spring(y, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 6 }),
    ]).start();
    const id = setTimeout(onHide, ms);
    return () => clearTimeout(id);
  }, [message, ms, onHide, fade, y]);
  return (
    <Animated.View
      style={[styles.toast, { opacity: fade, transform: [{ translateY: y }] }]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <Icon name="check-circle" size={iconSize.inline} color={colors.butter} />
      <Text style={styles.toastText}>{message}</Text>
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
          <Text style={styles.toastActionText}>{actionLabel}</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

// A small "Not synced" mark for items waiting to be sent.
export function PendingTag() {
  return (
    <View style={styles.pending} accessibilityLabel={t.common.notSynced}>
      <Icon name="cloud-upload-outline" size={14} color={colors.butterInk} />
      <Text style={styles.pendingText}>{t.common.notSynced}</Text>
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
        <IconButton icon="arrow-left" label={t.common.back} onPress={onBack} tone="soft" size={44} />
        <Text style={[text.h2, { flex: 1 }]} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        {right}
      </View>
      <OfflineBanner />
    </View>
  );
}

// Fixed area at the bottom of a screen for its one main action, within thumb reach.
export function BottomAction({ children }: { children: React.ReactNode }) {
  return <View style={styles.bottom}>{children}</View>;
}

// A bottom sheet: slides up, drag the handle down (or tap outside) to close. Used for every form.
export function Sheet({
  visible,
  onClose,
  title,
  children,
  scroll = true,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  scroll?: boolean;
}) {
  const y = useState(() => new Animated.Value(600))[0];
  const [mounted, setMounted] = useState(visible);
  // Mount as soon as it should show (state adjusted during render, not in an effect); unmount after the slide-out.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      y.setValue(reduceMotion ? 0 : 600);
      Animated.spring(y, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 4 }).start();
    } else if (mounted) {
      Animated.timing(y, { toValue: 600, duration: motion.fast + 60, useNativeDriver: true }).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const [pan] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6,
      onPanResponderMove: (_, g) => g.dy > 0 && y.setValue(g.dy),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 110 || g.vy > 1.2) onClose();
        else Animated.spring(y, { toValue: 0, useNativeDriver: true, speed: 20 }).start();
      },
    }),
  );

  if (!mounted) return null;
  const Body = scroll ? ScrollView : View;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel={t.common.close} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.sheetWrap} pointerEvents="box-none">
        <Animated.View style={[styles.sheet, shadow.float, { transform: [{ translateY: y }] }]}>
          <View {...pan.panHandlers} style={styles.sheetGrab}>
            <View style={styles.handle} />
            {!!title && (
              <View style={styles.sheetHead}>
                <Text style={[text.h1, { flex: 1 }]} accessibilityRole="header">
                  {title}
                </Text>
                <IconButton icon="close" label={t.common.close} onPress={onClose} tone="soft" size={40} />
              </View>
            )}
          </View>
          <Body
            {...(scroll ? { keyboardShouldPersistTaps: 'handled' as const, contentContainerStyle: styles.sheetBody } : { style: styles.sheetBody })}
          >
            {children}
          </Body>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  buttonMd: { minHeight: TAP },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  buttonText: { fontFamily: fonts.bodyBold, fontSize: type.body },
  iconBtn: { alignItems: 'center', justifyContent: 'center' },
  iconBtnFace: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  chipLine: { borderWidth: 1, borderColor: colors.border },
  chipText: { fontFamily: fonts.bodyBold, fontSize: type.small },

  segment: { flexDirection: 'row', backgroundColor: colors.sunken, borderRadius: radius.pill, padding: 4, marginBottom: spacing.md },
  segmentItem: { flex: 1, minHeight: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: colors.surface, ...shadow.float },
  segmentText: { fontFamily: fonts.bodyBold, fontSize: type.small, color: colors.textMuted },

  card: { borderRadius: radius.lg },
  cardPad: { padding: spacing.md + 4 },
  stripe: { flexDirection: 'row', borderRadius: radius.pill, overflow: 'hidden' },

  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.ms,
  },
  sectionAction: { minHeight: TAP, justifyContent: 'center', paddingLeft: spacing.md },
  link: { fontFamily: fonts.bodyBold, fontSize: type.small, color: colors.primaryInk },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms, minHeight: 64, paddingVertical: spacing.sm },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  strike: { textDecorationLine: 'line-through', color: colors.textMuted },

  avatar: { alignItems: 'center', justifyContent: 'center' },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.ms,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    flexShrink: 1,
  },
  pillText: { fontFamily: fonts.bodyBold, fontSize: type.small },
  dot: { width: 8, height: 8, borderRadius: 4 },

  stepper: { flexDirection: 'row' },
  step: { flex: 1, alignItems: 'center' },
  stepTrack: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  stepLine: { flex: 1, height: 3, borderRadius: 2 },
  stepDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  stepText: { ...text.caption, marginTop: 6 },

  bar: { height: 8, borderRadius: 4, overflow: 'hidden', alignSelf: 'stretch' },
  barFill: { height: '100%', borderRadius: 4 },

  label: { ...text.smallStrong, marginBottom: 6 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    borderRadius: radius.md,
    backgroundColor: colors.sunken,
    paddingLeft: spacing.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  inputFocus: { borderColor: colors.primary, backgroundColor: colors.surface },
  input: {
    flex: 1,
    minHeight: 52,
    paddingRight: spacing.md,
    paddingVertical: spacing.ms,
    fontFamily: fonts.body,
    fontSize: type.body,
    color: colors.text,
    ...(Platform.OS === 'web' ? { outlineWidth: 0 } : null), // the filled box shows focus instead
  },
  eye: { width: TAP + 4, height: TAP, alignItems: 'center', justifyContent: 'center' },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: spacing.md },
  error: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: type.small, color: colors.danger },

  skel: { borderRadius: radius.lg, backgroundColor: colors.sunken },
  state: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  stateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },

  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.butter,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  offlineText: { fontFamily: fonts.bodyBold, fontSize: type.small, color: colors.butterInk },

  toast: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.text,
    borderRadius: radius.pill,
    paddingLeft: spacing.md + 2,
    minHeight: 56,
    ...shadow.float,
  },
  toastText: { flex: 1, fontFamily: fonts.bodyMedium, color: colors.onPrimary, fontSize: type.body, paddingVertical: spacing.ms },
  toastAction: { minWidth: TAP + 24, height: 56, alignItems: 'center', justifyContent: 'center', paddingRight: spacing.sm },
  toastActionText: { fontFamily: fonts.bodyBold, color: colors.butter, fontSize: type.body },

  pending: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  pendingText: { fontFamily: fonts.bodyBold, fontSize: type.caption, color: colors.butterInk },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: TOP_INSET,
    paddingHorizontal: spacing.ms,
    paddingBottom: spacing.sm,
  },
  bottom: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.ms,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },

  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg + 4,
    borderTopRightRadius: radius.lg + 4,
    maxHeight: '92%',
  },
  sheetGrab: { paddingTop: spacing.sm, paddingHorizontal: spacing.lg },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong, marginBottom: spacing.sm },
  sheetHead: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  sheetBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
});

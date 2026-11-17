import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Modal, ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';
import { getEmergencies, handleEmergency } from '../api/client';
import { fmtTime, timeAgo } from '../format';
import { useEmergencyPush } from '../push';
import { colors, icon, on, radius, space, text, TOP_INSET } from '../theme';
import { Emergency } from '../types';
import { Icon } from './Icon';
import { Button } from './ui';

const POLL_MS = 8000;
const ALARM = [0, 900, 600]; // repeated while nobody has responded

// The full-screen alarm the family and caretakers get when an elderly person presses "I need help".
// It covers whatever screen is open and keeps vibrating until anyone in the circle handles it (here, on another
// phone or on the dashboard). That closes it for everyone: the others see who handled it, once. Shown again on the
// next emergency.
export function EmergencyAlert({ token }: { token: string }) {
  const [items, setItems] = useState<Emergency[]>([]);
  const [dismissed, setDismissed] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setItems(await getEmergencies(token));
    } catch {
      // offline or signed out: keep what we have; the next poll tries again
    }
  }, [token]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const id = setInterval(load, POLL_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && load());
    return () => {
      clearTimeout(first);
      clearInterval(id);
      sub.remove();
    };
  }, [load]);
  useEmergencyPush(load); // a push arriving while the app is open shows the alarm at once

  // The one to show: an open emergency first, then one someone else closed that I have not seen yet.
  const current =
    items.find((e) => e.status === 'open') ?? items.find((e) => !e.handled_by_me && !dismissed.includes(e.id)) ?? null;
  const ringing = !!current && current.status === 'open';
  const falseAlarm = current?.status === 'dismissed';

  useEffect(() => {
    if (!ringing) return;
    Vibration.vibrate(ALARM, true);
    return () => Vibration.cancel();
  }, [ringing]);

  if (!current) return null;
  const name = current.patient?.name ?? 'Someone';
  const first = name.split(' ')[0];
  const pos = current.position;

  async function respond(e: Emergency) {
    setBusy(true);
    setError('');
    try {
      const updated = await handleEmergency(token, e.id);
      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setDismissed((d) => [...d, e.id]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={() => {
        if (!ringing) setDismissed((d) => [...d, current.id]); // Back cannot silence an unanswered emergency
      }}>
      <ScrollView style={[styles.screen, !ringing && styles.calm]} contentContainerStyle={styles.content}>
        <View style={styles.badge}>
          <Icon name={ringing ? 'siren' : 'checkCircle'} size={icon.l} color={ringing ? colors.error : colors.ink} />
        </View>
        <Text style={[text.captionStrong, styles.onRed, !ringing && styles.onCalm]} accessibilityRole="header">
          {ringing ? 'EMERGENCY' : falseAlarm ? 'EMERGENCY · FALSE ALARM' : 'EMERGENCY · HANDLED'}
        </Text>
        <Text style={[text.display, styles.onRed, !ringing && styles.onCalm]} accessibilityLiveRegion="assertive">
          {ringing ? `${name} needs help` : falseAlarm ? `${current.handled_by} marked it a false alarm` : `${current.handled_by} is handling it`}
        </Text>
        <Text style={[text.body, styles.onRed, !ringing && styles.onCalm]}>
          {ringing
            ? `${first} pressed "I need help" at ${fmtTime(current.at)} (${timeAgo(current.at)}). Call them or go to them now.`
            : `${first} pressed "I need help" at ${fmtTime(current.at)}. ${current.handled_by} ${falseAlarm ? 'closed it' : 'responded'} at ${fmtTime(current.handled_at ?? current.at)}.`}
        </Text>

        <View style={styles.actions}>
          {ringing && (
            <Button title="I'm handling it" variant="light" icon="check" loading={busy} onPress={() => respond(current)} />
          )}
          <Button title="Call 922 (ambulance)" variant={ringing ? 'secondary' : 'danger'} icon="phone" onPress={() => Linking.openURL('tel:922')} />
          {pos && (
            <Button
              title={`Where ${first} is`}
              variant={ringing ? 'secondary' : 'soft'}
              icon="pin"
              onPress={() => Linking.openURL(`geo:${pos.latitude},${pos.longitude}?q=${pos.latitude},${pos.longitude}`)}
            />
          )}
          {!ringing && <Button title="OK" variant="primary" onPress={() => setDismissed((d) => [...d, current.id])} />}
        </View>
        {!!error && <Text style={[text.bodyStrong, styles.onRed]}>{error}</Text>}
        {ringing && (
          <Text style={[text.caption, styles.onRed]}>
            Your family and the other caretakers see this too. The first to respond is shown to everyone.
          </Text>
        )}
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.error },
  calm: { backgroundColor: colors.warningTint },
  content: { flexGrow: 1, justifyContent: 'center', padding: space.l, paddingTop: TOP_INSET + space.l, gap: space.m },
  badge: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.s,
  },
  onRed: { color: on.error },
  onCalm: { color: colors.ink },
  actions: { gap: space.s, marginTop: space.m },
});

import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { registerPushToken, unregisterPushToken } from './api/client';
import { colors } from './theme';

// Push notifications for new alerts and chat messages, sent by the backend straight to Firebase (FCM).
// Android only (the app ships as an Android APK). Everything here is best-effort: with no permission,
// no network, Expo Go, or a build without google-services.json, the app simply works without notifications.

const supported = Platform.OS === 'android';

if (supported) {
  // While the app is open, still show the banner: an alert is worth seeing even mid-screen.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

let registered: string | null = null; // this phone's Firebase token, once the server has it
let session: string | null = null; // the signed-in account, for when Firebase replaces the token
let watching = false;

// Android channels must exist before a notification can use them (ids match backend/care/push.py).
async function createChannels() {
  await Notifications.setNotificationChannelAsync('alerts', {
    name: 'Alerts',
    importance: AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: colors.secondary,
  });
  await Notifications.setNotificationChannelAsync('messages', {
    name: 'Messages',
    importance: AndroidImportance.DEFAULT,
  });
}

// Ask once for permission and tell the server where to reach this phone. Safe to call on every sign-in.
export async function registerForPush(sessionToken: string): Promise<void> {
  if (!supported) return;
  try {
    await createChannels(); // Android 13+: the permission prompt only appears once a channel exists
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;

    session = sessionToken;
    const { data } = await Notifications.getDevicePushTokenAsync(); // the FCM registration token
    await registerPushToken(sessionToken, data);
    registered = data;

    // Firebase sometimes replaces a phone's token; pass the new one on so notifications keep arriving.
    if (!watching) {
      watching = true;
      Notifications.addPushTokenListener(({ data: next }) => {
        if (!session || typeof next !== 'string' || next === registered) return;
        registerPushToken(session, next)
          .then(() => (registered = next))
          .catch(() => {});
      });
    }
  } catch {
    // No Firebase config, offline, or Expo Go: carry on without notifications; retried at next sign-in.
  }
}

// On sign out: stop notifications for this account on this phone. Never holds up signing out.
export async function unregisterForPush(sessionToken: string): Promise<void> {
  const token = registered;
  registered = null;
  session = null;
  if (!token) return;
  await Promise.race([unregisterPushToken(sessionToken, token).catch(() => {}), new Promise((r) => setTimeout(r, 3000))]);
}

export type PushTap = { type: 'alert'; kind: string } | { type: 'chat'; from: string; name: string };

function read(response: Notifications.NotificationResponse): PushTap | null {
  const { data, title } = response.notification.request.content;
  if (data?.type === 'chat' && typeof data.from === 'string') return { type: 'chat', from: data.from, name: title ?? data.from };
  if (data?.type === 'alert') return { type: 'alert', kind: String(data.kind ?? '') };
  return null;
}

// Calls `onTap` when a notification is tapped: one that opened the app from closed, and any later one.
export function usePushTap(onTap: (tap: PushTap) => void) {
  const handler = useRef(onTap);
  useEffect(() => {
    handler.current = onTap;
  });

  useEffect(() => {
    if (!supported) return;
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      Notifications.clearLastNotificationResponse(); // handle it once, not on every remount
      const tap = read(last);
      if (tap) handler.current(tap);
    }
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      Notifications.clearLastNotificationResponse();
      const tap = read(response);
      if (tap) handler.current(tap);
    });
    return () => sub.remove();
  }, []);
}

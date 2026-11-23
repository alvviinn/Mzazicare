import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

// See android/.../MicKeeperModule.kt. Android only; elsewhere (and in Expo Go) these do nothing.
type Native = {
  start(title: string, body: string): boolean;
  stop(): void;
  isRunning(): boolean;
  batteryUnrestricted(): boolean;
  askBatteryUnrestricted(): boolean;
  setResumeReminder(on: boolean, title: string, body: string): boolean;
};
const native = Platform.OS === 'android' ? requireOptionalNativeModule<Native>('MzaziMicKeeper') : null;

export function startMicKeeper(title: string, body: string): boolean {
  try {
    return native?.start(title, body) ?? false;
  } catch {
    return false;
  }
}

export function stopMicKeeper() {
  try {
    native?.stop();
  } catch {
    /* not running */
  }
}

// True when the app may record with the screen off (always true off Android, where this is not needed).
export function canRecordInBackground(): boolean {
  if (!native) return Platform.OS !== 'android';
  try {
    return native.isRunning();
  } catch {
    return false;
  }
}

// True when Android's battery saving leaves MzaziCare alone ("Unrestricted"). Battery saving is what puts the app
// to sleep after it has not been opened for a while, stopping location sharing and shifts.
export function batteryUnrestricted(): boolean {
  if (!native) return true;
  try {
    return native.batteryUnrestricted();
  } catch {
    return true;
  }
}

// Shows Android's "Let MzaziCare always run in the background?" question (or the battery settings).
export function askBatteryUnrestricted(): boolean {
  try {
    return native?.askBatteryUnrestricted() ?? false;
  } catch {
    return false;
  }
}

// While on, a phone restart or app update shows a "tap to turn MzaziCare back on" notification.
export function setResumeReminder(on: boolean, title = '', body = '') {
  try {
    native?.setResumeReminder(on, title, body);
  } catch {
    /* not available (Expo Go, older build) */
  }
}

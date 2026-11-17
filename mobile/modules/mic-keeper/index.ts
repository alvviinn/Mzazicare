import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

// See android/.../MicKeeperModule.kt. Android only; elsewhere (and in Expo Go) these do nothing.
type Native = { start(title: string, body: string): boolean; stop(): void; isRunning(): boolean };
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

import { AudioModule, AudioQuality, getRecordingPermissionsAsync, IOSOutputFormat, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { File } from 'expo-file-system';
import { AppState, Platform } from 'react-native';
import { canRecordInBackground, startMicKeeper, stopMicKeeper } from '../../modules/mic-keeper';
import { getAudioStatus, sendAudioClip, SESSION_EXPIRED, setVoiceConsent } from '../api/client';
import { loadSession } from '../auth/session';
import { AudioStatus } from '../types';

// Voice monitoring that keeps working with the app in the background or the screen off.
// It records short clips ONLY while the server says a verified visit is running and both people agreed;
// the server is the only switch. Each clip is uploaded, then deleted from the phone.
//
// It does not rely on JS timers (Android pauses them in the background). It is driven by:
//  - the background location task, which calls voiceTick() on every fix (about every 15 s);
//  - the recorder's own "finished" event (the clip length is enforced natively), which starts the next clip;
//  - the open screen, which also ticks while it is shown.
// On Android the microphone may only be used in the background while our "microphone" foreground service
// runs (modules/mic-keeper); it is started while the app is open and voice monitoring is agreed.

// AAC in an .m4a. Native (flattened) options: the hook-free recorder takes them as they are.
const OPTIONS = {
  extension: '.m4a',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 48000,
  isMeteringEnabled: false,
  ...(Platform.OS === 'ios'
    ? { outputFormat: IOSOutputFormat.MPEG4AAC, audioQuality: AudioQuality.MEDIUM }
    : { outputFormat: 'mpeg4', audioEncoder: 'aac' }),
};

type Recorder = InstanceType<typeof AudioModule.AudioRecorder>;

export type VoiceState = {
  consent: boolean | null; // null until the server has answered
  reason: AudioStatus['reason'] | '';
  recording: boolean; // the microphone is on right now
  micDenied: boolean;
};

const KEEPER_TEXT = {
  en: {
    title: 'MzaziCare voice check is on',
    body: 'The microphone turns on only during a verified care visit, because you both agreed. Turn it off in the app.',
  },
  sw: {
    title: 'Ukaguzi wa sauti wa MzaziCare umewashwa',
    body: 'Kipaza sauti huwashwa tu wakati wa ziara ya matunzo iliyothibitishwa, kwa sababu nyote mmekubali. Kizime ndani ya programu.',
  },
};

const INITIAL: VoiceState = { consent: null, reason: '', recording: false, micDenied: false };
let state: VoiceState = INITIAL;
const listeners = new Set<(s: VoiceState) => void>();
let lang: 'en' | 'sw' = 'en';
let checking = false;
let clip: { rec: Recorder; token: string; startedAt: number; limitS: number; done: boolean; sub: { remove(): void } } | null = null;
let signedOut = false;

function update(patch: Partial<VoiceState>) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn(state));
}

export const getVoiceState = () => state;
export function onVoice(fn: (s: VoiceState) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export function setVoiceLanguage(l: 'en' | 'sw') {
  lang = l;
}

const onScreen = () => AppState.currentState === 'active';

// Ask the server whether to record, and start a clip if so. Safe to call often; overlapping calls are dropped.
export async function voiceTick(tokenArg?: string) {
  if (checking) return;
  if (clip) {
    // A clip that never reported "finished" (e.g. Android paused it): end it ourselves.
    if (Date.now() - clip.startedAt > (clip.limitS + 15) * 1000) await finishClip(clip, true);
    return;
  }
  checking = true;
  try {
    const token = tokenArg ?? (await loadSession())?.token;
    if (!token) return;
    signedOut = false;
    const status = await getAudioStatus(token);
    update({ consent: status.consent, reason: status.reason });

    if (!status.consent) {
      stopMicKeeper(); // not agreed: no microphone service, no notification
      return;
    }
    // Agreed: while the app is open, make sure we may record later with the screen off.
    let permission = await getRecordingPermissionsAsync();
    if (!permission.granted && onScreen() && status.record) permission = await requestRecordingPermissionsAsync();
    update({ micDenied: !permission.granted && status.record });
    if (!permission.granted) return;
    if (onScreen()) startMicKeeper(KEEPER_TEXT[lang].title, KEEPER_TEXT[lang].body);

    if (!status.record) return;
    if (!onScreen() && !canRecordInBackground()) return; // Android would only hand us silence
    await startClip(token, status.chunk_s);
  } catch (e) {
    if (e instanceof Error && e.message === SESSION_EXPIRED) stopMicKeeper();
    /* offline, or the server refused: try again on the next tick */
  } finally {
    checking = false;
  }
}

async function startClip(token: string, seconds: number) {
  await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
  // The same constructor expo-audio's useAudioRecorder uses (a native class, so the linter cannot see it).
  // eslint-disable-next-line import/namespace
  const rec = new AudioModule.AudioRecorder(OPTIONS as never);
  const current = {
    rec,
    token,
    startedAt: Date.now(),
    limitS: seconds,
    done: false,
    sub: rec.addListener('recordingStatusUpdate', (s) => {
      if (s.isFinished || s.hasError) finishClip(current, false);
    }),
  };
  clip = current;
  try {
    await rec.prepareToRecordAsync();
    rec.record({ forDuration: seconds }); // stops by itself, natively, then emits "finished"
    update({ recording: true });
  } catch (e) {
    await finishClip(current, false);
    throw e;
  }
}

async function finishClip(c: NonNullable<typeof clip>, force: boolean) {
  if (c.done) return;
  c.done = true;
  if (force || c.rec.isRecording) await c.rec.stop().catch(() => {});
  c.sub.remove();
  const uri = c.rec.uri;
  try {
    c.rec.release();
  } catch {
    /* already released */
  }
  if (clip === c) clip = null;
  update({ recording: false });
  await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
  if (uri) {
    const file = new File(uri);
    try {
      if (!signedOut) await sendAudioClip(c.token, await file.arrayBuffer());
    } catch {
      /* offline: this clip is lost, the visit time is not affected */
    } finally {
      try {
        file.delete(); // the recording never stays on the phone
      } catch {
        /* already gone */
      }
    }
  }
  if (!signedOut) voiceTick(c.token); // ask again straight away: the visit may have ended
}

// A clip cut by the app going to the background is ended and sent; the next one starts in the background.
AppState.addEventListener('change', (next) => {
  if (next !== 'active' && clip) finishClip(clip, true);
  if (next === 'active') voiceTick();
});

export async function setConsent(token: string, agree: boolean) {
  const result = await setVoiceConsent(token, agree);
  update({ consent: result.consent });
  if (!result.consent) {
    stopMicKeeper();
    if (clip) await finishClip(clip, true);
  }
  voiceTick(token);
}

// On sign-out: stop recording and the microphone service.
export async function stopVoice() {
  signedOut = true;
  stopMicKeeper();
  if (clip) await finishClip(clip, true);
  update(INITIAL);
}

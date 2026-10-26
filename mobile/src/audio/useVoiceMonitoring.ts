import { AudioQuality, IOSOutputFormat, RecordingOptions, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { File } from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getAudioStatus, sendAudioClip, setVoiceConsent } from '../api/client';
import { AudioStatus } from '../types';

// AAC in an .m4a on both platforms. The server decodes it, analyses the tone and drops the audio.
const OPTIONS: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 48000,
  android: { outputFormat: 'mpeg4', audioEncoder: 'aac' },
  ios: { outputFormat: IOSOutputFormat.MPEG4AAC, audioQuality: AudioQuality.MEDIUM },
  web: {},
};

const CHECK_MS = 8000; // how often to ask the server whether to record

export type Voice = {
  consent: boolean | null; // null until the server has answered
  reason: AudioStatus['reason'] | '';
  recording: boolean; // the microphone is on right now
  micDenied: boolean;
  setConsent: (agree: boolean) => Promise<void>;
};

// Records short clips on this phone, but ONLY while the server says a verified visit is running and both
// people have agreed. The server is the only switch: at home, off shift or without consent the answer is "no"
// and the microphone is never opened. Each clip is uploaded, then deleted from the phone.
export function useVoiceMonitoring(token: string): Voice {
  const recorder = useAudioRecorder(OPTIONS);
  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;

  const [consent, setConsentState] = useState<boolean | null>(null);
  const [reason, setReason] = useState<Voice['reason']>('');
  const [recording, setRecording] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const wake = useRef<(() => void) | null>(null);

  useEffect(() => {
    let stopped = false;
    const pause = (ms: number) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, ms);
        wake.current = () => {
          clearTimeout(timer);
          resolve();
        };
      });

    async function recordOneClip(seconds: number) {
      const rec = recorderRef.current;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      try {
        await rec.prepareToRecordAsync();
        rec.record();
        setRecording(true);
        await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
        await rec.stop();
      } finally {
        setRecording(false);
        await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      }
      const uri = rec.uri;
      if (!uri) return;
      const file = new File(uri);
      try {
        await sendAudioClip(token, await file.arrayBuffer());
      } finally {
        try {
          file.delete(); // the recording never stays on the phone
        } catch {
          /* already gone */
        }
      }
    }

    (async () => {
      while (!stopped) {
        try {
          const status = await getAudioStatus(token);
          if (stopped) break;
          setConsentState(status.consent);
          setReason(status.reason);
          if (status.record && AppState.currentState === 'active') {
            const permission = await requestRecordingPermissionsAsync();
            if (!permission.granted) {
              setMicDenied(true);
              await pause(30000);
              continue;
            }
            setMicDenied(false);
            await recordOneClip(status.chunk_s);
            continue; // ask again straight away: the visit may have ended
          }
        } catch {
          /* offline, or the clip was refused: just ask again later */
        }
        await pause(CHECK_MS);
      }
    })();

    return () => {
      stopped = true;
      wake.current?.();
      if (recorderRef.current.isRecording) recorderRef.current.stop().catch(() => {});
    };
  }, [token]);

  const setConsent = useCallback(
    async (agree: boolean) => {
      const result = await setVoiceConsent(token, agree);
      setConsentState(result.consent);
      wake.current?.(); // re-check at once instead of waiting for the next round
    },
    [token],
  );

  return { consent, reason, recording, micDenied, setConsent };
}

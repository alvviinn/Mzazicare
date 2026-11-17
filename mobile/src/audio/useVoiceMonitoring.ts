import { useCallback, useEffect, useState } from 'react';
import { getVoiceState, onVoice, setConsent as saveConsent, setVoiceLanguage, voiceTick, VoiceState } from './voiceService';

const CHECK_MS = 8000; // while the screen is shown; in the background the location task ticks instead

export type Voice = VoiceState & { setConsent: (agree: boolean) => Promise<void> };

// Shows the state of voice monitoring (voiceService.ts), which keeps running after this screen closes.
export function useVoiceMonitoring(token: string, lang: 'en' | 'sw' = 'en'): Voice {
  const [state, setState] = useState<VoiceState>(getVoiceState);

  useEffect(() => {
    setVoiceLanguage(lang);
  }, [lang]);

  useEffect(() => {
    const stop = onVoice(setState);
    voiceTick(token);
    const id = setInterval(() => voiceTick(token), CHECK_MS);
    return () => {
      stop();
      clearInterval(id);
    };
  }, [token]);

  const setConsent = useCallback((agree: boolean) => saveConsent(token, agree), [token]);

  return { ...state, setConsent };
}

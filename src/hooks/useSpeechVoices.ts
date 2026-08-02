import { useState, useEffect, useCallback } from 'react';
import { AudioService } from '../services/audioService';

/**
 * useSpeechVoices
 * Loads and tracks the browser's available TTS voices (the list can arrive
 * asynchronously on Chrome/Edge). Exposes a chosen voice (explicit voiceURI,
 * else a preferred natural English voice) plus a reload() to refresh.
 */
export function useSpeechVoices(voiceURI?: string) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() =>
    AudioService.getVoices()
  );
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const refresh = () => setVoices(AudioService.getVoices());

    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => {
      window.speechSynthesis?.removeEventListener("voiceschanged", refresh);
    };
  }, [reloadToken]);

  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  const selectedVoice = AudioService.selectVoice(voiceURI);

  return { voices, selectedVoice, reload };
}

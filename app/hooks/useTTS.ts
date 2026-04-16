"use client";

import { useRef, useCallback } from "react";

interface UseTTSOptions {
  getAudioContext: () => AudioContext;
  onStart: () => void;
  onEnd: () => void;
  onError: () => void;
}

/**
 * Streams TTS audio from /api/tts.
 * Plays via Web Audio API (AudioContext) for iOS compatibility.
 */
export function useTTS({ getAudioContext, onStart, onEnd, onError }: UseTTSOptions) {
  const abortRef = useRef<AbortController | null>(null);

  const speak = useCallback(async (text: string) => {
    // Cancel any in-progress speech
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        onError();
        return;
      }

      onStart();

      // Collect all audio data (streaming decode is complex, buffer then play)
      const arrayBuffer = await res.arrayBuffer();

      if (abort.signal.aborted) return;

      const ctx = getAudioContext();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      if (abort.signal.aborted) return;

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => {
        onEnd();
      };
      source.start();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return; // interrupted intentionally
      }
      onError();
    }
  }, [getAudioContext, onStart, onEnd, onError]);

  const interrupt = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  return { speak, interrupt };
}

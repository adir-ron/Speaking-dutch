"use client";

import { useRef, useCallback } from "react";

interface UseTTSOptions {
  getAudioContext: () => AudioContext;
  onStart: () => void;
  onEnd: () => void;
  onError: () => void;
}

/**
 * Sentence-level TTS pipeline.
 *
 * speakChunk(text): append text to pending buffer; when buffer contains
 *   a sentence terminator (. ? ! \n), flush that sentence to /api/tts,
 *   queue the returned audio, and play queued clips sequentially.
 *
 * flush(): flush any trailing text (no terminator) as a final clip.
 *
 * speak(text): convenience for non-streaming callers. Calls speakChunk + flush.
 *
 * interrupt(): abort pending fetches and stop playback.
 */
export function useTTS({ getAudioContext, onStart, onEnd, onError }: UseTTSOptions) {
  // Pending text buffer (accumulates across speakChunk calls until a terminator)
  const pendingRef = useRef("");

  // Queue of audio buffers waiting to play (in order of arrival)
  const queueRef = useRef<AudioBuffer[]>([]);

  // True while a source is actively playing
  const playingRef = useRef(false);

  // Track inflight /api/tts fetches so we know when we're "fully done"
  const inflightRef = useRef(0);

  // True once any clip has started (so we don't re-fire onStart)
  const startedRef = useRef(false);

  // Abort controller for active fetches
  const abortRef = useRef<AbortController | null>(null);

  // Currently playing source (so interrupt can stop it)
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Sentence-terminator regex. Captures up through terminator so we can
  // split off the first complete sentence.
  const SENTENCE_RE = /^([\s\S]*?[.?!\n])\s*/;

  function resetState() {
    pendingRef.current = "";
    queueRef.current = [];
    playingRef.current = false;
    inflightRef.current = 0;
    startedRef.current = false;
    currentSourceRef.current = null;
  }

  function maybeEnd() {
    // Called after each clip ends. If nothing is pending, playing, or inflight, we're done.
    if (
      !playingRef.current &&
      inflightRef.current === 0 &&
      queueRef.current.length === 0 &&
      pendingRef.current.trim() === ""
    ) {
      if (startedRef.current) {
        startedRef.current = false;
        onEnd();
      }
    }
  }

  function playNextFromQueue() {
    if (playingRef.current) return;
    const next = queueRef.current.shift();
    if (!next) {
      maybeEnd();
      return;
    }

    playingRef.current = true;
    if (!startedRef.current) {
      startedRef.current = true;
      onStart();
    }

    const ctx = getAudioContext();
    const source = ctx.createBufferSource();
    source.buffer = next;
    source.connect(ctx.destination);
    source.onended = () => {
      playingRef.current = false;
      currentSourceRef.current = null;
      playNextFromQueue();
    };
    currentSourceRef.current = source;
    source.start();
  }

  async function fetchAndQueue(text: string, abort: AbortController) {
    inflightRef.current += 1;
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: abort.signal,
      });

      if (!res.ok) {
        onError();
        return;
      }

      const arrayBuffer = await res.arrayBuffer();
      if (abort.signal.aborted) return;

      const ctx = getAudioContext();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      if (abort.signal.aborted) return;

      queueRef.current.push(audioBuffer);
      playNextFromQueue();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      onError();
    } finally {
      inflightRef.current -= 1;
      maybeEnd();
    }
  }

  const speakChunk = useCallback((chunk: string) => {
    if (!abortRef.current) {
      abortRef.current = new AbortController();
    }
    const abort = abortRef.current;

    pendingRef.current += chunk;

    // Flush every complete sentence from the pending buffer
    while (true) {
      const match = pendingRef.current.match(SENTENCE_RE);
      if (!match) break;
      const sentence = match[1].trim();
      pendingRef.current = pendingRef.current.slice(match[0].length);
      if (sentence) {
        fetchAndQueue(sentence, abort);
      }
    }
  }, [getAudioContext, onStart, onEnd, onError]);

  const flush = useCallback(() => {
    if (!abortRef.current) {
      abortRef.current = new AbortController();
    }
    const abort = abortRef.current;

    const leftover = pendingRef.current.trim();
    pendingRef.current = "";
    if (leftover) {
      fetchAndQueue(leftover, abort);
    } else {
      // Nothing left to flush, but we may still have inflight/queued clips.
      maybeEnd();
    }
  }, [getAudioContext, onStart, onEnd, onError]);

  const speak = useCallback((text: string) => {
    speakChunk(text);
    flush();
  }, [speakChunk, flush]);

  const interrupt = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch {
        // already stopped
      }
      currentSourceRef.current = null;
    }
    resetState();
  }, []);

  return { speak, speakChunk, flush, interrupt };
}

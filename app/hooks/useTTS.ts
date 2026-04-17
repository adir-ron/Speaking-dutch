"use client";

import { useRef, useCallback } from "react";

interface UseTTSOptions {
  getAudioContext: () => AudioContext;
  onStart: () => void;
  onEnd: () => void;
  onError: (detail?: string) => void;
}

type Task = { audio: AudioBuffer } | { pending: Promise<AudioBuffer | null> };

/**
 * Sentence-level TTS pipeline.
 *
 * speakChunk(text): append text to pending buffer; when buffer contains
 *   a sentence terminator, flush that sentence to /api/tts and queue it.
 *
 * flush(): flush trailing partial text (no terminator) as a final clip.
 *
 * speak(text): convenience for non-streaming callers.
 *
 * interrupt(): abort and stop playback.
 *
 * Playback runs on a single chain: tasks are played strictly in enqueue order,
 * waiting for each audio fetch to resolve before continuing.
 */
export function useTTS({ getAudioContext, onStart, onEnd, onError }: UseTTSOptions) {
  const pendingTextRef = useRef("");
  const tasksRef = useRef<Task[]>([]);
  const runningRef = useRef(false); // whether the play loop is active
  const startedRef = useRef(false); // whether onStart fired
  const streamEndedRef = useRef(false); // whether flush() was called
  const abortRef = useRef<AbortController | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  function getAbort(): AbortController {
    if (!abortRef.current) abortRef.current = new AbortController();
    return abortRef.current;
  }

  async function fetchClip(text: string, signal: AbortSignal): Promise<AudioBuffer | null> {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal,
      });
      if (!res.ok) {
        console.error("[tts] fetch failed", res.status);
        onError(`TTS ${res.status}`);
        return null;
      }
      const arrayBuffer = await res.arrayBuffer();
      if (signal.aborted) return null;
      const ctx = getAudioContext();
      return await ctx.decodeAudioData(arrayBuffer);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return null;
      console.error("[tts] fetch/decode error", err);
      onError(String(err));
      return null;
    }
  }

  async function runPlayLoop() {
    if (runningRef.current) return;
    runningRef.current = true;

    try {
      while (true) {
        const task = tasksRef.current.shift();
        if (!task) {
          // No tasks. If the stream has ended, we're done. Otherwise, wait briefly for more.
          if (streamEndedRef.current) break;
          await new Promise((r) => setTimeout(r, 40));
          continue;
        }

        // Resolve task to an AudioBuffer (either already ready or pending fetch).
        let audio: AudioBuffer | null;
        if ("audio" in task) {
          audio = task.audio;
        } else {
          audio = await task.pending;
        }
        if (!audio) continue; // fetch failed/aborted — skip

        if (!startedRef.current) {
          startedRef.current = true;
          onStart();
        }

        const ctx = getAudioContext();
        if (ctx.state === "suspended") {
          try { await ctx.resume(); } catch { /* ignore */ }
        }

        await new Promise<void>((resolve) => {
          const source = ctx.createBufferSource();
          source.buffer = audio;
          source.connect(ctx.destination);
          source.onended = () => {
            currentSourceRef.current = null;
            resolve();
          };
          currentSourceRef.current = source;
          try {
            source.start();
          } catch (err) {
            console.error("[tts] source.start failed", err);
            resolve();
          }
        });
      }
    } finally {
      runningRef.current = false;
      if (startedRef.current) {
        startedRef.current = false;
        onEnd();
      }
    }
  }

  function enqueueSentence(text: string) {
    const signal = getAbort().signal;
    const pending = fetchClip(text, signal);
    tasksRef.current.push({ pending });
    // Kick off the play loop (no-op if already running)
    void runPlayLoop();
  }

  const SENTENCE_RE = /^([\s\S]*?[.?!\n])\s*/;

  const speakChunk = useCallback((chunk: string) => {
    // Starting a new utterance: reset stream-ended flag if the previous one fully drained
    if (!runningRef.current && tasksRef.current.length === 0 && pendingTextRef.current === "") {
      streamEndedRef.current = false;
    }

    pendingTextRef.current += chunk;

    while (true) {
      const match = pendingTextRef.current.match(SENTENCE_RE);
      if (!match) break;
      const sentence = match[1].trim();
      pendingTextRef.current = pendingTextRef.current.slice(match[0].length);
      if (sentence) enqueueSentence(sentence);
    }
  }, [getAudioContext, onStart, onEnd, onError]);

  const flush = useCallback(() => {
    const leftover = pendingTextRef.current.trim();
    pendingTextRef.current = "";
    if (leftover) enqueueSentence(leftover);
    streamEndedRef.current = true;
    void runPlayLoop();
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
      try { currentSourceRef.current.stop(); } catch { /* ignore */ }
      currentSourceRef.current = null;
    }
    tasksRef.current = [];
    pendingTextRef.current = "";
    streamEndedRef.current = true; // drain the loop
  }, []);

  return { speak, speakChunk, flush, interrupt };
}

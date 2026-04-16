"use client";

import { useState, useRef, useCallback } from "react";
import type { MicState } from "@/app/components/MicButton";
import type { FeedbackItem } from "@/app/components/FeedbackPanel";
import { useAudioContext } from "./useAudioContext";
import { useDeepgram } from "./useDeepgram";
import { useTTS } from "./useTTS";

interface SessionData {
  session_id: string;
  target_item: {
    id: string;
    label: string;
    opening_lines: string[];
  };
}

const MAX_TURNS = 7;
const MAX_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Orchestrates the full session loop:
 * start -> (tap to record -> transcribe -> Claude responds -> TTS plays) x N -> end
 */
export function useSession() {
  const [micState, setMicState] = useState<MicState>("idle");
  const [statusText, setStatusText] = useState("Tap to start");
  const [hintText, setHintText] = useState<string | undefined>("about 5 minutes");
  const [errorText, setErrorText] = useState<string | undefined>();
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);

  const sessionRef = useRef<SessionData | null>(null);
  const turnCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const transcriptRef = useRef<Array<{ role: string; text: string; ts: string }>>([]);

  const { getContext, unlock } = useAudioContext();

  const endSession = useCallback(async () => {
    if (!sessionRef.current) return;
    setMicState("ended");
    setStatusText("Session complete");
    setHintText(undefined);
    setSessionActive(false);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Show feedback panel with approximate data
    setFeedbackVisible(true);
    setAnalyzing(true);

    const approxItems: FeedbackItem[] = [];
    const turns = transcriptRef.current;
    const userTurns = turns.filter((t) => t.role === "user").length;
    if (userTurns > 0) {
      approxItems.push({
        glyph: "correct",
        text: `${userTurns} exchanges completed`,
      });
    }
    setFeedbackItems(approxItems);

    // End session on server (triggers async analyzer)
    try {
      const res = await fetch("/api/session/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionRef.current.session_id }),
      });

      if (res.ok) {
        // Poll for analyzer results
        pollAnalysis(sessionRef.current.session_id);
      }
    } catch {
      // Session data is already saved per-turn, so this is non-critical
      setAnalyzing(false);
    }
  }, []);

  const handleTranscript = useCallback(async (text: string) => {
    if (!sessionRef.current) return;

    setMicState("thinking");
    setStatusText("Buddy is thinking");
    setHintText(undefined);

    // Add user turn
    transcriptRef.current.push({ role: "user", text, ts: new Date().toISOString() });
    turnCountRef.current += 1;

    try {
      // Call Claude via session/turn route
      const res = await fetch("/api/session/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionRef.current.session_id,
          user_message: text,
          turn_index: turnCountRef.current,
        }),
      });

      if (!res.ok) {
        retryCountRef.current += 1;
        if (retryCountRef.current >= 2) {
          setMicState("error");
          setErrorText("Buddy needs a minute. Try again in a bit.");
          setHintText("your progress is saved");
          return;
        }
        setMicState("error");
        setErrorText("Buddy is thinking too hard");
        setHintText("tap to try again");
        return;
      }

      // Read the full response text
      const { buddy_text } = await res.json();

      // Add buddy turn
      transcriptRef.current.push({ role: "buddy", text: buddy_text, ts: new Date().toISOString() });
      retryCountRef.current = 0;

      // Check if we should end
      if (turnCountRef.current >= MAX_TURNS) {
        await endSession();
        return;
      }

      // Play TTS
      await speakFn(buddy_text);
    } catch {
      setMicState("error");
      setErrorText("Buddy is thinking too hard");
      setHintText("tap to try again");
    }
  }, [endSession]);

  const handleError = useCallback((error: string) => {
    setMicState("error");

    if (error.includes("microphone access")) {
      setErrorText("I need microphone access to hear you");
      setHintText("tap to open settings");
    } else {
      retryCountRef.current += 1;
      if (retryCountRef.current >= 2) {
        setErrorText("Can't seem to hear you today");
        setHintText("tap to end the session");
      } else {
        setErrorText("Having trouble hearing you");
        setHintText("tap to try again");
      }
    }
  }, []);

  const { startRecording, stopRecording, isRecording } = useDeepgram({
    onTranscript: (text) => {
      stopRecording();
      handleTranscript(text);
    },
    onError: handleError,
  });

  // Store speak function in a variable so endSession can reference it
  let speakFn: (text: string) => Promise<void>;

  const { speak, interrupt } = useTTS({
    getAudioContext: getContext,
    onStart: () => {
      setMicState("speaking");
      setStatusText("Buddy is speaking");
      setHintText("tap to interrupt");
    },
    onEnd: () => {
      setMicState("idle");
      setStatusText("Tap to speak");
      setHintText(undefined);
    },
    onError: () => {
      // TTS failure: show the text instead
      setMicState("idle");
      setStatusText("Tap to speak");
      setHintText(undefined);
    },
  });

  speakFn = speak;

  const handleTap = useCallback(async () => {
    // Unlock audio on first tap
    await unlock();

    // Not in a session yet: start one
    if (!sessionActive && micState === "idle") {
      try {
        const res = await fetch("/api/session/start", { method: "POST" });
        if (!res.ok) throw new Error("Failed to start session");

        const data: SessionData = await res.json();
        sessionRef.current = data;
        turnCountRef.current = 0;
        retryCountRef.current = 0;
        transcriptRef.current = [];
        setSessionActive(true);

        // Start 5-minute timer
        timerRef.current = setTimeout(() => {
          endSession();
        }, MAX_DURATION_MS);

        // Play opening line
        const openingLine = data.target_item.opening_lines[
          Math.floor(Math.random() * data.target_item.opening_lines.length)
        ];

        transcriptRef.current.push({
          role: "buddy",
          text: openingLine,
          ts: new Date().toISOString(),
        });

        await speak(openingLine);
      } catch {
        setMicState("error");
        setErrorText("Trouble starting. Try again.");
        setHintText(undefined);
      }
      return;
    }

    // During session: state-dependent behavior
    switch (micState) {
      case "idle":
        setMicState("recording");
        setStatusText("Listening");
        setHintText("tap again when done");
        await startRecording();
        break;

      case "recording":
        setMicState("transcribing");
        setStatusText("Got it");
        setHintText(undefined);
        stopRecording();
        break;

      case "speaking":
        // Interrupt TTS and start recording
        interrupt();
        setMicState("recording");
        setStatusText("Listening");
        setHintText("tap again when done");
        await startRecording();
        break;

      case "error":
        // Retry
        setErrorText(undefined);
        if (retryCountRef.current >= 2) {
          await endSession();
        } else {
          setMicState("idle");
          setStatusText("Tap to speak");
          setHintText(undefined);
        }
        break;

      default:
        break;
    }
  }, [sessionActive, micState, unlock, startRecording, stopRecording, interrupt, speak, endSession]);

  async function pollAnalysis(sessionId: string) {
    // Poll for analyzer completion (max 10 attempts, 2s apart)
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const res = await fetch(`/api/session/status?session_id=${sessionId}`);
        if (!res.ok) continue;
        const data = await res.json();
        if (data.analysis) {
          // Update feedback panel with real analysis
          const items: FeedbackItem[] = [];

          if (data.analysis.successes > 0) {
            items.push({
              glyph: "correct",
              text: `${data.analysis.successes}/${data.analysis.attempts} correct on ${sessionRef.current?.target_item.label}`,
            });
          }

          if (data.analysis.vocab_used_correctly?.length > 0) {
            items.push({
              glyph: "correct",
              text: `Used correctly: ${data.analysis.vocab_used_correctly.slice(0, 3).join(", ")}`,
            });
          }

          if (data.analysis.vocab_struggled?.length > 0) {
            items.push({
              glyph: "review",
              text: `Buddy will bring back: ${data.analysis.vocab_struggled.slice(0, 3).join(", ")}`,
            });
          }

          if (data.analysis.errors?.length > 0) {
            for (const err of data.analysis.errors.slice(0, 2)) {
              items.push({ glyph: "partial", text: err.note });
            }
          }

          setFeedbackItems(items.length > 0 ? items : [{ glyph: "correct", text: "Session complete. Keep it up." }]);
          setAnalyzing(false);
          return;
        }
      } catch {
        // continue polling
      }
    }
    setAnalyzing(false);
  }

  return {
    micState,
    statusText,
    hintText,
    errorText,
    feedbackItems,
    feedbackVisible,
    analyzing,
    handleTap,
  };
}

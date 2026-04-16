"use client";

import { useRef, useCallback, useEffect } from "react";

/**
 * Manages a shared AudioContext with iOS Safari unlock and visibilitychange resume.
 */
export function useAudioContext() {
  const ctxRef = useRef<AudioContext | null>(null);

  const getContext = useCallback((): AudioContext => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  }, []);

  const unlock = useCallback(async () => {
    const ctx = getContext();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
  }, [getContext]);

  // Resume on visibility change (iOS re-locks AudioContext when user switches apps)
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible" && ctxRef.current?.state === "suspended") {
        ctxRef.current.resume();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  return { getContext, unlock };
}

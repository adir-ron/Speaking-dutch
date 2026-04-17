"use client";

import { useRef, useCallback, useState } from "react";

interface UseDeepgramOptions {
  onTranscript: (text: string) => void;
  onError: (error: string) => void;
}

export function useDeepgram({ onTranscript, onError }: UseDeepgramOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptPartsRef = useRef<string[]>([]);
  const deliveredRef = useRef(false);
  const [isRecording, setIsRecording] = useState(false);

  function deliver() {
    if (deliveredRef.current) return;
    deliveredRef.current = true;

    const fullTranscript = transcriptPartsRef.current.join(" ").trim();
    // Clean up WS if still open
    if (wsRef.current) {
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    if (fullTranscript) {
      onTranscript(fullTranscript);
    } else {
      onError("Having trouble hearing you");
    }
  }

  const startRecording = useCallback(async () => {
    transcriptPartsRef.current = [];
    deliveredRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1 },
      });
      streamRef.current = stream;

      const tokenRes = await fetch("/api/deepgram/token");
      if (!tokenRes.ok) {
        onError("Failed to get speech token");
        return;
      }
      const { token } = await tokenRes.json();

      const ws = new WebSocket(
        `wss://api.deepgram.com/v1/listen?language=nl&model=nova-2&smart_format=true`,
        ["token", token],
      );
      wsRef.current = ws;

      ws.onopen = () => {
        // Detect supported mime type
        let mimeType = "audio/webm;codecs=opus";
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = "audio/webm";
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = "audio/mp4";
        }

        const recorder = new MediaRecorder(stream, { mimeType });
        recorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(e.data);
          }
        };

        recorder.start(250);
        setIsRecording(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.is_final && data.channel?.alternatives?.[0]?.transcript) {
            const text = data.channel.alternatives[0].transcript.trim();
            if (text) {
              transcriptPartsRef.current.push(text);
            }
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        deliver();
      };

      ws.onclose = () => {
        setIsRecording(false);
        // Give a tiny delay for any final messages that arrived just before close
        setTimeout(() => deliver(), 100);
      };
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        onError("I need microphone access to hear you");
      } else {
        onError("Having trouble hearing you");
      }
    }
  }, [onTranscript, onError]);

  const stopRecording = useCallback(() => {
    // Stop the recorder
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
      recorderRef.current = null;
    }

    // Stop mic tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    setIsRecording(false);

    // Tell Deepgram to flush remaining audio
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "CloseStream" }));
    }

    // Safety timeout: if Deepgram doesn't close within 1500ms, deliver what we have.
    // (800ms was too aggressive on mobile networks; Deepgram's flush can take ~1s.)
    setTimeout(() => deliver(), 1500);
  }, []);

  return { startRecording, stopRecording, isRecording };
}

"use client";

import { useRef, useCallback, useState } from "react";

interface UseDeepgramOptions {
  onTranscript: (text: string) => void;
  onError: (error: string) => void;
}

/**
 * Manages Deepgram STT via browser-direct WSS.
 * Collects all final transcript segments during recording.
 * On stop: flushes Deepgram, waits for final result, then fires onTranscript.
 */
export function useDeepgram({ onTranscript, onError }: UseDeepgramOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptPartsRef = useRef<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  const startRecording = useCallback(async () => {
    transcriptPartsRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000 },
      });
      streamRef.current = stream;

      const tokenRes = await fetch("/api/deepgram/token");
      if (!tokenRes.ok) {
        onError("Failed to get speech token");
        return;
      }
      const { token } = await tokenRes.json();

      const ws = new WebSocket(
        `wss://api.deepgram.com/v1/listen?language=nl&model=nova-2&smart_format=true&encoding=opus&sample_rate=48000`,
        ["token", token],
      );
      wsRef.current = ws;

      ws.onopen = () => {
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";

        const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64000 });
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
        const data = JSON.parse(event.data);
        if (data.is_final && data.channel?.alternatives?.[0]?.transcript) {
          const text = data.channel.alternatives[0].transcript.trim();
          if (text) {
            transcriptPartsRef.current.push(text);
          }
        }
      };

      ws.onerror = () => {
        onError("Having trouble hearing you");
      };

      // When Deepgram closes the connection (after we send CloseStream),
      // deliver the collected transcript
      ws.onclose = () => {
        setIsRecording(false);
        const fullTranscript = transcriptPartsRef.current.join(" ").trim();
        if (fullTranscript) {
          onTranscript(fullTranscript);
        } else {
          // No speech detected
          onError("Having trouble hearing you");
        }
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
    // Stop the MediaRecorder (stops sending audio chunks)
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
      recorderRef.current = null;
    }

    // Stop mic
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    // Tell Deepgram to flush and close. The onclose handler delivers the transcript.
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "CloseStream" }));
      // Deepgram will close the WS after flushing, which triggers onclose -> onTranscript
    }
  }, []);

  return { startRecording, stopRecording, isRecording };
}

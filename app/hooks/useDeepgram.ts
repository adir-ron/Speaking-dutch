"use client";

import { useRef, useCallback, useState } from "react";

interface UseDeepgramOptions {
  onTranscript: (text: string) => void;
  onError: (error: string) => void;
}

/**
 * Manages Deepgram STT via browser-direct WSS.
 * Fetches a short-lived JWT from /api/deepgram/token, opens WSS,
 * streams MediaRecorder chunks, and fires onTranscript on SpeechFinal.
 */
export function useDeepgram({ onTranscript, onError }: UseDeepgramOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const startRecording = useCallback(async () => {
    try {
      // Get mic access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
        },
      });
      streamRef.current = stream;

      // Fetch short-lived token
      const tokenRes = await fetch("/api/deepgram/token");
      if (!tokenRes.ok) {
        onError("Failed to get speech token");
        return;
      }
      const { token } = await tokenRes.json();

      // Open WSS to Deepgram
      const ws = new WebSocket(
        `wss://api.deepgram.com/v1/listen?language=nl&model=nova-2&smart_format=true&encoding=opus&sample_rate=48000`,
        ["token", token],
      );
      wsRef.current = ws;

      ws.onopen = () => {
        // Start MediaRecorder once WS is open
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";

        const recorder = new MediaRecorder(stream, {
          mimeType,
          audioBitsPerSecond: 64000,
        });
        recorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(e.data);
          }
        };

        recorder.start(250); // send chunks every 250ms
        setIsRecording(true);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.is_final && data.channel?.alternatives?.[0]?.transcript) {
          const transcript = data.channel.alternatives[0].transcript.trim();
          if (transcript) {
            onTranscript(transcript);
          }
        }
      };

      ws.onerror = () => {
        onError("Having trouble hearing you");
      };

      ws.onclose = () => {
        setIsRecording(false);
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
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    if (wsRef.current) {
      // Send close message to Deepgram
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "CloseStream" }));
      }
      wsRef.current.close();
      wsRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  }, []);

  return { startRecording, stopRecording, isRecording };
}

"use client";

export type MicState = "idle" | "recording" | "transcribing" | "thinking" | "speaking" | "error" | "ended";

interface Props {
  state: MicState;
  onTap: () => void;
  statusText: string;
  hintText?: string;
  errorText?: string;
}

const ARIA_LABELS: Record<MicState, string> = {
  idle: "Tap to start",
  recording: "Stop recording",
  transcribing: "Transcribing",
  thinking: "Thinking",
  speaking: "Interrupt and speak",
  error: "Tap to retry",
  ended: "Session ended",
};

export default function MicButton({ state, onTap, statusText, hintText, errorText }: Props) {
  const isError = state === "error";
  const isEnded = state === "ended";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      {/* Mic button with decorations */}
      <div style={{ position: "relative", width: 168, height: 168 }}>
        {/* Recording rings */}
        {state === "recording" && (
          <>
            <div className="recording-ring" style={ringStyle} />
            <div className="recording-ring" style={ringStyle} />
            <div className="recording-ring" style={ringStyle} />
          </>
        )}

        {/* Sound waves (speaking) */}
        {state === "speaking" && (
          <>
            <div className="sound-wave" style={waveStyle} />
            <div className="sound-wave" style={waveStyle} />
          </>
        )}

        {/* Main button */}
        <button
          className={`mic-button ${isEnded ? "mic-session-ended" : ""}`}
          data-state={state}
          onClick={onTap}
          disabled={state === "transcribing" || isEnded}
          aria-label={ARIA_LABELS[state] || "Microphone"}
          style={{
            position: "relative",
            width: 168,
            height: 168,
            borderRadius: "50%",
            border: "none",
            cursor: state === "transcribing" || isEnded ? "default" : "pointer",
            background: state === "recording" ? "var(--state-rec)" : "var(--bg-card)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1,
          }}
        >
          {/* Icon content by state */}
          {state === "idle" && <MicIcon color="var(--accent)" />}
          {state === "recording" && (
            <div style={{ position: "relative" }}>
              <MicIcon color="white" />
              <div
                className="red-dot"
                style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--state-rec-dot)",
                }}
              />
            </div>
          )}
          {state === "transcribing" && <MicIcon color="var(--ink-whisper)" />}
          {state === "thinking" && <ThinkingDots />}
          {state === "speaking" && <EqBars />}
          {state === "error" && <MicIcon color="var(--accent-deep)" />}
          {state === "ended" && <MicIcon color="var(--ink-whisper)" />}
        </button>
      </div>

      {/* Status text */}
      <div
        aria-live="polite"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          textAlign: "center",
        }}
      >
        <span
          className="font-sans"
          style={{
            fontSize: 14,
            fontWeight: 500,
            letterSpacing: "-0.005em",
            color: isError ? "var(--accent-deep)" : "var(--ink)",
          }}
        >
          {errorText || statusText}
        </span>
        {hintText && (
          <span
            className="font-serif"
            style={{
              fontSize: 13,
              fontStyle: "italic",
              color: "var(--ink-whisper)",
            }}
          >
            {hintText}
          </span>
        )}
      </div>
    </div>
  );
}

// Sub-components

function MicIcon({ color }: { color: string }) {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="1" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <line x1="8" y1="21" x2="16" y2="21" />
    </svg>
  );
}

function ThinkingDots() {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="thinking-dot"
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "var(--accent)",
          }}
        />
      ))}
    </div>
  );
}

function EqBars() {
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "end", height: 24 }}>
      {[16, 24, 20, 24, 16].map((h, i) => (
        <div
          key={i}
          className="eq-bar"
          style={{
            width: 4,
            height: h,
            borderRadius: 2,
            background: "var(--accent)",
            transformOrigin: "bottom",
          }}
        />
      ))}
    </div>
  );
}

const ringStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  borderRadius: "50%",
  border: "2px solid var(--state-rec)",
  opacity: 0,
};

const waveStyle: React.CSSProperties = {
  position: "absolute",
  inset: -8,
  borderRadius: "50%",
  border: "1.5px solid var(--accent)",
  opacity: 0,
};

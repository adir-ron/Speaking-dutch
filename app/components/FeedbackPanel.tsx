"use client";

export interface FeedbackItem {
  glyph: "correct" | "partial" | "review";
  text: string;
}

interface Props {
  items: FeedbackItem[];
  analyzing: boolean;
  visible: boolean;
}

const GLYPHS: Record<FeedbackItem["glyph"], { char: string; color: string }> = {
  correct: { char: "\u2713", color: "var(--accent)" },
  partial: { char: "\u25CB", color: "var(--ink-whisper)" },
  review: { char: "\u21BB", color: "var(--accent)" },
};

export default function FeedbackPanel({ items, analyzing, visible }: Props) {
  if (!visible) return null;

  return (
    <div
      className={visible ? "panel-enter" : ""}
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--rule)",
        borderRadius: 14,
        padding: "16px 20px",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Eyebrow */}
      <span
        className="font-sans"
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--ink-whisper)",
          display: "block",
          marginBottom: 12,
        }}
      >
        WHAT BUDDY NOTICED
        {analyzing && (
          <span style={{ fontWeight: 400, letterSpacing: "normal", textTransform: "none", marginLeft: 8 }}>
            analyzing...
          </span>
        )}
      </span>

      {/* Items or empty state */}
      {items.length === 0 ? (
        <p
          className="font-serif"
          style={{
            fontSize: 15,
            fontWeight: 400,
            fontStyle: "italic",
            color: "var(--ink-soft)",
            lineHeight: 1.4,
          }}
        >
          Your feedback from today&apos;s conversation will show up here.
        </p>
      ) : (
        <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((item, i) => {
            const g = GLYPHS[item.glyph];
            return (
              <li
                key={i}
                style={{ display: "flex", gap: 12, alignItems: "baseline" }}
              >
                <span
                  style={{
                    fontSize: 16,
                    color: g.color,
                    flexShrink: 0,
                    width: 16,
                    textAlign: "center",
                  }}
                >
                  {g.char}
                </span>
                <span
                  className="font-sans"
                  style={{
                    fontSize: 14,
                    fontWeight: 400,
                    lineHeight: 1.45,
                    color: "var(--ink)",
                  }}
                >
                  {item.text}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

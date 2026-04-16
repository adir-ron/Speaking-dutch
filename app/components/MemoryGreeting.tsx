import type { MemoryGreeting as GreetingData } from "@/lib/memory-greeting";

interface Props {
  greeting: GreetingData;
}

export default function MemoryGreeting({ greeting }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Day pill */}
      {greeting.dayLabel && (
        <div style={{ display: "flex" }}>
          <span
            className="font-sans"
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              background: "var(--accent-wash)",
              color: "var(--accent-deep)",
              padding: "6px 10px",
              borderRadius: 999,
            }}
          >
            {greeting.dayLabel}
          </span>
        </div>
      )}

      {/* Eyebrow */}
      <span
        className="font-sans"
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--ink-whisper)",
        }}
      >
        {greeting.eyebrow}
      </span>

      {/* Memory text */}
      <p
        className="font-serif"
        style={{
          fontSize: 30,
          fontWeight: 400,
          lineHeight: 1.2,
          letterSpacing: "-0.015em",
          color: "var(--ink)",
        }}
        dangerouslySetInnerHTML={{ __html: greeting.memory }}
      />

      {/* Today continuation */}
      <p
        className="font-serif"
        style={{
          fontSize: 21,
          fontWeight: 400,
          fontStyle: "italic",
          lineHeight: 1.3,
          color: "var(--ink-soft)",
        }}
      >
        {greeting.today}
      </p>
    </div>
  );
}

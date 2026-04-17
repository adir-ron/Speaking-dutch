"use client";

import BrandWordmark from "@/app/components/BrandWordmark";
import MemoryGreeting from "@/app/components/MemoryGreeting";
import MicButton from "@/app/components/MicButton";
import FeedbackPanel from "@/app/components/FeedbackPanel";
import { useSession } from "@/app/hooks/useSession";
import type { MemoryGreeting as GreetingData } from "@/lib/memory-greeting";

interface Props {
  greeting: GreetingData;
  targetItem: {
    id: string;
    label: string;
    openingLines: string[];
  };
}

export default function HomeClient({ greeting, targetItem }: Props) {
  const {
    micState,
    statusText,
    hintText,
    errorText,
    buddyText,
    feedbackItems,
    feedbackVisible,
    analyzing,
    handleTap,
  } = useSession();

  // Hide the Dutch text strip while actively recording (distraction)
  // and before the first utterance (nothing to show).
  const showBuddyText = !!buddyText && micState !== "recording" && micState !== "transcribing";

  return (
    <div
      className="app-padding"
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        paddingTop: 56,
        paddingBottom: 40,
        gap: 32,
        background: "var(--bg)",
      }}
    >
      {/* Brand */}
      <BrandWordmark />

      {/* Memory greeting */}
      <MemoryGreeting greeting={greeting} />

      {/* Mic button (centered) */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
        }}
      >
        <MicButton
          state={micState}
          onTap={handleTap}
          statusText={statusText}
          hintText={hintText}
          errorText={errorText}
        />

        {/* Buddy's last Dutch utterance (subtitle-style, for reading along) */}
        {showBuddyText && (
          <p
            lang="nl"
            className="font-serif"
            style={{
              fontSize: 18,
              lineHeight: 1.4,
              fontStyle: "italic",
              color: "var(--ink-soft)",
              textAlign: "center",
              maxWidth: 360,
              padding: "0 8px",
            }}
          >
            {buddyText}
          </p>
        )}
      </div>

      {/* Feedback panel */}
      <FeedbackPanel
        items={feedbackItems}
        analyzing={analyzing}
        visible={feedbackVisible}
      />
    </div>
  );
}

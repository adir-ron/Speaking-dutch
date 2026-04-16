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
    feedbackItems,
    feedbackVisible,
    analyzing,
    handleTap,
  } = useSession();

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
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MicButton
          state={micState}
          onTap={handleTap}
          statusText={statusText}
          hintText={hintText}
          errorText={errorText}
        />
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

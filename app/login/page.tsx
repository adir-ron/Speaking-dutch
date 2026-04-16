"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const sent = searchParams.get("sent") === "true";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await signIn("email", { email, callbackUrl: "/" });
  }

  if (sent) {
    return (
      <div className="phone" style={{ background: "var(--bg)" }}>
        <div
          className="app-padding"
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            minHeight: "100vh",
            gap: 16,
          }}
        >
          <p
            className="font-serif"
            style={{ fontSize: 30, lineHeight: 1.2, letterSpacing: "-0.015em", color: "var(--ink)" }}
          >
            Check your email.
          </p>
          <p
            className="font-serif"
            style={{ fontSize: 21, lineHeight: 1.3, color: "var(--ink-soft)", fontStyle: "italic" }}
          >
            We sent you a magic link to sign in.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="phone" style={{ background: "var(--bg)" }}>
      <div
        className="app-padding"
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          minHeight: "100vh",
          gap: 24,
        }}
      >
        {/* Brand wordmark */}
        <div
          className="font-serif"
          style={{
            fontSize: 18,
            fontWeight: 500,
            color: "var(--ink)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ color: "var(--accent)", fontSize: 10 }}>&#9679;</span>
          Speaking <em>Dutch</em>
        </div>

        <p
          className="font-serif"
          style={{ fontSize: 30, lineHeight: 1.2, letterSpacing: "-0.015em", color: "var(--ink)" }}
        >
          Sign in to start practicing.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className="font-sans"
            style={{
              padding: "12px 16px",
              fontSize: 14,
              border: "1px solid var(--rule)",
              borderRadius: 8,
              background: "var(--bg-card)",
              color: "var(--ink)",
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={loading}
            className="font-sans"
            style={{
              padding: "12px 24px",
              fontSize: 14,
              fontWeight: 500,
              background: "var(--accent)",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Sending link..." : "Send magic link"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

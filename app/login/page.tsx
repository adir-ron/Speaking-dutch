"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to send code");
      return;
    }
    setStep("code");
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Verification failed");
      return;
    }

    router.push("/");
    router.refresh();
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

        {step === "email" ? (
          <>
            <p
              className="font-serif"
              style={{ fontSize: 30, lineHeight: 1.2, letterSpacing: "-0.015em", color: "var(--ink)" }}
            >
              Sign in to start practicing.
            </p>
            <form onSubmit={handleSendCode} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoFocus
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
                {loading ? "Sending..." : "Send code"}
              </button>
            </form>
          </>
        ) : (
          <>
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
              Enter the 6-digit code we sent to {email}.
            </p>
            <form onSubmit={handleVerifyCode} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                required
                autoFocus
                autoComplete="one-time-code"
                className="font-sans"
                style={{
                  padding: "12px 16px",
                  fontSize: 24,
                  fontWeight: 600,
                  letterSpacing: "0.15em",
                  textAlign: "center",
                  border: "1px solid var(--rule)",
                  borderRadius: 8,
                  background: "var(--bg-card)",
                  color: "var(--ink)",
                  outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={loading || code.length !== 6}
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
                  opacity: loading || code.length !== 6 ? 0.7 : 1,
                }}
              >
                {loading ? "Verifying..." : "Sign in"}
              </button>
              <button
                type="button"
                onClick={() => { setStep("email"); setCode(""); setError(null); }}
                className="font-sans"
                style={{
                  padding: "8px",
                  fontSize: 13,
                  color: "var(--ink-whisper)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Use a different email
              </button>
            </form>
          </>
        )}

        {error && (
          <p className="font-sans" style={{ fontSize: 14, color: "var(--accent-deep)" }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

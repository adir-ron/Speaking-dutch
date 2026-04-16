import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;

// Force Node.js runtime (not Edge) for auth routes
export const runtime = "nodejs";

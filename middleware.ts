import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret");

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const publicPaths = ["/api/auth", "/api/health", "/api/debug", "/login", "/_next", "/favicon.ico"];
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));

  if (isPublic) {
    return NextResponse.next();
  }

  // Check JWT cookie
  const token = req.cookies.get("sd-session")?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    await jwtVerify(token, SECRET);
    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

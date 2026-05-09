import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const SESSION_COOKIE = "session_token";

export async function GET(): Promise<NextResponse> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? null;
  return NextResponse.json({ token });
}

export async function POST(request: Request): Promise<NextResponse> {
  const payload = (await request.json()) as { token?: string };
  const token = payload.token?.trim();

  if (!token) {
    return NextResponse.json({ error: "token_required" }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export async function DELETE(): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}

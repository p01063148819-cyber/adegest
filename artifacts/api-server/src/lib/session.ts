import jwt from "jsonwebtoken";
import type { Response } from "express";
import type { UserRole } from "@workspace/db";

if (!process.env.SESSION_SECRET) {
  throw new Error(
    "SESSION_SECRET must be set. Did you forget to configure the environment?",
  );
}

const JWT_SECRET = process.env.SESSION_SECRET;
const SESSION_COOKIE = "session";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface SessionPayload {
  role: UserRole;
}

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === "object" && decoded && "role" in decoded) {
      return { role: (decoded as { role: UserRole }).role };
    }
    return null;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, payload: SessionPayload): void {
  res.cookie(SESSION_COOKIE, signSession(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_MS,
    path: "/",
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export function readSessionCookie(cookies: Record<string, unknown> | undefined): SessionPayload | null {
  const token = cookies?.[SESSION_COOKIE];
  if (typeof token !== "string") return null;
  return verifySession(token);
}

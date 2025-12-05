import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { connectDB } from "@/lib/mongodb";
import { Session } from "@/models/session";
import { createSessionCookie, verifySessionCookie } from "./session-signature";

/**
 * Create a new session token, persist it, and return the cookie value.
 * Tokens are random IDs, signed for integrity, and validated against the DB.
 */
export async function createSessionToken(userId: string): Promise<string> {
  await connectDB();

  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await Session.findOneAndUpdate(
    { token: sessionId },
    { userId, token: sessionId, expiresAt },
    { upsert: true, new: true }
  );

  return createSessionCookie(sessionId, userId);
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<string | null> {
  const parsed = await verifySessionCookie(token);
  if (!parsed) return null;

  await connectDB();
  const session = await Session.findOne({
    token: parsed.sessionId,
    userId: parsed.userId,
    expiresAt: { $gt: new Date() },
  });

  return session ? session.userId : null;
}

export async function getSessionUserId(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get("session")?.value;
  return verifySessionToken(token);
}


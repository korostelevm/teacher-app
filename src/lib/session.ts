import { NextRequest } from "next/server";

const SESSION_SECRET = process.env.SESSION_SECRET || "dev-session-secret";

async function sign(userId: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(userId));
  const bytes = new Uint8Array(signature);
  // Base64url encode
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function createSessionToken(userId: string): Promise<string> {
  const signature = await sign(userId);
  return `${userId}.${signature}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [userId, signature] = parts;

  const expected = await sign(userId);
  return expected === signature ? userId : null;
}

export async function getSessionUserId(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get("session")?.value;
  return verifySessionToken(token);
}


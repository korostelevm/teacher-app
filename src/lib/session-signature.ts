const DEFAULT_SESSION_SECRET = "dev-session-secret";

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET || DEFAULT_SESSION_SECRET;
  if (secret === DEFAULT_SESSION_SECRET) {
    console.warn("[session] Using default SESSION_SECRET; set SESSION_SECRET in production.");
  }
  return secret;
}

async function sign(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  const bytes = new Uint8Array(signature);
  // Base64url encode
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Create the cookie value: sessionId.userId.signature */
export async function createSessionCookie(sessionId: string, userId: string): Promise<string> {
  const signature = await sign(`${sessionId}.${userId}`);
  return `${sessionId}.${userId}.${signature}`;
}

/** Verify cookie value structure and signature; returns { sessionId, userId } or null. */
export async function verifySessionCookie(
  token: string | undefined | null
): Promise<{ sessionId: string; userId: string } | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [sessionId, userId, signature] = parts;

  const expected = await sign(`${sessionId}.${userId}`);
  if (expected !== signature) return null;

  return { sessionId, userId };
}


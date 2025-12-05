import { verifySessionCookie } from "./session-signature";

/**
 * Edge-safe verification: signature only, no DB.
 */
export async function verifySessionTokenEdge(
  token: string | undefined | null
): Promise<string | null> {
  const parsed = await verifySessionCookie(token);
  return parsed?.userId ?? null;
}


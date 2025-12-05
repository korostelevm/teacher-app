"use client";

import { useEffect } from "react";
import LogRocket from "logrocket";

/**
 * Initializes LogRocket once on the client. Records on all hosts, including localhost.
 * App ID defaults to the reference project but can be overridden via env.
 */
export function LogRocketProvider() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const appId =
      process.env.NEXT_PUBLIC_LOGROCKET_APP_ID || "00tifr/magic-school";
    if (!appId) return;

    // Mirror the proxy setup from the reference project: default to the
    // CloudFront proxy unless overridden via env.
    const serverURL =
      process.env.NEXT_PUBLIC_LOGROCKET_SERVER_URL ||
      "https://d39tjlkpt25kc0.cloudfront.net/i";

    try {
      LogRocket.init(appId, serverURL ? { serverURL } : undefined);
    } catch (err) {
      console.warn("[logrocket] init failed", err);
    }
  }, []);

  return null;
}


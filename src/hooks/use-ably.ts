"use client";

import { useEffect, useRef, useState } from "react";
import Ably from "ably";

// Singleton Ably client instance shared across all components
let ablyClientInstance: Ably.Realtime | null = null;
let initPromise: Promise<Ably.Realtime> | null = null;

/**
 * Custom hook for managing Ably Realtime connection
 * 
 * Provides a singleton Ably connection that can be shared across components.
 * The connection is initialized once and reused across all hook calls.
 * 
 * @returns {Ably.Realtime | null} The Ably Realtime client instance, or null if not yet connected
 * 
 * @example
 * ```tsx
 * const ably = useAbly();
 * if (ably) {
 *   const channel = ably.channels.get("my-channel");
 *   channel.subscribe("event", handleMessage);
 * }
 * ```
 */
export function useAbly(): Ably.Realtime | null {
  const [client, setClient] = useState<Ably.Realtime | null>(ablyClientInstance);

  useEffect(() => {
    // If already initialized, use existing instance
    if (ablyClientInstance) {
      setClient(ablyClientInstance);
      return;
    }

    // If initialization is in progress, wait for it
    if (initPromise) {
      initPromise.then((instance) => {
        setClient(instance);
      });
      return;
    }

    // Start initialization
    initPromise = (async () => {
      try {
        // Create Ably Realtime client with auth URL
        // Ably will automatically request tokens from the auth endpoint
        const ablyClient = new Ably.Realtime({
          authUrl: "/api/ably-auth",
          authMethod: "GET",
        });

        ablyClient.connection.on("connected", () => {
          console.log("Ably connected");
        });

        ablyClient.connection.on("failed", (stateChange) => {
          console.error("Ably connection failed:", stateChange);
        });

        ablyClientInstance = ablyClient;
        setClient(ablyClient);
        return ablyClient;
      } catch (error) {
        console.error("Failed to initialize Ably:", error);
        initPromise = null;
        throw error;
      }
    })();

    initPromise.then((instance) => {
      setClient(instance);
    }).catch(() => {
      // Error already logged
    });

    // Note: We don't close the connection on unmount because it's shared
    // The connection will be closed when the page unloads
  }, []);

  return client;
}


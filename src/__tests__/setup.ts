/**
 * Vitest global setup
 */
import { vi } from "vitest";

// Mock environment variables
process.env.OPENAI_API_KEY = "test-api-key";
process.env.OPENAI_MODEL = "gpt-4o-mini";
process.env.ABLY_API_KEY = "test-ably-key";
process.env.MONGODB_URI = "mongodb://localhost:27017/test";

// Suppress console.log in tests (optional - comment out for debugging)
vi.spyOn(console, "log").mockImplementation(() => {});


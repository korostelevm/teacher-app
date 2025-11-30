import session from "express-session";
import MongoStore from "connect-mongo";
import { getMongoUri } from "./mongodb";

/**
 * Session configuration for Express/Passport
 * Uses MongoDB for session storage
 */
export const sessionConfig = session({
  secret: process.env.SESSION_SECRET || "your-secret-key-change-in-production",
  resave: false,
  saveUninitialized: false,
  store: new MongoStore({
    mongoUrl: getMongoUri(),
    touchAfter: 24 * 3600, // lazy session update (in seconds)
  }),
  cookie: {
    secure: process.env.NODE_ENV === "production", // use secure cookies in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
});


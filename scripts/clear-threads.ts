import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose from "mongoose";
import { Thread } from "../src/models/thread";
import { User } from "../src/models/user";

async function clearThreads() {
  try {
    const mongoUrl = process.env.MONGO_URL;
    if (!mongoUrl) {
      throw new Error("MONGO_URL environment variable is not set");
    }

    // Get email from command line args
    const email = process.argv[2];

    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUrl, {
      authSource: "admin",
      retryWrites: true,
      w: "majority",
    });
    console.log("✓ Connected to MongoDB");

    if (email) {
      // Clear threads for specific user
      const user = await User.findOne({ email });
      if (!user) {
        console.error(`User with email "${email}" not found`);
        process.exit(1);
      }

      console.log(`Soft deleting threads for ${user.displayName} (${user.email})...`);
      const result = await Thread.updateMany(
        { ownerId: user._id, deletedAt: null },
        { $set: { deletedAt: new Date() } }
      );
      console.log(`✓ Soft deleted ${result.modifiedCount} threads`);
    } else {
      // Clear all threads
      console.log("Soft deleting ALL threads...");
      const result = await Thread.updateMany(
        { deletedAt: null },
        { $set: { deletedAt: new Date() } }
      );
      console.log(`✓ Soft deleted ${result.modifiedCount} threads`);
    }

    process.exit(0);
  } catch (error) {
    console.error("Error clearing threads:", error);
    process.exit(1);
  }
}

clearThreads();

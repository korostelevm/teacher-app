import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose from "mongoose";
import { User } from "../src/models/user";
import { Thread } from "../src/models/thread";
import { Message } from "../src/models/message";

async function listThreadsPerUser() {
  try {
    const mongoUrl = process.env.MONGO_URL;
    if (!mongoUrl) {
      throw new Error("MONGO_URL environment variable is not set");
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUrl, {
      authSource: "admin",
      retryWrites: true,
      w: "majority",
    });
    console.log("✓ Connected to MongoDB\n");

    // Get all users (excluding system user)
    const users = await User.find({ role: { $ne: "system" } }).sort({ createdAt: -1 });

    if (users.length === 0) {
      console.log("No users found.");
      process.exit(0);
    }

    console.log(`Found ${users.length} user(s):\n`);
    console.log("=".repeat(100));

    for (const user of users) {
      // Get active threads for this user
      const activeThreads = await Thread.find({ 
        ownerId: user._id, 
        deletedAt: null 
      }).sort({ updatedAt: -1 });

      console.log(`\n👤 ${user.displayName} (${user.email})`);
      console.log(`   User ID: ${user._id}`);
      console.log(`   Created: ${user.createdAt.toISOString()}`);
      
      console.log(`\n   Threads (${activeThreads.length}):`);
      if (activeThreads.length === 0) {
        console.log("   (none)");
      } else {
        for (const thread of activeThreads) {
          console.log(`\n   📁 [${thread._id}] "${thread.title}"`);
          console.log(`      Created: ${thread.createdAt.toISOString()}, Updated: ${thread.updatedAt.toISOString()}`);
          
          // Get messages for this thread
          const messages = await Message.find({ threadId: thread._id }).sort({ createdAt: 1 });
          console.log(`      Messages (${messages.length}):`);
          
          if (messages.length === 0) {
            console.log("      (no messages)");
          } else {
            for (const msg of messages) {
              const role = msg.role === "user" ? "👤" : "🤖";
              const preview = msg.content.length > 80 
                ? msg.content.substring(0, 80).replace(/\n/g, " ") + "..." 
                : msg.content.replace(/\n/g, " ");
              console.log(`      ${role} ${preview}`);
            }
          }
        }
      }

      console.log("\n" + "-".repeat(100));
    }

    // Summary
    const totalThreads = await Thread.countDocuments({ deletedAt: null });
    const totalMessages = await Message.countDocuments({});
    
    console.log("\n📊 Summary:");
    console.log(`   Total users: ${users.length}`);
    console.log(`   Total threads: ${totalThreads}`);
    console.log(`   Total messages: ${totalMessages}`);

    process.exit(0);
  } catch (error) {
    console.error("Error listing threads:", error);
    process.exit(1);
  }
}

listThreadsPerUser();

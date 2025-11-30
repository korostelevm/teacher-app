import mongoose from "mongoose";
import { User } from "../src/models/user";

async function initializeDatabase() {
  try {
    const mongoUrl = process.env.MONGO_URL || 
      `mongodb://${process.env.MONGOUSER}:${process.env.MONGOPASSWORD}@${process.env.MONGOHOST}:${process.env.MONGOPORT}/rag-takehome`;

    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUrl);
    console.log("✓ Connected to MongoDB");

    // Create indexes
    console.log("Creating indexes...");
    await User.collection.createIndex({ googleId: 1 });
    await User.collection.createIndex({ email: 1 });
    console.log("✓ Indexes created");

    console.log("✓ Database initialized successfully");
    process.exit(0);
  } catch (error) {
    console.error("Error initializing database:", error);
    process.exit(1);
  }
}

initializeDatabase();


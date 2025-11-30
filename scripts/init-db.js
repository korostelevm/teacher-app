require("dotenv").config({ path: ".env.local" });
const mongoose = require("mongoose");

async function initializeDatabase() {
  try {
    const mongoUrl = process.env.MONGO_URL || 
      `mongodb://${process.env.MONGOUSER}:${process.env.MONGOPASSWORD}@${process.env.MONGOHOST}:${process.env.MONGOPORT}/rag-takehome`;

    console.log("Connecting to MongoDB...");
    console.log("Connection URL:", mongoUrl.replace(/:[^@]*@/, ":***@"));
    
    await mongoose.connect(mongoUrl, {
      authSource: "admin",
      retryWrites: true,
      w: "majority",
    });
    console.log("✓ Connected to MongoDB");

    // Create indexes
    console.log("Creating indexes...");
    const db = mongoose.connection.db;
    await db.collection("users").createIndex({ googleId: 1 });
    await db.collection("users").createIndex({ email: 1 });
    console.log("✓ Indexes created");

    console.log("✓ Database initialized successfully");
    process.exit(0);
  } catch (error) {
    console.error("Error initializing database:", error.message);
    process.exit(1);
  }
}

initializeDatabase();

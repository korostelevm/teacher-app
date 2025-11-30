import { connectDB } from "@/lib/mongodb";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectDB();
    return NextResponse.json({ success: true, message: "MongoDB connected" });
  } catch (error) {
    console.error("[Init API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to connect to MongoDB" },
      { status: 500 }
    );
  }
}

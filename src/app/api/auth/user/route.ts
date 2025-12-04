import { NextRequest, NextResponse } from "next/server";
import { User } from "@/models/user";

/**
 * GET /api/auth/user
 * Returns current authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.cookies.get("userId")?.value;

    if (!userId) {
      return NextResponse.json({ user: null });
    }

    const user = await User.findById(userId);

    if (!user) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        _id: user._id.toString(),
        displayName: user.displayName,
        email: user.email,
        photo: user.photo,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json({ user: null });
  }
}


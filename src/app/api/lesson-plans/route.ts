import { NextRequest, NextResponse } from "next/server";
import { getUserLessonPlans } from "@/models/lesson-plan";
import { connectDB } from "@/lib/mongodb";
import { getSessionUserId } from "@/lib/session";

/**
 * GET /api/lesson-plans - Get all lesson plans for the current user
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const userId = await getSessionUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const lessonPlans = await getUserLessonPlans(userId);

    return NextResponse.json({
      lessonPlans: lessonPlans.map((lp) => ({
        id: lp._id.toString(),
        title: lp.title,
        gradeLevel: lp.gradeLevel,
        subject: lp.subject,
        status: lp.status,
        standards: lp.standards,
        objectives: lp.objectives,
        durationMinutes: lp.durationMinutes,
        createdAt: lp.createdAt.toISOString(),
        updatedAt: lp.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[LessonPlans API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch lesson plans" },
      { status: 500 }
    );
  }
}


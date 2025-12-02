import { z } from "zod";
import { registerTool } from "./registry";
import type { ToolContext } from "./types";
import {
  createLessonPlan,
  getLessonPlan,
  updateLessonPlan,
  deleteLessonPlan,
  getUserLessonPlans,
  getFullLessonPlan,
  createLessonActivity,
  updateLessonActivity,
  deleteLessonActivity,
  createLessonAssessment,
  createLessonDifferentiation,
  type ActivityType,
  type AssessmentType,
  type LearnerGroup,
} from "@/models/lesson-plan";

/**
 * Create a new lesson plan
 */
registerTool("createLessonPlan", {
  description: "Create a new lesson plan for the user. Returns the created lesson plan with its ID.",
  inputSchema: z.object({
    title: z.string().describe("Title of the lesson plan"),
    gradeLevel: z.enum(["6", "7", "8"]).describe("Grade level (6, 7, or 8)"),
    standards: z.array(z.string()).optional().describe("NC Math Standard codes (e.g., NC.6.NS.1)"),
    objectives: z.array(z.string()).optional().describe("Learning objectives for the lesson"),
    durationMinutes: z.number().optional().describe("Estimated total duration in minutes"),
    materials: z.array(z.string()).optional().describe("Materials and resources needed"),
    notes: z.string().optional().describe("Additional notes for the teacher"),
  }),
  execute: async (
    params: {
      title: string;
      gradeLevel: "6" | "7" | "8";
      standards?: string[];
      objectives?: string[];
      durationMinutes?: number;
      materials?: string[];
      notes?: string;
    },
    { ctx }: { ctx: ToolContext }
  ) => {
    const lessonPlan = await createLessonPlan({
      title: params.title,
      gradeLevel: parseInt(params.gradeLevel) as 6 | 7 | 8,
      ownerId: ctx.user._id,
      threadId: ctx.threadId,
      standards: params.standards,
      objectives: params.objectives,
      durationMinutes: params.durationMinutes,
      materials: params.materials,
      notes: params.notes,
    });

    return {
      success: true,
      lessonPlan: {
        id: lessonPlan._id.toString(),
        title: lessonPlan.title,
        gradeLevel: lessonPlan.gradeLevel,
        standards: lessonPlan.standards,
        objectives: lessonPlan.objectives,
        durationMinutes: lessonPlan.durationMinutes,
        materials: lessonPlan.materials,
        status: lessonPlan.status,
        notes: lessonPlan.notes,
      },
    };
  },
});

/**
 * List user's lesson plans
 */
registerTool("listLessonPlans", {
  description: "List all lesson plans for the current user. Can filter by status or grade level.",
  inputSchema: z.object({
    status: z.enum(["draft", "published", "archived"]).optional().describe("Filter by status"),
    gradeLevel: z.enum(["6", "7", "8"]).optional().describe("Filter by grade level"),
  }),
  execute: async (
    params: {
      status?: "draft" | "published" | "archived";
      gradeLevel?: "6" | "7" | "8";
    },
    { ctx }: { ctx: ToolContext }
  ) => {
    const options: { status?: "draft" | "published" | "archived"; gradeLevel?: 6 | 7 | 8 } = {};
    if (params.status) options.status = params.status;
    if (params.gradeLevel) options.gradeLevel = parseInt(params.gradeLevel) as 6 | 7 | 8;

    const lessonPlans = await getUserLessonPlans(ctx.user._id, options);

    return {
      count: lessonPlans.length,
      lessonPlans: lessonPlans.map((lp) => ({
        id: lp._id.toString(),
        title: lp.title,
        gradeLevel: lp.gradeLevel,
        status: lp.status,
        standards: lp.standards,
        updatedAt: lp.updatedAt.toISOString(),
      })),
    };
  },
});

/**
 * Get a specific lesson plan with all details
 */
registerTool("getLessonPlan", {
  description: "Get a specific lesson plan with all its activities, assessments, and differentiations.",
  inputSchema: z.object({
    lessonPlanId: z.string().describe("The ID of the lesson plan to retrieve"),
  }),
  execute: async (
    params: { lessonPlanId: string },
    { ctx }: { ctx: ToolContext }
  ) => {
    const fullPlan = await getFullLessonPlan(params.lessonPlanId);

    if (!fullPlan) {
      return { success: false, error: "Lesson plan not found" };
    }

    // Verify ownership
    if (fullPlan.lessonPlan.ownerId.toString() !== ctx.user._id.toString()) {
      return { success: false, error: "Access denied" };
    }

    return {
      success: true,
      lessonPlan: {
        id: fullPlan.lessonPlan._id.toString(),
        title: fullPlan.lessonPlan.title,
        gradeLevel: fullPlan.lessonPlan.gradeLevel,
        standards: fullPlan.lessonPlan.standards,
        objectives: fullPlan.lessonPlan.objectives,
        durationMinutes: fullPlan.lessonPlan.durationMinutes,
        materials: fullPlan.lessonPlan.materials,
        status: fullPlan.lessonPlan.status,
        notes: fullPlan.lessonPlan.notes,
        createdAt: fullPlan.lessonPlan.createdAt.toISOString(),
        updatedAt: fullPlan.lessonPlan.updatedAt.toISOString(),
      },
      activities: fullPlan.activities.map((a) => ({
        id: a._id.toString(),
        name: a.name,
        type: a.type,
        durationMinutes: a.durationMinutes,
        description: a.description,
        materials: a.materials,
        teacherNotes: a.teacherNotes,
        order: a.order,
      })),
      assessments: fullPlan.assessments.map((a) => ({
        id: a._id.toString(),
        type: a.type,
        name: a.name,
        description: a.description,
        successCriteria: a.successCriteria,
      })),
      differentiations: fullPlan.differentiations.map((d) => ({
        id: d._id.toString(),
        group: d.group,
        accommodations: d.accommodations,
        modifications: d.modifications,
      })),
    };
  },
});

/**
 * Update a lesson plan
 */
registerTool("updateLessonPlan", {
  description: "Update an existing lesson plan's details.",
  inputSchema: z.object({
    lessonPlanId: z.string().describe("The ID of the lesson plan to update"),
    title: z.string().optional().describe("New title"),
    standards: z.array(z.string()).optional().describe("Updated standards"),
    objectives: z.array(z.string()).optional().describe("Updated objectives"),
    durationMinutes: z.number().optional().describe("Updated duration"),
    materials: z.array(z.string()).optional().describe("Updated materials"),
    status: z.enum(["draft", "published", "archived"]).optional().describe("New status"),
    notes: z.string().optional().describe("Updated notes"),
  }),
  execute: async (
    params: {
      lessonPlanId: string;
      title?: string;
      standards?: string[];
      objectives?: string[];
      durationMinutes?: number;
      materials?: string[];
      status?: "draft" | "published" | "archived";
      notes?: string;
    },
    { ctx }: { ctx: ToolContext }
  ) => {
    // First check ownership
    const existing = await getLessonPlan(params.lessonPlanId);
    if (!existing) {
      return { success: false, error: "Lesson plan not found" };
    }
    if (existing.ownerId.toString() !== ctx.user._id.toString()) {
      return { success: false, error: "Access denied" };
    }

    const { lessonPlanId, ...updates } = params;
    const updatedPlan = await updateLessonPlan(lessonPlanId, updates);

    if (!updatedPlan) {
      return { success: false, error: "Failed to update lesson plan" };
    }

    return {
      success: true,
      lessonPlan: {
        id: updatedPlan._id.toString(),
        title: updatedPlan.title,
        gradeLevel: updatedPlan.gradeLevel,
        standards: updatedPlan.standards,
        objectives: updatedPlan.objectives,
        durationMinutes: updatedPlan.durationMinutes,
        materials: updatedPlan.materials,
        status: updatedPlan.status,
        notes: updatedPlan.notes,
      },
    };
  },
});

/**
 * Delete a lesson plan
 */
registerTool("deleteLessonPlan", {
  description: "Delete a lesson plan and all its associated activities, assessments, and differentiations.",
  inputSchema: z.object({
    lessonPlanId: z.string().describe("The ID of the lesson plan to delete"),
  }),
  execute: async (
    params: { lessonPlanId: string },
    { ctx }: { ctx: ToolContext }
  ) => {
    // First check ownership
    const existing = await getLessonPlan(params.lessonPlanId);
    if (!existing) {
      return { success: false, error: "Lesson plan not found" };
    }
    if (existing.ownerId.toString() !== ctx.user._id.toString()) {
      return { success: false, error: "Access denied" };
    }

    const deleted = await deleteLessonPlan(params.lessonPlanId);

    return {
      success: deleted,
      message: deleted ? "Lesson plan deleted successfully" : "Failed to delete lesson plan",
    };
  },
});

/**
 * Add an activity to a lesson plan
 */
registerTool("addLessonActivity", {
  description: "Add a new activity to an existing lesson plan.",
  inputSchema: z.object({
    lessonPlanId: z.string().describe("The ID of the lesson plan"),
    name: z.string().describe("Name of the activity"),
    type: z.enum(["hook", "instruction", "guided-practice", "independent-practice", "closure", "other"])
      .describe("Type of activity"),
    durationMinutes: z.number().describe("Duration in minutes"),
    description: z.string().describe("Description of what happens in this activity"),
    materials: z.array(z.string()).optional().describe("Materials needed for this activity"),
    teacherNotes: z.string().optional().describe("Notes for the teacher"),
  }),
  execute: async (
    params: {
      lessonPlanId: string;
      name: string;
      type: ActivityType;
      durationMinutes: number;
      description: string;
      materials?: string[];
      teacherNotes?: string;
    },
    { ctx }: { ctx: ToolContext }
  ) => {
    // Check ownership
    const existing = await getLessonPlan(params.lessonPlanId);
    if (!existing) {
      return { success: false, error: "Lesson plan not found" };
    }
    if (existing.ownerId.toString() !== ctx.user._id.toString()) {
      return { success: false, error: "Access denied" };
    }

    const activity = await createLessonActivity({
      lessonPlanId: params.lessonPlanId,
      name: params.name,
      type: params.type,
      durationMinutes: params.durationMinutes,
      description: params.description,
      materials: params.materials,
      teacherNotes: params.teacherNotes,
    });

    return {
      success: true,
      activity: {
        id: activity._id.toString(),
        name: activity.name,
        type: activity.type,
        durationMinutes: activity.durationMinutes,
        description: activity.description,
        materials: activity.materials,
        teacherNotes: activity.teacherNotes,
        order: activity.order,
      },
    };
  },
});

/**
 * Add an assessment to a lesson plan
 */
registerTool("addLessonAssessment", {
  description: "Add an assessment strategy to an existing lesson plan.",
  inputSchema: z.object({
    lessonPlanId: z.string().describe("The ID of the lesson plan"),
    type: z.enum(["formative", "summative"]).describe("Type of assessment"),
    name: z.string().describe("Name of the assessment"),
    description: z.string().describe("Description of the assessment"),
    successCriteria: z.array(z.string()).optional().describe("Observable criteria for success"),
  }),
  execute: async (
    params: {
      lessonPlanId: string;
      type: AssessmentType;
      name: string;
      description: string;
      successCriteria?: string[];
    },
    { ctx }: { ctx: ToolContext }
  ) => {
    // Check ownership
    const existing = await getLessonPlan(params.lessonPlanId);
    if (!existing) {
      return { success: false, error: "Lesson plan not found" };
    }
    if (existing.ownerId.toString() !== ctx.user._id.toString()) {
      return { success: false, error: "Access denied" };
    }

    const assessment = await createLessonAssessment({
      lessonPlanId: params.lessonPlanId,
      type: params.type,
      name: params.name,
      description: params.description,
      successCriteria: params.successCriteria,
    });

    return {
      success: true,
      assessment: {
        id: assessment._id.toString(),
        type: assessment.type,
        name: assessment.name,
        description: assessment.description,
        successCriteria: assessment.successCriteria,
      },
    };
  },
});

/**
 * Add differentiation strategy to a lesson plan
 */
registerTool("addLessonDifferentiation", {
  description: "Add a differentiation strategy for a specific learner group to an existing lesson plan.",
  inputSchema: z.object({
    lessonPlanId: z.string().describe("The ID of the lesson plan"),
    group: z.enum(["advanced", "struggling", "ell", "special-needs"])
      .describe("Target learner group"),
    accommodations: z.string().describe("Accommodations for this group"),
    modifications: z.string().optional().describe("Modifications to the lesson for this group"),
  }),
  execute: async (
    params: {
      lessonPlanId: string;
      group: LearnerGroup;
      accommodations: string;
      modifications?: string;
    },
    { ctx }: { ctx: ToolContext }
  ) => {
    // Check ownership
    const existing = await getLessonPlan(params.lessonPlanId);
    if (!existing) {
      return { success: false, error: "Lesson plan not found" };
    }
    if (existing.ownerId.toString() !== ctx.user._id.toString()) {
      return { success: false, error: "Access denied" };
    }

    const differentiation = await createLessonDifferentiation({
      lessonPlanId: params.lessonPlanId,
      group: params.group,
      accommodations: params.accommodations,
      modifications: params.modifications,
    });

    return {
      success: true,
      differentiation: {
        id: differentiation._id.toString(),
        group: differentiation.group,
        accommodations: differentiation.accommodations,
        modifications: differentiation.modifications,
      },
    };
  },
});


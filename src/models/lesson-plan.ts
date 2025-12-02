import mongoose, { Schema, Document, Types } from "mongoose";

// ============================================================================
// LessonPlan - The container with core metadata
// ============================================================================

export interface ILessonPlan extends Document {
  _id: Types.ObjectId;
  title: string;
  subject: "math";
  gradeLevel: 6 | 7 | 8;
  
  /** NC Math Standard codes this lesson aligns to (e.g., ["NC.6.NS.1", "NC.6.NS.2"]) */
  standards: string[];
  
  /** Learning objectives */
  objectives: string[];
  
  /** Estimated total duration in minutes */
  durationMinutes?: number;
  
  /** Materials and resources needed */
  materials: string[];
  
  /** Teacher who owns this plan */
  ownerId: Types.ObjectId;
  
  /** Optional: Thread where this was developed via chat */
  threadId?: Types.ObjectId;
  
  status: "draft" | "published" | "archived";
  notes?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const lessonPlanSchema = new Schema<ILessonPlan>(
  {
    title: { type: String, required: true },
    subject: { type: String, enum: ["math"], required: true, default: "math" },
    gradeLevel: { type: Number, enum: [6, 7, 8], required: true },
    standards: { type: [String], default: [] },
    objectives: { type: [String], default: [] },
    durationMinutes: { type: Number },
    materials: { type: [String], default: [] },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    threadId: {
      type: Schema.Types.ObjectId,
      ref: "Thread",
      index: true,
      sparse: true,
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },
    notes: { type: String },
  },
  { timestamps: true }
);

lessonPlanSchema.index({ ownerId: 1, status: 1 });
lessonPlanSchema.index({ gradeLevel: 1, status: 1 });

export const LessonPlan =
  mongoose.models.LessonPlan || mongoose.model<ILessonPlan>("LessonPlan", lessonPlanSchema);

// ============================================================================
// LessonActivity - Individual activities within a lesson
// ============================================================================

export type ActivityType = 
  | "hook" 
  | "instruction" 
  | "guided-practice" 
  | "independent-practice" 
  | "closure"
  | "other";

export interface ILessonActivity extends Document {
  _id: Types.ObjectId;
  lessonPlanId: Types.ObjectId;
  
  name: string;
  type: ActivityType;
  durationMinutes: number;
  description: string;
  materials?: string[];
  teacherNotes?: string;
  
  /** Order within the lesson */
  order: number;
  
  createdAt: Date;
  updatedAt: Date;
}

const lessonActivitySchema = new Schema<ILessonActivity>(
  {
    lessonPlanId: {
      type: Schema.Types.ObjectId,
      ref: "LessonPlan",
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["hook", "instruction", "guided-practice", "independent-practice", "closure", "other"],
      required: true,
    },
    durationMinutes: { type: Number, required: true },
    description: { type: String, required: true },
    materials: { type: [String] },
    teacherNotes: { type: String },
    order: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

lessonActivitySchema.index({ lessonPlanId: 1, order: 1 });

export const LessonActivity =
  mongoose.models.LessonActivity || mongoose.model<ILessonActivity>("LessonActivity", lessonActivitySchema);

// ============================================================================
// LessonAssessment - Assessment strategies for a lesson
// ============================================================================

export type AssessmentType = "formative" | "summative";

export interface ILessonAssessment extends Document {
  _id: Types.ObjectId;
  lessonPlanId: Types.ObjectId;
  
  type: AssessmentType;
  name: string;
  description: string;
  
  /** Observable criteria for success */
  successCriteria: string[];
  
  createdAt: Date;
  updatedAt: Date;
}

const lessonAssessmentSchema = new Schema<ILessonAssessment>(
  {
    lessonPlanId: {
      type: Schema.Types.ObjectId,
      ref: "LessonPlan",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["formative", "summative"],
      required: true,
    },
    name: { type: String, required: true },
    description: { type: String, required: true },
    successCriteria: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const LessonAssessment =
  mongoose.models.LessonAssessment || mongoose.model<ILessonAssessment>("LessonAssessment", lessonAssessmentSchema);

// ============================================================================
// LessonDifferentiation - Differentiation strategies for learner groups
// ============================================================================

export type LearnerGroup = "advanced" | "struggling" | "ell" | "special-needs";

export interface ILessonDifferentiation extends Document {
  _id: Types.ObjectId;
  lessonPlanId: Types.ObjectId;
  
  group: LearnerGroup;
  accommodations: string;
  modifications?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const lessonDifferentiationSchema = new Schema<ILessonDifferentiation>(
  {
    lessonPlanId: {
      type: Schema.Types.ObjectId,
      ref: "LessonPlan",
      required: true,
      index: true,
    },
    group: {
      type: String,
      enum: ["advanced", "struggling", "ell", "special-needs"],
      required: true,
    },
    accommodations: { type: String, required: true },
    modifications: { type: String },
  },
  { timestamps: true }
);

lessonDifferentiationSchema.index({ lessonPlanId: 1, group: 1 });

export const LessonDifferentiation =
  mongoose.models.LessonDifferentiation || mongoose.model<ILessonDifferentiation>("LessonDifferentiation", lessonDifferentiationSchema);

// ============================================================================
// Helper Functions
// ============================================================================

// --- LessonPlan ---

export async function createLessonPlan(input: {
  title: string;
  gradeLevel: 6 | 7 | 8;
  ownerId: Types.ObjectId | string;
  standards?: string[];
  objectives?: string[];
  durationMinutes?: number;
  materials?: string[];
  threadId?: Types.ObjectId | string;
  notes?: string;
}): Promise<ILessonPlan> {
  return LessonPlan.create({
    ...input,
    subject: "math",
    status: "draft",
  });
}

export async function getLessonPlan(id: string): Promise<ILessonPlan | null> {
  return LessonPlan.findById(id);
}

export async function updateLessonPlan(
  id: string,
  updates: Partial<Pick<ILessonPlan, "title" | "standards" | "objectives" | "durationMinutes" | "materials" | "status" | "notes">>
): Promise<ILessonPlan | null> {
  return LessonPlan.findByIdAndUpdate(id, updates, { new: true });
}

export async function deleteLessonPlan(id: string): Promise<boolean> {
  // Delete all related documents
  await Promise.all([
    LessonActivity.deleteMany({ lessonPlanId: id }),
    LessonAssessment.deleteMany({ lessonPlanId: id }),
    LessonDifferentiation.deleteMany({ lessonPlanId: id }),
  ]);
  const result = await LessonPlan.findByIdAndDelete(id);
  return !!result;
}

export async function getUserLessonPlans(
  userId: Types.ObjectId | string,
  options?: { status?: "draft" | "published" | "archived"; gradeLevel?: 6 | 7 | 8 }
): Promise<ILessonPlan[]> {
  const filter: Record<string, unknown> = { ownerId: userId };
  if (options?.status) filter.status = options.status;
  if (options?.gradeLevel) filter.gradeLevel = options.gradeLevel;
  return LessonPlan.find(filter).sort({ updatedAt: -1 });
}

// --- LessonActivity ---

export async function createLessonActivity(input: {
  lessonPlanId: Types.ObjectId | string;
  name: string;
  type: ActivityType;
  durationMinutes: number;
  description: string;
  materials?: string[];
  teacherNotes?: string;
  order?: number;
}): Promise<ILessonActivity> {
  // Auto-assign order if not provided
  if (input.order === undefined) {
    const lastActivity = await LessonActivity.findOne({ lessonPlanId: input.lessonPlanId })
      .sort({ order: -1 });
    input.order = lastActivity ? lastActivity.order + 1 : 0;
  }
  return LessonActivity.create(input);
}

export async function getLessonActivities(lessonPlanId: string): Promise<ILessonActivity[]> {
  return LessonActivity.find({ lessonPlanId }).sort({ order: 1 });
}

export async function updateLessonActivity(
  id: string,
  updates: Partial<Pick<ILessonActivity, "name" | "type" | "durationMinutes" | "description" | "materials" | "teacherNotes" | "order">>
): Promise<ILessonActivity | null> {
  return LessonActivity.findByIdAndUpdate(id, updates, { new: true });
}

export async function deleteLessonActivity(id: string): Promise<boolean> {
  const result = await LessonActivity.findByIdAndDelete(id);
  return !!result;
}

// --- LessonAssessment ---

export async function createLessonAssessment(input: {
  lessonPlanId: Types.ObjectId | string;
  type: AssessmentType;
  name: string;
  description: string;
  successCriteria?: string[];
}): Promise<ILessonAssessment> {
  return LessonAssessment.create(input);
}

export async function getLessonAssessments(lessonPlanId: string): Promise<ILessonAssessment[]> {
  return LessonAssessment.find({ lessonPlanId }).sort({ type: 1 });
}

export async function updateLessonAssessment(
  id: string,
  updates: Partial<Pick<ILessonAssessment, "type" | "name" | "description" | "successCriteria">>
): Promise<ILessonAssessment | null> {
  return LessonAssessment.findByIdAndUpdate(id, updates, { new: true });
}

export async function deleteLessonAssessment(id: string): Promise<boolean> {
  const result = await LessonAssessment.findByIdAndDelete(id);
  return !!result;
}

// --- LessonDifferentiation ---

export async function createLessonDifferentiation(input: {
  lessonPlanId: Types.ObjectId | string;
  group: LearnerGroup;
  accommodations: string;
  modifications?: string;
}): Promise<ILessonDifferentiation> {
  return LessonDifferentiation.create(input);
}

export async function getLessonDifferentiations(lessonPlanId: string): Promise<ILessonDifferentiation[]> {
  return LessonDifferentiation.find({ lessonPlanId }).sort({ group: 1 });
}

export async function updateLessonDifferentiation(
  id: string,
  updates: Partial<Pick<ILessonDifferentiation, "group" | "accommodations" | "modifications">>
): Promise<ILessonDifferentiation | null> {
  return LessonDifferentiation.findByIdAndUpdate(id, updates, { new: true });
}

export async function deleteLessonDifferentiation(id: string): Promise<boolean> {
  const result = await LessonDifferentiation.findByIdAndDelete(id);
  return !!result;
}

// --- Full Lesson Plan with all parts ---

export interface FullLessonPlan {
  lessonPlan: ILessonPlan;
  activities: ILessonActivity[];
  assessments: ILessonAssessment[];
  differentiations: ILessonDifferentiation[];
}

export async function getFullLessonPlan(lessonPlanId: string): Promise<FullLessonPlan | null> {
  const lessonPlan = await getLessonPlan(lessonPlanId);
  if (!lessonPlan) return null;
  
  const [activities, assessments, differentiations] = await Promise.all([
    getLessonActivities(lessonPlanId),
    getLessonAssessments(lessonPlanId),
    getLessonDifferentiations(lessonPlanId),
  ]);
  
  return { lessonPlan, activities, assessments, differentiations };
}

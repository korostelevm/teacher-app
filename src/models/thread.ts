import mongoose, { Schema, Document, Types } from "mongoose";

export interface IThread extends Document {
  title: string;
  ownerId: Types.ObjectId;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const threadSchema = new Schema<IThread>(
  {
    title: { type: String, required: true },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

export const Thread =
  mongoose.models.Thread || mongoose.model<IThread>("Thread", threadSchema);

/** Find active (non-deleted) threads */
export function findActiveThreads(filter: Record<string, unknown> = {}) {
  return Thread.find({ ...filter, deletedAt: null });
}

/** Soft delete threads by ID */
export async function softDeleteThreads(threadIds: (string | Types.ObjectId)[]) {
  if (threadIds.length === 0) return;
  await Thread.updateMany(
    { _id: { $in: threadIds } },
    { $set: { deletedAt: new Date() } }
  );
}

/** Soft delete all threads for a user */
export async function softDeleteAllUserThreads(userId: string | Types.ObjectId) {
  const result = await Thread.updateMany(
    { ownerId: userId, deletedAt: null },
    { $set: { deletedAt: new Date() } }
  );
  return result.modifiedCount;
}

export async function createThread(title: string): Promise<IThread> {
  return Thread.create({ title });
}

export async function getThread(id: string): Promise<IThread | null> {
  return Thread.findById(id);
}

export async function getAllThreads(): Promise<IThread[]> {
  return Thread.find().sort({ createdAt: -1 });
}

export async function updateThread(
  id: string,
  updates: Partial<IThread>
): Promise<IThread | null> {
  return Thread.findByIdAndUpdate(id, updates, { new: true });
}

export async function deleteThread(id: string): Promise<boolean> {
  const result = await Thread.findByIdAndDelete(id);
  return !!result;
}

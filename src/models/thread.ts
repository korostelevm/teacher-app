import mongoose, { Schema, Document, Types } from "mongoose";

export interface IThread extends Document {
  title: string;
  ownerId: Types.ObjectId;
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
  },
  { timestamps: true }
);

export const Thread =
  mongoose.models.Thread || mongoose.model<IThread>("Thread", threadSchema);

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

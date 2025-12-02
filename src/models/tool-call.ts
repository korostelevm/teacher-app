import mongoose, { Schema, Document, Types } from "mongoose";

export interface IToolCall extends Document {
  threadId: Types.ObjectId;
  messageId: string; // The responseMessageId from the agent
  toolName: string;
  status: "running" | "complete";
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  userId: Types.ObjectId;
  durationMs?: number;
  createdAt: Date;
  updatedAt: Date;
}

const toolCallSchema = new Schema<IToolCall>(
  {
    threadId: {
      type: Schema.Types.ObjectId,
      ref: "Thread",
      required: true,
      index: true,
    },
    messageId: {
      type: String,
      required: true,
      index: true,
    },
    toolName: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["running", "complete"],
      required: true,
      default: "running",
    },
    input: {
      type: Schema.Types.Mixed,
      required: true,
    },
    output: {
      type: Schema.Types.Mixed,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    durationMs: {
      type: Number,
    },
  },
  { timestamps: true }
);

export const ToolCall =
  mongoose.models.ToolCall || mongoose.model<IToolCall>("ToolCall", toolCallSchema);

export async function startToolCall({
  threadId,
  messageId,
  toolName,
  input,
  userId,
}: {
  threadId: Types.ObjectId | string;
  messageId: string;
  toolName: string;
  input: Record<string, unknown>;
  userId: Types.ObjectId | string;
}): Promise<IToolCall> {
  return ToolCall.create({
    threadId,
    messageId,
    toolName,
    status: "running",
    input,
    userId,
  });
}

export async function completeToolCall({
  messageId,
  toolName,
  output,
  durationMs,
}: {
  messageId: string;
  toolName: string;
  output: Record<string, unknown>;
  durationMs: number;
}): Promise<IToolCall | null> {
  return ToolCall.findOneAndUpdate(
    { messageId, toolName, status: "running" },
    { status: "complete", output, durationMs },
    { new: true }
  );
}

export async function getThreadToolCalls(
  threadId: Types.ObjectId | string
): Promise<IToolCall[]> {
  return ToolCall.find({ threadId }).sort({ createdAt: 1 });
}

export async function getMessageToolCalls(
  messageId: string
): Promise<IToolCall[]> {
  return ToolCall.find({ messageId }).sort({ createdAt: 1 });
}


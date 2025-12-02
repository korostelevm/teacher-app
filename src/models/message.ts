import mongoose, { Schema, Document, Types } from "mongoose";

export interface IMessage extends Document {
  threadId: Types.ObjectId;
  authorId: Types.ObjectId;
  role: "user" | "assistant";
  content: string;
  messageId?: string; // Links to tool calls (the streaming message ID)
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    threadId: {
      type: Schema.Types.ObjectId,
      ref: "Thread",
      required: true,
      index: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    messageId: {
      type: String,
      index: true,
      sparse: true,
    },
  },
  { timestamps: true }
);

export const Message =
  mongoose.models.Message || mongoose.model<IMessage>("Message", messageSchema);

export async function createMessage({
  threadId,
  role,
  content,
  authorId,
  messageId,
}: {
  threadId: Types.ObjectId | string;
  role: "user" | "assistant";
  content: string;
  authorId: Types.ObjectId | string;
  messageId?: string;
}): Promise<IMessage> {
  return Message.create({
    threadId,
    role,
    content,
    authorId,
    messageId,
  });
}

export async function getThreadMessages(
  threadId: Types.ObjectId | string
): Promise<IMessage[]> {
  return Message.find({ threadId })
    .populate("authorId", "displayName email photo")
    .sort({ createdAt: 1 });
}

export async function deleteThreadMessages(
  threadId: Types.ObjectId | string
): Promise<number> {
  const result = await Message.deleteMany({ threadId });
  return result.deletedCount;
}

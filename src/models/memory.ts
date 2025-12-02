import mongoose, { Schema, Document, Types } from "mongoose";

export interface IMemory extends Document {
  _id: Types.ObjectId;
  threadId: Types.ObjectId;
  userId: Types.ObjectId;
  content: string;
  accessCount: number;
  lastAccessedAt: Date | null;
  deletedAt: Date | null;
  consolidatedFromIds: Types.ObjectId[];
  createdAt: Date;
}

const memorySchema = new Schema<IMemory>(
  {
    threadId: { type: Schema.Types.ObjectId, ref: "Thread", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    content: { type: String, required: true },
    accessCount: { type: Number, default: 0 },
    lastAccessedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null, index: true },
    consolidatedFromIds: [{ type: Schema.Types.ObjectId, ref: "Memory", default: [] }],
  },
  { timestamps: true }
);

export const Memory =
  mongoose.models.Memory || mongoose.model<IMemory>("Memory", memorySchema);

/** Find active (non-deleted) memories */
export function findActiveMemories(filter: Record<string, any>) {
  return Memory.find({ ...filter, deletedAt: null });
}

/** Soft delete memories by ID */
export async function softDeleteMemories(memoryIds: (string | Types.ObjectId)[]) {
  if (memoryIds.length === 0) return;
  await Memory.updateMany(
    { _id: { $in: memoryIds } },
    { $set: { deletedAt: new Date() } }
  );
}

export async function recordMemoryAccess(memoryIds: string[]) {
  if (memoryIds.length === 0) return;
  
  await Memory.updateMany(
    { _id: { $in: memoryIds }, deletedAt: null },
    { 
      $inc: { accessCount: 1 },
      $set: { lastAccessedAt: new Date() }
    }
  );
}

export interface ExpireMemoriesConfig {
  /** Maximum number of memories to keep per user */
  maxMemories: number;
  /** Memories older than this (in days) with low access are candidates for expiration */
  minAgeDays: number;
  /** Memories with access count below this are considered low-access */
  minAccessCount: number;
  /** Memories not accessed in this many days are considered stale */
  staleAfterDays: number;
}

const DEFAULT_EXPIRE_CONFIG: ExpireMemoriesConfig = {
  maxMemories: 5,
  minAgeDays: 30,
  minAccessCount: 2,
  staleAfterDays: 14,
};

/**
 * Expire (soft delete) memories when user exceeds the max limit.
 * 
 * Only runs if user has more than `maxMemories` active memories.
 * 
 * Expiration priority (in order):
 * 1. First, expire memories matching ALL these criteria:
 *    - Older than `minAgeDays`
 *    - Fewer than `minAccessCount` accesses
 *    - Not accessed in `staleAfterDays` (or never accessed)
 * 2. If still over limit, expire by lowest score (accessCount - ageDays * 0.1)
 * 
 * This is fully deterministic - based only on the data, no LLM involved.
 */
export async function expireMemories(
  userId: string,
  config: Partial<ExpireMemoriesConfig> = {}
): Promise<{ expiredCount: number; expiredIds: string[] }> {
  const { maxMemories, minAgeDays, minAccessCount, staleAfterDays } = { 
    ...DEFAULT_EXPIRE_CONFIG, 
    ...config 
  };
  
  // Get all active memories
  const activeMemories = await Memory.find({ userId, deletedAt: null });
  
  // Only expire if over the limit
  if (activeMemories.length <= maxMemories) {
    console.log(`[Memory] User has ${activeMemories.length}/${maxMemories} memories, no expiration needed`);
    return { expiredCount: 0, expiredIds: [] };
  }

  const now = new Date();
  const toExpire: string[] = [];
  const excessCount = activeMemories.length - maxMemories;

  console.log(`[Memory] User has ${activeMemories.length} memories, need to expire ${excessCount}`);

  const minAgeDate = new Date(now.getTime() - minAgeDays * 24 * 60 * 60 * 1000);
  const staleDate = new Date(now.getTime() - staleAfterDays * 24 * 60 * 60 * 1000);

  // First pass: find memories matching expiration criteria
  const staleCandidates = activeMemories.filter((m) => {
    const isOldEnough = m.createdAt < minAgeDate;
    const isLowAccess = m.accessCount < minAccessCount;
    const isStale = !m.lastAccessedAt || m.lastAccessedAt < staleDate;
    return isOldEnough && isLowAccess && isStale;
  });

  // Sort stale candidates by score (lowest first) and take what we need
  const scoreMemory = (m: IMemory) => {
    const ageDays = (now.getTime() - m.createdAt.getTime()) / (24 * 60 * 60 * 1000);
    return m.accessCount - ageDays * 0.1; // Lower score = less valuable
  };

  staleCandidates.sort((a, b) => scoreMemory(a) - scoreMemory(b));
  
  for (const m of staleCandidates) {
    if (toExpire.length >= excessCount) break;
    toExpire.push(m._id.toString());
  }

  // Second pass: if still over limit, take from remaining by lowest score
  if (toExpire.length < excessCount) {
    const remaining = activeMemories
      .filter((m) => !toExpire.includes(m._id.toString()))
      .sort((a, b) => scoreMemory(a) - scoreMemory(b));

    for (const m of remaining) {
      if (toExpire.length >= excessCount) break;
      toExpire.push(m._id.toString());
    }
  }

  if (toExpire.length === 0) {
    return { expiredCount: 0, expiredIds: [] };
  }

  await Memory.updateMany(
    { _id: { $in: toExpire } },
    { $set: { deletedAt: now } }
  );

  console.log(`[Memory] Expired ${toExpire.length} memories for user ${userId}`);
  
  return { expiredCount: toExpire.length, expiredIds: toExpire };
}


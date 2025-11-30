import { Thread, IThread } from "@/models/thread";
import { Types } from "mongoose";

/**
 * ThreadManager class for managing chat threads
 * Handles creation, retrieval, and deletion of threads
 */
export class ThreadManager {
  /**
   * Create a new thread
   */
  static async create(title: string, ownerId?: string | Types.ObjectId): Promise<IThread> {
    const data: any = { title };
    if (ownerId) {
      data.ownerId = ownerId;
    }
    return Thread.create(data);
  }

  /**
   * Get a thread by ID
   */
  static async get(id: string): Promise<IThread | null> {
    return Thread.findById(id);
  }

  /**
   * Get all threads for a user
   */
  static async getAllByOwner(ownerId: string | Types.ObjectId): Promise<IThread[]> {
    return Thread.find({ ownerId }).sort({ createdAt: -1 });
  }

  /**
   * Get all threads
   */
  static async getAll(): Promise<IThread[]> {
    return Thread.find().sort({ createdAt: -1 });
  }

  /**
   * Update a thread
   */
  static async update(id: string, updates: Partial<IThread>): Promise<IThread | null> {
    return Thread.findByIdAndUpdate(id, updates, { new: true });
  }

  /**
   * Delete a thread
   */
  static async delete(id: string): Promise<boolean> {
    const result = await Thread.findByIdAndDelete(id);
    return !!result;
  }
}


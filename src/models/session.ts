import mongoose from "mongoose";

export interface ISession extends mongoose.Document {
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

const sessionSchema = new mongoose.Schema<ISession>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Auto-delete expired sessions
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session =
  mongoose.models.Session || mongoose.model<ISession>("Session", sessionSchema);


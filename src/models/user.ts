import mongoose from "mongoose";

export interface IUser extends mongoose.Document {
  googleId?: string;
  displayName: string;
  email: string;
  photo?: string;
  accessToken: string;
  refreshToken?: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new mongoose.Schema<IUser>(
  {
    googleId: {
      type: String,
      sparse: true,
      unique: true,
      index: true,
    },
    displayName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      index: true,
    },
    photo: {
      type: String,
    },
    accessToken: {
      type: String,
      required: true,
    },
    refreshToken: {
      type: String,
    },
    role: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const User =
  mongoose.models.User || mongoose.model<IUser>("User", userSchema);

export async function ensureSystemUser() {
  await User.findOneAndUpdate(
    { role: "system" },
    {
      displayName: "AI Assistant",
      email: "ai@system.local",
      accessToken: "system-token",
      role: "system",
    },
    { upsert: true, new: true }
  );
}


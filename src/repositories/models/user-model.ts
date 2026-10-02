import { Schema, model } from "mongoose";

export type User = {
  userName: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: Date;
  emailConfirmation: {
    confirmationCode: string;
    expirationDate: Date;
    isConfirmed: boolean;
  };
  expiredRefreshTokens: string[];
};

const userSchema = new Schema<User>(
  {
    userName: String,
    email: String,
    passwordHash: String,
    passwordSalt: String,
    createdAt: Date,
    emailConfirmation: {
      confirmationCode: String,
      expirationDate: Date,
      isConfirmed: Boolean,
    },
    expiredRefreshTokens: { type: [String], default: [] },
  },
  { versionKey: false },
);

export const UserModel = model<User>("User", userSchema, "users");

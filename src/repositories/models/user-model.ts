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
  },
  { versionKey: false },
);

export const UserModel = model<User>("User", userSchema, "users");

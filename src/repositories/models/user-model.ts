import { Schema, model } from "mongoose";

export type RefreshTokenMeta = {
  deviceId: string;
  ip: string;
  title: string;
  lastActiveDate: Date;
};

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
  // Absent until the user requests a password recovery; removed once the password is reset.
  passwordRecovery?: {
    recoveryCode: string;
    expirationDate: Date;
  };
  refreshTokensMeta: RefreshTokenMeta[];
};

const refreshTokenMetaSchema = new Schema<RefreshTokenMeta>(
  {
    deviceId: String,
    ip: String,
    title: String,
    lastActiveDate: Date,
  },
  { _id: false },
);

const passwordRecoverySchema = new Schema<
  NonNullable<User["passwordRecovery"]>
>(
  {
    recoveryCode: String,
    expirationDate: Date,
  },
  { _id: false },
);

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
    passwordRecovery: { type: passwordRecoverySchema, required: false },
    refreshTokensMeta: { type: [refreshTokenMetaSchema], default: [] },
  },
  { versionKey: false },
);

export const UserModel = model<User>("User", userSchema, "users");

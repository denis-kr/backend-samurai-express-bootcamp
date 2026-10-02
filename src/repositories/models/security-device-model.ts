import { Schema, model } from "mongoose";

export type SecurityDevice = {
  ip: string;
  title: string;
  lastActiveDate: string;
  deviceId: string;
};

const securityDeviceSchema = new Schema<SecurityDevice>(
  {
    ip: String,
    title: String,
    lastActiveDate: String,
    deviceId: String,
  },
  { versionKey: false },
);

export const SecurityDeviceModel = model<SecurityDevice>(
  "SecurityDevice",
  securityDeviceSchema,
  "securityDevices",
);

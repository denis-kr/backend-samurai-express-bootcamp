import { param } from "express-validator";

export const deviceIdValidationMiddleware = [
  param("deviceId")
    .isString()
    .withMessage("deviceId must be a string")
    .trim()
    .notEmpty()
    .withMessage("deviceId is required"),
];

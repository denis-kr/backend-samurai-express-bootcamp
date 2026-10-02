import { body } from "express-validator";
import {
  login,
  password,
  email,
  emailFormat,
  passwordFormat,
} from "./validation-users.js";
import { container } from "../../composition-root.js";
import { UsersRepository } from "../../repositories/users-repo.js";

export const registrationValidationMiddleware = [login, password, email];

export const registrationConfirmationValidationMiddleware = body("code")
  .notEmpty()
  .withMessage("Code is required")
  .isString()
  .withMessage("Code must be a string");

export const registrationEmailResendingValidationMiddleware =
  emailFormat().custom(async (value) => {
    const user = await container.get(UsersRepository).findByEmail(value);

    if (!user) {
      throw new Error("User with this email does not exist");
    }

    if (user.emailConfirmation.isConfirmed) {
      throw new Error("Email is already confirmed");
    }
  });

export const newPasswordValidationMiddleware = [
  passwordFormat("newPassword", "New password"),
  body("recoveryCode")
    .notEmpty()
    .withMessage("Recovery code is required")
    .isString()
    .withMessage("Recovery code must be a string"),
];

// No existence check: unknown emails must look the same as registered ones.
export const passwordRecoveryValidationMiddleware = emailFormat();

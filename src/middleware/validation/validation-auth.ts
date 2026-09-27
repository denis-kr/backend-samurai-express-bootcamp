import { body } from "express-validator";
import { login, password, email } from "./validation-users.js";
import { container } from "../../composition-root.js";
import { UsersRepository } from "../../repositories/users-repo.js";

export const registrationValidationMiddleware = [login, password, email];

export const registrationConfirmationValidationMiddleware = body("code")
  .notEmpty()
  .withMessage("Code is required")
  .isString()
  .withMessage("Code must be a string");

export const registrationEmailResendingValidationMiddleware = body("email")
  .notEmpty()
  .withMessage("Email is required")
  .isString()
  .withMessage("Email must be a string")
  .matches(/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/)
  .withMessage("Email must be a valid email address")
  .custom(async (value) => {
    const user = await container.get(UsersRepository).findByEmail(value);

    if (!user) {
      throw new Error("User with this email does not exist");
    }

    if (user.emailConfirmation.isConfirmed) {
      throw new Error("Email is already confirmed");
    }
  });

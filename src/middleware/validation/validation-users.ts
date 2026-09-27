import { container } from "../../composition-root.js";
import { UsersRepository } from "../../repositories/users-repo.js";
import { body } from "express-validator";

export const login = body("login")
  .notEmpty()
  .withMessage("Login is required")
  .isString()
  .withMessage("Login must be a string")
  .isLength({ min: 3, max: 10 })
  .withMessage("Login must be between 3 and 10 characters")
  .matches(/^[a-zA-Z0-9_-]*$/)
  .withMessage(
    "Login must contain only letters, numbers, underscores, and hyphens",
  )
  .custom(async (value) => {
    const user = await container.get(UsersRepository).findByLogin(value);

    if (user) {
      throw new Error("Login must be unique");
    }
  });

export const email = body("email")
  .notEmpty()
  .withMessage("Email is required")
  .isString()
  .withMessage("Email must be a string")
  .matches(/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/)
  .withMessage("Email must be a valid email address")
  .custom(async (value) => {
    const user = await container.get(UsersRepository).findByEmail(value);

    if (user) {
      throw new Error("Email must be unique");
    }
  });

export const password = body("password")
  .notEmpty()
  .withMessage("Password is required")
  .isString()
  .withMessage("Password must be a string")
  .isLength({ min: 6, max: 20 })
  .withMessage("Password must be between 6 and 20 characters");

export const createNewUserValidationMiddleware = [login, password, email];

export const loginValidationMiddleware = [
  body("password")
    .isString()
    .withMessage("Password must be a string")
    .notEmpty()
    .withMessage("Password is required"),
  body("loginOrEmail")
    .isString()
    .withMessage("LoginOrEmail must be a string")
    .notEmpty()
    .withMessage("LoginOrEmail is required"),
];

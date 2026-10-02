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

// Factory, not a shared chain: express-validator chains are mutable, so each
// caller needs its own instance before appending a custom check.
export const emailFormat = () =>
  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isString()
    .withMessage("Email must be a string")
    .matches(/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/)
    .withMessage("Email must be a valid email address");

export const email = emailFormat().custom(async (value) => {
  const user = await container.get(UsersRepository).findByEmail(value);

  if (user) {
    throw new Error("Email must be unique");
  }
});

export const passwordFormat = (field = "password", label = "Password") =>
  body(field)
    .notEmpty()
    .withMessage(`${label} is required`)
    .isString()
    .withMessage(`${label} must be a string`)
    .isLength({ min: 6, max: 20 })
    .withMessage(`${label} must be between 6 and 20 characters`);

export const password = passwordFormat();

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

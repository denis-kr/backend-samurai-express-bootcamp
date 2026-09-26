import express, { Router, type Response } from "express";
import { loginValidationMiddleware } from "../middleware/validation/validation-users.js";
import { sendErrorsIfAnyMiddleware } from "../middleware/validation/validation-universal.js";
import type { RequestWithBody } from "../utils/types.js";
import { usersService } from "../domain/users-service.js";
import { jwtService } from "../application/jwt-service.js";
import { authMiddleware } from "../middleware/auth/auth-middleware.js";
import {
  registrationConfirmationValidationMiddleware,
  registrationEmailResendingValidationMiddleware,
  registrationValidationMiddleware,
} from "../middleware/validation/validation-auth.js";

const router: Router = express.Router();

router.post("/refresh-token", () => {});
router.post("/logout", () => {});

router.post(
  "/registration-confirmation",
  registrationConfirmationValidationMiddleware,
  sendErrorsIfAnyMiddleware,
  async (req: RequestWithBody<{ code: string }>, res: Response) => {
    const { code } = req.body;

    const isConfirmed = await usersService.confirmEmail(code);

    if (isConfirmed) {
      res.sendStatus(204);
    } else {
      res.sendStatus(400);
    }
  },
);

router.post(
  "/registration",
  registrationValidationMiddleware,
  sendErrorsIfAnyMiddleware,
  async (
    req: RequestWithBody<{ login: string; password: string; email: string }>,
    res: Response,
  ) => {
    const { login, password, email } = req.body;

    const user = await usersService.addNewUser(login, password, email);

    if (user) {
      res.status(201).send();
    } else {
      res.sendStatus(400);
    }
  },
);
router.post(
  "/registration-email-resending",
  registrationEmailResendingValidationMiddleware,
  sendErrorsIfAnyMiddleware,
  async (req: RequestWithBody<{ email: string }>, res: Response) => {
    const { email } = req.body;

    const isResent = await usersService.resendConfirmationEmail(email);

    if (isResent) {
      res.sendStatus(204);
    } else {
      res.sendStatus(400);
    }
  },
);

router.post(
  "/login",
  loginValidationMiddleware,
  sendErrorsIfAnyMiddleware,
  async (
    req: RequestWithBody<{ loginOrEmail: string; password: string }>,
    res: Response,
  ) => {
    const { password, loginOrEmail } = req.body;

    const user = await usersService.checkCredentials(loginOrEmail, password);

    if (user) {
      const token = await jwtService.createJWT(user);
      res.status(201).send({ accessToken: token });
    } else {
      res.sendStatus(401);
    }
  },
);

router.get("/me", authMiddleware, async (req, res) => {
  const userId = req.userId;

  if (userId) {
    const user = await usersService.findUserById(userId);

    if (user) {
      return res.status(200).json({
        email: user.email,
        login: user.userName,
        userId: user._id.toString(),
      });
    }
  }

  return res.sendStatus(401);
});

export default router;

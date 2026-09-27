import express, { Router, type Request, type Response } from "express";
import { inject, injectable } from "inversify";
import { loginValidationMiddleware } from "../middleware/validation/validation-users.js";
import { sendErrorsIfAnyMiddleware } from "../middleware/validation/validation-universal.js";
import type { RequestWithBody } from "../utils/types.js";
import { UsersService } from "../domain/users-service.js";
import { jwtService } from "../application/jwt-service.js";
import { authMiddleware } from "../middleware/auth/auth-middleware.js";
import {
  registrationConfirmationValidationMiddleware,
  registrationEmailResendingValidationMiddleware,
  registrationValidationMiddleware,
} from "../middleware/validation/validation-auth.js";

@injectable()
export class AuthRouter {
  readonly router: Router = express.Router();

  constructor(
    @inject(UsersService) private readonly usersService: UsersService,
  ) {
    this.router.post("/refresh-token", () => {});
    this.router.post("/logout", () => {});

    this.router.post(
      "/registration-confirmation",
      registrationConfirmationValidationMiddleware,
      sendErrorsIfAnyMiddleware,
      this.confirmRegistration.bind(this),
    );
    this.router.post(
      "/registration",
      registrationValidationMiddleware,
      sendErrorsIfAnyMiddleware,
      this.register.bind(this),
    );
    this.router.post(
      "/registration-email-resending",
      registrationEmailResendingValidationMiddleware,
      sendErrorsIfAnyMiddleware,
      this.resendRegistrationEmail.bind(this),
    );
    this.router.post(
      "/login",
      loginValidationMiddleware,
      sendErrorsIfAnyMiddleware,
      this.login.bind(this),
    );
    this.router.get("/me", authMiddleware, this.me.bind(this));
  }

  async confirmRegistration(
    req: RequestWithBody<{ code: string }>,
    res: Response,
  ) {
    const { code } = req.body;

    const isConfirmed = await this.usersService.confirmEmail(code);

    if (isConfirmed) {
      res.sendStatus(204);
    } else {
      res.sendStatus(400);
    }
  }

  async register(
    req: RequestWithBody<{ login: string; password: string; email: string }>,
    res: Response,
  ) {
    const { login, password, email } = req.body;

    const user = await this.usersService.addNewUser(login, password, email);

    if (user) {
      res.status(201).send();
    } else {
      res.sendStatus(400);
    }
  }

  async resendRegistrationEmail(
    req: RequestWithBody<{ email: string }>,
    res: Response,
  ) {
    const { email } = req.body;

    const isResent = await this.usersService.resendConfirmationEmail(email);

    if (isResent) {
      res.sendStatus(204);
    } else {
      res.sendStatus(400);
    }
  }

  async login(
    req: RequestWithBody<{ loginOrEmail: string; password: string }>,
    res: Response,
  ) {
    const { password, loginOrEmail } = req.body;

    const user = await this.usersService.checkCredentials(
      loginOrEmail,
      password,
    );

    if (user) {
      const token = await jwtService.createJWT(user);
      res.status(201).send({ accessToken: token });
    } else {
      res.sendStatus(401);
    }
  }

  async me(req: Request, res: Response) {
    const userId = req.userId;

    if (userId) {
      const user = await this.usersService.findUserById(userId);

      if (user) {
        return res.status(200).json({
          email: user.email,
          login: user.userName,
          userId: user._id.toString(),
        });
      }
    }

    return res.sendStatus(401);
  }
}

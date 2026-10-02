import express, { Router, type Request, type Response } from "express";
import { inject, injectable } from "inversify";
import { loginValidationMiddleware } from "../middleware/validation/validation-users.js";
import { sendErrorsIfAnyMiddleware } from "../middleware/validation/validation-universal.js";
import type { RequestWithBody } from "../utils/types.js";
import { UsersService } from "../domain/users-service.js";
import { createTokens } from "../utils/createTokens.js";
import { authMiddleware } from "../middleware/auth/auth-middleware.js";
import { refreshTokenMiddleware } from "../middleware/auth/refresh-token-middleware.js";
import {
  newPasswordValidationMiddleware,
  passwordRecoveryValidationMiddleware,
  registrationConfirmationValidationMiddleware,
  registrationEmailResendingValidationMiddleware,
  registrationValidationMiddleware,
} from "../middleware/validation/validation-auth.js";
import { getApiLimiter } from "../utils/getAPILimiter.js";

@injectable()
export class AuthRouter {
  readonly router: Router = express.Router();

  constructor(
    @inject(UsersService) private readonly usersService: UsersService,
  ) {
    this.router.post(
      "/new-password",
      getApiLimiter(),
      newPasswordValidationMiddleware,
      sendErrorsIfAnyMiddleware,
      this.newPassword.bind(this),
    );
    this.router.post(
      "/password-recovery",
      getApiLimiter(),
      passwordRecoveryValidationMiddleware,
      sendErrorsIfAnyMiddleware,
      this.passwordRecovery.bind(this),
    );

    this.router.post(
      "/refresh-token",
      refreshTokenMiddleware,
      this.refreshToken.bind(this),
    );
    this.router.post("/logout", refreshTokenMiddleware, this.logout.bind(this));

    this.router.post(
      "/registration-confirmation",
      getApiLimiter(),
      registrationConfirmationValidationMiddleware,
      sendErrorsIfAnyMiddleware,
      this.confirmRegistration.bind(this),
    );
    this.router.post(
      "/registration",
      getApiLimiter(),
      registrationValidationMiddleware,
      sendErrorsIfAnyMiddleware,
      this.register.bind(this),
    );
    this.router.post(
      "/registration-email-resending",
      getApiLimiter(),
      registrationEmailResendingValidationMiddleware,
      sendErrorsIfAnyMiddleware,
      this.resendRegistrationEmail.bind(this),
    );
    this.router.post(
      "/login",
      getApiLimiter(),
      loginValidationMiddleware,
      sendErrorsIfAnyMiddleware,
      this.login.bind(this),
    );
    this.router.get("/me", authMiddleware, this.me.bind(this));
  }

  async passwordRecovery(
    req: RequestWithBody<{ email: string }>,
    res: Response,
  ) {
    await this.usersService.sendPasswordRecoveryEmail(req.body.email);

    res.sendStatus(204);
  }

  async newPassword(
    req: RequestWithBody<{ newPassword: string; recoveryCode: string }>,
    res: Response,
  ) {
    const { newPassword, recoveryCode } = req.body;

    const isUpdated = await this.usersService.setNewPassword(
      recoveryCode,
      newPassword,
    );

    if (isUpdated) {
      res.sendStatus(204);
    } else {
      res.status(400).json({
        errorsMessages: [
          {
            message: "Recovery code is incorrect or expired",
            field: "recoveryCode",
          },
        ],
      });
    }
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
      res.sendStatus(204);
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

  async refreshToken(req: Request, res: Response) {
    const tokens = await this.usersService.refreshTokens(
      req.userId!,
      req.cookies.refreshToken,
    );

    if (!tokens) {
      return res.sendStatus(401);
    }

    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: true,
    });
    return res.status(200).send({ accessToken: tokens.accessToken });
  }

  async logout(req: Request, res: Response) {
    const isLoggedOut = await this.usersService.logout(
      req.userId!,
      req.cookies.refreshToken,
    );

    if (!isLoggedOut) {
      return res.sendStatus(401);
    }

    res.clearCookie("refreshToken", { httpOnly: true, secure: true });
    return res.sendStatus(204);
  }

  async login(
    req: RequestWithBody<{ loginOrEmail: string; password: string }>,
    res: Response,
  ) {
    const { password, loginOrEmail } = req.body;

    const ip = req.ip;
    const userAgent = req.useragent;

    const user = await this.usersService.checkCredentials(
      loginOrEmail,
      password,
    );

    if (user) {
      const tokens = await createTokens(user);

      if (!tokens) {
        return res.sendStatus(500);
      }

      await this.usersService.saveRefreshTokenMeta({
        userId: user._id.toString(),
        deviceId: tokens.deviceId,
        ip: ip ?? "unknown",
        iat: tokens.iat,
        source: userAgent?.source ?? "unknown",
      });

      res.cookie("refreshToken", tokens.refreshToken, {
        httpOnly: true,
        secure: true,
      });
      res.status(200).send({ accessToken: tokens.accessToken });
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

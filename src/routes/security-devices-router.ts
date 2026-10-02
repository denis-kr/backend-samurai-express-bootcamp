import express, { Router, type Request, type Response } from "express";
import { inject, injectable } from "inversify";
import { UsersService } from "../domain/users-service.js";
import { deviceIdValidationMiddleware } from "../middleware/validation/validation-security-devices.js";
import { refreshTokenMiddleware } from "../middleware/auth/refresh-token-middleware.js";
import { sendErrorsIfAnyMiddleware } from "../middleware/validation/validation-universal.js";
import type { RequestWithParams } from "../utils/types.js";

@injectable()
export class SecurityDevicesRouter {
  readonly router: Router = express.Router();

  constructor(
    @inject(UsersService) private readonly usersService: UsersService,
  ) {
    this.router.use(refreshTokenMiddleware);

    this.router.get("/devices", this.getDevices.bind(this));
    this.router.delete("/devices", this.deleteDevices.bind(this));
    this.router.delete(
      "/devices/:deviceId",
      deviceIdValidationMiddleware,
      sendErrorsIfAnyMiddleware,
      this.deleteDeviceById.bind(this),
    );
  }

  async getDevices(req: Request, res: Response) {
    const devices = await this.usersService.getDevices(req.userId!);

    if (!devices) {
      return res.sendStatus(401);
    }

    return res.status(200).send(
      devices.map((device) => ({
        ip: device.ip,
        title: device.title,
        lastActiveDate: device.lastActiveDate.toISOString(),
        deviceId: device.deviceId,
      })),
    );
  }

  async deleteDevices(req: Request, res: Response) {
    const isDeleted = await this.usersService.deleteOtherDevices(
      req.userId!,
      req.cookies.refreshToken,
    );

    if (!isDeleted) {
      return res.sendStatus(401);
    }

    return res.sendStatus(204);
  }

  async deleteDeviceById(
    req: RequestWithParams<{ deviceId: string }>,
    res: Response,
  ) {
    const result = await this.usersService.deleteDevice(
      req.userId!,
      req.params.deviceId,
    );

    if (result === "notFound") {
      return res.sendStatus(404);
    }
    if (result === "forbidden") {
      return res.sendStatus(403);
    }
    return res.sendStatus(204);
  }
}

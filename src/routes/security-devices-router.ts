import express, { Router, type Request, type Response } from "express";
import { inject, injectable } from "inversify";
import { SecurityDevicesService } from "../domain/security-devices-service.js";
import { deviceIdValidationMiddleware } from "../middleware/validation/validation-security-devices.js";
import { refreshTokenMiddleware } from "../middleware/auth/refresh-token-middleware.js";
import { sendErrorsIfAnyMiddleware } from "../middleware/validation/validation-universal.js";
import type { RequestWithParams } from "../utils/types.js";

@injectable()
export class SecurityDevicesRouter {
  readonly router: Router = express.Router();

  constructor(
    // TODO: make private once a handler uses it (noUnusedLocals flags unused private props)
    @inject(SecurityDevicesService)
    readonly securityDevicesService: SecurityDevicesService,
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

  async getDevices(_req: Request, res: Response) {
    res.sendStatus(501);
  }

  async deleteDevices(_req: Request, res: Response) {
    res.sendStatus(501);
  }

  async deleteDeviceById(
    _req: RequestWithParams<{ deviceId: string }>,
    res: Response,
  ) {
    res.sendStatus(501);
  }
}

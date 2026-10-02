import type { Request, Response, NextFunction } from "express";
import { jwtService } from "../../application/jwt-service.js";

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return res.sendStatus(401);
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.sendStatus(401);
  }

  const userId = await jwtService.getUserIdByAccessToken(token);
  if (!userId) {
    return res.sendStatus(401);
  }

  req.userId = userId;
  next();
};

// For public endpoints whose response depends on the viewer (e.g. likesInfo.myStatus):
// sets req.userId when a valid Bearer token is sent, otherwise leaves it null. Never 401s.
export const optionalAuthMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  req.userId = null;

  const token = req.headers["authorization"]?.split(" ")[1];
  if (token) {
    req.userId = await jwtService.getUserIdByAccessToken(token);
  }

  next();
};

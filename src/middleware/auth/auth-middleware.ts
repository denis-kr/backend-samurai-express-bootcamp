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

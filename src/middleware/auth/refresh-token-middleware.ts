import type { Request, Response, NextFunction } from "express";
import { jwtService } from "../../application/jwt-service.js";
import { container } from "../../composition-root.js";
import { UsersRepository } from "../../repositories/users-repo.js";

// Lets the request through only with a refreshToken cookie that is correctly signed,
// not past its expiry, issued to an existing user, and not already used/revoked.
export const refreshTokenMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const refreshToken: string | undefined = req.cookies?.refreshToken;
  if (!refreshToken) {
    return res.sendStatus(401);
  }

  // jwt.verify rejects both bad signatures and expired tokens
  const userId = await jwtService.getUserIdByRefreshToken(refreshToken);
  if (!userId) {
    return res.sendStatus(401);
  }

  const user = await container.get(UsersRepository).findById(userId);
  if (!user || user.expiredRefreshTokens.includes(refreshToken)) {
    return res.sendStatus(401);
  }

  req.userId = userId;
  next();
};

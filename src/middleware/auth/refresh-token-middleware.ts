import type { Request, Response, NextFunction } from "express";
import { jwtService } from "../../application/jwt-service.js";
import { container } from "../../composition-root.js";
import { UsersRepository } from "../../repositories/users-repo.js";
import { iatToDate } from "../../utils/createTokens.js";

// Lets the request through only with a refreshToken cookie that is correctly signed,
// not past its expiry, and still the current token of an existing device session
// (its iat matches that session's lastActiveDate, so rotated/revoked tokens are rejected).
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
  const tokenPayload = await jwtService.getRefreshTokenPayload(refreshToken);
  if (!tokenPayload) {
    return res.sendStatus(401);
  }

  const user = await container
    .get(UsersRepository)
    .findByRefreshTokenMeta(
      tokenPayload.userId,
      tokenPayload.deviceId,
      iatToDate(tokenPayload.iat),
    );
  if (!user) {
    return res.sendStatus(401);
  }

  req.userId = tokenPayload.userId;
  next();
};

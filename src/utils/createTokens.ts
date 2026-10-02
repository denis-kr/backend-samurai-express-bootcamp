import { Types } from "mongoose";
import { jwtService } from "../application/jwt-service.js";

// JWT iat is in seconds; the session's lastActiveDate stores it as a Date.
export const iatToDate = (iat: number) => new Date(iat * 1000);

// Issues an access/refresh pair and decodes the refresh token's iat/deviceId,
// which are needed to store the session meta. Pass deviceId to keep the same
// device on rotation; omit it to start a new session.
export const createTokens = async (
  user: { _id: Types.ObjectId },
  deviceId: string = crypto.randomUUID(),
) => {
  const refreshToken = await jwtService.createRefreshJWT(user, deviceId);
  const accessToken = await jwtService.createAccessJWT(user);

  const tokenPayload = await jwtService.getRefreshTokenPayload(refreshToken);

  if (!tokenPayload) {
    return null;
  }

  return {
    accessToken,
    refreshToken,
    deviceId: tokenPayload.deviceId,
    iat: tokenPayload.iat,
  };
};

export default createTokens;

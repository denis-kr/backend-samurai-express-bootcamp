import jwt from "jsonwebtoken";
import { Types } from "mongoose";

const ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET || "default_access_secret_key";

const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || "default_refresh_secret_key";

export const jwtService = {
  async createAccessJWT(user: { _id: Types.ObjectId }) {
    const token = jwt.sign(
      { userId: user._id.toString() },
      ACCESS_TOKEN_SECRET,
      {
        expiresIn: "5m",
      },
    );
    return token;
  },
  async createRefreshJWT(user: { _id: Types.ObjectId }, deviceId: string) {
    // jwtid makes each token unique, even when two are issued for the same user within the same second.
    // iat keeps milliseconds (fractional seconds are valid per RFC 7519) because it is stored as the
    // session's lastActiveDate, and a rotation within the same second must still change it.
    const refreshToken = jwt.sign(
      { userId: user._id.toString(), deviceId, iat: Date.now() / 1000 },
      REFRESH_TOKEN_SECRET,
      {
        expiresIn: "24h",
        jwtid: crypto.randomUUID(),
      },
    );
    return refreshToken;
  },
  async getRefreshTokenPayload(token: string) {
    try {
      const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET) as {
        userId: string;
        deviceId: string;
        iat: number;
      };
      return {
        userId: decoded.userId,
        deviceId: decoded.deviceId,
        iat: decoded.iat,
      };
    } catch (error) {
      return null;
    }
  },
  async getUserIdByAccessToken(token: string) {
    try {
      const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET) as {
        userId: string;
      };
      return decoded.userId;
    } catch (error) {
      return null;
    }
  },
};

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
        expiresIn: "10s",
      },
    );
    return token;
  },
  async createRefreshJWT(user: { _id: Types.ObjectId }) {
    // jwtid makes each token unique, even when two are issued for the same user within the same second
    const refreshToken = jwt.sign(
      { userId: user._id.toString() },
      REFRESH_TOKEN_SECRET,
      {
        expiresIn: "20s",
        jwtid: crypto.randomUUID(),
      },
    );
    return refreshToken;
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
  async getUserIdByRefreshToken(token: string) {
    try {
      const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET) as {
        userId: string;
      };
      return decoded.userId;
    } catch (error) {
      return null;
    }
  },
};

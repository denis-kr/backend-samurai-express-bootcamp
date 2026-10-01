import jwt from "jsonwebtoken";
import { Types } from "mongoose";

const JWT_SECRET = process.env.JWT_SECRET || "default_secret_key";

export const jwtService = {
  async createJWT(user: { _id: Types.ObjectId }) {
    const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET, {
      expiresIn: "1h",
    });
    return token;
  },
  async getUserIdByToken(token: string) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      return decoded.userId;
    } catch (error) {
      return null;
    }
  },
};

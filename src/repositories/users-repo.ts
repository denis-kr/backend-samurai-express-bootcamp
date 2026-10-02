import { injectable } from "inversify";
import { Types } from "mongoose";
import { UserModel } from "./models/user-model.js";
import type { RefreshTokenMeta, User } from "./models/user-model.js";

export type FindAllUsersParams = {
  pageSize: number;
  pageNumber: number;
  sortBy: string;
  sortDirection: "asc" | "desc";
  searchLoginTerm: string | null;
  searchEmailTerm: string | null;
};

// Maps public API field names (as returned in responses) to the Mongo document fields they're stored under.
const sortFieldMap: Record<string, string> = {
  login: "userName",
};

@injectable()
export class UsersRepository {
  async create(user: User) {
    const result = await UserModel.create(user);
    return result._id.toString();
  }
  async findById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }
    return UserModel.findById(id).lean();
  }
  async getTotalCount(fields?: {
    searchLoginTerm?: string | null;
    searchEmailTerm?: string | null;
  }) {
    const searchFilters = [];
    if (fields?.searchLoginTerm) {
      searchFilters.push({
        userName: { $regex: fields.searchLoginTerm, $options: "i" },
      });
    }
    if (fields?.searchEmailTerm) {
      searchFilters.push({
        email: { $regex: fields.searchEmailTerm, $options: "i" },
      });
    }
    const query = searchFilters.length ? { $or: searchFilters } : {};
    return UserModel.countDocuments(query);
  }
  async findByLogin(login: string) {
    return UserModel.findOne({ userName: login }).lean();
  }
  async findByEmail(email: string) {
    return UserModel.findOne({ email }).lean();
  }
  findAll({
    pageSize,
    pageNumber,
    sortBy,
    sortDirection,
    searchLoginTerm,
    searchEmailTerm,
  }: FindAllUsersParams) {
    const skip = pageSize && pageNumber ? (pageNumber - 1) * pageSize : 0;
    const limit = pageSize || 0;
    const sort: any = {};
    if (sortBy && sortDirection) {
      sort[sortFieldMap[sortBy] ?? sortBy] = sortDirection;
    }

    const searchFilters = [];
    if (searchLoginTerm) {
      searchFilters.push({
        userName: { $regex: searchLoginTerm, $options: "i" },
      });
    }
    if (searchEmailTerm) {
      searchFilters.push({ email: { $regex: searchEmailTerm, $options: "i" } });
    }
    const query = searchFilters.length ? { $or: searchFilters } : {};

    return UserModel.find(query).sort(sort).skip(skip).limit(limit).lean();
  }
  async deleteById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      return false;
    }
    const result = await UserModel.deleteOne({ _id: new Types.ObjectId(id) });
    return result.deletedCount === 1;
  }
  async deleteAll() {
    await UserModel.deleteMany({});
  }

  async findByConfirmationCode(code: string) {
    return UserModel.findOne({
      "emailConfirmation.confirmationCode": code,
    }).lean();
  }
  async updateConfirmationStatus(id: string, isConfirmed: boolean) {
    if (!Types.ObjectId.isValid(id)) {
      return false;
    }
    const result = await UserModel.updateOne(
      { _id: new Types.ObjectId(id) },
      { $set: { "emailConfirmation.isConfirmed": isConfirmed } },
    );
    return result.modifiedCount === 1;
  }
  // Returns false if no user has this email.
  async setPasswordRecovery(
    email: string,
    passwordRecovery: NonNullable<User["passwordRecovery"]>,
  ) {
    const result = await UserModel.updateOne(
      { email },
      { $set: { passwordRecovery } },
    );
    return result.matchedCount === 1;
  }
  async findByRecoveryCode(recoveryCode: string) {
    return UserModel.findOne({
      "passwordRecovery.recoveryCode": recoveryCode,
    }).lean();
  }
  // Sets the new password and clears the recovery code so it can't be reused.
  async updatePassword(id: string, passwordHash: string, passwordSalt: string) {
    if (!Types.ObjectId.isValid(id)) {
      return false;
    }
    const result = await UserModel.updateOne(
      { _id: new Types.ObjectId(id) },
      { $set: { passwordHash, passwordSalt }, $unset: { passwordRecovery: "" } },
    );
    return result.modifiedCount === 1;
  }
  async addRefreshTokenMeta(id: string, meta: RefreshTokenMeta) {
    if (!Types.ObjectId.isValid(id)) {
      return false;
    }
    const result = await UserModel.updateOne(
      { _id: new Types.ObjectId(id) },
      { $push: { refreshTokensMeta: meta } },
    );
    return result.modifiedCount === 1;
  }
  async findByDeviceId(deviceId: string) {
    return UserModel.findOne({ "refreshTokensMeta.deviceId": deviceId }).lean();
  }
  // With lastActiveDate, only removes the session if it still matches (i.e. the token wasn't rotated meanwhile).
  async removeRefreshTokenMeta(
    id: string,
    deviceId: string,
    lastActiveDate?: Date,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      return false;
    }
    const result = await UserModel.updateOne(
      { _id: new Types.ObjectId(id) },
      {
        $pull: {
          refreshTokensMeta: lastActiveDate
            ? { deviceId, lastActiveDate }
            : { deviceId },
        },
      },
    );
    return result.modifiedCount === 1;
  }
  // Returns true if the user exists, even when there were no other devices to remove.
  async removeOtherRefreshTokensMeta(id: string, currentDeviceId: string) {
    if (!Types.ObjectId.isValid(id)) {
      return false;
    }
    const result = await UserModel.updateOne(
      { _id: new Types.ObjectId(id) },
      { $pull: { refreshTokensMeta: { deviceId: { $ne: currentDeviceId } } } },
    );
    return result.matchedCount === 1;
  }
  // A refresh token is legit only while its iat still equals the lastActiveDate of its device session.
  async findByRefreshTokenMeta(
    id: string,
    deviceId: string,
    lastActiveDate: Date,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }
    return UserModel.findOne({
      _id: new Types.ObjectId(id),
      refreshTokensMeta: { $elemMatch: { deviceId, lastActiveDate } },
    }).lean();
  }
  // Atomically moves the session to the new token; returns false if the old one was already
  // rotated/revoked, so two concurrent requests with the same token can't both succeed.
  async updateRefreshTokenLastActiveDate(
    id: string,
    deviceId: string,
    oldLastActiveDate: Date,
    newLastActiveDate: Date,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      return false;
    }
    const result = await UserModel.updateOne(
      {
        _id: new Types.ObjectId(id),
        refreshTokensMeta: {
          $elemMatch: { deviceId, lastActiveDate: oldLastActiveDate },
        },
      },
      { $set: { "refreshTokensMeta.$.lastActiveDate": newLastActiveDate } },
    );
    return result.modifiedCount === 1;
  }
}

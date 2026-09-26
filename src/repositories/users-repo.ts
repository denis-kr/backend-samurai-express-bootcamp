import { Types } from "mongoose";
import { UserModel } from "./models/user-model.js";
import type { User } from "./models/user-model.js";

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

export const usersRepository = {
  async create(user: User) {
    const result = await UserModel.create(user);
    return result._id.toString();
  },
  async findById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }
    return UserModel.findById(id).lean();
  },
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
  },
  async findByLogin(login: string) {
    return UserModel.findOne({ userName: login }).lean();
  },
  async findByEmail(email: string) {
    return UserModel.findOne({ email }).lean();
  },
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
  },
  async deleteById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      return false;
    }
    const result = await UserModel.deleteOne({ _id: new Types.ObjectId(id) });
    return result.deletedCount === 1;
  },
  async deleteAll() {
    await UserModel.deleteMany({});
  },

  async findByConfirmationCode(code: string) {
    return UserModel.findOne({
      "emailConfirmation.confirmationCode": code,
    }).lean();
  },
  async updateConfirmationStatus(id: string, isConfirmed: boolean) {
    if (!Types.ObjectId.isValid(id)) {
      return false;
    }
    const result = await UserModel.updateOne(
      { _id: new Types.ObjectId(id) },
      { $set: { "emailConfirmation.isConfirmed": isConfirmed } },
    );
    return result.modifiedCount === 1;
  },
};

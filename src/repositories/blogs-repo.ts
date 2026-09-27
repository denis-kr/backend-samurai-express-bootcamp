import { injectable } from "inversify";
import { Types } from "mongoose";
import { BlogModel } from "./models/blog-model.js";
import type { Blog } from "./models/blog-model.js";

export type FindAllBlogsParams = {
  pageSize: number;
  pageNumber: number;
  searchNameTerm: string | null;
  sortDirection: "asc" | "desc";
  sortBy: string;
};

@injectable()
export class BlogsRepository {
  async findById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }
    return BlogModel.findById(id).lean();
  }
  async getTotalCount(searchNameTerm?: string | null) {
    const query = searchNameTerm
      ? { name: { $regex: searchNameTerm, $options: "i" } }
      : {};
    return BlogModel.countDocuments(query);
  }
  async findAll({
    pageSize,
    pageNumber,
    searchNameTerm,
    sortDirection,
    sortBy,
  }: FindAllBlogsParams) {
    const skip = pageSize && pageNumber ? (pageNumber - 1) * pageSize : 0;
    const limit = Number(pageSize) || 0;
    const query = searchNameTerm
      ? { name: { $regex: searchNameTerm, $options: "i" } }
      : {};
    const sortQuery =
      sortBy && sortDirection ? { [sortBy]: sortDirection } : {};
    return BlogModel.find(query)
      .sort(sortQuery)
      .skip(skip)
      .limit(limit)
      .lean();
  }
  async create(blog: Blog) {
    const result = await BlogModel.create(blog);
    return result._id.toString();
  }
  async deleteById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      return false;
    }
    const result = await BlogModel.deleteOne({ _id: new Types.ObjectId(id) });
    return result.deletedCount === 1;
  }
  async updateById(id: string, blog: Omit<Blog, "createdAt" | "isMembership">) {
    if (!Types.ObjectId.isValid(id)) {
      return false;
    }
    const result = await BlogModel.updateOne(
      { _id: new Types.ObjectId(id) },
      { $set: blog },
    );
    return result.matchedCount === 1;
  }
  async deleteAll() {
    await BlogModel.deleteMany({});
  }
}

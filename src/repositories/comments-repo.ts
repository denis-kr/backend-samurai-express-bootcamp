import { Types } from "mongoose";
import { CommentModel } from "./models/comment-model.js";
import type { Comment } from "./models/comment-model.js";

export type FindAllCommentsParams = {
  postId: string;
  pageSize: number;
  pageNumber: number;
  sortBy: string;
  sortDirection: "asc" | "desc";
};

export const commentsRepository = {
  async create(comment: Comment) {
    const result = await CommentModel.create(comment);
    return result._id.toString();
  },
  async findById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }
    return CommentModel.findById(id).lean();
  },
  async getTotalCount(postId: string) {
    return CommentModel.countDocuments({ postId });
  },
  async findAllByPostId({
    postId,
    pageSize,
    pageNumber,
    sortBy,
    sortDirection,
  }: FindAllCommentsParams) {
    const skip = pageSize && pageNumber ? (pageNumber - 1) * pageSize : 0;
    const limit = pageSize || 0;
    const sort: any = {};
    if (sortBy && sortDirection) {
      sort[sortBy] = sortDirection;
    }
    return CommentModel.find({ postId })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
  },
  async updateById(id: string, content: string) {
    if (!Types.ObjectId.isValid(id)) {
      return false;
    }
    const result = await CommentModel.updateOne(
      { _id: new Types.ObjectId(id) },
      { $set: { content } },
    );
    return result.matchedCount === 1;
  },
  async deleteById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      return false;
    }
    const result = await CommentModel.deleteOne({ _id: new Types.ObjectId(id) });
    return result.deletedCount === 1;
  },
  async deleteAll() {
    await CommentModel.deleteMany({});
  },
};

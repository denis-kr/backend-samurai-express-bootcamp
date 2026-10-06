import { injectable } from "inversify";
import { Types } from "mongoose";
import { PostModel } from "./models/post-model.js";
import type { Post, PostDocument } from "./models/post-model.js";
import type { LikeStatus } from "./models/comment-model.js";

export type FindAllPostsParams = {
  pageSize: number;
  pageNumber: number;
  sortBy: string;
  sortDirection: "asc" | "desc";
  blogId?: string;
};

@injectable()
export class PostsRepository {
  async findById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }
    return PostModel.findById(id).lean();
  }
  async getTotalCount(fields?: { blogId?: string }) {
    const filter = fields?.blogId ? { blogId: fields.blogId } : {};
    return PostModel.countDocuments(filter);
  }
  async findAll({
    pageSize,
    pageNumber,
    sortBy,
    sortDirection,
    blogId,
  }: FindAllPostsParams) {
    const skip = pageSize && pageNumber ? (pageNumber - 1) * pageSize : 0;
    const limit = pageSize || 0;
    const sort: any = {};
    if (sortBy && sortDirection) {
      sort[sortBy] = sortDirection;
    }
    const filter = blogId ? { blogId } : {};
    return PostModel.find(filter).sort(sort).skip(skip).limit(limit).lean();
  }
  async create(post: PostDocument) {
    const result = await PostModel.create(post);
    return result._id.toString();
  }
  async deleteById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      return false;
    }
    const result = await PostModel.deleteOne({ _id: new Types.ObjectId(id) });
    return result.deletedCount === 1;
  }
  async updateById(id: string, post: Post) {
    if (!Types.ObjectId.isValid(id)) {
      return false;
    }
    const result = await PostModel.updateOne(
      { _id: new Types.ObjectId(id) },
      { $set: post }
    );
    return result.matchedCount === 1;
  }
  async setLikeStatus(
    id: string,
    userId: string,
    userLogin: string,
    likeStatus: LikeStatus,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      return false;
    }
    const _id = new Types.ObjectId(id);

    // User already has an entry — only switch the status; createdAt stays
    // the date of their first reaction
    const updated = await PostModel.updateOne(
      { _id, "likes.userId": userId },
      { $set: { "likes.$.status": likeStatus } },
    );
    if (updated.matchedCount === 1) {
      return true;
    }

    // Nothing to record if a user who never reacted sends "None"
    if (likeStatus === "None") {
      return (await PostModel.exists({ _id })) !== null;
    }

    // First reaction from this user; the userId filter guards against
    // pushing a duplicate entry if two requests race each other
    const pushed = await PostModel.updateOne(
      { _id, "likes.userId": { $ne: userId } },
      {
        $push: {
          likes: { userId, userLogin, status: likeStatus, createdAt: new Date() },
        },
      },
    );
    if (pushed.matchedCount === 1) {
      return true;
    }

    // Lost a race to a concurrent push for the same user, or the post is gone
    return (await PostModel.exists({ _id })) !== null;
  }
  async deleteAll() {
    await PostModel.deleteMany({});
  }
}

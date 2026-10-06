import { Types } from "mongoose";
import type { LikeStatus } from "../repositories/models/comment-model.js";
import type { PostDocument } from "../repositories/models/post-model.js";

const NEWEST_LIKES_COUNT = 3;

// Shapes a post document for API responses. userId is the current viewer
// (null/undefined for anonymous requests) and decides extendedLikesInfo.myStatus.
export const mapPostToView = (
  post: PostDocument & { _id: Types.ObjectId },
  userId: string | null | undefined,
) => {
  // Posts created before likes were introduced have no likes field
  const likes = post.likes ?? [];
  const myLike = userId
    ? likes.find((like) => like.userId === userId)
    : undefined;
  const myStatus: LikeStatus = myLike?.status ?? "None";

  const newestLikes = likes
    .filter((like) => like.status === "Like")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, NEWEST_LIKES_COUNT)
    .map((like) => ({
      addedAt: like.createdAt,
      userId: like.userId,
      login: like.userLogin,
    }));

  return {
    id: post._id.toString(),
    title: post.title,
    shortDescription: post.shortDescription,
    content: post.content,
    blogId: post.blogId,
    blogName: post.blogName,
    createdAt: post.createdAt,
    extendedLikesInfo: {
      likesCount: likes.filter((like) => like.status === "Like").length,
      dislikesCount: likes.filter((like) => like.status === "Dislike").length,
      myStatus,
      newestLikes,
    },
  };
};

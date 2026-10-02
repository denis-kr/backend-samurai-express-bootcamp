import { Types } from "mongoose";
import type {
  Comment,
  LikeStatus,
} from "../repositories/models/comment-model.js";

// Shapes a comment document for API responses. userId is the current viewer
// (null for anonymous requests) and decides likesInfo.myStatus.
export const mapCommentToView = (
  comment: Comment & { _id: Types.ObjectId },
  userId: string | null,
) => {
  // Comments created before likes were introduced have no likes field
  const likes = comment.likes ?? [];
  const myLike = userId
    ? likes.find((like) => like.userId === userId)
    : undefined;
  const myStatus: LikeStatus = myLike?.status ?? "None";

  return {
    id: comment._id.toString(),
    content: comment.content,
    commentatorInfo: comment.commentatorInfo,
    createdAt: comment.createdAt,
    likesInfo: {
      likesCount: likes.filter((like) => like.status === "Like").length,
      dislikesCount: likes.filter((like) => like.status === "Dislike").length,
      myStatus,
    },
  };
};

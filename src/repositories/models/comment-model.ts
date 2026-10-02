import { Schema, model } from "mongoose";

export type LikeStatus = "None" | "Like" | "Dislike";

export type CommentLike = {
  userId: string;
  status: Exclude<LikeStatus, "None">;
  createdAt: Date;
};

export type Comment = {
  content: string;
  commentatorInfo: {
    userId: string;
    userLogin: string;
  };
  postId: string;
  createdAt: Date;
  likes: CommentLike[];
};

const commentLikeSchema = new Schema<CommentLike>(
  {
    userId: String,
    status: { type: String, enum: ["Like", "Dislike"] },
    createdAt: Date,
  },
  { _id: false },
);

const commentSchema = new Schema<Comment>(
  {
    content: String,
    commentatorInfo: {
      userId: String,
      userLogin: String,
    },
    postId: String,
    createdAt: Date,
    likes: { type: [commentLikeSchema], default: [] },
  },
  { versionKey: false },
);

export const CommentModel = model<Comment>("Comment", commentSchema, "comments");

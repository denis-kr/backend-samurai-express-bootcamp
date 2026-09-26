import { Schema, model } from "mongoose";

export type Comment = {
  content: string;
  commentatorInfo: {
    userId: string;
    userLogin: string;
  };
  postId: string;
  createdAt: Date;
};

const commentSchema = new Schema<Comment>(
  {
    content: String,
    commentatorInfo: {
      userId: String,
      userLogin: String,
    },
    postId: String,
    createdAt: Date,
  },
  { versionKey: false },
);

export const CommentModel = model<Comment>("Comment", commentSchema, "comments");

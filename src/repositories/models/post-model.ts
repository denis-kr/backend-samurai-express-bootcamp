import { Schema, model } from "mongoose";
import type { LikeStatus } from "./comment-model.js";

export type Post = {
  title: string;
  shortDescription: string;
  content: string;
  blogId: string;
  blogName: string;
};

// userLogin is stored alongside the like so newestLikes can be built without
// looking users up on every read. Entries are never removed, and createdAt is
// set once on the user's first reaction — later status changes keep it.
export type PostLike = {
  userId: string;
  userLogin: string;
  status: LikeStatus;
  createdAt: Date;
};

// `createdAt` and `likes` are set by the service on the way in, so they belong
// to the stored document rather than to the payload callers hand to the repository.
export type PostDocument = Post & { createdAt: Date; likes: PostLike[] };

const postLikeSchema = new Schema<PostLike>(
  {
    userId: String,
    userLogin: String,
    status: { type: String, enum: ["None", "Like", "Dislike"] },
    createdAt: Date,
  },
  { _id: false },
);

const postSchema = new Schema<PostDocument>(
  {
    title: String,
    shortDescription: String,
    content: String,
    blogId: String,
    blogName: String,
    createdAt: Date,
    likes: { type: [postLikeSchema], default: [] },
  },
  { versionKey: false },
);

export const PostModel = model<PostDocument>("Post", postSchema, "posts");

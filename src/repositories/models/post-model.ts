import { Schema, model } from "mongoose";

export type Post = {
  title: string;
  shortDescription: string;
  content: string;
  blogId: string;
  blogName: string;
};

// `createdAt` is set by the service on the way in, so it belongs to the stored
// document rather than to the payload callers hand to the repository.
export type PostDocument = Post & { createdAt: Date };

const postSchema = new Schema<PostDocument>(
  {
    title: String,
    shortDescription: String,
    content: String,
    blogId: String,
    blogName: String,
    createdAt: Date,
  },
  { versionKey: false },
);

export const PostModel = model<PostDocument>("Post", postSchema, "posts");

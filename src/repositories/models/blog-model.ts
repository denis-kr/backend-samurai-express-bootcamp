import { Schema, model } from "mongoose";

export type Blog = {
  name: string;
  description: string;
  websiteUrl: string;
  createdAt: Date;
  isMembership?: boolean;
};

// Field rules live in the express-validator middleware, not here — the schema
// only describes structure, so a bad request stays a 400 instead of a 500.
const blogSchema = new Schema<Blog>(
  {
    name: String,
    description: String,
    websiteUrl: String,
    createdAt: Date,
    isMembership: Boolean,
  },
  { versionKey: false },
);

export const BlogModel = model<Blog>("Blog", blogSchema, "blogs");

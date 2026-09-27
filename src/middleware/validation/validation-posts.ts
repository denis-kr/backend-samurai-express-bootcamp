import { body } from "express-validator";
import { container } from "../../composition-root.js";
import { BlogsRepository } from "../../repositories/blogs-repo.js";

const shortDescription = body("shortDescription")
  .trim()
  .notEmpty()
  .withMessage("Short description is required")
  .isString()
  .withMessage("Short description must be a string")
  .isLength({ max: 100 })
  .withMessage("Short description must not exceed 100 characters");

const title = body("title")
  .trim()
  .notEmpty()
  .withMessage("Title is required")
  .isString()
  .withMessage("Title must be a string")
  .isLength({ max: 30 })
  .withMessage("Title must not exceed 30 characters");

const content = body("content")
  .trim()
  .notEmpty()
  .withMessage("Content is required")
  .isString()
  .withMessage("Content must be a string")
  .isLength({ max: 1000 })
  .withMessage("Content must not exceed 1000 characters");

export const createUpdateBodyValidationMiddleware = [
  shortDescription,
  title,
  content,
  body("blogId")
    .trim()
    .notEmpty()
    .withMessage("Blog ID is required")
    .isString()
    .withMessage("Blog ID must be a string")
    .custom(async (value, { req }) => {
      const blog = await container.get(BlogsRepository).findById(value);

      if (!blog) {
        throw new Error("Invalid blog Id");
      }

      req.body.blogName = blog.name;
    })
    .withMessage("Invalid value"),
];

export const createNewPostForBlogValidationMiddleware = [
  shortDescription,
  title,
  content,
];

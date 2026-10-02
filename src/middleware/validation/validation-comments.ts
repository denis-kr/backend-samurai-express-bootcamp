import { body, param } from "express-validator";

export const commentsValidationMiddleware = [
  body("content")
    .isString()
    .withMessage("Content must be a string")
    .notEmpty()
    .isLength({ min: 20, max: 300 }),
];

export const likeStatusValidationMiddleware = [
  param("commentId")
    .trim()
    .notEmpty()
    .withMessage("commentId is required")
    .isString()
    .withMessage("commentId must be a string"),
  body("likeStatus")
    .exists()
    .withMessage("likeStatus is required")
    .isIn(["None", "Like", "Dislike"])
    .withMessage("likeStatus must be one of: None, Like, Dislike"),
];

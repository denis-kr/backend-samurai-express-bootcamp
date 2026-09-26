import { type Post } from "./../repositories/models/post-model.js";
import express, { Router, type Response } from "express";
import { basicAuthMiddleware } from "../middleware/auth/basic.js";
import { authMiddleware } from "../middleware/auth/auth-middleware.js";
import { createUpdateBodyValidationMiddleware } from "../middleware/validation/validation-posts.js";
import { commentsValidationMiddleware } from "../middleware/validation/validation-comments.js";
import type {
  RequestWithBody,
  RequestWithParams,
  RequestWithParamsAndBody,
  RequestWithParamsAndQuery,
  RequestWithQuery,
} from "../utils/types.js";
import { postsService } from "../domain/posts-service.js";
import { commentsService } from "../domain/comments-service.js";
import {
  paginationValidationMiddleware,
  idValidationMiddleware,
  sendErrorsIfAnyMiddleware,
} from "../middleware/validation/validation-universal.js";

const router: Router = express.Router();

//add new comment to a specific post
router.post(
  "/:postId/comments",
  authMiddleware,
  commentsValidationMiddleware,
  sendErrorsIfAnyMiddleware,
  async (
    req: RequestWithParamsAndBody<{ postId: string }, { content: string }>,
    res: Response,
  ) => {
    const { postId } = req.params;
    const { content } = req.body;

    const post = await postsService.findPostById(postId);
    if (!post) {
      return res.sendStatus(404);
    }

    const commentId = await commentsService.createComment(
      postId,
      req.userId!,
      content,
    );
    if (!commentId) {
      return res.sendStatus(401);
    }

    const createdComment = await commentsService.findCommentById(commentId);
    if (!createdComment) {
      return res.sendStatus(500);
    }

    return res.status(201).json({
      id: createdComment._id.toString(),
      content: createdComment.content,
      commentatorInfo: createdComment.commentatorInfo,
      createdAt: createdComment.createdAt,
    });
  },
);

//return all comments for a specific post
router.get(
  "/:postId/comments",
  paginationValidationMiddleware,
  sendErrorsIfAnyMiddleware,
  async (
    req: RequestWithParamsAndQuery<
      { postId: string },
      {
        pageSize?: number;
        pageNumber?: number;
        sortBy?: string;
        sortDirection?: "asc" | "desc";
      }
    >,
    res: Response,
  ) => {
    const { postId } = req.params;
    const {
      pageSize: pageSizeQuery = 10,
      pageNumber: pageNumberQuery = 1,
      sortBy = "createdAt",
      sortDirection = "desc",
    } = req.query;
    const pageSize = Number(pageSizeQuery) || 10;
    const pageNumber = Number(pageNumberQuery) || 1;

    const post = await postsService.findPostById(postId);
    if (!post) {
      return res.sendStatus(404);
    }

    const comments = await commentsService.findAllCommentsByPostId({
      postId,
      pageSize,
      pageNumber,
      sortBy,
      sortDirection,
    });

    const totalCount = comments.totalCount;

    return res.status(200).json({
      pagesCount: Math.ceil(totalCount / (pageSize || 10)),
      page: pageNumber,
      pageSize,
      totalCount,
      items: comments.items.map((comment) => ({
        id: comment._id.toString(),
        content: comment.content,
        commentatorInfo: comment.commentatorInfo,
        createdAt: comment.createdAt,
      })),
    });
  },
);

//get all posts
router.get(
  "/",
  paginationValidationMiddleware,
  sendErrorsIfAnyMiddleware,
  async (
    req: RequestWithQuery<{
      pageSize?: number;
      pageNumber?: number;
      sortBy?: string;
      sortDirection?: "asc" | "desc";
    }>,
    res: Response,
  ) => {
    const {
      pageSize: pageSizeQuery = 10,
      pageNumber: pageNumberQuery = 1,
      sortBy = "createdAt",
      sortDirection = "desc",
    } = req.query;
    const pageSize = Number(pageSizeQuery) || 10;
    const pageNumber = Number(pageNumberQuery) || 1;
    const posts = await postsService.findAllPosts({
      pageSize,
      pageNumber,
      sortBy,
      sortDirection,
    });

    const totalCount = posts.totalCount;

    return res.status(200).json({
      pagesCount: Math.ceil(totalCount / (pageSize || 10)),
      page: pageNumber,
      pageSize,
      totalCount,
      items: posts.items.map((post) => ({
        ...post,
        id: post._id.toString(),
        _id: undefined,
      })),
    });
  },
);

//get post by id
router.get(
  "/:id",
  idValidationMiddleware,
  sendErrorsIfAnyMiddleware,
  async (req: RequestWithParams<{ id: string }>, res: Response) => {
    const id = req.params.id;
    const post = await postsService.findPostById(id);
    if (post) {
      return res
        .status(200)
        .json({ ...post, id: post._id.toString(), _id: undefined });
    } else {
      return res.sendStatus(404);
    }
  },
);

router.use(basicAuthMiddleware);

//add new post
router.post(
  "/",
  createUpdateBodyValidationMiddleware,
  sendErrorsIfAnyMiddleware,
  async (
    req: RequestWithBody<{
      title: string;
      shortDescription: string;
      content: string;
      blogId: string;
      blogName: string;
    }>,
    res: Response,
  ) => {
    const { title, shortDescription, content, blogId, blogName } = req.body;

    const post: Post = {
      title,
      shortDescription,
      content,
      blogId,
      blogName,
    };
    const insertedId = await postsService.createPost(post);

    const createdPost = await postsService.findPostById(insertedId);

    if (!createdPost) return res.sendStatus(500);

    return res
      .status(201)
      .json({ ...createdPost, id: createdPost._id.toString(), _id: undefined });
  },
);

//update post by id
router.put(
  "/:id",
  createUpdateBodyValidationMiddleware,
  sendErrorsIfAnyMiddleware,
  async (
    req: RequestWithParamsAndBody<
      { id: string },
      {
        title: string;
        shortDescription: string;
        content: string;
        blogId: string;
        blogName: string;
      }
    >,
    res: Response,
  ) => {
    const id: string = req.params.id;
    const { title, shortDescription, content, blogId, blogName } = req.body;

    const isUpdated = await postsService.updatePost(id, {
      title,
      shortDescription,
      content,
      blogId,
      blogName,
    });

    if (isUpdated) {
      return res.sendStatus(204);
    } else {
      return res.sendStatus(404);
    }
  },
);

//delete post by id
router.delete("/:id", async (req, res) => {
  const id = req.params.id;
  const post = await postsService.findPostById(id);
  if (!post) {
    return res.sendStatus(404);
  }

  const isDeleted = await postsService.deletePostById(id);

  if (isDeleted) {
    return res.sendStatus(204);
  } else {
    return res.sendStatus(500);
  }
});

export default router;

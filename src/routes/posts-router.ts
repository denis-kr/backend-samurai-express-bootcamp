import { type Post } from "./../repositories/models/post-model.js";
import express, { Router, type Response } from "express";
import { inject, injectable } from "inversify";
import { basicAuthMiddleware } from "../middleware/auth/basic.js";
import {
  authMiddleware,
  optionalAuthMiddleware,
} from "../middleware/auth/auth-middleware.js";
import { mapCommentToView } from "../utils/mapCommentToView.js";
import { mapPostToView } from "../utils/mapPostToView.js";
import {
  createUpdateBodyValidationMiddleware,
  likeStatusValidationMiddleware,
} from "../middleware/validation/validation-posts.js";
import { commentsValidationMiddleware } from "../middleware/validation/validation-comments.js";
import type {
  RequestWithBody,
  RequestWithParams,
  RequestWithParamsAndBody,
  RequestWithParamsAndQuery,
  RequestWithQuery,
} from "../utils/types.js";
import { PostsService } from "../domain/posts-service.js";
import { CommentsService } from "../domain/comments-service.js";
import type { LikeStatus } from "../repositories/models/comment-model.js";
import {
  paginationValidationMiddleware,
  idValidationMiddleware,
  sendErrorsIfAnyMiddleware,
} from "../middleware/validation/validation-universal.js";

@injectable()
export class PostsRouter {
  readonly router: Router = express.Router();

  constructor(
    @inject(PostsService) private readonly postsService: PostsService,
    @inject(CommentsService) private readonly commentsService: CommentsService,
  ) {
    this.router.put(
      "/:postId/like-status",
      authMiddleware,
      likeStatusValidationMiddleware,
      sendErrorsIfAnyMiddleware,
      this.setLikeStatus.bind(this),
    );

    this.router.post(
      "/:postId/comments",
      authMiddleware,
      commentsValidationMiddleware,
      sendErrorsIfAnyMiddleware,
      this.createCommentForPost.bind(this),
    );
    this.router.get(
      "/:postId/comments",
      optionalAuthMiddleware,
      paginationValidationMiddleware,
      sendErrorsIfAnyMiddleware,
      this.getCommentsByPostId.bind(this),
    );
    this.router.get(
      "/",
      optionalAuthMiddleware,
      paginationValidationMiddleware,
      sendErrorsIfAnyMiddleware,
      this.getPosts.bind(this),
    );
    this.router.get(
      "/:id",
      optionalAuthMiddleware,
      idValidationMiddleware,
      sendErrorsIfAnyMiddleware,
      this.getPostById.bind(this),
    );

    this.router.use(basicAuthMiddleware);

    this.router.post(
      "/",
      createUpdateBodyValidationMiddleware,
      sendErrorsIfAnyMiddleware,
      this.createPost.bind(this),
    );
    this.router.put(
      "/:id",
      createUpdateBodyValidationMiddleware,
      sendErrorsIfAnyMiddleware,
      this.updatePost.bind(this),
    );
    this.router.delete("/:id", this.deletePost.bind(this));
  }

  async setLikeStatus(
    req: RequestWithParamsAndBody<
      { postId: string },
      { likeStatus: LikeStatus }
    >,
    res: Response,
  ) {
    const isUpdated = await this.postsService.setLikeStatus(
      req.params.postId,
      req.userId!,
      req.body.likeStatus,
    );
    if (!isUpdated) {
      return res.sendStatus(404);
    }

    return res.sendStatus(204);
  }

  //add new comment to a specific post
  async createCommentForPost(
    req: RequestWithParamsAndBody<{ postId: string }, { content: string }>,
    res: Response,
  ) {
    const { postId } = req.params;
    const { content } = req.body;

    const post = await this.postsService.findPostById(postId);
    if (!post) {
      return res.sendStatus(404);
    }

    const commentId = await this.commentsService.createComment(
      postId,
      req.userId!,
      content,
    );
    if (!commentId) {
      return res.sendStatus(401);
    }

    const createdComment =
      await this.commentsService.findCommentById(commentId);
    if (!createdComment) {
      return res.sendStatus(500);
    }

    return res.status(201).json(mapCommentToView(createdComment, req.userId));
  }

  //return all comments for a specific post
  async getCommentsByPostId(
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
  ) {
    const { postId } = req.params;
    const {
      pageSize: pageSizeQuery = 10,
      pageNumber: pageNumberQuery = 1,
      sortBy = "createdAt",
      sortDirection = "desc",
    } = req.query;
    const pageSize = Number(pageSizeQuery) || 10;
    const pageNumber = Number(pageNumberQuery) || 1;

    const post = await this.postsService.findPostById(postId);
    if (!post) {
      return res.sendStatus(404);
    }

    const comments = await this.commentsService.findAllCommentsByPostId({
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
      items: comments.items.map((comment) =>
        mapCommentToView(comment, req.userId),
      ),
    });
  }

  //get all posts
  async getPosts(
    req: RequestWithQuery<{
      pageSize?: number;
      pageNumber?: number;
      sortBy?: string;
      sortDirection?: "asc" | "desc";
    }>,
    res: Response,
  ) {
    const {
      pageSize: pageSizeQuery = 10,
      pageNumber: pageNumberQuery = 1,
      sortBy = "createdAt",
      sortDirection = "desc",
    } = req.query;
    const pageSize = Number(pageSizeQuery) || 10;
    const pageNumber = Number(pageNumberQuery) || 1;
    const posts = await this.postsService.findAllPosts({
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
      items: posts.items.map((post) => mapPostToView(post, req.userId)),
    });
  }

  //get post by id
  async getPostById(req: RequestWithParams<{ id: string }>, res: Response) {
    const id = req.params.id;
    const post = await this.postsService.findPostById(id);
    if (post) {
      return res.status(200).json(mapPostToView(post, req.userId));
    } else {
      return res.sendStatus(404);
    }
  }

  //add new post
  async createPost(
    req: RequestWithBody<{
      title: string;
      shortDescription: string;
      content: string;
      blogId: string;
      blogName: string;
    }>,
    res: Response,
  ) {
    const { title, shortDescription, content, blogId, blogName } = req.body;

    const post: Post = {
      title,
      shortDescription,
      content,
      blogId,
      blogName,
    };
    const insertedId = await this.postsService.createPost(post);

    const createdPost = await this.postsService.findPostById(insertedId);

    if (!createdPost) return res.sendStatus(500);

    return res.status(201).json(mapPostToView(createdPost, null));
  }

  //update post by id
  async updatePost(
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
  ) {
    const id: string = req.params.id;
    const { title, shortDescription, content, blogId, blogName } = req.body;

    const isUpdated = await this.postsService.updatePost(id, {
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
  }

  //delete post by id
  async deletePost(req: RequestWithParams<{ id: string }>, res: Response) {
    const id = req.params.id;
    const post = await this.postsService.findPostById(id);
    if (!post) {
      return res.sendStatus(404);
    }

    const isDeleted = await this.postsService.deletePostById(id);

    if (isDeleted) {
      return res.sendStatus(204);
    } else {
      return res.sendStatus(500);
    }
  }
}

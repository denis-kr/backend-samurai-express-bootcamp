import express, { Router, type Response } from "express";
import { inject, injectable } from "inversify";
import {
  commentsValidationMiddleware,
  likeStatusValidationMiddleware,
} from "../middleware/validation/validation-comments.js";
import { sendErrorsIfAnyMiddleware } from "../middleware/validation/validation-universal.js";
import {
  authMiddleware,
  optionalAuthMiddleware,
} from "../middleware/auth/auth-middleware.js";
import { CommentsService } from "../domain/comments-service.js";
import type {
  RequestWithParams,
  RequestWithParamsAndBody,
} from "../utils/types.js";
import type { LikeStatus } from "../repositories/models/comment-model.js";
import { mapCommentToView } from "../utils/mapCommentToView.js";

@injectable()
export class CommentsRouter {
  readonly router: Router = express.Router();

  constructor(
    @inject(CommentsService) private readonly commentsService: CommentsService,
  ) {
    this.router.get(
      "/:id",
      optionalAuthMiddleware,
      this.getCommentById.bind(this),
    );

    this.router.use(authMiddleware);

    this.router.put(
      "/:commentId/like-status",
      likeStatusValidationMiddleware,
      sendErrorsIfAnyMiddleware,
      this.likeStatus.bind(this),
    );

    this.router.put(
      "/:commentId",
      commentsValidationMiddleware,
      sendErrorsIfAnyMiddleware,
      this.updateComment.bind(this),
    );
    this.router.delete("/:commentId", this.deleteComment.bind(this));
  }

  async likeStatus(
    req: RequestWithParamsAndBody<
      { commentId: string },
      { likeStatus: LikeStatus }
    >,
    res: Response,
  ) {
    const isUpdated = await this.commentsService.setLikeStatus(
      req.params.commentId,
      req.userId!,
      req.body.likeStatus,
    );
    if (!isUpdated) {
      return res.sendStatus(404);
    }

    return res.sendStatus(204);
  }

  async getCommentById(req: RequestWithParams<{ id: string }>, res: Response) {
    const comment = await this.commentsService.findCommentById(req.params.id);
    if (!comment) {
      return res.sendStatus(404);
    }

    return res.status(200).json(mapCommentToView(comment, req.userId));
  }

  async updateComment(
    req: RequestWithParamsAndBody<{ commentId: string }, { content: string }>,
    res: Response,
  ) {
    const { commentId } = req.params;
    const { content } = req.body;

    const comment = await this.commentsService.findCommentById(commentId);
    if (!comment) {
      return res.sendStatus(404);
    }

    if (comment.commentatorInfo.userId !== req.userId) {
      return res.sendStatus(403);
    }

    const isUpdated = await this.commentsService.updateComment(
      commentId,
      content,
    );
    if (isUpdated) {
      return res.sendStatus(204);
    } else {
      return res.sendStatus(404);
    }
  }

  async deleteComment(
    req: RequestWithParams<{ commentId: string }>,
    res: Response,
  ) {
    const { commentId } = req.params;

    const comment = await this.commentsService.findCommentById(commentId);
    if (!comment) {
      return res.sendStatus(404);
    }

    if (comment.commentatorInfo.userId !== req.userId) {
      return res.sendStatus(403);
    }

    const isDeleted = await this.commentsService.deleteCommentById(commentId);
    if (isDeleted) {
      return res.sendStatus(204);
    } else {
      return res.sendStatus(404);
    }
  }
}

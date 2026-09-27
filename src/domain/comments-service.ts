import { inject, injectable } from "inversify";
import { CommentsRepository } from "../repositories/comments-repo.js";
import type { FindAllCommentsParams } from "../repositories/comments-repo.js";
import type { Comment } from "../repositories/models/comment-model.js";
import { UsersRepository } from "../repositories/users-repo.js";

@injectable()
export class CommentsService {
  constructor(
    @inject(CommentsRepository)
    private readonly commentsRepository: CommentsRepository,
    @inject(UsersRepository) private readonly usersRepository: UsersRepository,
  ) {}

  async createComment(postId: string, userId: string, content: string) {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      return null;
    }

    const newComment: Comment = {
      content,
      commentatorInfo: {
        userId,
        userLogin: user.userName,
      },
      postId,
      createdAt: new Date(),
    };

    return this.commentsRepository.create(newComment);
  }
  findCommentById(id: string) {
    return this.commentsRepository.findById(id);
  }
  async findAllCommentsByPostId(params: FindAllCommentsParams) {
    const items = await this.commentsRepository.findAllByPostId(params);
    const totalCount = await this.commentsRepository.getTotalCount(
      params.postId,
    );

    return { items, totalCount };
  }
  updateComment(id: string, content: string) {
    return this.commentsRepository.updateById(id, content);
  }
  deleteCommentById(id: string) {
    return this.commentsRepository.deleteById(id);
  }
}

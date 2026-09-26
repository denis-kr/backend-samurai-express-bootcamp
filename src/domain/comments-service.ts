import { commentsRepository } from "../repositories/comments-repo.js";
import type { FindAllCommentsParams } from "../repositories/comments-repo.js";
import type { Comment } from "../repositories/models/comment-model.js";
import { usersRepository } from "../repositories/users-repo.js";

export const commentsService = {
  async createComment(postId: string, userId: string, content: string) {
    const user = await usersRepository.findById(userId);
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

    return commentsRepository.create(newComment);
  },
  findCommentById: (id: string) => {
    return commentsRepository.findById(id);
  },
  async findAllCommentsByPostId(params: FindAllCommentsParams) {
    const items = await commentsRepository.findAllByPostId(params);
    const totalCount = await commentsRepository.getTotalCount(params.postId);

    return { items, totalCount };
  },
  updateComment(id: string, content: string) {
    return commentsRepository.updateById(id, content);
  },
  deleteCommentById(id: string) {
    return commentsRepository.deleteById(id);
  },
};

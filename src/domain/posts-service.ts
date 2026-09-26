import { postsRepository } from "../repositories/posts-repo.js";
import type { FindAllPostsParams } from "../repositories/posts-repo.js";
import type { Post } from "../repositories/models/post-model.js";

export const postsService = {
  findAllPosts: async (params: FindAllPostsParams) => {
    const posts = await postsRepository.findAll(params);

    const totalCount = await postsRepository.getTotalCount();

    return { items: posts, totalCount };
  },
  findPostById: (id: string) => {
    return postsRepository.findById(id);
  },
  deletePostById: (id: string) => {
    return postsRepository.deleteById(id);
  },
  createPost: (post: Post) => {
    const newPost = { ...post, createdAt: new Date() };
    return postsRepository.create(newPost);
  },
  updatePost(id: string, post: Post) {
    return postsRepository.updateById(id, post);
  },
};

import { inject, injectable } from "inversify";
import { PostsRepository } from "../repositories/posts-repo.js";
import type { FindAllPostsParams } from "../repositories/posts-repo.js";
import type { Post } from "../repositories/models/post-model.js";

@injectable()
export class PostsService {
  constructor(
    @inject(PostsRepository) private readonly postsRepository: PostsRepository,
  ) {}

  async findAllPosts(params: FindAllPostsParams) {
    const posts = await this.postsRepository.findAll(params);

    const totalCount = await this.postsRepository.getTotalCount();

    return { items: posts, totalCount };
  }
  findPostById(id: string) {
    return this.postsRepository.findById(id);
  }
  deletePostById(id: string) {
    return this.postsRepository.deleteById(id);
  }
  createPost(post: Post) {
    const newPost = { ...post, createdAt: new Date() };
    return this.postsRepository.create(newPost);
  }
  updatePost(id: string, post: Post) {
    return this.postsRepository.updateById(id, post);
  }
}

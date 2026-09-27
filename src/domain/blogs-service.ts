import { inject, injectable } from "inversify";
import { BlogsRepository } from "../repositories/blogs-repo.js";
import type { FindAllBlogsParams } from "../repositories/blogs-repo.js";
import type { Blog } from "../repositories/models/blog-model.js";
import type { FindAllPostsParams } from "../repositories/posts-repo.js";
import { PostsRepository } from "../repositories/posts-repo.js";

@injectable()
export class BlogsService {
  constructor(
    @inject(BlogsRepository) private readonly blogsRepository: BlogsRepository,
    @inject(PostsRepository) private readonly postsRepository: PostsRepository,
  ) {}

  async findAllBlogs(params: FindAllBlogsParams) {
    const totalCount = await this.blogsRepository.getTotalCount(
      params.searchNameTerm,
    );
    const blogs = await this.blogsRepository.findAll(params);

    return { items: blogs, totalCount };
  }
  findBlogById(id: string) {
    return this.blogsRepository.findById(id);
  }
  async findPostsByBlogId(
    params: Omit<FindAllPostsParams, "blogId"> & { blogId: string },
  ) {
    const posts = await this.postsRepository.findAll(params);
    const totalCount = await this.postsRepository.getTotalCount({
      blogId: params.blogId,
    });

    return { items: posts, totalCount };
  }
  deleteBlogById(id: string) {
    return this.blogsRepository.deleteById(id);
  }
  createBlog(blog: Omit<Blog, "createdAt" | "isMembership">) {
    const newBlog: Blog = {
      ...blog,
      isMembership: false,
      createdAt: new Date(),
    };
    return this.blogsRepository.create(newBlog);
  }
  updateBlog(id: string, blog: Omit<Blog, "createdAt" | "isMembership">) {
    return this.blogsRepository.updateById(id, blog);
  }
}

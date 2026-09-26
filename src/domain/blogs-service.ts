import { blogsRepository } from "../repositories/blogs-repo.js";
import type { FindAllBlogsParams } from "../repositories/blogs-repo.js";
import type { Blog } from "../repositories/models/blog-model.js";
import type { FindAllPostsParams } from "../repositories/posts-repo.js";
import { postsRepository } from "../repositories/posts-repo.js";

export const blogsService = {
  findAllBlogs: async (params: FindAllBlogsParams) => {
    const totalCount = await blogsRepository.getTotalCount(
      params.searchNameTerm,
    );
    const blogs = await blogsRepository.findAll(params);

    return { items: blogs, totalCount };
  },
  findBlogById: (id: string) => {
    return blogsRepository.findById(id);
  },
  findPostsByBlogId: async (
    params: Omit<FindAllPostsParams, "blogId"> & { blogId: string }
  ) => {
    const posts = await postsRepository.findAll(params);
    const totalCount = await postsRepository.getTotalCount({
      blogId: params.blogId,
    });

    return { items: posts, totalCount };
  },
  deleteBlogById: (id: string) => {
    return blogsRepository.deleteById(id);
  },
  createBlog: (blog: Omit<Blog, "createdAt" | "isMembership">) => {
    const newBlog: Blog = {
      ...blog,
      isMembership: false,
      createdAt: new Date(),
    };
    return blogsRepository.create(newBlog);
  },
  updateBlog(id: string, blog: Omit<Blog, "createdAt" | "isMembership">) {
    return blogsRepository.updateById(id, blog);
  },
};
export default blogsService;

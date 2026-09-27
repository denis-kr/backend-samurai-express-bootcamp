import express, { Router, type Response } from "express";
import { inject, injectable } from "inversify";
import { BlogsService } from "../domain/blogs-service.js";
import {
  createUpdateBodyValidationMiddleware,
  blogIdValidationMiddleware,
} from "../middleware/validation/validation-blogs.js";
import {
  paginationValidationMiddleware,
  idValidationMiddleware,
  sendErrorsIfAnyMiddleware,
} from "../middleware/validation/validation-universal.js";
import { basicAuthMiddleware } from "../middleware/auth/basic.js";
import type {
  RequestWithParamsAndBody,
  RequestWithBody,
  RequestWithParams,
  RequestWithQuery,
  RequestWithParamsAndQuery,
} from "../utils/types.js";
import type { Blog } from "../repositories/models/blog-model.js";
import { PostsService } from "../domain/posts-service.js";
import { createNewPostForBlogValidationMiddleware } from "../middleware/validation/validation-posts.js";

@injectable()
export class BlogsRouter {
  readonly router: Router = express.Router();

  constructor(
    @inject(BlogsService) private readonly blogsService: BlogsService,
    @inject(PostsService) private readonly postsService: PostsService,
  ) {
    this.router.get(
      "/",
      paginationValidationMiddleware,
      sendErrorsIfAnyMiddleware,
      this.getBlogs.bind(this),
    );
    this.router.get(
      "/:id",
      idValidationMiddleware,
      sendErrorsIfAnyMiddleware,
      this.getBlogById.bind(this),
    );
    this.router.get(
      "/:blogId/posts",
      blogIdValidationMiddleware,
      paginationValidationMiddleware,
      sendErrorsIfAnyMiddleware,
      this.getPostsByBlogId.bind(this),
    );

    this.router.use(basicAuthMiddleware);

    this.router.post(
      "/:blogId/posts",
      blogIdValidationMiddleware,
      createNewPostForBlogValidationMiddleware,
      sendErrorsIfAnyMiddleware,
      this.createPostForBlog.bind(this),
    );
    this.router.post(
      "/",
      createUpdateBodyValidationMiddleware,
      sendErrorsIfAnyMiddleware,
      this.createBlog.bind(this),
    );
    this.router.put(
      "/:id",
      createUpdateBodyValidationMiddleware,
      sendErrorsIfAnyMiddleware,
      this.updateBlog.bind(this),
    );
    this.router.delete("/:id", this.deleteBlog.bind(this));
  }

  // get all blogs
  async getBlogs(
    req: RequestWithQuery<{
      pageSize?: number;
      pageNumber?: number;
      sortBy?: string;
      sortDirection?: "asc" | "desc";
      searchNameTerm?: string;
    }>,
    res: Response,
  ) {
    const {
      pageSize: pageSizeQuery = 10,
      pageNumber: pageNumberQuery = 1,
      searchNameTerm = null,
      sortDirection = "desc",
      sortBy = "createdAt",
    } = req.query;
    const pageSize = Number(pageSizeQuery) || 10;
    const pageNumber = Number(pageNumberQuery) || 1;
    const blogs = await this.blogsService.findAllBlogs({
      pageSize,
      pageNumber,
      searchNameTerm,
      sortDirection,
      sortBy,
    });

    const totalCount = blogs.totalCount;

    return res.status(200).json({
      pagesCount: Math.ceil(totalCount / (pageSize || 10)),
      page: pageNumber,
      pageSize,
      totalCount: totalCount,
      items: blogs.items.map((blog) => ({
        ...blog,
        id: blog._id.toString(),
        _id: undefined,
      })),
    });
  }

  // get blog by id
  async getBlogById(req: RequestWithParams<{ id: string }>, res: Response) {
    const id = req.params.id;
    const blog = await this.blogsService.findBlogById(id);
    if (blog) {
      return res
        .status(200)
        .json({ ...blog, id: blog._id.toString(), _id: undefined });
    } else {
      return res.sendStatus(404);
    }
  }

  //Returns all posts for specified blog
  async getPostsByBlogId(
    req: RequestWithParamsAndQuery<
      { blogId: string },
      {
        pageSize?: number;
        pageNumber?: number;
        sortBy?: string;
        sortDirection?: "asc" | "desc";
      }
    >,
    res: Response,
  ) {
    const blogId = req.params.blogId;
    const {
      pageSize: pageSizeQuery = 10,
      pageNumber: pageNumberQuery = 1,
      sortBy = "createdAt",
      sortDirection = "desc",
    } = req.query;
    const pageSize = Number(pageSizeQuery) || 10;
    const pageNumber = Number(pageNumberQuery) || 1;

    const blog = await this.blogsService.findBlogById(blogId);
    if (!blog) {
      return res.sendStatus(404);
    }
    const posts = await this.blogsService.findPostsByBlogId({
      pageSize,
      pageNumber,
      sortBy,
      sortDirection,
      blogId,
    });
    const totalCount = posts.totalCount;

    return res.status(200).json({
      pagesCount: Math.ceil(totalCount / (pageSize || 10)),
      page: pageNumber,
      pageSize,
      totalCount: totalCount,
      items: posts.items.map((post) => ({
        ...post,
        id: post._id.toString(),
        _id: undefined,
      })),
    });
  }

  //Create new post for specified blog
  async createPostForBlog(
    req: RequestWithParamsAndBody<
      { blogId: string },
      { title: string; shortDescription: string; content: string }
    >,
    res: Response,
  ) {
    const blogId = req.params.blogId;
    const { title, shortDescription, content } = req.body;

    const blog = await this.blogsService.findBlogById(blogId);
    if (!blog) {
      return res.sendStatus(404);
    }

    const newPostId = await this.postsService.createPost({
      title,
      shortDescription,
      content,
      blogId,
      blogName: blog.name,
    });

    const newPost = await this.postsService.findPostById(newPostId);
    if (newPost) {
      return res
        .status(201)
        .json({ ...newPost, id: newPost._id.toString(), _id: undefined });
    }
    return res.sendStatus(500);
  }

  //add new blog
  async createBlog(
    req: RequestWithBody<{
      name: string;
      description: string;
      websiteUrl: string;
    }>,
    res: Response,
  ) {
    const { name, description, websiteUrl } = req.body;

    const blog: Omit<Blog, "createdAt" | "isMembership"> = {
      name,
      description,
      websiteUrl,
    };
    const createdId = await this.blogsService.createBlog(blog);

    const createdBlog = await this.blogsService.findBlogById(createdId);

    if (!createdBlog) return res.sendStatus(500);

    return res
      .status(201)
      .json({ ...createdBlog, id: createdBlog._id.toString(), _id: undefined });
  }

  //update blog by id
  async updateBlog(
    req: RequestWithParamsAndBody<
      { id: string },
      { name: string; description: string; websiteUrl: string }
    >,
    res: Response,
  ) {
    const id = req.params.id;
    const { name, description, websiteUrl } = req.body;

    const isUpdated = await this.blogsService.updateBlog(id, {
      name,
      description,
      websiteUrl,
    });

    if (isUpdated) {
      return res.sendStatus(204);
    } else {
      return res.sendStatus(404);
    }
  }

  // Delete blog by id
  async deleteBlog(req: RequestWithParams<{ id: string }>, res: Response) {
    const id = req.params.id;
    const blog = await this.blogsService.findBlogById(id);
    if (!blog) {
      return res.sendStatus(404);
    }

    const isDeleted = await this.blogsService.deleteBlogById(id);
    if (isDeleted) {
      return res.sendStatus(204);
    } else {
      return res.sendStatus(500);
    }
  }
}

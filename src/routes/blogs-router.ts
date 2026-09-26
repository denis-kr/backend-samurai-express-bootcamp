import express, { Router, type Response } from "express";
import { blogsService } from "../domain/blogs-service.js";
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
import { postsService } from "../domain/posts-service.js";
import { createNewPostForBlogValidationMiddleware } from "../middleware/validation/validation-posts.js";

const router: Router = express.Router();

// get all blogs
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
      searchNameTerm?: string;
    }>,
    res: Response
  ) => {
    const {
      pageSize: pageSizeQuery = 10,
      pageNumber: pageNumberQuery = 1,
      searchNameTerm = null,
      sortDirection = "desc",
      sortBy = "createdAt",
    } = req.query;
    const pageSize = Number(pageSizeQuery) || 10;
    const pageNumber = Number(pageNumberQuery) || 1;
    const blogs = await blogsService.findAllBlogs({
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
);

// get blog by id
router.get(
  "/:id",
  idValidationMiddleware,
  sendErrorsIfAnyMiddleware,
  async (req: RequestWithParams<{ id: string }>, res: Response) => {
    const id = req.params.id;
    const blog = await blogsService.findBlogById(id);
    if (blog) {
      return res
        .status(200)
        .json({ ...blog, id: blog._id.toString(), _id: undefined });
    } else {
      res.sendStatus(404);
    }
  }
);

//Returns all posts for specified blog
router.get(
  "/:blogId/posts",
  blogIdValidationMiddleware,
  paginationValidationMiddleware,
  sendErrorsIfAnyMiddleware,
  async (
    req: RequestWithParamsAndQuery<
      { blogId: string },
      {
        pageSize?: number;
        pageNumber?: number;
        sortBy?: string;
        sortDirection?: "asc" | "desc";
      }
    >,
    res: Response
  ) => {
    const blogId = req.params.blogId;
    const {
      pageSize: pageSizeQuery = 10,
      pageNumber: pageNumberQuery = 1,
      sortBy = "createdAt",
      sortDirection = "desc",
    } = req.query;
    const pageSize = Number(pageSizeQuery) || 10;
    const pageNumber = Number(pageNumberQuery) || 1;

    const blog = await blogsService.findBlogById(blogId);
    if (!blog) {
      return res.sendStatus(404);
    }
    const posts = await blogsService.findPostsByBlogId({
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
);

router.use(basicAuthMiddleware);

//Create new post for specified blog
router.post(
  "/:blogId/posts",
  blogIdValidationMiddleware,
  createNewPostForBlogValidationMiddleware,
  sendErrorsIfAnyMiddleware,
  async (
    req: RequestWithParamsAndBody<
      { blogId: string },
      { title: string; shortDescription: string; content: string }
    >,
    res: Response
  ) => {
    const blogId = req.params.blogId;
    const { title, shortDescription, content } = req.body;

    const blog = await blogsService.findBlogById(blogId);
    if (!blog) {
      return res.sendStatus(404);
    }

    const newPostId = await postsService.createPost({
      title,
      shortDescription,
      content,
      blogId,
      blogName: blog.name,
    });

    const newPost = await postsService.findPostById(newPostId);
    if (newPost) {
      return res
        .status(201)
        .json({ ...newPost, id: newPost._id.toString(), _id: undefined });
    }
    return res.sendStatus(500);
  }
);

//add new blog
router.post(
  "/",
  createUpdateBodyValidationMiddleware,
  sendErrorsIfAnyMiddleware,
  async (
    req: RequestWithBody<{
      name: string;
      description: string;
      websiteUrl: string;
    }>,
    res: Response
  ) => {
    const { name, description, websiteUrl } = req.body;

    const blog: Omit<Blog, "createdAt" | "isMembership"> = {
      name,
      description,
      websiteUrl,
    };
    const createdId = await blogsService.createBlog(blog);

    const createdBlog = await blogsService.findBlogById(createdId);

    if (!createdBlog) return res.sendStatus(500);

    return res
      .status(201)
      .json({ ...createdBlog, id: createdBlog._id.toString(), _id: undefined });
  }
);

//update blog by id
router.put(
  "/:id",
  createUpdateBodyValidationMiddleware,
  sendErrorsIfAnyMiddleware,
  async (
    req: RequestWithParamsAndBody<
      { id: string },
      { name: string; description: string; websiteUrl: string }
    >,
    res: Response
  ) => {
    const id = req.params.id;
    const { name, description, websiteUrl } = req.body;

    const isUpdated = await blogsService.updateBlog(id, {
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
);

// Delete blog by id
router.delete("/:id", async (req, res) => {
  const id = req.params.id;
  const blog = await blogsService.findBlogById(id);
  if (!blog) {
    return res.sendStatus(404);
  }

  const isDeleted = await blogsService.deleteBlogById(id);
  if (isDeleted) {
    return res.sendStatus(204);
  } else {
    return res.sendStatus(500);
  }
});

export default router;

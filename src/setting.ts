import express from "express";
import type { Express, Response } from "express";
import { container } from "./composition-root.js";
import { BlogsRouter } from "./routes/blogs-router.js";
import { PostsRouter } from "./routes/posts-router.js";
import { UsersRouter } from "./routes/users-router.js";
import { AuthRouter } from "./routes/auth-router.js";
import { CommentsRouter } from "./routes/coments-router.js";
import { SecurityDevicesRouter } from "./routes/security-devices-router.js";
import { BlogsRepository } from "./repositories/blogs-repo.js";
import { PostsRepository } from "./repositories/posts-repo.js";
import { UsersRepository } from "./repositories/users-repo.js";
import { CommentsRepository } from "./repositories/comments-repo.js";
import { SecurityDevicesRepository } from "./repositories/security-devices-repo.js";
import cookieParser from "cookie-parser";

export const app: Express = express();

app.use(cookieParser());
app.use(express.json());
app.use("/users", container.get(UsersRouter).router);
app.use("/auth", container.get(AuthRouter).router);
app.use("/blogs", container.get(BlogsRouter).router);
app.use("/posts", container.get(PostsRouter).router);
app.use("/comments", container.get(CommentsRouter).router);
app.use("/security", container.get(SecurityDevicesRouter).router);

app.delete("/testing/all-data", async (_, res: Response) => {
  await container.get(BlogsRepository).deleteAll();
  await container.get(PostsRepository).deleteAll();
  await container.get(UsersRepository).deleteAll();
  await container.get(CommentsRepository).deleteAll();
  await container.get(SecurityDevicesRepository).deleteAll();
  res.sendStatus(204);
});

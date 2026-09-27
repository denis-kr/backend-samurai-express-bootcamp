import "reflect-metadata";
import { Container } from "inversify";
import { BlogsRepository } from "./repositories/blogs-repo.js";
import { PostsRepository } from "./repositories/posts-repo.js";
import { UsersRepository } from "./repositories/users-repo.js";
import { CommentsRepository } from "./repositories/comments-repo.js";
import { BlogsService } from "./domain/blogs-service.js";
import { PostsService } from "./domain/posts-service.js";
import { UsersService } from "./domain/users-service.js";
import { CommentsService } from "./domain/comments-service.js";
import { BlogsRouter } from "./routes/blogs-router.js";
import { PostsRouter } from "./routes/posts-router.js";
import { UsersRouter } from "./routes/users-router.js";
import { AuthRouter } from "./routes/auth-router.js";
import { CommentsRouter } from "./routes/coments-router.js";

export const container = new Container({ defaultScope: "Singleton" });

// repositories
container.bind(BlogsRepository).toSelf();
container.bind(PostsRepository).toSelf();
container.bind(UsersRepository).toSelf();
container.bind(CommentsRepository).toSelf();

// services
container.bind(BlogsService).toSelf();
container.bind(PostsService).toSelf();
container.bind(UsersService).toSelf();
container.bind(CommentsService).toSelf();

// routers
container.bind(BlogsRouter).toSelf();
container.bind(PostsRouter).toSelf();
container.bind(UsersRouter).toSelf();
container.bind(AuthRouter).toSelf();
container.bind(CommentsRouter).toSelf();

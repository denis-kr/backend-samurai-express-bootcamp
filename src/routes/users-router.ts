import express, { Router, type Response } from "express";
import { inject, injectable } from "inversify";
import {
  paginationValidationMiddleware,
  sendErrorsIfAnyMiddleware,
} from "../middleware/validation/validation-universal.js";
import type {
  RequestWithQuery,
  RequestWithParams,
  RequestWithBody,
} from "../utils/types.js";
import { UsersService } from "../domain/users-service.js";
import { createNewUserValidationMiddleware } from "../middleware/validation/validation-users.js";
import { basicAuthMiddleware } from "../middleware/auth/basic.js";

@injectable()
export class UsersRouter {
  readonly router: Router = express.Router();

  constructor(
    @inject(UsersService) private readonly usersService: UsersService,
  ) {
    this.router.use(basicAuthMiddleware);

    this.router.get(
      "/",
      paginationValidationMiddleware,
      sendErrorsIfAnyMiddleware,
      this.getUsers.bind(this),
    );
    this.router.post(
      "/",
      createNewUserValidationMiddleware,
      sendErrorsIfAnyMiddleware,
      this.createUser.bind(this),
    );
    this.router.delete("/:id", this.deleteUser.bind(this));
  }

  async getUsers(
    req: RequestWithQuery<{
      pageSize?: number;
      pageNumber?: number;
      sortBy?: string;
      sortDirection?: "asc" | "desc";
      searchLoginTerm?: string;
      searchEmailTerm?: string;
    }>,
    res: Response,
  ) {
    const {
      pageSize: pageSizeQuery = 10,
      pageNumber: pageNumberQuery = 1,
      searchLoginTerm = null,
      searchEmailTerm = null,
      sortDirection = "desc",
      sortBy = "createdAt",
    } = req.query;
    const pageSize = Number(pageSizeQuery) || 10;
    const pageNumber = Number(pageNumberQuery) || 1;

    const users = await this.usersService.findAllUsers({
      pageSize,
      pageNumber,
      searchLoginTerm,
      searchEmailTerm,
      sortDirection,
      sortBy,
    });

    const totalCount = users.totalCount;
    return res.status(200).json({
      pagesCount: Math.ceil(totalCount / (pageSize || 10)),
      page: pageNumber,
      pageSize,
      totalCount: totalCount,
      items: users.items.map((user) => ({
        login: user.userName,
        email: user.email,
        createdAt: user.createdAt,
        id: user._id.toString(),
        _id: undefined,
      })),
    });
  }

  async createUser(
    req: RequestWithBody<{ login: string; password: string; email: string }>,
    res: Response,
  ) {
    const { login, password, email } = req.body;
    const newUserId = await this.usersService.addNewUser(
      login,
      password,
      email,
    );
    if (!newUserId) {
      return res.sendStatus(500);
    }

    const newUser = await this.usersService.findUserById(newUserId);
    if (!newUser) {
      return res.sendStatus(500);
    }

    return res.status(201).json({
      login: newUser.userName,
      email: newUser.email,
      createdAt: newUser.createdAt,
      id: newUser._id.toString(),
      _id: undefined,
    });
  }

  async deleteUser(req: RequestWithParams<{ id: string }>, res: Response) {
    const { id } = req.params;

    const user = await this.usersService.findUserById(id);
    if (!user) {
      return res.sendStatus(404);
    }

    const isDeleted = await this.usersService.deleteUserById(id);
    if (isDeleted) {
      return res.sendStatus(204);
    }
    return res.sendStatus(500);
  }
}

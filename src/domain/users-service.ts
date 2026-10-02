import { add } from "date-fns/add";
import { inject, injectable } from "inversify";
import { UsersRepository } from "../repositories/users-repo.js";
import type { FindAllUsersParams } from "../repositories/users-repo.js";
import type { User } from "../repositories/models/user-model.js";
import bcrypt from "bcrypt";
import { emailManager } from "../manager/email-manager.js";
import { jwtService } from "../application/jwt-service.js";

@injectable()
export class UsersService {
  constructor(
    @inject(UsersRepository) private readonly usersRepository: UsersRepository,
  ) {}

  async findAllUsers(params: FindAllUsersParams) {
    const totalCount = await this.usersRepository.getTotalCount({
      searchLoginTerm: params.searchLoginTerm,
      searchEmailTerm: params.searchEmailTerm,
    });
    const items = await this.usersRepository.findAll(params);

    return { items, totalCount };
  }
  async findUserById(id: string) {
    return this.usersRepository.findById(id);
  }
  async deleteUserById(id: string) {
    return this.usersRepository.deleteById(id);
  }
  async addNewUser(login: string, password: string, email: string) {
    const passwordSalt = await bcrypt.genSalt(10);
    const passwordHash = await this._generatePasswordHash(
      password,
      passwordSalt,
    );

    const newUser: User = {
      userName: login,
      email,
      passwordHash,
      passwordSalt,
      createdAt: new Date(),
      emailConfirmation: {
        confirmationCode: crypto.randomUUID(),
        expirationDate: add(new Date(), { days: 1 }),
        isConfirmed: false,
      },
      expiredRefreshTokens: [],
    };

    const createResult = await this.usersRepository.create(newUser);

    try {
      await emailManager.sendConfirmationEmail(
        email,
        newUser.emailConfirmation.confirmationCode,
      );
    } catch (error) {
      console.log(error);
      await this.usersRepository.deleteById(createResult);
      return null;
    }

    return createResult;
  }
  async resendConfirmationEmail(email: string) {
    const user = await this.usersRepository.findByEmail(email);

    if (!user) {
      return false;
    }

    if (user.emailConfirmation.isConfirmed) {
      return false;
    }

    try {
      await emailManager.sendConfirmationEmail(
        email,
        user.emailConfirmation.confirmationCode,
      );
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }
  async confirmEmail(code: string) {
    const user = await this.usersRepository.findByConfirmationCode(code);

    if (!user) {
      return false;
    }

    if (user.emailConfirmation.isConfirmed) {
      return false;
    }

    if (
      user.emailConfirmation.confirmationCode === code ||
      user.emailConfirmation.expirationDate > new Date()
    ) {
      const result = await this.usersRepository.updateConfirmationStatus(
        user._id.toString(),
        true,
      );
      return result;
    }
    return false;
  }
  async _generatePasswordHash(password: string, passwordSalt: string) {
    return bcrypt.hash(password, passwordSalt);
  }
  async checkCredentials(loginOrEmail: string, password: string) {
    const user =
      (await this.usersRepository.findByLogin(loginOrEmail)) ||
      (await this.usersRepository.findByEmail(loginOrEmail));

    if (!user) {
      return false;
    }

    if (user.emailConfirmation.isConfirmed === false) {
      return false;
    }

    const passwordHash = await this._generatePasswordHash(
      password,
      user.passwordSalt,
    );

    if (passwordHash === user.passwordHash) {
      return user;
    }
    return false;
  }
  // Token signature/expiry/revocation are checked by refreshTokenMiddleware; expiring it here
  // is still atomic, so two concurrent requests with the same token can't both succeed.
  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      return null;
    }

    const isExpired = await this.usersRepository.expireRefreshToken(
      userId,
      refreshToken,
    );

    if (!isExpired) {
      return null;
    }

    return {
      accessToken: await jwtService.createAccessJWT(user),
      refreshToken: await jwtService.createRefreshJWT(user),
    };
  }
  async logout(userId: string, refreshToken: string) {
    return this.usersRepository.expireRefreshToken(userId, refreshToken);
  }
}

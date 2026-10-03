import { add } from "date-fns/add";
import { inject, injectable } from "inversify";
import { UsersRepository } from "../repositories/users-repo.js";
import type { FindAllUsersParams } from "../repositories/users-repo.js";
import type { User } from "../repositories/models/user-model.js";
import bcrypt from "bcrypt";
import { emailManager } from "../manager/email-manager.js";
import { jwtService } from "../application/jwt-service.js";
import { createTokens, iatToDate } from "../utils/createTokens.js";

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
  // Admin-created users (POST /users) are confirmed up front and get no confirmation email.
  async addNewUser(
    login: string,
    password: string,
    email: string,
    isConfirmed = false,
  ) {
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
        isConfirmed,
      },
      refreshTokensMeta: [],
    };

    const createResult = await this.usersRepository.create(newUser);

    if (isConfirmed) {
      return createResult;
    }

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
  // Sends the email even when no user has this address, so the response
  // can't be used to find out which emails are registered.
  async sendPasswordRecoveryEmail(email: string) {
    const recoveryCode = crypto.randomUUID();

    await this.usersRepository.setPasswordRecovery(email, {
      recoveryCode,
      expirationDate: add(new Date(), { hours: 1 }),
    });

    try {
      await emailManager.sendPasswordRecoveryEmail(email, recoveryCode);
    } catch (error) {
      console.log(error);
    }
  }
  async setNewPassword(recoveryCode: string, newPassword: string) {
    const user = await this.usersRepository.findByRecoveryCode(recoveryCode);

    if (!user || !user.passwordRecovery) {
      return false;
    }

    if (user.passwordRecovery.expirationDate < new Date()) {
      return false;
    }

    const passwordSalt = await bcrypt.genSalt(10);
    const passwordHash = await this._generatePasswordHash(
      newPassword,
      passwordSalt,
    );

    return this.usersRepository.updatePassword(
      user._id.toString(),
      passwordHash,
      passwordSalt,
    );
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
  // Token signature/expiry/session are checked by refreshTokenMiddleware; the lastActiveDate update
  // is still conditional on the old iat, so two concurrent requests with the same token can't both succeed.
  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.usersRepository.findById(userId);
    const tokenPayload = await jwtService.getRefreshTokenPayload(refreshToken);

    if (!user || !tokenPayload) {
      return null;
    }

    const tokens = await createTokens(user, tokenPayload.deviceId);

    if (!tokens) {
      return null;
    }

    const isUpdated =
      await this.usersRepository.updateRefreshTokenLastActiveDate(
        userId,
        tokenPayload.deviceId,
        iatToDate(tokenPayload.iat),
        iatToDate(tokens.iat),
      );

    if (!isUpdated) {
      return null;
    }

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }
  async saveRefreshTokenMeta(meta: {
    userId: string;
    deviceId: string;
    ip: string;
    iat: number;
    source: string;
  }) {
    return this.usersRepository.addRefreshTokenMeta(meta.userId, {
      deviceId: meta.deviceId,
      ip: meta.ip,
      title: meta.source,
      lastActiveDate: iatToDate(meta.iat),
    });
  }
  async getDevices(userId: string) {
    const user = await this.usersRepository.findById(userId);
    return user ? user.refreshTokensMeta : null;
  }
  async deleteOtherDevices(userId: string, refreshToken: string) {
    const tokenPayload = await jwtService.getRefreshTokenPayload(refreshToken);

    if (!tokenPayload) {
      return false;
    }

    return this.usersRepository.removeOtherRefreshTokensMeta(
      userId,
      tokenPayload.deviceId,
    );
  }
  // Looks the device up across all users so a device owned by someone else
  // can be told apart (forbidden) from one that doesn't exist (notFound).
  async deleteDevice(
    userId: string,
    deviceId: string,
  ): Promise<"deleted" | "notFound" | "forbidden"> {
    const owner = await this.usersRepository.findByDeviceId(deviceId);

    if (!owner) {
      return "notFound";
    }

    if (owner._id.toString() !== userId) {
      return "forbidden";
    }

    const isRemoved = await this.usersRepository.removeRefreshTokenMeta(
      userId,
      deviceId,
    );

    return isRemoved ? "deleted" : "notFound";
  }
  async logout(userId: string, refreshToken: string) {
    const tokenPayload = await jwtService.getRefreshTokenPayload(refreshToken);

    if (!tokenPayload) {
      return false;
    }

    return this.usersRepository.removeRefreshTokenMeta(
      userId,
      tokenPayload.deviceId,
      iatToDate(tokenPayload.iat),
    );
  }
}

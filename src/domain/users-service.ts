import { add } from "date-fns/add";
import { usersRepository } from "../repositories/users-repo.js";
import type { FindAllUsersParams } from "../repositories/users-repo.js";
import type { User } from "../repositories/models/user-model.js";
import bcrypt from "bcrypt";
import { emailManager } from "../manager/email-manager.js";

export const usersService = {
  async findAllUsers(params: FindAllUsersParams) {
    const totalCount = await usersRepository.getTotalCount({
      searchLoginTerm: params.searchLoginTerm,
      searchEmailTerm: params.searchEmailTerm,
    });
    const items = await usersRepository.findAll(params);

    return { items, totalCount };
  },
  async findUserById(id: string) {
    return usersRepository.findById(id);
  },
  async deleteUserById(id: string) {
    return usersRepository.deleteById(id);
  },
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
    };

    const createResult = await usersRepository.create(newUser);

    try {
      await emailManager.sendConfirmationEmail(
        email,
        newUser.emailConfirmation.confirmationCode,
      );
    } catch (error) {
      console.log(error);
      await usersRepository.deleteById(createResult);
      return null;
    }

    return createResult;
  },
  async resendConfirmationEmail(email: string) {
    const user = await usersRepository.findByEmail(email);

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
  },
  async confirmEmail(code: string) {
    const user = await usersRepository.findByConfirmationCode(code);

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
      const result = await usersRepository.updateConfirmationStatus(
        user._id.toString(),
        true,
      );
      return result;
    }
    return false;
  },
  async _generatePasswordHash(password: string, passwordSalt: string) {
    return bcrypt.hash(password, passwordSalt);
  },
  async checkCredentials(loginOrEmail: string, password: string) {
    const user =
      (await usersRepository.findByLogin(loginOrEmail)) ||
      (await usersRepository.findByEmail(loginOrEmail));

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
  },
};

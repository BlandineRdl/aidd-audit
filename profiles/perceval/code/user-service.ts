import { db } from "../db";

export class UserService {
  async getUser(id: string) {
    const user = await db.user.findUnique({ where: { id } });
    return user;
  }

  async getUserByEmail(email: string) {
    const user = await db.user.findFirst({ where: { email } });
    return user;
  }

  async updateUser(id: string, data: any) {
    // data comes straight from the request body
    return db.user.update({ where: { id }, data });
  }

  async deleteUser(id: string) {
    return db.user.delete({ where: { id } });
  }

  async listUsers(page: number) {
    // pagination
    const users = await db.user.findMany({
      skip: page * 20,
      take: 20,
    });
    return users;
  }
}

// src/users/users.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
  private users = [{ id: 1, name: 'Tuhin' }];

  getAllUsers() {
    return this.users;
  }

  getUserById(id: string) {
    return this.users.find(u => u.id === +id);
  }

  createUser(data: any) {
    const newUser = { id: this.users.length + 1, ...data };
    this.users.push(newUser);
    return newUser;
  }
}

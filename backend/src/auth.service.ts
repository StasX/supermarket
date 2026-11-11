import { Inject, Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compare, hash } from 'bcryptjs';
import { MODELS } from './database.module';
const jwt = require('jsonwebtoken');

@Injectable()
export class AuthService {
  constructor(@Inject(MODELS) private readonly models: any) {}

  private key() {
    return readFileSync(process.env['JWT_KEY_PATH'] || join(__dirname, '..', 'src', 'key.pem'));
  }

  async authenticate(token?: string) {
    if (!token) return null;
    try {
      const payload = jwt.verify(token, this.key(), { algorithms: ['HS256'] });
      // Accept existing sessions during the migration, but issue minimal new tokens.
      const query = payload.sub ? { _id: payload.sub } : (() => {
        const user = JSON.parse(payload.data);
        return { _id: user._id, username: user.username, password: user.password };
      })();
      return await this.models.users.findOne(query);
    } catch {
      return null;
    }
  }

  async login(body: any, response: any) {
    if (!email(body.username) || typeof body.password !== 'string' || body.password.length < 8) return { success: false };
    const user = await this.models.users.findOne({ username: body.username });
    if (!user || !(await compare(body.password, user.password))) return { success: false };
    const token = jwt.sign({}, this.key(), { subject: String(user._id), expiresIn: '9h', algorithm: 'HS256' });
    response.cookie('SESSIONID', token, { httpOnly: true, secure: false, sameSite: 'lax', path: '/' });
    return { success: true, role: user.role, name: `${user.name.first_name} ${user.name.last_name}`, user: user._id };
  }

  async signup(body: any) {
    const name = /^(([A-Z][a-z]+)(((\s)[A-Z]([a-z])+)+)*)$/;
    const street = /^(([A-Z0-9][a-z0-9]+)(((\s)[A-Z0-9]([a-z0-9])+)+)*)$/;
    if (![body.firstName, body.lastName, body.city].every(value => typeof value === 'string' && name.test(value)) ||
      typeof body.street !== 'string' || !street.test(body.street) || !email(body.email) ||
      typeof body.pass !== 'string' || body.pass.length < 8 || !/^\d{9}$/.test(String(body.id))) {
      return { created: false, reason: 'one of passed values invalid' };
    }
    if (await this.models.users.findOne({ username: body.email })) return { created: false, reason: 'user alredy exists' };
    try {
      await this.models.users.create({
        id: body.id, name: { first_name: body.firstName, last_name: body.lastName },
        username: body.email, password: await hash(body.pass, 12),
        address: { city: body.city, street: body.street }, role: 0,
      });
      return { created: true };
    } catch {
      return { created: false, reason: 'unexpected error' };
    }
  }
}

function email(value: unknown): boolean {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

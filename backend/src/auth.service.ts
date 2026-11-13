import { LoginInput, SignupInput, CookieResponse, record } from './contracts';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compare, hash } from 'bcryptjs';
import { MODELS, DatabaseModels } from './database.module';
// Keep the untyped CommonJS dependency behind the operations used here.
const jwt = require('jsonwebtoken') as {
  verify(token: string, key: Buffer, options: { algorithms: string[] }): unknown;
  sign(
    payload: { returning: boolean },
    key: Buffer,
    options: { subject: string; expiresIn: string; algorithm: string },
  ): string;
};

@Injectable()
export class AuthService {
  constructor(@Inject(MODELS) private readonly models: DatabaseModels) {}

  private key() {
    return readFileSync(process.env['JWT_KEY_PATH'] || join(__dirname, '..', 'src', 'key.pem'));
  }

  async authenticate(token?: unknown) {
    if (typeof token !== 'string' || !token) {
      return null;
    }
    try {
      const payload = record(jwt.verify(token, this.key(), { algorithms: ['HS256'] }) as unknown);
      // Accept existing sessions during the migration, but issue minimal new tokens.
      let user;
      if (typeof payload['sub'] === 'string') {
        user = await this.models.users.findOne({ _id: payload['sub'] });
      } else {
        if (typeof payload['data'] !== 'string') return null;
        const legacyUser = record(JSON.parse(payload['data']) as unknown);
        const id = legacyUser['_id'];
        const username = legacyUser['username'];
        const password = legacyUser['password'];
        if (
          typeof id !== 'string' ||
          typeof username !== 'string' ||
          (password !== undefined && typeof password !== 'string')
        )
          return null;
        user = await this.models.users.findOne({ _id: id, username, password });
      }
      if (!user) {
        return null;
      }
      return {
        ...(user.toObject?.() ?? user),
        isReturning: typeof payload['returning'] === 'boolean' ? payload['returning'] : true,
      };
    } catch {
      return null;
    }
  }

  async login(body: LoginInput, response: CookieResponse) {
    if (!email(body.username) || typeof body.password !== 'string' || body.password.length < 8) {
      throw new HttpException({ success: false }, 401);
    }
    const user = await this.models.users.findOne({ username: body.username });
    if (!user || !(await compare(body.password, user.password))) {
      throw new HttpException({ success: false }, 401);
    }
    const previous = await this.models.users.findOneAndUpdate(
      { _id: user._id },
      { $set: { has_logged_in: true } },
      { returnDocument: 'before' },
    );
    if (!previous) {
      throw new HttpException({ success: false }, 401);
    }
    const isReturning = previous.has_logged_in !== false;
    const token = jwt.sign({ returning: isReturning }, this.key(), {
      subject: String(user._id),
      expiresIn: '9h',
      algorithm: 'HS256',
    });
    response.cookie('SESSIONID', token, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return {
      success: true,
      role: user.role,
      name: `${user.name.first_name} ${user.name.last_name}`,
      user: user._id,
      address: user.address,
      isReturning,
    };
  }

  async signup(body: SignupInput) {
    const name =
      /^(?=.{1,150}$)\p{L}[\p{L}\p{M}]*(?:[ '\u2019\u02bc\-\u2010\u2011][\p{L}\p{M}]+)*$/u;
    const street =
      /^(?=.{1,150}$)(?=.*[\p{L}\p{N}])[\p{L}\p{M}\p{N} '\u2019\u02bc\-\u2010\u2011.,/#]+$/u;
    if (
      typeof body.firstName !== 'string' ||
      typeof body.lastName !== 'string' ||
      typeof body.city !== 'string' ||
      ![body.firstName, body.lastName, body.city].every(
        (value) => typeof value === 'string' && name.test(value),
      ) ||
      typeof body.street !== 'string' ||
      !street.test(body.street) ||
      !email(body.email) ||
      typeof body.pass !== 'string' ||
      body.pass.length < 8 ||
      !/^\d{9}$/.test(String(body.id))
    ) {
      return { created: false, reason: 'one of passed values invalid' };
    }
    if (await this.models.users.findOne({ username: body.email })) {
      return { created: false, reason: 'user alredy exists' };
    }
    try {
      await this.models.users.create({
        id: Number(body.id),
        name: { first_name: body.firstName, last_name: body.lastName },
        username: body.email,
        password: await hash(body.pass, 12),
        address: { city: body.city, street: body.street },
        role: 0,
        has_logged_in: false,
      });
      return { created: true };
    } catch {
      return { created: false, reason: 'unexpected error' };
    }
  }
}

function email(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

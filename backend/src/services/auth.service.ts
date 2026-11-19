import { LoginInput, SignupInput, CookieResponse, UserRecord, record } from '../types/contracts';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compare, hash } from 'bcryptjs';
import { MODELS, DatabaseModels } from '../modules/database.module';
import { CsrfService } from './csrf.service';
import mongoose from 'mongoose';
import {
  validateLogin,
  validateSignup,
  validateSignupAvailability,
} from '../validators/auth.validator';
// Keep the untyped CommonJS dependency behind the operations used here.
const jwt = require('jsonwebtoken') as {
  verify(token: string, key: Buffer, options: { algorithms: string[] }): unknown;
  sign(
    payload: { returning: boolean },
    key: Buffer,
    options: { subject: string; expiresIn: string; algorithm: string; jwtid: string },
  ): string;
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(MODELS) private readonly models: DatabaseModels,
    private readonly csrf: CsrfService,
  ) {}

  private key() {
    return readFileSync(
      process.env['JWT_KEY_PATH'] || join(__dirname, '..', '..', 'src', 'key.pem'),
    );
  }

  async authenticate(token?: unknown) {
    if (typeof token !== 'string' || !token) {
      return null;
    }
    try {
      const payload = record(jwt.verify(token, this.key(), { algorithms: ['HS256'] }) as unknown);
      const id = createHash('sha256')
        .update(token.slice(0, token.lastIndexOf('.')))
        .digest('hex');
      if (await this.models.revokedSessions.exists({ _id: id })) return null;
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
      const expiration = payload['exp'];
      const expiresAt =
        typeof expiration === 'number' ? new Date(Math.ceil(expiration) * 1000) : null;
      return {
        session: {
          id,
          expiresAt: expiresAt && Number.isFinite(expiresAt.getTime()) ? expiresAt : null,
        },
        user: {
          ...(user.toObject?.() ?? user),
          isReturning: typeof payload['returning'] === 'boolean' ? payload['returning'] : true,
        },
      };
    } catch {
      return null;
    }
  }

  async revoke(session: { id: string; expiresAt: Date | null }) {
    await this.models.revokedSessions.updateOne(
      { _id: session.id },
      { $setOnInsert: { expiresAt: session.expiresAt } },
      { upsert: true, runValidators: true },
    );
  }

  async login(body: LoginInput, response: CookieResponse) {
    const credentials = validateLogin(body);
    if (!credentials) {
      throw new HttpException({ success: false }, 401);
    }
    const user = await this.models.users.findOne({ username: credentials.username });
    if (!user || !(await compare(credentials.password, user.password))) {
      throw new HttpException({ success: false }, 401);
    }
    const previous = await this.models.users.findOneAndUpdate(
      { _id: user._id },
      { $set: { has_logged_in: true } },
      { returnDocument: 'before', runValidators: true },
    );
    if (!previous) {
      throw new HttpException({ success: false }, 401);
    }
    const isReturning = previous.has_logged_in !== false;
    const token = jwt.sign({ returning: isReturning }, this.key(), {
      subject: String(user._id),
      expiresIn: '9h',
      algorithm: 'HS256',
      jwtid: randomUUID(),
    });
    response.cookie('SESSIONID', token, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      path: '/',
    });
    this.csrf.issue(response, token);
    return this.sessionProfile(user, isReturning);
  }

  sessionProfile(user: UserRecord, isReturning: boolean) {
    return {
      success: true,
      role: user.role,
      name: `${user.name.first_name} ${user.name.last_name}`,
      user: user._id,
      address: user.address,
      isReturning,
    };
  }

  async checkSignup(body: Pick<SignupInput, 'email' | 'id'>) {
    const request = validateSignupAvailability(body);
    if (!request) {
      return {
        success: false,
        available: false,
        reason: 'Enter a valid email and 9-digit ID number.',
      };
    }
    const [existingEmail, existingId] = await Promise.all([
      this.models.users.findOne({ username: request.email }),
      this.models.users.findOne({ id: Number(request.id) }),
    ]);
    const emailExists = Boolean(existingEmail);
    const idExists = Boolean(existingId);
    return {
      success: true,
      available: !emailExists && !idExists,
      emailExists,
      idExists,
      reason:
        emailExists && idExists
          ? 'This email and ID number are already registered.'
          : emailExists
            ? 'This email is already registered.'
            : idExists
              ? 'This ID number is already registered.'
              : undefined,
    };
  }

  async signup(body: SignupInput) {
    const signup = validateSignup(body);
    if (!signup) {
      return { success: false, reason: 'one of passed values invalid' };
    }
    const { id, email, firstName, lastName, city, street, pass } = signup;
    const availability = await this.checkSignup({ email, id });
    if (!availability.available) return { success: false, reason: availability.reason };
    try {
      await this.models.users.create({
        id: Number(id),
        name: { first_name: firstName, last_name: lastName },
        username: email,
        password: await hash(pass, 12),
        address: { city, street },
        role: 0,
        has_logged_in: false,
      });
      return { success: true };
    } catch (error) {
      if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) {
        return {
          success: false,
          reason: 'An account with this email or ID number already exists.',
        };
      }
      return { success: false, reason: 'unexpected error' };
    }
  }
}

import { Injectable } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CookieResponse } from '../types/contracts';

@Injectable()
export class CsrfService {
  create(session = '') {
    const nonce = randomBytes(32).toString('hex');
    return `${nonce}.${this.signature(nonce, session)}`;
  }

  private signature(nonce: string, session: string) {
    const key = readFileSync(
      process.env['JWT_KEY_PATH'] || join(__dirname, '..', '..', 'src', 'key.pem'),
    );
    return createHmac('sha256', key)
      .update(JSON.stringify(['csrf-v1', session, nonce]))
      .digest('hex');
  }

  valid(token: unknown, session = '') {
    if (typeof token !== 'string' || token.length !== 129 || token[64] !== '.') return false;
    // Validate the entire encoding before decoding: Buffer.from(hex) can silently
    // truncate malformed input. The loop always examines at most 129 characters.
    for (let index = 0; index < token.length; index++) {
      if (index === 64) continue;
      const character = token.charCodeAt(index);
      if (!((character >= 48 && character <= 57) || (character >= 97 && character <= 102)))
        return false;
    }
    const nonce = token.slice(0, 64);
    const signature = token.slice(65);
    return timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(this.signature(nonce, session), 'hex'),
    );
  }

  issue(response: CookieResponse, session = '') {
    response.cookie('XSRF-TOKEN', this.create(session), {
      httpOnly: false,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      path: '/',
    });
  }
}

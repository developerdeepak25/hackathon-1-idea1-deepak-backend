import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { Model } from 'mongoose';
import { AuthService } from '../auth/auth.service.js';
import { Guest, GuestDoc } from './guest.schema.js';

const keyLength = 64;

@Injectable()
export class GuestService {
  constructor(
    @InjectModel(Guest.name) private readonly model: Model<GuestDoc>,
    private readonly auth: AuthService,
  ) {}

  async register(input: { email: string; name: string; password: string }) {
    const email = input.email.trim().toLowerCase();
    const existing = await this.model.exists({ email });
    if (existing) throw new ConflictException({ reason: 'email-taken' });

    const passwordSalt = randomBytes(16).toString('hex');
    const passwordHash = await hashPassword(input.password, passwordSalt);
    try {
      const guest = await this.model.create({
        email,
        name: input.name.trim(),
        passwordSalt,
        passwordHash,
      });
      console.info('[iturrieta] guest registered', guest.id);
      return this.session(guest);
    } catch (error) {
      if (isDuplicateKey(error)) throw new ConflictException({ reason: 'email-taken' });
      throw error;
    }
  }

  async login(emailInput: string, password: string) {
    const email = emailInput.trim().toLowerCase();
    const guest = await this.model.findOne({ email }).exec();
    const salt = guest?.passwordSalt ?? randomBytes(16).toString('hex');
    const expected = guest?.passwordHash ?? '0'.repeat(keyLength * 2);
    const got = await hashPassword(password, salt);
    const matches =
      guest !== null &&
      Buffer.byteLength(got) === Buffer.byteLength(expected) &&
      timingSafeEqual(Buffer.from(got), Buffer.from(expected));
    if (!matches) throw new UnauthorizedException('Email or password is wrong.');
    console.info('[iturrieta] guest login', guest.id);
    return this.session(guest);
  }

  me(guest: { id: string; email: string }) {
    return this.model.findById(guest.id).select('email name').lean().then((row) => {
      if (!row) throw new UnauthorizedException('Sign in again.');
      return { id: String(row._id), email: row.email, name: row.name };
    });
  }

  private session(guest: GuestDoc) {
    return {
      id: guest.id,
      email: guest.email,
      name: guest.name,
      token: this.auth.signGuest(guest.id, guest.email),
    };
  }
}

async function hashPassword(password: string, salt: string) {
  return new Promise<string>((resolve, reject) => {
    scrypt(password, salt, keyLength, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey.toString('hex'));
    });
  });
}

function isDuplicateKey(error: unknown) {
  return (error as { code?: number }).code === 11000;
}

import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHash,
  createHmac,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const tokenHours = 12;

type Session = { email: string };
type TokenPayload = {
  email?: string;
  exp?: number;
  role?: 'owner' | 'guest';
  guestId?: string;
};

@Injectable()
export class AuthService {
  private readonly key = randomBytes(32);

  constructor(private readonly config: ConfigService) {}

  async login(email: string, password: string): Promise<Session & { token: string }> {
    const ownerEmail = this.ownerEmail();
    const ownerPassword = this.ownerPassword();
    const emailOk = sameText(email.trim().toLowerCase(), ownerEmail.toLowerCase());
    const passwordOk = await sameSecret(password, ownerPassword);
    if (!emailOk || !passwordOk) {
      throw new UnauthorizedException('Email or password is wrong.');
    }
    console.info('[iturrieta] owner login', { email: ownerEmail });
    return { email: ownerEmail, token: this.sign(ownerEmail, 'owner') };
  }

  me(token: string): Session {
    const payload = this.read(token);
    if (payload.role !== 'owner' || !sameText(payload.email!, this.ownerEmail())) {
      throw new UnauthorizedException('Sign in again.');
    }
    return { email: payload.email! };
  }

  signGuest(guestId: string, email: string) {
    return this.sign(email, 'guest', guestId);
  }

  guestMe(token: string) {
    const payload = this.read(token);
    if (payload.role !== 'guest' || !payload.guestId) {
      throw new UnauthorizedException('Sign in again.');
    }
    return { id: payload.guestId, email: payload.email! };
  }

  private sign(email: string, role: 'owner' | 'guest', guestId?: string) {
    const body = Buffer.from(
      JSON.stringify({
        email,
        role,
        ...(guestId ? { guestId } : {}),
        exp: Date.now() + tokenHours * 60 * 60 * 1000,
      }),
    ).toString('base64url');
    const sig = createHmac('sha256', this.key).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  private read(token: string) {
    const [body, sig] = token.split('.');
    if (!body || !sig || token.split('.').length !== 2) {
      throw new UnauthorizedException('Sign in again.');
    }
    const expected = createHmac('sha256', this.key).update(body).digest();
    const given = Buffer.from(sig, 'base64url');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new UnauthorizedException('Sign in again.');
    }
    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as TokenPayload;
      if (!payload.email || !payload.exp || payload.exp < Date.now()) {
        throw new UnauthorizedException('Sign in again.');
      }
      if (payload.role !== 'owner' && payload.role !== 'guest') {
        throw new UnauthorizedException('Sign in again.');
      }
      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Sign in again.');
    }
  }

  private ownerEmail() {
    const email = this.config.get<string>('OWNER_EMAIL')?.trim();
    if (!email) throw new InternalServerErrorException('Owner login is not configured.');
    return email;
  }

  private ownerPassword() {
    const password = this.config.get<string>('OWNER_PASSWORD');
    if (!password) throw new InternalServerErrorException('Owner login is not configured.');
    return password;
  }
}

function sameText(left: string, right: string) {
  const a = createHash('sha256').update(left).digest();
  const b = createHash('sha256').update(right).digest();
  return timingSafeEqual(a, b);
}

async function sameSecret(left: string, right: string) {
  const salt = randomBytes(16);
  const [got, expected] = await Promise.all([
    scryptAsync(left, salt, 32),
    scryptAsync(right, salt, 32),
  ]);
  return timingSafeEqual(got as Buffer, expected as Buffer);
}

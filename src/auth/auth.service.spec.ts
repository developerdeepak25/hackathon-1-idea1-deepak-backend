import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';

const email = 'owner@iturrieta.local';
const password = 'secret-house';

function service() {
  const config = {
    get: (key: string) => {
      if (key === 'OWNER_EMAIL') return email;
      if (key === 'OWNER_PASSWORD') return password;
      return undefined;
    },
  } as ConfigService;
  return new AuthService(config);
}

describe('AuthService', () => {
  it('gives the owner a token and reads it back', async () => {
    const auth = service();
    const session = await auth.login(email, password);
    expect(session.email).toBe(email);
    expect(session.token.length).toBeGreaterThan(20);
    expect(auth.me(session.token)).toEqual({ email });
  });

  it('refuses a wrong password', async () => {
    const auth = service();
    await expect(auth.login(email, 'nope')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuses a different email', async () => {
    const auth = service();
    await expect(auth.login('someone@example.com', password)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refuses a token that was not issued here', () => {
    const auth = service();
    expect(() => auth.me('not-a-token')).toThrow(UnauthorizedException);
  });
});

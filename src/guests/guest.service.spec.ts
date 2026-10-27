import { ConflictException, UnauthorizedException } from '@nestjs/common';
import type { Model } from 'mongoose';
import { AuthService } from '../auth/auth.service.js';
import type { GuestDoc } from './guest.schema.js';
import { GuestService } from './guest.service.js';

type TestGuest = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  passwordSalt: string;
};

function setup() {
  const rows: TestGuest[] = [];
  const model = {
    exists: async ({ email }: { email: string }) =>
      rows.some((row) => row.email === email) ? { _id: 'existing' } : null,
    create: async (input: Omit<TestGuest, 'id'>) => {
      if (rows.some((row) => row.email === input.email)) {
        throw Object.assign(new Error('duplicate key'), { code: 11000 });
      }
      const row = { ...input, id: `guest-${rows.length + 1}` };
      rows.push(row);
      return row;
    },
    findOne: ({ email }: { email: string }) => ({
      exec: async () => rows.find((row) => row.email === email) ?? null,
    }),
  } as unknown as Model<GuestDoc>;

  const auth = {
    signGuest: (id: string, email: string) => `${id}:${email}`,
  } as AuthService;
  return { rows, service: new GuestService(model, auth) };
}

describe('GuestService', () => {
  it('registers with a normalized email and stores only a password hash', async () => {
    const { rows, service } = setup();
    const session = await service.register({
      email: '  Guest@Example.com ',
      name: ' Guest Name ',
      password: 'a-secure-password',
    });

    expect(session.email).toBe('guest@example.com');
    expect(session.name).toBe('Guest Name');
    expect(session.token).toBe('guest-1:guest@example.com');
    expect(rows[0].passwordHash).not.toBe('a-secure-password');
    expect(rows[0].passwordSalt).toBeTruthy();
  });

  it('refuses an already registered email', async () => {
    const { service } = setup();
    const input = {
      email: 'guest@example.com',
      name: 'Guest Name',
      password: 'a-secure-password',
    };
    await service.register(input);
    await expect(service.register(input)).rejects.toBeInstanceOf(ConflictException);
  });

  it('uses the same login refusal for an unknown email and a wrong password', async () => {
    const { service } = setup();
    await service.register({
      email: 'guest@example.com',
      name: 'Guest Name',
      password: 'a-secure-password',
    });

    await expect(
      service.login('guest@example.com', 'not-the-password'),
    ).rejects.toMatchObject({
      message: 'Email or password is wrong.',
    });
    await expect(
      service.login('unknown@example.com', 'not-the-password'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.login('unknown@example.com', 'not-the-password'),
    ).rejects.toMatchObject({
      name: new UnauthorizedException().name,
      message: 'Email or password is wrong.',
    });
  });
});

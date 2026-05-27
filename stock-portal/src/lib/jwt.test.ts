import { describe, it, expect } from 'vitest';
import { signJWT, verifyJWT } from './jwt';

describe('JWT Security Helpers', () => {
  const secret = 'super-secret-key-1234567890-must-be-long-enough';
  const payload = { userId: 'lua-hoa-member-1', role: 'member' };

  it('should sign and verify JWT correctly', async () => {
    const token = await signJWT(payload, secret);
    expect(token).toBeTypeOf('string');
    expect(token.split('.')).toHaveLength(3);

    const verified = await verifyJWT(token, secret);
    expect(verified.userId).toBe(payload.userId);
    expect(verified.role).toBe(payload.role);
  });

  it('should reject expired or altered token', async () => {
    const token = await signJWT(payload, secret);
    const alteredToken = token + 'a'; // Altered signature

    await expect(verifyJWT(alteredToken, secret)).rejects.toThrow();
  });
});

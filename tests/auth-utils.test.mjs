import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeEmail, validEmail, hashPassword, verifyPassword, tokenHash, constantTimeEqual,
} from '../lib/auth-utils.ts';

test('email normalization and validation', () => {
  assert.equal(normalizeEmail(' Student@Example.com '), 'student@example.com');
  assert.equal(validEmail('student@example.com'), true);
  for (const email of ['', 'invalid', 'a@', 'a b@example.com', `${'a'.repeat(255)}@example.com`]) {
    assert.equal(validEmail(email), false);
  }
});

test('password hashes are salted and do not store the password', async () => {
  const first = await hashPassword('test-password-123');
  const second = await hashPassword('test-password-123');
  assert.notEqual(first, second);
  assert.equal(first.includes('test-password-123'), false);
  assert.equal(await verifyPassword('test-password-123', first), true);
  assert.equal(await verifyPassword('wrong-password', first), false);
  assert.equal(await verifyPassword('test-password-123', 'invalid'), false);
});

test('session token digests and constant-time credential comparison', () => {
  const token = 'a'.repeat(64);
  assert.match(tokenHash(token), /^[a-f0-9]{64}$/);
  assert.notEqual(tokenHash(token), token);
  assert.notEqual(tokenHash(token), tokenHash('b'.repeat(64)));
  assert.equal(constantTimeEqual('secret', 'secret'), true);
  assert.equal(constantTimeEqual('secret', 'different-length-secret'), false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isStrongPassword,
  isAllowedAuthRole,
  isActiveAuthenticatedProfile,
  normalizeAuthRole,
} from './authValidation';

test('strong password policy accepts a valid password', () => {
  assert.equal(isStrongPassword('Apartment#2026A'), true);
});

test('strong password policy rejects short or incomplete passwords', () => {
  assert.equal(isStrongPassword('shortA1!'), false);
  assert.equal(isStrongPassword('alllowercase123!'), false);
  assert.equal(isStrongPassword('UPPERCASE123!'), false);
  assert.equal(isStrongPassword('NoNumberPassword!'), false);
  assert.equal(isStrongPassword('NoSpecialCharacter123'), false);
  assert.equal(isStrongPassword('A'.repeat(129) + 'a1!'), false);
});

test('only the four supported roles are accepted and normalized cleanly', () => {
  for (const role of ['Admin', 'Committee', 'Accountant', 'Resident']) {
    assert.equal(isAllowedAuthRole(role), true);
  }
  assert.equal(normalizeAuthRole(' committee '), 'Committee');
  assert.equal(normalizeAuthRole('ACCOUNTANT'), 'Accountant');
  assert.equal(normalizeAuthRole('resident'), 'Resident');
  assert.equal(isAllowedAuthRole(' resident '), true);
  assert.equal(isAllowedAuthRole('SuperAdmin'), false);
  assert.equal(normalizeAuthRole('SuperAdmin'), '');
  assert.equal(isAllowedAuthRole(''), false);
});

test('authenticated profile must be active and have a supported role and user id', () => {
  assert.equal(isActiveAuthenticatedProfile({
    Account_Status: 'Active', Role: 'Admin', UserID: 'USR-1',
  }), true);
  assert.equal(isActiveAuthenticatedProfile({
    Account_Status: 'Active', Role: ' committee ', UserID: 'USR-2',
  }), true);
  assert.equal(isActiveAuthenticatedProfile({
    Account_Status: 'Inactive', Role: 'Admin', UserID: 'USR-1',
  }), false);
  assert.equal(isActiveAuthenticatedProfile({
    Account_Status: 'Active', Role: 'Unknown', UserID: 'USR-1',
  }), false);
  assert.equal(isActiveAuthenticatedProfile({
    Account_Status: 'Active', Role: 'Resident', UserID: '',
  }), false);
});

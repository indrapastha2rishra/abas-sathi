const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.tsx'), 'utf8');

test('saved session is restored before any backend validation', () => {
  assert.match(app, /const saved = JSON\.parse\(localStorage\.getItem\('abasSathiSession'/);
  assert.match(app, /if \(saved && saved\.token && saved\.expiresAt > Date\.now\(\)\) return saved;/);
  assert.match(app, /Network verification is deliberately[\s\S]*background-only/);
});

test('saved-session validation does not block App shell rendering', () => {
  assert.match(app, /sessionCheck === 'checking'[\s\S]*Session restored — verifying in background/);
  assert.match(app, /<MainLayout \/>/);
  assert.doesNotMatch(app, /if \(validatingSession\) return/);
});

test('expired or server-invalid session is cleared, transient errors retain local session', () => {
  assert.match(app, /if \(error instanceof BackendRequestError && error\.code === 'AUTH_ERROR'\)[\s\S]*localStorage\.removeItem\('abasSathiSession'\)[\s\S]*setSession\(null\)/);
  assert.match(app, /setSessionCheck\('offline'\)/);
});

test('online and offline browser events update session verification status', () => {
  assert.match(app, /window\.addEventListener\('offline', onOffline\)/);
  assert.match(app, /window\.addEventListener\('online', onOnline\)/);
});

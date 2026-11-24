import test from 'node:test';
import assert from 'node:assert/strict';
import { NOTICE_COOKIE, parseVisibleCookies, createNoticePreferences, noticeCookieString } from '../dist/privacy-storage.mjs';

function adapter(initial = '', blocked = false) {
  const values = new Map(parseVisibleCookies(initial).map(cookie => [cookie.name, cookie.value]));
  const writes = [];
  return {
    values, writes,
    read: () => [...values].map(([name, value]) => `${name}=${value}`).join('; '),
    write: serialized => {
      writes.push(serialized);
      if (blocked) return;
      const pair = parseVisibleCookies(serialized)[0];
      if (serialized.includes('Max-Age=0;')) values.delete(pair.name);
      else values.set(pair.name, pair.value);
    },
    secure: true
  };
}

test('first visit does not create a cookie or opt the visitor in', () => {
  const storage = adapter();
  const manager = createNoticePreferences(storage);
  assert.equal(manager.shouldShowNotice, true);
  assert.equal(manager.remembered, false);
  assert.deepEqual(storage.writes, []);
});
test('continuing without storage creates no persistent record', () => {
  const storage = adapter();
  const manager = createNoticePreferences(storage);
  assert.deepEqual(manager.apply(false), { persisted: false, removed: true });
  assert.equal(manager.shouldShowNotice, false);
  assert.deepEqual(storage.writes, []);
  assert.equal(createNoticePreferences(storage).shouldShowNotice, true);
});
test('explicit opt-in stores only the notice preference for 180 days', () => {
  const storage = adapter('unrelated=keep');
  const manager = createNoticePreferences(storage);
  assert.equal(manager.apply(true).persisted, true);
  assert.equal(storage.writes.length, 1);
  assert.match(storage.writes[0], /^lennox_privacy_notice=hidden-v1; Path=\/; Max-Age=15552000; SameSite=Lax; Secure$/);
  assert.equal(storage.values.get('unrelated'), 'keep');
  assert.equal(createNoticePreferences(storage).shouldShowNotice, false);
});
test('withdrawal removes the owned cookie and preserves unrelated cookies', () => {
  const storage = adapter(`${NOTICE_COOKIE.name}=${NOTICE_COOKIE.value}; unrelated=keep`);
  const manager = createNoticePreferences(storage);
  assert.equal(manager.apply(false).removed, true);
  assert.equal(storage.values.has(NOTICE_COOKIE.name), false);
  assert.equal(storage.values.get('unrelated'), 'keep');
  assert.match(storage.writes[0], /Max-Age=0;/);
});
test('reset reopens the notice instead of keeping a withdrawn choice in memory', () => {
  const storage = adapter();
  const manager = createNoticePreferences(storage);
  manager.apply(true);
  assert.equal(manager.reset().removed, true);
  assert.equal(manager.shouldShowNotice, true);
});
test('blocked browser storage is reported without claiming a saved preference', () => {
  const storage = adapter('', true);
  const manager = createNoticePreferences(storage);
  assert.equal(manager.apply(true).persisted, false);
  assert.equal(manager.remembered, false);
  assert.equal(createNoticePreferences(storage).shouldShowNotice, true);
});
test('a blocked removal is reported', () => {
  const storage = adapter(`${NOTICE_COOKIE.name}=${NOTICE_COOKIE.value}`, true);
  assert.equal(createNoticePreferences(storage).apply(false).removed, false);
});
test('invalid or old cookie values do not silently count as consent', () => {
  assert.equal(createNoticePreferences(adapter(`${NOTICE_COOKIE.name}=unexpected`)).remembered, false);
  assert.throws(() => noticeCookieString('false'), TypeError);
  const storage = adapter();
  assert.throws(() => createNoticePreferences(storage).apply('yes'), TypeError);
  assert.deepEqual(storage.writes, []);
});
test('cookie parsing preserves equals signs and never evaluates cookie contents', () => {
  assert.deepEqual(parseVisibleCookies('a=b=c; invalid; empty=;  spaced = value '), [{ name: 'a', value: 'b=c' }, { name: 'empty', value: '' }, { name: 'spaced', value: 'value' }]);
});

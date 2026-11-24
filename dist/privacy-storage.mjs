export const NOTICE_COOKIE = Object.freeze({
  name: 'lennox_privacy_notice',
  value: 'hidden-v1',
  maxAge: 180 * 24 * 60 * 60,
  days: 180
});

export function parseVisibleCookies(header = '') {
  return String(header).split(';').map(part => {
    const index = part.indexOf('=');
    if (index < 1) return null;
    const name = part.slice(0, index).trim();
    if (!name) return null;
    return { name, value: part.slice(index + 1).trim() };
  }).filter(Boolean);
}

export function noticeCookieString(remember, secure = true) {
  if (typeof remember !== 'boolean') throw new TypeError('An explicit boolean choice is required');
  return `${NOTICE_COOKIE.name}=${remember ? NOTICE_COOKIE.value : ''}; Path=/; Max-Age=${remember ? NOTICE_COOKIE.maxAge : 0}; SameSite=Lax${secure ? '; Secure' : ''}`;
}

// All storage writes are confined to an explicit apply/reset operation.
// Reading or constructing a preferences manager never creates a cookie.
export function createNoticePreferences(storage) {
  let dismissedForVisit = false;
  const cookies = () => {
    try { return parseVisibleCookies(storage.read()); } catch { return []; }
  };
  const remembered = () => cookies().some(cookie => cookie.name === NOTICE_COOKIE.name && cookie.value === NOTICE_COOKIE.value);
  const hasOwnCookie = () => cookies().some(cookie => cookie.name === NOTICE_COOKIE.name);
  const removeOwn = () => {
    if (!hasOwnCookie()) return true;
    try { storage.write(noticeCookieString(false, storage.secure)); } catch { return false; }
    return !hasOwnCookie();
  };
  return {
    cookies,
    get remembered() { return remembered(); },
    get shouldShowNotice() { return !dismissedForVisit && !remembered(); },
    apply(remember) {
      if (typeof remember !== 'boolean') throw new TypeError('An explicit boolean choice is required');
      dismissedForVisit = true;
      if (!remember) return { persisted: false, removed: removeOwn() };
      try { storage.write(noticeCookieString(true, storage.secure)); } catch { return { persisted: false, removed: false }; }
      return { persisted: remembered(), removed: false };
    },
    reset() {
      dismissedForVisit = false;
      return { removed: removeOwn() };
    }
  };
}

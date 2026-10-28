// Vault auto-relock: the vault closes after RELOCK_MS without input, also across reloads and time in the background.

export const RELOCK_MS = 2 * 60 * 1000;
const UNLOCKED = 'sift-unlocked', SEEN = 'sift-vault-seen';

/** True when the last activity is older than RELOCK_MS (or unknown). */
export const relockDue = (lastSeen: number, now: number) => !(lastSeen > 0) || now - lastSeen >= RELOCK_MS;

export function markUnlocked(user: string, now = Date.now()) { sessionStorage.setItem(UNLOCKED, user); sessionStorage.setItem(SEEN, String(now)); }
export function markLocked() { sessionStorage.removeItem(UNLOCKED); sessionStorage.removeItem(SEEN); }
export function markSeen(now = Date.now()) { sessionStorage.setItem(SEEN, String(now)); }
export const lastSeen = () => Number(sessionStorage.getItem(SEEN)) || 0;
/** Still unlocked from earlier in this tab, and not idle past the limit. */
export const restoreUnlocked = (user: string, now = Date.now()) => sessionStorage.getItem(UNLOCKED) === user && !relockDue(lastSeen(), now);

// An open vault-note editor registers here so an auto-lock saves its draft instead of dropping it.
let beforeLock: (() => void) | null = null;
export const setBeforeLock = (fn: (() => void) | null) => { beforeLock = fn; };
export const runBeforeLock = () => { try { beforeLock?.(); } catch { /* never block the lock */ } };

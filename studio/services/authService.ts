interface StoredUser {
  id: string;
  email: string;
  salt: string;
  hash: string;
  createdAt: number;
}

const USERS_KEY = 'droidforge_users';
const SESSION_KEY = 'droidforge_session';

const getUsers = (): StoredUser[] => {
  const raw = localStorage.getItem(USERS_KEY);
  return raw ? JSON.parse(raw) : [];
};

const setUsers = (users: StoredUser[]) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

const bufferToHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');

const isSecureCryptoAvailable = () => Boolean(globalThis.crypto?.subtle && globalThis.isSecureContext);

const insecureHash = (password: string, salt: string) => {
  // Dev-only fallback for LAN HTTP. Not cryptographically secure.
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${password}`);
  let hash = 2166136261;
  for (let i = 0; i < data.length; i++) {
    hash ^= data[i];
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const deriveKey = async (password: string, salt: string) => {
  if (!isSecureCryptoAvailable()) {
    return insecureHash(password, salt);
  }
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  return bufferToHex(bits);
};

export const signUp = async (email: string, password: string) => {
  const users = getUsers();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('Email already exists');
  }
  const salt = Math.random().toString(36).slice(2);
  const hash = await deriveKey(password, salt);
  const user: StoredUser = {
    id: Math.random().toString(36).slice(2),
    email,
    salt,
    hash,
    createdAt: Date.now()
  };
  users.push(user);
  setUsers(users);
  localStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id, email: user.email }));
  return { id: user.id, email: user.email };
};

export const signIn = async (email: string, password: string) => {
  const users = getUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) throw new Error('Invalid email or password');
  const hash = await deriveKey(password, user.salt);
  if (hash !== user.hash) throw new Error('Invalid email or password');
  localStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id, email: user.email }));
  return { id: user.id, email: user.email };
};

export const getSession = () => {
  const raw = localStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
};

export const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
};

import { supabase } from './supabase';

export const DEFAULT_ALLOWED_USERS = [
  {
    username: 'Mattiz',
    displayName: 'Mattiz',
    email: 'mattizhoornaert@hotmail.com',
    accent: '#ff6b9c',
    avatar_url: '',
    updated_at: '',
    bio: '',
    status_message: ''
  },
  {
    username: 'Lukas',
    displayName: 'Lukas',
    email: 'lukas.stevens@student.tsaam.be',
    accent: '#72d4ff',
    avatar_url: '',
    updated_at: '',
    bio: '',
    status_message: ''
  },
  {
    username: 'Yoshi',
    displayName: 'Yoshi',
    email: 'bastiaenssens.yoshi@gmail.com',
    accent: '#a6ff7c',
    avatar_url: '',
    updated_at: '',
    bio: '',
    status_message: ''
  }
];

export function normalizeUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function getProfileCacheKey(identifier) {
  return `yowlmaffia-profile-cache:${normalizeUsername(identifier || 'guest') || 'guest'}`;
}

function readLocalStorageJson(key) {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function writeLocalStorageJson(key, value) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Ignore storage quota / privacy-mode errors.
  }
}

function mergeCachedProfile(user) {
  const cached =
    readLocalStorageJson(getProfileCacheKey(user?.username)) ||
    readLocalStorageJson(getProfileCacheKey(user?.email)) ||
    readLocalStorageJson(getProfileCacheKey(user?.displayName));

  if (!cached) {
    return user;
  }

  return {
    ...user,
    accent: user?.accent ?? cached?.accent ?? '#72d4ff',
    avatar_url: String(user?.avatar_url ?? '').trim(),
    updated_at: user?.updated_at ?? cached?.updated_at ?? '',
    bio: user?.bio ?? cached?.bio ?? '',
    status_message: user?.status_message ?? cached?.status_message ?? ''
  };
}

export function normalizeAllowedUser(user) {
  return mergeCachedProfile({
    username: String(user?.username || '').trim(),
    displayName: String(user?.display_name || user?.displayName || user?.username || '').trim(),
    email: String(user?.email || '').trim(),
    accent: user?.accent || '#72d4ff',
    avatar_url: String(user?.avatar_url || user?.avatarUrl || '').trim(),
    updated_at: String(user?.updated_at || user?.updatedAt || '').trim(),
    bio: String(user?.bio || '').trim(),
    status_message: String(user?.status_message || user?.statusMessage || '').trim()
  });
}

export function appendAvatarVersion(avatarUrl = '', updatedAt = '') {
  const url = String(avatarUrl || '').trim();
  if (!url) {
    return '';
  }

  const version = String(updatedAt || '').trim();
  if (!version) {
    return url;
  }

  return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}`;
}

export function resolveAvatarUrl(user = null) {
  if (!user) {
    return '';
  }

  return appendAvatarVersion(user.avatar_url || user.avatarUrl || '', user.updated_at || user.updatedAt || user.avatar_updated_at || '');
}

export function findAllowedUser(value, allowedUsers = DEFAULT_ALLOWED_USERS) {
  const needle = normalizeUsername(value);
  if (!needle) {
    return null;
  }

  return (
    allowedUsers.find((user) => normalizeUsername(user.username) === needle) ||
    allowedUsers.find((user) => normalizeUsername(user.displayName) === needle) ||
    allowedUsers.find((user) => normalizeUsername(user.email) === needle) ||
    null
  );
}

export function resolveAllowedUserAvatar(value, allowedUsers = DEFAULT_ALLOWED_USERS) {
  return findAllowedUser(value, allowedUsers)?.avatar_url || '';
}

export function resolveAllowedUserDisplayName(value, allowedUsers = DEFAULT_ALLOWED_USERS) {
  return findAllowedUser(value, allowedUsers)?.displayName || '';
}

export function usernameToEmail(username, allowedUsers = DEFAULT_ALLOWED_USERS) {
  return findAllowedUser(username, allowedUsers)?.email || null;
}

export function getUsernameOptions(allowedUsers = DEFAULT_ALLOWED_USERS) {
  return allowedUsers.map((user) => user.username).filter(Boolean);
}

export async function loadAllowedUsers() {
  if (!supabase) {
    return DEFAULT_ALLOWED_USERS.map(mergeCachedProfile);
  }

  const selectAllowedUsers = async (fields) =>
    supabase.from('allowed_users').select(fields).order('display_name', { ascending: true });

  const primaryResult = await selectAllowedUsers('username, email, display_name, accent, avatar_url, updated_at, bio, status_message');

  let { data, error } = primaryResult;

  if (error) {
    const fallbackResult = await selectAllowedUsers('username, email, display_name, avatar_url, updated_at, bio, status_message');
    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error) {
    const minimalResult = await selectAllowedUsers('username, email, display_name');
    data = minimalResult.data;
    error = minimalResult.error;
  }

  if (error || !Array.isArray(data) || !data.length) {
    return DEFAULT_ALLOWED_USERS.map(mergeCachedProfile);
  }

  return data.map(normalizeAllowedUser).map(mergeCachedProfile);
}

export function resolveUserFromSession(session, allowedUsers = DEFAULT_ALLOWED_USERS) {
  const username = session?.user?.user_metadata?.username || session?.user?.user_metadata?.name || '';
  const email = session?.user?.email || '';
  const displayName = session?.user?.user_metadata?.display_name || session?.user?.user_metadata?.displayName || '';

  const matched =
    findAllowedUser(username, allowedUsers) ||
    findAllowedUser(displayName, allowedUsers) ||
    allowedUsers.find((user) => normalizeUsername(user.email) === normalizeUsername(email)) ||
    null;

  return matched ? mergeCachedProfile(matched) : null;
}

export function cacheAllowedUserProfile(user = null) {
  if (!user) {
    return;
  }

  const payload = normalizeAllowedUser(user);
  writeLocalStorageJson(getProfileCacheKey(payload.username), payload);
  if (payload.email) {
    writeLocalStorageJson(getProfileCacheKey(payload.email), payload);
  }
  if (payload.displayName) {
    writeLocalStorageJson(getProfileCacheKey(payload.displayName), payload);
  }
}

import { supabase } from './supabase';

export const DEFAULT_ALLOWED_USERS = [
  {
    username: 'Mattiz',
    displayName: 'Mattiz',
    email: 'mattizhoornaert@hotmail.com',
    accent: '#ff6b9c',
    avatar_url: '',
    updated_at: '',
    last_online_at: '',
    bio: '',
    status_message: '',
    theme_mode: 'system'
  },
  {
    username: 'Lukas',
    displayName: 'Lukas',
    email: 'lukas.stevens@student.tsaam.be',
    accent: '#72d4ff',
    avatar_url: '',
    updated_at: '',
    last_online_at: '',
    bio: '',
    status_message: '',
    theme_mode: 'system'
  },
  {
    username: 'Yoshi',
    displayName: 'Yoshi',
    email: 'bastiaenssens.yoshi@gmail.com',
    accent: '#a6ff7c',
    avatar_url: '',
    updated_at: '',
    last_online_at: '',
    bio: '',
    status_message: '',
    theme_mode: 'system'
  }
];

export function normalizeUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function normalizeThemeMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  return mode === 'light' || mode === 'dark' || mode === 'system' ? mode : 'system';
}

export function normalizeAllowedUser(user) {
  return {
    id: String(user?.id || user?.user_id || '').trim(),
    username: String(user?.username || '').trim(),
    displayName: String(user?.display_name || user?.displayName || user?.username || '').trim(),
    email: String(user?.email || '').trim(),
    accent: user?.accent || '#72d4ff',
    avatar_url: String(user?.avatar_url || user?.avatarUrl || '').trim(),
    updated_at: String(user?.updated_at || user?.updatedAt || '').trim(),
    last_online_at: String(user?.last_online_at || user?.lastOnlineAt || '').trim(),
    bio: String(user?.bio || '').trim(),
    status_message: String(user?.status_message || user?.statusMessage || '').trim(),
    theme_mode: normalizeThemeMode(user?.theme_mode || user?.themeMode || 'system')
  };
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
    return DEFAULT_ALLOWED_USERS.map(normalizeAllowedUser);
  }

  const selectAllowedUsers = async (fields) =>
    supabase.from('allowed_users').select(fields).order('display_name', { ascending: true });

  const primaryResult = await selectAllowedUsers('id, username, email, display_name, accent, avatar_url, updated_at, last_online_at, bio, status_message, theme_mode');

  let { data, error } = primaryResult;

  if (error) {
    const fallbackResult = await selectAllowedUsers('id, username, email, display_name, avatar_url, updated_at, last_online_at, bio, status_message');
    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error) {
    const minimalResult = await selectAllowedUsers('id, username, email, display_name');
    data = minimalResult.data;
    error = minimalResult.error;
  }

  if (error || !Array.isArray(data) || !data.length) {
    return DEFAULT_ALLOWED_USERS.map(normalizeAllowedUser);
  }

  return data.map(normalizeAllowedUser);
}

export function resolveUserFromSession(session, allowedUsers = DEFAULT_ALLOWED_USERS) {
  const userId = session?.user?.id || '';
  const username = session?.user?.user_metadata?.username || session?.user?.user_metadata?.name || '';
  const email = session?.user?.email || '';
  const displayName = session?.user?.user_metadata?.display_name || session?.user?.user_metadata?.displayName || '';

  const matched =
    allowedUsers.find((user) => normalizeUsername(user.id) === normalizeUsername(userId)) ||
    findAllowedUser(username, allowedUsers) ||
    findAllowedUser(displayName, allowedUsers) ||
    allowedUsers.find((user) => normalizeUsername(user.email) === normalizeUsername(email)) ||
    null;

  return matched ? normalizeAllowedUser(matched) : null;
}

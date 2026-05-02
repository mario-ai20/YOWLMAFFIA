import { publicChatSupabase } from './supabase';

export const DEFAULT_PUBLIC_USERS = [
  {
    username: 'Mattiz',
    displayName: 'Mattiz',
    email: 'mattizhoornaert@hotmail.com',
    birth_date: '',
    accent: '#ff6b9c',
    avatar_url: '',
    updated_at: '',
    last_online_at: '',
    bio: '',
    status_message: '',
    theme_mode: 'system',
    gender: 'zeg ik liever niet'
  },
  {
    username: 'Lukas',
    displayName: 'Lukas',
    email: 'lukas.stevens@student.tsaam.be',
    birth_date: '',
    accent: '#72d4ff',
    avatar_url: '',
    updated_at: '',
    last_online_at: '',
    bio: '',
    status_message: '',
    theme_mode: 'system',
    gender: 'zeg ik liever niet'
  },
  {
    username: 'Yoshi',
    displayName: 'Yoshi',
    email: 'bastiaenssens.yoshi@gmail.com',
    birth_date: '',
    accent: '#a6ff7c',
    avatar_url: '',
    updated_at: '',
    last_online_at: '',
    bio: '',
    status_message: '',
    theme_mode: 'system',
    gender: 'zeg ik liever niet'
  }
];

export function normalizePublicUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function normalizeThemeMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  return mode === 'light' || mode === 'dark' || mode === 'system' ? mode : 'system';
}

export function normalizePublicAllowedUser(user) {
  return {
    username: String(user?.username || '').trim(),
    displayName: String(user?.display_name || user?.displayName || user?.username || '').trim(),
    email: String(user?.email || '').trim(),
    birth_date: String(user?.birth_date || user?.birthDate || '').trim(),
    accent: user?.accent || '#72d4ff',
    avatar_url: String(user?.avatar_url || user?.avatarUrl || '').trim(),
    updated_at: String(user?.updated_at || user?.updatedAt || '').trim(),
    last_online_at: String(user?.last_online_at || user?.lastOnlineAt || '').trim(),
    bio: String(user?.bio || '').trim(),
    status_message: String(user?.status_message || user?.statusMessage || '').trim(),
    theme_mode: normalizeThemeMode(user?.theme_mode || user?.themeMode || 'system'),
    gender: String(user?.gender || '').trim() || 'zeg ik liever niet'
  };
}

export function findPublicAllowedUser(value, allowedUsers = DEFAULT_PUBLIC_USERS) {
  const needle = normalizePublicUsername(value);
  if (!needle) {
    return null;
  }

  return (
    allowedUsers.find((user) => normalizePublicUsername(user.username) === needle) ||
    allowedUsers.find((user) => normalizePublicUsername(user.displayName) === needle) ||
    allowedUsers.find((user) => normalizePublicUsername(user.email) === needle) ||
    null
  );
}

export function resolvePublicUserAvatar(value, allowedUsers = DEFAULT_PUBLIC_USERS) {
  return findPublicAllowedUser(value, allowedUsers)?.avatar_url || '';
}

export function resolvePublicUserDisplayName(value, allowedUsers = DEFAULT_PUBLIC_USERS) {
  return findPublicAllowedUser(value, allowedUsers)?.displayName || '';
}

export function publicUsernameToEmail(username, allowedUsers = DEFAULT_PUBLIC_USERS) {
  return findPublicAllowedUser(username, allowedUsers)?.email || null;
}

export function resolvePublicUserFromSession(session, allowedUsers = DEFAULT_PUBLIC_USERS) {
  const metadata = session?.user?.user_metadata || {};
  const email = String(session?.user?.email || metadata.email || '').trim();
  const identity = String(
    metadata.username ||
      metadata.display_name ||
      metadata.displayName ||
      metadata.name ||
      metadata.user_name ||
      ''
  ).trim();

  const foundByEmail = email ? findPublicAllowedUser(email, allowedUsers) : null;
  const foundByIdentity = identity ? findPublicAllowedUser(identity, allowedUsers) : null;

  if (foundByEmail || foundByIdentity) {
    return foundByEmail || foundByIdentity;
  }

  if (!email && !identity) {
    return null;
  }

  return normalizePublicAllowedUser({
    username: identity || email.split('@')[0] || 'Bezoeker',
    display_name: metadata.display_name || identity || email.split('@')[0] || 'Bezoeker',
    email,
    birth_date: metadata.birth_date || metadata.birthDate || '',
    accent: metadata.accent || '#72d4ff',
    avatar_url: metadata.avatar_url || metadata.avatarUrl || '',
    updated_at: session?.user?.updated_at || '',
    last_online_at: '',
    bio: metadata.bio || '',
    status_message: metadata.status_message || metadata.statusMessage || '',
    theme_mode: metadata.theme_mode || metadata.themeMode || 'system',
    gender: metadata.gender || 'zeg ik liever niet'
  });
}

export async function loadPublicAllowedUsers() {
  if (!publicChatSupabase) {
    return DEFAULT_PUBLIC_USERS.map(normalizePublicAllowedUser);
  }

  const selectAllowedUsers = async (fields) =>
    publicChatSupabase.from('allowed_users').select(fields).order('display_name', { ascending: true });

  const primaryResult = await selectAllowedUsers('username, email, display_name, birth_date, accent, avatar_url, updated_at, last_online_at, bio, status_message, theme_mode, gender');

  let { data, error } = primaryResult;

  if (error) {
    const fallbackResult = await selectAllowedUsers('username, email, display_name, birth_date, avatar_url, updated_at, last_online_at, bio, status_message, gender');
    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error) {
    const minimalResult = await selectAllowedUsers('username, email, display_name, birth_date');
    data = minimalResult.data;
    error = minimalResult.error;
  }

  if (error || !Array.isArray(data) || !data.length) {
    return DEFAULT_PUBLIC_USERS.map(normalizePublicAllowedUser);
  }

  return data.map(normalizePublicAllowedUser);
}

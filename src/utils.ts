import type { Room } from './types';

/** Format an ISO timestamp as a readable time or date */
export const formatTime = (isoString: string): string => {
  try {
    const d = new Date(isoString);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
};

/** Get the display name of a room from the perspective of a given user */
export const getRoomName = (room: Room, currentUserId: number): string => {
  if (room.isGroup) return room.name || 'Group';
  const other = room.members.find((m) => m.id !== currentUserId);
  return other ? other.displayName : 'Direct Message';
};

/** Get the first character of a room's name as an avatar */
export const getRoomAvatarChar = (room: Room, currentUserId: number): string => {
  return getRoomName(room, currentUserId).charAt(0).toUpperCase();
};

/** Map a presence status string to its indicator colour */
export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'online': return '#137333';
    case 'away':   return '#f29900';
    default:       return '#80868b';
  }
};

/** Deterministically pick a background colour for an avatar from the name */
export const getAvatarColor = (name: string): string => {
  const palette = [
    '#1a73e8', '#34a853', '#ea4335', '#fbbc04',
    '#9334e6', '#00897b', '#e64a19', '#1565c0',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
};

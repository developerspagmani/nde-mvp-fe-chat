// Shared domain types used across all components

export interface User {
  id: number;
  username: string;
  displayName: string;
  status: 'online' | 'offline' | 'away';
}

export interface Room {
  id: number;
  name: string | null;
  isGroup: boolean;
  createdAt: string;
  members: User[];
  unreadCount?: number;
  isPinned?: boolean;
}

export interface SearchResult {
  id: string;
  roomId: number;
  roomName: string | null;
  isGroup: boolean;
  senderName: string;
  content: string;
  createdAt?: string;
}

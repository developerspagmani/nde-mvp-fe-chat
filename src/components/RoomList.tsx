import {
  Avatar, Badge, IconButton, Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  People as PeopleIcon,
  KeyboardArrowLeft as CollapseIcon,
  PushPin as PinIcon,
  PushPinOutlined as PinOutlinedIcon,
} from '@mui/icons-material';
import type { Room, User } from '../types';
import {
  getRoomName, getRoomAvatarChar, getStatusColor,
  getAvatarColor, formatTime,
} from '../utils';

interface Props {
  rooms: Room[];
  activeRoomId: number | null;
  currentUser: User;
  typingUsers: Record<number, Record<number, boolean>>;
  userPresence: Record<number, 'online' | 'offline' | 'away'>;
  isOnline: boolean;
  onRoomSelect: (roomId: number) => void;
  onNewChat: () => void;
  onCollapse: () => void;
  onTogglePin: (roomId: number, isPinned: boolean) => void;
}

export default function RoomList({
  rooms,
  activeRoomId,
  currentUser,
  typingUsers,
  userPresence,
  isOnline,
  onRoomSelect,
  onNewChat,
  onCollapse,
  onTogglePin,
}: Props) {


  // Direct messages and group spaces split, accounting for pinned status
  const pinnedRooms = rooms.filter((r) => r.isPinned);
  const dms = rooms.filter((r) => !r.isGroup && !r.isPinned);
  const spaces = rooms.filter((r) => r.isGroup && !r.isPinned);

  const renderRoom = (room: Room) => {
    const isSelected = activeRoomId === room.id;
    const name = getRoomName(room, currentUser.id);
    const avatarChar = getRoomAvatarChar(room, currentUser.id);
    const avatarColor = getAvatarColor(name);
    const otherMember = room.members.find((m) => m.id !== currentUser.id);
    const status = room.isGroup
      ? 'online'
      : (otherMember ? (userPresence[otherMember.id] || otherMember.status) : 'offline');
    const roomTyping = typingUsers[room.id] || {};
    const isTyping = room.members.some(
      (m) => m.id !== currentUser.id && roomTyping[m.id],
    );
    const timeStr = room.createdAt ? formatTime(room.createdAt) : '';

    return (
      <div
        key={room.id}
        className={`room-item ${isSelected ? 'selected' : ''}`}
        onClick={() => onRoomSelect(room.id)}
      >
        {/* Avatar */}
        <div className="room-item-avatar">
          {room.isGroup ? (
            <Avatar sx={{ width: 40, height: 40, bgcolor: '#1a73e8', fontSize: 16 }}>
              <PeopleIcon sx={{ fontSize: 20 }} />
            </Avatar>
          ) : (
            <Badge
              overlap="circular"
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              badgeContent={
                <span
                  className="status-dot"
                  style={{ background: getStatusColor(status) }}
                />
              }
            >
              <Avatar
                sx={{
                  width: 40,
                  height: 40,
                  bgcolor: isSelected ? '#1a73e8' : avatarColor,
                  fontSize: 16,
                  fontWeight: 600,
                }}
              >
                {avatarChar}
              </Avatar>
            </Badge>
          )}
        </div>

        {/* Info */}
        <div className="room-item-body">
          <div
            className="room-item-name"
            style={{ fontWeight: room.unreadCount && room.unreadCount > 0 ? 700 : 500 }}
          >
            {name}
          </div>
          <div className={`room-item-sub ${isTyping ? 'typing-hint' : ''}`}>
            {isTyping
              ? 'typing…'
              : room.isGroup
                ? `${room.members.length} members`
                : otherMember?.status === 'online'
                  ? 'Active now'
                  : 'Offline'}
          </div>
        </div>

        {/* Time, Unread badge & Pin action */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: '4px',
            marginLeft: '8px',
            minWidth: '40px',
          }}
        >
          {timeStr && <div className="room-item-time">{timeStr}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {/* Unread badge (Only show if > 0) */}
            {typeof room.unreadCount === 'number' && room.unreadCount > 0 && (
              <div
                style={{
                  background: '#1a73e8',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 700,
                  borderRadius: '10px',
                  minWidth: '18px',
                  height: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 5px',
                }}
              >
                {room.unreadCount}
              </div>
            )}

            {/* Pin action button */}
            <Tooltip title={room.isPinned ? "Unpin conversation" : "Pin conversation"}>
              <IconButton
                size="small"
                className={`room-pin-btn ${room.isPinned ? 'pinned' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePin(room.id, !room.isPinned);
                }}
                sx={{
                  padding: '2px',
                  color: room.isPinned ? '#1a73e8' : '#80868b',
                }}
              >
                {room.isPinned ? <PinIcon sx={{ fontSize: 16 }} /> : <PinOutlinedIcon sx={{ fontSize: 16 }} />}
              </IconButton>
            </Tooltip>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="rooms-sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <span className="sidebar-title">Chat</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Tooltip title="New chat">
            <IconButton size="small" onClick={onNewChat}>
              <AddIcon sx={{ fontSize: 20, color: '#1a73e8' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Collapse sidebar">
            <IconButton size="small" onClick={onCollapse}>
              <CollapseIcon sx={{ fontSize: 20, color: '#5f6368' }} />
            </IconButton>
          </Tooltip>
        </div>
      </div>



      {/* New chat button */}
      <button className="new-chat-btn" onClick={onNewChat}>
        <AddIcon sx={{ fontSize: 18 }} />
        New chat
      </button>

      {/* Scrollable room list */}
      <div className="rooms-list">
        {/* Pinned */}
        {pinnedRooms.length > 0 && (
          <>
            <div className="section-label">Pinned</div>
            {pinnedRooms.map(renderRoom)}
          </>
        )}

        {/* Direct Messages */}
        {dms.length > 0 && (
          <>
            <div className="section-label">Direct Messages</div>
            {dms.map(renderRoom)}
          </>
        )}

        {/* Spaces / Groups */}
        {spaces.length > 0 && (
          <>
            <div className="section-label">Spaces</div>
            {spaces.map(renderRoom)}
          </>
        )}

        {rooms.length === 0 && (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: '#80868b', fontSize: 13 }}>
            No conversations yet.
            <br />
            <span
              style={{ color: '#1a73e8', cursor: 'pointer', fontWeight: 600 }}
              onClick={onNewChat}
            >
              Start one now →
            </span>
          </div>
        )}
      </div>

      {/* Offline banner */}
      {!isOnline && (
        <div className="offline-banner">
          Offline — changes will sync when reconnected
        </div>
      )}
    </div>
  );
}

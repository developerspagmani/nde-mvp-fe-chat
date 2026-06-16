import { useState, useEffect } from 'react';
import { Avatar, Badge, IconButton, Tooltip, Button } from '@mui/material';
import {
  Close as CloseIcon,
  People as PeopleIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import type { Room, User } from '../types';
import { getRoomName, getRoomAvatarChar, getStatusColor, getAvatarColor } from '../utils';

interface Props {
  activeRoom: Room;
  currentUser: User;
  userPresence: Record<number, 'online' | 'offline' | 'away'>;
  messageCount: number;
  onClose: () => void;
  token: string | null;
}

export default function RoomInfoPanel({
  activeRoom,
  currentUser,
  userPresence,
  messageCount,
  onClose,
  token,
}: Props) {
  const roomName    = getRoomName(activeRoom, currentUser.id);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(roomName);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setEditName(roomName);
  }, [roomName]);

  const handleSaveName = async () => {
    if (!editName.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/rooms/${activeRoom.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: editName.trim() })
      });
      if (res.ok) {
        setIsEditing(false);
      } else {
        alert('Failed to update space name');
      }
    } catch (err) {
      console.error('Update name error:', err);
      alert('Failed to update space name');
    } finally {
      setIsSaving(false);
    }
  };
  const avatarChar  = getRoomAvatarChar(activeRoom, currentUser.id);
  const avatarColor = getAvatarColor(roomName);

  const onlineCount = activeRoom.members.filter(
    (m) => (userPresence[m.id] || m.status) === 'online',
  ).length;

  return (
    <div className="right-panel">
      {/* Panel header */}
      <div className="right-panel-header">
        <span className="right-panel-title">
          {activeRoom.isGroup ? 'Space details' : 'Conversation info'}
        </span>
        <Tooltip title="Close panel">
          <IconButton size="small" onClick={onClose}>
            <CloseIcon sx={{ fontSize: 18, color: '#5f6368' }} />
          </IconButton>
        </Tooltip>
      </div>

      {/* Room summary */}
      <div className="room-summary-block">
        {activeRoom.isGroup ? (
          <Avatar
            sx={{ width: 72, height: 72, bgcolor: '#1a73e8', fontSize: 28 }}
          >
            <PeopleIcon sx={{ fontSize: 36 }} />
          </Avatar>
        ) : (
          <Avatar
            sx={{
              width: 72,
              height: 72,
              bgcolor: avatarColor,
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            {avatarChar}
          </Avatar>
        )}

        {isEditing ? (
          <div style={{ marginTop: '12px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              style={{
                fontSize: '15px',
                fontWeight: 600,
                color: '#202124',
                border: '1px solid #dadce0',
                borderRadius: '8px',
                padding: '6px 12px',
                outline: 'none',
                width: '80%',
                marginBottom: '8px',
                textAlign: 'center'
              }}
              placeholder="Enter space name..."
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                variant="contained"
                size="small"
                onClick={handleSaveName}
                disabled={isSaving || !editName.trim()}
                sx={{
                  bgcolor: '#1a73e8',
                  textTransform: 'none',
                  borderRadius: '16px',
                  fontWeight: 600,
                  boxShadow: 'none',
                  '&:hover': { bgcolor: '#1557b0', boxShadow: 'none' }
                }}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => { setIsEditing(false); setEditName(roomName); }}
                disabled={isSaving}
                sx={{
                  textTransform: 'none',
                  borderRadius: '16px',
                  borderColor: '#dadce0',
                  color: '#5f6368',
                  fontWeight: 600,
                  '&:hover': { borderColor: '#5f6368', bgcolor: '#f1f3f4' }
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="room-summary-name" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span>{roomName}</span>
            {activeRoom.isGroup && (
              <Tooltip title="Rename Space">
                <IconButton size="small" onClick={() => setIsEditing(true)} sx={{ p: '4px' }}>
                  <EditIcon sx={{ fontSize: 16, color: '#5f6368' }} />
                </IconButton>
              </Tooltip>
            )}
          </div>
        )}
        <div className="room-summary-sub">
          {activeRoom.isGroup
            ? `${activeRoom.members.length} members · ${onlineCount} active`
            : activeRoom.members.find((m) => m.id !== currentUser.id)?.username
            ? `@${activeRoom.members.find((m) => m.id !== currentUser.id)!.username}`
            : 'Direct message'}
        </div>

        {/* Message count stat */}
        <div
          style={{
            marginTop: 16,
            background: '#e8f0fe',
            borderRadius: 12,
            padding: '8px 20px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1a73e8' }}>
            {messageCount}
          </div>
          <div style={{ fontSize: 11, color: '#5f6368', fontWeight: 600 }}>
            Messages
          </div>
        </div>
      </div>

      {/* Members list */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        <div className="members-section-label">
          Members ({activeRoom.members.length})
        </div>

        {activeRoom.members.map((member) => {
          const status   = userPresence[member.id] || member.status;
          const isSelf   = member.id === currentUser.id;
          const color    = getAvatarColor(member.displayName);

          return (
            <div className="member-row" key={member.id}>
              <Badge
                overlap="circular"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                badgeContent={
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: getStatusColor(status),
                      border: '2px solid #fff',
                      display: 'block',
                    }}
                  />
                }
              >
                <Avatar
                  sx={{
                    width: 38,
                    height: 38,
                    bgcolor: color,
                    fontSize: 15,
                    fontWeight: 700,
                  }}
                >
                  {member.displayName.charAt(0).toUpperCase()}
                </Avatar>
              </Badge>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="member-name">
                  {member.displayName}
                  {isSelf && (
                    <span style={{ color: '#80868b', fontSize: 11, fontWeight: 400 }}>
                      {' '}(you)
                    </span>
                  )}
                </div>
                <div className="member-handle">@{member.username}</div>
              </div>

              <span className={`member-status-label ${status}`}>
                {status === 'online' ? 'Active' : status === 'away' ? 'Away' : 'Offline'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import React from 'react';
import { Avatar, IconButton, Tooltip, Typography } from '@mui/material';
import {
  Reply as ReplyIcon,
  PushPin as PinIcon,
  PushPinOutlined as PinOutlineIcon,
  Highlight as HighlightIcon,
  AddReaction as AddReactionIcon,
} from '@mui/icons-material';
import type { User } from '../types';
import type { Message } from '../hooks/useChatSync';
import { formatTime, getAvatarColor } from '../utils';

interface Props {
  msg: Message;
  isOwn: boolean;
  isHighlighted: boolean;
  readers: User[];
  currentUser: User;
  onReply: (msg: Message) => void;
  onPin: (id: string, pinned: boolean) => void;
  onHighlight: (id: string) => void;
  onJumpToParent: (parentId: string) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
}

export default function MessageBubble({
  msg,
  isOwn,
  isHighlighted,
  readers,
  currentUser,
  onReply,
  onPin,
  onHighlight,
  onJumpToParent,
  onToggleReaction,
}: Props) {
  const avatarColor = getAvatarColor(msg.senderName);
  const [showReactionsMenu, setShowReactionsMenu] = React.useState(false);
  const reactionsMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (reactionsMenuRef.current && !reactionsMenuRef.current.contains(e.target as Node)) {
        setShowReactionsMenu(false);
      }
    };
    if (showReactionsMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showReactionsMenu]);

  /** Render message text, highlighting @mentions */
  const renderContent = (text: string) => {
    return text.split(/(\s+)/).map((segment, idx) => {
      if (segment.startsWith('@')) {
        const clean = segment.replace(/[^a-zA-Z0-9_@]/g, '');
        const isSelf = clean.slice(1) === currentUser.username;
        return (
          <span key={idx} className={`mention-tag ${isSelf ? 'self' : ''}`}>
            {segment}
          </span>
        );
      }
      return <React.Fragment key={idx}>{segment}</React.Fragment>;
    });
  };

  return (
    <div
      id={`msg-${msg.id}`}
      className={`msg-row ${isOwn ? 'own' : 'other'}`}
    >
      {/* Avatar — only for other people's messages */}
      {!isOwn && (
        <div className="msg-avatar">
          <Avatar
            sx={{
              width: 28,
              height: 28,
              bgcolor: avatarColor,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {msg.senderName.charAt(0).toUpperCase()}
          </Avatar>
        </div>
      )}

      <div className="msg-content-col">
        {/* Name + timestamp header */}
        <div className="msg-header">
          <span className="msg-sender-name">
            {isOwn ? 'You' : msg.senderName}
          </span>
          {msg.pinned && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              <PinIcon sx={{ fontSize: 11, color: '#1a73e8' }} />
            </span>
          )}
          <span className="msg-timestamp">{formatTime(msg.createdAt)}</span>
        </div>

        {/* Bubble */}
        <div className="msg-bubble-wrap">
          <div
            className={[
              'msg-bubble',
              isOwn ? 'outgoing' : 'incoming',
              isHighlighted ? 'highlighted' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {/* Reply quote */}
            {msg.parentId && (
              <div
                className="reply-quote"
                onClick={() => onJumpToParent(msg.parentId!)}
              >
                <ReplyIcon sx={{ fontSize: 11 }} />
                Replying to a message
              </div>
            )}

            {/* Message text */}
            {msg.content && (
              <Typography
                component="span"
                sx={{ fontSize: '14px', lineHeight: 1.55, display: 'block' }}
              >
                {renderContent(msg.content)}
              </Typography>
            )}

            {/* Attachment display */}
            {msg.attachmentUrl && (
              <div style={{ marginTop: '8px' }}>
                {(msg.attachmentUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) || (msg.attachmentName && msg.attachmentName.match(/\.(jpeg|jpg|gif|png|webp)$/i))) ? (
                  <div style={{ maxWidth: '300px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.1)' }}>
                    <img
                      src={msg.attachmentUrl}
                      alt={msg.attachmentName || 'Attachment'}
                      style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '200px', objectFit: 'cover', cursor: 'pointer' }}
                      onClick={() => window.open(msg.attachmentUrl!, '_blank')}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      background: isOwn ? 'rgba(255, 255, 255, 0.15)' : '#f1f3f4',
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: isOwn ? 'rgba(255, 255, 255, 0.25)' : '#dadce0',
                      cursor: 'pointer',
                      maxWidth: '260px',
                    }}
                    onClick={() => window.open(msg.attachmentUrl!, '_blank')}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                      <path
                        d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5V6H9v9.5a3 3 0 0 0 6 0V5a4 4 0 0 0-8 0v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"
                        fill={isOwn ? '#fff' : '#5f6368'}
                      />
                    </svg>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: isOwn ? '#fff' : '#3c4043', display: 'block', textDecoration: 'underline' }}>
                        {msg.attachmentName || 'Download File'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Hover action toolbar */}
          <div className={`bubble-actions ${isOwn ? 'own' : 'other'}`} style={{ position: 'relative' }}>
            {/* Reactions Menu Popover */}
            {showReactionsMenu && (
              <div
                ref={reactionsMenuRef}
                style={{
                  position: 'absolute',
                  bottom: '32px',
                  left: isOwn ? 'auto' : '0px',
                  right: isOwn ? '0px' : 'auto',
                  display: 'flex',
                  gap: '4px',
                  padding: '4px',
                  background: '#fff',
                  border: '1px solid #dadce0',
                  borderRadius: '16px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  zIndex: 1020,
                }}
              >
                {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      onToggleReaction(msg.id, emoji);
                      setShowReactionsMenu(false);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '18px',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '50%',
                      transition: 'background-color 0.15s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f1f3f4';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            <Tooltip title="React">
              <IconButton size="small" onClick={() => setShowReactionsMenu(!showReactionsMenu)}>
                <AddReactionIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Reply">
              <IconButton size="small" onClick={() => onReply(msg)}>
                <ReplyIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={msg.pinned ? 'Unpin' : 'Pin'}>
              <IconButton size="small" onClick={() => onPin(msg.id, msg.pinned)}>
                {msg.pinned
                  ? <PinIcon sx={{ fontSize: 15, color: '#1a73e8' }} />
                  : <PinOutlineIcon sx={{ fontSize: 15 }} />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Highlight">
              <IconButton size="small" onClick={() => onHighlight(msg.id)}>
                <HighlightIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
          </div>
        </div>

        {/* Render Reactions Row */}
        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
            marginTop: '4px',
            marginBottom: '4px',
            alignSelf: isOwn ? 'flex-end' : 'flex-start'
          }}>
            {Object.entries(msg.reactions).map(([emoji, userIds]) => {
              if (!userIds || userIds.length === 0) return null;
              const hasReacted = userIds.includes(currentUser.id);
              return (
                <button
                  key={emoji}
                  onClick={() => onToggleReaction(msg.id, emoji)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    background: hasReacted ? '#e8f0fe' : '#f1f3f4',
                    border: '1px solid',
                    borderColor: hasReacted ? '#1a73e8' : '#dadce0',
                    borderRadius: '12px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    color: hasReacted ? '#1a73e8' : '#5f6368',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = hasReacted ? '#d2e3fc' : '#e8eaed';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = hasReacted ? '#e8f0fe' : '#f1f3f4';
                  }}
                >
                  <span>{emoji}</span>
                  <span style={{ fontWeight: 600 }}>{userIds.length}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Read receipts */}
        {readers.length > 0 && (
          <div className="read-receipts">
            {readers.map((r) => (
              <Tooltip key={r.id} title={`Seen by ${r.displayName}`}>
                <Avatar
                  sx={{ width: 12, height: 12, fontSize: 6, bgcolor: '#1a73e8' }}
                >
                  {r.displayName.charAt(0).toUpperCase()}
                </Avatar>
              </Tooltip>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

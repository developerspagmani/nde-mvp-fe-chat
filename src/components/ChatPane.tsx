import { useState, useRef, useEffect } from 'react';
import {
  Avatar, Badge, IconButton, Tooltip, Typography,
  List, ListItem, ListItemButton, ListItemAvatar, ListItemText,
  InputBase, Button, FormControl, Select, MenuItem,
} from '@mui/material';
import {
  Send as SendIcon,
  Reply as ReplyIcon,
  Close as CloseIcon,
  EmojiEmotions as EmojiIcon,
  AttachFile as AttachIcon,
  KeyboardArrowLeft as CollapseLeftIcon,
  KeyboardArrowRight as ExpandRightIcon,
  People as PeopleIcon,
} from '@mui/icons-material';
import type { Room, User } from '../types';
import type { Message } from '../hooks/useChatSync';
import { getStatusColor, getAvatarColor, getRoomName } from '../utils';
import MessageBubble from './MessageBubble';

interface Props {
  activeRoom: Room;
  currentUser: User;
  messages: Message[];
  typingUsers: Record<number, Record<number, boolean>>;
  activeRoomId: number;
  readReceipts: Record<number, string>;
  userPresence: Record<number, 'online' | 'offline' | 'away'>;
  leftSidebarCollapsed: boolean;
  rightPanelOpen: boolean;
  onToggleRightPanel: () => void;
  onExpandLeftSidebar: () => void;
  sendMessage: (
    content: string,
    parentId: string | null,
    attachmentUrl?: string | null,
    attachmentName?: string | null
  ) => void;
  togglePinMessage: (id: string, pinned: boolean) => void;
  sendTypingStatus: (typing: boolean) => void;
  highlightMessageId: string | null;
  onClearHighlightMessage: () => void;
  token: string | null;
  toggleReaction: (messageId: string, emoji: string) => void;
  allUsers: User[];
}

export default function ChatPane({
  activeRoom,
  currentUser,
  messages,
  typingUsers,
  activeRoomId,
  readReceipts,
  userPresence,
  leftSidebarCollapsed,
  rightPanelOpen,
  onToggleRightPanel,
  onExpandLeftSidebar,
  sendMessage,
  togglePinMessage,
  sendTypingStatus,
  highlightMessageId,
  onClearHighlightMessage,
  token,
  toggleReaction,
  allUsers,
}: Props) {
  const [tab, setTab] = useState<'messages' | 'people'>('messages');
  const [inputText, setInputText] = useState('');
  const [replyParent, setReplyParent] = useState<Message | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [mentionAnchor, setMentionAnchor] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [addUserId, setAddUserId] = useState<number | string>('');

  const handleAddMember = async () => {
    if (!addUserId) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/rooms/${activeRoomId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ userId: Number(addUserId) })
      });
      if (res.ok) {
        setAddUserId('');
      } else {
        alert('Failed to add member');
      }
    } catch (err) {
      console.error('Add member error:', err);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!confirm('Are you sure you want to remove this member?')) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/rooms/${activeRoomId}/members/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        alert('Failed to remove member');
      }
    } catch (err) {
      console.error('Remove member error:', err);
    }
  };

  const [attachment, setAttachment] = useState<{ url: string; name: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const messageEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const EMOJIS = [
    '👍', '❤️', '😂', '😮', '😢', '🙏', '😀', '😃', '😄', '😁',
    '😆', '😅', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍',
    '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪',
    '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔',
    '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😭',
    '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨',
    '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐',
    '😑', '😬', '🙄', '😯', '😦', '😧', '😲', '🥱', '😴', '🤤',
    '😪', '😵', '🤐', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️',
    '🤟', '🤘', '👌', '👈', '👉', '👆', '👇', '👋', '🔥', '✨'
  ];

  // Auto-scroll on new messages
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // Clear highlight after 3 s
  useEffect(() => {
    if (!highlighted) return;
    const t = setTimeout(() => setHighlighted(null), 3000);
    return () => clearTimeout(t);
  }, [highlighted]);

  // Jump to message if highlighted from search results
  useEffect(() => {
    if (highlightMessageId && messages.length > 0) {
      const t = setTimeout(() => {
        jumpToMessage(highlightMessageId);
        onClearHighlightMessage();
      }, 100);
      return () => clearTimeout(t);
    }
  }, [highlightMessageId, messages]);

  // Close emoji picker on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputText(text);
    sendTypingStatus(text.length > 0);

    // Check for @mention
    const cursor = e.target.selectionStart || 0;
    const wordStart = text.lastIndexOf(' ', cursor - 1) + 1;
    const word = text.substring(wordStart, cursor);
    if (word.startsWith('@')) {
      setMentionFilter(word.slice(1).toLowerCase());
      setMentionAnchor(true);
    } else {
      setMentionAnchor(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!inputText.trim() && !attachment) return;
    sendMessage(
      inputText.trim(),
      replyParent?.id ?? null,
      attachment?.url ?? null,
      attachment?.name ?? null
    );
    setInputText('');
    setAttachment(null);
    setReplyParent(null);
    sendTypingStatus(false);
    inputRef.current?.focus();
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setAttachment({ url: data.url, name: data.filename });
    } catch (err) {
      console.error('File upload error:', err);
      alert('Failed to upload file');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleEmojiClick = (emoji: string) => {
    setInputText((prev) => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const handleMentionSelect = (member: User) => {
    if (!inputRef.current) return;
    const cursor = inputRef.current.selectionStart || 0;
    const wordStart = inputText.lastIndexOf(' ', cursor - 1) + 1;
    const updated = `${inputText.slice(0, wordStart)}@${member.username} ${inputText.slice(cursor)}`;
    setInputText(updated);
    setMentionAnchor(false);
    setTimeout(() => {
      inputRef.current?.focus();
      const pos = wordStart + member.username.length + 2;
      inputRef.current?.setSelectionRange(pos, pos);
    }, 10);
  };

  const jumpToMessage = (id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlighted(id);
    }
  };

  // Typing indicator helpers
  const roomTypingMap = typingUsers[activeRoomId] || {};
  const activeTyperIds = Object.entries(roomTypingMap)
    .filter(([, v]) => v)
    .map(([uid]) => parseInt(uid))
    .filter((uid) => uid !== currentUser.id);
  const activeTyperNames = activeTyperIds
    .map((uid) => activeRoom.members.find((m) => m.id === uid)?.displayName || 'Someone')
    .join(', ');

  const roomName = getRoomName(activeRoom, currentUser.id);
  const otherMember = activeRoom.members.find((m) => m.id !== currentUser.id);
  const headerSub = activeRoom.isGroup
    ? `${activeRoom.members.length} members`
    : (userPresence[otherMember?.id ?? 0] || otherMember?.status) === 'online'
      ? 'Active now'
      : 'Offline';

  return (
    <div className="chat-pane">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          {leftSidebarCollapsed && (
            <Tooltip title="Open sidebar">
              <IconButton size="small" onClick={onExpandLeftSidebar} sx={{ mr: 0.5 }}>
                <ExpandRightIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}

          {/* Room avatar */}
          {activeRoom.isGroup ? (
            <Avatar sx={{ width: 36, height: 36, bgcolor: '#1a73e8', fontSize: 16 }}>
              <PeopleIcon sx={{ fontSize: 18 }} />
            </Avatar>
          ) : (
            <Badge
              overlap="circular"
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              badgeContent={
                otherMember && (
                  <span
                    style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: getStatusColor(userPresence[otherMember.id] || otherMember.status),
                      border: '2px solid #fff', display: 'block',
                    }}
                  />
                )
              }
            >
              <Avatar
                sx={{
                  width: 36, height: 36,
                  bgcolor: getAvatarColor(roomName),
                  fontSize: 15, fontWeight: 700,
                }}
              >
                {roomName.charAt(0).toUpperCase()}
              </Avatar>
            </Badge>
          )}

          <div>
            <div className="chat-header-title">{roomName}</div>
            <div className="chat-header-sub">{headerSub}</div>
          </div>
        </div>

        {/* Tabs + toggle */}
        <div className="chat-header-right">
          <div className="chat-tabs">
            <button
              className={`chat-tab ${tab === 'messages' ? 'active' : ''}`}
              onClick={() => setTab('messages')}
            >
              Messages
            </button>
            <button
              className={`chat-tab ${tab === 'people' ? 'active' : ''}`}
              onClick={() => setTab('people')}
            >
              People
            </button>
          </div>

          <Tooltip title={rightPanelOpen ? 'Close details' : 'Open details'}>
            <IconButton size="small" onClick={onToggleRightPanel}>
              {rightPanelOpen
                ? <CollapseLeftIcon sx={{ fontSize: 18, color: '#5f6368' }} />
                : <ExpandRightIcon sx={{ fontSize: 18, color: '#5f6368' }} />}
            </IconButton>
          </Tooltip>
        </div>
      </div>

      {/* ---- MESSAGES TAB ---- */}
      {tab === 'messages' && (
        <>
          <div className="messages-area">
            <div className="messages-spacer" />

            {messages.length === 0 && (
              <div style={{
                textAlign: 'center', color: '#80868b', fontSize: 13,
                padding: '40px 0',
              }}>
                No messages yet — say hello! 👋
              </div>
            )}

            {messages.map((msg) => {
              const isOwn = msg.senderId === currentUser.id;
              const readers = activeRoom.members.filter(
                (m) => m.id !== currentUser.id && readReceipts[m.id] === msg.id,
              );

              return (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  isOwn={isOwn}
                  isHighlighted={highlighted === msg.id}
                  readers={readers}
                  currentUser={currentUser}
                  onReply={setReplyParent}
                  onPin={togglePinMessage}
                  onHighlight={setHighlighted}
                  onJumpToParent={jumpToMessage}
                  onToggleReaction={toggleReaction}
                />
              );
            })}

            <div ref={messageEndRef} />
          </div>

          {/* Typing bar */}
          {activeTyperIds.length > 0 && (
            <div className="typing-bar">
              <div className="typing-dots">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
              <span>{activeTyperNames} is typing…</span>
            </div>
          )}

          {/* Input area */}
          <div className="input-area" style={{ position: 'relative' }}>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            {/* Reply banner */}
            {replyParent && (
              <div className="reply-banner">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ReplyIcon sx={{ fontSize: 14 }} />
                  <span>
                    Replying to <strong>{replyParent.senderName}</strong>:{' '}
                    {replyParent.content.slice(0, 60)}
                    {replyParent.content.length > 60 ? '…' : ''}
                  </span>
                </div>
                <IconButton size="small" onClick={() => setReplyParent(null)} sx={{ p: '2px' }}>
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </div>
            )}

            {/* Attachment preview banner */}
            {attachment && (
              <div className="attachment-preview-banner" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: '#f8f9fa',
                border: '1px solid #dadce0',
                borderRadius: '8px',
                marginBottom: '8px',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                  {(attachment.name.match(/\.(jpeg|jpg|gif|png|webp)$/i)) ? (
                    <img src={attachment.url} alt={attachment.name} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                  ) : (
                    <AttachIcon sx={{ color: '#5f6368' }} />
                  )}
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: '#3c4043' }}>
                      {attachment.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#5f6368' }}>
                      Ready to send
                    </Typography>
                  </div>
                </div>
                <IconButton size="small" onClick={() => setAttachment(null)}>
                  <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </div>
            )}

            {isUploading && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 12px',
                background: '#f8f9fa',
                border: '1px dashed #dadce0',
                borderRadius: '8px',
                marginBottom: '8px',
                gap: '8px',
                color: '#5f6368',
                fontSize: '13px'
              }}>
                <div className="upload-spinner" style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #ccc',
                  borderTop: '2px solid #1a73e8',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                <span>Uploading attachment...</span>
              </div>
            )}

            {/* Custom Emoji Picker Popover */}
            {showEmojiPicker && (
              <div
                ref={emojiPickerRef}
                className="emoji-picker-popover"
                style={{
                  position: 'absolute',
                  bottom: '56px',
                  right: '64px',
                  width: '280px',
                  height: '220px',
                  background: '#ffffff',
                  border: '1px solid #dadce0',
                  borderRadius: '12px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                  padding: '12px',
                  zIndex: 1010,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#5f6368',
                  marginBottom: '8px',
                  paddingBottom: '4px',
                  borderBottom: '1px solid #f1f3f4',
                }}>
                  Emojis
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: '6px',
                  overflowY: 'auto',
                  flex: 1,
                  paddingRight: '4px',
                }}>
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleEmojiClick(emoji)}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '20px',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '4px',
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
              </div>
            )}

            <div className="input-box">
              <InputBase
                placeholder={`Message ${roomName}`}
                fullWidth
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                inputRef={inputRef}
                sx={{ fontSize: '14px' }}
              />

              <Tooltip title="Emoji">
                <IconButton size="small" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                  <EmojiIcon sx={{ fontSize: 20, color: showEmojiPicker ? '#1a73e8' : '#5f6368' }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Attach file">
                <IconButton size="small" onClick={handleAttachClick}>
                  <AttachIcon sx={{ fontSize: 20, color: '#5f6368' }} />
                </IconButton>
              </Tooltip>

              <button
                className="send-btn"
                onClick={handleSend}
                disabled={(!inputText.trim() && !attachment) || isUploading}
              >
                <SendIcon sx={{ fontSize: 18 }} />
              </button>
            </div>

            {/* Mention dropdown */}
            {mentionAnchor && (
              <div className="mentions-popup">
                <List dense>
                  {activeRoom.members
                    .filter(
                      (m) =>
                        m.id !== currentUser.id &&
                        m.username.toLowerCase().includes(mentionFilter),
                    )
                    .map((member) => (
                      <ListItem key={member.id} disablePadding>
                        <ListItemButton onClick={() => handleMentionSelect(member)}>
                          <ListItemAvatar sx={{ minWidth: 34 }}>
                            <Avatar
                              sx={{
                                width: 24, height: 24,
                                bgcolor: getAvatarColor(member.displayName),
                                fontSize: 10,
                              }}
                            >
                              {member.displayName.charAt(0).toUpperCase()}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={member.displayName}
                            secondary={`@${member.username}`}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                </List>
              </div>
            )}
          </div>
        </>
      )}

      {/* ---- PEOPLE TAB ---- */}
      {tab === 'people' && (
        <div className="members-tab-content">
          <Typography
            variant="overline"
            sx={{ color: '#80868b', fontWeight: 700, letterSpacing: '0.8px', mb: 2, display: 'block' }}
          >
            Members — {activeRoom.members.length}
          </Typography>

          {/* Add member row (only for group spaces) */}
          {activeRoom.isGroup && (
            (() => {
              const nonMembers = allUsers.filter(u => !activeRoom.members.some(m => m.id === u.id));
              if (nonMembers.length === 0) return null;
              return (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px',
                  background: '#f8f9fa',
                  borderRadius: '30px',
                  border: '1px solid #dadce0',
                  marginBottom: '16px'
                }}>
                  <FormControl size="small" sx={{ flex: 2 }}>
                    <Select
                      value={addUserId}
                      onChange={(e) => setAddUserId(e.target.value as number)}
                      displayEmpty
                      renderValue={(selected) => {
                        if (!selected) {
                          return <span style={{ color: '#80868b' }}>Select a user to add...</span>;
                        }
                        const user = nonMembers.find(u => u.id === selected);
                        return user ? `${user.displayName || user.username} (@${user.username})` : '';
                      }}
                      sx={{
                        height: '36px',
                        borderRadius: '20px',
                        bgcolor: '#fff',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#dadce0',
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#b0b3b8',
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#1a73e8',
                        },
                        fontSize: '14px',
                      }}
                    >
                      <MenuItem value="" disabled>
                        <em>Select a user to add...</em>
                      </MenuItem>
                      {nonMembers.map((u) => (
                        <MenuItem key={u.id} value={u.id} sx={{ gap: '8px', fontSize: '13px' }}>
                          <Avatar sx={{ width: 20, height: 20, fontSize: 10, bgcolor: getAvatarColor(u.displayName) }}>
                            {u.displayName.charAt(0).toUpperCase()}
                          </Avatar>
                          <span>{u.displayName || u.username} (@{u.username})</span>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleAddMember}
                    disabled={!addUserId}
                    sx={{
                      bgcolor: '#1a73e8',
                      borderRadius: '18px',
                      textTransform: 'none',
                      fontWeight: 600,
                      boxShadow: 'none',
                      height: '36px',
                      '&:hover': {
                        bgcolor: '#1557b0',
                        boxShadow: 'none'
                      }
                    }}
                  >
                    Add Member
                  </Button>
                </div>
              );
            })()
          )}

          {activeRoom.members.map((member) => {
            const status = userPresence[member.id] || member.status;
            return (
              <div className="member-row" key={member.id}>
                <Badge
                  overlap="circular"
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  badgeContent={
                    <span
                      style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: getStatusColor(status),
                        border: '2px solid #fff', display: 'block',
                      }}
                    />
                  }
                >
                  <Avatar
                    sx={{
                      width: 40, height: 40,
                      bgcolor: getAvatarColor(member.displayName),
                      fontWeight: 700,
                    }}
                  >
                    {member.displayName.charAt(0).toUpperCase()}
                  </Avatar>
                </Badge>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="member-name">
                    {member.displayName}
                    {member.id === currentUser.id && (
                      <span style={{ color: '#80868b', fontWeight: 400, fontSize: 12 }}> (you)</span>
                    )}
                  </div>
                  <div className="member-handle">@{member.username}</div>
                </div>
                <span className={`member-status-label ${status}`}>
                  {status === 'online' ? 'Active' : status === 'away' ? 'Away' : 'Offline'}
                </span>

                {activeRoom.isGroup && member.id !== currentUser.id && (
                  <Tooltip title="Remove member">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleRemoveMember(member.id)}
                      sx={{ ml: 1, p: '4px' }}
                    >
                      <CloseIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

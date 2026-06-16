import { useState, useEffect } from 'react';
import { IconButton, Tooltip, Typography, Button, Menu, MenuItem } from '@mui/material';
import { Add as AddIcon, Chat as ChatIcon, KeyboardArrowRight as ExpandIcon, Search as SearchIcon, Close as CloseIcon, ArrowDropDown as ArrowDropDownIcon } from '@mui/icons-material';

import { useChatSync } from './hooks/useChatSync';
import type { User, Room, SearchResult } from './types';

import AuthScreen from './components/AuthScreen';
import LeftNav from './components/LeftNav';
import RoomList from './components/RoomList';
import ChatPane from './components/ChatPane';
import RoomInfoPanel from './components/RoomInfoPanel';
import CreateRoomDialog from './components/CreateRoomDialog';

const API = `${import.meta.env.VITE_API_BASE_URL}/api`;

export default function App() {
  // ---- Auth state -------------------------------------------------------
  const [token, setToken] = useState<string | null>(localStorage.getItem('chat_token'));
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // ---- Data state -------------------------------------------------------
  const [rooms, setRooms] = useState<Room[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<number | null>(null);

  // ---- Layout state -----------------------------------------------------
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [activeNav, setActiveNav] = useState<'chat' | 'spaces'>('chat');

  // ---- Dialog state -----------------------------------------------------
  const [createOpen, setCreateOpen] = useState(false);
  const [isGroup, setIsGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // ---- Search state ------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);

  // ---- CRDT sync hook ---------------------------------------------------
  const {
    messages,
    isOnline,
    typingUsers,
    userPresence,
    readReceipts,
    sendMessage,
    toggleReaction,
    togglePinMessage,
    sendTypingStatus,
    sendReadReceipt,
    sendPresenceStatus,
  } = useChatSync(
    activeRoomId,
    token,
    currentUser,
    // onUnreadCountUpdate
    (notifyRoomId) => {
      if (notifyRoomId !== activeRoomId) {
        setRooms((prev) =>
          prev.map((r) =>
            r.id === notifyRoomId ? { ...r, unreadCount: (r.unreadCount || 0) + 1 } : r
          )
        );
      }
    },
    // onNewRoom
    (newRoom: Room) => {
      setRooms((prev) => {
        if (prev.some((r) => r.id === newRoom.id)) return prev;
        return [newRoom, ...prev];
      });
    },
    // onRoomMembersUpdated
    () => {
      fetch(`${API}/rooms`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then(setRooms)
        .catch(console.error);
    },
    // onRemovedFromRoom
    (removedRoomId) => {
      if (activeRoomId === removedRoomId) {
        setActiveRoomId(null);
      }
      setRooms((prev) => prev.filter((r) => r.id !== removedRoomId));
    },
    // onRoomUpdated
    (roomId, name) => {
      setRooms((prev) =>
        prev.map((r) => (r.id === roomId ? { ...r, name } : r))
      );
    }
  );

  // ---- User Presence / Status State & Handlers ---------------------------
  const [statusAnchorEl, setStatusAnchorEl] = useState<null | HTMLElement>(null);

  const handleSendPresence = (status: 'online' | 'offline' | 'away') => {
    sendPresenceStatus(status);
    setCurrentUser((prev) => (prev ? { ...prev, status } : null));
  };

  // ---- Derived -----------------------------------------------------------
  const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? null;

  // ---- Data fetching -----------------------------------------------------
  useEffect(() => {
    if (!token) { setCurrentUser(null); return; }

    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setCurrentUser)
      .catch(handleLogout);

    fetch(`${API}/rooms`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setRooms)
      .catch(console.error);

    fetch(`${API}/users`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setAllUsers)
      .catch(console.error);
  }, [token]);

  // Mark last message as read whenever messages list updates
  useEffect(() => {
    if (messages.length > 0) {
      sendReadReceipt(messages[messages.length - 1].id);
    }
  }, [messages]);

  // ---- Auth handlers ----------------------------------------------------
  const handleLogin = (newToken: string, user: User) => {
    setToken(newToken);
    setCurrentUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('chat_token');
    setToken(null);
    setCurrentUser(null);
    setActiveRoomId(null);
    setRooms([]);
  };

  // ---- Create room -------------------------------------------------------
  const handleCreateRoom = async () => {
    if (isGroup && !groupName.trim()) return;

    try {
      const res = await fetch(`${API}/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: isGroup ? groupName : null,
          isGroup,
          memberIds: selectedIds,
        }),
      });
      const newRoom: Room = await res.json();

      setRooms((prev) =>
        prev.some((r) => r.id === newRoom.id) ? prev : [newRoom, ...prev],
      );
      setActiveRoomId(newRoom.id);
      setCreateOpen(false);
      setGroupName('');
      setSelectedIds([]);
      setIsGroup(false);
    } catch (err) {
      console.error('Failed to create room:', err);
    }
  };

  const handleToggleUser = (id: number) => {
    if (isGroup) {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
      );
    } else {
      setSelectedIds([id]);
    }
  };

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setShowSearchDropdown(false);
      setSearchResults([]);
      return;
    }

    fetch(`${API}/search?q=${encodeURIComponent(q)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setSearchResults(data);
        setShowSearchDropdown(true);
      })
      .catch(console.error);
  };

  const handleSearchResultClick = (result: SearchResult) => {
    setShowSearchDropdown(false);
    setSearchQuery('');
    setActiveRoomId(result.roomId);
    setHighlightMessageId(result.id);
  };

  const handleTogglePin = async (roomId: number, isPinned: boolean) => {
    try {
      const res = await fetch(`${API}/rooms/${roomId}/pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isPinned }),
      });
      if (res.ok) {
        setRooms((prev) =>
          prev.map((r) => (r.id === roomId ? { ...r, isPinned } : r))
        );
      }
    } catch (err) {
      console.error('Failed to pin/unpin room:', err);
    }
  };

  // ---- Guard: show auth screen ------------------------------------------
  if (!token || !currentUser) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  // ---- Main app shell ---------------------------------------------------
  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      
      {/* Backdrop to close search dropdown when clicked outside */}
      {showSearchDropdown && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999,
            background: 'transparent',
          }}
          onClick={() => setShowSearchDropdown(false)}
        />
      )}

      {/* Top Google Chat Style Header */}
      <header className="global-header" style={{
        height: '64px',
        background: '#fff',
        borderBottom: '1px solid #dadce0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        flexShrink: 0,
        zIndex: 1000,
      }}>
        {/* Left: Logo and Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '250px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"
                fill="#1a73e8"
              />
              <circle cx="8"  cy="11" r="1.5" fill="white" />
              <circle cx="12" cy="11" r="1.5" fill="white" />
              <circle cx="16" cy="11" r="1.5" fill="white" />
            </svg>
          </div>
          <span style={{ fontSize: '18px', fontWeight: 600, color: '#3c4043', fontFamily: '"Google Sans", sans-serif' }}>
            NDE Chat
          </span>
        </div>

        {/* Center: Search Bar & User Status Option */}
        <div style={{ flex: 1, maxWidth: '720px', position: 'relative', zIndex: 1001, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: '#f1f3f4',
              borderRadius: '24px',
              padding: '0 16px',
              height: '40px',
              border: '1px solid transparent',
              transition: 'background-color 0.2s, box-shadow 0.2s, border-color 0.2s',
            }}
            className="header-search-bar"
            >
              <SearchIcon sx={{ fontSize: 20, color: '#5f6368', mr: 1.5 }} />
              <input
                placeholder="Search in Chat"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => { if (searchQuery.trim()) setShowSearchDropdown(true); }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  width: '100%',
                  fontSize: '15px',
                  color: '#3c4043',
                }}
              />
              {searchQuery && (
                <IconButton
                  size="small"
                  onClick={() => { setSearchQuery(''); setShowSearchDropdown(false); }}
                  sx={{ p: '2px' }}
                >
                  <CloseIcon sx={{ fontSize: 18, color: '#5f6368' }} />
                </IconButton>
              )}
            </div>

            {/* Search Dropdown overlay */}
            {showSearchDropdown && (
              <div
              style={{
                position: 'absolute',
                top: '46px',
                left: 0,
                right: 0,
                background: '#fff',
                border: '1px solid #dadce0',
                borderRadius: '8px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                maxHeight: '360px',
                overflowY: 'auto',
                zIndex: 1002,
              }}
              className="search-dropdown-panel"
            >
              {searchResults.length === 0 ? (
                <div style={{ padding: '24px', color: '#5f6368', fontSize: '14px', textAlign: 'center' }}>
                  No results found matching "{searchQuery}"
                </div>
              ) : (
                searchResults.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      padding: '12px 20px',
                      borderBottom: '1px solid #f1f3f4',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s',
                    }}
                    className="search-dropdown-item"
                    onClick={() => handleSearchResultClick(r)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#202124' }}>
                        {r.senderName}
                      </span>
                      <span style={{ fontSize: '11px', color: '#80868b', background: '#e8f0fe', borderRadius: '4px', padding: '2px 6px' }}>
                        in {r.roomName || (r.isGroup ? 'Space' : 'DM')}
                      </span>
                    </div>
                    <div style={{ fontSize: '14px', color: '#5f6368', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.content}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          </div>

          {/* User status updater dropdown pill */}
          <Tooltip title="Update status">
            <Button
              onClick={(e) => setStatusAnchorEl(e.currentTarget)}
              sx={{
                height: '36px',
                borderRadius: '18px',
                border: '1px solid #dadce0',
                textTransform: 'none',
                color: '#3c4043',
                fontSize: '13px',
                fontWeight: 500,
                px: 2,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                bgcolor: '#fff',
                flexShrink: 0,
                '&:hover': {
                  bgcolor: '#f1f3f4',
                }
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: currentUser.status === 'online' ? '#137333' : currentUser.status === 'away' ? '#f29900' : '#80868b',
                  display: 'inline-block',
                }}
              />
              <span>
                {currentUser.status === 'online' ? 'Active' : currentUser.status === 'away' ? 'Away' : 'Do not disturb'}
              </span>
              <ArrowDropDownIcon sx={{ fontSize: 18, color: '#5f6368' }} />
            </Button>
          </Tooltip>

          <Menu
            anchorEl={statusAnchorEl}
            open={Boolean(statusAnchorEl)}
            onClose={() => setStatusAnchorEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            slotProps={{ paper: { sx: { borderRadius: '12px', minWidth: 160, mt: 0.5 } } }}
          >
            <MenuItem
              dense
              onClick={() => { handleSendPresence('online'); setStatusAnchorEl(null); }}
              sx={{ gap: '8px', fontSize: '13px' }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#137333', display: 'inline-block' }} />
              Active
            </MenuItem>
            <MenuItem
              dense
              onClick={() => { handleSendPresence('away'); setStatusAnchorEl(null); }}
              sx={{ gap: '8px', fontSize: '13px' }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f29900', display: 'inline-block' }} />
              Away
            </MenuItem>
            <MenuItem
              dense
              onClick={() => { handleSendPresence('offline'); setStatusAnchorEl(null); }}
              sx={{ gap: '8px', fontSize: '13px' }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#80868b', display: 'inline-block' }} />
              Do not disturb
            </MenuItem>
          </Menu>
        </div>

        {/* Right: Profile Menu Spacer */}
        <div style={{ width: '250px' }}></div>
      </header>

      {/* Main app body columns layout (former app-shell) */}
      <div className="app-shell" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Column 1: Icon nav */}
        <LeftNav
          currentUser={currentUser}
          activeNav={activeNav}
          onNavChange={setActiveNav}
          onSendPresence={handleSendPresence}
          onLogout={handleLogout}
        />

      {/* Column 2: Room list */}
      {!sidebarCollapsed && (
        <RoomList
          rooms={rooms}
          activeRoomId={activeRoomId}
          currentUser={currentUser}
          typingUsers={typingUsers}
          userPresence={userPresence}
          isOnline={isOnline}
          onRoomSelect={(id) => {
            setActiveRoomId(id);
            // Clear unread count locally for this room
            setRooms((prev) =>
              prev.map((r) => (r.id === id ? { ...r, unreadCount: 0 } : r))
            );
            // Also refresh room list to get latest members
            fetch(`${API}/rooms`, { headers: { Authorization: `Bearer ${token}` } })
              .then((r) => r.json())
              .then(setRooms)
              .catch(console.error);
          }}
          onNewChat={() => setCreateOpen(true)}
          onCollapse={() => setSidebarCollapsed(true)}
          onTogglePin={handleTogglePin}
        />
      )}

      {/* Column 3: Chat pane */}
      {activeRoom ? (
        <ChatPane
          activeRoom={activeRoom}
          currentUser={currentUser}
          messages={messages}
          typingUsers={typingUsers}
          activeRoomId={activeRoomId!}
          readReceipts={readReceipts}
          userPresence={userPresence}
          leftSidebarCollapsed={sidebarCollapsed}
          rightPanelOpen={rightPanelOpen}
          onToggleRightPanel={() => setRightPanelOpen((p) => !p)}
          onExpandLeftSidebar={() => setSidebarCollapsed(false)}
          sendMessage={sendMessage}
          togglePinMessage={togglePinMessage}
          sendTypingStatus={sendTypingStatus}
          highlightMessageId={highlightMessageId}
          onClearHighlightMessage={() => setHighlightMessageId(null)}
          token={token}
          toggleReaction={toggleReaction}
          allUsers={allUsers}
        />
      ) : (
        /* Empty state when no room is selected */
        <div className="chat-pane empty-chat">
          {sidebarCollapsed && (
            <Tooltip title="Open sidebar">
              <IconButton
                size="small"
                onClick={() => setSidebarCollapsed(false)}
                sx={{ position: 'absolute', top: 14, left: 14 }}
              >
                <ExpandIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          )}

          <div
            style={{
              width: 80, height: 80, borderRadius: '50%',
              background: '#e8f0fe',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <ChatIcon sx={{ fontSize: 40, color: '#1a73e8' }} />
          </div>

          <Typography
            variant="h6"
            sx={{ fontWeight: 700, color: '#202124', mb: 1 }}
          >
            Welcome to NDE Chat
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: '#5f6368', maxWidth: 320, textAlign: 'center', mb: 3 }}
          >
            Select a conversation from the sidebar, or start a new direct message or space.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
            sx={{
              bgcolor: '#1a73e8',
              borderRadius: '24px',
              textTransform: 'none',
              fontWeight: 600,
              px: 3,
              '&:hover': { bgcolor: '#1557b0' },
            }}
          >
            New conversation
          </Button>
        </div>
      )}

      {/* Column 4: Room info panel (only when a room is open) */}
      {activeRoom && (
        <div className={`right-panel ${rightPanelOpen ? '' : 'collapsed'}`}>
          {rightPanelOpen && (
            <RoomInfoPanel
              activeRoom={activeRoom}
              currentUser={currentUser}
              userPresence={userPresence}
              messageCount={messages.length}
              onClose={() => setRightPanelOpen(false)}
              token={token}
            />
          )}
        </div>
      )}

      </div> {/* Close app-shell */}

      {/* Create room dialog */}
      <CreateRoomDialog
        open={createOpen}
        isGroup={isGroup}
        groupName={groupName}
        selectedIds={selectedIds}
        allUsers={allUsers.filter((u) => u.id !== currentUser.id)}
        onClose={() => {
          setCreateOpen(false);
          setGroupName('');
          setSelectedIds([]);
          setIsGroup(false);
        }}
        onSetIsGroup={setIsGroup}
        onSetGroupName={setGroupName}
        onToggleUser={handleToggleUser}
        onCreate={handleCreateRoom}
      />
    </div>
  );
}

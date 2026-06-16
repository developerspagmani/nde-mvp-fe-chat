import React from 'react';
import { Avatar, Badge, Tooltip, IconButton, Menu, MenuItem, Divider } from '@mui/material';
import {
  Chat as ChatIcon,
  People as PeopleIcon,
  FiberManualRecord as DotIcon,
} from '@mui/icons-material';
import type { User } from '../types';
import { getStatusColor, getAvatarColor } from '../utils';

interface Props {
  currentUser: User;
  activeNav: 'chat' | 'spaces';
  onNavChange: (nav: 'chat' | 'spaces') => void;
  onSendPresence: (status: 'online' | 'away' | 'offline') => void;
  onLogout: () => void;
}

/** NDE Chat logo SVG (simplified) */
function GoogleChatLogo() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"
        fill="#1a73e8"
      />
      <circle cx="8" cy="11" r="1.5" fill="white" />
      <circle cx="12" cy="11" r="1.5" fill="white" />
      <circle cx="16" cy="11" r="1.5" fill="white" />
    </svg>
  );
}

export default function LeftNav({
  currentUser,
  activeNav,
  onNavChange,
  onSendPresence,
  onLogout,
}: Props) {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const avatarBg = getAvatarColor(currentUser.displayName || currentUser.username);
  const statusColor = getStatusColor(currentUser.status);
  const initials = (currentUser.displayName || currentUser.username).charAt(0).toUpperCase();

  return (
    <nav className="left-nav">
      {/* Logo */}
      <Tooltip title="NDE Chat" placement="right">
        <div className="left-nav-logo">
          <GoogleChatLogo />
        </div>
      </Tooltip>

      {/* Chat */}
      <Tooltip title="Chat" placement="right">
        <div
          className={`nav-item ${activeNav === 'chat' ? 'active' : ''}`}
          onClick={() => onNavChange('chat')}
        >
          <ChatIcon sx={{ fontSize: 22 }} />
        </div>
      </Tooltip>

      {/* Spaces */}
      <Tooltip title="Spaces" placement="right">
        <div
          className={`nav-item ${activeNav === 'spaces' ? 'active' : ''}`}
          onClick={() => onNavChange('spaces')}
        >
          <PeopleIcon sx={{ fontSize: 22 }} />
        </div>
      </Tooltip>

      <div className="nav-spacer" />

      {/* User avatar — profile / status menu */}
      <Tooltip title="Profile & status" placement="right">
        <IconButton
          size="small"
          onClick={(e) => setAnchorEl(e.currentTarget)}
          className="left-nav-avatar"
          sx={{ mb: 1 }}
        >
          <Badge
            overlap="circular"
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            badgeContent={
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: statusColor,
                  border: '2px solid #fff',
                  display: 'block',
                }}
              />
            }
          >
            <Avatar sx={{ bgcolor: avatarBg, width: 32, height: 32, fontSize: 13, fontWeight: 700 }}>
              {initials}
            </Avatar>
          </Badge>
        </IconButton>
      </Tooltip>

      {/* Status / Logout menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        transformOrigin={{ horizontal: 'left', vertical: 'bottom' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        slotProps={{ paper: { sx: { borderRadius: '12px', minWidth: 180 } } }}
      >
        <MenuItem
          dense
          onClick={() => { onSendPresence('online'); setAnchorEl(null); }}
        >
          <DotIcon sx={{ color: '#137333', fontSize: 13, mr: 1 }} />
          Active
        </MenuItem>
        <MenuItem
          dense
          onClick={() => { onSendPresence('away'); setAnchorEl(null); }}
        >
          <DotIcon sx={{ color: '#f29900', fontSize: 13, mr: 1 }} />
          Away
        </MenuItem>
        <MenuItem
          dense
          onClick={() => { onSendPresence('offline'); setAnchorEl(null); }}
        >
          <DotIcon sx={{ color: '#80868b', fontSize: 13, mr: 1 }} />
          Do not disturb
        </MenuItem>
        <Divider />
        <MenuItem dense onClick={() => { onLogout(); setAnchorEl(null); }}>
          Sign out
        </MenuItem>
      </Menu>
    </nav>
  );
}

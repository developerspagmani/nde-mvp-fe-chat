import React, { useState } from 'react';
import { TextField, Button, Divider, Typography } from '@mui/material';
import { Chat as ChatIcon } from '@mui/icons-material';
import type { User } from '../types';

interface Props {
  onLogin: (token: string, user: User) => void;
}

const API = `${import.meta.env.VITE_API_BASE_URL}/api`;

export default function AuthScreen({ onLogin }: Props) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isRegistering ? 'register' : 'login';
    const payload = isRegistering
      ? { username, password, displayName }
      : { username, password };

    try {
      const res = await fetch(`${API}/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Authentication failed');
        return;
      }
      localStorage.setItem('chat_token', data.token);
      onLogin(data.token, data.user);
    } catch {
      setError('Server connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-bg">
      <div className="auth-card animated-fade">
        {/* Logo */}
        <div className="auth-logo">
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: '#e8f0fe',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ChatIcon sx={{ fontSize: 30, color: '#1a73e8' }} />
          </div>
        </div>

        <Typography
          variant="h5"
          sx={{ textAlign: 'center', fontWeight: 700, mb: 0.5, color: '#202124' }}
        >
          {isRegistering ? 'Create account' : 'Sign in'}
        </Typography>
        <Typography
          variant="body2"
          sx={{ textAlign: 'center', color: '#5f6368', mb: 3 }}
        >
          {isRegistering
            ? 'Sign up to connect with your team'
            : 'to continue to NDE Chat'}
        </Typography>

        <form onSubmit={handleSubmit}>
          <TextField
            label="Username"
            fullWidth
            margin="dense"
            size="small"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
          />
          {isRegistering && (
            <TextField
              label="Display Name"
              fullWidth
              margin="dense"
              size="small"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          )}
          <TextField
            label="Password"
            type="password"
            fullWidth
            margin="dense"
            size="small"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <Typography
              variant="caption"
              sx={{ color: '#c5221f', display: 'block', mt: 1 }}
            >
              {error}
            </Typography>
          )}

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading}
            sx={{
              mt: 2.5, mb: 1,
              bgcolor: '#1a73e8',
              borderRadius: '24px',
              textTransform: 'none',
              fontWeight: 600,
              py: 1.2,
              '&:hover': { bgcolor: '#1557b0' },
            }}
          >
            {isRegistering ? 'Create Account' : 'Sign In'}
          </Button>
        </form>

        <Divider sx={{ my: 2 }} />

        <Button
          fullWidth
          onClick={() => { setIsRegistering((p) => !p); setError(''); }}
          sx={{ textTransform: 'none', color: '#1a73e8', fontWeight: 500 }}
        >
          {isRegistering
            ? 'Already have an account? Sign in'
            : "Don't have an account? Create one"}
        </Button>
      </div>
    </div>
  );
}

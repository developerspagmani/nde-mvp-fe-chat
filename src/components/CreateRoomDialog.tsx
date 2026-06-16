
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Avatar, Checkbox,
  List, ListItem, ListItemButton, ListItemAvatar, ListItemText,
} from '@mui/material';
import { People as PeopleIcon } from '@mui/icons-material';
import type { User } from '../types';
import { getAvatarColor } from '../utils';

interface Props {
  open: boolean;
  isGroup: boolean;
  groupName: string;
  selectedIds: number[];
  allUsers: User[];
  onClose: () => void;
  onSetIsGroup: (v: boolean) => void;
  onSetGroupName: (v: string) => void;
  onToggleUser: (id: number) => void;
  onCreate: () => void;
}

export default function CreateRoomDialog({
  open,
  isGroup,
  groupName,
  selectedIds,
  allUsers,
  onClose,
  onSetIsGroup,
  onSetGroupName,
  onToggleUser,
  onCreate,
}: Props) {
  const canCreate =
    selectedIds.length > 0 && (!isGroup || groupName.trim().length > 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { sx: { borderRadius: '16px' } } }}
    >
      <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
        New conversation
      </DialogTitle>

      <DialogContent>
        {/* Type toggle */}
        <div className="dialog-type-switch">
          <Button
            variant={!isGroup ? 'contained' : 'outlined'}
            onClick={() => { onSetIsGroup(false); onSetGroupName(''); }}
            sx={{
              flex: 1,
              borderRadius: '24px',
              textTransform: 'none',
              fontWeight: 600,
              ...((!isGroup) && {
                bgcolor: '#1a73e8',
                '&:hover': { bgcolor: '#1557b0' },
              }),
            }}
          >
            Direct Message
          </Button>
          <Button
            variant={isGroup ? 'contained' : 'outlined'}
            onClick={() => onSetIsGroup(true)}
            startIcon={<PeopleIcon />}
            sx={{
              flex: 1,
              borderRadius: '24px',
              textTransform: 'none',
              fontWeight: 600,
              ...(isGroup && {
                bgcolor: '#1a73e8',
                '&:hover': { bgcolor: '#1557b0' },
              }),
            }}
          >
            Group Space
          </Button>
        </div>

        {isGroup && (
          <TextField
            label="Space name"
            fullWidth
            size="small"
            margin="dense"
            value={groupName}
            onChange={(e) => onSetGroupName(e.target.value)}
            required
            autoFocus
            sx={{ mb: 1.5 }}
          />
        )}

        <Typography
          variant="caption"
          sx={{ color: '#5f6368', fontWeight: 600, display: 'block', mb: 0.5, mt: 1 }}
        >
          {isGroup ? 'Add people' : 'Select someone to message'}
        </Typography>

        <List
          sx={{
            maxHeight: 220,
            overflow: 'auto',
            border: '1px solid #e0e0e0',
            borderRadius: '12px',
          }}
          dense
        >
          {allUsers.map((user) => {
            const checked = selectedIds.includes(user.id);
            return (
              <ListItem key={user.id} disablePadding>
                <ListItemButton
                  onClick={() => {
                    if (isGroup) {
                      onToggleUser(user.id);
                    } else {
                      // For DM, select exactly one
                      if (!checked) onToggleUser(user.id);
                    }
                  }}
                >
                  <Checkbox
                    checked={checked}
                    size="small"
                    sx={{ color: '#1a73e8', '&.Mui-checked': { color: '#1a73e8' } }}
                  />
                  <ListItemAvatar>
                    <Avatar
                      sx={{
                        width: 32,
                        height: 32,
                        bgcolor: getAvatarColor(user.displayName || user.username),
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      {(user.displayName || user.username).charAt(0).toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography sx={{ fontSize: 14, fontWeight: 500 }}>
                        {user.displayName}
                      </Typography>
                    }
                    secondary={
                      <Typography sx={{ fontSize: 12 }} color="textSecondary">
                        {`@${user.username}`}
                      </Typography>
                    }
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button
          onClick={onClose}
          color="inherit"
          sx={{ textTransform: 'none', borderRadius: '24px', px: 2 }}
        >
          Cancel
        </Button>
        <Button
          onClick={onCreate}
          variant="contained"
          disabled={!canCreate}
          sx={{
            bgcolor: '#1a73e8',
            borderRadius: '24px',
            textTransform: 'none',
            fontWeight: 600,
            px: 3,
            '&:hover': { bgcolor: '#1557b0' },
          }}
        >
          {isGroup ? 'Create space' : 'Open chat'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

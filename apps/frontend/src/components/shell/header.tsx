'use client';

import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import { Avatar, Box, IconButton, Stack, Typography } from '@mui/material';
import { ROLE_LABELS } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const { user } = useAuthStore();
  const displayName = user?.name || 'X3Sales';
  const displayRole = user?.role ? ROLE_LABELS[user.role] : 'Giao diện';

  return (
    <Box
      component="header"
      sx={{
        height: 72,
        px: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>

      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <IconButton>
          <NotificationsNoneRoundedIcon />
        </IconButton>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
          <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: 14 }}>{displayName.charAt(0)}</Avatar>
          <Box sx={{ display: { xs: 'none', md: 'block' } }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
              {displayName}
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: 12 }}>
              {displayRole}
            </Typography>
          </Box>
        </Stack>
      </Stack>
    </Box>
  );
}

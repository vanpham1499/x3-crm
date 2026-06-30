'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import { Avatar, Box, Button, List, ListItemButton, ListItemIcon, ListItemText, Stack, Typography } from '@mui/material';
import { useAuthStore } from '@/stores/auth-store';
import x3salesLogo from '@assets/logos/x3sales-logo.svg';

const navItems = [
  {
    href: '/users',
    label: 'Nhân viên',
    icon: PeopleAltRoundedIcon,
    roles: ['ADMIN', 'LEADER', 'EMPLOYEE', 'ACCOUNTANT', 'SALES'],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();

  const visibleItems = navItems.filter((item) => !user || item.roles.includes(user.role));
  const displayName = user?.name || 'X3Sales';
  const displayEmail = user?.email || 'design@x3sales.vn';

  return (
    <Box
      component="aside"
      sx={{
        width: 280,
        height: '100vh',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
      }}
    >
      <Stack sx={{ height: 72, px: 3, borderBottom: 1, borderColor: 'divider', justifyContent: 'center' }}>
        <Image src={x3salesLogo} alt="X3Sales logo" width={132} height={48} style={{ width: 132, height: 'auto' }} />
      </Stack>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        <List disablePadding>
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <ListItemButton
                key={item.href}
                component={Link}
                href={item.href}
                selected={active}
                sx={{
                  minHeight: 44,
                  borderRadius: 1,
                  px: 1.5,
                  color: active ? 'primary.main' : 'text.secondary',
                  '&.Mui-selected': {
                    bgcolor: 'rgba(37, 99, 235, 0.08)',
                    color: 'primary.main',
                    '&:hover': { bgcolor: 'rgba(37, 99, 235, 0.12)' },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}>
                  <Icon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={item.label} slotProps={{ primary: { sx: { fontSize: 14, fontWeight: 700 } } }} />
              </ListItemButton>
            );
          })}
        </List>
      </Box>

      <Box sx={{ borderTop: 1, borderColor: 'divider', p: 2 }}>
        <Stack direction="row" spacing={1.5} sx={{ mb: 1.5, px: 1, alignItems: 'center' }}>
          <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: 14 }}>{displayName.charAt(0)}</Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography noWrap sx={{ fontSize: 14, fontWeight: 700 }}>
              {displayName}
            </Typography>
            <Typography noWrap color="text.secondary" sx={{ fontSize: 12 }}>
              {displayEmail}
            </Typography>
          </Box>
        </Stack>
        <Button fullWidth color="error" startIcon={<LogoutRoundedIcon />} sx={{ justifyContent: 'flex-start', px: 1.5 }}>
          Đăng xuất
        </Button>
      </Box>
    </Box>
  );
}

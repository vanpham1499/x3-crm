'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/shell/header';
import { ROLE_LABELS, formatDate } from '@/lib/utils';
import { api } from '@/services/api/client';

function getRoleChipColor(role: string) {
  if (role === 'ADMIN') return 'error';
  if (role === 'LEADER') return 'secondary';
  if (role === 'ACCOUNTANT') return 'success';
  return 'primary';
}

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const router = useRouter();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', search],
    queryFn: () => api.get('/users', { params: { search: search || undefined } }).then((r) => r.data),
  });

  return (
    <Box>
      <Header title="Quản lý nhân viên" />
      <Stack spacing={2.5} sx={{ p: 3 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}
        >
          <TextField
            size="small"
            placeholder="Tìm theo mã, tên, email..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            sx={{ width: { xs: 1, sm: 360 } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => router.push('/users/new')}
            sx={{ ml: { sm: 'auto' } }}
          >
            Thêm nhân viên
          </Button>
        </Stack>

        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell>Mã NV</TableCell>
                <TableCell>Tên</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Vai trò</TableCell>
                <TableCell>Ngày tạo</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell align="center">TT</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                    Đang tải...
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                    Không có dữ liệu
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user: any) => (
                  <TableRow key={user.id} hover>
                    <TableCell>
                      <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
                        {user.code}
                      </Typography>
                    </TableCell>
                    <TableCell>{user.name}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{user.email}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={getRoleChipColor(user.role) as any}
                        label={ROLE_LABELS[user.role] || user.role}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{formatDate(user.createdAt)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={user.isActive ? 'success' : 'default'}
                        label={user.isActive ? 'Hoạt động' : 'Vô hiệu'}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => router.push(`/users/${user.id}`)}>
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>
    </Box>
  );
}

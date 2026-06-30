'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  Button,
  Chip,
  IconButton,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
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
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <TextField
          size="small"
          placeholder="Tìm theo mã, tên, email..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full sm:w-[360px]"
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
          className="sm:ml-auto"
        >
          Thêm nhân viên
        </Button>
      </div>

      <TableContainer component={Paper} variant="outlined" className="rounded-lg">
        <Table size="small">
          <TableHead className="bg-slate-50">
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
                <TableCell colSpan={7} align="center" className="py-10 text-slate-500">
                  Đang tải...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" className="py-10 text-slate-500">
                  Không có dữ liệu
                </TableCell>
              </TableRow>
            ) : (
              users.map((user: any) => (
                <TableRow key={user.id} hover>
                  <TableCell>
                    <span className="text-sm font-bold">{user.code}</span>
                  </TableCell>
                  <TableCell>{user.name}</TableCell>
                  <TableCell className="text-slate-500">{user.email}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={getRoleChipColor(user.role) as any}
                      label={ROLE_LABELS[user.role] || user.role}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell className="text-slate-500">{formatDate(user.createdAt)}</TableCell>
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
    </div>
  );
}

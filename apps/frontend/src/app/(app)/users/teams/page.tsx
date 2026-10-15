'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Autocomplete,
  Avatar,
  Checkbox,
  FormControlLabel,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  Alert,
} from '@mui/material';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { PageHeader } from '@/components/shell/page-header';
import { AppDataTable } from '@/components/table/app-data-table';
import { AppFormDialog } from '@/components/dialog/app-form-dialog';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { CompactSearchField } from '@/components/form/compact-search-field';
import { ListFilterBar } from '@/components/form/list-filter-bar';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatUserLabel } from '@/lib/user-utils';
import { hasPermission } from '@/lib/ownership';
import { useAuthStore } from '@/stores/auth-store';
import api from '@/services/api/client';
import type { User } from '@/types/user';
import type { Department } from '@/types/department';

type Team = {
  id: number;
  name: string;
  departmentId: number;
  departmentName: string;
  leaderUserId: number | null;
  leader: User | null;
  members: User[];
  membersCount: number;
};
type History = {
  id: number;
  userCode: string;
  userName: string;
  startedAt: string;
  endedAt: string | null;
};
type Form = {
  id?: number;
  name: string;
  departmentId: string;
  leaderUserId: number | null;
  memberUserIds: number[];
  confirmTransfers: boolean;
};
const empty: Form = {
  name: '',
  departmentId: '',
  leaderUserId: null,
  memberUserIds: [],
  confirmTransfers: false,
};

export default function TeamsPage() {
  const viewer = useAuthStore((s) => s.user);
  const notify = useAppNotification();
  const cache = useQueryClient();
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState('');
  const [menu, setMenu] = useState<{ anchor: HTMLElement; team: Team } | null>(null);
  const [deleting, setDeleting] = useState<Team | null>(null);
  const [historyTeam, setHistoryTeam] = useState<Team | null>(null);
  const teams = useQuery({
    queryKey: ['teams'],
    queryFn: () => api.get<Team[]>('/teams').then((r) => r.data),
  });
  const users = useQuery({
    queryKey: ['users', 'team-options'],
    queryFn: () => api.get<User[]>('/users/lookup').then((r) => r.data),
  });
  const departments = useQuery({
    queryKey: ['departments', 'lookup'],
    queryFn: () => api.get<Department[]>('/departments/lookup').then((r) => r.data),
  });
  const history = useQuery({
    queryKey: ['teams', historyTeam?.id, 'history'],
    enabled: Boolean(historyTeam),
    queryFn: () => api.get<History[]>(`/teams/${historyTeam!.id}/history`).then((r) => r.data),
  });
  const refresh = async () => {
    await useAuthStore.getState().verify();
    await Promise.all(
      ['teams', 'users', 'dashboard', 'kpi'].map((key) =>
        cache.invalidateQueries({ queryKey: [key] }),
      ),
    );
  };
  const save = useMutation({
    mutationFn: (f: Form) => {
      const payload = { ...f, departmentId: Number(f.departmentId) };
      return f.id ? api.put(`/teams/${f.id}`, payload) : api.post('/teams', payload);
    },
    onSuccess: async () => {
      await refresh();
      setForm(null);
      notify.success('Đã lưu nhóm');
    },
    onError: (e) => setError(getApiErrorMessage(e, 'Không thể lưu nhóm')),
  });
  const remove = useMutation({
    mutationFn: (team: Team) => api.delete(`/teams/${team.id}`),
    onSuccess: async () => {
      await refresh();
      setDeleting(null);
      notify.success('Đã xóa nhóm');
    },
    onError: (e) => notify.error(getApiErrorMessage(e, 'Không thể xóa nhóm')),
  });
  const rows = (teams.data ?? []).filter(
    (t) =>
      (!department || String(t.departmentId) === department) &&
      `${t.name} ${t.leader?.name ?? ''}`
        .toLocaleLowerCase('vi')
        .includes(search.trim().toLocaleLowerCase('vi')),
  );
  const options = (users.data ?? []).filter(
    (u) => u.isActive && String(u.departmentId) === form?.departmentId,
  );
  const transfers = options.filter(
    (u) => form?.memberUserIds.includes(u.id) && u.teamId && u.teamId !== form.id,
  );
  const open = (team?: Team) => {
    setError('');
    setForm(
      team
        ? {
            id: team.id,
            name: team.name,
            departmentId: String(team.departmentId),
            leaderUserId: team.leaderUserId,
            memberUserIds: team.members.map((u) => u.id),
            confirmTransfers: false,
          }
        : { ...empty },
    );
    setMenu(null);
  };
  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-4 sm:p-6">
      <PageHeader
        title="Nhóm"
        actions={
          hasPermission(viewer, 'team.create') ? (
            <DialogActionButton
              tone="primary"
              onClick={() => open()}
              startIcon={<AddRoundedIcon />}
            >
              Thêm nhóm
            </DialogActionButton>
          ) : undefined
        }
      />
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <ListFilterBar className="p-4">
          <CompactSearchField
            label="Tìm kiếm"
            placeholder="Tên nhóm, trưởng nhóm..."
            value={search}
            onChange={setSearch}
          />
          <TextField
            select
            size="small"
            label="Phòng ban"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <MenuItem value="">Tất cả phòng ban</MenuItem>
            {(departments.data ?? []).map((d) => (
              <MenuItem key={d.id} value={String(d.id)}>
                {d.name}
              </MenuItem>
            ))}
          </TextField>
        </ListFilterBar>
        {teams.isError && <Alert severity="error">Không tải được danh sách nhóm.</Alert>}
        <AppDataTable
          isLoading={teams.isFetching}
          isEmpty={!rows.length}
          emptyText="Chưa có nhóm phù hợp"
          minWidthClassName="min-w-[700px]"
          columns={[
            { key: 'name', label: 'Nhóm' },
            { key: 'department', label: 'Phòng ban' },
            { key: 'leader', label: 'Trưởng nhóm' },
            { key: 'members', label: 'Thành viên' },
            { key: 'actions', label: '', className: 'w-16' },
          ]}
        >
          {rows.map((t) => (
            <tr key={t.id} className="hover:bg-slate-50">
              <td className="px-3 py-4 font-semibold">{t.name}</td>
              <td className="px-3 py-4">{t.departmentName}</td>
              <td className="px-3 py-4">
                <div className="flex items-center gap-2">
                  <Avatar src={t.leader?.avatar} sx={{ width: 30, height: 30 }}>
                    {t.leader?.name?.[0]}
                  </Avatar>
                  <span>{t.leader ? formatUserLabel(t.leader) : 'Chưa phân công'}</span>
                </div>
              </td>
              <td className="px-3 py-4">
                <span className="font-semibold">{t.membersCount} nhân sự</span>
                <p
                  className="mt-1 max-w-[280px] truncate text-xs text-slate-500"
                  title={t.members.map((u) => u.name).join(', ')}
                >
                  {t.members.map((u) => u.name).join(', ')}
                </p>
              </td>
              <td>
                <IconButton
                  aria-label={`Thao tác nhóm ${t.name}`}
                  onClick={(e) => setMenu({ anchor: e.currentTarget, team: t })}
                >
                  <MoreVertRoundedIcon />
                </IconButton>
              </td>
            </tr>
          ))}
        </AppDataTable>
        <p className="px-4 py-3 text-sm text-slate-500">{rows.length} nhóm</p>
      </section>
      <Menu open={Boolean(menu)} anchorEl={menu?.anchor} onClose={() => setMenu(null)}>
        {hasPermission(viewer, 'team.update') && (
          <MenuItem onClick={() => open(menu!.team)}>Chỉnh sửa</MenuItem>
        )}
        <MenuItem
          onClick={() => {
            setHistoryTeam(menu!.team);
            setMenu(null);
          }}
        >
          Lịch sử thành viên
        </MenuItem>
        {hasPermission(viewer, 'team.delete') && (
          <MenuItem
            sx={{ color: 'error.main' }}
            onClick={() => {
              setDeleting(menu!.team);
              setMenu(null);
            }}
          >
            Xóa nhóm
          </MenuItem>
        )}
      </Menu>
      <AppFormDialog
        open={Boolean(form)}
        title={form?.id ? 'Chỉnh sửa nhóm' : 'Thêm nhóm'}
        maxWidth="sm"
        submitting={save.isPending}
        onClose={() => setForm(null)}
        onSubmit={(e) => {
          e.preventDefault();
          if (form) save.mutate(form);
        }}
        contentClassName="grid gap-4"
        actions={
          <>
            <DialogActionButton disabled={save.isPending} onClick={() => setForm(null)}>
              Hủy
            </DialogActionButton>
            <DialogActionButton
              type="submit"
              tone="primary"
              disabled={
                save.isPending ||
                !form?.name.trim() ||
                !form.departmentId ||
                (transfers.length > 0 && !form.confirmTransfers)
              }
            >
              {save.isPending ? 'Đang lưu...' : 'Lưu nhóm'}
            </DialogActionButton>
          </>
        }
      >
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          required
          label="Tên nhóm"
          size="small"
          value={form?.name ?? ''}
          onChange={(e) => setForm((f) => f && { ...f, name: e.target.value })}
        />
        <TextField
          required
          select
          label="Phòng ban"
          size="small"
          disabled={Boolean(form?.id)}
          value={form?.departmentId ?? ''}
          onChange={(e) =>
            setForm(
              (f) =>
                f && {
                  ...f,
                  departmentId: e.target.value,
                  leaderUserId: null,
                  memberUserIds: [],
                  confirmTransfers: false,
                },
            )
          }
        >
          {(departments.data ?? []).map((d) => (
            <MenuItem key={d.id} value={String(d.id)}>
              {d.name}
            </MenuItem>
          ))}
        </TextField>
        <Autocomplete
          disabled={!form?.departmentId || users.isLoading}
          options={options}
          value={options.find((u) => u.id === form?.leaderUserId) ?? null}
          getOptionLabel={(u: User) => formatUserLabel(u)}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          onChange={(_, u) => setForm((f) => f && { ...f, leaderUserId: u?.id ?? null })}
          renderInput={(p) => <TextField {...p} label="Trưởng nhóm" size="small" />}
        />
        <Autocomplete
          disabled={!form?.departmentId || users.isLoading}
          multiple
          disableCloseOnSelect
          options={options}
          value={options.filter((u) => form?.memberUserIds.includes(u.id))}
          getOptionLabel={(u) =>
            `${formatUserLabel(u)}${u.teamId && u.teamId !== form?.id ? ' · Đang thuộc nhóm khác' : ''}`
          }
          isOptionEqualToValue={(a, b) => a.id === b.id}
          onChange={(_, selected) =>
            setForm(
              (f) =>
                f && { ...f, memberUserIds: selected.map((u) => u.id), confirmTransfers: false },
            )
          }
          renderInput={(p) => <TextField {...p} label="Thành viên" size="small" />}
        />
        {transfers.length > 0 && (
          <FormControlLabel
            control={
              <Checkbox
                checked={form?.confirmTransfers ?? false}
                onChange={(e) => setForm((f) => f && { ...f, confirmTransfers: e.target.checked })}
              />
            }
            label={`Chuyển ${transfers.length} nhân sự từ nhóm hiện tại sang nhóm này`}
          />
        )}
      </AppFormDialog>
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Xóa nhóm"
        description={`Xóa nhóm ${deleting?.name ?? ''}? Chỉ xóa được khi nhóm không còn thành viên. Lịch sử KPI được giữ lại.`}
        loading={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
      <Dialog
        open={Boolean(historyTeam)}
        onClose={() => setHistoryTeam(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Lịch sử · {historyTeam?.name}</DialogTitle>
        <DialogContent>
          {history.isFetching ? (
            'Đang tải...'
          ) : history.isError ? (
            'Không tải được lịch sử.'
          ) : !history.data?.length ? (
            'Chưa có lịch sử thành viên.'
          ) : (
            <ul className="divide-y divide-slate-100">
              {history.data.map((h) => (
                <li key={h.id} className="py-3">
                  <p className="font-semibold">
                    {h.userCode} - {h.userName}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(h.startedAt).toLocaleString('vi-VN')} →{' '}
                    {h.endedAt ? new Date(h.endedAt).toLocaleString('vi-VN') : 'Hiện tại'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
        <div className="px-6 pb-4 text-right">
          <DialogActionButton onClick={() => setHistoryTeam(null)}>Đóng</DialogActionButton>
        </div>
      </Dialog>
    </div>
  );
}

'use client';

import { MenuItem, TextField } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api/client';
import { useAuthStore } from '@/stores/auth-store';
import { hasPermission } from '@/lib/ownership';

type TeamOption = { id: number; name: string; departmentName: string };

export function TeamScopeSelect({
  context,
  value,
  onChange,
}: {
  context: 'project' | 'kpi';
  value: string;
  onChange: (value: string) => void;
}) {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;
  const defaultLabel =
    hasPermission(user, `${context}.view_all`) ||
    (context === 'kpi' && hasPermission(user, 'kpi.manage_all'))
      ? 'Toàn bộ'
      : hasPermission(user, `${context}.view_department`) ||
          (context === 'kpi' && hasPermission(user, 'kpi.manage_department'))
        ? 'Toàn phòng'
        : 'Toàn nhóm';
  const { data = [] } = useQuery<TeamOption[]>({
    queryKey: ['teams', 'scope', context, userId],
    queryFn: ({ signal }) =>
      api.get('/teams/lookup', { params: { context }, signal }).then((r) => r.data),
  });
  if (!data.length) return null;
  return (
    <TextField
      select
      size="small"
      label="Phạm vi nhóm"
      value={value}
      slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
      onChange={(e) => onChange(e.target.value)}
      sx={{ minWidth: 210, maxWidth: 320, width: { xs: '100%', sm: 'auto' } }}
    >
      <MenuItem value="">{defaultLabel}</MenuItem>
      {data.map((team) => (
        <MenuItem key={team.id} value={String(team.id)}>
          {team.name} · {team.departmentName}
        </MenuItem>
      ))}
    </TextField>
  );
}

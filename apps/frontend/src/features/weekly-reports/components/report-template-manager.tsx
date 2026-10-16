'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Button,
  IconButton,
  Menu,
  FormControlLabel,
  MenuItem,
  Switch,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import PowerSettingsNewRoundedIcon from '@mui/icons-material/PowerSettingsNewRounded';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/shell/page-header';
import { FormInputField } from '@/components/form/form-input-field';
import { CompactSelectField } from '@/components/form/compact-select-field';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { AppFormDialog } from '@/components/dialog/app-form-dialog';
import { AppDetailDialog } from '@/components/dialog/app-detail-dialog';
import { ListFilterBar } from '@/components/form/list-filter-bar';
import { CompactSearchField } from '@/components/form/compact-search-field';
import { AppDataTable } from '@/components/table/app-data-table';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { getApiErrorMessage } from '@/lib/api-error';
import { hasPermission } from '@/lib/ownership';
import { useAuthStore } from '@/stores/auth-store';
import {
  saveTemplate,
  templateList,
  templateOptions,
  templateCategories,
  type TemplateDraft,
  type ReportTemplate,
} from '../templates';

const blank: TemplateDraft = {
  title: '',
  service_id: null,
  category: '',
  usage_hint: '',
  content: '',
  is_active: true,
  sort_order: 0,
};

export function ReportTemplateManager() {
  const user = useAuthStore((s) => s.user);
  const allowed = hasPermission(user, 'weeklytemplate.manage');
  const client = useQueryClient();
  const notify = useAppNotification();
  const [search, setSearch] = useState('');
  const [keyword, setKeyword] = useState('');
  const [service, setService] = useState('');
  const [category, setCategory] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [preview, setPreview] = useState<ReportTemplate | null>(null);
  const [menu, setMenu] = useState<{ anchor: HTMLElement; row: ReportTemplate } | null>(null);
  const [editor, setEditor] = useState(false);
  const [existing, setExisting] = useState<ReportTemplate | null>(null);
  const [draft, setDraft] = useState<TemplateDraft>(blank);
  const [error, setError] = useState('');
  const [discard, setDiscard] = useState(false);
  const [initial, setInitial] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setKeyword(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const options = useQuery({
    queryKey: ['report-template-options', user?.id],
    queryFn: ({ signal }) => templateOptions(signal),
    enabled: allowed,
  });
  const list = useQuery({
    queryKey: [
      'report-templates',
      user?.id,
      'manage',
      keyword,
      service,
      category,
      active,
      page,
      pageSize,
    ],
    queryFn: ({ signal }) =>
      templateList(
        {
          manage: 1,
          search: keyword,
          ...(service ? { service_id: service } : {}),
          ...(category ? { category } : {}),
          ...(active ? { active: active === 'on' ? 1 : 0 } : {}),
          page,
          per_page: pageSize,
        },
        signal,
      ),
    enabled: allowed,
  });
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['report-templates'] });
    void client.invalidateQueries({ queryKey: ['report-template-options'] });
  };
  const save = useMutation({
    mutationFn: () =>
      saveTemplate(
        {
          ...draft,
          title: draft.title.trim(),
          category: draft.category.trim(),
          content: draft.content.trim(),
        },
        existing,
      ),
    onSuccess: () => {
      setEditor(false);
      refresh();
      notify.success('Đã lưu mẫu báo cáo');
    },
    onError: (e) => setError(getApiErrorMessage(e, 'Chưa lưu được mẫu.')),
  });
  const toggle = useMutation({
    mutationFn: (row: ReportTemplate) => saveTemplate({ ...row, is_active: !row.is_active }, row),
    onSuccess: refresh,
    onError: (e) => notify.error(getApiErrorMessage(e, 'Chưa cập nhật được mẫu.')),
  });
  function open(row?: ReportTemplate, copy = false) {
    setMenu(null);
    setPreview(null);
    const value = row
      ? {
          title: copy ? `${row.title.slice(0, 140)} (bản sao)` : row.title,
          service_id: row.service_id,
          category: row.category,
          usage_hint: row.usage_hint || '',
          content: row.content,
          is_active: copy ? false : row.is_active,
          sort_order: row.sort_order,
        }
      : { ...blank };
    setExisting(copy ? null : row || null);
    setDraft(value);
    setInitial(JSON.stringify(value));
    setError('');
    setEditor(true);
  }
  function close() {
    if (save.isPending) return;
    if (JSON.stringify(draft) !== initial) setDiscard(true);
    else setEditor(false);
  }
  const categories = Array.from(
    new Set([...templateCategories, ...(options.data?.categories || [])]),
  ).sort((a, b) => a.localeCompare(b, 'vi'));
  const serviceLabel = (id: number | null) =>
    id
      ? options.data?.services.find((s) => s.id === id)?.name || 'Dịch vụ đã ngừng sử dụng'
      : 'Dùng chung';
  const canSave =
    !save.isPending &&
    Boolean(draft.title.trim() && draft.category.trim() && draft.content.trim()) &&
    Number.isInteger(draft.sort_order) &&
    draft.sort_order >= 0 &&
    draft.sort_order <= 100000;
  const statusBadge = (row: ReportTemplate) => (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset ${row.is_active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-slate-200'}`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${row.is_active ? 'bg-emerald-600' : 'bg-slate-400'}`}
      />
      {row.is_active ? 'Đang bật' : 'Đã tắt'}
    </span>
  );
  if (!allowed)
    return <Alert severity="warning">Bạn không có quyền quản lý mẫu báo cáo tuần.</Alert>;
  return (
    <div className="min-h-[calc(100vh-72px)] bg-slate-50/60 p-4 sm:p-6">
      <PageHeader
        title="Mẫu báo cáo tuần"
        action={{ label: 'Thêm mẫu', icon: <AddRoundedIcon />, onClick: () => open() }}
      />
      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <ListFilterBar className="p-4">
          <CompactSearchField
            label="Từ khóa"
            placeholder="Tìm tên mẫu, nội dung..."
            value={search}
            onChange={setSearch}
          />
          <CompactSelectField
            label="Dịch vụ"
            value={service}
            onChange={(v) => {
              setService(v);
              setPage(1);
            }}
            allLabel="Tất cả dịch vụ"
            options={[
              { value: '0', label: 'Dùng chung' },
              ...(options.data?.services || []).map((s) => ({
                value: String(s.id),
                label: `${s.code} - ${s.name}`,
              })),
            ]}
          />
          <CompactSelectField
            label="Tình huống"
            value={category}
            onChange={(v) => {
              setCategory(v);
              setPage(1);
            }}
            options={categories.map((c) => ({ value: c, label: c }))}
          />
          <CompactSelectField
            label="Trạng thái"
            value={active}
            onChange={(v) => {
              setActive(v);
              setPage(1);
            }}
            options={[
              { value: 'on', label: 'Đang bật' },
              { value: 'off', label: 'Đã tắt' },
            ]}
          />
        </ListFilterBar>
        {(list.isError || options.isError) && (
          <Alert
            severity="error"
            action={
              <Button
                onClick={() => {
                  void list.refetch();
                  void options.refetch();
                }}
              >
                Thử lại
              </Button>
            }
          >
            Chưa tải được thư viện mẫu.
          </Alert>
        )}
        <AppDataTable
          columns={[
            { key: 'template', label: 'Tên mẫu & nội dung' },
            { key: 'service', label: 'Dịch vụ', className: 'hidden w-48 lg:table-cell' },
            { key: 'category', label: 'Tình huống', className: 'hidden w-48 xl:table-cell' },
            { key: 'order', label: 'Thứ tự', className: 'hidden w-20 text-center lg:table-cell' },
            { key: 'status', label: 'Trạng thái', className: 'hidden w-32 sm:table-cell' },
            { key: 'actions', label: <span className="sr-only">Thao tác</span>, className: 'w-24' },
          ]}
          minWidthClassName="min-w-0"
          isLoading={list.isFetching || options.isFetching}
          isEmpty={!list.data?.items.length}
          emptyText={
            list.isLoading
              ? 'Đang tải mẫu báo cáo...'
              : list.isError
                ? 'Chưa tải được mẫu báo cáo.'
                : keyword || service || category || active
                  ? 'Không có mẫu phù hợp với bộ lọc.'
                  : 'Chưa có mẫu báo cáo.'
          }
        >
          {list.data?.items.map((row) => (
            <tr key={row.id} className="group hover:bg-slate-50/80">
              <td className="px-3 py-4 align-top">
                <button
                  type="button"
                  onClick={() => setPreview(row)}
                  className="max-w-full rounded text-left font-semibold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  aria-label={`Xem mẫu ${row.title}`}
                >
                  <span className="line-clamp-2 break-words">{row.title}</span>
                </button>
                <p className="mt-1 line-clamp-2 break-words text-sm leading-5 text-slate-600">
                  {row.content}
                </p>
                <p className="mt-2 text-xs text-slate-500 lg:hidden">
                  {serviceLabel(row.service_id)} · {row.category}
                </p>
                <div className="mt-2 sm:hidden">{statusBadge(row)}</div>
              </td>
              <td className="hidden px-3 py-4 align-top text-slate-700 lg:table-cell">
                {serviceLabel(row.service_id)}
                <p className="mt-1 text-xs text-slate-500 xl:hidden">{row.category}</p>
              </td>
              <td className="hidden px-3 py-4 align-top text-slate-600 xl:table-cell">
                {row.category}
              </td>
              <td className="hidden px-3 py-4 text-center align-top tabular-nums text-slate-500 lg:table-cell">
                {row.sort_order}
              </td>
              <td className="hidden px-3 py-4 align-top sm:table-cell">{statusBadge(row)}</td>
              <td className="px-2 py-3 align-top">
                <div className="flex justify-end">
                  <IconButton
                    size="small"
                    className="!h-10 !w-10"
                    aria-label={`Chỉnh sửa mẫu ${row.title}`}
                    title="Chỉnh sửa"
                    onClick={() => open(row)}
                  >
                    <EditRoundedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    className="!h-10 !w-10"
                    aria-label={`Tác vụ mẫu ${row.title}`}
                    title="Tác vụ"
                    aria-haspopup="menu"
                    aria-expanded={menu?.row.id === row.id}
                    onClick={(e) => setMenu({ anchor: e.currentTarget, row })}
                  >
                    <MoreVertRoundedIcon fontSize="small" />
                  </IconButton>
                </div>
              </td>
            </tr>
          ))}
        </AppDataTable>
        <TablePaginationBar
          page={page}
          totalPages={list.data?.lastPage || 1}
          totalItems={list.data?.total || 0}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setPageSize(value);
            setPage(1);
          }}
          disabled={list.isFetching}
        />
      </section>
      <Menu
        anchorEl={menu?.anchor}
        open={Boolean(menu)}
        onClose={() => setMenu(null)}
        slotProps={{
          paper: { className: '!min-w-[180px] !rounded-xl !border !border-slate-200 !shadow-lg' },
        }}
      >
        <MenuItem
          onClick={() => {
            setPreview(menu!.row);
            setMenu(null);
          }}
        >
          <VisibilityRoundedIcon className="mr-2 !text-[18px] text-slate-500" />
          Xem nội dung
        </MenuItem>
        <MenuItem onClick={() => open(menu!.row)}>
          <EditRoundedIcon className="mr-2 !text-[18px] text-slate-500" />
          Chỉnh sửa
        </MenuItem>
        <MenuItem onClick={() => open(menu!.row, true)}>
          <ContentCopyRoundedIcon className="mr-2 !text-[18px] text-slate-500" />
          Nhân bản
        </MenuItem>
        <MenuItem
          disabled={toggle.isPending}
          onClick={() => {
            toggle.mutate(menu!.row);
            setMenu(null);
          }}
        >
          <PowerSettingsNewRoundedIcon className="mr-2 !text-[18px] text-slate-500" />
          {menu?.row.is_active ? 'Tắt mẫu' : 'Bật mẫu'}
        </MenuItem>
      </Menu>
      {preview && (
        <AppDetailDialog
          open
          title="Nội dung mẫu báo cáo"
          eyebrow={serviceLabel(preview.service_id)}
          subtitle={preview.category}
          maxWidth="sm"
          onClose={() => setPreview(null)}
          actions={
            <DialogActionButton
              onClick={() => open(preview)}
              startIcon={<EditRoundedIcon fontSize="small" />}
            >
              Chỉnh sửa
            </DialogActionButton>
          }
        >
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="min-w-0 break-words text-base font-semibold text-slate-950">
                {preview.title}
              </h2>
              {statusBadge(preview)}
            </div>
            {preview.usage_hint && (
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="mb-1 text-xs font-semibold text-slate-500">Dùng khi · Nội bộ</p>
                <p className="whitespace-pre-wrap break-words text-sm text-slate-700">
                  {preview.usage_hint}
                </p>
              </div>
            )}
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
              {preview.content}
            </p>
          </div>
        </AppDetailDialog>
      )}
      <AppFormDialog
        open={editor}
        onClose={close}
        title={existing ? 'Chỉnh sửa mẫu báo cáo' : 'Thêm mẫu báo cáo'}
        maxWidth="sm"
        submitting={save.isPending}
        onSubmit={(event) => {
          event.preventDefault();
          if (canSave) save.mutate();
        }}
        actions={
          <>
            <DialogActionButton disabled={save.isPending} onClick={close}>
              Hủy
            </DialogActionButton>
            <DialogActionButton type="submit" tone="primary" disabled={!canSave}>
              {save.isPending ? 'Đang lưu...' : 'Lưu mẫu'}
            </DialogActionButton>
          </>
        }
      >
        <div className="space-y-4">
          {error && <Alert severity="error">{error}</Alert>}
          <FormInputField
            autoFocus
            required
            label="Tên mẫu"
            value={draft.title}
            disabled={save.isPending}
            slotProps={{ htmlInput: { maxLength: 160 } }}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormInputField
              select
              label="Dịch vụ áp dụng"
              value={draft.service_id ?? 0}
              disabled={save.isPending || options.isLoading}
              onChange={(e) => setDraft({ ...draft, service_id: Number(e.target.value) || null })}
            >
              <MenuItem value={0}>Dùng chung</MenuItem>
              {draft.service_id &&
                !options.data?.services.some((s) => s.id === draft.service_id) && (
                  <MenuItem value={draft.service_id}>Dịch vụ đã ngừng sử dụng</MenuItem>
                )}
              {options.data?.services.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.code} - {s.name}
                </MenuItem>
              ))}
            </FormInputField>
            <Autocomplete
              freeSolo
              options={categories}
              inputValue={draft.category}
              onInputChange={(_, v) => setDraft((d) => ({ ...d, category: v }))}
              disabled={save.isPending}
              renderInput={(params) => (
                <FormInputField
                  {...params}
                  required
                  size="small"
                  label="Nhóm tình huống"
                  slotProps={{
                    ...params.slotProps,
                    htmlInput: { ...params.slotProps.htmlInput, maxLength: 100 },
                  }}
                />
              )}
            />
          </div>
          <FormInputField
            multiline
            minRows={2}
            label="Dùng khi (nội bộ)"
            value={draft.usage_hint || ''}
            disabled={save.isPending}
            slotProps={{ htmlInput: { maxLength: 2000 } }}
            onChange={(e) => setDraft({ ...draft, usage_hint: e.target.value })}
          />
          <FormInputField
            required
            multiline
            minRows={5}
            label="Nội dung gửi khách"
            value={draft.content}
            disabled={save.isPending}
            slotProps={{ htmlInput: { maxLength: 10000 } }}
            onChange={(e) => setDraft({ ...draft, content: e.target.value })}
          />
          <div className="flex items-center gap-5">
            <FormInputField
              type="number"
              label="Thứ tự"
              value={draft.sort_order}
              disabled={save.isPending}
              slotProps={{ htmlInput: { min: 0, max: 100000 } }}
              onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
            />
            <FormControlLabel
              className="shrink-0"
              control={
                <Switch
                  checked={draft.is_active}
                  disabled={save.isPending}
                  onChange={(_, v) => setDraft({ ...draft, is_active: v })}
                />
              }
              label="Bật mẫu"
            />
          </div>
        </div>
      </AppFormDialog>
      <ConfirmDialog
        open={discard}
        title="Bỏ thay đổi?"
        description="Những thay đổi chưa lưu của mẫu sẽ bị bỏ."
        confirmText="Bỏ thay đổi"
        onClose={() => setDiscard(false)}
        onConfirm={() => {
          setDiscard(false);
          setEditor(false);
        }}
      />
    </div>
  );
}

'use client';

import { useState, type MouseEvent } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import BalanceRoundedIcon from '@mui/icons-material/BalanceRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import PendingActionsRoundedIcon from '@mui/icons-material/PendingActionsRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import { Autocomplete, IconButton, Menu, MenuItem } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { SummaryMetricCard } from '@/components/data-display/summary-metric-card';
import { AppFormDialog } from '@/components/dialog/app-form-dialog';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { CompactAutocompleteField } from '@/components/form/compact-autocomplete-field';
import { CompactSelectField } from '@/components/form/compact-select-field';
import { FormDatePicker } from '@/components/form/form-date-picker';
import { FormInputField } from '@/components/form/form-input-field';
import { ListFilterBar } from '@/components/form/list-filter-bar';
import { ServerPaginatedAutocomplete } from '@/components/form/server-paginated-autocomplete';
import { IconTabs } from '@/components/navigation/icon-tabs';
import { PageHeader } from '@/components/shell/page-header';
import { AppDataTable } from '@/components/table/app-data-table';
import { EntityTableLink } from '@/components/table/entity-table-link';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { applyApiErrorsToForm } from '@/lib/api-error';
import { canApproveP2Point, canOpenP2CreateDialog } from '@/lib/ownership';
import { formatDate } from '@/lib/utils';
import type {
  P2Category,
  P2Point,
  P2PointFilters,
  P2PointFormValues,
  P2PointOverview,
  P2PointSummary,
} from '@/types/p2';
import type { ProjectItem } from '@/types/project';
import type { User } from '@/types/user';

function getDefaults(userId: string): P2PointFormValues {
  return {
    userId,
    projectId: '',
    entryDate: new Date().toISOString().slice(0, 10),
    category: '',
    score: '',
    note: '',
  };
}

function getProjectOptionLabel(project: ProjectItem) {
  const code = project.projectCode || `Dự án #${project.id}`;
  return project.projectName ? `${code} - ${project.projectName}` : code;
}

function formatScore(value: number) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(Math.abs(value));
}

function P2Dialog({
  open,
  users,
  categories,
  defaultUserId,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  users: User[];
  categories: P2Category[];
  defaultUserId: string;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: P2PointFormValues) => Promise<unknown>;
}) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors },
  } = useForm<P2PointFormValues>({ values: getDefaults(defaultUserId) });
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);

  const closeDialog = () => {
    reset();
    setSelectedProject(null);
    onClose();
  };

  return (
    <AppFormDialog
      open={open}
      title="Ghi nhận điểm P2"
      maxWidth="sm"
      submitting={isSubmitting}
      onClose={closeDialog}
      onSubmit={handleSubmit(async (values) => {
        try {
          await onSubmit(values);
          closeDialog();
        } catch (error) {
          applyApiErrorsToForm(error, setError);
        }
      })}
      actions={
        <>
          <DialogActionButton disabled={isSubmitting} onClick={closeDialog}>
            Hủy
          </DialogActionButton>
          <DialogActionButton type="submit" tone="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Đang lưu...' : 'Lưu điểm P2'}
          </DialogActionButton>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Controller
          name="userId"
          control={control}
          rules={{ required: 'Vui lòng chọn nhân viên' }}
          render={({ field }) => (
            <Autocomplete
              className="md:col-span-2"
              options={users}
              value={users.find((user) => String(user.id) === field.value) || null}
              onChange={(_, value) => field.onChange(value ? String(value.id) : '')}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              noOptionsText="Không tìm thấy nhân viên"
              renderInput={(params) => (
                <FormInputField
                  {...params}
                  required
                  label="Nhân viên"
                  error={Boolean(errors.userId)}
                  helperText={errors.userId?.message}
                />
              )}
            />
          )}
        />

        <Controller
          name="projectId"
          control={control}
          render={({ field }) => (
            <ServerPaginatedAutocomplete<ProjectItem>
              className="md:col-span-2"
              endpoint="/projects"
              queryKey={['projects', 'p2-dialog-options']}
              label="Dự án"
              value={selectedProject}
              placeholder="Nhập mã hoặc tên dự án"
              getOptionLabel={getProjectOptionLabel}
              onChange={(project) => {
                setSelectedProject(project);
                field.onChange(project ? String(project.id) : '');
              }}
            />
          )}
        />

        <Controller
          name="category"
          control={control}
          rules={{ required: 'Vui lòng chọn hạng mục' }}
          render={({ field }) => (
            <Autocomplete
              className="md:col-span-2"
              options={categories}
              value={categories.find((category) => category.key === field.value) || null}
              getOptionLabel={(category) => category.label}
              isOptionEqualToValue={(category, selected) => category.key === selected.key}
              groupBy={(category) => (category.type === 'bonus' ? 'Thành tích' : 'Lỗi')}
              noOptionsText="Không tìm thấy hạng mục"
              onChange={(_, category) => {
                field.onChange(category?.key || '');
                setValue('score', category ? String(category.defaultScore) : '');
              }}
              renderOption={(props, category) => (
                <li {...props} key={category.key} className={`${props.className || ''} !gap-3`}>
                  <span className="min-w-0 flex-1 truncate">{category.label}</span>
                  <span
                    className={`shrink-0 text-xs font-bold tabular-nums ${
                      category.type === 'bonus' ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {category.defaultScore > 0 ? '+' : ''}
                    {category.defaultScore}
                  </span>
                </li>
              )}
              renderInput={(params) => (
                <FormInputField
                  {...params}
                  required
                  label="Lỗi / Thành tích"
                  placeholder="Nhập tên hạng mục để tìm"
                  error={Boolean(errors.category)}
                  helperText={errors.category?.message}
                />
              )}
            />
          )}
        />

        <FormInputField
          required
          type="number"
          label="Điểm số"
          className="[&_.MuiInputBase-root]:bg-slate-50"
          error={Boolean(errors.score)}
          helperText={errors.score?.message}
          slotProps={{ input: { readOnly: true }, htmlInput: { step: 0.5 } }}
          {...register('score', { required: 'Vui lòng nhập điểm số' })}
        />

        <Controller
          name="entryDate"
          control={control}
          rules={{ required: 'Vui lòng chọn ngày ghi nhận' }}
          render={({ field }) => (
            <FormDatePicker
              required
              label="Ngày ghi nhận"
              value={field.value}
              error={Boolean(errors.entryDate)}
              helperText={errors.entryDate?.message}
              onChange={field.onChange}
            />
          )}
        />

        <FormInputField
          multiline
          minRows={2}
          label="Ghi chú / Minh chứng"
          className="md:col-span-2"
          {...register('note')}
        />
      </div>
    </AppFormDialog>
  );
}

export function P2Manager({
  points,
  summary,
  overview,
  users,
  categories,
  filters,
  isFetching,
  isSaving,
  isDeleting,
  isApproving,
  currentUser,
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onFiltersChange,
  onSave,
  onDelete,
  onApprove,
}: {
  points: P2Point[];
  summary: P2PointSummary[];
  overview: P2PointOverview;
  users: User[];
  categories: P2Category[];
  filters: P2PointFilters;
  isFetching: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  isApproving: boolean;
  currentUser: User | null;
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onFiltersChange: (filters: P2PointFilters) => void;
  onSave: (values: P2PointFormValues) => Promise<unknown>;
  onDelete: (point: P2Point) => void;
  onApprove: (point: P2Point) => void;
}) {
  const [activeTab, setActiveTab] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [activePoint, setActivePoint] = useState<P2Point | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<P2Point | null>(null);

  const updateFilters = (next: Partial<P2PointFilters>) => {
    onFiltersChange({ ...filters, ...next });
  };

  const openActionMenu = (event: MouseEvent<HTMLButtonElement>, point: P2Point) => {
    setMenuAnchorEl(event.currentTarget);
    setActivePoint(point);
  };

  const closeActionMenu = () => {
    setMenuAnchorEl(null);
    setActivePoint(null);
  };

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <PageHeader
        title="Điểm P2 nhân viên"
        action={{
          label: 'Ghi nhận điểm P2',
          icon: <AddRoundedIcon />,
          onClick: () => setDialogOpen(true),
          disabled: !canOpenP2CreateDialog(currentUser),
        }}
      />

      <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetricCard
          label="Tổng điểm cộng"
          helper="Điểm thành tích đã duyệt"
          value={`${overview.bonusScore !== 0 ? '+' : ''}${formatScore(overview.bonusScore)}`}
          tone="emerald"
          icon={<TrendingUpRoundedIcon />}
        />
        <SummaryMetricCard
          label="Tổng điểm trừ"
          helper="Điểm lỗi đã được duyệt"
          value={`${overview.penaltyScore !== 0 ? '−' : ''}${formatScore(overview.penaltyScore)}`}
          tone="rose"
          icon={<TrendingDownRoundedIcon />}
        />
        <SummaryMetricCard
          label="Điểm thực nhận"
          helper="Điểm cộng trừ sau duyệt"
          value={`${overview.netScore > 0 ? '+' : overview.netScore < 0 ? '−' : ''}${formatScore(overview.netScore)}`}
          tone={overview.netScore < 0 ? 'rose' : 'blue'}
          valueClassName={overview.netScore < 0 ? 'text-rose-700' : 'text-slate-950'}
          icon={<BalanceRoundedIcon />}
        />
        <SummaryMetricCard
          label="Mục chờ duyệt"
          helper="Bản ghi cần được xử lý"
          value={overview.pendingCount}
          tone="amber"
          icon={<PendingActionsRoundedIcon />}
        />
      </section>

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <IconTabs
          value={activeTab}
          ariaLabel="Nội dung điểm P2"
          onChange={setActiveTab}
          items={[
            { label: 'Tổng quan nhân sự', icon: <EmojiEventsOutlinedIcon fontSize="small" /> },
            { label: 'Lịch sử ghi nhận', icon: <HistoryRoundedIcon fontSize="small" /> },
          ]}
        />

        <ListFilterBar className="p-4">
          <FormDatePicker
            label="Ngày bắt đầu"
            value={filters.dateFrom}
            max={filters.dateTo || undefined}
            onChange={(dateFrom) => updateFilters({ dateFrom })}
          />
          <FormDatePicker
            label="Ngày kết thúc"
            value={filters.dateTo}
            min={filters.dateFrom || undefined}
            onChange={(dateTo) => updateFilters({ dateTo })}
          />
          <CompactAutocompleteField
            label="Nhân viên"
            value={filters.userId}
            allLabel="Tất cả nhân viên"
            options={users.map((user) => ({ value: String(user.id), label: user.name }))}
            onChange={(userId) => updateFilters({ userId })}
          />
          <CompactAutocompleteField
            label="Hạng mục P2"
            value={filters.category}
            allLabel="Tất cả hạng mục"
            options={categories.map((category) => ({
              value: category.key,
              label: category.label,
            }))}
            onChange={(category) => updateFilters({ category })}
          />
          <CompactSelectField
            label="Loại"
            value={filters.type}
            options={[
              { value: 'bonus', label: 'Thành tích' },
              { value: 'penalty', label: 'Lỗi' },
            ]}
            onChange={(type) => updateFilters({ type })}
          />
          <CompactSelectField
            label="Trạng thái"
            value={filters.approvalStatus}
            options={[
              { value: 'pending', label: 'Chờ duyệt' },
              { value: 'approved', label: 'Đã duyệt' },
            ]}
            onChange={(approvalStatus) => updateFilters({ approvalStatus })}
          />
        </ListFilterBar>

        {activeTab === 0 ? (
          <AppDataTable
            columns={[
              { key: 'rank', label: 'Hạng', className: 'w-[80px] text-center' },
              { key: 'user', label: 'Nhân viên', className: 'w-[260px]' },
              { key: 'bonus', label: 'Thành tích', className: 'w-[140px] text-right' },
              { key: 'penalty', label: 'Lỗi', className: 'w-[140px] text-right' },
              { key: 'total', label: 'Tổng điểm', className: 'w-[140px] text-right' },
              { key: 'count', label: 'Số ghi nhận', className: 'w-[140px] text-center' },
              { key: 'pending', label: 'Chờ duyệt', className: 'w-[130px] text-center' },
            ]}
            isLoading={isFetching}
            isEmpty={summary.length === 0}
            emptyText="Chưa có dữ liệu P2 trong kỳ"
            minWidthClassName="min-w-[1030px]"
          >
            {summary.map((row, index) => (
              <tr key={row.userId} className="hover:bg-slate-50/80">
                <td className="px-3 py-3.5 text-center">
                  <span
                    className={`inline-grid size-7 place-items-center rounded-full text-xs font-extrabold ${
                      index === 0
                        ? 'bg-amber-100 text-amber-700'
                        : index === 1
                          ? 'bg-slate-200 text-slate-700'
                          : index === 2
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {index + 1}
                  </span>
                </td>
                <td className="px-3 py-3.5">
                  <div className="flex min-w-0 items-center gap-2">
                    {row.code && (
                      <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                        {row.code}
                      </span>
                    )}
                    <span className="truncate font-bold text-slate-900" title={row.name}>
                      {row.name}
                    </span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-3.5 text-right font-extrabold tabular-nums text-emerald-700">
                  +{formatScore(row.bonusScore)}
                </td>
                <td className="whitespace-nowrap px-3 py-3.5 text-right font-extrabold tabular-nums text-rose-700">
                  −{formatScore(row.penaltyScore)}
                </td>
                <td
                  className={`whitespace-nowrap px-3 py-3.5 text-right font-extrabold tabular-nums ${row.total >= 0 ? 'text-blue-700' : 'text-rose-700'}`}
                >
                  {row.total > 0 ? '+' : row.total < 0 ? '−' : ''}
                  {formatScore(row.total)}
                </td>
                <td className="px-3 py-3.5 text-center font-bold tabular-nums text-slate-700">
                  {row.count}
                </td>
                <td className="px-3 py-3.5 text-center">
                  <span
                    className={`inline-flex min-w-7 justify-center rounded-full px-2 py-1 text-xs font-bold ${
                      row.pendingCount > 0
                        ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {row.pendingCount}
                  </span>
                </td>
              </tr>
            ))}
          </AppDataTable>
        ) : (
          <>
            <AppDataTable
              columns={[
                { key: 'date', label: 'Ngày', className: 'w-[120px]' },
                { key: 'user', label: 'Nhân viên', className: 'w-[190px]' },
                { key: 'project', label: 'Dự án', className: 'w-[200px]' },
                { key: 'category', label: 'Hạng mục', className: 'w-[330px]' },
                { key: 'score', label: 'Điểm', className: 'w-[100px] text-right' },
                { key: 'approval', label: 'Trạng thái duyệt', className: 'w-[150px]' },
                { key: 'note', label: 'Ghi chú', className: 'w-[260px]' },
                { key: 'actions', className: 'w-[56px]' },
              ]}
              isLoading={isFetching}
              isEmpty={points.length === 0}
              emptyText="Chưa có lịch sử ghi nhận P2"
              minWidthClassName="min-w-[1406px]"
            >
              {points.map((point) => {
                const score = Number(point.score) || 0;

                return (
                  <tr key={point.id} className="hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-3 py-3.5 font-semibold text-slate-800">
                      {formatDate(point.entryDate)}
                    </td>
                    <td className="truncate px-3 py-3.5 font-bold text-slate-900">
                      {point.user?.name || '-'}
                    </td>
                    <td className="px-3 py-3.5">
                      {point.project ? (
                        <EntityTableLink
                          href={`/projects/${point.project.id}`}
                          title={point.project.projectCode || ''}
                          tone="blue"
                        >
                          {point.project.projectCode || '-'}
                        </EntityTableLink>
                      ) : (
                        <span className="text-slate-400">Chưa gắn dự án</span>
                      )}
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ring-1 ${
                            point.type === 'bonus'
                              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                              : 'bg-rose-50 text-rose-700 ring-rose-200'
                          }`}
                        >
                          {point.type === 'bonus' ? 'Thành tích' : 'Lỗi'}
                        </span>
                        <span
                          className="min-w-0 truncate font-medium text-slate-700"
                          title={point.categoryLabel || point.category}
                        >
                          {point.categoryLabel || point.category}
                        </span>
                      </div>
                    </td>
                    <td
                      className={`whitespace-nowrap px-3 py-3.5 text-right font-extrabold tabular-nums ${
                        score >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {score > 0 ? '+' : score < 0 ? '−' : ''}
                      {formatScore(score)}
                    </td>
                    <td className="px-3 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ring-1 ${
                          point.isApproved
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                            : 'bg-amber-50 text-amber-700 ring-amber-200'
                        }`}
                      >
                        {point.isApproved ? 'Đã duyệt' : 'Chờ duyệt'}
                      </span>
                    </td>
                    <td
                      className="truncate px-3 py-3.5 text-slate-600"
                      title={point.note || undefined}
                    >
                      {point.note || '-'}
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <IconButton
                        size="small"
                        title="Tác vụ"
                        aria-label={`Tác vụ P2 của ${point.user?.name || 'nhân viên'}`}
                        onClick={(event) => openActionMenu(event, point)}
                      >
                        <MoreVertRoundedIcon fontSize="small" />
                      </IconButton>
                    </td>
                  </tr>
                );
              })}
            </AppDataTable>

            <TablePaginationBar
              page={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
            />
          </>
        )}
      </section>

      <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={closeActionMenu}>
        {activePoint && !activePoint.isApproved && canApproveP2Point(currentUser, activePoint) && (
          <MenuItem
            disabled={isApproving}
            onClick={() => {
              onApprove(activePoint);
              closeActionMenu();
            }}
          >
            <CheckCircleOutlineRoundedIcon fontSize="small" className="mr-2 text-emerald-600" />
            Duyệt điểm P2
          </MenuItem>
        )}
        {activePoint?.canDelete ? (
          <MenuItem
            className="text-rose-600"
            disabled={isDeleting}
            onClick={() => {
              setDeleteTarget(activePoint);
              closeActionMenu();
            }}
          >
            <DeleteOutlineRoundedIcon fontSize="small" className="mr-2" />
            Xóa
          </MenuItem>
        ) : null}
      </Menu>

      <P2Dialog
        open={dialogOpen}
        users={users}
        categories={categories}
        defaultUserId={filters.userId}
        isSubmitting={isSaving}
        onClose={() => setDialogOpen(false)}
        onSubmit={onSave}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa điểm P2?"
        description="Điểm P2 này sẽ bị xóa vĩnh viễn."
        confirmText="Xóa"
        loading={isDeleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) onDelete(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

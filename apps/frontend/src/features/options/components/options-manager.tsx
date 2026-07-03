'use client';

import { useMemo, useState } from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Switch,
  Tab,
  Tabs,
  TextField,
} from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import {
  OPTION_SECTIONS,
  getOptionColor,
  getOptionDefaults,
  groupOptions,
} from '@/lib/option-utils';
import type { AppOption, OptionFormValues, OptionGroupConfig } from '@/types/option';

type OptionsManagerProps = {
  options: AppOption[];
  isFetching: boolean;
  isSubmitting: boolean;
  isDeleting: boolean;
  savingGroup: string | null;
  reorderingGroup: string | null;
  onSubmit: (values: OptionFormValues, option?: AppOption | null) => Promise<unknown>;
  onDelete: (option: AppOption) => void;
  onReorder: (group: string, options: AppOption[]) => void;
};

type DialogState =
  | { mode: 'create'; group: OptionGroupConfig; option?: null }
  | { mode: 'edit'; group: OptionGroupConfig; option: AppOption };

function OptionDialog({
  state,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  state: DialogState | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: OptionFormValues, option?: AppOption | null) => Promise<unknown>;
}) {
  const option = state?.mode === 'edit' ? state.option : null;
  const group = state?.group;
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OptionFormValues>({
    values: getOptionDefaults(group?.group || 'lead_status', option),
  });

  const closeDialog = () => {
    reset();
    onClose();
  };

  return (
    <Dialog
      open={Boolean(state)}
      onClose={isSubmitting ? undefined : closeDialog}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle className="border-b border-slate-100 px-6 py-5">
        <p className="text-lg font-bold text-slate-950">
          {state?.mode === 'edit' ? 'Chỉnh sửa option' : 'Thêm option'}
        </p>
        <p className="mt-1 text-sm text-slate-500">{group?.title}</p>
      </DialogTitle>

      <form
        onSubmit={handleSubmit(async (values) => {
          await onSubmit(values, option);
          closeDialog();
        })}
      >
        <DialogContent className="grid gap-4 px-6 py-5">
          <input type="hidden" {...register('group')} />
          <input type="hidden" {...register('sortOrder', { valueAsNumber: true })} />
          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <TextField
              fullWidth
              label="Tên hiển thị *"
              error={Boolean(errors.label)}
              helperText={errors.label?.message}
              {...register('label', { required: 'Bắt buộc' })}
            />
            <TextField fullWidth type="color" label="Màu" {...register('color')} />
          </div>

          <Controller
            name="isActive"
            control={control}
            render={({ field }) => (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                <p className="font-bold text-slate-950">Hoạt động</p>
                <Switch
                  checked={field.value}
                  onChange={(event) => field.onChange(event.target.checked)}
                />
              </div>
            )}
          />
        </DialogContent>

        <DialogActions className="border-t border-slate-100 px-6 py-4">
          <Button variant="outlined" onClick={closeDialog} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting}
            className="!bg-slate-900 hover:!bg-slate-800"
          >
            {isSubmitting ? 'Đang lưu...' : state?.mode === 'edit' ? 'Lưu thay đổi' : 'Tạo option'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function SortableOptionCard({
  option,
  group,
  isReordering,
  onEdit,
  onDelete,
}: {
  option: AppOption;
  group: OptionGroupConfig;
  isReordering: boolean;
  onEdit: (group: OptionGroupConfig, option: AppOption) => void;
  onDelete: (option: AppOption) => void;
}) {
  const color = getOptionColor(option);
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: option.id, disabled: isReordering });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`rounded-lg border bg-white px-3 py-2.5 shadow-sm transition ${
        isDragging
          ? 'z-10 border-primary/40 opacity-80 shadow-lg ring-2 ring-primary/10'
          : 'border-slate-100 hover:border-primary/20'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />

            <p className="truncate font-semibold text-slate-900" title={option.label}>
              {option.label}
            </p>

            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                option.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {option.isActive ? 'Hoạt động' : 'Tạm tắt'}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center">
          <IconButton
            size="small"
            title="Chỉnh sửa"
            className="!h-8 !w-8"
            disabled={isReordering}
            onClick={() => onEdit(group, option)}
          >
            <EditRoundedIcon fontSize="small" />
          </IconButton>

          <IconButton
            size="small"
            title="Xóa"
            className="!h-8 !w-8 hover:text-rose-600"
            disabled={isReordering}
            onClick={() => onDelete(option)}
          >
            <DeleteRoundedIcon fontSize="small" />
          </IconButton>

          <button
            ref={setActivatorNodeRef}
            type="button"
            title="Kéo để sắp xếp"
            disabled={isReordering}
            className={`inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing ${
              isReordering ? 'cursor-not-allowed opacity-40' : ''
            }`}
            {...attributes}
            {...listeners}
          >
            <DragIndicatorRoundedIcon fontSize="small" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function OptionsManager({
  options,
  isFetching,
  isSubmitting,
  isDeleting,
  savingGroup,
  reorderingGroup,
  onSubmit,
  onDelete,
  onReorder,
}: OptionsManagerProps) {
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppOption | null>(null);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const groupedOptions = useMemo(() => groupOptions(options), [options]);
  const activeSection = OPTION_SECTIONS[activeSectionIndex] || OPTION_SECTIONS[0];
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (group: string, groupItems: AppOption[], event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || reorderingGroup === group || savingGroup === group)
      return;

    const fromIndex = groupItems.findIndex((option) => option.id === active.id);
    const toIndex = groupItems.findIndex((option) => option.id === over.id);

    if (fromIndex < 0 || toIndex < 0) return;

    const reordered = [...groupItems];
    const [movedOption] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, movedOption);
    onReorder(group, reordered);
  };

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-950">Danh mục hệ thống</h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
          <span>Dashboard</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>Thiết lập hệ thống</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span className="text-slate-950">Danh mục</span>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={activeSectionIndex}
            onChange={(_, nextValue) => setActiveSectionIndex(nextValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {OPTION_SECTIONS.map((section) => (
              <Tab key={section.title} label={section.title} />
            ))}
          </Tabs>

          {isFetching && (
            <span className="pb-3 text-sm font-semibold text-primary sm:pb-0">Đang tải...</span>
          )}
        </div>

        <div className="p-5">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-slate-950">{activeSection.title}</h2>
          </div>

          <div className="grid gap-5 xl:grid-cols-4">
            {activeSection.groups.map((group) => {
              const groupItems = groupedOptions[group.group] || [];
              const isGroupReordering = reorderingGroup === group.group;
              const isGroupSaving = savingGroup === group.group;
              const isGroupLoading = isGroupReordering || isGroupSaving;
              const loadingText = isGroupReordering ? 'Đang lưu thứ tự' : 'Đang cập nhật';

              return (
                <div
                  key={group.group}
                  className={`relative overflow-hidden rounded-xl bg-slate-50 p-4 transition ${
                    isGroupLoading ? 'ring-2 ring-primary/20' : ''
                  }`}
                >
                  {isGroupLoading && (
                    <div className="x3-option-box-loader absolute inset-x-0 top-0">
                      <span />
                    </div>
                  )}
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-white px-2 text-sm font-black text-slate-700 shadow-sm">
                        {groupItems.length}
                      </span>
                      <div>
                        <h3 className="font-bold text-slate-950">{group.title}</h3>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {isGroupLoading && (
                        <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                          {loadingText}
                        </span>
                      )}
                      <IconButton
                        size="small"
                        title="Thêm option"
                        disabled={isGroupLoading}
                        onClick={() => setDialogState({ mode: 'create', group })}
                      >
                        <AddRoundedIcon fontSize="small" />
                      </IconButton>
                    </div>
                  </div>

                  {groupItems.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm font-semibold text-slate-400">
                      Chưa có option
                    </div>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event) => handleDragEnd(group.group, groupItems, event)}
                    >
                      <SortableContext
                        items={groupItems.map((option) => option.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2">
                          {groupItems.map((option) => (
                            <SortableOptionCard
                              key={option.id}
                              option={option}
                              group={group}
                              isReordering={isGroupLoading}
                              onEdit={(editGroup, editOption) =>
                                setDialogState({
                                  mode: 'edit',
                                  group: editGroup,
                                  option: editOption,
                                })
                              }
                              onDelete={setDeleteTarget}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                  {isGroupLoading && (
                    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-white/65 backdrop-blur-[1px]">
                      <div className="flex items-center gap-2 rounded-lg border border-primary/10 bg-white px-3 py-2 text-sm font-bold text-primary shadow-lg shadow-slate-200/70">
                        <span className="x3-option-box-spinner" />
                        {loadingText}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <OptionDialog
        state={dialogState}
        isSubmitting={isSubmitting}
        onClose={() => setDialogState(null)}
        onSubmit={onSubmit}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa option?"
        description={`Bạn có chắc muốn xóa "${deleteTarget?.label || ''}"? Nếu option đang được dùng, backend sẽ không cho xóa.`}
        confirmText="Xóa option"
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

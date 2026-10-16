'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, LinearProgress } from '@mui/material';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CompactSelectField } from '@/components/form/compact-select-field';
import { CompactSearchField } from '@/components/form/compact-search-field';
import { ListFilterBar } from '@/components/form/list-filter-bar';
import { AppFormDialog } from '@/components/dialog/app-form-dialog';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { getApiErrorMessage } from '@/lib/api-error';
import { useAuthStore } from '@/stores/auth-store';
import api from '@/services/api/client';
import { templateList, templateOptions, type ReportTemplate } from '../templates';

export function ReportTemplatePicker({
  open,
  onClose,
  onInsert,
  serviceId,
}: {
  open: boolean;
  onClose: () => void;
  onInsert: (texts: string[]) => void;
  serviceId?: number;
}) {
  const user = useAuthStore((s) => s.user);
  const [search, setSearch] = useState('');
  const [keyword, setKeyword] = useState('');
  const [service, setService] = useState(serviceId ? String(serviceId) : '');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<number | null>(null);
  useEffect(() => {
    if (open) {
      setService(serviceId ? String(serviceId) : '');
      setSearch('');
      setKeyword('');
      setCategory('');
      setPage(1);
      setSelected([]);
      setError('');
      setCopied(null);
    }
  }, [open, serviceId]);
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
    enabled: open,
    staleTime: 60000,
  });
  const list = useQuery({
    queryKey: ['report-templates', user?.id, 'picker', keyword, service, category, page, pageSize],
    queryFn: ({ signal }) =>
      templateList(
        {
          search: keyword,
          ...(service ? { service_id: service } : {}),
          ...(category ? { category } : {}),
          page,
          per_page: pageSize,
        },
        signal,
      ),
    enabled: open,
    staleTime: 0,
  });
  const insert = useMutation({
    mutationFn: (ids: number[]) =>
      api.post<ReportTemplate[]>('/weekly-report-templates/selection', { ids }).then((r) => r.data),
    onSuccess: (rows) => {
      onInsert(rows.map((r) => r.content));
      onClose();
    },
    onError: (e) => setError(getApiErrorMessage(e, 'Chưa lấy được nội dung mẫu.')),
  });
  async function copy(row: ReportTemplate) {
    try {
      const { data } = await api.post<ReportTemplate[]>('/weekly-report-templates/selection', {
        ids: [row.id],
      });
      await navigator.clipboard.writeText(data[0].content);
      setCopied(row.id);
      setError('');
    } catch (e) {
      setError(
        getApiErrorMessage(
          e,
          'Không sao chép được. Anh/chị có thể chọn đoạn nội dung để sao chép.',
        ),
      );
    }
  }
  function toggle(id: number) {
    setSelected((values) =>
      values.includes(id)
        ? values.filter((v) => v !== id)
        : values.length < 20
          ? [...values, id]
          : values,
    );
  }
  return (
    <AppFormDialog
      open={open}
      title="Gợi ý nội dung"
      maxWidth="md"
      onClose={onClose}
      submitting={insert.isPending}
      onSubmit={(event) => {
        event.preventDefault();
        if (selected.length && !insert.isPending) {
          setError('');
          insert.mutate(selected);
        }
      }}
      actions={
        <>
          <DialogActionButton
            onClick={() => setSelected([])}
            disabled={!selected.length || insert.isPending}
          >
            Bỏ chọn ({selected.length})
          </DialogActionButton>
          <DialogActionButton
            type="submit"
            tone="primary"
            disabled={!selected.length || insert.isPending}
          >
            {insert.isPending ? 'Đang lấy nội dung…' : `Chèn ${selected.length || ''} mẫu`}
          </DialogActionButton>
        </>
      }
    >
      <ListFilterBar className="mb-4" role="region" aria-label="Bộ lọc mẫu gợi ý">
        <CompactSearchField
          label="Tìm kiếm"
          placeholder="Tình huống hoặc nội dung..."
          value={search}
          onChange={(value) => {
            setSearch(value);
            setSelected([]);
          }}
        />
        <CompactSelectField
          label="Dịch vụ"
          value={service}
          onChange={(v) => {
            setService(v);
            setPage(1);
            setSelected([]);
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
            setSelected([]);
          }}
          options={(options.data?.categories || []).map((c) => ({ value: c, label: c }))}
        />
      </ListFilterBar>
      {(list.isFetching || options.isFetching) && <LinearProgress />}
      <div>
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
            Chưa tải được mẫu gợi ý.
          </Alert>
        )}
        {error && (
          <Alert className="!mb-3" severity="error" onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        {!list.isLoading && !list.isError && !list.data?.items.length && (
          <div className="py-12 text-center text-sm text-slate-500">
            Không có mẫu phù hợp. Admin có thể thêm mẫu trong Cài đặt → Mẫu báo cáo tuần.
          </div>
        )}
        <div className="space-y-3">
          {list.data?.items.map((row) => (
            <article
              key={row.id}
              className={`rounded-xl border bg-white p-4 ${selected.includes(row.id) ? 'border-primary ring-1 ring-primary' : 'border-slate-200'}`}
            >
              <div className="flex items-start gap-2">
                <Checkbox
                  checked={selected.includes(row.id)}
                  onChange={() => toggle(row.id)}
                  disabled={
                    insert.isPending || (!selected.includes(row.id) && selected.length >= 20)
                  }
                  slotProps={{ input: { 'aria-label': `Chọn mẫu ${row.title}` } }}
                  className="!h-11 !w-11 !-ml-2 !-mt-2"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="break-words text-base font-semibold text-slate-900">
                    {row.title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {row.category} ·{' '}
                    {row.service_id
                      ? options.data?.services.find((s) => s.id === row.service_id)?.name ||
                        'Theo dịch vụ'
                      : 'Dùng chung'}
                  </p>
                </div>
              </div>
              {row.usage_hint && (
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  <span className="font-medium">Dùng khi: </span>
                  {row.usage_hint}
                </p>
              )}
              <p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-800">
                {row.content}
              </p>
              <div className="mt-2 flex justify-end gap-2">
                <Button
                  className="!min-h-11"
                  startIcon={<ContentCopyRoundedIcon />}
                  onClick={() => void copy(row)}
                  disabled={insert.isPending}
                >
                  {copied === row.id ? 'Đã sao chép' : 'Sao chép'}
                </Button>
                <Button
                  className="!min-h-11"
                  onClick={() => {
                    setError('');
                    insert.mutate([row.id]);
                  }}
                  disabled={insert.isPending}
                >
                  Chèn mẫu
                </Button>
              </div>
            </article>
          ))}
        </div>
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
      </div>
    </AppFormDialog>
  );
}

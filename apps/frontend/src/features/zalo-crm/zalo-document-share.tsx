'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  MenuItem,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppFormDialog } from '@/components/dialog/app-form-dialog';
import { FormInputField } from '@/components/form/form-input-field';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { getApiErrorMessage } from '@/lib/api-error';
import { createElementDocument } from '@/lib/download-element-pdf';
import api from '@/services/api/client';

const base = '/zalo-team/documents';
type Destination = {
  accountId: number;
  accountName: string;
  name: string;
  peer: string;
  avatar?: string;
  globalId: string;
};
type Binding = {
  mode: 'disabled' | 'own' | 'inherit';
  revision: number;
  destination: Destination | null;
  canEdit: boolean;
  canInherit: boolean;
};
type Delivery = {
  canAct: boolean;
  id: string;
  state: string;
  issue?: string;
  actor: string;
  at: string;
  filename: string;
  destination: Destination;
  parts: { kind: string; state: string }[];
};
type Context = {
  title: string;
  version: string;
  eligible: boolean;
  parentKind: 'project' | 'customer';
  parentId: number;
  destination: Destination | null;
  destinationVersion: string | null;
  history: Delivery[];
};
const queryOptions = { staleTime: 30_000, retry: false as const, refetchOnWindowFocus: false };
const states: Record<string, string> = {
  queued: 'Chờ gửi',
  working: 'Đang gửi',
  sent: 'Đã gửi',
  failed: 'Cần xử lý',
  unknown: 'Chưa xác nhận',
  cancelled: 'Đã hủy',
};

function DestinationView({ value }: { value: Destination }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ minWidth: 0, alignItems: 'center' }}>
      <Avatar src={value.avatar} sx={{ width: 40, height: 40 }}>
        {value.name.slice(0, 1)}
      </Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{value.name}</Typography>
        <Typography variant="body2" color="text.secondary">
          Gửi bằng {value.accountName}
        </Typography>
      </Box>
    </Stack>
  );
}

export function ZaloRouteButton({
  kind,
  id,
  onSaved,
}: {
  kind: 'project' | 'customer';
  id: string | number;
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <DialogActionButton startIcon={<LinkOutlinedIcon />} onClick={() => setOpen(true)}>
        Nhóm Zalo nhận tài liệu
      </DialogActionButton>
      {open && (
        <RouteDialog
          kind={kind}
          id={id}
          onClose={() => setOpen(false)}
          onSaved={() => {
            onSaved?.();
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function RouteDialog({
  kind,
  id,
  onClose,
  onSaved,
}: {
  kind: 'project' | 'customer';
  id: string | number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const binding = useQuery<Binding>({
    queryKey: ['zalo-document-route', kind, id],
    queryFn: ({ signal }) =>
      api.get(`${base}/binding/${kind}/${id}`, { signal }).then((r) => r.data),
    ...queryOptions,
    staleTime: 0,
  });
  const accounts = useQuery<{ id: number; name: string }[]>({
    queryKey: ['zalo-document-accounts'],
    queryFn: ({ signal }) => api.get(`${base}/accounts`, { signal }).then((r) => r.data),
    ...queryOptions,
    enabled: !!binding.data?.canEdit,
  });
  const [mode, setMode] = useState<Binding['mode']>('disabled');
  const [account, setAccount] = useState<number | ''>('');
  const [peer, setPeer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (binding.data) {
      setMode(binding.data.mode);
      setAccount(binding.data.destination?.accountId ?? '');
      setPeer(binding.data.destination?.peer ?? '');
    }
  }, [binding.data]);
  const groups = useQuery<{ peer: string; name: string; avatar?: string }[]>({
    queryKey: ['zalo-document-groups', account],
    queryFn: ({ signal }) => api.get(`${base}/groups/${account}`, { signal }).then((r) => r.data),
    enabled: mode === 'own' && !!account && !!binding.data?.canEdit,
    ...queryOptions,
  });
  async function save() {
    if (!binding.data || busy) return;
    setBusy(true);
    setError('');
    try {
      await api.put(`${base}/binding/${kind}/${id}`, {
        mode,
        accountId: account || null,
        peer: peer || null,
        revision: binding.data.revision,
      });
      await queryClient.invalidateQueries({ queryKey: ['zalo-document-route', kind, id] });
      await queryClient.invalidateQueries({ queryKey: ['zalo-document-context'] });
      onSaved();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <AppFormDialog
      open
      title="Nhóm Zalo nhận tài liệu"
      maxWidth="sm"
      submitting={busy}
      onClose={onClose}
      onSubmit={(event) => event.preventDefault()}
      actions={
        <>
          <DialogActionButton onClick={onClose} disabled={busy}>
            Đóng
          </DialogActionButton>
          {binding.data?.canEdit && (
            <DialogActionButton
              tone="primary"
              onClick={() => void save()}
              disabled={busy || (mode === 'own' && (!peer || !account || groups.isFetching))}
            >
              {busy ? 'Đang lưu…' : 'Lưu liên kết'}
            </DialogActionButton>
          )}
        </>
      }
    >
      <Stack spacing={2.5}>
        {binding.isPending && <CircularProgress size={24} />}
        {(error || binding.error || groups.error || accounts.error) && (
          <Alert severity="error">
            {error || getApiErrorMessage(binding.error || groups.error || accounts.error)}
            <Button
              size="small"
              onClick={() => {
                void binding.refetch();
                if (binding.data?.canEdit) void accounts.refetch();
                if (account) void groups.refetch();
              }}
            >
              Tải lại
            </Button>
          </Alert>
        )}
        {binding.data && (
          <>
            <FormInputField
              select
              size="small"
              label="Nơi nhận"
              value={mode}
              disabled={!binding.data.canEdit || busy}
              onChange={(e) => setMode(e.target.value as Binding['mode'])}
            >
              <MenuItem value="disabled">Chưa bật gửi tài liệu</MenuItem>
              <MenuItem value="own">Chọn nhóm riêng</MenuItem>
              {binding.data.canInherit && (
                <MenuItem value="inherit">Dùng nhóm của khách hàng</MenuItem>
              )}
            </FormInputField>
            {mode === 'own' && (
              <>
                {binding.data.canEdit && (
                  <>
                    <FormInputField
                      select
                      size="small"
                      label="Tài khoản gửi"
                      value={account}
                      disabled={!binding.data.canEdit || busy}
                      onChange={(e) => {
                        setAccount(Number(e.target.value));
                        setPeer('');
                      }}
                    >
                      {(accounts.data || []).map((a) => (
                        <MenuItem key={a.id} value={a.id}>
                          {a.name}
                        </MenuItem>
                      ))}
                    </FormInputField>
                    <Autocomplete
                      options={groups.data || []}
                      value={groups.data?.find((g) => g.peer === peer) || null}
                      getOptionLabel={(g) => g.name}
                      getOptionKey={(g) => g.peer}
                      isOptionEqualToValue={(a, b) => a.peer === b.peer}
                      loading={groups.isFetching}
                      disabled={!account || !binding.data.canEdit || busy}
                      onChange={(_, g) => setPeer(g?.peer || '')}
                      noOptionsText="Chưa có nhóm khả dụng"
                      loadingText="Đang tải nhóm…"
                      renderOption={({ key, ...props }, g) => (
                        <li key={key} {...props}>
                          <Avatar src={g.avatar} sx={{ width: 32, height: 32, mr: 1 }}>
                            {g.name.slice(0, 1)}
                          </Avatar>
                          {g.name}
                        </li>
                      )}
                      renderInput={(params) => (
                        <FormInputField {...params} size="small" label="Nhóm nhận" />
                      )}
                    />
                  </>
                )}
                {!binding.data.canEdit && binding.data.destination && (
                  <DestinationView value={binding.data.destination} />
                )}
              </>
            )}
          </>
        )}
      </Stack>
    </AppFormDialog>
  );
}

export function ZaloDocumentButton({
  kind,
  id,
  version,
  getElement,
  disabled = false,
}: {
  kind: 'quotation' | 'report';
  id: string | number;
  version?: string;
  getElement: () => HTMLElement | null;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <DialogActionButton
        tone="primary"
        startIcon={<SendOutlinedIcon />}
        disabled={disabled || !version}
        onClick={() => setOpen(true)}
      >
        Gửi Zalo
      </DialogActionButton>
      {open && (
        <DocumentDialog
          kind={kind}
          id={id}
          version={version!}
          getElement={getElement}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function DocumentDialog({
  kind,
  id,
  version,
  getElement,
  onClose,
}: {
  kind: 'quotation' | 'report';
  id: string | number;
  version: string;
  getElement: () => HTMLElement | null;
  onClose: () => void;
}) {
  const context = useQuery<Context>({
    queryKey: ['zalo-document-context', kind, id],
    queryFn: ({ signal }) =>
      api.get(`${base}/source/${kind}/${id}`, { signal }).then((r) => r.data),
    ...queryOptions,
    staleTime: 0,
    refetchInterval: (q) =>
      q.state.data?.history.some((d) => ['queued', 'working'].includes(d.state)) ? 5000 : false,
  });
  const [format, setFormat] = useState<'pdf' | 'png'>(kind === 'quotation' ? 'pdf' : 'png');
  const [file, setFile] = useState<Blob | null>(null);
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const requestId = useRef(crypto.randomUUID());
  const data = context.data;
  const stale = !!data && data.version !== version;
  useEffect(() => {
    if (!file) {
      setUrl('');
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  useEffect(() => {
    let live = true;
    setPreparing(true);
    setFile(null);
    setError('');
    const element = getElement();
    if (!element) {
      setError('Mở lại bản gửi khách để tạo tài liệu.');
      setPreparing(false);
      return;
    }
    createElementDocument(element, format)
      .then((blob) => {
        if (live) {
          if (blob.size > 25 * 1024 * 1024)
            throw new Error('Tài liệu vượt 25 MB. Chọn PDF hoặc giảm ảnh đính kèm.');
          setFile(blob);
        }
      })
      .catch((e) => {
        if (live) setError(getApiErrorMessage(e));
      })
      .finally(() => {
        if (live) setPreparing(false);
      });
    return () => {
      live = false;
    };
    // Capture only when opening or explicitly switching format; background history refresh must not recapture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format]);
  async function send() {
    if (!file || !data?.destinationVersion || busy || accepted) return;
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      body.append('file', file, `document.${format}`);
      body.append('version', version);
      body.append('destinationVersion', data.destinationVersion);
      body.append('text', text);
      body.append('requestId', requestId.current);
      await api.post(`${base}/source/${kind}/${id}`, body, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120_000,
      });
      setAccepted(true);
      setHistoryOpen(true);
      await context.refetch();
    } catch (e) {
      setError(getApiErrorMessage(e));
      await context.refetch();
    } finally {
      setBusy(false);
    }
  }
  async function action(delivery: Delivery, action: string) {
    setBusy(true);
    setError('');
    try {
      await api.post(`${base}/delivery/${delivery.id}`, { action }, { timeout: 150_000 });
      await context.refetch();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <AppFormDialog
      open
      title="Gửi Zalo"
      maxWidth="lg"
      submitting={busy}
      onClose={onClose}
      onSubmit={(event) => event.preventDefault()}
      actions={
        <>
          <DialogActionButton onClick={onClose} disabled={busy}>
            Đóng
          </DialogActionButton>
          <DialogActionButton
            tone="primary"
            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <SendOutlinedIcon />}
            onClick={() => void send()}
            disabled={
              busy ||
              preparing ||
              !file ||
              !data?.destination ||
              !data.eligible ||
              stale ||
              accepted
            }
          >
            {busy ? 'Đang xử lý…' : 'Xác nhận gửi'}
          </DialogActionButton>
        </>
      }
    >
      <p className="mb-4 text-sm font-medium text-slate-500">{data?.title}</p>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 340px' } }}>
        <Box sx={{ p: 2, bgcolor: 'grey.100', minWidth: 0 }}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={format}
            disabled={busy || accepted}
            onChange={(_, next) => {
              if (next) {
                setFormat(next);
                requestId.current = crypto.randomUUID();
              }
            }}
            aria-label="Định dạng tài liệu"
            sx={{ mb: 2 }}
          >
            <ToggleButton value="pdf">PDF</ToggleButton>
            <ToggleButton value="png">Ảnh</ToggleButton>
          </ToggleButtonGroup>
          {preparing ? (
            <Stack spacing={2} sx={{ py: 8, alignItems: 'center' }}>
              <CircularProgress size={28} />
              <Typography>Đang tạo bản gửi…</Typography>
            </Stack>
          ) : (
            url &&
            (format === 'pdf' ? (
              <iframe
                title="Bản PDF sẽ gửi"
                src={url}
                style={{ width: '100%', height: 480, border: 0, background: 'white' }}
              />
            ) : (
              <Box
                component="img"
                src={url}
                alt="Bản tài liệu sẽ gửi khách"
                sx={{ width: '100%', maxHeight: 560, objectFit: 'contain', bgcolor: 'white' }}
              />
            ))
          )}
          {file && (
            <Typography variant="caption" color="text.secondary">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </Typography>
          )}
        </Box>
        <Stack spacing={2} sx={{ p: 2.5, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600 }}>Nơi nhận</Typography>
          {context.isPending && <CircularProgress size={24} />}
          {data?.destination ? (
            <DestinationView value={data.destination} />
          ) : (
            data && <Alert severity="info">Chưa có nhóm nhận khả dụng.</Alert>
          )}
          {!!data?.parentId && !busy && !accepted && (
            <ZaloRouteButton
              kind={data.parentKind}
              id={data.parentId}
              onSaved={() => void context.refetch()}
            />
          )}
          {data && !data.parentId && (
            <Alert severity="info">Gắn báo phí với dự án hoặc khách hàng trước khi gửi.</Alert>
          )}
          <Divider />
          <FormInputField
            multiline
            minRows={4}
            label="Lời nhắn kèm theo"
            placeholder="Nhập lời nhắn (không bắt buộc)"
            value={text}
            disabled={busy || accepted}
            slotProps={{ htmlInput: { maxLength: 2000 } }}
            onChange={(e) => {
              setText(e.target.value);
              requestId.current = crypto.randomUUID();
            }}
          />
          {stale && (
            <Alert severity="warning">Tài liệu vừa thay đổi. Đóng và mở lại bản gửi khách.</Alert>
          )}
          {data && !data.eligible && (
            <Alert severity="warning">Báo cáo cần được duyệt trước khi gửi.</Alert>
          )}
          {(error || context.error) && (
            <Alert severity="error">{error || getApiErrorMessage(context.error)}</Alert>
          )}
          {accepted && (
            <Alert severity="success">Đã tiếp nhận lượt gửi. Theo dõi kết quả bên dưới.</Alert>
          )}
        </Stack>
      </Box>
      {!!data?.history.length && (
        <Box sx={{ px: 2.5, py: 1.5, borderTop: 1, borderColor: 'divider' }}>
          <Button
            size="small"
            onClick={() => setHistoryOpen(!historyOpen)}
            aria-expanded={historyOpen}
          >
            Lịch sử gửi ({data.history.length})
          </Button>
          {historyOpen && (
            <Stack spacing={2} sx={{ py: 1 }}>
              {data.history.map((d) => (
                <Box
                  key={d.id}
                  sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, p: 1.5 }}
                >
                  <Stack
                    direction="row"
                    sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}
                  >
                    <Typography sx={{ fontWeight: 600 }} variant="body2">
                      {d.destination.name}
                    </Typography>
                    <Chip
                      size="small"
                      label={states[d.state] || d.state}
                      color={
                        d.state === 'sent'
                          ? 'success'
                          : ['failed', 'unknown'].includes(d.state)
                            ? 'warning'
                            : 'default'
                      }
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {d.actor} · {new Date(d.at).toLocaleString('vi-VN')} ·{' '}
                    {d.parts.filter((p) => p.state === 'sent').length}/{d.parts.length} phần đã gửi
                  </Typography>
                  {d.issue && (
                    <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
                      {d.issue}
                    </Typography>
                  )}
                  <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }} useFlexGap>
                    <Button
                      size="small"
                      href={`${api.defaults.baseURL}${base}/delivery/${d.id}/file`}
                      target="_blank"
                      rel="noopener"
                    >
                      Bản đã lưu
                    </Button>
                    {d.canAct && d.state === 'unknown' && (
                      <Button size="small" disabled={busy} onClick={() => void action(d, 'check')}>
                        Kiểm tra kết quả
                      </Button>
                    )}
                    {d.canAct && d.state === 'failed' && (
                      <Button size="small" disabled={busy} onClick={() => void action(d, 'retry')}>
                        Tiếp tục phần chưa gửi
                      </Button>
                    )}
                    {d.canAct && ['queued', 'failed'].includes(d.state) && (
                      <Button
                        size="small"
                        color="error"
                        disabled={busy}
                        onClick={() => void action(d, 'cancel')}
                      >
                        Hủy phần chưa gửi
                      </Button>
                    )}
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      )}
    </AppFormDialog>
  );
}

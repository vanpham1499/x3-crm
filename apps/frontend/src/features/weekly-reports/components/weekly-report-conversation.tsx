'use client';

import { useMemo, useState } from 'react';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import ReplyRoundedIcon from '@mui/icons-material/ReplyRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import { Avatar, IconButton, ListItemIcon, Menu, MenuItem, Tooltip } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FormInputField } from '@/components/form/form-input-field';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatDateTime } from '@/lib/utils';
import api from '@/services/api/client';
import type {
  WeeklyReport,
  WeeklyReportItem,
  WeeklyReportMessageDraft,
} from '@/types/weekly-report';

type WeeklyReportConversationProps = {
  mode: 'create' | 'edit';
  report?: WeeklyReport | null;
  draftMessages: WeeklyReportMessageDraft[];
  onDraftMessagesChange: (messages: WeeklyReportMessageDraft[]) => void;
};

function getInitials(name?: string | null) {
  const value = name?.trim();
  if (!value) return '?';

  return value
    .split(/\s+/)
    .slice(-2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

function MessageBubble({
  message,
  report,
  hasReplies,
  onReply,
  onEdit,
  onDelete,
}: {
  message: WeeklyReportItem;
  report: WeeklyReport;
  hasReplies?: boolean;
  onReply?: (message: WeeklyReportItem) => void;
  onEdit?: (message: WeeklyReportItem) => void;
  onDelete?: (message: WeeklyReportItem) => void;
}) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const authorName = message.author?.name || report.reporter?.name || 'Người dùng';
  const isReporter =
    !message.author?.id || Number(message.author.id) === Number(report.reporterUserId);
  const hasActions = Boolean(message.canUpdate || message.canDelete);

  return (
    <div
      className={`flex gap-2.5 ${isReporter ? 'justify-start' : 'flex-row-reverse justify-start'}`}
    >
      <Avatar
        className={`!mt-1 !h-8 !w-8 !text-[11px] !font-black ${
          isReporter ? '!bg-slate-200 !text-slate-700' : '!bg-primary !text-white'
        }`}
      >
        {getInitials(authorName)}
      </Avatar>
      <div className={`max-w-[82%] ${isReporter ? 'text-left' : 'text-right'}`}>
        <div
          className={`mb-1 flex flex-wrap items-center gap-1.5 ${isReporter ? '' : 'justify-end'}`}
        >
          <span className="text-xs font-extrabold text-slate-700">{authorName}</span>
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              isReporter ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {isReporter ? 'Người báo cáo' : 'Phản hồi'}
          </span>
          {message.createdAt ? (
            <span className="text-[10px] font-medium text-slate-400">
              {formatDateTime(message.createdAt)}
            </span>
          ) : null}
          {hasActions ? (
            <>
              <Tooltip title="Tùy chọn tin nhắn">
                <IconButton
                  type="button"
                  size="small"
                  aria-label="Mở tùy chọn tin nhắn"
                  aria-haspopup="menu"
                  aria-expanded={Boolean(menuAnchor)}
                  className="!-my-2 !h-9 !w-9 !text-slate-500"
                  onClick={(event) => setMenuAnchor(event.currentTarget)}
                >
                  <MoreVertRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={() => setMenuAnchor(null)}
                slotProps={{ paper: { className: '!rounded-xl !shadow-lg' } }}
              >
                {message.canUpdate && onEdit ? (
                  <MenuItem
                    onClick={() => {
                      setMenuAnchor(null);
                      onEdit(message);
                    }}
                  >
                    <ListItemIcon>
                      <EditOutlinedIcon fontSize="small" />
                    </ListItemIcon>
                    Chỉnh sửa
                  </MenuItem>
                ) : null}
                {message.canDelete && onDelete ? (
                  <MenuItem
                    disabled={hasReplies}
                    title={hasReplies ? 'Tin nhắn đã có phản hồi nên không thể xóa' : undefined}
                    className="!text-red-600"
                    onClick={() => {
                      setMenuAnchor(null);
                      onDelete(message);
                    }}
                  >
                    <ListItemIcon>
                      <DeleteOutlineRoundedIcon
                        color={hasReplies ? 'disabled' : 'error'}
                        fontSize="small"
                      />
                    </ListItemIcon>
                    {hasReplies ? 'Không thể xóa khi đã có phản hồi' : 'Xóa'}
                  </MenuItem>
                ) : null}
              </Menu>
            </>
          ) : null}
        </div>
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm font-medium leading-6 shadow-sm ${
            isReporter
              ? 'rounded-tl-md border border-slate-200 bg-white text-slate-700'
              : 'rounded-tr-md border border-emerald-200 bg-emerald-50 text-slate-800'
          }`}
        >
          <p className="whitespace-pre-wrap text-left">{message.content || message.title}</p>
        </div>
        {onReply ? (
          <button
            type="button"
            className={`mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-slate-500 transition-colors hover:text-primary ${
              isReporter ? '' : 'mr-1'
            }`}
            onClick={() => onReply(message)}
          >
            <ReplyRoundedIcon className="!text-base" />
            Phản hồi
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function WeeklyReportConversation({
  mode,
  report,
  draftMessages,
  onDraftMessagesChange,
}: WeeklyReportConversationProps) {
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const [content, setContent] = useState('');
  const [replyTarget, setReplyTarget] = useState<WeeklyReportItem | null>(null);
  const [editingMessage, setEditingMessage] = useState<WeeklyReportItem | null>(null);
  const [editingDraft, setEditingDraft] = useState<WeeklyReportMessageDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WeeklyReportItem | null>(null);
  const messages = report?.items || [];
  const canComment = mode === 'create' || Boolean(report?.canComment);

  const threads = useMemo(() => {
    const messageIds = new Set(messages.map((message) => message.id).filter(Boolean));
    const roots = messages.filter(
      (message) => !message.replyToMessageId || !messageIds.has(message.replyToMessageId),
    );

    return roots.map((root) => ({
      root,
      replies: messages.filter((message) => message.replyToMessageId === root.id),
    }));
  }, [messages]);

  const syncUpdatedReport = (updatedReport: WeeklyReport) => {
    queryClient.setQueryData(['weekly-reports', String(updatedReport.id)], updatedReport);
    queryClient.invalidateQueries({ queryKey: ['weekly-reports'] });
  };

  const messageMutation = useMutation({
    mutationFn: (payload: { content: string; replyToMessageId?: number }) =>
      api
        .post<WeeklyReport>(`/weekly-reports/${report?.id}/messages`, payload)
        .then((response) => response.data),
    onSuccess: (updatedReport) => {
      syncUpdatedReport(updatedReport);
      notify.success(replyTarget ? 'Đã gửi phản hồi' : 'Đã gửi nội dung trao đổi');
      setContent('');
      setReplyTarget(null);
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Không thể gửi nội dung trao đổi')),
  });

  const updateMessageMutation = useMutation({
    mutationFn: ({ messageId, content }: { messageId: number; content: string }) =>
      api
        .patch<WeeklyReport>(`/weekly-reports/${report?.id}/messages/${messageId}`, { content })
        .then((response) => response.data),
    onSuccess: (updatedReport) => {
      syncUpdatedReport(updatedReport);
      notify.success('Đã cập nhật tin nhắn');
      setContent('');
      setEditingMessage(null);
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Không thể cập nhật tin nhắn')),
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (messageId: number) =>
      api
        .delete<WeeklyReport>(`/weekly-reports/${report?.id}/messages/${messageId}`)
        .then((response) => response.data),
    onSuccess: (updatedReport) => {
      syncUpdatedReport(updatedReport);
      notify.success('Đã xóa tin nhắn');
      setDeleteTarget(null);
      setContent('');
      setEditingMessage(null);
      setReplyTarget(null);
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Không thể xóa tin nhắn'));
      setDeleteTarget(null);
    },
  });

  const isMessageActionPending =
    messageMutation.isPending || updateMessageMutation.isPending || deleteMessageMutation.isPending;

  const sendMessage = () => {
    const normalizedContent = content.trim();
    if (!normalizedContent || isMessageActionPending) return;

    if (mode === 'create') {
      if (editingDraft) {
        onDraftMessagesChange(
          draftMessages.map((message) =>
            message.id === editingDraft.id ? { ...message, content: normalizedContent } : message,
          ),
        );
        setEditingDraft(null);
      } else {
        onDraftMessagesChange([
          ...draftMessages,
          {
            id: Date.now() + Math.floor(Math.random() * 1000),
            content: normalizedContent,
          },
        ]);
      }
      setContent('');
      return;
    }

    if (!report) return;

    if (editingMessage?.id) {
      updateMessageMutation.mutate({
        messageId: editingMessage.id,
        content: normalizedContent,
      });
      return;
    }

    messageMutation.mutate({
      content: normalizedContent,
      replyToMessageId: replyTarget?.id,
    });
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-primary">
            <ChatBubbleOutlineRoundedIcon fontSize="small" />
          </span>
          <div>
            <p className="text-sm font-extrabold text-slate-900">Trao đổi vấn đề & phản hồi</p>
            <p className="mt-0.5 text-xs leading-5 text-slate-500">
              Hội thoại nội bộ, không hiển thị trong bản gửi khách.
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
          Nội bộ
        </span>
      </div>

      <div className="space-y-4 px-4 py-4">
        {mode === 'create' ? (
          draftMessages.length > 0 ? (
            draftMessages.map((message) => (
              <div key={message.id} className="flex items-start gap-2.5">
                <Avatar className="!mt-1 !h-8 !w-8 !bg-slate-200 !text-[11px] !font-black !text-slate-700">
                  Bạn
                </Avatar>
                <div className="max-w-[82%]">
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="text-xs font-extrabold text-slate-700">Bạn</span>
                    <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                      Sẽ gửi khi tạo báo cáo
                    </span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <p className="whitespace-pre-wrap rounded-2xl rounded-tl-md border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium leading-6 text-slate-700 shadow-sm">
                      {message.content}
                    </p>
                    <Tooltip title="Chỉnh sửa tin nhắn nháp">
                      <IconButton
                        type="button"
                        size="small"
                        aria-label="Chỉnh sửa tin nhắn nháp"
                        onClick={() => {
                          setEditingDraft(message);
                          setContent(message.content);
                        }}
                      >
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Xóa tin nhắn nháp">
                      <IconButton
                        type="button"
                        size="small"
                        color="error"
                        aria-label="Xóa tin nhắn nháp"
                        onClick={() => {
                          onDraftMessagesChange(
                            draftMessages.filter((draft) => draft.id !== message.id),
                          );
                          if (editingDraft?.id === message.id) {
                            setEditingDraft(null);
                            setContent('');
                          }
                        }}
                      >
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="py-2 text-center text-sm font-medium text-slate-500">
              Chưa có vấn đề cần trao đổi trong báo cáo này.
            </p>
          )
        ) : threads.length > 0 && report ? (
          threads.map(({ root, replies }) => (
            <div key={root.id || root.content} className="space-y-3">
              <MessageBubble
                message={root}
                report={report}
                hasReplies={replies.length > 0}
                onReply={
                  canComment
                    ? (message) => {
                        setEditingMessage(null);
                        setContent('');
                        setReplyTarget(message);
                      }
                    : undefined
                }
                onEdit={
                  root.canUpdate
                    ? (message) => {
                        setReplyTarget(null);
                        setEditingMessage(message);
                        setContent(message.content || message.title || '');
                      }
                    : undefined
                }
                onDelete={root.canDelete ? setDeleteTarget : undefined}
              />
              {replies.length > 0 ? (
                <div className="space-y-3 border-l-2 border-slate-200 pl-4 sm:ml-10">
                  {replies.map((reply) => (
                    <MessageBubble
                      key={reply.id || reply.content}
                      message={reply}
                      report={report}
                      onReply={
                        canComment
                          ? () => {
                              setEditingMessage(null);
                              setContent('');
                              setReplyTarget(root);
                            }
                          : undefined
                      }
                      onEdit={
                        reply.canUpdate
                          ? (message) => {
                              setReplyTarget(null);
                              setEditingMessage(message);
                              setContent(message.content || message.title || '');
                            }
                          : undefined
                      }
                      onDelete={reply.canDelete ? setDeleteTarget : undefined}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <p className="py-2 text-center text-sm font-medium text-slate-500">
            Chưa có vấn đề hoặc phản hồi nội bộ.
          </p>
        )}
      </div>

      {canComment ? (
        <div className="border-t border-slate-200 bg-white p-3">
          {replyTarget || editingMessage || editingDraft ? (
            <div
              className={`mb-2 flex items-center justify-between gap-2 rounded-lg px-3 py-2 ${
                editingMessage || editingDraft ? 'bg-sky-50' : 'bg-emerald-50'
              }`}
            >
              <p
                className={`min-w-0 truncate text-xs font-semibold ${
                  editingMessage || editingDraft ? 'text-sky-800' : 'text-emerald-800'
                }`}
              >
                {editingMessage || editingDraft
                  ? 'Đang chỉnh sửa tin nhắn'
                  : `Đang phản hồi ${
                      replyTarget?.author?.name || report?.reporter?.name || 'tin nhắn'
                    }`}
              </p>
              <IconButton
                type="button"
                size="small"
                aria-label={editingMessage || editingDraft ? 'Hủy chỉnh sửa' : 'Hủy phản hồi'}
                onClick={() => {
                  setReplyTarget(null);
                  setEditingMessage(null);
                  setEditingDraft(null);
                  setContent('');
                }}
              >
                <CloseRoundedIcon className="!text-base" />
              </IconButton>
            </div>
          ) : null}
          <div className="flex items-end gap-2">
            <FormInputField
              multiline
              minRows={2}
              maxRows={5}
              value={content}
              disabled={isMessageActionPending}
              placeholder={
                editingMessage || editingDraft
                  ? 'Chỉnh sửa nội dung tin nhắn...'
                  : replyTarget
                    ? 'Nhập nội dung phản hồi...'
                    : mode === 'create'
                      ? 'Nhập vấn đề cần trao đổi...'
                      : 'Nhập nội dung trao đổi mới...'
              }
              onChange={(event) => setContent(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                  event.preventDefault();
                  sendMessage();
                }
              }}
            />
            <Tooltip
              title={
                editingMessage || editingDraft
                  ? 'Lưu chỉnh sửa'
                  : mode === 'create'
                    ? 'Thêm vào báo cáo'
                    : 'Gửi tin nhắn'
              }
            >
              <span>
                <IconButton
                  type="button"
                  color="primary"
                  disabled={!content.trim() || isMessageActionPending}
                  aria-label={
                    editingMessage || editingDraft
                      ? 'Lưu chỉnh sửa tin nhắn'
                      : mode === 'create'
                        ? 'Thêm tin nhắn vào báo cáo'
                        : 'Gửi tin nhắn'
                  }
                  className="!mb-0.5 !h-10 !w-10 !rounded-lg !bg-primary !text-white disabled:!bg-slate-200"
                  onClick={sendMessage}
                >
                  {editingMessage || editingDraft ? (
                    <SaveRoundedIcon fontSize="small" />
                  ) : (
                    <SendRoundedIcon fontSize="small" />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          </div>
          <p className="mt-1.5 text-[11px] font-medium text-slate-400">
            Nhấn Ctrl + Enter để gửi nhanh.
          </p>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa tin nhắn?"
        description="Tin nhắn sẽ bị xóa khỏi cuộc trao đổi và không thể khôi phục trên giao diện."
        confirmText="Xóa tin nhắn"
        loading={deleteMessageMutation.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget?.id) {
            deleteMessageMutation.mutate(deleteTarget.id);
          }
        }}
      />
    </div>
  );
}

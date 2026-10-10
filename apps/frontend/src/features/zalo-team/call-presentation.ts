import type { ChatMessage } from './types';

// Zalo PC/Web r6Qt title, subtitle and icon mapping. Duration is in seconds.
export function callPresentation(call: NonNullable<ChatMessage['call']>) {
  const outgoing = call.direction === 'outgoing';
  const type = call.video ? 'video' : 'thoại';
  let title = `Cuộc gọi ${type} ${outgoing ? 'đi' : 'đến'}`;
  if (call.missed) {
    if (!outgoing) title = call.reason === 3 ? 'Bạn đã từ chối' : 'Bạn bị nhỡ';
    else if ([4, 5].includes(call.reason)) title = 'Bạn đã hủy';
    else if (call.reason === 3) title = 'Người nhận từ chối';
    else if (call.reason === 1) title = 'Người nhận bận';
  }
  let subtitle = `Cuộc gọi ${type}`;
  const duration =
    call.missed && outgoing && [0, 2].includes(call.reason) ? 0 : call.durationSeconds;
  if (!call.missed || (outgoing && [0, 2].includes(call.reason))) {
    subtitle =
      duration == null
        ? 'Đã kết thúc'
        : `${duration >= 3600 ? `${Math.floor(duration / 3600)} giờ ` : ''}${Math.floor(duration / 60) % 60} phút ${duration % 60} giây`;
  }
  const state =
    call.missed && call.reason === 3
      ? 'rejected'
      : `${call.direction}${call.missed ? '-missed' : ''}`;
  return {
    title,
    subtitle,
    icon: `/zalo-team/calls/call-${state}-${call.video ? 'video' : 'audio'}.svg`,
    red: !outgoing && call.missed,
  };
}

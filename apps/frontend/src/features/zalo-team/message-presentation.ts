import type { ChatMessage } from './types';

// Zalo Web XkoV.UI.time_to_break_block_messages: 1,800,000 ms.
// See tooling/zalo-team/MESSAGE-UI-REFERENCE.md for the inspected render rules.
export const MESSAGE_BLOCK_GAP = 30 * 60 * 1000;
export const messageDay = (time: number) =>
  new Date(time).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
export const messageClock = (time: number) =>
  new Date(time).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });

export function sameMessageBlock(a?: ChatMessage, b?: ChatMessage) {
  if (!a || !b || ['system', 'call'].includes(a.kind) || ['system', 'call'].includes(b.kind)) return false;
  if (a.mine !== b.mine || messageDay(a.time) !== messageDay(b.time)) return false;
  if (a.crmSender?.userId !== b.crmSender?.userId) return false;
  if (b.time - a.time < 0 || b.time - a.time > MESSAGE_BLOCK_GAP) return false;
  // Never merge two group members merely because they have the same display name.
  return a.mine || Boolean(a.sender.id && b.sender.id && a.sender.id === b.sender.id);
}

export function messageLayout(messages: ChatMessage[], index: number) {
  const message = messages[index],
    previous = messages[index - 1],
    next = messages[index + 1];
  const dateChanged = !previous || messageDay(previous.time) !== messageDay(message.time);
  const timeBreak = Boolean(
    previous && !dateChanged && message.time - previous.time > MESSAGE_BLOCK_GAP,
  );
  return {
    first: !sameMessageBlock(previous, message),
    last: !sameMessageBlock(message, next),
    separator: dateChanged
      ? messageDay(message.time)
      : timeBreak
        ? `${messageClock(message.time)} ${messageDay(message.time)}`
        : null,
  };
}

export function fileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const unit = Math.min(3, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** unit).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} ${units[unit]}`;
}

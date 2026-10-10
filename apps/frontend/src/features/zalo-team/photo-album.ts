import type { ChatMessage, MessageAttachment } from './types';
import { sameMessageBlock } from './message-presentation';

// Native Web/PC photo bundles are explicit; adjacent individual uploads are not albums.
export function groupPhotoMessages(messages: ChatMessage[]) {
  const result: ChatMessage[] = [];
  const eligible = (m: ChatMessage) =>
    m.photoGroup &&
    m.photoGroup.total > 1 &&
    !m.text &&
    !m.quote &&
    m.attachments.length === 1 &&
    m.attachments[0].kind === 'image' &&
    !m.attachments[0].animated;
  for (const message of messages) {
    const previous = result[result.length - 1];
    if (
      previous &&
      eligible(previous) &&
      eligible(message) &&
      previous.photoGroup!.id === message.photoGroup!.id &&
      sameMessageBlock(previous, message) &&
      (previous.album?.length || 1) < previous.photoGroup!.total &&
      previous.mine === message.mine &&
      previous.sender.id === message.sender.id
    ) {
      const album = [...(previous.album || [previous]), message].sort(
        (a, b) => a.photoGroup!.index - b.photoGroup!.index,
      );
      result[result.length - 1] = { ...previous, time: message.time, album };
    } else result.push(message);
  }
  return result;
}

// Same ordered, balanced-row rule as native GzlV, at its 450px reference width.
// Coordinates scale with the album width; loading images cannot change the layout.
export function photoAlbumLayout(items: MessageAttachment[]) {
  const width = 450,
    gap = 2;
  const ratios = items.map((i) => (i.width && i.height ? i.width / i.height : 1));
  const cropped = ratios.map((r) => r < 0.32 || r > 4);
  const weights = ratios.map((r) => (r < 0.32 ? 0.36 : r > 4 ? 2.75 : r));
  const positions: {
    x: number;
    y: number;
    width: number;
    height: number;
    contain: boolean;
    radius: string;
  }[] = [];
  if (!items.length) return { width, height: 0, positions };
  if (items.length > 10) {
    const cols = Math.min(4, items.length),
      size = 90;
    items.forEach((_, i) =>
      positions.push({
        x: gap + (i % cols) * (size + gap),
        y: gap + Math.floor(i / cols) * (size + gap),
        width: size,
        height: size,
        contain: false,
        radius: '6px',
      }),
    );
    return {
      width: cols * (size + gap) + gap,
      height: Math.ceil(items.length / cols) * (size + gap) + gap,
      positions,
    };
  }
  let count = Math.round((weights.reduce((a, b) => a + b, 0) * 180) / width);
  if (items.length > 4) count = Math.max(Math.ceil(items.length / 4), count);
  count = Math.max(1, Math.min(items.length, count));
  const sums = [0];
  weights.forEach((w) => sums.push(sums[sums.length - 1] + w));
  const cost = Array.from({ length: count + 1 }, () => Array(items.length + 1).fill(Infinity));
  const cuts = Array.from({ length: count + 1 }, () => Array(items.length + 1).fill(0));
  cost[0][0] = 0;
  for (let k = 1; k <= count; k++)
    for (let end = k; end <= items.length; end++) {
      for (let start = k - 1; start < end; start++) {
        const value = Math.max(cost[k - 1][start], sums[end] - sums[start]);
        if (value < cost[k][end]) {
          cost[k][end] = value;
          cuts[k][end] = start;
        }
      }
    }
  const rows: number[][] = [];
  for (let k = count, end = items.length; k; k--) {
    const start = cuts[k][end];
    rows.unshift(Array.from({ length: end - start }, (_, i) => start + i));
    end = start;
  }
  let y = gap;
  rows.forEach((row, rowIndex) => {
    const sum = row.reduce((n, i) => n + weights[i], 0);
    let height = Math.round((width - gap * (row.length + 1)) / sum);
    height = height > 550 ? 250 : Math.max(68, height);
    const sizes = row.map((i) => Math.round(height * weights[i]));
    let deficit = sizes.reduce((n, w) => n + Math.max(0, 88 - w), 0);
    const adjusted = sizes.map((w) => {
      if (w < 88) return 88;
      const reduction = Math.min(w - 88, deficit);
      deficit -= reduction;
      return w - reduction;
    });
    let x = gap;
    row.forEach((i, col) => {
      const w = col === row.length - 1 ? width - gap - x : adjusted[col];
      const first = rowIndex === 0,
        last = rowIndex === rows.length - 1;
      positions.push({
        x,
        y,
        width: w,
        height,
        contain: cropped[i] || Math.abs(w - sizes[col]) > 30,
        radius: `${first && col === 0 ? 8 : 0}px ${first && col === row.length - 1 ? 8 : 0}px ${last && col === row.length - 1 ? 8 : 0}px ${last && col === 0 ? 8 : 0}px`,
      });
      x += w + gap;
    });
    y += height + gap;
  });
  return { width, height: y, positions };
}

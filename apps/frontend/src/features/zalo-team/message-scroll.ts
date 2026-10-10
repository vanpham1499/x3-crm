/** Keep the first visible message fixed, including when media above it finishes loading. */
export type MessageAnchor = { id: string; offset: number };

export function captureMessageAnchor(viewport: HTMLElement): MessageAnchor | null {
  const top = viewport.getBoundingClientRect().top;
  for (const row of viewport.querySelectorAll<HTMLElement>('[data-message-id]')) {
    const bounds = row.getBoundingClientRect();
    if (bounds.bottom > top) return { id: row.dataset.messageId!, offset: bounds.top - top };
  }
  return null;
}

export function restoreMessageAnchor(viewport: HTMLElement, anchor: MessageAnchor): void {
  // Compare attributes instead of interpolating externally supplied IDs into a selector.
  const row = [...viewport.querySelectorAll<HTMLElement>('[data-message-id]')].find(
    (item) => item.dataset.messageId === anchor.id,
  );
  if (row)
    viewport.scrollTop +=
      row.getBoundingClientRect().top - viewport.getBoundingClientRect().top - anchor.offset;
}

export function historyCursorAdvanced(
  before: { id: string; time: string },
  next: { id: string; time: string } | null,
): boolean {
  return (
    !next ||
    Number(next.time) < Number(before.time) ||
    (next.time === before.time && next.id !== before.id)
  );
}

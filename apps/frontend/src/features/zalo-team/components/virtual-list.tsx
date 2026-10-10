'use client';
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';

/** Keep existing scrolling, row components and menu anchors; mount only the visible window. */
export function VirtualList<T>({
  items,
  itemKey,
  render,
  scrollRef,
  estimate = 76,
  pinnedKey,
  resetKey,
}: {
  items: T[];
  itemKey: (item: T) => string | number;
  render: (item: T, index: number) => ReactNode;
  scrollRef: RefObject<HTMLDivElement>;
  estimate?: number;
  pinnedKey?: string | number;
  resetKey: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const focusFrame = useRef<number>();
  const [margin, setMargin] = useState(0);
  const [focused, setFocused] = useState<string | number | null>(null);
  const enabled = items.length > 80;
  const focusedIndex = items.findIndex((item) => itemKey(item) === focused);
  const pinnedIndex = items.findIndex((item) => itemKey(item) === pinnedKey);
  const getItemKey = useCallback((index: number) => itemKey(items[index]), [items, itemKey]);
  const virtual = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimate,
    getItemKey,
    overscan: 6,
    scrollMargin: margin,
    enabled,
    rangeExtractor: useCallback(
      (range: Parameters<typeof defaultRangeExtractor>[0]) =>
        [
          ...new Set(
            [...defaultRangeExtractor(range), focusedIndex, pinnedIndex].filter((i) => i >= 0),
          ),
        ].sort((a, b) => a - b),
      [focusedIndex, pinnedIndex],
    ),
  });
  useLayoutEffect(() => {
    const parent = scrollRef.current,
      node = host.current;
    if (!parent || !node) return;
    const measure = () =>
      setMargin(
        node.getBoundingClientRect().top -
          parent.getBoundingClientRect().top +
          parent.scrollTop -
          parent.clientTop,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    observer.observe(node);
    return () => observer.disconnect();
  }, [scrollRef, resetKey, enabled]);
  useLayoutEffect(() => {
    if (focusFrame.current !== undefined) cancelAnimationFrame(focusFrame.current);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setFocused(null);
    return () => {
      if (focusFrame.current !== undefined) cancelAnimationFrame(focusFrame.current);
    };
  }, [resetKey, scrollRef]);
  function focusRow(index: number, last = false) {
    if (!items[index]) return;
    setFocused(itemKey(items[index]));
    virtual.scrollToIndex(index, { align: 'auto' });
    if (focusFrame.current !== undefined) cancelAnimationFrame(focusFrame.current);
    focusFrame.current = requestAnimationFrame(() => {
      const buttons = host.current
        ?.querySelector(`[data-index="${index}"]`)
        ?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
      (last ? buttons?.[buttons.length - 1] : buttons?.[0])?.focus({ preventScroll: true });
    });
  }
  const rows = enabled
    ? virtual.getVirtualItems()
    : items.map((item, index) => ({ index, key: itemKey(item), start: 0 }));
  return (
    <div
      ref={host}
      role="list"
      data-virtualized={enabled}
      data-total={items.length}
      style={
        enabled
          ? {
              flex: 'none',
              height: virtual.getTotalSize(),
              position: 'relative',
              overflowAnchor: 'none',
            }
          : undefined
      }
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setFocused(null);
      }}
      onKeyDown={(event) => {
        if (!enabled || !(event.target instanceof HTMLButtonElement)) return;
        const row = event.target.closest<HTMLElement>('[data-index]');
        if (!row) return;
        const index = Number(row.dataset.index);
        let next =
          event.key === 'ArrowDown'
            ? index + 1
            : event.key === 'ArrowUp'
              ? index - 1
              : event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? items.length - 1
                  : -1;
        if (event.key === 'Tab') {
          const buttons = row.querySelectorAll('button:not(:disabled)');
          if (event.target === (event.shiftKey ? buttons[0] : buttons[buttons.length - 1]))
            next = index + (event.shiftKey ? -1 : 1);
        }
        if (next >= 0 && next < items.length) {
          event.preventDefault();
          focusRow(next, event.key === 'Tab' && event.shiftKey);
        }
      }}
    >
      {rows.map((row) => (
        <div
          key={row.key}
          data-index={row.index}
          role="listitem"
          aria-setsize={items.length}
          aria-posinset={row.index + 1}
          ref={enabled ? virtual.measureElement : undefined}
          onFocus={() => setFocused(itemKey(items[row.index]))}
          style={
            enabled
              ? {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${row.start - margin}px)`,
                  display: 'flow-root',
                }
              : undefined
          }
        >
          {render(items[row.index], row.index)}
        </div>
      ))}
    </div>
  );
}

'use client';
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { editMentions, noMentions, type Mention, type MentionMember } from '../mentions';
import type { KeyboardEvent } from 'react';
import { emojiTokens, useEmojiArtwork } from '../emoji-artwork';
import styles from '../zalo-team.module.css';
import { clipboardRichText } from '../clipboard-rich-text';
import {
  codesAt,
  editStyles,
  family,
  packStyles,
  richCss,
  validRichStyles,
  type RichStyle,
} from '../rich-text';

type Caret = { start: number; end: number };
const emptyStyles: RichStyle[] = [];
export type MessageEditorHandle = {
  focus: () => void;
  insertText: (text: string) => boolean;
  insertMention: (member: MentionMember, range: { pos: number; len: number }) => boolean;
  format: (code: string) => void;
};

// Only bounded native ranges are serialized. Pasted HTML is never used.
function plain(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
  if (node instanceof HTMLElement) {
    if (node.hasAttribute('data-emoji')) return node.dataset.emoji || '';
    if (node.tagName === 'BR') {
      // Chromium leaves a terminal BR in an emptied editing block to hold the
      // caret. It is not another line: our real newlines are sibling DIVs.
      const block = node.parentElement;
      const caretPlaceholder =
        block && ['DIV', 'P'].includes(block.tagName) && block.lastChild === node;
      return node.hasAttribute('data-editor-tail') || caretPlaceholder ? '' : '\n';
    }
  }
  return Array.from(node.childNodes)
    .map((child, i) => {
      const block = child instanceof HTMLElement && ['DIV', 'P'].includes(child.tagName);
      return (block && i > 0 ? '\n' : '') + plain(child);
    })
    .join('');
}
function selection(root: HTMLElement): Caret | null {
  const selected = window.getSelection();
  if (!selected?.rangeCount) return null;
  const range = selected.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const before = range.cloneRange();
  before.selectNodeContents(root);
  before.setEnd(range.startContainer, range.startOffset);
  const start = plain(before.cloneContents()).length;
  return { start, end: start + plain(range.cloneContents()).length };
}
function restore(root: HTMLElement, caret: Caret) {
  const point = (offset: number): [Node, number] => {
    let left = offset;
    const walk = (parent: Node): [Node, number] | null => {
      for (let i = 0; i < parent.childNodes.length; i++) {
        const node = parent.childNodes[i];
        if (i > 0 && node instanceof HTMLElement && ['DIV', 'P'].includes(node.tagName)) left--;
        const count = plain(node).length;
        if (node.nodeType === Node.TEXT_NODE && left <= count) return [node, Math.max(0, left)];
        if (
          left <= count &&
          node instanceof HTMLElement &&
          !node.hasAttribute('data-emoji') &&
          node.tagName !== 'BR'
        )
          return walk(node) || [node, node.childNodes.length];
        if (left <= 0) return [parent, i];
        if (left <= count) return [parent, i + 1];
        left -= count;
      }
      return null;
    };
    return walk(root) || [root, root.childNodes.length];
  };
  const range = document.createRange();
  range.setStart(...point(caret.start));
  range.setEnd(...point(caret.end));
  const selected = window.getSelection();
  selected?.removeAllRanges();
  selected?.addRange(range);
}

export const MessageEditor = forwardRef<
  MessageEditorHandle,
  {
    accountId?: number;
    recipient: string;
    value: string;
    textStyles?: RichStyle[];
    mentions?: Mention[];
    onCaret?: (position: Caret | null) => void;
    onMentionKey?: (event: KeyboardEvent<HTMLDivElement>) => boolean;
    mentionListId?: string;
    activeMentionId?: string;
    onFormatState?: (codes: string[]) => void;
    onRichPaste?: () => void;
    onPasteImages?: (files: File[]) => void;
    formatting?: boolean;
    allowFormatting?: boolean;
    sendOnEnter?: boolean;
    placeholder?: string;
    blocked: boolean;
    onChange: (text: string, styles: RichStyle[], mentions: Mention[]) => void;
    onSend: () => void;
  }
>(function MessageEditor(
  {
    accountId,
    recipient,
    value,
    textStyles = emptyStyles,
    mentions = noMentions,
    onCaret,
    onMentionKey,
    mentionListId,
    activeMentionId,
    onFormatState,
    onRichPaste,
    onPasteImages,
    formatting,
    allowFormatting = true,
    sendOnEnter = true,
    placeholder,
    blocked,
    onChange,
    onSend,
  },
  api,
) {
  const root = useRef<HTMLDivElement>(null);
  const caret = useRef<Caret>({ start: value.length, end: value.length });
  const pending = useRef<Caret | null>(null);
  const composing = useRef(false);
  const undo = useRef<{ text: string; styles: RichStyle[]; mentions: Mention[]; caret: Caret }[]>(
    [],
  );
  const redo = useRef<{ text: string; styles: RichStyle[]; mentions: Mention[]; caret: Caret }[]>(
    [],
  );
  const typing = useRef<string[] | undefined>();
  const artwork = useEmojiArtwork(accountId);
  const rendered = useRef<{
    text: string;
    ranges: RichStyle[];
    tags: Mention[];
    artwork: typeof artwork;
  }>();
  const paint = (text: string, selected?: Caret, ranges = textStyles, tags = mentions) => {
    const el = root.current;
    if (!el || composing.current) return;
    let offset = 0;
    const nodes = text
      ? text.split('\n').map((line) => {
          const block = document.createElement('div');
          const lineCodes = codesAt(ranges, offset);
          const list = lineCodes.find((c) => c.startsWith('lst_'));
          if (list) block.dataset.list = list;
          const indent = Number(lineCodes.find((c) => c.startsWith('ind_'))?.slice(4) || 0);
          if (indent) block.style.marginLeft = `${indent}px`;
          for (const token of emojiTokens(line, accountId)) {
            if (!token.sprite || !token.position) {
              for (let i = 0; i < token.text.length;) {
                const marks = codesAt(ranges, offset + i),
                  signature = marks.join(',');
                const tag = tags.find((m) => offset + i >= m.pos && offset + i < m.pos + m.len);
                let end = i + 1;
                while (
                  end < token.text.length &&
                  codesAt(ranges, offset + end).join(',') === signature &&
                  tags.find((m) => offset + end >= m.pos && offset + end < m.pos + m.len) === tag
                )
                  end++;
                const part = document.createElement('span');
                Object.assign(part.style, richCss(marks));
                if (tag) {
                  part.style.color = 'var(--zt-blue, #005ae0)';
                  part.dataset.mention = tag.uid;
                }
                part.textContent = token.text.slice(i, end);
                block.append(part);
                i = end;
              }
              offset += token.text.length;
              continue;
            }
            const span = document.createElement('span');
            span.contentEditable = 'false';
            span.dataset.emoji = token.text;
            span.className = styles.editorEmoji;
            span.setAttribute('role', 'img');
            span.setAttribute('aria-label', token.text);
            span.title = token.text;
            span.style.backgroundImage = `url("${token.sprite}")`;
            span.style.backgroundPosition = token.position;
            block.append(span);
            offset += token.text.length;
          }
          if (!line) {
            const br = document.createElement('br');
            br.dataset.editorTail = '';
            block.append(br);
          }
          offset++;
          return block;
        })
      : [];
    el.replaceChildren(...nodes);
    rendered.current = { text, ranges, tags, artwork };
    if (selected) {
      caret.current = selected;
      restore(el, selected);
    }
  };
  useLayoutEffect(() => {
    if (!value) {
      typing.current = undefined;
      onFormatState?.([]);
    }
    const previous = rendered.current;
    if (
      previous?.text === value &&
      previous.ranges === textStyles &&
      previous.tags === mentions &&
      previous.artwork === artwork
    ) {
      pending.current = null;
      return;
    }
    const focused = document.activeElement === root.current;
    const saved = pending.current || (root.current && selection(root.current)) || caret.current;
    paint(value, focused ? saved : undefined);
    pending.current = null;
    // Browser owns the editing DOM, React owns its serialized text and emoji artwork.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, textStyles, mentions, artwork]);
  useEffect(() => {
    const save = () => {
      if (root.current && document.activeElement === root.current) {
        const next = selection(root.current);
        if (next) {
          const changed = next.start !== caret.current.start || next.end !== caret.current.end;
          caret.current = next;
          onCaret?.(next);
          if (changed) typing.current = undefined;
          onFormatState?.(
            typing.current ??
              codesAt(
                textStyles,
                Math.max(0, next.start === next.end ? next.start - 1 : next.start),
              ),
          );
        }
      }
    };
    document.addEventListener('selectionchange', save);
    return () => document.removeEventListener('selectionchange', save);
  }, [textStyles, onFormatState, onCaret]);
  const commit = (
    next: string,
    pos: Caret,
    ranges = editStyles(value, next, textStyles, typing.current),
    tags = editMentions(value, next, mentions),
    nativeInput = false,
  ) => {
    if (blocked || next.length > 2000 || !validRichStyles(ranges, next)) return false;
    if (
      next !== value ||
      JSON.stringify(ranges) !== JSON.stringify(textStyles) ||
      JSON.stringify(tags) !== JSON.stringify(mentions)
    ) {
      undo.current.push({ text: value, styles: textStyles, mentions, caret: { ...caret.current } });
      if (undo.current.length > 100) undo.current.shift();
      redo.current = [];
    }
    pending.current = pos;
    caret.current = pos;
    // Ordinary typing already updated the browser DOM and caret. Replacing it
    // on every key forces layout/selection work and interrupts IME composition.
    const keepNative =
      nativeInput &&
      !!next &&
      !textStyles.length &&
      !mentions.length &&
      !ranges.length &&
      !tags.length &&
      !root.current?.querySelector('[data-emoji], [data-mention]') &&
      !emojiTokens(next, accountId).some((token) => token.sprite && token.position);
    if (keepNative) rendered.current = { text: next, ranges, tags, artwork };
    else paint(next, pos, ranges, tags);
    onChange(next, ranges, tags);
    onCaret?.(pos);
    return true;
  };
  const insertText = (text: string, pastedStyles?: RichStyle[]) => {
    const current = root.current;
    const saved =
      (current && document.activeElement === current && selection(current)) || caret.current;
    const start = Math.min(value.length, saved.start),
      end = Math.min(value.length, saved.end);
    const next = value.slice(0, start) + text + value.slice(end);
    const pos = start + text.length;
    if (blocked || next.length > 2000) return false;
    current?.focus();
    const ranges =
      pastedStyles &&
      packStyles(
        next,
        Array.from({ length: next.length }, (_, i) =>
          i < start
            ? codesAt(textStyles, i)
            : i < pos
              ? codesAt(pastedStyles, i - start)
              : codesAt(textStyles, end + i - pos),
        ),
      );
    return commit(next, { start: pos, end: pos }, ranges);
  };
  const insertMention = (member: MentionMember, range: { pos: number; len: number }) => {
    const inserted = '@' + member.name;
    const next = value.slice(0, range.pos) + inserted + ' ' + value.slice(range.pos + range.len);
    const tags = [
      ...editMentions(value, next, mentions),
      { pos: range.pos, len: inserted.length, uid: member.id, type: (member.all ? 1 : 0) as 0 | 1 },
    ].sort((a, b) => a.pos - b.pos);
    root.current?.focus();
    const pos = range.pos + inserted.length + 1;
    return commit(next, { start: pos, end: pos }, undefined, tags);
  };
  const format = (code: string) => {
    if (blocked) return;
    if (code === 'undo' || code === 'redo') {
      root.current?.focus();
      history(code === 'redo');
      return;
    }
    const pos = (root.current && selection(root.current)) || caret.current;
    let { start, end } = pos;
    const block = /^(lst_|indent|outdent)/.test(code);
    if (block) {
      start = value.lastIndexOf('\n', start - 1) + 1;
      const lineEnd = value.indexOf('\n', Math.max(start, end - 1));
      end = lineEnd < 0 ? value.length : lineEnd + 1;
    }
    const current =
      typing.current ??
      codesAt(textStyles, Math.max(0, pos.start === pos.end ? pos.start - 1 : pos.start));
    const selected = Array.from({ length: end - start }, (_, i) => codesAt(textStyles, start + i));
    const remove = selected.length
      ? selected.every((c) => c.includes(code))
      : current.includes(code);
    const change = (marks: string[]) => {
      if (code === 'clear') return [];
      if (code === 'indent' || code === 'outdent') {
        const n = Math.max(
          0,
          Math.min(
            50,
            Number(marks.find((c) => c.startsWith('ind_'))?.slice(4) || 0) +
              (code === 'indent' ? 10 : -10),
          ),
        );
        return [...marks.filter((c) => !c.startsWith('ind_')), ...(n ? [`ind_${n}`] : [])];
      }
      return [...marks.filter((c) => family(c) !== family(code)), ...(!remove ? [code] : [])];
    };
    if (start === end) {
      typing.current = change(current);
      onFormatState?.(typing.current);
      root.current?.focus();
      return;
    }
    const matrix = Array.from({ length: value.length }, (_, i) =>
      i >= start && i < end ? change(codesAt(textStyles, i)) : codesAt(textStyles, i),
    );
    root.current?.focus();
    if (commit(value, pos, packStyles(value, matrix))) onFormatState?.(change(current));
  };
  useImperativeHandle(api, () => ({
    focus: () => root.current?.focus(),
    insertText,
    insertMention,
    format,
  }));
  const history = (reverse: boolean) => {
    const source = reverse ? redo : undo,
      target = reverse ? undo : redo;
    const entry = source.current.pop();
    if (!entry || blocked) return;
    target.current.push({ text: value, styles: textStyles, mentions, caret: { ...caret.current } });
    pending.current = entry.caret;
    caret.current = entry.caret;
    typing.current = undefined;
    onChange(entry.text, entry.styles, entry.mentions);
    onCaret?.(entry.caret);
    paint(entry.text, entry.caret, entry.styles, entry.mentions);
    onFormatState?.(codesAt(entry.styles, Math.max(0, entry.caret.start - 1)));
  };
  const captureInput = (inputType = '') => {
    const el = root.current;
    if (!el || composing.current) return;
    let next = plain(el);
    // Removing the last visible content also clears residual empty browser
    // blocks (including drafts produced by the old BR serializer). Explicit
    // Shift+Enter still goes through insertText and retains intentional lines.
    if (inputType.startsWith('delete') && !next.trim()) next = '';
    const selected = selection(el) || caret.current;
    const pos = {
      start: Math.min(selected.start, next.length),
      end: Math.min(selected.end, next.length),
    };
    if (!commit(next, pos, undefined, undefined, true))
      paint(value, {
        start: Math.min(pos.start, value.length),
        end: Math.min(pos.end, value.length),
      });
  };
  return (
    <div
      ref={root}
      role="textbox"
      aria-label={`Nhập tin nhắn tới ${recipient}`}
      aria-multiline="true"
      aria-controls={mentionListId}
      aria-activedescendant={activeMentionId}
      aria-autocomplete="list"
      onFocus={() => onCaret?.((root.current && selection(root.current)) || caret.current)}
      onBlur={() => onCaret?.(null)}
      aria-readonly={blocked}
      contentEditable={!blocked}
      suppressContentEditableWarning
      tabIndex={0}
      className={styles.messageEditor}
      data-placeholder={
        placeholder ||
        (formatting
          ? 'Nhấn Ctrl + Shift + X để định dạng tin nhắn'
          : `Nhập @, tin nhắn tới ${recipient}`)
      }
      data-empty={!value}
      onInput={(event) => captureInput((event.nativeEvent as InputEvent).inputType)}
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={() => {
        composing.current = false;
        captureInput();
      }}
      onBeforeInput={(event) => {
        const type = (event.nativeEvent as InputEvent).inputType;
        if (type === 'historyUndo' || type === 'historyRedo') {
          event.preventDefault();
          history(type === 'historyRedo');
        }
      }}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing || event.keyCode === 229 || composing.current) return;
        if (onMentionKey?.(event)) return;
        if ((event.ctrlKey || event.metaKey) && ['b', 'i', 'u'].includes(event.key.toLowerCase())) {
          event.preventDefault();
          if (allowFormatting) format(event.key.toLowerCase());
          return;
        }
        if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
          event.preventDefault();
          history(event.key.toLowerCase() === 'y' || event.shiftKey);
          return;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          if (blocked) return;
          if (event.shiftKey || !sendOnEnter) insertText('\n');
          else onSend();
        }
      }}
      onPaste={(event) => {
        event.preventDefault();
        if (blocked) return;
        // Screenshots arrive as clipboard files, often alongside HTML. Prefer
        // the binary image so it is not lost by the rich-text sanitizer.
        const items = Array.from(event.clipboardData.items);
        const files = items
          .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
          .map((item) => item.getAsFile())
          .filter((file): file is File => !!file);
        const images = files.length
          ? files
          : Array.from(event.clipboardData.files).filter((file) => file.type.startsWith('image/'));
        if (images.length) {
          onPasteImages?.(images);
          return;
        }
        const plain = event.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n');
        const rich = allowFormatting
          ? clipboardRichText(event.clipboardData.getData('text/html'))
          : null;
        const equivalent = (value: string) => value.replace(/\s+/g, ' ').trim();
        if (rich && (!plain || equivalent(plain) === equivalent(rich.text))) {
          if (insertText(rich.text, rich.styles) && rich.styles.length) onRichPaste?.();
        } else insertText(plain);
      }}
      onCopy={(event) => {
        const selected = root.current && selection(root.current);
        if (selected) {
          event.preventDefault();
          event.clipboardData.setData('text/plain', value.slice(selected.start, selected.end));
        }
      }}
      onCut={(event) => {
        const selected = root.current && selection(root.current);
        if (selected) {
          event.preventDefault();
          event.clipboardData.setData('text/plain', value.slice(selected.start, selected.end));
          if (!blocked) insertText('');
        }
      }}
      onDrop={(event) => event.preventDefault()}
    />
  );
});

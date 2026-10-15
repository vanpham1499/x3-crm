// Add paragraphs at the caret without removing the user's selected text.
export function insertTemplateText(current: string, texts: string[], caret = current.length) {
  const position = Math.max(0, Math.min(current.length, caret));
  const before = current.slice(0, position);
  const after = current.slice(position);
  const body = texts
    .map((text) => text.trim())
    .filter(Boolean)
    .join('\n\n');
  if (!body) return { text: current, caret: position };
  const prefix = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
  const suffix = after && !after.startsWith('\n\n') ? (after.startsWith('\n') ? '\n' : '\n\n') : '';
  return { text: before + prefix + body + suffix + after, caret: (before + prefix + body).length };
}

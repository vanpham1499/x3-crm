// Shared wire projection for chat text and inbox previews; never return native HTML.
export function normalizeInline(tokens, content) {
  if (!Array.isArray(tokens) || tokens.length > 10000) return [];
  const result = tokens.map((token) => {
    const value =
      typeof token?.text === "string" ? token.text.slice(0, 50000) : "";
    let sprite;
    try {
      const parsed = new URL(token?.sprite);
      if (
        parsed.protocol === "https:" &&
        /^(?:chat\.zalo\.me|(?:[a-z0-9-]+\.)*zadn\.vn)$/.test(parsed.hostname)
      )
        sprite = parsed.href;
    } catch {}
    return sprite && /^-?[\d.]+%\s+-?[\d.]+%$/.test(token?.position || "")
      ? { text: value, sprite, position: token.position }
      : { text: value };
  });
  return result.map((t) => t.text).join("") === content ? result : [];
}

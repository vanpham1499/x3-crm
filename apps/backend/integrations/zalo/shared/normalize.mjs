/** Deliberate allowlist. Raw envelopes, cookies, keys and unknown fields never leave the client. */
export function normalizeMessage(raw, accountId, receivedAt = Date.now()) {
  const str = (v, max = 256) =>
    typeof v === "string" || typeof v === "number"
      ? String(v).slice(0, max)
      : "";
  const identity = (v) => {
    if (typeof v === "number" && !Number.isSafeInteger(v)) return "";
    const s = typeof v === "string" || typeof v === "number" ? String(v) : "";
    return s.length <= 128 && /^[\w-]+$/.test(s) ? s : "";
  };
  if (!raw || typeof raw !== "object" || !accountId) return null;
  // _processChatMessages also receives control envelopes during offline sync.
  // The native processor routes these to deletion/undo/replacement/personal
  // board handlers, not ordinary conversation messages. Archiving them as
  // kind=other used to create ID-only implicit contacts/conversations in CRM.
  // Keep unknown content and actual recall bubbles (chat.delete.everyone).
  if (["chat.delete", "chat.undo", "chat.e2ee.replace", "chat.list.action", "chat.todo"].includes(raw.msgType) ||
      raw.content?.action === "msginfo.actionlist") return null;
  const id = identity(raw.msgId);
  if (!id || id === "0" || id.startsWith("local_")) return null;
  const from = identity(raw.uidFrom ?? raw.fromUid);
  const to = identity(raw.idTo ?? raw.toUid);
  if (!from) return null;
  const group = raw.isGroup === true || raw.isGroup === 1;
  const outgoing = from === "0" || from === String(accountId);
  const threadId = group
    ? (to || identity(raw.msgKey)).replace(/^g/, "")
    : outgoing
      ? to
      : from;
  if (!threadId || threadId === "0") return null;
  let timestamp = Number(raw.ts ?? raw.serverTime ?? raw.sendDttm);
  if (timestamp > 0 && timestamp < 1e12) timestamp *= 1000;
  if (
    !Number.isFinite(timestamp) ||
    timestamp < 1e12 ||
    timestamp > receivedAt + 240000
  )
    timestamp = receivedAt;
  const type = str(raw.msgType, 80).toLowerCase();
  const content = raw.content ?? raw.message;
  const kind =
    type.includes("photo") || type.includes("image")
      ? "image"
      : type === "chat.video.msg" || type === "chat.video"
        ? "video"
        : type === "chat.voice" || type === "chat.audio"
          ? "audio"
          : type.includes("file")
            ? "file"
            : typeof content === "string" &&
                (!type || type === "webchat" || type.includes("text"))
              ? "text"
              : "other";
  const event = {
    externalId: id,
    threadId,
    threadType: group ? "group" : "user",
    senderId: outgoing ? String(accountId) : from,
    direction: outgoing ? "out" : "in",
    kind,
    sentAt: new Date(timestamp).toISOString(),
    attachments: [],
  };
  if (kind === "text") {
    if (content.length > 100000) throw new Error("MESSAGE_TEXT_LIMIT");
    event.text = content;
  }
  if (
    ["image", "file", "video", "audio"].includes(kind) &&
    content &&
    typeof content === "object" &&
    !Array.isArray(content)
  ) {
    let params = {};
    try {
      if (typeof content.params === "string" && content.params.length < 50000)
        params = JSON.parse(content.params);
      else if (
        content.params &&
        typeof content.params === "object" &&
        !Array.isArray(content.params)
      )
        params = content.params;
    } catch {}
    if (!params || typeof params !== "object" || Array.isArray(params))
      params = {};
    // /Bne (26.9.10) maps photo oriUrl to params.hd || content.href.
    // Thus the field name "oriUrl" is not evidence of original upload bytes.
    // HvZx's Original badge requires is_original === 1; preserve this as a
    // declaration, not a byte-level guarantee. Never silently select thumb.
    const candidates =
      kind === "image"
        ? [
            [content.oriUrl, "oriUrl"],
            [params.hd, "params.hd"],
            [content.hdUrl, "hdUrl"],
            [content.href, "href"],
            [content.normalUrl, "normalUrl"],
          ]
        : kind === "audio"
          ? [
              [
                typeof params.m4a === "string"
                  ? params.m4a.replace(/\s/g, "")
                  : null,
                "params.m4a",
              ],
              [content.href, "href"],
            ]
          : kind === "video"
            ? [
                [content.oriUrl, "oriUrl"],
                [content.href, "href"],
              ]
            : [
                [content.href, "href"],
                [content.oriUrl, "oriUrl"],
              ];
    const encrypted = (value) => {
      if (typeof value !== "string") return false;
      let decoded = value;
      try {
        decoded = decodeURIComponent(value);
      } catch {}
      // sg3c stores the native AES key/IV/tag in this query. Neither the URL
      // nor that material may leave the renderer; use an existing native cache.
      return /[?&#]e2esession(?:=|&|#|$)/i.test(decoded);
    };
    const safeUrl = (value) => {
      if (typeof value !== "string" || value.length > 8192 || encrypted(value))
        return null;
      try {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password
          ? url.href
          : null;
      } catch {
        return null;
      }
    };
    // Do not fall back from an encrypted representation to a different,
    // potentially lower-quality representation without explicit provenance.
    const requiresNative = candidates.some(([value]) => encrypted(value));
    const selected = requiresNative
      ? null
      : candidates.find(([value]) => safeUrl(value));
    const source = selected ? safeUrl(selected[0]) : null;
    const thumbnailOnly =
      !source &&
      !requiresNative &&
      !!(safeUrl(content.thumbUrl) || safeUrl(content.thumb));
    let sourceQuality = "unavailable";
    if (source) {
      sourceQuality =
        kind === "image"
          ? params.is_original === 1
            ? "original-declared"
            : params.hd || content.hdUrl
              ? "hd"
              : "standard"
          : kind === "file"
            ? "file"
            : kind === "video"
              ? "video"
              : "audio";
    } else if (thumbnailOnly) sourceQuality = "thumbnail";
    const attachment = {
      name: str(
        content.title ||
          params.fileName ||
          (kind === "audio" ? `voice-${id}.aac` : `${kind}-${id}`),
        255,
      ),
      // Connector-private provenance; ingestionEvents strips these fields.
      sourceQuality,
      sourceState: requiresNative
        ? "native-decryption-required"
        : source
          ? "available"
          : thumbnailOnly
            ? "thumbnail-only"
            : "source-unavailable",
    };
    if (source) {
      attachment.url = source;
      attachment.sourceField = selected[1];
    }
    const size = Number(
      params.fileSize ??
        (kind === "image" ? params.hdSize : undefined) ??
        content.size,
    );
    if (Number.isSafeInteger(size) && size >= 0) attachment.size = size;
    const mime = str(params.mimeType ?? content.mimeType, 128);
    if (/^[\w.+-]+\/[\w.+-]+$/.test(mime)) attachment.mime = mime;
    const fileId = identity(content.fileId);
    if (fileId) attachment.externalId = fileId;
    event.attachments.push(attachment);
    if (typeof content.description === "string") {
      if (content.description.length > 100000)
        throw new Error("MESSAGE_TEXT_LIMIT");
      event.text = content.description;
    }
  }
  return event;
}

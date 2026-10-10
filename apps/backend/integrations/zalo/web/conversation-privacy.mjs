import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export const privacyKinds = [
  "privacy",
  "ttl",
  "hide",
  "hidden-list",
  "unhide",
  "clear-history",
  "report",
];
export function validPrivacy(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const keys = Object.keys(v).sort().join(",");
  if (v.kind === "privacy") return keys === "kind";
  if (v.kind === "ttl")
    return (
      keys === "duration,kind" &&
      [0, 3600000, 86400000, 604800000, 1209600000, 2592000000].includes(
        v.duration,
      )
    );
  if (v.kind === "hidden-list")
    return (
      keys === "kind,pin" && /^\d{4}$/.test(v.pin) && typeof v.pin === "string"
    );
  if (v.kind === "hide")
    return (
      ["kind,pin", "kind,pin,setup"].includes(keys) &&
      typeof v.pin === "string" &&
      /^\d{4}$/.test(v.pin) &&
      (v.setup === undefined || v.setup === true)
    );
  if (v.kind === "unhide")
    return (
      keys === "kind,pin,targetId" &&
      typeof v.pin === "string" &&
      /^\d{4}$/.test(v.pin) &&
      typeof v.targetId === "string" &&
      /^g?\d{1,30}$/.test(v.targetId)
    );
  if (!/^[a-f0-9-]{36}$/.test(v.requestId || "")) return false;
  if (v.kind === "clear-history") return keys === "kind,requestId";
  return (
    v.kind === "report" &&
    keys === "content,kind,reason,requestId" &&
    Number.isSafeInteger(v.reason) &&
    v.reason >= 0 &&
    typeof v.content === "string" &&
    v.content.length <= 1000 &&
    !/[\x00-\x08]/.test(v.content)
  );
}

// Persist only destructive/report receipts. PINs are never written to receipts/logs.
export async function conversationPrivacy(page, expectedId, body) {
  const { settings, conversationId } = body;
  if (!validPrivacy(settings)) throw Error("INVALID_REQUEST");
  const frame = page
    .frames()
    .find((f) => /^https:\/\/chat\.zalo\.me\//.test(f.url()));
  if (!frame) throw Error("WEB_SETTINGS_NOT_READY");
  const run = (phase) =>
    frame.evaluate(privacyInPage, {
      expectedId,
      conversationId,
      settings,
      phase,
    });
  if (!["clear-history", "report"].includes(settings.kind)) return run("apply");
  const root = path.join(process.env.DATA_DIR || "/data", "privacy-receipts");
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  const hash = (value) =>
    crypto.createHash("sha256").update(value).digest("hex");
  const file = path.join(
    root,
    hash(`${body.owner}:${settings.requestId}`) + ".json",
  );
  const fingerprint = hash(
    JSON.stringify([expectedId, conversationId, settings]),
  );
  try {
    const old = JSON.parse(await fs.readFile(file, "utf8"));
    if (old.fingerprint !== fingerprint)
      throw Error("WEB_ACTION_REQUEST_CONFLICT");
    return old.result;
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  await run("prepare");
  const receipt = { fingerprint, result: { status: "unknown" } };
  try {
    await fs.writeFile(file, JSON.stringify(receipt), {
      flag: "wx",
      mode: 0o600,
    });
  } catch (e) {
    if (e.code === "EEXIST") return conversationPrivacy(page, expectedId, body);
    throw e;
  }
  try {
    receipt.result = await run("apply");
  } catch {
    /* Never repeat a destructive operation after an uncertain response. */
  }
  await fs.writeFile(file + ".tmp", JSON.stringify(receipt), { mode: 0o600 });
  await fs.rename(file + ".tmp", file);
  return receipt.result;
}

export async function privacyInPage({
  expectedId,
  conversationId,
  settings,
  phase,
}) {
  let require;
  const id = "zalo-team-privacy-" + Date.now() + Math.random();
  const chunk = [
    [id],
    {
      [id]: (m, e, r) => {
        require = r;
      },
    },
    [[id]],
  ];
  if (!Array.isArray(globalThis.webpackJsonp))
    throw Error("WEB_SETTINGS_NOT_READY");
  globalThis.webpackJsonp.push(chunk);
  if (!require) throw Error("WEB_SETTINGS_NOT_READY");
  delete require.c[id];
  delete require.m[id];
  globalThis.webpackJsonp.splice(globalThis.webpackJsonp.indexOf(chunk), 1);
  const get = (k) =>
    require.c[k]?.exports || (require.m[k] ? require(k) : undefined);
  const core = get("dThN")?.default,
    config = get("NDmK")?.default,
    hidden = get("EFQ6")?.a;
  if (String(core?.userId) !== expectedId) throw Error("WEB_IDENTITY_MISMATCH");
  const ids = get("jDHv")
    ?.ModuleContainer?.resolve(get("iZzu")?.ConvListController)
    ?.getList({ key: get("3xbP")?.c });
  const isHidden = !!hidden?.isThreadHidden(conversationId);
  if (
    !Array.isArray(ids) ||
    (!ids.includes(conversationId) && !globalThis.__zaloTeamPhonePeers?.allows(expectedId,conversationId) &&
      !(isHidden && ["hide", "unhide", "hidden-list"].includes(settings.kind)))
  )
    throw Error("WEB_CONVERSATION_NOT_FOUND");
  if (isHidden && !["hide", "unhide", "hidden-list"].includes(settings.kind))
    throw Error("WEB_CONVERSATION_HIDDEN");
  const group = conversationId.startsWith("g"),
    self =
      conversationId === String(config?.sendToMeId) ||
      conversationId === expectedId;
  const users = get("UiPd")?.default,
    groups = get("Gm1y")?.default;
  const meta = group
    ? await groups.getFullInfoGroupById(
        conversationId,
        settings.kind === "ttl"
          ? get("1pet")?.SRC_GET_PROFILE?.FORCE_GET
          : undefined,
      )
    : { userId: conversationId };
  const permission = get("BkFw")?.c?.(expectedId, meta);
  const allowed =
    get("TeAh")?.c?.getRootConfig?.()?.chat?.config?.chat_privacy_ttl_durations;
  const durations = (
    config?.ttl?.durations || [3600000, 86400000, 604800000, 1209600000, 0]
  ).filter((n) => Number.isSafeInteger(n));
  const ttl = Number(get("vK0c")?.a?.(conversationId) || 0);
  const reasons = (
    get("7upJ")?.a?.getSortedAbuseList(conversationId) || []
  ).map((r) => ({
    id: r.id,
    label: r.vi || r.en || "",
    other: !!get("7upJ")?.a?.isOtherReason(r.id),
  }));
  if (settings.kind === "privacy")
    return {
      ttl,
      canTtl: !!config?.ttl?.enable && !self && permission?.[0] === true,
      ttlReason: permission?.[1] || "",
      durations: durations.map((value) => ({
        value,
        enabled:
          value === 0 || !Array.isArray(allowed) || allowed.includes(value),
      })),
      hidden: isHidden,
      hasPin: !!hidden?.getPIN(),
      canHide: !self && !!hidden?.enableHiddenChat(),
      canReport: !self,
      reasons,
      otherReason: config?.report_v2?.reason_other_id,
    };
  if (settings.kind === "ttl") {
    if (self || !config?.ttl?.enable || permission?.[0] !== true)
      throw Error("WEB_TTL_NOT_ALLOWED");
    if (
      !durations.includes(settings.duration) ||
      (settings.duration !== 0 &&
        Array.isArray(allowed) &&
        !allowed.includes(settings.duration))
    )
      throw Error("WEB_TTL_NOT_ALLOWED");
    await get("fBUP")
      .default.updateAutoDeleteConvers({
        threadId: group ? conversationId.slice(1) : conversationId,
        isGroup: group ? 1 : 0,
        ttl: settings.duration,
      })
      .then(get("kCOK").a);
    // Refresh through the native read thunk; server event remains authoritative.
    await get("ngSF").a.dispatch(get("1egx").b());
    return { status: "confirmed", ttl: settings.duration };
  }
  if (["hide", "hidden-list", "unhide"].includes(settings.kind)) {
    if (!hidden?.enableHiddenChat() || (self && settings.kind === "hide"))
      throw Error("WEB_HIDDEN_UNAVAILABLE");
    const limiter =
      globalThis.__zaloTeamPinAttempts ||
      (globalThis.__zaloTeamPinAttempts = { failures: 0, until: 0 });
    if (Date.now() < limiter.until) throw Error("WEB_PIN_RATE_LIMIT");
    if (settings.kind === "hide" && settings.setup) {
      if (hidden.getPIN()) throw Error("WEB_PIN_ALREADY_SET");
      await hidden.changePIN(settings.pin);
    }
    if (!hidden.isKeyPIN(settings.pin)) {
      limiter.failures++;
      if (limiter.failures >= 5) limiter.until = Date.now() + 60000;
      throw Error("WEB_PIN_INVALID");
    }
    limiter.failures = 0;
    limiter.until = 0;
    if (settings.kind === "hidden-list")
      return {
        hiddenConversations: hidden.getUidsHiddenChat().map((id) => ({
          id,
          name: id.startsWith("g") ? groups.getDName(id) : users.getDName(id),
        })),
      };
    const target =
      settings.kind === "unhide" ? settings.targetId : conversationId;
    if (settings.kind === "unhide" && !hidden.isThreadHidden(target))
      throw Error("WEB_CONVERSATION_NOT_FOUND");
    await hidden.updateItemHiddenChatMulti(
      settings.kind === "hide" ? [target] : [],
      settings.kind === "unhide" ? [target] : [],
    );
    return { status: "confirmed" };
  }
  if (settings.kind === "report") {
    if (
      self ||
      !reasons.some((r) => r.id === settings.reason) ||
      (settings.reason === config?.report_v2?.reason_other_id &&
        !settings.content.trim())
    )
      throw Error("INVALID_REQUEST");
    if (phase === "prepare") return {};
    const result = await core.reportUser({
      uidTo: group ? conversationId.slice(1) : conversationId,
      type: group ? 14 : 2,
      reason: settings.reason,
      content: settings.content.trim(),
    });
    if (result?.data?.error_code !== 0) throw Error("WEB_REPORT_FAILED");
    return { status: "confirmed" };
  }
  if (settings.kind === "clear-history") {
    const manager = get("smi1")?.a;
    if (!manager?.deleteConversation)
      throw Error("WEB_SETTINGS_ADAPTER_CHANGED");
    if (phase === "prepare") return {};
    await manager.deleteConversation(conversationId, false);
    return { status: "confirmed" };
  }
  throw Error("INVALID_REQUEST");
}

export async function assertConversationNotHidden(
  page,
  expectedId,
  conversationId,
) {
  const frame = page
    .frames()
    .find((f) => /^https:\/\/chat\.zalo\.me\//.test(f.url()));
  if (!frame) throw Error("WEB_SETTINGS_NOT_READY");
  await frame.evaluate(
    ({ expectedId, conversationId }) => {
      let require;
      const id = "zalo-team-privacy-guard-" + Date.now() + Math.random();
      const chunk = [
        [id],
        {
          [id]: (m, e, r) => {
            require = r;
          },
        },
        [[id]],
      ];
      globalThis.webpackJsonp.push(chunk);
      delete require.c[id];
      delete require.m[id];
      globalThis.webpackJsonp.splice(globalThis.webpackJsonp.indexOf(chunk), 1);
      if (String(require.c.dThN?.exports?.default?.userId) !== expectedId)
        throw Error("WEB_IDENTITY_MISMATCH");
      const hidden = require.c.EFQ6?.exports?.a;
      if (!hidden?.isThreadHidden) throw Error("WEB_SETTINGS_NOT_READY");
      if (hidden.isThreadHidden(conversationId))
        throw Error("WEB_CONVERSATION_HIDDEN");
    },
    { expectedId, conversationId },
  );
}

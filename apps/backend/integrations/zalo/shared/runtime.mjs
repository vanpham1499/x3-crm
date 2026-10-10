import { normalizeMessage } from "./normalize.mjs";

export const RUNTIME_KEY = "__x3ZaloNativeBridgeV1";
export const RUNTIME_REVISION = "archive-2026-09-30-v4";

// Serialized into the existing native renderer. Only cached modules are inspected;
// no Zalo module is loaded by require(), and no credentials are returned to Node.
export function createRuntimeBridge(options, normalize) {
  const key = "__x3ZaloNativeBridgeV1";
  // Replacement is an internal maintenance operation after durable drain+ack.
  // uninstall rejects a newly arrived unacknowledged event, so retry is safe.
  if (globalThis[key]) {
    const existing = globalThis[key].getStatus();
    if (
      !options.probeOnly &&
      (existing.expectedAccountId !== String(options.expectedAccountId) ||
        existing.version !== options.version ||
        existing.allowSend !== !!options.allowSend ||
        existing.restrictedSelfTestThreadId !==
          (options.restrictedSelfTestThreadId ?? null))
    )
      throw new Error("BRIDGE_CONFIGURATION_MISMATCH");
    if (options.replace && !options.probeOnly) {
      if (existing.accountId !== String(options.expectedAccountId))
        throw new Error("ACCOUNT_MISMATCH");
      globalThis[key].uninstall();
    } else return existing;
  }
  if (
    globalThis.location?.protocol !== "file:" ||
    typeof globalThis.$zelectron?.openDevTool !== "function"
  )
    throw new Error("NATIVE_ZALO_REQUIRED");
  const chunks = globalThis.webpackJsonp;
  if (
    !Array.isArray(chunks) ||
    !chunks.push ||
    chunks.push === Array.prototype.push
  )
    throw new Error("WEBPACK_RUNTIME_UNAVAILABLE");
  const marker = `x3-native-bridge-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let registry;
  const record = [
    [marker],
    {
      [marker]: (module, exports, require) => {
        registry = require;
      },
    },
    [[marker]],
  ];
  try {
    chunks.push(record);
  } finally {
    if (registry?.c) delete registry.c[marker];
    if (registry?.m) delete registry.m[marker];
    const index = chunks.indexOf(record);
    if (index >= 0) chunks.splice(index, 1);
  }
  if (!registry?.c) throw new Error("WEBPACK_CACHE_UNAVAILABLE");
  const cached = (id) => registry.c[id]?.exports;
  const fetcher = cached("dThN")?.default;
  const handler = cached("fdn9")?.a;
  const model = cached("4HQc");
  const constants = cached("1pet");
  const signalClass = cached("GpwQ")?.a;
  const util = cached("z0WU")?.default;
  const clientIds = cached("NMlV")?.a;
  const chat = cached("tcV9")?.a?.Chat;
  const markersOk =
    typeof fetcher?._processChatMessages === "function" &&
    typeof handler?.preProcessChatMsgs === "function" &&
    typeof handler?.processOnlineE2eeMsg === "function";
  const readAccount = () => {
    const a = fetcher?.userId,
      b = handler?.userId;
    return a && b && String(a) === String(b) && /^\d+$/.test(String(a))
      ? String(a)
      : null;
  };
  // Verified against this native build: authenticated socket state is distinct from CDP attachment.
  // Long polling readiness has not been validated, so that fallback deliberately cannot send.
  const nativeOnline = () => {
    try {
      return (
        handler?.isStoped === false &&
        handler?.socket?._authenticated === true &&
        handler.socket.getSocketState() === 1
      );
    } catch {
      return false;
    }
  };
  const sendCallable = () =>
    markersOk &&
    typeof fetcher?.sendMsgObject === "function" &&
    typeof model?.c === "function" &&
    typeof signalClass?._instance?.sendMessageE2ee === "function" &&
    typeof chat?.isE2ee === "function" &&
    typeof util?.getMsgIdSendingFromCliMsgId === "function" &&
    typeof clientIds?.next === "function" &&
    model?.a?.TEXT &&
    constants?.MSG_TEXT !== undefined &&
    constants?.MSG_E2EE !== undefined;
  const accountId = readAccount();
  if (options.probeOnly)
    return {
      native: true,
      implementationRevision: "archive-2026-09-30-v4",
      version: options.version,
      accountId,
      attached: !!(markersOk && accountId),
      connected: !!accountId && nativeOnline(),
      nativeOnline: nativeOnline(),
      hooksAvailable: markersOk,
      capabilities: {
        receive: markersOk && !!accountId && nativeOnline(),
        sendText: !!(sendCallable() && accountId && nativeOnline()),
        attachments: "receive-metadata",
      },
      cachedModules: Object.keys(registry.c).length,
    };
  if (!markersOk || !accountId) throw new Error("NATIVE_SESSION_NOT_READY");
  if (
    !options.expectedAccountId ||
    accountId !== String(options.expectedAccountId)
  )
    throw new Error("ACCOUNT_MISMATCH");
  let active = true,
    sequence = 0,
    acknowledged = 0,
    delivered = 0,
    gap = false,
    rejectedEvents = 0,
    captureErrors = 0,
    skippedEvents = 0;
  const generation = marker,
    buffer = [],
    dispatches = new Map(),
    clientIdMap = new Map();
  const maximum = Math.min(
    10000,
    Math.max(10, Number(options.maxEvents) || 2000),
  );
  const originalReceive = fetcher._processChatMessages,
    originalSend = fetcher.sendMsgObject;
  const ensureAccount = () => {
    if (readAccount() !== accountId) throw new Error("ACCOUNT_CHANGED");
  };
  const recordMessage = (raw) => {
    try {
      ensureAccount();
      const event = normalize(raw, accountId);
      if (!event) {
        skippedEvents++;
        return;
      }
      const clientMessageId = clientIdMap.get(
        String(raw.cliMsgId ?? raw.clientId),
      );
      if (clientMessageId) event.clientMessageId = clientMessageId;
      if (buffer.length >= maximum) {
        gap = true;
        rejectedEvents++;
        return;
      }
      buffer.push({ sequence: ++sequence, event });
    } catch {
      captureErrors++;
      gap = true;
    }
  };
  function onReceive(...args) {
    try {
      if (active && Array.isArray(args[0]?.messages))
        for (const message of args[0].messages) recordMessage(message);
    } catch {
      captureErrors++;
    }
    return Reflect.apply(originalReceive, this, args);
  }
  const externalIdFromResult = (result) => {
    const candidates = [
      result?.msgId,
      result?.data?.msgId,
      result?.message?.msgId,
    ];
    const id = candidates.find(
      (v) => typeof v === "string" || typeof v === "number",
    );
    return id != null && String(id) !== "0" ? String(id) : null;
  };
  function onSend(...args) {
    const result = Reflect.apply(originalSend, this, args);
    try {
      if (result && typeof result.then === "function")
        result
          .then(
            (value) => {
              try {
                if (!active) return;
                const input = args[0],
                  id = externalIdFromResult(value);
                if (!id || !input) return;
                if (input.type === constants.MSG_TEXT)
                  recordMessage({
                    msgId: id,
                    uidFrom: "0",
                    idTo: input.conversationId,
                    isGroup: input.isGroup,
                    cliMsgId: input.clientId,
                    msgType: "webchat",
                    content: input.content?.text,
                    ts: Date.now(),
                  });
              } catch {
                captureErrors++;
              }
            },
            () => {},
          )
          .catch(() => {});
    } catch {
      captureErrors++;
    }
    return result;
  }
  const getStatus = () => {
    const current = readAccount();
    const attached =
      active &&
      current === accountId &&
      fetcher._processChatMessages === onReceive &&
      fetcher.sendMsgObject === onSend;
    const online = nativeOnline(),
      connected = attached && online;
    return {
      native: true,
      implementationRevision: "archive-2026-09-30-v4",
      version: options.version,
      accountId: current,
      expectedAccountId: accountId,
      attached,
      connected,
      nativeOnline: online,
      active,
      allowSend: !!options.allowSend,
      restrictedSelfTestThreadId: options.restrictedSelfTestThreadId ?? null,
      generation,
      buffered: buffer.length,
      gap,
      rejectedEvents,
      captureErrors,
      skippedEvents,
      capabilities: {
        receive: connected,
        sendText: !!(connected && !gap && options.allowSend && sendCallable()),
        attachments: "receive-metadata",
      },
    };
  };
  const bridge = {
    getStatus,
    drain(limit = 100) {
      ensureAccount();
      if (!Number.isSafeInteger(limit) || limit < 1)
        throw new Error("INVALID_NATIVE_DRAIN_LIMIT");
      const records = buffer.slice(0, Math.min(1000, limit));
      if (records.length)
        delivered = Math.max(delivered, records.at(-1).sequence);
      return {
        generation,
        accountId,
        gap,
        records,
      };
    },
    ack(token) {
      ensureAccount();
      if (
        token?.generation !== generation ||
        !Number.isSafeInteger(token.sequence) ||
        token.sequence < acknowledged ||
        token.sequence > delivered
      )
        throw new Error("INVALID_NATIVE_ACK");
      while (buffer[0]?.sequence <= token.sequence) buffer.shift();
      acknowledged = token.sequence;
      return { acknowledged };
    },
    async sendText(request) {
      ensureAccount();
      if (!getStatus().capabilities.sendText)
        throw new Error("SEND_NOT_ENABLED");
      if (
        !request ||
        !["user", "group"].includes(request.threadType) ||
        !/^\d+$/.test(request.threadId) ||
        !/^[\w-]{1,100}$/.test(request.clientMessageId) ||
        typeof request.text !== "string" ||
        !request.text.trim() ||
        request.text.length > 10000
      )
        throw new Error("INVALID_SEND_REQUEST");
      const ensureSelfTest = () => {
        if (
          options.restrictedSelfTestThreadId &&
          (request.threadType !== "user" ||
            request.threadId !== options.restrictedSelfTestThreadId ||
            cached("NDmK")?.default?.sendToMeId !==
              options.restrictedSelfTestThreadId)
        )
          throw new Error("SELF_TEST_DESTINATION_CHANGED");
      };
      ensureSelfTest();
      if (dispatches.has(request.clientMessageId))
        return dispatches.get(request.clientMessageId);
      if (dispatches.size >= 2000) throw new Error("DISPATCH_CAPACITY_REACHED");
      // A rejected/unknown attempt is retained. Retrying needs reconciliation, never auto resend.
      let stage = "model_preparation",
        dispatchStarted = false,
        e2eePreparationStarted = false;
      const task = (async () => {
        const conversationId =
          request.threadType === "group"
            ? `${constants.GROUPID_PREFIX}${request.threadId}`
            : request.threadId;
        const encrypted = !!chat.isE2ee(conversationId);
        const nativeClientId = clientIds.next();
        clientIdMap.set(String(nativeClientId), request.clientMessageId);
        const messageId = util?.getMsgIdSendingFromCliMsgId?.(nativeClientId);
        if (messageId == null) throw new Error("MESSAGE_MODEL_UNAVAILABLE");
        const send = () => {
          ensureAccount();
          ensureSelfTest();
          if (!nativeOnline()) throw new Error("NATIVE_OFFLINE");
          if (!!chat.isE2ee(conversationId) !== encrypted)
            throw new Error("ENCRYPTION_MODE_CHANGED");
          const message = new model.c(
            accountId,
            conversationId,
            messageId,
            nativeClientId,
            constants.MSG_TEXT,
            request.threadType === "group",
          );
          // Same decision as the native controller. sendMessageE2ee invokes its callback without arguments.
          if (encrypted) message.e2eeStatus = constants.MSG_E2EE;
          message.updateMessageContentProp(model.a.TEXT, request.text);
          stage = "native_dispatch";
          dispatchStarted = true;
          return fetcher.sendMsgObject(message, null, null, 0, false, {});
        };
        let response;
        if (encrypted) {
          stage = "e2ee_preparation";
          e2eePreparationStarted = true;
          response = await signalClass._instance.sendMessageE2ee(
            conversationId,
            messageId,
            send,
          );
        } else response = await send();
        const id = externalIdFromResult(response);
        return id
          ? { status: "sent", externalMessageId: id }
          : { status: "uncertain", error: "NO_SERVER_MESSAGE_ID" };
      })().catch((error) => ({
        status:
          dispatchStarted || e2eePreparationStarted ? "uncertain" : "failed",
        error:
          dispatchStarted || e2eePreparationStarted
            ? "NATIVE_SEND_UNCONFIRMED"
            : "NATIVE_PRE_SEND_FAILED",
        diagnostic: {
          stage,
          dispatchStarted,
          errorName: [
            "TypeError",
            "ReferenceError",
            "RangeError",
            "Error",
          ].includes(error?.name)
            ? error.name
            : "NativeError",
        },
      }));
      dispatches.set(request.clientMessageId, task);
      return task;
    },
    uninstall() {
      if (buffer.length) throw new Error("UNACKNOWLEDGED_NATIVE_EVENTS");
      active = false;
      if (fetcher._processChatMessages === onReceive)
        fetcher._processChatMessages = originalReceive;
      if (fetcher.sendMsgObject === onSend)
        fetcher.sendMsgObject = originalSend;
      delete globalThis[key];
      return { stopped: true };
    },
  };
  fetcher._processChatMessages = onReceive;
  fetcher.sendMsgObject = onSend;
  Object.defineProperty(globalThis, key, { configurable: true, value: bridge });
  return getStatus();
}

export function runtimeExpression(options) {
  return `(${createRuntimeBridge.toString()})(${JSON.stringify(options)}, ${normalizeMessage.toString()})`;
}

export function runtimeCall(method, argument) {
  if (!["getStatus", "drain", "ack", "sendText", "uninstall"].includes(method))
    throw new Error("INVALID_NATIVE_METHOD");
  return `globalThis[${JSON.stringify(RUNTIME_KEY)}]?.[${JSON.stringify(method)}](${JSON.stringify(argument)})`;
}

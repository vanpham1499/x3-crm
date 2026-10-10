import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { SenderAttribution } from "./sender-attribution.mjs";

// Persist before submitting: a lost HTTP response or worker restart must never
// turn the same request into a second message. Receipts contain no message text.
export class SendReceipts {
  constructor(root, adapter = nativeText) {
    this.root = root;
    this.adapter = adapter;
    this.attribution = new SenderAttribution(path.join(root, "senders"));
  }
  async send(page, expectedId, body, emit) {
    await fs.mkdir(this.root, { recursive: true, mode: 0o700 });
    const key = crypto
      .createHash("sha256")
      .update(`${body.owner}:${body.requestId}`)
      .digest("hex");
    const file = path.join(this.root, `${key}.json`);
    const fingerprint = crypto
      .createHash("sha256")
      .update(
        JSON.stringify([
          body.accountId,
          expectedId,
          body.conversationId,
          body.text,
          ...(body.sticker ? [body.sticker.id, body.sticker.categoryId] : []),
          ...(body.media ? ["media", body.media.uploadId] : []),
          ...(body.replyTo ? ["replyTo", body.replyTo] : []),
          ...(body.styles?.length ? ["styles", body.styles] : []),
          ...(body.mentions?.length ? ["mentions", body.mentions] : []),
          ...(body.crmSender ? ["crmUserId", body.crmSender.userId] : []),
        ]),
      )
      .digest("hex");
    let previous;
    try {
      previous = JSON.parse(await fs.readFile(file, "utf8"));
    } catch (e) {
      if (e.code !== "ENOENT") throw Error("WEB_SEND_RECEIPT_UNAVAILABLE");
    }
    if (previous) {
      if (previous.fingerprint !== fingerprint)
        throw Error("WEB_SEND_REQUEST_CONFLICT");
      if (previous.result.crmSender)
        await this.attribution.record(body.owner, expectedId, body.conversationId,
          previous.result.clientId, previous.result.crmSender);
      if (previous.result.status === "unknown") {
        const checked = await this.adapter(page, {
          expectedId,
          conversationId: body.conversationId,
          text: body.text,
          styles: body.styles,
          mentions: body.mentions,
          replyTo: body.replyTo,
          sticker: body.sticker,
          media: body.media,
          phase: "check",
          clientId: previous.result.clientId,
        }).catch(() => ({ status: "unknown" }));
        if (checked.status === "sent") {
          previous.result = { ...previous.result, ...checked };
          await fs.writeFile(file + ".tmp", JSON.stringify(previous), {
            mode: 0o600,
          });
          await fs.rename(file + ".tmp", file);
        }
      }
      return previous.result;
    }
    // Reconciliation must never become a new send, even if a receipt was lost.
    if (body.checkOnly) return { status: 'unknown' };
    const args = {
      owner: body.owner,
      accountId: body.accountId,
      expectedId,
      conversationId: body.conversationId,
      text: body.text,
      styles: body.styles,
      mentions: body.mentions,
      replyTo: body.replyTo,
      sticker: body.sticker,
      media: body.media,
    };
    const prepared = await this.adapter(page, { ...args, phase: "prepare" });
    const receipt = {
      fingerprint,
      result: {
        status: "unknown",
        clientId: prepared.clientId,
        requestId: body.requestId,
        ...(body.crmSender ? { crmSender: body.crmSender } : {}),
      },
    };
    // Atomic exclusive creation, including protection against concurrent callers.
    try {
      await fs.writeFile(file, JSON.stringify(receipt), {
        flag: "wx",
        mode: 0o600,
      });
    } catch (e) {
      if (e.code === "EEXIST") return this.send(page, expectedId, body);
      throw Error("WEB_SEND_RECEIPT_UNAVAILABLE");
    }
    if (receipt.result.crmSender)
      await this.attribution.record(body.owner, expectedId, body.conversationId,
        prepared.clientId, receipt.result.crmSender);
    emit?.({
      ...(receipt.result.crmSender ? { crmSender: receipt.result.crmSender } : {}),
      status: "prepared",
      requestId: body.requestId,
      clientId: prepared.clientId,
      partial: true,
    });
    try {
      const result = await this.adapter(page, {
        ...args,
        ...prepared,
        phase: "send",
      });
      receipt.result = { ...receipt.result, ...result };
    } catch {
      // Submission may have reached Zalo. Never retry a write automatically.
    }
    if (receipt.result.crmSender && receipt.result.clientId !== prepared.clientId)
      await this.attribution.record(body.owner, expectedId, body.conversationId,
        receipt.result.clientId, receipt.result.crmSender);
    await fs.writeFile(file + ".tmp", JSON.stringify(receipt), { mode: 0o600 });
    await fs.rename(file + ".tmp", file);
    return receipt.result;
  }
}

export async function nativeText(page, args) {
  const frame = page
    .frames()
    .find((f) => /^https:\/\/chat\.zalo\.me\//.test(f.url()));
  if (!frame) throw Error("WEB_ACCOUNT_OFFLINE");
  return frame
    .evaluate(
      async ({
        expectedId,
        conversationId,
        text,
        styles,
        mentions,
        replyTo,
        sticker,
        media,
        phase,
        clientId,
      }) => {
        let require;
        const id = "zalo-team-send-" + crypto.randomUUID();
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
          throw Error("WEB_SEND_ADAPTER_CHANGED");
        globalThis.webpackJsonp.push(chunk);
        if (!require) throw Error("WEB_SEND_ADAPTER_CHANGED");
        delete require.c[id];
        delete require.m[id];
        globalThis.webpackJsonp.splice(
          globalThis.webpackJsonp.indexOf(chunk),
          1,
        );
        const get = (key) => require.c[key]?.exports;
        const user = get("dThN")?.default;
        if (String(user?.userId || "") !== expectedId)
          throw Error("WEB_IDENTITY_MISMATCH");
        const visible = get("jDHv")
          ?.ModuleContainer?.resolve(get("iZzu")?.ConvListController)
          ?.getList({ key: get("3xbP")?.c });
        if ((!Array.isArray(visible) || !visible.includes(conversationId)) && !globalThis.__zaloTeamPhonePeers?.allows(expectedId,conversationId))
          throw Error("WEB_CONVERSATION_NOT_FOUND");
        const model = get("4HQc"),
          kinds = get("1pet"),
          generator = get("NMlV")?.a;
        const encryption = get("GpwQ")?.a?.instance();
        const config = get("NDmK")?.default;
        if (
          !model?.c ||
          (styles?.length &&
            (typeof model.c.prototype.updateMessageFormat !== "function" ||
              typeof model.c.prototype.getAdditionalParams !== "function")) ||
          !user.sendMsgObject ||
          !generator?.next ||
          !encryption?.isOnE2ee ||
          !encryption?.sendMessageE2ee ||
          typeof kinds?.MSG_TEXT !== "number"
        )
          throw Error("WEB_SEND_ADAPTER_CHANGED");
        if (
          !sticker &&
          !media &&
          (!text?.trim() ||
            text.length > Math.min(2000, config?.limitSendTextPerTurn || 2000))
        )
          throw Error("WEB_SEND_TEXT_TOO_LONG");
        if (phase === "check") {
          const bounded = async (promise) => {
            let timer;
            try {
              return await Promise.race([
                promise,
                new Promise((_, reject) => {
                  timer = setTimeout(
                    () => reject(Error("WEB_SEND_CHECK_TIMEOUT")),
                    18000,
                  );
                }),
              ]);
            } finally {
              clearTimeout(timer);
            }
          };
          await bounded(
            get("4wTQ")?.default?.getLastMessagesForConversation(
              conversationId,
              {
                forceGetLast: true,
              },
            ),
          );
          const rows = await bounded(
            get("Vd+K")?.b?.getMessageFromConversationByLimit(
              conversationId,
              100,
              {},
            ),
          );
          const found = rows?.find(
            (m) =>
              String(m.cliMsgId) === clientId &&
              (String(m.fromUid) === "0" || String(m.fromUid) === expectedId) &&
              /^\d+$/.test(String(m.msgId)) &&
              String(m.msgId) !== "0",
          );
          return found
            ? {
                status: "sent",
                messageId: String(found.msgId),
                clientId,
                time: Number(found.sendDttm) || Date.now(),
              }
            : { status: "unknown" };
        }
        let nativeSticker;
        if (sticker) {
          const manager = get("vSga")?.default;
          if (
            !manager?.getStickerIfNotExist ||
            typeof kinds.MSG_STICKER !== "number"
          )
            throw Error("WEB_STICKER_ADAPTER_CHANGED");
          let stickerTimer;
          try {
            nativeSticker = await Promise.race([
              manager.getStickerIfNotExist(sticker.categoryId, sticker.id),
              new Promise((_, reject) => {
                stickerTimer = setTimeout(
                  () => reject(Error("WEB_STICKER_TIMEOUT")),
                  15000,
                );
              }),
            ]);
          } finally {
            clearTimeout(stickerTimer);
          }
          if (
            !nativeSticker ||
            Number(nativeSticker.id) !== sticker.id ||
            Number(nativeSticker.cateId) !== sticker.categoryId ||
            get("Ullg")?.a?.Helper?.isPhotoSticker(nativeSticker)
          )
            throw Error("WEB_STICKER_UNAVAILABLE");
        }
        let photoProcessor;
        if (media) {
          if (media.size > 25 * 1024 * 1024)
            throw Error("WEB_UPLOAD_TOO_LARGE");
          if (
            typeof kinds.MSG_FILE !== "number" ||
            typeof kinds.MSG_PHOTO !== "number"
          )
            throw Error("WEB_MEDIA_ADAPTER_CHANGED");
          if (media.kind === "image") {
            // Photo processing is lazy-loaded by the native toolbar; initialize
            // the verified module even when this profile has never opened a chat.
            try {
              const photoModule = get("Mf3M") || require("Mf3M");
              photoProcessor = get("jDHv")?.ModuleContainer?.resolve(
                photoModule?.a?.IPhotoMessageProcessorDef,
              );
            } catch {
              throw Error("WEB_MEDIA_ADAPTER_CHANGED");
            }
            if (
              !photoProcessor?.process ||
              !photoProcessor?.getCurrentPhotoResolutionMode
            )
              throw Error("WEB_MEDIA_ADAPTER_CHANGED");
          }
        }
        let quote;
        if (replyTo) {
          const original = await get("XS0u")?.default?.getMessage(
            replyTo,
            conversationId,
          );
          if (
            !original ||
            String(original.toUid) !== conversationId ||
            String(original.msgId) !== replyTo ||
            [kinds.MSG_UNDO, kinds.MSG_DEL_EVERYONE].includes(original.msgType)
          )
            throw Error("WEB_REPLY_UNAVAILABLE");
          let cliMsgType = original.msgType;
          for (const name of [
            "PHOTO",
            "VOICE",
            "CONTACT",
            "GIF",
            "STICKER",
            "VIDEO",
            "FILE",
            "DOODLE",
            "LOCATION",
            "ZINSTANT_V2",
          ])
            if (original.msgType === kinds["MSG_" + name])
              cliMsgType = kinds["CLI_MSG_TYPE_" + name];
          const fromUid =
            String(original.fromUid) === "0"
              ? expectedId
              : String(original.fromUid);
          const attach =
            typeof original.message === "object"
              ? { ...original.message }
              : null;
          if (attach) {
            attach.href ||= attach.oriUrl;
            attach.thumb ||= attach.thumbUrl;
            attach.description ||= attach.desc;
          }
          quote = {
            fromUid,
            fromD:
              get("UiPd")?.default?.getDName(fromUid) || original.dName || "",
            msgId: original.msgId,
            cliMsgId: original.cliMsgId,
            cliMsgType,
            attach,
            msg: [kinds.MSG_PHOTO, kinds.MSG_GIF].includes(original.msgType)
              ? original.message.title
              : original.message,
            ttl: original.ttl,
            ts: original.serverTime,
          };
        }
        if (phase === "prepare") return { clientId: String(generator.next()) };
        let nativeFile, photo, photoUrl;
        const release = () => {
          if (photoUrl?.startsWith("blob:")) URL.revokeObjectURL(photoUrl);
        };
        if (media) {
          try {
            nativeFile = new File(
              [Uint8Array.from(atob(media.bytes), (c) => c.charCodeAt(0))],
              media.name,
              { type: media.mime },
            );
            if (nativeFile.size !== media.size) throw Error("INVALID_FILE");
            if (photoProcessor) {
              const mode = photoProcessor.getCurrentPhotoResolutionMode();
              const encrypted = encryption.isOnE2ee(conversationId);
              const jxl = get("DhYn")?.a?.jxl;
              const encode =
                mode !== get("afi+")?.PHOTO_RESOLUTION_MODE?.ORIGINAL &&
                Boolean(
                  encrypted ? jxl?.enable_upload_e2ee : jxl?.enable_upload,
                );
              const processed = await photoProcessor.process(nativeFile, {
                clientId,
                shouldEncodeJxl: encode,
                photoResolutionMode: mode,
              });
              photoUrl = processed.blobUrl;
              photo = {
                width: processed.width,
                height: processed.height,
                file: processed.file,
                gifFile: processed.isGif ? nativeFile : null,
                img: photoUrl,
                name: processed.file.name,
                orientation: processed.orientation,
                title: "",
                previewThumb: processed.previewThumb,
                jxlStatus: encode && !processed.fallbackToNonJxl ? 1 : 0,
                photoResolutionMode: mode,
              };
            }
          } catch {
            release();
            return { status: "failed", error: "WEB_MEDIA_PROCESS_FAILED" };
          }
        }
        const message = new model.c(
          expectedId,
          conversationId,
          clientId,
          clientId,
          media
            ? photo
              ? kinds.MSG_PHOTO
              : kinds.MSG_FILE
            : sticker
              ? kinds.MSG_STICKER
              : kinds.MSG_TEXT,
          conversationId.startsWith("g"),
        );
        if (media)
          message.updateMessageContentProp(
            photo ? model.a.PHOTOS : model.a.FILES,
            [photo || nativeFile],
          );
        else
          message.updateMessageContentProp(
            sticker ? model.a.STICKER : model.a.TEXT,
            sticker
              ? {
                  id: nativeSticker.id,
                  catId: nativeSticker.cateId,
                  type: nativeSticker.type,
                  extInfo: nativeSticker.fssInfo,
                  fssInfo: nativeSticker.fssInfo,
                }
              : text,
          );
        if (mentions?.length)
          message.updateMessageContentProp(model.a.MENTION, mentions);
        if (quote) message.updateMessageContentProp(model.a.QUOTE, quote);
        if (styles?.length) message.updateMessageFormat(text, styles);
        const encrypted = encryption.isOnE2ee(conversationId);
        if (encrypted) message.e2eeStatus = kinds.MSG_E2EE;
        // Native ChatController passes RTF ranges separately to the transport.
        // content.rtf alone only formats the client's local/optimistic record.
        const submit = () =>
          styles?.length
            ? user.sendMsgObject(
                message,
                null,
                null,
                kinds.RETRY_MSG_TIMEOUT_DEFAULT,
                false,
                message.getAdditionalParams(),
              )
            : user.sendMsgObject(message);
        let timer;
        try {
          const response = await Promise.race([
            (encrypted
              ? encryption.sendMessageE2ee(
                  conversationId,
                  message.msgId,
                  submit,
                )
              : submit()
            ).finally(release),
            new Promise((_, reject) => {
              timer = setTimeout(
                () => reject(Error("WEB_SEND_TIMEOUT")),
                media ? 150000 : 30000,
              );
            }),
          ]);
          if (!response?.msgId || String(response.msgId) === "0")
            return { status: "unknown" };
          if (nativeSticker) {
            try {
              const mod = get("vSga");
              mod.default.addStickerToRecentList(
                nativeSticker,
                mod.UPDATE_RECENT_TRIGGER_POINT.PC_SEND,
              );
            } catch {}
          }
          return {
            status: "sent",
            messageId: String(response.msgId),
            clientId: String(response.clientId || clientId),
            time: Number(response.ts) || Date.now(),
          };
        } catch (e) {
          return Number.isInteger(e?.error_code) && e.error_code !== 0
            ? { status: "failed", error: "WEB_SEND_REJECTED" }
            : { status: "unknown" };
        } finally {
          clearTimeout(timer);
        }
      },
      args,
    )
    .catch((error) => {
      const code = String(error?.message || "").match(/\bWEB_[A-Z_]+\b/)?.[0];
      throw Error(code || "WEB_SEND_ADAPTER_CHANGED");
    });
}

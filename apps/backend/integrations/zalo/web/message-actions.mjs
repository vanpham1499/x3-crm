import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

// Persist intent before a mutation. An ambiguous response never resubmits it.
export class MessageActions {
  constructor(root, adapter = nativeAction) {
    this.root = root;
    this.adapter = adapter;
  }
  async run(page, expectedId, body) {
    await fs.mkdir(this.root, { recursive: true, mode: 0o700 });
    const key = crypto
      .createHash("sha256")
      .update(`${body.owner}:${body.requestId}`)
      .digest("hex");
    const fingerprint = crypto
      .createHash("sha256")
      .update(
        JSON.stringify([
          expectedId,
          body.accountId,
          body.conversationId,
          body.messageId,
          body.operation,
          body.reaction,
        ]),
      )
      .digest("hex");
    const file = path.join(this.root, key + ".json");
    try {
      const saved = JSON.parse(await fs.readFile(file, "utf8"));
      if (saved.fingerprint !== fingerprint)
        throw Error("WEB_ACTION_REQUEST_CONFLICT");
      return saved.result;
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    const args = {
      expectedId,
      conversationId: body.conversationId,
      messageId: body.messageId,
      operation: body.operation,
      reaction: body.reaction,
    };
    await this.adapter(page, { ...args, phase: "prepare" });
    const receipt = {
      fingerprint,
      result: { status: "unknown", requestId: body.requestId },
    };
    try {
      await fs.writeFile(file, JSON.stringify(receipt), {
        flag: "wx",
        mode: 0o600,
      });
    } catch (e) {
      if (e.code === "EEXIST") return this.run(page, expectedId, body);
      throw e;
    }
    let timer;
    try {
      receipt.result = {
        ...receipt.result,
        ...(await Promise.race([
          this.adapter(page, { ...args, phase: "apply" }),
          new Promise((_, reject) => {
            timer = setTimeout(
              () => reject(Error("WEB_ACTION_TIMEOUT")),
              25000,
            );
          }),
        ])),
      };
    } catch {
      /* The vendor may have accepted the operation. Do not retry. */
    } finally {
      clearTimeout(timer);
    }
    await fs.writeFile(file + ".tmp", JSON.stringify(receipt), { mode: 0o600 });
    await fs.rename(file + ".tmp", file);
    return receipt.result;
  }
}

export async function nativeAction(page, args) {
  const frame = page
    .frames()
    .find((f) => /^https:\/\/chat\.zalo\.me\//.test(f.url()));
  if (!frame) throw Error("WEB_ACCOUNT_OFFLINE");
  return frame.evaluate(
    async ({
      expectedId,
      conversationId,
      messageId,
      operation,
      reaction,
      phase,
    }) => {
      let require;
      const id = "zalo-team-action-" + crypto.randomUUID();
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
        throw Error("WEB_ACTION_ADAPTER_CHANGED");
      globalThis.webpackJsonp.push(chunk);
      if (!require) throw Error("WEB_ACTION_ADAPTER_CHANGED");
      delete require.c[id];
      delete require.m[id];
      globalThis.webpackJsonp.splice(globalThis.webpackJsonp.indexOf(chunk), 1);
      const get = (key) => require.c[key]?.exports;
      const user = get("dThN")?.default,
        storage = get("XS0u")?.default,
        kinds = get("1pet");
      if (String(user?.userId || "") !== expectedId)
        throw Error("WEB_IDENTITY_MISMATCH");
      const list = get("jDHv")
        ?.ModuleContainer?.resolve(get("iZzu")?.ConvListController)
        ?.getList({ key: get("3xbP")?.c });
      if ((!Array.isArray(list) || !list.includes(conversationId)) && !globalThis.__zaloTeamPhonePeers?.allows(expectedId,conversationId))
        throw Error("WEB_CONVERSATION_NOT_FOUND");
      const m = await storage?.getMessage(messageId, conversationId);
      if (
        !m ||
        String(m.msgId) !== messageId ||
        String(m.toUid) !== conversationId
      )
        throw Error("WEB_MESSAGE_NOT_FOUND");
      const gone = [kinds.MSG_UNDO, kinds.MSG_DEL_EVERYONE].includes(m.msgType);
      if (gone && operation !== "delete")
        throw Error("WEB_MESSAGE_UNAVAILABLE");
      const config = get("NDmK")?.default;
      if (
        operation === "recall" &&
        (!["0", expectedId].includes(String(m.fromUid)) ||
          get("bUXd").default.getTimeNow() - Number(m.sendDttm) >=
            config.recallMessageMaxTime)
      )
        throw Error("WEB_RECALL_NOT_ALLOWED");
      const icons = {
        3: "/-strong",
        5: "/-heart",
        0: ":>",
        32: ":o",
        2: ":-((",
        20: ":-h",
        "-1": "",
      };
      if (operation === "react" && !(reaction in icons))
        throw Error("INVALID_REQUEST");
      if (
        operation === "pin" &&
        !get("YYsv")
          ?.j?.GetManager()
          ?.isMessagePinnable(
            m,
            conversationId.startsWith("g")
              ? kinds.CONVERSATION_TYPE.GROUP
              : kinds.CONVERSATION_TYPE.FRIEND,
          )
      )
        throw Error("WEB_PIN_NOT_ALLOWED");
      if (phase === "prepare") return { status: "ready" };
      if (operation === "star" || operation === "unstar") {
        if (operation === "star" && !m.staredDttm) {
          const now = get("bUXd").default.getTimeNow();
          await storage.addStarMessages([m], now);
          storage.shouldSaveTsStarMsgSchemaChanged(now);
        } else if (operation === "unstar" && m.staredDttm)
          await storage.unstaredMessages([m]);
        const updated = await storage.getMessage(messageId, conversationId);
        if (!!updated?.staredDttm !== (operation === "star"))
          throw Error("WEB_ACTION_UNCONFIRMED");
        return { status: "done", starred: !!updated.staredDttm };
      }
      if (operation === "recall") {
        await user.undoMessage(
          m.msgId,
          m.toUid,
          get("NMlV").a.next(),
          m.cliMsgId,
          get("sg3c").f(m) === kinds.MSG_E2EE,
        );
        if (m.staredDttm) await storage.unstaredMessages([m]);
        return { status: "done" };
      }
      if (operation === "delete") {
        // The native delete-only-me path syncs deletion only across this account.
        await get("smi1").a.deleteMsgsNotUndo(conversationId, [m], false);
        if (await storage.getMessage(messageId, conversationId))
          throw Error("WEB_ACTION_UNCONFIRMED");
        return { status: "done" };
      }
      if (operation === "react") {
        await get("jW2l").a.send(
          conversationId,
          null,
          { rType: reaction, rIcon: icons[reaction] },
          m,
        );
        // Native sender queues and reconciles reactions asynchronously.
        return { status: "queued" };
      }
      if (operation === "pin") {
        const body = (typeof m.message === "object" && m.message) || {};
        const params = {
          client_msg_id: m.cliMsgId,
          global_msg_id: m.msgId,
          senderUid: String(m.fromUid) === "0" ? expectedId : m.fromUid,
          senderName: m.dName || "",
          title:
            typeof m.message === "string"
              ? m.message
              : body.title || body.desc || "",
          msg_type: m.msgType,
        };
        for (const name of [
          "TEXT",
          "PHOTO",
          "FILE",
          "VIDEO",
          "VOICE",
          "GIF",
          "STICKER",
          "CONTACT",
          "DOODLE",
          "LOCATION",
        ])
          if (m.msgType === kinds["MSG_" + name])
            params.msg_type = kinds["CLI_MSG_TYPE_" + name];
        if (body.thumbUrl || body.thumb || body.normalUrl || body.oriUrl)
          params.thumb =
            body.thumbUrl || body.thumb || body.normalUrl || body.oriUrl;
        if (body.href) params.href = body.href;
        if (m.msgType === kinds.MSG_STICKER) params.extra = body;
        else if (m.msgType === kinds.MSG_CONTACT)
          params.extra = { action: body.action, params: body.params };
        else if (body.params) params.extra = body.params;
        const topic = {
          color: config.settings.group.topic_colors[0],
          duration: -1,
          emoji: get("z0WU").default.getUnicodeCorrMSGType(m),
          params,
          repeat: 0,
          startTime: -1,
          type: kinds.MSG_TOPIC,
        };
        if (conversationId.startsWith("g")) {
          const manager = get("jnJr").a.getInstance(conversationId);
          await new Promise((resolve, reject) =>
            manager.checkPinTopic(
              conversationId,
              { ...topic, pinAct: 1, isCreated: true },
              m,
              null,
              resolve,
              reject,
            ),
          );
        } else
          await get("YYsv")
            .j.GetManager()
            .createPinTopic(conversationId, topic);
        return { status: "done" };
      }
      throw Error("INVALID_REQUEST");
    },
    args,
  );
}

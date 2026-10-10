import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export function validTopic(p) {
  if (!p || typeof p !== "object" || Array.isArray(p)) return false;
  const keys = Object.keys(p).sort().join(",");
  if (p.kind === "catalog") return keys === "kind";
  if (
    typeof p.title !== "string" ||
    !p.title.trim() ||
    p.title.length > 3000 ||
    new TextEncoder().encode(p.title.trim()).length > 3700
  )
    return false;
  if (p.kind === "note")
    return keys === "kind,pin,title" && typeof p.pin === "boolean";
  return (
    p.kind === "reminder" &&
    keys === "byDay,kind,onlyMe,repeat,startTime,title" &&
    typeof p.onlyMe === "boolean" &&
    Number.isSafeInteger(p.startTime) &&
    p.startTime > 0 &&
    p.startTime < 8640000000000000 &&
    [
      "none",
      "daily",
      "weekly",
      "weeklyMultiDays",
      "monthly",
      "yearly",
    ].includes(p.repeat) &&
    Array.isArray(p.byDay) &&
    p.byDay.length <= 7 &&
    new Set(p.byDay).size === p.byDay.length &&
    p.byDay.every((d) =>
      ["MO", "TU", "WE", "TH", "FR", "SA", "SU"].includes(d),
    ) &&
    (p.repeat === "weeklyMultiDays" ? p.byDay.length > 0 : p.byDay.length === 0)
  );
}

export class TopicActions {
  constructor(root, adapter = nativeTopic) {
    this.root = root;
    this.adapter = adapter;
  }
  async run(page, expectedId, body) {
    if (!validTopic(body.topic)) throw Error("INVALID_REQUEST");
    const args = {
      expectedId,
      conversationId: body.conversationId,
      topic: body.topic,
    };
    if (body.topic.kind === "catalog")
      return this.adapter(page, { ...args, phase: "prepare" });
    await fs.mkdir(this.root, { recursive: true, mode: 0o700 });
    const key = crypto
      .createHash("sha256")
      .update(`${body.owner}:${body.requestId}`)
      .digest("hex");
    const fingerprint = crypto
      .createHash("sha256")
      .update(JSON.stringify([body.accountId, args]))
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
      /* An uncertain creation is never resubmitted automatically. */
    } finally {
      clearTimeout(timer);
    }
    await fs.writeFile(file + ".tmp", JSON.stringify(receipt), { mode: 0o600 });
    await fs.rename(file + ".tmp", file);
    return receipt.result;
  }
}

export async function nativeTopic(page, args) {
  const frame = page
    .frames()
    .find((f) => /^https:\/\/chat\.zalo\.me\//.test(f.url()));
  if (!frame) throw Error("WEB_TOPIC_NOT_READY");
  return frame
    .evaluate(async ({ expectedId, conversationId, topic, phase }) => {
      let require;
      const id = "zalo-team-topic-" + Date.now();
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
        throw Error("WEB_TOPIC_NOT_READY");
      globalThis.webpackJsonp.push(chunk);
      if (!require) throw Error("WEB_TOPIC_NOT_READY");
      delete require.c[id];
      delete require.m[id];
      globalThis.webpackJsonp.splice(globalThis.webpackJsonp.indexOf(chunk), 1);
      const get = (k) =>
          require.c[k]?.exports || (require.m[k] ? require(k) : undefined),
        fetcher = get("dThN")?.default,
        container = get("jDHv")?.ModuleContainer,
        kinds = get("1pet");
      if (String(fetcher?.userId) !== expectedId)
        throw Error("WEB_IDENTITY_MISMATCH");
      const visible = container
        ?.resolve(get("iZzu")?.ConvListController)
        ?.getList({ key: get("3xbP")?.c });
      if (!visible?.includes(conversationId))
        throw Error("WEB_CONVERSATION_NOT_FOUND");
      const group = conversationId.startsWith("g");
      if (group) {
        const info =
          await get("Gm1y")?.default?.getFullInfoGroupById(conversationId);
        if (
          !info ||
          ![
            ...(info.memberIds || []),
            ...(info.topMember || []).map((m) => m.id),
          ]
            .map(String)
            .includes(expectedId)
        )
          throw Error("WEB_GROUP_PERMISSION_DENIED");
      }
      const board = group ? get("jnJr")?.a?.getInstance(conversationId) : null;
      let manager;
      try {
        manager =
          get("Tjt2")?.default?.GetManager() ||
          (get("geJK")?.a && container.resolve(get("geJK").a));
      } catch {}
      const config = get("RQ3F")?.a;
      if (group && (topic.kind === "catalog" || topic.pin))
        await board?.fetchTopics(conversationId, 0);
      const topics = board?.topicStore?.getTopics(conversationId);
      let canPin = false;
      try {
        const token = get("C8zZ")?.GroupPollManager || get("lT2C")?.a;
        canPin =
          !!container.resolve(token).isEnablePin(conversationId) &&
          Array.isArray(topics) &&
          topics.length < (Number(board.pinLimit) || 3);
      } catch {}
      const catalog = {
        canNote: group && !!fetcher.createGroupTopicv2,
        canPin,
        canReminder:
          !!manager?.createReminder ||
          !!(group
            ? fetcher.createGroupTopicv2
            : fetcher.createOneOneGroupTopic),
        onlyMe: !!config?.isOnlyMeEnabled(),
        advancedRepeat: !!config?.isEnabled(),
        minLeadMs: Number(config?.getMinLeadTimeMs()) || 60000,
      };
      if (topic.kind === "catalog") return catalog;
      if (
        topic.kind === "note" &&
        (!catalog.canNote || (topic.pin && !catalog.canPin))
      )
        throw Error("WEB_GROUP_PERMISSION_DENIED");
      if (topic.kind === "reminder") {
        if (
          !catalog.canReminder ||
          (topic.onlyMe && !catalog.onlyMe) ||
          (["weeklyMultiDays", "yearly"].includes(topic.repeat) &&
            !catalog.advancedRepeat)
        )
          throw Error("WEB_TOPIC_NOT_READY");
        if (topic.startTime < Date.now() + catalog.minLeadMs)
          throw Error("WEB_REMINDER_TIME_INVALID");
      }
      if (phase === "prepare") return catalog;
      if (topic.kind === "reminder") {
        const repeatRule =
          topic.repeat === "none"
            ? null
            : {
                freq: {
                  daily: "DAILY",
                  weekly: "WEEKLY",
                  weeklyMultiDays: "WEEKLY",
                  monthly: "MONTHLY",
                  yearly: "YEARLY",
                }[topic.repeat],
                interval: 1,
                ...(topic.repeat === "weeklyMultiDays"
                  ? { byDay: topic.byDay }
                  : {}),
              };
        const dto = {
          conversationId,
          scope: group ? "group" : "oneOne",
          title: topic.title.trim(),
          startTime: topic.startTime,
          repeatRule,
          onlyMe: topic.onlyMe,
          color: 531510,
          params: {},
          src: kinds.REMINDER_SRC_CHATBAR,
        };
        const repeat = {
          none: kinds.REPEAT_NONE,
          daily: kinds.REPEAT_DAILY,
          weekly: kinds.REPEAT_WEEKLY,
          monthly: kinds.REPEAT_MONTHLY,
        }[topic.repeat];
        const result = manager
          ? await manager.createReminder(dto)
          : group
            ? await fetcher.createGroupTopicv2(
                conversationId.slice(1),
                kinds.TEXT_TOPIC,
                531510,
                "⏰",
                topic.startTime,
                -1,
                { title: topic.title.trim() },
                false,
                0,
                repeat,
                kinds.CREATE_NOTICE_SRC_CHATBAR ||
                  kinds.CREATE_NOTICE_SRC_UNKNOWN,
              )
            : await fetcher.createOneOneGroupTopic({
                toUid: conversationId,
                creatorUid: expectedId,
                type: kinds.TEXT_TOPIC,
                color: 531510,
                emoji: "⏰",
                startTime: topic.startTime,
                duration: -1,
                params: { title: topic.title.trim() },
                needPin: false,
                repeat,
                src: kinds.REMINDER_SRC_CHATBAR,
              });
        if (!(result?.id || result?.reminderId || result?.topicId))
          return { status: "unknown" };
        return {
          status: "confirmed",
          topicId: String(result.id || result.reminderId || result.topicId),
          kind: "reminder",
        };
      }
      const result = await fetcher.createGroupTopicv2(
        conversationId.slice(1),
        kinds.TEXT_TOPIC,
        "",
        "",
        -1,
        -1,
        { title: topic.title.trim() },
        topic.pin,
        topic.pin ? 1 : 0,
        kinds.REPEAT_NONE,
        kinds.CREATE_NOTICE_SRC_CHATBAR || kinds.CREATE_NOTICE_SRC_UNKNOWN,
      );
      const topicId = String(result?.id || result?.topicId || "");
      if (!topicId) return { status: "unknown" };
      if (topic.pin) {
        try {
          await board.fetchTopics(conversationId, 0);
        } catch {}
      }
      return { status: "confirmed", topicId, kind: "note" };
    }, args)
    .catch((e) => {
      throw Error(
        e.message?.match(/WEB_[A-Z_]+|INVALID_REQUEST/)?.[0] ||
          "WEB_TOPIC_FAILED",
      );
    });
}

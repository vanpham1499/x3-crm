import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export function validPoll(p) {
  if (!p || typeof p !== "object" || Array.isArray(p)) return false;
  const keys = Object.keys(p).sort().join(",");
  if (p.kind === "catalog") return keys === "kind";
  if (p.kind === "vote")
    return (
      keys === "kind,optionIds,pollId" &&
      /^\d{1,30}$/.test(p.pollId) &&
      typeof p.pollId === "string" &&
      Array.isArray(p.optionIds) &&
      p.optionIds.length <= 30 &&
      p.optionIds.every(
        (id) => typeof id === "string" && /^\d{1,30}$/.test(id),
      ) &&
      new Set(p.optionIds).size === p.optionIds.length
    );
  if (p.kind !== "create") return false;
  return (
    keys ===
      "allowAddNewOption,allowMultiChoices,expiredTime,isAnonymous,isHideVotePreview,kind,options,pinAct,question" &&
    typeof p.question === "string" &&
    !!p.question.trim() &&
    p.question.length <= 200 &&
    Array.isArray(p.options) &&
    p.options.length >= 2 &&
    p.options.length <= 30 &&
    p.options.every(
      (x) => typeof x === "string" && !!x.trim() && x.length <= 120,
    ) &&
    new Set(p.options.map((x) => x.trim())).size === p.options.length &&
    [
      "allowAddNewOption",
      "allowMultiChoices",
      "isAnonymous",
      "isHideVotePreview",
      "pinAct",
    ].every((k) => typeof p[k] === "boolean") &&
    Number.isSafeInteger(p.expiredTime) &&
    p.expiredTime >= 0 &&
    !(p.isHideVotePreview && p.allowAddNewOption)
  );
}

export class PollActions {
  constructor(root, adapter = nativePoll) {
    this.root = root;
    this.adapter = adapter;
  }
  async run(page, expectedId, body) {
    if (!validPoll(body.poll)) throw Error("INVALID_REQUEST");
    const args = {
      expectedId,
      conversationId: body.conversationId,
      poll: body.poll,
    };
    if (body.poll.kind === "catalog")
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

export async function nativePoll(page, args) {
  const frame = page
    .frames()
    .find((f) => /^https:\/\/chat\.zalo\.me\//.test(f.url()));
  if (!frame) throw Error("WEB_POLL_NOT_READY");
  return frame
    .evaluate(async ({ expectedId, conversationId, poll, phase }) => {
      let require;
      const id = "zalo-team-poll-" + Date.now();
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
        throw Error("WEB_POLL_NOT_READY");
      globalThis.webpackJsonp.push(chunk);
      if (!require) throw Error("WEB_POLL_NOT_READY");
      delete require.c[id];
      delete require.m[id];
      globalThis.webpackJsonp.splice(globalThis.webpackJsonp.indexOf(chunk), 1);
      const get = (k) => require.c[k]?.exports;
      const fetcher = get("dThN")?.default,
        container = get("jDHv")?.ModuleContainer;
      if (String(fetcher?.userId) !== expectedId)
        throw Error("WEB_IDENTITY_MISMATCH");
      const visible = container
        ?.resolve(get("iZzu")?.ConvListController)
        ?.getList({ key: get("3xbP")?.c });
      if (!/^g\d+$/.test(conversationId) || !visible?.includes(conversationId))
        throw Error("WEB_CONVERSATION_NOT_FOUND");
      const groups = get("Gm1y")?.default;
      const info = await groups?.getFullInfoGroupById(conversationId);
      if (
        !info ||
        ![...(info.memberIds || []), ...(info.topMember || []).map((m) => m.id)]
          .map(String)
          .includes(expectedId)
      )
        throw Error("WEB_GROUP_PERMISSION_DENIED");
      const token = get("C8zZ")?.GroupPollManager || get("lT2C")?.a;
      const manager = token && container?.resolve(token);
      if (!manager || !fetcher?.createPoll) throw Error("WEB_POLL_NOT_READY");
      const config = get("NDmK")?.default?.groupPoll || {};
      const board = get("jnJr")?.a?.getInstance(conversationId);
      if (poll.kind === "catalog" || poll.pinAct)
        await board?.fetchTopics(conversationId, 0);
      const topics = board?.topicStore?.getTopics(conversationId);
      const catalog = {
        canPin:
          !!manager.isEnablePin(conversationId) &&
          Array.isArray(topics) &&
          topics.length < (Number(board.pinLimit) || 3),
        maxOptions: Math.min(30, Number(config.max_options) || 30),
        anonymous: !!config.enable_anonymous_vote,
        hidePreview: !!config.enable_hide_vote_preview,
      };
      if (poll.kind === "catalog") return catalog;
      if (poll.kind === "vote") {
        // The detail endpoint omits group_id; verify against the native local
        // record bound by the incoming group event before sending any mutation.
        const bound = await get("XS0u")?.default?.getPollInfo(
          Number(poll.pollId),
        );
        if (!bound || String(bound.group_id) !== conversationId.slice(1))
          throw Error("WEB_CONVERSATION_NOT_FOUND");
        const current = await fetcher.getPollDetail(
          conversationId.slice(1),
          poll.pollId,
          false,
        );
        if (!current || String(current.poll_id) !== poll.pollId)
          throw Error("WEB_CONVERSATION_NOT_FOUND");
        if (
          current.closed ||
          (current.expired_time > 0 && current.expired_time <= Date.now())
        )
          throw Error("WEB_POLL_CLOSED");
        if (
          (!current.allow_multi_choices && poll.optionIds.length > 1) ||
          poll.optionIds.some(
            (id) =>
              !(current.options || []).some((o) => String(o.option_id) === id),
          )
        )
          throw Error("INVALID_REQUEST");
        if (phase === "prepare") return { ready: true };
        await manager.votePoll({
          groupId: conversationId,
          pollId: current.poll_id,
          votedOptionIds: poll.optionIds.map(Number),
          newOptions: [],
        });
        const updated = await fetcher.getPollDetail(
          conversationId.slice(1),
          poll.pollId,
          false,
        );
        manager.updatePollCache(updated.poll_id, {
          ...updated,
          group_id: bound.group_id,
        });
        return { status: "confirmed", pollId: poll.pollId };
      }
      if (
        poll.options.length > catalog.maxOptions ||
        (poll.expiredTime && poll.expiredTime <= Date.now())
      )
        throw Error("INVALID_REQUEST");
      if (
        (poll.pinAct && !catalog.canPin) ||
        (poll.isAnonymous && !catalog.anonymous) ||
        (poll.isHideVotePreview && !catalog.hidePreview)
      )
        throw Error("WEB_GROUP_PERMISSION_DENIED");
      if (phase === "prepare") return { ready: true };
      // Use the same request mapper/fetcher as GroupPollManager, retaining poll_id for the receipt.
      const request = manager.createPollRequestData({
        groupId: conversationId,
        src: get("1pet")?.CREATE_POLL_SRC_CHAT_BAR,
        pollData: {
          ...poll,
          question: poll.question.trim(),
          options: poll.options.map((x) => x.trim()),
          pollType: 0,
        },
      });
      const created = await fetcher.createPoll(
        request.groupId,
        request.pollData,
        request.src,
      );
      if (!created?.poll_id) throw Error("WEB_POLL_RESULT_UNKNOWN");
      manager.updatePollCache(created.poll_id, {
        ...created,
        group_id: conversationId.slice(1),
      });
      let pinStatus;
      if (poll.pinAct) {
        try {
          // Final native API used by GroupTopicController._callPinPollTopic.
          // Avoid opening its UI-only confirmation in the headless account.
          await fetcher.pinBoardItem(
            conversationId.slice(1),
            created.poll_id,
            get("1pet").POLL_TOPIC,
          );
          await board.fetchTopics(conversationId, 0);
          pinStatus = board.topicStore
            .getTopics(conversationId)
            .some(
              (t) =>
                String(t.id) === String(created.poll_id) &&
                t.type === get("1pet").POLL_TOPIC,
            )
            ? "confirmed"
            : "unknown";
        } catch {
          pinStatus = "unknown";
        }
      }
      return {
        status: "confirmed",
        pollId: String(created.poll_id),
        pinStatus,
      };
    }, args)
    .catch((e) => {
      const code = e.message?.match(/WEB_[A-Z_]+|INVALID_REQUEST/)?.[0];
      throw Error(code || "WEB_POLL_NOT_READY");
    });
}

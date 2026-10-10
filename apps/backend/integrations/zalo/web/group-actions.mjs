import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import {
  managementKinds,
  validManagement,
  manageGroupInPage,
} from "./group-management.mjs";

export function validGroup(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort().join(",");
  if (managementKinds.includes(value.kind)) return validManagement(value);
  if (value.kind === "catalog") return keys === "kind";
  if (
    !["create", "add"].includes(value.kind) ||
    !Array.isArray(value.members) ||
    value.members.length < (value.kind === "create" ? 2 : 1) ||
    value.members.length > (value.kind === "create" ? 100 : 50) ||
    new Set(value.members).size !== value.members.length ||
    !value.members.every(
      (id) => typeof id === "string" && /^\d{1,30}$/.test(id),
    )
  )
    return false;
  return value.kind === "add"
    ? keys === "kind,members"
    : keys === "kind,members,name" &&
        typeof value.name === "string" &&
        value.name.length <= 50 &&
        !/[\x00-\x1f]/.test(value.name);
}

export class GroupActions {
  constructor(root, adapter = nativeGroup) {
    this.root = root;
    this.adapter = adapter;
  }
  async run(page, expectedId, body) {
    if (!validGroup(body.group)) throw Error("INVALID_REQUEST");
    const args = {
      expectedId,
      conversationId: body.conversationId,
      group: body.group,
    };
    if (body.group.kind === "catalog")
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
    } catch (error) {
      /* Keep the durable unknown receipt; never silently repeat a group mutation. */
      if (/^WEB_[A-Z_]+$/.test(error?.message || ""))
        receipt.result.errorCode = error.message;
    } finally {
      clearTimeout(timer);
    }
    await fs.writeFile(file + ".tmp", JSON.stringify(receipt), { mode: 0o600 });
    await fs.rename(file + ".tmp", file);
    return receipt.result;
  }
}

export async function nativeGroup(page, args) {
  const frame = page
    .frames()
    .find((f) => /^https:\/\/chat\.zalo\.me\//.test(f.url()));
  if (!frame) throw Error("WEB_GROUP_NOT_READY");
  if (managementKinds.includes(args.group.kind))
    return frame.evaluate(manageGroupInPage, args);
  return frame.evaluate(
    async ({ expectedId, conversationId, group, phase }) => {
      let require;
      const id = "zalo-team-group-" + Date.now();
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
        throw Error("WEB_GROUP_NOT_READY");
      globalThis.webpackJsonp.push(chunk);
      if (!require) throw Error("WEB_GROUP_NOT_READY");
      delete require.c[id];
      delete require.m[id];
      globalThis.webpackJsonp.splice(globalThis.webpackJsonp.indexOf(chunk), 1);
      const get = (key) => require.c[key]?.exports;
      const fetcher = get("dThN")?.default,
        users = get("UiPd")?.default,
        groups = get("Gm1y")?.default;
      if (String(fetcher?.userId) !== expectedId)
        throw Error("WEB_IDENTITY_MISMATCH");
      const recent = get("jDHv")
        ?.ModuleContainer?.resolve(get("iZzu")?.ConvListController)
        ?.getList({ key: get("3xbP")?.c });
      if (!Array.isArray(recent) || (conversationId !== undefined && !recent.includes(conversationId) && !globalThis.__zaloTeamPhonePeers?.allows(expectedId,conversationId)))
        throw Error("WEB_CONVERSATION_NOT_FOUND");
      if (
        !users ||
        !groups ||
        !fetcher.createGroupV2 ||
        !fetcher.addMemberToGroupV2
      )
        throw Error("WEB_GROUP_NOT_READY");
      const isGroup = !!conversationId?.startsWith("g");
      if (
        (group.kind === "create" && isGroup) ||
        (group.kind === "add" && !isGroup)
      )
        throw Error("INVALID_REQUEST");
      let info = isGroup ? groups.getGroupByIdSync(conversationId) : null;
      if (isGroup && !Array.isArray(info?.memberIds))
        info = await groups.getFullInfoGroupById(conversationId);
      if (isGroup && !Array.isArray(info?.memberIds))
        throw Error("WEB_INFO_INCOMPLETE");
      const existing = new Set(
        [
          ...(info?.memberIds || []),
          ...(info?.topMember || []).map((p) => p.id || p.userId),
        ]
          .filter(Boolean)
          .map(String),
      );
      const admin =
        String(info?.creatorId) === expectedId ||
        (info?.adminIds || []).map(String).includes(expectedId);
      const canAdd =
        !isGroup ||
        (existing.has(expectedId) && (!info?.setting?.addMemberOnly || admin));
      const e2ee = conversationId && get("GpwQ")?.a?.instance()?.isOnE2ee(conversationId);
      let limit = isGroup
        ? Math.min(
            50,
            Number(
              get("NDmK")?.default?.settings?.group?.max_invited_users || 50,
            ),
          )
        : 100;
      if (e2ee)
        limit = Math.min(
          limit,
          Math.max(
            0,
            Number(get("NDmK")?.default?.e2ee?.group?.max_members || 0) -
              Number(info?.totalMember || 0),
          ),
        );
      if (isGroup && Number(info?.maxMember) > 0)
        limit = Math.min(
          limit,
          Math.max(
            0,
            Number(info.maxMember) - Number(info.totalMember || existing.size),
          ),
        );
      const friends = users.getFriendsSync();
      const friendIds = Array.isArray(friends)
        ? friends.map((x) =>
            String(typeof x === "object" ? x.userId || x.id : x),
          )
        : Object.keys(friends || {});
      const candidateIds = [
        ...new Set([...recent.filter((x) => /^\d+$/.test(x)), ...friendIds, ...Array.from(globalThis.__zaloTeamPhonePeers?.peers || []).filter(uid=>globalThis.__zaloTeamPhonePeers?.allows(expectedId,uid))]),
      ].filter(
        (x) =>
          x !== expectedId &&
          x !== String(get("NDmK")?.default?.sendToMeId) &&
          !users.isBlocked(x) &&
          !users.isOA(x) &&
          !users.isZaloBot(x),
      );
      const recentIds = new Set(
        recent
          .filter((uid) => candidateIds.includes(uid) && users.isFriend(uid))
          .slice(0, 5),
      );
      const contacts = candidateIds
        .map((uid) => {
          const p = users.getProfileFriendSync(uid) || users.getMiniInfo(uid);
          const name = users.getDName(uid) || p?.zaloName || p?.displayName;
          if (!name) return null;
          const avatar = users.getAvatar(uid) || p?.avatar;
          return {
            id: uid,
            name: String(name).slice(0, 200),
            avatarSrc:
              typeof avatar === "string" && /^https:\/\//.test(avatar)
                ? avatar
                : undefined,
            joined: existing.has(uid),
            recent: recentIds.has(uid),
            friend: !!users.isFriend(uid),
          };
        })
        .filter(Boolean);
      if (group.kind === "catalog") {
        let labels = [];
        try {
          const nativeLabels = await get("l+Gc")?.a?.getAll(null, false);
          labels = (Array.isArray(nativeLabels) ? nativeLabels : [])
            .filter((l) => l && typeof l.text === "string")
            .map((l) => ({
              id: String(l.id),
              name: l.text.slice(0, 100),
              members: (l.conversations || [])
                .map(String)
                .filter((uid) => candidateIds.includes(uid)),
            }));
        } catch {
          /* Contacts remain usable if native labels are unavailable. */
        }
        return {
          contacts,
          labels,
          canAdd,
          limit,
          initial:
            !isGroup && contacts.some((x) => x.id === conversationId)
              ? [conversationId]
              : [],
        };
      }
      if (!canAdd) throw Error("WEB_GROUP_PERMISSION_DENIED");
      if (group.members.length > limit) throw Error("WEB_GROUP_MEMBER_LIMIT");
      const members = group.members.map((uid) => {
        const p = contacts.find((x) => x.id === uid);
        if (!p || p.joined) throw Error("WEB_GROUP_MEMBER_INVALID");
        return p;
      });
      if (phase === "prepare") return { ready: true };
      const memberTypes = members.map((p) =>
        p.friend
          ? get("1pet").MEMBERS_TRACKING_SOURCE.friend
          : get("1pet").MEMBERS_TRACKING_SOURCE.searchPhoneGlobal,
      );
      if (group.kind === "create") {
        const name =
          (group.name.trim() || members.map((p) => p.name).join(", "))
            .replace(/[~`!@#$%\^&*]/g, "")
            .trim()
            .slice(0, 50) || "Nhóm mới";
        const result = await fetcher.createGroupV2(
          name,
          members.map((p) => ({
            id: p.id,
            avatar: p.avatarSrc,
            dName: p.name,
          })),
          expectedId,
          get("NMlV").a.next(),
          memberTypes,
          !!group.name.trim(),
          null,
          null,
          get("oMqy")?.n?.NORMAL,
        );
        const newId = String(result?.conv?.userId || "");
        if (!/^g\d+$/.test(newId)) return { status: "unknown" };
        // Use the vendor's post-create flow so its visible inbox includes the group.
        const navigation = get("WQAo");
        try {
          if (navigation?.b && navigation?.c?.fromGroupCompose)
            await get("jDHv")
              .ModuleContainer.resolve(navigation.b)
              .openConversation(
                newId,
                navigation.c.fromGroupCompose(result.conv),
              );
        } catch {
          /* Preserve the accepted group ID even if opening its native view fails. */
        }
        return {
          status: Object.keys(result.errorInfo || {}).length
            ? "partial"
            : "confirmed",
          groupId: newId,
          name: result.conv.displayName || name,
          existed: !!result.isExistGroup,
        };
      }
      const result = await fetcher.addMemberToGroupV2(
        conversationId,
        members.map((p) => ({
          userId: p.id,
          avatar: p.avatarSrc,
          zaloName: p.name,
          displayName: p.name,
        })),
        memberTypes,
      );
      if (!result) return { status: "unknown" };
      const fresh = await groups.getFullInfoGroupById(
        conversationId,
        get("1pet")?.SRC_GET_PROFILE?.FORCE_GET,
      );
      const joined = members
        .filter((p) => (fresh?.memberIds || []).map(String).includes(p.id))
        .map((p) => p.id);
      return {
        status:
          joined.length === members.length
            ? "confirmed"
            : Object.keys(result.errorInfo || {}).length
              ? "partial"
              : "pending",
        joined,
        groupId: conversationId,
      };
    },
    args,
  );
}

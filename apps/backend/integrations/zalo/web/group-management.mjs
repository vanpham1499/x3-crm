export const managementKinds = ["promote", "demote", "remove", "leave"];
export function validManagement(group) {
  const keys = Object.keys(group).sort().join(",");
  if (group.kind === "leave")
    return (
      keys === "kind" ||
      (keys === "kind,successorId" &&
        /^\d{1,30}$/.test(group.successorId) &&
        typeof group.successorId === "string")
    );
  return (
    ["promote", "demote", "remove"].includes(group.kind) &&
    keys === "kind,memberId" &&
    typeof group.memberId === "string" &&
    /^\d{1,30}$/.test(group.memberId)
  );
}

// Executed only in the connector-owned page, never in the user's Chrome.
export async function manageGroupInPage({
  expectedId,
  conversationId,
  group,
  phase,
}) {
  let require;
  const id = "zt-group-manage-" + crypto.randomUUID();
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
  const get = (k) => require.c[k]?.exports;
  const fetcher = get("dThN")?.default,
    groups = get("Gm1y")?.default,
    users = get("UiPd")?.default;
  if (String(fetcher?.userId) !== expectedId)
    throw Error("WEB_IDENTITY_MISMATCH");
  const visible = get("jDHv")
    ?.ModuleContainer?.resolve(get("iZzu")?.ConvListController)
    ?.getList({ key: get("3xbP")?.c });
  if (!/^g\d+$/.test(conversationId) || !visible?.includes(conversationId))
    throw Error("WEB_CONVERSATION_NOT_FOUND");
  if (typeof groups?.getFullInfoGroupById !== "function")
    throw Error("WEB_GROUP_NOT_READY");
  const read = () =>
    groups.getFullInfoGroupById(
      conversationId,
      get("1pet")?.SRC_GET_PROFILE?.FORCE_GET,
    );
  // Full native group profiles use topMember.isAdmin in the legacy server flow.
  const adminsOf = (info) =>
    Array.isArray(info?.topMember)
      ? info.topMember.filter((m) => m.isAdmin).map((m) => String(m.id))
      : (info?.adminIds || []).map(String);
  // The native write resolves before the group-info replicas always reflect it.
  // Read back only; never repeat a mutation while waiting for the new version.
  const verify = async (predicate) => {
    let fresh;
    for (const delay of [0, 400, 1000, 2000]) {
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      fresh = await read();
      if (predicate(fresh)) break;
    }
    return fresh;
  };
  const check = (info) => {
    if (!Array.isArray(info?.memberIds) || !info.creatorId)
      throw Error("WEB_INFO_INCOMPLETE");
    const members = info.memberIds.map(String),
      admins = adminsOf(info),
      owner = String(info.creatorId);
    if (!members.includes(expectedId))
      throw Error("WEB_GROUP_PERMISSION_DENIED");
    if (group.kind === "leave") {
      if (owner === expectedId && members.length > 1) {
        if (!group.successorId) throw Error("WEB_GROUP_SUCCESSOR_REQUIRED");
        if (
          group.successorId === expectedId ||
          !members.includes(group.successorId) ||
          users?.isZaloBot?.(group.successorId)
        )
          throw Error("WEB_GROUP_MEMBER_INVALID");
      } else if (group.successorId) throw Error("WEB_GROUP_PERMISSION_DENIED");
      return { members, admins, owner };
    }
    if (group.memberId === expectedId || group.memberId === owner)
      throw Error("WEB_GROUP_PERMISSION_DENIED");
    if (!members.includes(group.memberId))
      throw Error("WEB_GROUP_MEMBER_INVALID");
    if (group.kind === "remove") {
      if (
        owner !== expectedId &&
        (!admins.includes(expectedId) || admins.includes(group.memberId))
      )
        throw Error("WEB_GROUP_PERMISSION_DENIED");
    } else if (owner !== expectedId || users?.isZaloBot?.(group.memberId))
      throw Error("WEB_GROUP_PERMISSION_DENIED");
    return { members, admins, owner };
  };
  let state = check(await read());
  const method =
    group.kind === "promote"
      ? "addGroupAdmin"
      : group.kind === "demote"
        ? "removeGroupAdmin"
        : null;
  if (method && typeof groups[method] !== "function")
    throw Error("WEB_GROUP_NOT_READY");
  if (
    group.kind === "remove" &&
    typeof fetcher.removeMemberFromGroup !== "function"
  )
    throw Error("WEB_GROUP_NOT_READY");
  if (
    group.kind === "remove" &&
    state.admins.includes(group.memberId) &&
    typeof groups.removeGroupAdmin !== "function"
  )
    throw Error("WEB_GROUP_NOT_READY");
  if (group.kind === "leave" && typeof fetcher.leaveGroup !== "function")
    throw Error("WEB_GROUP_NOT_READY");
  if (group.successorId && typeof fetcher.changeGroupOwner !== "function")
    throw Error("WEB_GROUP_NOT_READY");
  if (phase === "prepare") return { ready: true };
  let roleRemoved = false,
    ownershipTransferred = false;
  try {
    if (method) {
      await groups[method](conversationId, [group.memberId]);
      // Native add/remove-admin rejects API errors and updates topMember locally.
      // An immediate FORCE_GET can overwrite that update with a stale server replica.
      return { status: "confirmed", groupId: conversationId };
    }
    if (group.kind === "remove") {
      if (state.admins.includes(group.memberId)) {
        await groups.removeGroupAdmin(conversationId, [group.memberId]);
        roleRemoved = true;
        state = check(await groups.getFullInfoGroupById(conversationId));
        if (state.admins.includes(group.memberId))
          return {
            status: "partial",
            roleRemoved: true,
            groupId: conversationId,
          };
      }
      await fetcher.removeMemberFromGroup(conversationId, [
        { id: group.memberId },
      ]);
      const fresh = await verify(
        (info) =>
          Array.isArray(info?.memberIds) &&
          !info.memberIds.map(String).includes(group.memberId),
      );
      return {
        status:
          Array.isArray(fresh?.memberIds) &&
          !fresh.memberIds.map(String).includes(group.memberId)
            ? "confirmed"
            : "pending",
        groupId: conversationId,
      };
    }
    if (group.successorId) {
      if (typeof fetcher.changeGroupOwner !== "function")
        throw Error("WEB_GROUP_NOT_READY");
      await fetcher.changeGroupOwner(
        conversationId.slice(1),
        group.successorId,
      );
      ownershipTransferred = true;
      const fresh = await verify(
        (info) => String(info?.creatorId) === group.successorId,
      );
      if (String(fresh?.creatorId) !== group.successorId)
        return {
          status: "partial",
          ownershipTransferred: true,
          groupId: conversationId,
        };
    }
    await fetcher.leaveGroup(conversationId, 0);
    return { status: "confirmed", left: true, groupId: conversationId };
  } catch (error) {
    const code = error?.error_code ?? error?.code;
    const errorCode =
      typeof code === "number" ||
      (typeof code === "string" && /^[A-Z_0-9-]{1,80}$/.test(code))
        ? code
        : "WEB_GROUP_UNCONFIRMED";
    return {
      status:
        roleRemoved || ownershipTransferred
          ? "partial"
          : typeof code === "number" && code !== 0
            ? "rejected"
            : "unknown",
      errorCode,
      roleRemoved,
      ownershipTransferred,
      groupId: conversationId,
    };
  }
}

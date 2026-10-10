import { validMessageSearch } from "./message-search.mjs";
import {validDirectory, directoryReads} from "./directory.mjs";
import { validFriend } from "./friend-actions.mjs";
import { validGroupLink } from "./group-links.mjs";
import { validTopic } from "./topics.mjs";
import { validCall } from "./call-session.mjs";
import { validPoll } from "./polls.mjs";
import { validGroup } from "./group-actions.mjs";
import { validSettings } from "./conversation-settings.mjs";
import { validMentions } from "./mentions.mjs";
import crypto from "node:crypto";
import { validCrmSender } from "./sender-attribution.mjs";
import {validHistorySync} from './history-sync.mjs';
export function validCommand(body) {
  return (
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    [
      "history-sync",
      "status",
      "group-links",
      "begin",
      "retry",
      "cancel",
      "stop",
      "directory",
      "friend-action",
      "conversations",
      "messages",
      "message-search",
      "conversation-info",
      "conversation-settings",
      "group-action",
      "poll-action",
      "topic-action",
      "send-text",
      "send-sticker",
      "send-media",
      "expressions",
      "mentions",
      "call-capabilities",
      "call-session",
      "events",
      "message-action",
    ].includes(body.action) &&
    (body.action !== 'history-sync' || (Number.isSafeInteger(body.accountId) && body.accountId > 0 &&
      Object.keys(body).every(k => ['action','owner','accountId','sync'].includes(k)))) &&
    (body.sync === undefined ? body.action !== 'history-sync' : body.action === 'history-sync' && validHistorySync(body.sync)) &&
    typeof body.owner === "string" &&
    (body.crmSender === undefined ||
      (["send-text", "send-sticker", "send-media", "call-session"].includes(body.action) && validCrmSender(body.crmSender))) &&
    /^[a-f0-9]{64}$/.test(body.owner) &&
    Object.keys(body).every((k) =>
      [
        "action",
        "sync",
        "link",
        "owner",
        "crmSender",
        "checkOnly",
        "expectedExternalId",
        "loginId",
        "accountId",
        "conversationId",
        "before",
        "section",
        "cursor",
        "text",
        "styles",
        "mentions",
        "requestId",
        "refresh",
        "sticker",
        "media",
        "categoryId",
        "query",
            "search",
        "settings",
        "group",
        "directory",
        "friend",
        "poll",
        "topic",
        "replyTo",
        "messageId",
        "operation",
        "reaction",
        "call",
      ].includes(k),
    ) &&
    (body.action === 'message-search' ? validMessageSearch(body.search) && Object.keys(body).every(k=>['owner','action','accountId','conversationId','search'].includes(k)) : body.search===undefined) &&
    (body.action === 'group-links' ? validGroupLink(body.link) && Object.keys(body).every(k=>['action','owner','link'].includes(k)) : body.link===undefined) &&
    (body.checkOnly === undefined || (body.checkOnly === true && ['send-text','send-media'].includes(body.action))) &&
    (body.expectedExternalId === undefined || (typeof body.expectedExternalId === 'string' && /^\d{1,30}$/.test(body.expectedExternalId) && ['send-text','send-media'].includes(body.action))) &&
    (body.action === "call-session"
      ? validCall(body.call) && /^\d{1,30}$/.test(body.conversationId)
      : body.call === undefined) &&
    (body.action === "topic-action"
      ? validTopic(body.topic)
      : body.topic === undefined) &&
    (body.action === "poll-action"
      ? validPoll(body.poll) && /^g\d+$/.test(body.conversationId)
      : body.poll === undefined) &&
    (body.action === "directory" ? validDirectory(body.directory) && body.accountId !== undefined && Object.keys(body).every(k=>["action","owner","accountId","directory","requestId"].includes(k)) : body.directory === undefined) &&
    (body.action === "friend-action" ? validFriend(body.friend) && body.conversationId === undefined : body.friend === undefined) &&
    (body.action === "group-action"
      ? validGroup(body.group)
      : body.group === undefined) &&
    (body.action === "conversation-settings"
      ? validSettings(body.settings)
      : body.settings === undefined) &&
    (body.replyTo === undefined ||
      (["send-text", "send-sticker", "send-media"].includes(body.action) &&
        typeof body.replyTo === "string" &&
        /^\d{1,30}$/.test(body.replyTo))) &&
    (body.action === "message-action"
      ? validMessageAction(body)
      : body.messageId === undefined &&
        body.operation === undefined &&
        body.reaction === undefined) &&
    (body.mentions === undefined ||
      (body.action === "send-text" &&
        /^g\d+$/.test(body.conversationId) &&
        validMentions(body.mentions, body.text))) &&
    (body.styles === undefined ||
      (body.action === "send-text" &&
        validRichStyles(body.styles, body.text))) &&
    (body.sticker === undefined
      ? body.action !== "send-sticker"
      : body.action === "send-sticker" && validSticker(body.sticker)) &&
    (body.media === undefined
      ? body.action !== "send-media"
      : body.action === "send-media" && validMedia(body.media)) &&
    (body.categoryId === undefined ||
      (body.action === "expressions" &&
        Number.isSafeInteger(body.categoryId) &&
        body.categoryId >= -10 &&
        body.categoryId <= 2147483647)) &&
    (body.query === undefined ||
      (body.action === "expressions" &&
        typeof body.query === "string" &&
        body.query.length <= 100)) &&
    (body.refresh === undefined ||
      (body.action === "messages" &&
        typeof body.refresh === "boolean" &&
        !body.before)) &&
    (body.loginId === undefined ||
      (typeof body.loginId === "string" &&
        /^[a-f0-9-]{36}$/.test(body.loginId))) &&
    (body.accountId === undefined ||
      (Number.isSafeInteger(body.accountId) && body.accountId > 0)) &&
    (![
      "stop",
      "directory",
      "friend-action",
      "message-action",
      "messages",
      "message-search",
      "conversation-info",
      "conversation-settings",
      "group-action",
      "poll-action",
      "topic-action",
      "send-text",
      "send-sticker",
      "send-media",
      "expressions",
      "mentions",
      "call-capabilities",
      "call-session",
    ].includes(body.action) ||
      body.accountId !== undefined) &&
    (![
      "messages",
      "message-search",
      "conversation-info",
      "conversation-settings",
      "group-action",
      "poll-action",
      "topic-action",
      "send-text",
      "send-sticker",
      "send-media",
      "expressions",
      "mentions",
      "call-capabilities",
      "call-session",
    ].includes(body.action) ||
      (body.action === "group-action" && ["catalog", "create"].includes(body.group.kind) && body.conversationId === undefined) ||
      (typeof body.conversationId === "string" &&
        /^g?\d{1,30}$/.test(body.conversationId))) &&
    (body.action === "send-text"
      ? typeof body.text === "string" &&
        body.text.trim().length > 0 &&
        body.text.length <= 2000 &&
        typeof body.requestId === "string" &&
        /^[a-f0-9-]{36}$/.test(body.requestId)
      : ["send-sticker", "send-media", "message-action"].includes(
            body.action,
          ) ||
          (body.action === "directory" && !directoryReads.includes(body.directory.kind)) ||
          (body.action === "friend-action" && body.friend.kind === "send") ||
          (body.action === "group-action" && body.group.kind !== "catalog") ||
          (body.action === "topic-action" && body.topic.kind !== "catalog") ||
          (body.action === "poll-action" && body.poll.kind !== "catalog")
        ? body.text === undefined &&
          typeof body.requestId === "string" &&
          /^[a-f0-9-]{36}$/.test(body.requestId)
        : body.text === undefined && body.requestId === undefined) &&
    (body.section === undefined ||
      (body.action === "conversation-info" &&
        ["overview", "images", "files", "links", "members"].includes(
          body.section,
        ))) &&
    (body.cursor === undefined ||
      (body.action === "conversation-info" &&
        body.section &&
        body.section !== "overview" &&
        typeof body.cursor === "string" &&
        /^\d{1,30}$/.test(body.cursor))) &&
    (body.before === undefined ||
      (body.action === "messages" &&
        body.before &&
        typeof body.before === "object" &&
        Object.keys(body.before).length === 2 &&
        typeof body.before.id === "string" &&
        /^[a-zA-Z0-9_.:-]{1,200}$/.test(body.before.id) &&
        typeof body.before.time === "string" &&
        /^\d{1,16}$/.test(body.before.time)))
  );
}
export function validMedia(media) {
  return (
    media &&
    typeof media === "object" &&
    !Array.isArray(media) &&
    Object.keys(media).length === 1 &&
    /^[a-f0-9-]{36}$/.test(media.uploadId || "")
  );
}
export function authorized(header, token) {
  const a = Buffer.from(header || ""),
    b = Buffer.from(`Bearer ${token}`);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export function validateIdentity(current, binding) {
  if (
    current.externalId &&
    binding &&
    current.externalId !== binding.externalId
  )
    return { state: "identity_mismatch" };
  if (
    current.state === "connected" &&
    (!/^\d+$/.test(current.externalId || "") ||
      typeof current.name !== "string" ||
      !current.name.trim())
  )
    return { state: "connecting" };
  return current;
}

export function validSticker(s) {
  return (
    !!s &&
    typeof s === "object" &&
    !Array.isArray(s) &&
    Object.keys(s).length === 2 &&
    Number.isSafeInteger(s.id) &&
    s.id > 0 &&
    s.id <= 2147483647 &&
    Number.isSafeInteger(s.categoryId) &&
    s.categoryId >= -10 &&
    s.categoryId <= 2147483647
  );
}

// Zalo RTF v1 uses UTF-16 start/len ranges, never executable markup.
export function validRichStyles(value, text) {
  return (
    typeof text === "string" &&
    Array.isArray(value) &&
    value.length <= 250 &&
    value.every(
      (s) =>
        s &&
        typeof s === "object" &&
        Object.keys(s).length === 3 &&
        Number.isSafeInteger(s.start) &&
        Number.isSafeInteger(s.len) &&
        s.start >= 0 &&
        s.len > 0 &&
        s.start + s.len <= text.length &&
        typeof s.st === "string" &&
        s.st.length <= 100 &&
        s.st
          .split(",")
          .every((code) =>
            /^(b|i|u|s|f_(13|15|18|20)|c_[a-fA-F0-9]{6}|lst_[12]|ind_([1-9]|[1-4][0-9]|50))$/.test(
              code,
            ),
          ),
    )
  );
}

export function validMessageAction(b) {
  return (
    Number.isSafeInteger(b.accountId) &&
    b.accountId > 0 &&
    typeof b.conversationId === "string" &&
    /^g?\d{1,30}$/.test(b.conversationId) &&
    typeof b.messageId === "string" &&
    /^\d{1,30}$/.test(b.messageId) &&
    ["star", "unstar", "pin", "recall", "delete", "react"].includes(
      b.operation,
    ) &&
    (b.operation === "react"
      ? [3, 5, 0, 32, 2, 20, -1].includes(b.reaction)
      : b.reaction === undefined)
  );
}

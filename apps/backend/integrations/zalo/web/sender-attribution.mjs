import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export function validCrmSender(sender) {
  return !!sender && Number.isSafeInteger(sender.userId) && sender.userId > 0 &&
    typeof sender.name === "string" && sender.name.trim().length > 0 &&
    sender.name.length <= 255 && Object.keys(sender).every(k => ["userId", "name"].includes(k));
}

// Exact native identity only. Persist before submission, including uncertain sends.
export class SenderAttribution {
  constructor(root) { this.root = root; }
  file(owner, senderId, conversationId, clientId, kind = 'message') {
    const key = crypto.createHash("sha256")
      .update(JSON.stringify([owner, senderId, conversationId, kind === 'call' ? `call:${clientId}` : clientId])).digest("hex");
    return path.join(this.root, key.slice(0, 2), key + ".json");
  }
  async record(owner, expectedId, conversationId, clientId, sender, kind = 'message') {
    if (!validCrmSender(sender) || !/^\d{1,30}$/.test(clientId || ""))
      throw Error("WEB_SENDER_INVALID");
    const file = this.file(owner, expectedId, conversationId, clientId, kind);
    await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    const temp = file + "." + crypto.randomUUID() + ".tmp";
    await fs.writeFile(temp, JSON.stringify(sender), { mode: 0o600, flag: "wx" });
    try {
      // Complete inode first, then exclusive link; never overwrite another actor.
      await fs.link(temp, file);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const prior = JSON.parse(await fs.readFile(file, "utf8"));
      if (prior.userId !== sender.userId) throw Error("WEB_SENDER_CONFLICT");
    } finally { await fs.unlink(temp); }
  }
  async decorate(owner, expectedId, conversationId, packet) {
    if (!Array.isArray(packet.messages)) return packet;
    const messages = [];
    // Bounded indexed disk reads, never scan receipts on a history request.
    for (let i = 0; i < packet.messages.length; i += 16) {
      messages.push(...await Promise.all(packet.messages.slice(i, i + 16).map(async message => {
        const { crmSender: ignored, ...clean } = message;
        const isCall = message.kind === 'call';
        const senderId = isCall ? (message.call?.direction === 'outgoing' ? expectedId : null) : message.mine ? expectedId :
          (conversationId.startsWith("g") ? message.sender?.id : null);
        const identity = isCall ? message.call?.id : message.clientId;
        if (!senderId || !/^\d{1,30}$/.test(identity || "")) return clean;
        try {
          const sender = JSON.parse(await fs.readFile(
            this.file(owner, senderId, conversationId, identity, isCall ? 'call' : 'message'), "utf8"));
          return validCrmSender(sender) ? { ...clean, crmSender: sender } : clean;
        } catch (error) {
          if (error.code !== "ENOENT") throw Error("WEB_SENDER_UNAVAILABLE");
          return clean;
        }
      })));
    }
    return { ...packet, messages };
  }
}

import { createHash } from 'node:crypto';

// Version this contract when projection semantics change. URLs are locators,
// not content identity; missing bytes still force a repair regardless of digest.
const fields = ['id', 'clientId', 'time', 'type', 'kind', 'text', 'styles', 'inline', 'mentions', 'photoGroup', 'attachments', 'quote', 'reactions', 'currentReaction', 'lastReaction', 'lastReactionMine', 'sender', 'mine', 'archiveProjection'];
function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, sorted(value[k])]));
  return value;
}
export function pcFingerprint(message) {
  const value = Object.fromEntries(fields.filter(k => message[k] !== undefined).map(k => [k, message[k]]));
  value.attachments = (message.attachments || []).map(a => {
    if (a.kind === 'link') return a;
    return Object.fromEntries(Object.entries(a).filter(([key]) => !['url', 'preview', 'archiveState', 'archiveError'].includes(key)));
  });
  return createHash('sha256').update(JSON.stringify(sorted(value))).digest('hex');
}
export function validateIndex(index, accountId, conversationId) {
  if (index?.format !== 'zalo-team-pc-index/1' || index.accountId !== accountId || index.conversationId !== conversationId || !index.messages || Array.isArray(index.messages)) throw Error('PC_INDEX_IDENTITY_MISMATCH');
  if (index.recoveryIds !== undefined && (!Array.isArray(index.recoveryIds) || index.recoveryIds.some(id => typeof id !== 'string'))) throw Error('PC_INDEX_RECOVERY_INVALID');
  return index;
}
export function planMessage(message, index) {
  if (index?.recoveryIds && !index.recoveryIds.includes(message.id)) return { emit: false, readySlots: [] };
  const known = index?.messages?.[message.id];
  const unchanged = known?.fingerprint === pcFingerprint(message);
  // Never suppress a changed projection merely because its source ID is known.
  return { emit: !unchanged || !known.complete, readySlots: unchanged ? (known.readySlots || []) : [] };
}

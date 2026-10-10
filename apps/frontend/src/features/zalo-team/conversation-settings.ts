import { privacyKinds, validPrivacy, type PrivacyAction } from './conversation-privacy';
export type ConversationSetting =
  | PrivacyAction
  | { kind: 'read' }
  | { kind: 'rename'; name: string }
  | { kind: 'mute'; mode: number }
  | { kind: 'unread'; unread: boolean }
  | { kind: 'pin'; pinned: boolean };

export function validConversationSettings(value: unknown): value is ConversationSetting {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const keys = Object.keys(v).sort().join(',');
  if (privacyKinds.includes(String(v.kind))) return validPrivacy(value);
  if (v.kind === 'read') return keys === 'kind';
  if (v.kind === 'unread') return keys === 'kind,unread' && typeof v.unread === 'boolean';
  if (v.kind === 'rename')
    return (
      keys === 'kind,name' &&
      typeof v.name === 'string' &&
      v.name.length <= 50 &&
      !/[\r\n\x00-\x1f]/.test(v.name)
    );
  if (v.kind === 'mute')
    return keys === 'kind,mode' && typeof v.mode === 'number' && [0, 1, 2, 3, 4].includes(v.mode);
  return v.kind === 'pin' && keys === 'kind,pinned' && typeof v.pinned === 'boolean';
}

export type ConversationSettings = {
  name: string;
  alias: string;
  muted: boolean;
  pinned: boolean;
  canRename: boolean;
  unread?: boolean;
  canMarkUnread?: boolean;
};

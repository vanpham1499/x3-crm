export type GroupContact = {
  id: string;
  name: string;
  avatarSrc?: string;
  joined: boolean;
  recent: boolean;
  friend: boolean;
};
export type GroupCatalog = {
  accountId: number;
  conversationId: string;
  contacts: GroupContact[];
  canAdd: boolean;
  limit: number;
  initial: string[];
  labels?: { id: string; name: string; members: string[] }[];
};
export function validGroup(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const group = value as Record<string, unknown>;
  const keys = Object.keys(group).sort().join(',');
  if (group.kind === 'leave')
    return (
      keys === 'kind' ||
      (keys === 'kind,successorId' &&
        typeof group.successorId === 'string' &&
        /^\d{1,30}$/.test(group.successorId))
    );
  if (['promote', 'demote', 'remove'].includes(String(group.kind)))
    return (
      keys === 'kind,memberId' &&
      typeof group.memberId === 'string' &&
      /^\d{1,30}$/.test(group.memberId)
    );
  if (group.kind === 'catalog') return keys === 'kind';
  if (
    (group.kind !== 'create' && group.kind !== 'add') ||
    !Array.isArray(group.members) ||
    group.members.length < (group.kind === 'create' ? 2 : 1) ||
    group.members.length > (group.kind === 'create' ? 100 : 50) ||
    new Set(group.members).size !== group.members.length ||
    !group.members.every((id) => typeof id === 'string' && /^\d{1,30}$/.test(id))
  )
    return false;
  return group.kind === 'add'
    ? keys === 'kind,members'
    : keys === 'kind,members,name' &&
        typeof group.name === 'string' &&
        group.name.length <= 50 &&
        !/[\x00-\x1f]/.test(group.name);
}

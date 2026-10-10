export type AccountGrant = {
  read: boolean;
  write: boolean;
  manage: boolean;
  sync: boolean;
  link: boolean;
  departmentId?: number | null;
  primaryUserId?: number | null;
  departmentName?: string | null;
};
export type AccountAccess = {
  admin: boolean;
  owner: string;
  userId: number;
  userName?: string;
  teams: number[];
  canLink: boolean;
  accounts: Record<string, AccountGrant>;
  loginIds: string[];
};
export const denied = 'WEB_ACCESS_DENIED';
export function canAccount(
  access: AccountAccess,
  account: number,
  ability: keyof AccountGrant = 'read',
) {
  return access.admin || access.accounts[String(account)]?.[ability] === true;
}
export function requireAccount(
  access: AccountAccess,
  account: number,
  ability: keyof AccountGrant = 'read',
) {
  if (!canAccount(access, account, ability)) throw Error(denied);
}
export function authorizeWeb(access: AccountAccess, body: any) {
  if (['status', 'events', 'conversations'].includes(body.action)) {
    if (body.accountId !== undefined) requireAccount(access, body.accountId);
    return;
  }
  // Login ownership and team selection are checked by CRM, not by the browser.
  if (['begin', 'retry', 'cancel'].includes(body.action)) return;
  if (body.action === 'group-links' || body.action === 'stop') {
    if (!access.admin) throw Error(denied);
    return;
  }
  let ability: 'read' | 'write' = 'write';
  if (
    ['messages', 'message-search', 'conversation-info', 'expressions', 'mentions'].includes(
      body.action,
    )
  )
    ability = 'read';
  if (
    body.action === 'directory' &&
    ['search', 'friends', 'groups', 'requests', 'invitations', 'profile', 'open'].includes(
      body.directory?.kind,
    )
  )
    ability = 'read';
  if (body.action === 'friend-action' && ['search', 'status', 'open'].includes(body.friend?.kind))
    ability = 'read';
  if (
    body.action === 'conversation-settings' &&
    ['read', 'privacy', 'hidden-list'].includes(body.settings?.kind)
  )
    ability = 'read';
  if (
    ['group-action', 'poll-action', 'topic-action'].includes(body.action) &&
    (body.group?.kind || body.poll?.kind || body.topic?.kind) === 'catalog'
  )
    ability = 'read';
  if (
    !access.admin &&
    ((body.action === 'message-action' && ['recall', 'delete'].includes(body.operation)) ||
      ['leave', 'disband', 'kick', 'remove', 'promote', 'demote'].includes(body.group?.kind) ||
      ['clear-history', 'ttl'].includes(body.settings?.kind) ||
      (body.action === 'directory' && body.directory?.kind === 'remove'))
  )
    throw Error(denied);
  requireAccount(access, body.accountId, ability);
}
export function filterWeb(access: AccountAccess, value: any): any {
  const output = { ...value };
  if (Array.isArray(output.accounts))
    output.accounts = output.accounts
      .filter((a: any) => canAccount(access, a.id))
      .map((a: any) => ({
        ...a,
        access: access.admin
          ? {
              ...access.accounts[a.id],
              read: true,
              write: true,
              manage: true,
              sync: true,
              link: true,
            }
          : access.accounts[a.id],
      }));
  if (Array.isArray(output.conversations))
    output.conversations = output.conversations.filter((a: any) => canAccount(access, a.accountId));
  if (Array.isArray(output.accountStates))
    output.accountStates = output.accountStates.filter((a: any) => canAccount(access, a.id));
  if (Array.isArray(output.groups))
    output.groups = output.groups.filter((g: any) =>
      g.sources?.every((s: string) => canAccount(access, Number(s.split(':')[0]))),
    );
  const delta = (d: any) =>
    d?.account && canAccount(access, d.account.id)
      ? {
          ...d,
          account: filterWeb(access, { accounts: [d.account] }).accounts[0],
          upserts: (d.upserts || []).filter(
            (r: any) => r.accountId === d.account.id && canAccount(access, r.accountId),
          ),
          removed: (d.removed || []).filter(
            (id: unknown) => typeof id === 'string' && id.startsWith(`${d.account.id}:`),
          ),
        }
      : undefined;
  if (output.inbox) output.inbox = delta(output.inbox);
  if (Array.isArray(output.inboxes)) output.inboxes = output.inboxes.map(delta).filter(Boolean);
  if (Array.isArray(output.changes))
    output.changes = output.changes.filter((c: any) => canAccount(access, c.accountId));
  if (output.login && !access.loginIds.includes(output.login.id)) output.login = null;
  if (value.runtime && !output.login)
    output.runtime = { available: value.runtime.available, state: 'ready' };
  if ('login' in value) output.access = { ...access, owner: undefined };
  return output;
}

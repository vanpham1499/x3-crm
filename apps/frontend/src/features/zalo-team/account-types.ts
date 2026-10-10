export type AccountStatus = 'connected' | 'offline' | 'expired' | 'connecting';
export type LinkedAccount = {
  access?: import('./account-access').AccountGrant;
  id: number;
  externalId: string;
  name: string;
  avatarSrc?: string;
  color: string;
  updatedAt: string;
  status: AccountStatus;
};
export type WebLogin = {
  id: string;
  accountId: number;
  name?: string | null;
  error?: string | null;
  state: string;
  expiresAt: number;
  qr: string | null;
};
export type WebSnapshot = {
  access?: import('./account-access').AccountAccess;
  runtime: { available: boolean; state: string; error?: string | null; version?: string };
  accounts: LinkedAccount[];
  login: WebLogin | null;
};

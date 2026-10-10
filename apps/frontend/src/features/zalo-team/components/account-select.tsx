'use client';
import type { ConversationListResponse } from '../types';
import { Avatar } from './avatar';
import { TeamSelect } from './team-select';
export function AccountSelect({
  accounts,
  value,
  onChange,
  placeholder = 'Chọn tài khoản',
}: {
  accounts: ConversationListResponse['accounts'];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <TeamSelect
      aria-label="Tài khoản danh bạ"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      disabled={!accounts.length}
      options={accounts.map((account) => ({
        value: String(account.id),
        label: account.name,
        icon: (
          <Avatar
            size={24}
            conversation={{ name: account.name, avatarSrc: account.avatarSrc, color: '#e5efff' }}
          />
        ),
        description: account.state !== 'connected' || account.error ? 'Chưa kết nối' : undefined,
      }))}
    />
  );
}

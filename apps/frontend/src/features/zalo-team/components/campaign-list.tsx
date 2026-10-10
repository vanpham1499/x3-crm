'use client';
import { ListPagination, type ListPaginationData } from './list-pagination';
import { Avatar } from './avatar';
import { Icon } from './icon';
import { TeamSelect } from './team-select';
import { SearchInput } from './primitives';
import { CampaignMenu, type CampaignAction } from './campaign-menu';
import { CampaignProgress, CampaignStatus } from './campaign-progress';
import styles from '../campaigns.module.css';

type Item = {
  id: string;
  name: string;
  accountId: number;
  accountName: string;
  recipients: number;
  state: string;
  counts: Record<string, number>;
  createdAt?: string;
  canEdit?: boolean;
  canCopy?: boolean;
};
export function CampaignList({
  items,
  accounts,
  labels,
  search,
  onSearch,
  filter,
  onFilter,
  busy,
  loading,
  onOpen,
  load,
  onAction,
  pagination,
  onPage,
}: {
  items: Item[];
  pagination?: ListPaginationData;
  onPage: (page: number) => void;
  accounts: { id: number; avatarSrc?: string }[];
  labels: Record<string, string>;
  search: string;
  onSearch: (s: string) => void;
  filter: string;
  onFilter: (s: string) => void;
  busy: boolean;
  loading: boolean;
  onOpen: (id: string) => void;
  load: (id: string) => Promise<Item>;
  onAction: (id: string, action: CampaignAction) => void;
}) {
  const rows = pagination
    ? items
    : items.filter(
        (c) =>
          (filter === 'all' || c.state === filter) &&
          c.name.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')),
      );
  return (
    <>
      <h2 className={styles.listCount}>
        {loading ? 'Chiến dịch (…)' : `Chiến dịch (${pagination?.total ?? items.length})`}
      </h2>
      <section className={styles.campaignList} aria-label="Danh sách chiến dịch">
        <div className={styles.listTools}>
          <SearchInput
            label="Tìm chiến dịch"
            placeholder="Tìm kiếm tên chiến dịch"
            value={search}
            onValueChange={onSearch}
          />
          <TeamSelect
            aria-label="Trạng thái chiến dịch"
            value={filter}
            onChange={(e) => onFilter(e.target.value)}
            options={[
              { value: 'all', label: 'Tất cả trạng thái' },
              ...['draft', 'running', 'paused', 'completed', 'cancelled'].map((value) => ({
                value,
                label: value === 'completed' ? 'Đã kết thúc' : labels[value],
              })),
            ]}
          />
        </div>
        <table className={styles.campaignTable}>
          <colgroup>
            <col style={{ width: '31%' }} />
            <col style={{ width: '21%' }} />
            <col style={{ width: '24%' }} />
            <col />
            <col style={{ width: 56 }} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Chiến dịch</th>
              <th scope="col">Tài khoản gửi</th>
              <th scope="col">Tiến độ gửi</th>
              <th scope="col">Trạng thái</th>
              <th scope="col">
                <span className={styles.srOnly}>Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td className={styles.campaignNameCell}>
                  <button
                    className={styles.campaignName}
                    onClick={() => onOpen(c.id)}
                    title={c.name}
                  >
                    {c.name}
                  </button>
                  <span className={styles.rowMeta}>
                    {c.recipients} người/nhóm
                    {c.createdAt
                      ? ` · ${new Date(c.createdAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`
                      : ''}
                  </span>
                </td>
                <td className={styles.accountCell}>
                  <div>
                    <Avatar
                      size={32}
                      conversation={{
                        name: c.accountName,
                        avatarSrc: accounts.find((a) => a.id === c.accountId)?.avatarSrc,
                        color: '#e5efff',
                      }}
                    />
                    <span title={c.accountName}>{c.accountName}</span>
                  </div>
                </td>
                <td className={styles.progressCell}>
                  <CampaignProgress counts={c.counts} compact />
                </td>
                <td className={styles.statusCell}>
                  <CampaignStatus campaign={c} labels={labels} />
                </td>
                <td className={styles.actionCell}>
                  <CampaignMenu
                    campaign={c}
                    busy={busy}
                    load={() => load(c.id)}
                    onAction={(action) => onAction(c.id, action)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pagination && <ListPagination {...pagination} busy={loading} onPage={onPage} />}
        {!rows.length && (
          <div className={styles.listEmpty}>
            <Icon name={search || filter !== 'all' ? 'search' : 'documents'} size={36} />
            <strong>
              {loading
                ? 'Đang tải danh sách…'
                : items.length || search || filter !== 'all'
                  ? 'Không có chiến dịch phù hợp'
                  : 'Chưa có chiến dịch'}
            </strong>
            <span>
              {items.length || search || filter !== 'all'
                ? 'Thử tên khác hoặc đổi trạng thái lọc.'
                : 'Tạo chiến dịch để chọn người nhận và soạn tin.'}
            </span>
            {!!(items.length || search || filter !== 'all') && (
              <button
                onClick={() => {
                  onSearch('');
                  onFilter('all');
                }}
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        )}
      </section>
    </>
  );
}

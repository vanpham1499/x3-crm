export type InboxNoticeInput = {
  listError: string;
  liveDisconnected: boolean;
  archiveError: string;
  tagsError: string;
  unavailable: string[];
  listUnavailable?: string[];
  preparing?: string[];
  directoryError?: string;
  searchError?: string;
  hasRows: boolean;
};

// One notice for the inbox, while preserving individual failures in its details.
export function inboxNotice(input: InboxNoticeInput) {
  const listUnavailable = input.listUnavailable || [];
  const preparing = input.preparing || [];
  const details = [
    input.listError && `Danh sách: ${input.listError}`,
    input.liveDisconnected && 'Cập nhật trực tiếp đang mất kết nối.',
    input.archiveError && `Lịch sử đã lưu: ${input.archiveError}`,
    input.tagsError && `Phân loại: ${input.tagsError}`,
    input.unavailable.length > 0 && `Tài khoản cần kiểm tra: ${input.unavailable.join(', ')}.`,
    listUnavailable.length > 0 &&
      `Đã kết nối nhưng chưa đọc được hội thoại: ${listUnavailable.join(', ')}.`,
    preparing.length > 0 && `Chưa đọc được danh sách: ${preparing.join(', ')}.`,
    input.directoryError && `Tìm danh bạ: ${input.directoryError}`,
    input.searchError && `Tìm lịch sử: ${input.searchError}`,
  ].filter((message): message is string => !!message);
  if (!details.length) return null;
  const login = /đăng nhập CRM/.test(input.listError);
  const sharedConnection = (input.listError || input.liveDisconnected) && input.archiveError;
  return {
    title: login
      ? 'Phiên CRM cần đăng nhập lại'
      : sharedConnection
        ? 'Chưa kết nối được Zalo Team'
        : input.listError
          ? 'Chưa tải được danh sách trò chuyện'
          : input.liveDisconnected
            ? 'Cập nhật trực tiếp bị gián đoạn'
            : input.unavailable.length
              ? 'Có tài khoản Zalo cần kiểm tra'
              : listUnavailable.length
                ? 'Chưa tải được danh sách trò chuyện'
                : preparing.length
                  ? 'Một tài khoản đang chờ dữ liệu'
                  : input.tagsError
                    ? 'Chưa cập nhật được phân loại'
                    : input.archiveError
                      ? 'Chưa cập nhật được lịch sử đã lưu'
                      : 'Kết quả tìm kiếm chưa đầy đủ',
    description: login
      ? 'Đăng nhập CRM rồi tải lại danh sách.'
      : input.hasRows
        ? 'Danh sách đã tải vẫn được giữ. Thử lại để cập nhật.'
        : sharedConnection
          ? 'Kết nối đến dịch vụ Zalo chưa sẵn sàng. Bấm Thử lại.'
          : listUnavailable.length && !input.unavailable.length
            ? 'Tài khoản đã kết nối. Bấm Thử lại để đọc danh sách.'
            : preparing.length && !input.unavailable.length
              ? 'Hệ thống sẽ thử lại. Xem bước đang vướng trong Chi tiết.'
              : 'Bấm Thử lại để tải dữ liệu.',
    details,
    showAccounts: !login && !sharedConnection && input.unavailable.length > 0,
  };
}

// A fresh login can authenticate before its native inbox is ready. Recover
// without waiting indefinitely for a new-message event; never retry mutations.
export function inboxRetryDelay(
  accounts: { state: string; error: string | null }[],
  attempt: number,
): number | null {
  const waiting = accounts.some(
    (account) =>
      ['starting', 'connecting'].includes(account.state) ||
      (account.state === 'connected' &&
        ['WEB_CONVERSATIONS_NOT_READY', 'WEB_CONVERSATIONS_UNAVAILABLE', 'WEB_READ_TIMEOUT'].includes(
          account.error || '',
        )),
  );
  return waiting ? ([2000, 4000, 8000, 15000, 30000][attempt] ?? 30000) : null;
}

export type VietQrBank = {
  id?: number;
  name: string;
  code: string;
  bin: string;
  shortName: string;
  logo: string;
  transferSupported: number | null;
  lookupSupported: number | null;
};

export async function fetchVietQrBanks() {
  const response = await fetch('/api/vietqr/banks');

  if (!response.ok) {
    throw new Error('Không tải được danh sách ngân hàng VietQR');
  }

  return (await response.json()) as VietQrBank[];
}

export function getVietQrBankLabel(bank: VietQrBank) {
  return bank.shortName && bank.shortName !== bank.name
    ? `${bank.shortName} - ${bank.name}`
    : bank.name;
}

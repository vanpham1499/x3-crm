import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type VietQrBankApiItem = {
  id?: number;
  name?: string;
  code?: string;
  bin?: string;
  shortName?: string;
  logo?: string;
  transferSupported?: number;
  lookupSupported?: number;
  short_name?: string;
  transfer_supported?: number;
  lookup_supported?: number;
};

type VietQrBankApiResponse = {
  data?: VietQrBankApiItem[];
};

export async function GET() {
  const response = await fetch('https://api.vietqr.io/v2/banks', {
    next: { revalidate: 24 * 60 * 60 },
  });

  if (!response.ok) {
    return NextResponse.json(
      { message: 'Không tải được danh sách ngân hàng VietQR' },
      { status: response.status },
    );
  }

  const payload = (await response.json()) as VietQrBankApiResponse;
  const banks = (payload.data || [])
    .map((bank) => ({
      id: bank.id,
      name: bank.name || '',
      code: bank.code || '',
      bin: bank.bin || '',
      shortName: bank.shortName || bank.short_name || bank.code || '',
      logo: bank.logo || '',
      transferSupported: bank.transferSupported ?? bank.transfer_supported ?? null,
      lookupSupported: bank.lookupSupported ?? bank.lookup_supported ?? null,
    }))
    .filter((bank) => bank.code && bank.name);

  return NextResponse.json(banks);
}

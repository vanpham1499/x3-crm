import type { ProjectCost } from '@/types/project-cost';
import type { AppOption } from '@/types/option';

export const isAdPromotion = (cost: Pick<ProjectCost, 'entryType' | 'fundingSource'>) =>
  cost.entryType === 'ad_spend' && cost.fundingSource === 'promotion';

// This only identifies old card entries for review; it never reclassifies money.
export const isLegacyPromotionCard = (card?: AppOption | null) =>
  card?.label?.trim().toUpperCase() === 'MKM';

export function promotionAvailable(cost: ProjectCost) {
  if (!isAdPromotion(cost) || cost.status !== 'completed') return 0;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(
    new Date(),
  );
  if (cost.promotionExpiresOn && cost.promotionExpiresOn < today) return 0;
  return Math.max(
    0,
    Number(cost.totalAmount || 0) -
      Number(cost.promotionUsedAmount || 0) -
      Number(cost.promotionRevokedAmount || 0),
  );
}

export function promotionStatus(cost: ProjectCost) {
  if (cost.status === 'cancelled') return 'Đã hủy';
  if (cost.status !== 'completed') return 'Chờ cấp MKM';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(
    new Date(),
  );
  if (cost.promotionExpiresOn && cost.promotionExpiresOn < today) return 'MKM hết hạn';
  if (Number(cost.promotionRevokedAmount) > 0 && promotionAvailable(cost) === 0)
    return 'MKM đã thu hồi';
  if (Number(cost.promotionUsedAmount) >= Number(cost.totalAmount)) return 'Đã dùng hết MKM';
  return 'Đã cấp MKM';
}

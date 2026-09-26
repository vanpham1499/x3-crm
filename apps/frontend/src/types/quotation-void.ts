export type QuotationVoidEntry = {
  allocationId: number;
  paymentId: number;
  reference?: string | null;
  bankAmount?: string | number | null;
  transactionAt?: string | null;
  allocatedAt?: string | null;
  amount: number;
  transferAmount: number;
  releaseAmount: number;
};

export type QuotationVoidPreview = {
  sourceId: number;
  sourceCode: string;
  projectId: number;
  projectCode: string;
  customerId: number;
  totalAmount: number;
  mode: 'release' | 'transfer';
  targetId: number | null;
  targetCode: string | null;
  allocatedAmount: number;
  transferAmount: number;
  releaseAmount: number;
  targetOutstandingBefore: number;
  targetOutstandingAfter: number;
  availableBudgetBefore: number;
  availableBudgetAfter: number;
  acquisitionBefore: { quotationCode: string; paidAt: string } | null;
  acquisitionAfter: { quotationCode: string; paidAt: string } | null;
  entries: QuotationVoidEntry[];
  warnings: string[];
  blockers: string[];
  fingerprint: string;
};

export type QuotationVoidAudit = Omit<QuotationVoidPreview, 'fingerprint' | 'blockers'> & {
  reason: string;
  actor: { id: number; code?: string | null; name: string };
  voidedAt: string;
  newAllocationIds: number[];
};

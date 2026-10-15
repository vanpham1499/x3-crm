const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('exports', 'require', 'module', code)(mod.exports, (name) => name.startsWith('.')
    ? load(path.resolve(path.dirname(file), name + '.ts')) : require(name), mod);
  cache.set(file, mod.exports);
  return mod.exports;
}
const { calculateQuotationEligibleTopupBudget: eligible, calculateAvailableTopupBudget: topup } = load('apps/frontend/src/lib/project-topup-budget.ts');
const { calculateProjectServiceFinance: finance } = load('apps/frontend/src/lib/project-service-finance.ts');
const { calculateRealizedProjectCost: paidCosts } = load('apps/frontend/src/lib/project-topup-budget.ts');
const { promotionAvailable, promotionStatus } = load('apps/frontend/src/lib/ad-promotion.ts');
test('3m customer cash plus 3m gifted credit remains two separate sources', () => {
  const q = { id: 7, quotationCode: '1.DV1.M.TEST.Q001', metadata: { projectType: 'M', budget: 3000000, promotionBudget: 3000000 },
    vatRate: 0, grossPaidAmount: 3000000, serviceCollectedBeforeVat: 0,
    items: [{itemCode: '-1', amountBeforeVat: 3000000, amountAfterVat: 3000000}] };
  const cash = {id: 21, entryType: 'ad_spend', status: 'completed', totalAmount: 3000000};
  const gift = {...cash, id: 22, fundingSource: 'promotion'};
  const split = topup({quotations: [q], costs: [cash, gift]});
  assert.equal(split.paidBudget, 3000000);
  assert.equal(split.usedBudget, 3000000);
  assert.equal(split.availableBudget, 0);
  assert.equal(paidCosts([cash, gift]), 3000000);
  assert.equal(finance([q], [cash, gift]).serviceProfit, 0);
  assert.equal(promotionAvailable(gift), 3000000);
  assert.equal(promotionAvailable({...gift, status: 'pending'}), 0);
  assert.equal(promotionAvailable({...gift, promotionUsedAmount: 1000000, promotionRevokedAmount: 500000}), 1500000);
  assert.equal(promotionAvailable({...gift, promotionExpiresOn: '2020-01-01'}), 0);
  assert.equal(promotionStatus({...gift, promotionExpiresOn: '2020-01-01'}), 'MKM hết hạn');
});
test('partner payment ledger cash figures include instalments without treating total obligation as cash', () => {
  assert.equal(paidCosts([{entryType: 'partner_cost', usesPaymentLedger: true, status: 'pending', totalAmount: 7000000, partnerPaidAmount: 3000000}]), 3000000);
  assert.equal(paidCosts([{entryType: 'partner_cost', usesPaymentLedger: true, status: 'pending', totalAmount: 7000000, partnerPaidAmount: 0}]), 0);
  assert.equal(paidCosts([{entryType: 'partner_cost', usesPaymentLedger: false, status: 'completed', totalAmount: 7000000}]), 7000000);
});
const k = { id: 1, quotationCode: '869.DV1.K.TEST.Q001', metadata: { projectType: 'K', budget: 39140620 },
  vatRate: 8, grossPaidAmount: 6340780, serviceCollectedBeforeVat: 5871093, items: [
    { itemCode: '-1', amountBeforeVat: 39140620, metadata: { excludedFromTotal: true } },
    { itemCode: '-2', amountBeforeVat: 5871093, amountAfterVat: 6340780 },
  ] };
const m = { id: 2, quotationCode: '1.DV1.M.TEST.Q001', metadata: { projectType: 'M', budget: 10000000 },
  vatRate: 8, grossPaidAmount: 12420000, serviceCollectedBeforeVat: 1500000, items: [
    { itemCode: '-1', amountBeforeVat: 10000000, amountAfterVat: 10800000 },
    { itemCode: '-2', amountBeforeVat: 1500000, amountAfterVat: 1620000 },
  ] };
test('K screenshot, partial receipt, legacy flags and changed project type never fund ads', () => {
  assert.equal(eligible(k), 0);
  assert.equal(topup({ quotations: [k], costs: [] }).availableBudget, 0);
  assert.equal(finance([k], []).serviceProfit, 5871093);
  const stale = { ...k, topupEligibleAmount: 42000000, topupPaidBudget: 6340780, topupCreditEnabled: true, topupCreditLimit: 1000000 };
  assert.equal(topup({ quotations: [stale], costs: [] }).availableBudget, 0);
  assert.equal(eligible({ ...k, metadata: { budget: 39140620 }, project: { projectType: 'M' } }), 0);
  assert.equal(topup({ quotations: [{ ...k, grossPaidAmount: 3000000 }], costs: [] }).availableBudget, 0);
});
test('M source, excluded budget lines and explicit extra sources', () => {
  assert.equal(eligible(m), 10800000);
  assert.equal(eligible({ ...m, items: [{ ...m.items[0], metadata: { excludedFromTotal: true } }, m.items[1]] }), 0);
  assert.equal(eligible({ ...m, items: [...m.items, { itemCode: 'extra', amountAfterVat: 1080000, metadata: { countsTowardTopupBudget: true } }] }), 11880000);
  assert.equal(eligible({ ...m, items: [m.items[1]] }), 10800000);
  assert.equal(eligible({ id: 3, metadata: { budget: 1000000 } }), 0);
  assert.equal(eligible({ ...m, isVoided: true }), 0);
});
test('approved credit, full refund and old K overspend', () => {
  assert.equal(topup({ quotations: [{ ...m, grossPaidAmount: 3000000, topupCreditEnabled: true, topupCreditLimit: 4000000 }], costs: [] }).availableBudget, 7000000);
  assert.equal(topup({ quotations: [{ ...m, isFullyRefunded: true, topupCreditEnabled: true, topupCreditLimit: 4000000 }], costs: [] }).availableBudget, 0);
  const oldCost = { id: 1, entryType: 'ad_spend', status: 'completed', totalAmount: 1000000 };
  const result = topup({ quotations: [k], costs: [oldCost] });
  assert.equal(result.availableBudget, -1000000);
  assert.equal(result.hasTopupBudgetSource, false);
  assert.equal(finance([k], [oldCost]).serviceProfit, 4871093);
});
test('service profit excludes ad principal, subtracts partner costs, overhead and compensation', () => {
  const costs = [
    { id: 1, entryType: 'ad_spend', status: 'completed', totalAmount: 10800000, realizedCostAmount: 10850000 },
    { id: 2, entryType: 'partner_cost', status: 'completed', totalAmount: 200000 },
    { id: 3, entryType: 'partner_cost', status: 'pending', totalAmount: 500000 },
  ];
  assert.equal(finance([{ ...m, compensationAmount: 100000 }], costs).serviceProfit, 1150000);
  assert.equal(finance([m], []).serviceProfit, 1500000); // unspent budget isn't profit
  assert.equal(finance([{ ...k, financialNeedsReview: true }], []).serviceProfit, null);
  assert.equal(finance([{ id: 3 }], []).serviceProfit, null);
  assert.equal(finance([{ ...k, isVoided: true }], []).serviceProfit, 0);
});
test('CID restoration and decimal costs do not create service income', () => {
  const cost = { id: 1, entryType: 'ad_spend', status: 'completed', totalAmount: 1000000.49,
    realizedCostAmount: 600000.49, cidIsDead: true, cidIncident: { status: 'confirmed', refundedAmount: 400000 } };
  assert.equal(topup({ quotations: [m], costs: [cost] }).usedBudget, 600000);
  assert.equal(finance([m], [cost]).serviceProfit, 1500000);
});

test('returned advertising budget cannot cover costs or hide a loss', () => {
  const cost = { id: 1, entryType: 'ad_spend', status: 'completed', totalAmount: 10000000 };
  assert.equal(finance([{ ...m, budgetRefundedAmount: 2000000 }], [cost]).serviceProfit, 300000);
  assert.equal(finance([{ ...m, isFullyRefunded: true, serviceCollectedBeforeVat: 0 }], [cost]).serviceProfit, -10000000);
});

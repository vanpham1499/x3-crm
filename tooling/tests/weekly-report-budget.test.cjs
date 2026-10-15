const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const compiled = ts.transpileModule(fs.readFileSync('apps/frontend/src/lib/weekly-report-money.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const mod = { exports: {} };
new Function('exports', 'require', 'module', compiled)(mod.exports, require, mod);
const { calculateWeeklyBudget, weeklyReportMoneyDefaults } = mod.exports;

test('fixed 30-day formula, exact rounding and valid input boundaries', () => {
  for (const [input, expected] of [
    ['15000000', '3500000.00'], ['30000000', '7000000.00'], ['0', '0.00'],
    ['0.01', '0.00'], ['0.15', '0.04'], ['100', '23.33'], ['1234.56', '288.06'],
    ['9999999999999.99', '2333333333333.33'], ['15.000.000', '3500000.00'],
    ['', ''], ['-1', ''], ['abc', ''],
  ]) assert.equal(calculateWeeklyBudget(input), expected, input);
});

test('safe integer rounding agrees with exact rational arithmetic at the upper boundary', () => {
  for (let offset = 0n; offset < 300n; offset++) {
    const cents = 999999999999999n - offset;
    const amount = `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
    const expected = (cents * 7n + 15n) / 30n;
    assert.equal(calculateWeeklyBudget(amount), `${expected / 100n}.${String(expected % 100n).padStart(2, '0')}`);
  }
});

test('project presets calculate VND and never relabel it as a foreign currency', () => {
  assert.equal(weeklyReportMoneyDefaults('VND', '15000000').averageWeeklyBudget, '3500000.00');
  assert.equal(weeklyReportMoneyDefaults('USD', '15000000').totalBudget, '');
  assert.equal(calculateWeeklyBudget('300.50'), '70.12');
});

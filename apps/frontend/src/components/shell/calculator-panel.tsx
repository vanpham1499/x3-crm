'use client';

import { useState } from 'react';
import BackspaceRoundedIcon from '@mui/icons-material/BackspaceRounded';
import CalculateRoundedIcon from '@mui/icons-material/CalculateRounded';

type Operator = '+' | '-' | 'x' | '/' | null;

const buttons = [
  ['C', '%', 'backspace', '/'],
  ['7', '8', '9', 'x'],
  ['4', '5', '6', '-'],
  ['1', '2', '3', '+'],
  ['0', '000', '.', '='],
];

function calculate(first: number, second: number, operator: Operator) {
  if (operator === '+') return first + second;
  if (operator === '-') return first - second;
  if (operator === 'x') return first * second;
  if (operator === '/') return second === 0 ? 0 : first / second;

  return second;
}

function cleanResult(value: number) {
  if (!Number.isFinite(value)) return '0';

  return Number.parseFloat(value.toFixed(10)).toString();
}

function formatDisplay(value: string) {
  if (!value) return '0';
  if (value === '-') return value;

  const isNegative = value.startsWith('-');
  const unsignedValue = isNegative ? value.slice(1) : value;
  const [integer = '0', decimal] = unsignedValue.split('.');
  const normalizedInteger = integer.replace(/^0+(?=\d)/, '') || '0';
  const formattedInteger = Number(normalizedInteger).toLocaleString('vi-VN');
  const formattedValue =
    decimal !== undefined ? `${formattedInteger},${decimal}` : formattedInteger;

  return isNegative ? `-${formattedValue}` : formattedValue;
}

export function CalculatorPanel() {
  const [display, setDisplay] = useState('0');
  const [storedValue, setStoredValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputDigit = (digit: string) => {
    setDisplay((current) => {
      if (waitingForOperand) {
        setWaitingForOperand(false);
        return digit === '000' ? '0' : digit;
      }

      if (current === '0') {
        return digit === '000' ? '0' : digit;
      }

      return `${current}${digit}`;
    });
  };

  const inputDecimal = () => {
    setDisplay((current) => {
      if (waitingForOperand) {
        setWaitingForOperand(false);
        return '0.';
      }

      return current.includes('.') ? current : `${current}.`;
    });
  };

  const clear = () => {
    setDisplay('0');
    setStoredValue(null);
    setOperator(null);
    setWaitingForOperand(false);
  };

  const backspace = () => {
    setDisplay((current) => {
      if (waitingForOperand || current.length <= 1) return '0';

      return current.slice(0, -1);
    });
  };

  const inputPercent = () => {
    const currentValue = Number(display);
    setDisplay(cleanResult(currentValue / 100));
  };

  const chooseOperator = (nextOperator: Operator) => {
    const currentValue = Number(display);

    if (storedValue === null) {
      setStoredValue(currentValue);
    } else if (operator) {
      const result = calculate(storedValue, currentValue, operator);
      setStoredValue(result);
      setDisplay(cleanResult(result));
    }

    setOperator(nextOperator);
    setWaitingForOperand(true);
  };

  const performEquals = () => {
    if (storedValue === null || !operator) return;

    const result = calculate(storedValue, Number(display), operator);
    setDisplay(cleanResult(result));
    setStoredValue(null);
    setOperator(null);
    setWaitingForOperand(true);
  };

  const handleButton = (value: string) => {
    if (/^\d+$/.test(value)) {
      inputDigit(value);
      return;
    }

    if (value === '.') inputDecimal();
    if (value === 'C') clear();
    if (value === 'backspace') backspace();
    if (value === '%') inputPercent();
    if (value === '=') performEquals();
    if (value === '+' || value === '-' || value === 'x' || value === '/') {
      chooseOperator(value);
    }
  };

  const renderButtonLabel = (value: string) => {
    if (value === 'backspace') return <BackspaceRoundedIcon className="text-[18px]" />;
    if (value === 'x') return 'x';
    if (value === '/') return '/';

    return value;
  };

  return (
    <aside className="sticky top-0 z-20 hidden h-screen w-[320px] shrink-0 border-r border-slate-200 bg-slate-50 px-4 py-5 lg:block">
      <div className="flex h-full flex-col">
        <div className="mb-4 flex items-center gap-3 px-1">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
            <CalculateRoundedIcon className="text-[22px]" />
          </span>
          <div>
            <p className="text-sm font-extrabold text-slate-950">Máy tính</p>
            <p className="text-xs font-medium text-slate-500">Tính nhanh trong CRM</p>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-4 shadow-xl shadow-slate-200/70">
          <div className="mb-4 rounded-2xl bg-slate-900 px-4 py-5 text-right">
            <p className="min-h-5 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              {operator ? `Đang tính ${operator}` : 'Sẵn sàng'}
            </p>
            <p className="mt-2 min-h-12 break-all text-4xl font-bold leading-tight text-white">
              {formatDisplay(display)}
            </p>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {buttons.flat().map((value) => {
              const isOperator = ['/', 'x', '-', '+', '='].includes(value);
              const isUtility = ['C', '%', 'backspace'].includes(value);

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleButton(value)}
                  className={`flex h-14 items-center justify-center rounded-2xl text-base font-extrabold transition active:scale-[0.98] ${
                    isOperator
                      ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                      : isUtility
                        ? 'bg-slate-700 text-slate-100 hover:bg-slate-600'
                        : 'bg-slate-800 text-white hover:bg-slate-700'
                  }`}
                >
                  {renderButtonLabel(value)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-bold uppercase text-slate-400">Ghi chú</p>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
            Panel này nằm cố định như một cột phụ, không tự đóng khi thao tác trên nội dung trang.
          </p>
        </div>
      </div>
    </aside>
  );
}

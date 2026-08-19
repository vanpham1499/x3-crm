'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import BackspaceRoundedIcon from '@mui/icons-material/BackspaceRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteSweepRoundedIcon from '@mui/icons-material/DeleteSweepRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import { UtilityDrawer } from '@/components/shell/utility-drawer';

type Operator = '+' | '-' | '×' | '÷' | null;

type CalculatorHistoryItem = {
  id: string;
  expression: string;
  result: string;
  createdAt: string;
};

const CALCULATOR_HISTORY_KEY = 'x3-calculator-history';
const MAX_HISTORY_ITEMS = 30;
const MAX_INPUT_LENGTH = 18;

const buttons = [
  ['AC', '%', 'backspace', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '-'],
  ['1', '2', '3', '+'],
  ['0', '000', '.', '='],
];

function calculate(first: number, second: number, operator: Operator) {
  if (operator === '+') return first + second;
  if (operator === '-') return first - second;
  if (operator === '×') return first * second;
  if (operator === '÷') {
    if (second === 0) throw new Error('Không thể chia cho 0');
    return first / second;
  }

  return second;
}

function cleanResult(value: number) {
  if (!Number.isFinite(value)) throw new Error('Kết quả không hợp lệ');

  return Number.parseFloat(value.toFixed(10)).toString();
}

function formatDisplay(value: string) {
  if (!value) return '0';
  if (value === '-') return value;

  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return value;

  const isNegative = value.startsWith('-');
  const unsignedValue = isNegative ? value.slice(1) : value;
  const [integer = '0', decimal] = unsignedValue.split('.');
  const normalizedInteger = integer.replace(/^0+(?=\d)/, '') || '0';
  const formattedInteger = Number(normalizedInteger).toLocaleString('vi-VN');
  const formattedValue =
    decimal !== undefined ? `${formattedInteger},${decimal}` : formattedInteger;

  return isNegative ? `-${formattedValue}` : formattedValue;
}

function readHistory() {
  if (typeof window === 'undefined') return [];

  try {
    const storedHistory = JSON.parse(window.localStorage.getItem(CALCULATOR_HISTORY_KEY) ?? '[]');

    return Array.isArray(storedHistory)
      ? (storedHistory as CalculatorHistoryItem[]).slice(0, MAX_HISTORY_ITEMS)
      : [];
  } catch {
    return [];
  }
}

function saveHistory(items: CalculatorHistoryItem[]) {
  try {
    window.localStorage.setItem(CALCULATOR_HISTORY_KEY, JSON.stringify(items));
  } catch {
    // Máy tính vẫn hoạt động nếu trình duyệt chặn localStorage.
  }
}

function isTextInput(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function CalculatorPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const calculatorRef = useRef<HTMLDivElement>(null);
  const [display, setDisplay] = useState('0');
  const [storedValue, setStoredValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [expression, setExpression] = useState('');
  const [error, setError] = useState('');
  const [history, setHistory] = useState<CalculatorHistoryItem[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setHistory(readHistory());
  }, []);

  useEffect(() => {
    if (!open) return;

    const focusTimer = window.setTimeout(() => calculatorRef.current?.focus(), 80);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  const inputDigit = useCallback(
    (digit: string) => {
      setError('');
      if (waitingForOperand) setWaitingForOperand(false);
      setDisplay((current) => {
        const nextValue = waitingForOperand
          ? digit === '000'
            ? '0'
            : digit
          : current === '0'
            ? digit === '000'
              ? '0'
              : digit
            : `${current}${digit}`;
        return nextValue.replace(/[-.]/g, '').length > MAX_INPUT_LENGTH ? current : nextValue;
      });
    },
    [waitingForOperand],
  );

  const inputDecimal = useCallback(() => {
    setError('');
    if (waitingForOperand) setWaitingForOperand(false);
    setDisplay((current) => {
      if (waitingForOperand) return '0.';

      return current.includes('.') ? current : `${current}.`;
    });
  }, [waitingForOperand]);

  const clear = useCallback(() => {
    setDisplay('0');
    setStoredValue(null);
    setOperator(null);
    setWaitingForOperand(false);
    setExpression('');
    setError('');
  }, []);

  const backspace = useCallback(() => {
    setError('');
    if (waitingForOperand) return;

    setDisplay((current) => (current.length <= 1 ? '0' : current.slice(0, -1)));
  }, [waitingForOperand]);

  const inputPercent = useCallback(() => {
    setError('');
    const currentValue = Number(display);
    const result = cleanResult(currentValue / 100);
    setExpression(`${formatDisplay(display)}%`);
    setDisplay(result);
    setWaitingForOperand(true);
  }, [display]);

  const chooseOperator = useCallback(
    (nextOperator: Exclude<Operator, null>) => {
      setError('');
      const currentValue = Number(display);
      let nextStoredValue = currentValue;

      try {
        if (storedValue !== null && operator && !waitingForOperand) {
          nextStoredValue = calculate(storedValue, currentValue, operator);
          setDisplay(cleanResult(nextStoredValue));
        } else if (storedValue !== null) {
          nextStoredValue = storedValue;
        }

        setStoredValue(nextStoredValue);
        setOperator(nextOperator);
        setWaitingForOperand(true);
        setExpression(`${formatDisplay(cleanResult(nextStoredValue))} ${nextOperator}`);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Không thể tính kết quả');
        setOperator(null);
        setStoredValue(null);
      }
    },
    [display, operator, storedValue, waitingForOperand],
  );

  const addHistory = useCallback((historyExpression: string, result: string) => {
    const nextItem: CalculatorHistoryItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      expression: historyExpression,
      result,
      createdAt: new Date().toISOString(),
    };

    setHistory((current) => {
      const nextHistory = [nextItem, ...current].slice(0, MAX_HISTORY_ITEMS);
      saveHistory(nextHistory);
      return nextHistory;
    });
  }, []);

  const performEquals = useCallback(() => {
    if (storedValue === null || !operator || waitingForOperand) return;

    const secondValue = Number(display);
    const historyExpression = `${formatDisplay(cleanResult(storedValue))} ${operator} ${formatDisplay(display)}`;

    try {
      const result = cleanResult(calculate(storedValue, secondValue, operator));
      setDisplay(result);
      setExpression(`${historyExpression} =`);
      setStoredValue(null);
      setOperator(null);
      setWaitingForOperand(true);
      setError('');
      addHistory(historyExpression, result);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Không thể tính kết quả');
      setExpression(historyExpression);
      setStoredValue(null);
      setOperator(null);
      setWaitingForOperand(true);
    }
  }, [addHistory, display, operator, storedValue, waitingForOperand]);

  const handleButton = useCallback(
    (value: string) => {
      if (/^\d+$/.test(value)) inputDigit(value);
      else if (value === '.') inputDecimal();
      else if (value === 'AC') clear();
      else if (value === 'backspace') backspace();
      else if (value === '%') inputPercent();
      else if (value === '=') performEquals();
      else if (['+', '-', '×', '÷'].includes(value)) {
        chooseOperator(value as Exclude<Operator, null>);
      }

      calculatorRef.current?.focus();
    },
    [backspace, chooseOperator, clear, inputDecimal, inputDigit, inputPercent, performEquals],
  );

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTextInput(event.target)) return;
      if (event.target instanceof HTMLButtonElement && ['Enter', ' '].includes(event.key)) {
        return;
      }

      let action = event.key;
      if (event.key === '*') action = '×';
      if (event.key === '/') action = '÷';
      if (event.key === 'Enter') action = '=';
      if (event.key === 'Delete' || event.key.toLowerCase() === 'c') action = 'AC';
      if (event.key === 'Backspace') action = 'backspace';
      if (event.key === ',') action = '.';

      const isSupported =
        /^\d$/.test(action) ||
        ['.', '+', '-', '×', '÷', '=', '%', 'AC', 'backspace'].includes(action);

      if (!isSupported) return;
      event.preventDefault();
      handleButton(action);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleButton, open]);

  const copyResult = async (value = display) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    saveHistory([]);
    calculatorRef.current?.focus();
  };

  const recallResult = (result: string) => {
    setDisplay(result);
    setExpression('Kết quả từ lịch sử');
    setStoredValue(null);
    setOperator(null);
    setWaitingForOperand(true);
    setError('');
    calculatorRef.current?.focus();
  };

  return (
    <UtilityDrawer open={open} onClose={onClose} title="Máy tính">
      <div
        ref={calculatorRef}
        tabIndex={-1}
        className="sidebar-scrollbar h-full overflow-y-auto bg-slate-50 p-4 outline-none dark:bg-slate-950 sm:p-5"
      >
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="bg-slate-950 p-4 text-white sm:p-5">
            <div className="flex min-h-6 items-center justify-between gap-3">
              <p className="truncate text-xs font-semibold text-slate-400">{error || expression}</p>
              <button
                type="button"
                onClick={() => copyResult()}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
                aria-label="Sao chép kết quả"
              >
                {copied ? (
                  <CheckRoundedIcon className="!text-[17px]" />
                ) : (
                  <ContentCopyRoundedIcon className="!text-[17px]" />
                )}
                {copied ? 'Đã chép' : 'Sao chép'}
              </button>
            </div>
            <p
              className={`mt-2 min-h-12 break-all text-right text-[34px] font-black leading-tight tracking-tight sm:text-[38px] ${error ? 'text-rose-300' : 'text-white'}`}
              aria-live="polite"
            >
              {error ? 'Lỗi' : formatDisplay(display)}
            </p>
          </div>

          <div className="p-3 sm:p-4">
            <div className="grid grid-cols-4 gap-2.5">
              {buttons.flat().map((value) => {
                const isOperator = ['÷', '×', '-', '+', '='].includes(value);
                const isActiveOperator = operator === value;
                const isUtility = ['AC', '%', 'backspace'].includes(value);

                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleButton(value)}
                    aria-label={value === 'backspace' ? 'Xóa một ký tự' : value}
                    className={`flex h-12 items-center justify-center rounded-2xl text-base font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.97] motion-reduce:transform-none motion-reduce:transition-none sm:h-14 ${
                      isOperator
                        ? isActiveOperator
                          ? 'bg-emerald-700 text-white shadow-sm'
                          : 'bg-primary text-white shadow-sm hover:bg-emerald-600'
                        : isUtility
                          ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                          : 'border border-slate-200 bg-white text-slate-900 hover:border-primary/40 hover:bg-primary/5 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800'
                    }`}
                  >
                    {value === 'backspace' ? (
                      <BackspaceRoundedIcon className="!text-[20px]" />
                    ) : (
                      value
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <HistoryRoundedIcon className="!text-[20px]" />
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Lịch sử kết quả
                </h3>
              </div>
            </div>
            {history.length > 0 ? (
              <button
                type="button"
                onClick={clearHistory}
                className="inline-flex h-9 items-center gap-1 rounded-xl px-2.5 text-xs font-bold text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 dark:hover:bg-rose-950/30 motion-reduce:transition-none"
              >
                <DeleteSweepRoundedIcon className="!text-[18px]" />
                Xóa hết
              </button>
            ) : null}
          </div>

          {history.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center dark:border-slate-700">
              <p className="text-sm font-bold text-slate-500">Chưa có phép tính nào</p>
            </div>
          ) : (
            <div className="sidebar-scrollbar mt-3 max-h-72 space-y-1 overflow-y-auto pr-1">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-center gap-2 rounded-2xl px-3 py-2.5 transition hover:bg-slate-50 dark:hover:bg-slate-800 motion-reduce:transition-none"
                >
                  <button
                    type="button"
                    onClick={() => recallResult(item.result)}
                    className="min-w-0 flex-1 text-left focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    title="Dùng lại kết quả"
                  >
                    <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {item.expression}
                    </p>
                    <p className="mt-0.5 truncate text-lg font-black text-slate-900 dark:text-white">
                      = {formatDisplay(item.result)}
                    </p>
                    <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
                      {new Intl.DateTimeFormat('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(new Date(item.createdAt))}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => copyResult(item.result)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 opacity-70 transition hover:bg-white hover:text-primary hover:shadow-sm focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 group-hover:opacity-100 dark:hover:bg-slate-700 motion-reduce:transition-none"
                    aria-label={`Sao chép kết quả ${formatDisplay(item.result)}`}
                  >
                    <ContentCopyRoundedIcon className="!text-[18px]" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </UtilityDrawer>
  );
}

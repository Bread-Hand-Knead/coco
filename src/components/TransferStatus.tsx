import { useState, type SyntheticEvent } from 'react';
import type { Transaction } from '../types';
import { formatLocalDate } from '../lib/dateUtils';
import { getTransferredAmount } from '../lib/recordUtils';
import { NumberInput } from './NumberInput';

/**
 * 帳戶明細展開後的「轉帳狀態」：
 * - 標記為已轉帳（整筆）或選日期
 * - 付一部分：填金額和日期，可以分好幾次；加起來付清時自動變成已轉帳
 */
export function TransferStatus({ record, onUpdate }: {
  record: Transaction;
  onUpdate: (oldRec: Transaction, newRec: Transaction) => void;
}) {
  const total = Math.abs(record.amount || 0);
  const payments = record.transferPayments || [];
  const paid = getTransferredAmount(record);
  const remaining = Math.max(0, total - paid);
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(() => formatLocalDate(new Date()));

  const save = (next: Partial<Transaction>) => onUpdate(record, { ...record, ...next });

  const openAdd = () => {
    setAmount(Math.ceil(remaining / 2)); // 預設先付一半
    setDate(formatLocalDate(new Date()));
    setAdding(true);
  };

  const addPayment = () => {
    if (!(amount > 0)) return;
    const nextPayments = [...payments, { date, amount: Math.min(amount, remaining) }];
    const nextPaid = nextPayments.reduce((s, p) => s + p.amount, 0);
    save({
      transferPayments: nextPayments,
      // 加起來付清了 → 自動標記為已轉帳（日期用最後一次）
      transferredDate: nextPaid >= total ? date : undefined,
    });
    setAdding(false);
  };

  const removePayment = (idx: number) => {
    const nextPayments = payments.filter((_, i) => i !== idx);
    save({ transferPayments: nextPayments.length ? nextPayments : undefined, transferredDate: undefined });
  };

  const stop = (e: SyntheticEvent) => e.stopPropagation();
  const chip = 'px-2.5 py-1 rounded-lg text-xs font-bold border active:scale-95 transition-all whitespace-nowrap';
  const dateInput = 'px-2 py-0.5 bg-white border border-stone-200 rounded-lg text-[11px] font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]';

  return (
    <div className="flex items-start gap-2.5 w-full flex-wrap" onClick={stop}>
      <span className="text-stone-400 font-bold min-w-[65px] flex-shrink-0 text-xs sm:text-[13px] pt-1">轉帳狀態:</span>
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        {record.transferredDate ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg text-xs font-black border border-emerald-200 whitespace-nowrap">
              ✓ 已轉帳 ({record.transferredDate})
            </span>
            {payments.length === 0 && (
              <input type="date" value={record.transferredDate} onChange={e => save({ transferredDate: e.target.value || undefined })} className={dateInput} />
            )}
            <button
              onClick={() => save({ transferredDate: undefined, transferPayments: undefined })}
              className="text-stone-400 hover:text-rose-500 text-xs font-bold px-1.5 py-0.5 rounded hover:bg-stone-100"
              title="清除轉帳紀錄"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => save({ transferredDate: formatLocalDate(new Date()) })} className={`${chip} bg-stone-50 hover:bg-stone-100 text-stone-600 border-stone-200`}>
              {payments.length ? '剩下的全部轉了' : '標記為已轉帳'}
            </button>
            <button onClick={openAdd} className={`${chip} bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200`}>
              ＋ 付一部分
            </button>
            {payments.length === 0 && (
              <>
                <span className="text-[#8C7B72]/70 text-xs whitespace-nowrap">或選擇日期:</span>
                <input type="date" onChange={e => save({ transferredDate: e.target.value || undefined })} className={dateInput} />
              </>
            )}
          </div>
        )}

        {payments.length > 0 && (
          <div className="bg-[#FFFDF5] border border-stone-200 rounded-xl p-2 space-y-1">
            <div className="flex justify-between text-xs font-black">
              <span className="text-emerald-700">已轉 ${paid.toLocaleString()}</span>
              {remaining > 0 && <span className="text-rose-500">還差 ${remaining.toLocaleString()}</span>}
            </div>
            {payments.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between text-[11px] font-bold text-stone-500">
                <span>・{p.date.replace(/-/g, '/')}　${Number(p.amount).toLocaleString()}</span>
                <button onClick={() => removePayment(idx)} className="text-stone-400 hover:text-rose-500 px-1.5" title="刪掉這一次">✕</button>
              </div>
            ))}
          </div>
        )}

        {adding && !record.transferredDate && (
          <div className="flex items-center gap-2 flex-wrap bg-amber-50/60 border border-amber-200 rounded-xl p-2">
            <span className="text-xs font-bold text-amber-900">這次轉</span>
            <NumberInput integer value={amount} onValueChange={setAmount} className="w-24 px-2 py-1 bg-white border border-stone-200 rounded-lg text-xs font-black text-[#5D4037] outline-none" />
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={dateInput} />
            <button onClick={addPayment} className={`${chip} bg-[#5D4037] text-white border-[#5D4037]`}>確定</button>
            <button onClick={() => setAdding(false)} className="text-xs font-bold text-stone-400 px-1">取消</button>
            <span className="w-full text-[10px] font-bold text-stone-500">還差 ${remaining.toLocaleString()}，預設先轉一半</span>
          </div>
        )}
      </div>
    </div>
  );
}

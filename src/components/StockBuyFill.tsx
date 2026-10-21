import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { Account, Transaction } from '../types';
import { getFontFamily } from '../lib/financeUtils';
import { calcNetCost, calcTradeAmount, isPendingStockBuy } from '../lib/stockSync';
import { NumberInput } from './NumberInput';

/** 扣款紀錄實際從帳戶扣掉的錢（金額 + 這筆另外記的手續費） */
const deductedOf = (r: Transaction) => Math.abs(r.amount || 0) + (r.fee || 0);
const stockLabel = (r: Transaction) => `${r.stockBuy?.code || ''}${r.stockBuy?.name ? ' ' + r.stockBuy.name : ''}`;

/**
 * 投資頁上方的「待補股數」清單：列出在帳戶記了買股票扣款、但還沒照對帳單補股數的紀錄。
 */
export function PendingStockBuys({ records, accounts, onFill }: {
  records: Transaction[];
  accounts: Account[];
  onFill: (r: Transaction) => void;
}) {
  const pending = useMemo(
    () => (Array.isArray(records) ? records : []).filter(isPendingStockBuy).sort((a, b) => (a.date < b.date ? -1 : 1)),
    [records],
  );
  if (pending.length === 0) return null;
  return (
    <div className="bg-[#FFF4D3] border-2 border-[#FFD54F] rounded-[24px] p-4 space-y-2" style={getFontFamily()}>
      <div className="flex items-center justify-between">
        <h3 className="font-black text-[#5D4037]">📝 待補股數（{pending.length} 筆）</h3>
        <span className="text-xs font-bold text-amber-800">照對帳單補上股數，持股才會更新</span>
      </div>
      {pending.map(r => (
        <button
          key={r.id}
          type="button"
          onClick={() => onFill(r)}
          className="w-full bg-white rounded-2xl px-4 py-3 flex items-center justify-between gap-3 text-left shadow-sm active:scale-[0.98] transition-transform"
        >
          <span className="min-w-0">
            <span className="block font-black text-[#5D4037] truncate">{stockLabel(r)}</span>
            <span className="block text-xs font-bold text-stone-500">
              {r.date.replace(/-/g, '/')}・{accounts.find(a => a.id === r.accountId)?.name || ''}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block font-black text-rose-500">-${deductedOf(r).toLocaleString()}</span>
            <span className="block text-xs font-black text-amber-700">補股數 ›</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * 補股數視窗：照證券對帳單／扣款通知填股數、單價、手續費（或直接填客戶淨付），並核對應退款。
 */
export function StockBuyFillModal({ record, records, onClose, onSave }: {
  record: Transaction | null;
  records: Transaction[];
  onClose: () => void;
  onSave: (oldRec: Transaction, newRec: Transaction) => void;
}) {
  return (
    <AnimatePresence>
      {record && <FillForm key={record.id} record={record} records={records} onClose={onClose} onSave={onSave} />}
    </AnimatePresence>
  );
}

function FillForm({ record, records, onClose, onSave }: {
  record: Transaction;
  records: Transaction[];
  onClose: () => void;
  onSave: (oldRec: Transaction, newRec: Transaction) => void;
}) {
  const sb = record.stockBuy!;
  // 手續費預設：同一檔上次填的手續費
  const lastFee = useMemo(() => {
    const prev = (Array.isArray(records) ? records : [])
      .filter(r => r.id !== record.id && r.stockBuy?.code === sb.code && r.stockBuy?.fee !== undefined)
      .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    return prev?.stockBuy?.fee ?? 0;
  }, [records, record.id, sb.code]);

  const [tradeDate, setTradeDate] = useState(sb.tradeDate || record.date);
  const [shares, setShares] = useState<number>(sb.shares || 0);
  const [price, setPrice] = useState<number>(sb.price || 0);
  const [fee, setFee] = useState<number>(sb.fee ?? lastFee);
  const [netOverride, setNetOverride] = useState<number | null>(sb.netCost && sb.price === undefined ? sb.netCost : null);
  const [error, setError] = useState('');

  const tradeAmount = shares > 0 && price > 0 ? calcTradeAmount(shares, price) : 0;
  const autoNet = shares > 0 && price > 0 ? calcNetCost(shares, price, fee) : 0;
  const netCost = netOverride ?? autoNet;
  const deducted = deductedOf(record);
  const refund = netCost > 0 ? deducted - netCost : 0;

  const save = () => {
    if (!(shares > 0)) { setError('請填買進股數'); return; }
    if (!(netCost > 0)) { setError('請填成交單價，或直接填客戶淨付'); return; }
    // 只填淨付沒填單價時，用淨付反推單價
    const finalPrice = price > 0 ? price : parseFloat(((netCost - fee) / shares).toFixed(4));
    onSave(record, { ...record, stockBuy: { ...sb, shares, price: finalPrice, fee, netCost, tradeDate } });
    onClose();
  };
  const clearFill = () => {
    onSave(record, { ...record, stockBuy: { ...sb, shares: undefined, price: undefined, fee: undefined, netCost: undefined, tradeDate: undefined } });
    onClose();
  };

  const field = 'w-full p-3 bg-white border-2 border-stone-100 rounded-xl font-black text-lg text-[#5D4037] outline-none focus:border-[#FFD54F]';
  const label = 'text-xs font-black text-stone-500 px-1';

  return (
    <motion.div
      className="fixed inset-0 z-[240] bg-black/40 flex items-end md:items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-md bg-[#FFF9E3] rounded-t-[32px] md:rounded-[32px] p-6 pb-8 space-y-4 max-h-[92vh] overflow-y-auto shadow-2xl"
        initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }}
        onClick={e => e.stopPropagation()}
        style={getFontFamily()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-[#5D4037]">補股數：{stockLabel(record)}</h3>
            <p className="text-xs font-bold text-stone-500">
              {record.date.replace(/-/g, '/')} 扣款 ${deducted.toLocaleString()}・照證券對帳單或扣款通知填
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="關閉" className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-stone-400 shadow-sm shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className={label}>成交日期</span>
            <input type="date" value={tradeDate} onChange={e => setTradeDate(e.target.value)} className={field + ' text-base'} />
          </label>
          <label className="space-y-1">
            <span className={label}>買進股數</span>
            <NumberInput integer value={shares} onValueChange={v => { setShares(v); setNetOverride(null); }} placeholder="例如 86" className={field} />
          </label>
          <label className="space-y-1">
            <span className={label}>成交單價</span>
            <NumberInput value={price} onValueChange={v => { setPrice(v); setNetOverride(null); }} placeholder="例如 23.03" className={field} />
          </label>
          <label className="space-y-1">
            <span className={label}>手續費</span>
            <NumberInput integer value={fee} onValueChange={v => { setFee(v); setNetOverride(null); }} className={field} />
          </label>
        </div>

        <label className="block space-y-1">
          <span className={label}>客戶淨付（對帳單最右邊那欄，可以直接填）</span>
          <NumberInput integer value={netCost} onValueChange={v => setNetOverride(v > 0 ? v : null)} className={field} />
          {netOverride === null && tradeAmount > 0 && (
            <span className="block text-xs font-bold text-stone-500 px-1">成交金額 {tradeAmount.toLocaleString()}（無條件捨去）+ 手續費 {fee} = {autoNet.toLocaleString()}</span>
          )}
        </label>

        {netCost > 0 && (
          <div className={`rounded-2xl p-3 text-sm font-bold ${refund >= 0 ? 'bg-white text-[#5D4037]' : 'bg-rose-50 text-rose-600'}`}>
            <div className="flex justify-between"><span>扣款</span><span>${deducted.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>− 客戶淨付</span><span>${netCost.toLocaleString()}</span></div>
            <div className="flex justify-between font-black border-t border-stone-100 mt-1 pt-1">
              <span>{refund >= 0 ? '＝ 應退款' : '淨付比扣款還多'}</span><span>${Math.abs(refund).toLocaleString()}</span>
            </div>
            <p className="text-xs font-bold mt-1 text-stone-500">
              {refund > 0 ? '和對帳單或銀行的「退還／轉帳存入」金額一樣就對了；退款記得在帳戶另外記一筆收入。'
                : refund === 0 ? '剛好用完，沒有退款。'
                : '請確認扣款金額或股數、單價是不是抄錯了。'}
            </p>
          </div>
        )}

        {error && <p className="text-sm font-black text-rose-600">{error}</p>}

        <button type="button" onClick={save} className="w-full py-4 bg-[#5D4037] text-white rounded-2xl font-black text-lg active:scale-95 transition-transform">
          儲存，更新持股
        </button>
        {sb.shares ? (
          <button type="button" onClick={clearFill} className="w-full py-2 text-stone-500 font-bold text-sm">
            清除股數（改回待補，持股會扣回）
          </button>
        ) : null}
      </motion.div>
    </motion.div>
  );
}

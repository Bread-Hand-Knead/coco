import type { Stock, StockBuyInfo, Transaction } from '../types';
import { resolveBrokerAccount } from './accountUtils';
import type { Account } from '../types';

/**
 * 帳戶扣款紀錄 ↔ 投資頁持股 的同步計算（純函式，不碰畫面或資料庫）。
 *
 * 流程：
 * 1. 在帳戶記一筆「投資」扣款，選擇是哪一檔 → 紀錄帶有 stockBuy，但還沒有股數（待補股數）
 * 2. 收到對帳單後補上股數、單價、手續費 → 這筆紀錄開始「貢獻」股數與成本到該持股
 * 3. 之後修改、刪除、還原這筆紀錄 → 先扣掉舊的貢獻、再加上新的貢獻
 */

/** 台股算法：成交金額 = 股數 × 單價 無條件捨去，淨付 = 成交金額 + 手續費 */
export const calcTradeAmount = (shares: number, price: number) => Math.floor(shares * price + 1e-9);
export const calcNetCost = (shares: number, price: number, fee: number) => calcTradeAmount(shares, price) + (fee || 0);

/** 已經補好股數的扣款紀錄，算出它對持股的貢獻；還沒補、或已刪除的紀錄沒有貢獻 */
export interface StockContribution {
  stockId: string;
  shares: number;
  netCost: number; // 含手續費
  fee: number;
}
export const contributionOf = (r: Transaction | null | undefined): StockContribution | null => {
  const sb = r?.stockBuy;
  if (!r || r.isDeleted || !sb || !sb.appliedStockId) return null;
  if (!(sb.shares && sb.shares > 0) || !(sb.netCost && sb.netCost > 0)) return null;
  return { stockId: sb.appliedStockId, shares: sb.shares, netCost: sb.netCost, fee: sb.fee || 0 };
};

/** 是否為「待補股數」的扣款 */
export const isPendingStockBuy = (r: Transaction) =>
  !!r.stockBuy && !r.isDeleted && !(r.stockBuy.shares && r.stockBuy.shares > 0);

/**
 * 把一筆貢獻加到（sign = 1）或扣出（sign = -1）持股。
 * 平均成本的算法和投資頁原本一致：(總成本 − 累計手續費) ÷ 股數。股數、成本最低停在 0。
 */
export const applyContribution = (stock: Stock, c: StockContribution, sign: 1 | -1): Stock => {
  const oldShares = stock.shares || 0;
  const oldCost = stock.totalCost !== undefined ? stock.totalCost : Math.round(oldShares * (stock.avgPrice || 0));
  const shares = Math.max(0, parseFloat((oldShares + sign * c.shares).toFixed(4)));
  const totalCost = shares > 0 ? Math.max(0, oldCost + sign * c.netCost) : 0;
  const fee = shares > 0 ? Math.max(0, (stock.fee || 0) + sign * c.fee) : 0;
  const avgPrice = shares > 0 ? parseFloat((Math.max(0, totalCost - fee) / shares).toFixed(4)) : 0;
  return { ...stock, shares, totalCost, fee, avgPrice };
};

const normCode = (code: string) => (code || '').trim().toUpperCase().split(/\s+/)[0];

/** 找到這筆扣款要加到哪一檔持股：先用指定的 id，再用「代號 + 同一證券戶」，都沒有就回傳 null（需要新增） */
export const findTargetStock = (sb: StockBuyInfo, stocks: Stock[], accounts: Account[]): Stock | null => {
  const live = stocks.filter(s => !s.isDeleted);
  const byId = (id?: string) => (id ? live.find(s => s.id === id) : undefined);
  const hit = byId(sb.appliedStockId) || byId(sb.stockId);
  if (hit) return hit;
  const broker = resolveBrokerAccount(sb.brokerAccountId, accounts);
  return live.find(s => normCode(s.code) === normCode(sb.code) && resolveBrokerAccount(s.linkedAccount, accounts) === broker) || null;
};

export const newStockFor = (sb: StockBuyInfo, accounts: Account[]): Stock => ({
  id: `stk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  code: sb.name ? `${sb.code} ${sb.name}` : sb.code,
  category: 'stock',
  shares: 0,
  avgPrice: 0,
  totalCost: 0,
  fee: 0,
  linkedAccount: resolveBrokerAccount(sb.brokerAccountId, accounts),
  purchaseDate: sb.tradeDate,
});

/**
 * 紀錄從 oldRec 變成 newRec 時（新增時 oldRec = null，刪除時 newRec = null），
 * 算出持股要怎麼改，以及 newRec 要記住加到哪一檔（appliedStockId）。
 */
export const planStockSync = (
  oldRec: Transaction | null,
  newRec: Transaction | null,
  stocks: Stock[],
  accounts: Account[],
): { record: Transaction | null; changedStocks: Stock[] } => {
  const working = new Map(stocks.map(s => [s.id, s]));
  const changed = new Map<string, Stock>();
  const put = (s: Stock) => { working.set(s.id, s); changed.set(s.id, s); };

  const oldC = contributionOf(oldRec);
  if (oldC) {
    const s = working.get(oldC.stockId);
    if (s) put(applyContribution(s, oldC, -1));
  }

  let record = newRec;
  if (newRec?.stockBuy && !newRec.isDeleted) {
    const sb = newRec.stockBuy;
    const filled = !!(sb.shares && sb.shares > 0 && sb.netCost && sb.netCost > 0);
    let target = findTargetStock(sb, [...working.values()], accounts);
    if (filled) {
      if (!target) { target = newStockFor(sb, accounts); put(target); }
      const c: StockContribution = { stockId: target.id, shares: sb.shares!, netCost: sb.netCost!, fee: sb.fee || 0 };
      const updated = applyContribution(working.get(target.id)!, c, 1);
      put(sb.tradeDate ? { ...updated, purchaseDate: updated.purchaseDate || sb.tradeDate } : updated);
    }
    const linkId = filled ? target!.id : target?.id;
    record = {
      ...newRec,
      stockId: linkId || newRec.stockId,
      stockBuy: { ...sb, stockId: linkId || sb.stockId, appliedStockId: filled ? target!.id : undefined },
    };
  }

  return { record, changedStocks: [...changed.values()] };
};

import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, RotateCcw, X } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Account, Stock, Transaction } from '../types';

export function RecycleBinView({
  records,
  stocks,
  accounts,
  onBack,
  onRestoreRecord,
  onRestoreStock,
  onHardDeleteRecord,
  onHardDeleteStock,
  onClearTrash
}: {
  records: Transaction[];
  stocks: Stock[];
  accounts: Account[];
  onBack: () => void;
  onRestoreRecord: (id: string) => void;
  onRestoreStock: (id: string) => void;
  onHardDeleteRecord: (id: string) => void;
  onHardDeleteStock: (id: string) => void;
  onClearTrash: (tab: 'all' | 'records' | 'stocks') => void;
}) {
  const [activeTab, setActiveTab] = useState<'all' | 'records' | 'stocks'>('all');
  const [itemToHardDelete, setItemToHardDelete] = useState<{ type: 'record' | 'stock'; id: string; name: string } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const deletedRecords = useMemo(() => records.filter(r => r.isDeleted), [records]);
  const deletedStocks = useMemo(() => stocks.filter(s => s.isDeleted), [stocks]);

  const sortedDeletedRecords = useMemo(() => {
    return [...deletedRecords].sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''));
  }, [deletedRecords]);

  const sortedDeletedStocks = useMemo(() => {
    return [...deletedStocks].sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''));
  }, [deletedStocks]);

  const accountMap = useMemo(() => {
    const map = new Map<string, string>();
    accounts.forEach(a => map.set(a.id, a.name));
    return map;
  }, [accounts]);

  const formatDeletedAt = (isoString?: string) => {
    if (!isoString) return '近期';
    try {
      const d = new Date(isoString);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
    } catch (e) {
      return '近期';
    }
  };

  const hasItems = (activeTab === 'all' && (deletedRecords.length > 0 || deletedStocks.length > 0)) ||
                   (activeTab === 'records' && deletedRecords.length > 0) ||
                   (activeTab === 'stocks' && deletedStocks.length > 0);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col gap-4 px-4 py-6 pb-24"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1 px-3 py-1.5 bg-white rounded-full text-stone-600 font-bold text-sm shadow-xs hover:bg-stone-100"
        >
          <ChevronLeft size={18} />
          <span>返回</span>
        </button>
        <h1 className="text-xl font-black text-[#5D4037] flex items-center gap-2">
          <span>🗑️ 垃圾桶 (回收筒)</span>
        </h1>
        {hasItems ? (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-full font-bold text-xs border border-rose-200 shadow-xs active:scale-95 transition-all"
          >
            清空垃圾桶
          </button>
        ) : (
          <div className="w-16" />
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-stone-100 p-1 rounded-2xl gap-1 shadow-inner">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
            activeTab === 'all'
              ? 'bg-white text-[#5D4037] shadow-sm'
              : 'text-stone-400 hover:text-stone-600'
          }`}
        >
          全部 ({deletedRecords.length + deletedStocks.length})
        </button>
        <button
          onClick={() => setActiveTab('records')}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
            activeTab === 'records'
              ? 'bg-white text-[#5D4037] shadow-sm'
              : 'text-stone-400 hover:text-stone-600'
          }`}
        >
          一般收支 ({deletedRecords.length})
        </button>
        <button
          onClick={() => setActiveTab('stocks')}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
            activeTab === 'stocks'
              ? 'bg-white text-[#5D4037] shadow-sm'
              : 'text-stone-400 hover:text-stone-600'
          }`}
        >
          股票投資 ({deletedStocks.length})
        </button>
      </div>

      {/* Item List */}
      {!hasItems ? (
        <div className="bg-white rounded-[30px] p-12 text-center shadow-sm border-2 border-white flex flex-col items-center justify-center gap-3 my-4">
          <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center text-3xl text-stone-400">
            🗑️
          </div>
          <span className="font-black text-stone-500 text-base">垃圾桶內沒有任何刪除紀錄</span>
          <span className="text-xs text-stone-400">被軟刪除的交易或股票項目會暫存在這裡</span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {(activeTab === 'all' || activeTab === 'records') && sortedDeletedRecords.map(rec => (
            <div
              key={rec.id}
              className="bg-white rounded-[24px] p-4 shadow-sm border border-stone-100 flex flex-col gap-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black text-sm shrink-0 border border-amber-200/50">
                    {rec.type === 'income' ? '💰' : rec.type === 'transfer' ? '🔄' : '💸'}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-[#5D4037] text-base">{rec.category || '未分類'}</span>
                      {rec.note && (
                        <span className="text-xs text-stone-500 truncate max-w-[140px]">({rec.note})</span>
                      )}
                    </div>
                    <span className="text-xs text-stone-400 font-medium">
                      {rec.date} · {accountMap.get(rec.accountId) || '未知帳戶'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className={`font-black text-base ${rec.type === 'income' ? 'text-emerald-600' : 'text-[#5D4037]'}`}>
                    {rec.type === 'income' ? '+' : ''}${Math.abs(rec.amount).toLocaleString()}
                  </span>
                  <span className="text-[10px] text-rose-400 font-bold bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
                    刪除於 {formatDeletedAt(rec.deletedAt)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-50">
                <button
                  onClick={() => onRestoreRecord(rec.id)}
                  className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl font-bold text-xs flex items-center gap-1 border border-emerald-200/60 active:scale-95 transition-all"
                >
                  <RotateCcw size={14} />
                  <span>還原</span>
                </button>
                <button
                  onClick={() => setItemToHardDelete({ type: 'record', id: rec.id, name: `${rec.date} ${rec.category} $${Math.abs(rec.amount)}` })}
                  className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl font-bold text-xs flex items-center gap-1 border border-rose-200/60 active:scale-95 transition-all"
                >
                  <X size={14} />
                  <span>永久刪除</span>
                </button>
              </div>
            </div>
          ))}

          {(activeTab === 'all' || activeTab === 'stocks') && sortedDeletedStocks.map(stk => (
            <div
              key={stk.id}
              className="bg-white rounded-[24px] p-4 shadow-sm border border-stone-100 flex flex-col gap-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center font-black text-sm shrink-0 border border-sky-200/50">
                    📈
                  </div>
                  <div className="flex flex-col">
                    <span className="font-black text-[#5D4037] text-base">{stk.code}</span>
                    <span className="text-xs text-stone-400 font-medium">
                      {stk.shares} 股 · 均價 ${stk.avgPrice} · {accountMap.get(stk.linkedAccount) || '未指定帳戶'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-black text-base text-[#5D4037]">
                    ${(stk.totalCost || (stk.shares * stk.avgPrice)).toLocaleString()}
                  </span>
                  <span className="text-[10px] text-rose-400 font-bold bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
                    刪除於 {formatDeletedAt(stk.deletedAt)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-50">
                <button
                  onClick={() => onRestoreStock(stk.id)}
                  className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl font-bold text-xs flex items-center gap-1 border border-emerald-200/60 active:scale-95 transition-all"
                >
                  <RotateCcw size={14} />
                  <span>還原</span>
                </button>
                <button
                  onClick={() => setItemToHardDelete({ type: 'stock', id: stk.id, name: `${stk.code} (${stk.shares}股)` })}
                  className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl font-bold text-xs flex items-center gap-1 border border-rose-200/60 active:scale-95 transition-all"
                >
                  <X size={14} />
                  <span>永久刪除</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Overlay: Hard Delete Single Item */}
      {itemToHardDelete && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={(e) => { e.stopPropagation(); setItemToHardDelete(null); }}
        >
          <div 
            className="bg-white rounded-[30px] p-6 w-full max-w-sm shadow-2xl flex flex-col gap-4 animate-scale-up border-2 border-stone-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-500">
              <AlertTriangle size={24} className="shrink-0" />
              <span className="font-black text-lg">確定要永久刪除嗎？</span>
            </div>
            <p className="text-sm font-bold text-stone-600">
              「{itemToHardDelete.name}」將會從資料庫中徹底移除，此動作無法復原！
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setItemToHardDelete(null)}
                className="flex-1 py-3 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-2xl font-bold text-sm transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (itemToHardDelete.type === 'record') {
                    onHardDeleteRecord(itemToHardDelete.id);
                  } else {
                    onHardDeleteStock(itemToHardDelete.id);
                  }
                  setItemToHardDelete(null);
                }}
                className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-bold text-sm shadow-md transition-colors"
              >
                確定刪除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Overlay: Clear Trash */}
      {showClearConfirm && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={(e) => { e.stopPropagation(); setShowClearConfirm(false); }}
        >
          <div 
            className="bg-white rounded-[30px] p-6 w-full max-w-sm shadow-2xl flex flex-col gap-4 animate-scale-up border-2 border-stone-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-500">
              <AlertTriangle size={24} className="shrink-0" />
              <span className="font-black text-lg">確定要清空垃圾桶嗎？</span>
            </div>
            <p className="text-sm font-bold text-stone-600">
              此操作將會永久刪除目前 {activeTab === 'all' ? '垃圾桶中的所有' : activeTab === 'records' ? '所有一般收支' : '所有股票投資'} 項目，且無法再次還原！
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-3 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-2xl font-bold text-sm transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  onClearTrash(activeTab);
                  setShowClearConfirm(false);
                }}
                className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-bold text-sm shadow-md transition-colors"
              >
                確認清空
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

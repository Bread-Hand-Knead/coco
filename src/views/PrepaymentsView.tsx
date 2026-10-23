import { getCategoryIcon, getFontFamily } from '../lib/financeUtils';
import { useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import type { Account, Category, Project, Transaction } from '../types';
import { getRecordPersonalAmount, getRecordPrepayAmount } from '../lib/recordUtils';
import { EditRecordModal } from './EditRecordModal';

export function PrepaymentsView({ 
  records, 
  accounts, 
  projects, 
  categories, 
  onBack, 
  onUpdateRecord,
  onDeleteRecord,
  onDuplicateRecord
}: { 
  records: Transaction[], 
  accounts: Account[], 
  projects: Project[],
  categories: Category[], 
  onBack: () => void, 
  onUpdateRecord: (oldRecord: Transaction, newRecord: Transaction, ...args: any[]) => void,
  onDeleteRecord?: (record: Transaction) => void,
  onDuplicateRecord?: (record: Transaction) => void
}) {
  const [editingRecord, setEditingRecord] = useState<Transaction | null>(null);

  // Filter prepay transactions (排除已軟刪除與已被合併為子項目的紀錄，避免重複或殘留)
  const prepayRecords = useMemo(() => {
    return records
      .filter(r => !r.isDeleted && !r.isMergedChild && !r.parentId && !r.parentTransactionId && !r.isChildTransaction)
      .filter(r => r.isPrepay === true || getRecordPrepayAmount(r) > 0)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [records]);

  const totalReceivable = useMemo(() => {
    return records
      .filter(r => !r.isDeleted && !r.isMergedChild && !r.parentId && !r.parentTransactionId && !r.isChildTransaction)
      .filter(r => r.type === 'expense' && !r.isSettled)
      .reduce((sum, r) => sum + getRecordPrepayAmount(r), 0);
  }, [records]);

  const pendingCount = useMemo(() => {
    return records
      .filter(r => !r.isDeleted && !r.isMergedChild && !r.parentId && !r.parentTransactionId && !r.isChildTransaction)
      .filter(r => r.type === 'expense' && !r.isSettled && getRecordPrepayAmount(r) > 0).length;
  }, [records]);

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  // 統計所有出現過之卡別/帳戶的金額（還沒拿的錢 / 總共的錢）
  const accountStats = useMemo(() => {
    const accMap = new Map<string, { pending: number; total: number; count: number }>();
    let allPending = 0;
    let allTotal = 0;

    prepayRecords.forEach(r => {
      const isSettled = r.isSettled === true || r.type === 'income';
      const prepayAmt = getRecordPrepayAmount(r);
      const totalAmt = Math.abs(r.amount);
      const amt = r.type === 'expense' ? (prepayAmt > 0 ? prepayAmt : totalAmt) : totalAmt;
      const accId = r.accountId || 'unknown';

      const cur = accMap.get(accId) || { pending: 0, total: 0, count: 0 };
      cur.total += amt;
      cur.count += 1;
      if (!isSettled) {
        cur.pending += amt;
      }
      accMap.set(accId, cur);

      allTotal += amt;
      if (!isSettled) {
        allPending += amt;
      }
    });

    const list = Array.from(accMap.entries()).map(([id, stats]) => {
      const acc = (Array.isArray(accounts) ? accounts : []).find(a => a.id === id);
      return {
        id,
        name: acc?.name || (id === 'unknown' ? '未指定帳戶' : '未知帳戶'),
        icon: acc?.icon,
        ...stats
      };
    });

    return { list, allPending, allTotal };
  }, [prepayRecords, accounts]);

  // 依選定卡別篩選顯示明細
  const displayedPrepayRecords = useMemo(() => {
    if (!selectedAccountId) return prepayRecords;
    return prepayRecords.filter(r => (r.accountId || 'unknown') === selectedAccountId);
  }, [prepayRecords, selectedAccountId]);

  return (
    <div className="flex flex-col gap-4 px-4 py-6 min-h-full pb-24 overflow-y-auto w-full max-w-md mx-auto" style={getFontFamily()}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 flex-shrink-0">
        <button onClick={onBack} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
          <ChevronLeft className="w-6 h-6 text-[#5D4037]" />
        </button>
        <h3 className="text-xl font-black text-[#5D4037]" style={getFontFamily()}>代墊 / 待收款清單</h3>
      </div>

      {/* Summary Card */}
      <div className="bg-gradient-to-r from-sky-400 to-sky-600 rounded-[30px] p-6 text-white shadow-lg flex flex-col gap-2">
        <span className="text-xs font-bold opacity-80">
          {selectedAccountId ? `${accountStats.list.find(a => a.id === selectedAccountId)?.name || ''} 代墊待收` : '代墊待收總額'}
        </span>
        <span className="text-3xl font-black">
          NT$ {(selectedAccountId
            ? (accountStats.list.find(a => a.id === selectedAccountId)?.pending || 0)
            : totalReceivable
          ).toLocaleString()}
        </span>
        <div className="flex justify-between items-center mt-2 border-t border-white/20 pt-2 text-xs opacity-90">
          <span>待收筆數：</span>
          <span className="font-black">
            {selectedAccountId
              ? displayedPrepayRecords.filter(r => r.type === 'expense' && !r.isSettled).length
              : pendingCount} 筆
          </span>
        </div>
      </div>

      {/* 卡別切換按鈕列（顯示：還沒拿的錢 / 總共的錢） */}
      {accountStats.list.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 custom-scrollbar">
            {/* 全部卡別按鈕 */}
            <button
              onClick={() => setSelectedAccountId(null)}
              className={`flex-shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-black transition-all active:scale-95 shadow-xs ${
                selectedAccountId === null
                  ? 'bg-[#5D4037] text-white border-[#5D4037] shadow-sm'
                  : 'bg-white text-[#5D4037] border-stone-200 hover:bg-stone-50'
              }`}
            >
              <span>全部</span>
              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-lg ${
                selectedAccountId === null ? 'bg-white/20 text-white' : 'bg-sky-50 text-sky-700'
              }`}>
                ${accountStats.allPending.toLocaleString()} / ${accountStats.allTotal.toLocaleString()}
              </span>
            </button>

            {/* 各出現過的卡別按鈕 */}
            {accountStats.list.map(card => {
              const isSelected = selectedAccountId === card.id;
              return (
                <button
                  key={card.id}
                  onClick={() => setSelectedAccountId(isSelected ? null : card.id)}
                  className={`flex-shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-black transition-all active:scale-95 shadow-xs ${
                    isSelected
                      ? 'bg-[#5D4037] text-white border-[#5D4037] shadow-sm'
                      : 'bg-white text-[#5D4037] border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <span className="truncate max-w-[130px]">{card.name}</span>
                  <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-lg ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-sky-50 text-sky-700'
                  }`}>
                    ${card.pending.toLocaleString()} / ${card.total.toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Prepay List */}
      <div className="bg-white rounded-[30px] p-6 shadow-sm border-2 border-white flex flex-col gap-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-black text-sm text-[#5D4037] block">待收明細</span>
          {selectedAccountId && (
            <span className="text-[11px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-100">
              已篩選：{accountStats.list.find(a => a.id === selectedAccountId)?.name}
            </span>
          )}
        </div>
        {displayedPrepayRecords.length > 0 ? (
          <div className="space-y-4">
            {displayedPrepayRecords.map(r => {
              const accName = (Array.isArray(accounts) ? accounts : []).find(a => a.id === r.accountId)?.name || '未知帳戶';
              const isSettled = r.isSettled === true || r.type === 'income';
              const prepayAmt = getRecordPrepayAmount(r);
              const totalAmt = Math.abs(r.amount);
              const personalAmt = getRecordPersonalAmount(r);
              const displayAmt = r.type === 'expense' ? (prepayAmt > 0 ? prepayAmt : totalAmt) : totalAmt;
              // 拆分明細：只挑出標成「家裡代墊」的品項來顯示
              const prepayItems: { name: string; amount: number; category?: string }[] = r.type === 'expense'
                ? (((r.subItems && r.subItems.length > 0) ? r.subItems : (r.subTransactions || [])) as any[])
                    .filter((i: any) => !!i.isPrepay || (typeof i.tag === 'string' && i.tag.includes('家裡代墊')) || i.reimbursementTag === 'family')
                    .map((i: any) => ({ name: (i.name || i.note || '').trim(), amount: i.amount || 0, category: i.category }))
                : [];
              const title = prepayItems.length === 0
                ? (r.note || '未命名明細')
                : prepayItems.filter(i => i.amount > 0 && i.name).map(i => i.name)[0] || prepayItems[0].name || r.note || '未命名明細';
              const otherPositive = prepayItems.filter(i => i.amount > 0).length - 1;
              const displayTitle = prepayItems.length > 0 && otherPositive > 0 ? `${title} 等 ${otherPositive + 1} 項` : title;
              const displayCategory = prepayItems.find(i => i.amount > 0 && i.category)?.category || r.category;
              const hasMixedSubItems = ((r.subItems && r.subItems.length > 0) || (r.subTransactions && r.subTransactions.length > 0)) && prepayAmt > 0 && personalAmt > 0;

              return (
                <div 
                  key={r.id}
                  onClick={() => setEditingRecord(r)}
                  className={`flex items-center gap-4 py-3 border-b border-stone-50 last:border-0 cursor-pointer hover:bg-stone-50/50 rounded-xl px-2 -mx-2 transition-all duration-300 ${isSettled ? 'opacity-50 bg-stone-100/40' : ''}`}
                >
                  <div className={`w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center text-xl shadow-sm border border-white ${isSettled ? 'bg-stone-100 opacity-60' : 'bg-sky-50'}`}>
                    {getCategoryIcon(displayCategory, r.type, categories)}
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <span className={`font-black text-[#5D4037] truncate ${isSettled ? 'line-through text-stone-400' : ''}`}>{displayTitle}</span>
                    {prepayItems.length > 0 && (prepayItems.length > 1 || hasMixedSubItems) && (
                      <div className={`flex flex-col gap-0.5 text-[11px] font-bold ${isSettled ? 'text-stone-400' : 'text-stone-500'}`}>
                        {prepayItems.map((i, idx) => (
                          <div key={idx} className="flex justify-between gap-2">
                            <span className="truncate">・{i.name || '未命名品項'}</span>
                            <span className={`shrink-0 ${i.amount < 0 ? 'text-emerald-600' : ''}`}>{i.amount < 0 ? '-' : ''}${Math.abs(i.amount).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {hasMixedSubItems && (
                      <div className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-100 px-2 py-0.5 rounded-md w-fit">
                        整筆 ${totalAmt.toLocaleString()} / 含個人 ${personalAmt.toLocaleString()}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-[10px] text-stone-400 font-bold">
                      <span>{r.date}</span>
                      <span>•</span>
                      <span>{accName}</span>
                      <span>•</span>
                      <span>{displayCategory}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`font-black text-base ${isSettled ? 'line-through text-stone-400 font-bold' : (r.type === 'income' ? 'text-teal-600' : 'text-sky-600')}`}>
                      {r.type === 'income' ? '+' : ''}$ {displayAmt.toLocaleString()}
                    </span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (r.type === 'expense') {
                          onUpdateRecord(r, { ...r, isSettled: !r.isSettled });
                        }
                      }}
                      disabled={r.type === 'income'}
                      className={`text-[9px] px-2 py-0.5 rounded-full font-bold border transition-all active:scale-95 ${
                        isSettled 
                          ? 'bg-stone-100 text-stone-400 border-stone-200' 
                          : 'bg-sky-50 text-sky-600 border-sky-100 hover:bg-sky-100'
                      } ${r.type === 'income' ? 'cursor-default' : ''}`}
                    >
                      {r.type === 'income' ? '已沖銷' : (isSettled ? '已結清' : '待收')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10 text-stone-300 font-bold text-sm">
            目前無任何代墊待收款項 🎉
          </div>
        )}
      </div>

      <AnimatePresence>
        {editingRecord && (
          <EditRecordModal 
            record={editingRecord}
            records={records}
            accounts={accounts}
            projects={projects}
            categories={categories}
            onClose={() => setEditingRecord(null)}
            onSave={(updated, mergedIdsToDelete, restoredIds) => {
              onUpdateRecord(editingRecord, updated, mergedIdsToDelete, restoredIds);
              setEditingRecord(null);
            }}
            onDelete={() => {
              if (editingRecord) {
                onDeleteRecord?.(editingRecord);
              }
              setEditingRecord(null);
            }}
            onDuplicate={(rec) => {
              setEditingRecord(null);
              onDuplicateRecord?.(rec);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

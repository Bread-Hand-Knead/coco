import { getCategoryIcon, getFontFamily } from '../lib/financeUtils';
import { useMemo, useState } from 'react';
import { AlertCircle, ArrowRightLeft, Calendar as CalendarIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Account, Category, CurrencyMode, Project, Transaction } from '../types';
import { formatLocalDate, getTimestamp, parseLocalDate } from '../lib/dateUtils';
import { getMergedRecords, getTransactionTitle, getTransferCounterpartName, getTwdEquivalentText } from '../lib/recordUtils';
import { EditRecordModal } from './EditRecordModal';

export function HistoryView({ records, accounts, categories, projects, filter, currencyMode, onBack, onUpdateRecord, onDeleteRecord, onReorder, onDuplicateRecord }: { 
  records: Transaction[], 
  accounts: Account[], 
  categories: Category[],
  projects: Project[],
  filter: { type: 'day' | 'week' | 'month' | 'year', date: string },
  currencyMode: CurrencyMode,
  onBack: () => void,
  onUpdateRecord: (old: Transaction, updated: Transaction, ...args: any[]) => void,
  onDeleteRecord: (record: Transaction) => void,
  onReorder: (records: Transaction[]) => void,
  onDuplicateRecord?: (record: Transaction) => void
}) {
  const [editingRecord, setEditingRecord] = useState<Transaction | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income' | 'transfer'>('all');

  const filteredRecords = useMemo(() => {
    const base = parseLocalDate(filter.date);
    const start = new Date(base);
    const end = new Date(base);

    if (filter.type === 'day') {
      // Already set to base
    } else if (filter.type === 'week') {
      // Standardize to Monday-start to match HomeView stats
      const day = base.getDay();
      const diff = base.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      end.setDate(start.getDate() + 6);
    } else if (filter.type === 'month') {
      start.setDate(1);
      end.setMonth(base.getMonth() + 1, 0);
    } else if (filter.type === 'year') {
      start.setMonth(0, 1);
      end.setMonth(11, 31);
    }

    const startStr = formatLocalDate(start);
    const endStr = formatLocalDate(end);

    const raw = records.filter(r => {
      if (r.isMergedChild || r.parentId || r.parentTransactionId || r.isChildTransaction) return false;
      const pDate = r.postingDate || r.date;
      const passDate = r.category !== '初始資金' && pDate >= startStr && pDate <= endStr;
      if (!passDate) return false;

      // Currency filtering
      const cur = r.currency || 'TWD';
      if (currencyMode === 'FOREIGN') return cur !== 'TWD';
      // If mode is TWD or null (Taiwan), show only TWD
      return cur === 'TWD';
    });

    const merged = getMergedRecords(raw, accounts);

    return merged.sort((a, b) => {
      const tsA = getTimestamp(a.date, a.time);
      const tsB = getTimestamp(b.date, b.time);
      if (tsB !== tsA) return tsB - tsA;
      return b.amount - a.amount;
    });
  }, [records, filter, currencyMode, accounts]);

  const displayedRecords = useMemo(() => {
    if (typeFilter === 'expense') return filteredRecords.filter(r => r.type === 'expense');
    if (typeFilter === 'income') return filteredRecords.filter(r => r.type === 'income');
    if (typeFilter === 'transfer') return filteredRecords.filter(r => r.type === 'transfer');
    return filteredRecords;
  }, [filteredRecords, typeFilter]);

  const filterLabel = useMemo(() => {
    if (filter.type === 'day') return filter.date.replace(/-/g, '/');
    if (filter.type === 'week') return '本週明細';
    if (filter.type === 'month') return '本月明細';
    if (filter.type === 'year') return '本年明細';
    return '';
  }, [filter]);

  // 實質收支與移轉統計（隔離計算內部轉帳）
  const summaryStats = useMemo(() => {
    const totalExpense = filteredRecords
      .filter(r => r.type === 'expense')
      .reduce((sum, r) => sum + Math.abs(r.amount) + (r.fee || 0), 0);

    const totalIncome = filteredRecords
      .filter(r => r.type === 'income')
      .reduce((sum, r) => sum + Math.abs(r.amount), 0);

    const totalTransfer = filteredRecords
      .filter(r => r.type === 'transfer')
      .reduce((sum, r) => sum + Math.abs(r.amount), 0);

    const netBalance = totalIncome - totalExpense;

    return { totalExpense, totalIncome, totalTransfer, netBalance };
  }, [filteredRecords]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full bg-[#FFF9E3]"
    >
      <div className="flex-1 px-4 overflow-y-auto pb-10 pt-4">
        {/* Type Filter Segment Tabs (All / Expense / Income / Transfer) */}
        <div className="mx-2 mb-3 flex items-center justify-center gap-1.5 sm:gap-2" style={getFontFamily()}>
          <button
            type="button"
            onClick={() => setTypeFilter('all')}
            className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-black transition-all border ${
              typeFilter === 'all'
                ? 'bg-[#5D4037] border-[#5D4037] text-white shadow-sm'
                : 'bg-white/80 border-stone-200 text-stone-500 hover:bg-white'
            }`}
          >
            全部
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('expense')}
            className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-black transition-all border ${
              typeFilter === 'expense'
                ? 'bg-rose-500 border-rose-500 text-white shadow-sm'
                : 'bg-white/80 border-stone-200 text-stone-500 hover:bg-white'
            }`}
          >
            支出
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('income')}
            className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-black transition-all border ${
              typeFilter === 'income'
                ? 'bg-blue-500 border-blue-500 text-white shadow-sm'
                : 'bg-white/80 border-stone-200 text-stone-500 hover:bg-white'
            }`}
          >
            收入
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('transfer')}
            className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-black transition-all border ${
              typeFilter === 'transfer'
                ? 'bg-amber-600 border-amber-600 text-white shadow-sm'
                : 'bg-white/80 border-stone-200 text-stone-500 hover:bg-white'
            }`}
          >
            轉帳
          </button>
        </div>

        {/* Period Summary Header */}
        <div className="mx-2 mb-4 p-4 bg-[#FFFDF5] rounded-3xl border border-[#FFD54F]/30 flex items-center justify-between text-[13px] font-black text-[#5D4037] shadow-sm" style={getFontFamily()}>
          <div className="flex items-center gap-2">
            <CalendarIcon size={14} className="text-[#FFD54F]" />
            <span>{filterLabel}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="bg-white/50 px-2 py-0.5 rounded-lg border border-[#FFD54F]/10">
              {displayedRecords.length} {typeFilter === 'transfer' ? '筆轉帳' : '筆紀錄'}
            </span>
            {typeFilter === 'all' && (
              <span>
                結餘：<span className={summaryStats.netBalance >= 0 ? 'text-blue-600' : 'text-red-500'}>
                  {summaryStats.netBalance < 0 ? '-' : ''}${Math.abs(summaryStats.netBalance).toLocaleString()}
                </span>
              </span>
            )}
            {typeFilter === 'expense' && (
              <span>
                實質總支出：<span className="text-rose-600 font-black">
                  ${summaryStats.totalExpense.toLocaleString()}
                </span>
              </span>
            )}
            {typeFilter === 'income' && (
              <span>
                實質總收入：<span className="text-blue-600 font-black">
                  ${summaryStats.totalIncome.toLocaleString()}
                </span>
              </span>
            )}
            {typeFilter === 'transfer' && (
              <span>
                資金移轉總額：<span className="text-amber-800 font-black">
                  ${summaryStats.totalTransfer.toLocaleString()}
                </span>
              </span>
            )}
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-[40px] shadow-sm border-2 border-white p-6 space-y-4">
          {displayedRecords.length > 0 ? displayedRecords.map((record, idx) => (
            <div 
              key={record.id} 
              className="flex items-center gap-2 py-4 border-b border-stone-50 last:border-0 group rounded-xl px-2 -mx-2 transition-colors relative"
            >
              <div 
                onClick={() => setEditingRecord(record)}
                className="flex-1 flex items-center gap-4 cursor-pointer"
              >
                <div className="w-14 h-14 bg-[#FFFDF5] rounded-2xl flex-shrink-0 flex items-center justify-center text-2xl shadow-sm border border-white">
                  {record.type === 'transfer' ? (
                    <ArrowRightLeft size={24} className="text-stone-400" />
                  ) : (
                    getCategoryIcon(record.category, record.type, categories)
                  )}
                </div>
                
                <div className="flex-1 flex flex-col gap-1 min-w-0">
                <span className="font-black text-lg text-[#5D4037] whitespace-pre-wrap break-all leading-tight" style={getFontFamily()}>
                  {getTransactionTitle(record)}
                </span>
                {record.type === 'transfer' ? (
                  (() => {
                    const isPos = record.amount > 0;
                    const currentAccName = (Array.isArray(accounts) ? accounts : []).find(a => a.id === record.accountId)?.name || '未知帳戶';
                    const counterpartAccName = getTransferCounterpartName(record, accounts);
                    const firstAccName = isPos ? counterpartAccName : currentAccName;
                    const secondAccName = isPos ? currentAccName : counterpartAccName;
                    const displayDate = record.postingDate || record.date;
                    return (
                      <div className="flex flex-col gap-0.5">
                        {/* Line 2: Account A ➔ Account B */}
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#5D4037]" style={getFontFamily()}>
                          <span className="opacity-80" style={getFontFamily()}>{firstAccName}</span>
                          <span className="text-amber-600 font-bold" style={getFontFamily()}>➔</span>
                          <span className="opacity-80 font-black text-amber-800" style={getFontFamily()}>{secondAccName}</span>
                          {record.transferredDate && (
                            <span className="text-[10px] px-1 py-0.5 bg-emerald-100 text-emerald-600 rounded font-bold ml-1">已轉帳</span>
                          )}
                        </div>
                        {/* Line 3: Date as subtext YYYY-MM-DD */}
                        <span className="text-[11px] font-medium text-stone-400" style={getFontFamily()}>
                          入帳日期: {displayDate}
                        </span>
                      </div>
                    );
                  })()
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-500">
                      {record.postingDate ? `入帳: ${record.postingDate}` : `消費: ${record.date}`}
                    </span>
                  {(() => {
                    const acc = (Array.isArray(accounts) ? accounts : []).find(a => a.id === record.accountId);
                    return acc?.type === 'credit' && (!record.postingDate || record.isPending);
                  })() && (
                    <span className="text-[10px] px-2 py-0.5 bg-orange-100 text-orange-500 rounded-full font-bold">
                      未入帳
                    </span>
                  )}
                  {record.transferredDate && (
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded-full font-bold">
                      已轉帳
                    </span>
                  )}
                  <span className="text-[10px] px-2 py-0.5 bg-stone-100 text-stone-400 rounded-full font-bold" style={getFontFamily()}>
                    {(Array.isArray(accounts) ? accounts : []).find(a => a.id === record.accountId)?.name}
                  </span>
                </div>
                )}
                <div className="flex items-baseline justify-between mt-1 flex-wrap">
                  <span className={`font-black text-xl ${
                    record.type === 'transfer' ? 'text-[#5D4037]' :
                    record.type === 'income' ? 'text-[#03A9F4]' :
                    record.type === 'expense' ? 'text-[#E91E63]' : 'text-stone-400'
                  }`} style={getFontFamily()}>
                    {record.type === 'transfer' ? '' : (record.type === 'income' ? '+' : '-')} $ {Math.abs(record.amount).toLocaleString()}
                  </span>
                  {(() => {
                    const twdText = getTwdEquivalentText(records, accounts, record);
                    return twdText ? (
                      <span className="text-[11px] text-stone-400 font-bold" style={getFontFamily()}>{twdText}</span>
                    ) : null;
                  })()}
                </div>
              </div>
            </div>
          </div>
          )) : (
            <div className="flex flex-col items-center justify-center py-20 text-stone-300 gap-4">
              <AlertCircle size={48} />
              <span className="font-bold">
                {typeFilter === 'expense' ? '此期間無支出紀錄' :
                 typeFilter === 'income' ? '此期間無收入紀錄' :
                 typeFilter === 'transfer' ? '此期間無轉帳紀錄' : '此期間無紀錄'}
              </span>
            </div>
          )}
        </div>
        <div className="h-[40px]" />
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
              onDeleteRecord(editingRecord);
              setEditingRecord(null);
            }}
            onDuplicate={(rec) => {
              setEditingRecord(null);
              onDuplicateRecord?.(rec);
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

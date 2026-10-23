import { getCategoryIcon, getFontFamily } from '../lib/financeUtils';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRightLeft, Smile, Wallet } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { formatLocalDate, formatTimeDisplay, getTimestamp, parseLocalDate } from '../lib/dateUtils';
import { HorizontalScrollArea, StatCard } from '../components/Common';
import { getTransactionTitle } from '../lib/recordUtils';
import { EditRecordModal } from './EditRecordModal';
import type { Account, Category, Project, Transaction } from '../types';

/** 從紀錄 id 推出「記下這筆的時間」：單筆是 Date.now()、批次是 rec_<時間>_…、分期是 <時間>-<期數> */
const createdAtOf = (r: Transaction): number => {
  const m = /^(\d{13})(?:-\d+)?$/.exec(r.id) || /^rec_(\d{13})_/.exec(r.id);
  if (m) return Number(m[1]);
  return getTimestamp(r.date, r.time); // 自動產生的紀錄（固定收支等）沒有記帳時間，用消費日期
};

/** 最近記的一筆：不含已刪除、帳戶初始餘額 */
const findLatestRecord = (records: Transaction[]): Transaction | null => {
  let best: Transaction | null = null;
  let bestTs = -Infinity;
  for (const r of Array.isArray(records) ? records : []) {
    if (!r || r.isDeleted || String(r.id).startsWith('init_')) continue;
    const ts = createdAtOf(r);
    // 同一次記的多筆（分期、批次）時間一樣，顯示日期最早的那筆（例如分期第 1 期）
    if (ts > bestTs || (ts === bestTs && best && r.date < best.date)) { best = r; bestTs = ts; }
  }
  return best;
};

// --- Views ---

export function HomeView({ stats, selectedDate, onDateChange, onRecordClick, onAccountClick, onStatClick, monthlyBudget, records, accounts, categories, projects, onUpdateRecord, onDeleteRecord, onDuplicateRecord }: { 
  records: Transaction[],
  accounts: Account[],
  categories: Category[],
  projects: Project[],
  onUpdateRecord: (oldRecord: Transaction, newRecord: Transaction, mergedIdsToDelete?: string[], restoredIds?: string[]) => void,
  onDeleteRecord: (record: Transaction) => void,
  onDuplicateRecord?: (record: Transaction) => void,
  stats: any, 
  selectedDate: string,
  onDateChange: (date: string) => void,
  onRecordClick: () => void, 
  onAccountClick: () => void,
  onStatClick: (type: 'day' | 'week' | 'month' | 'year') => void,
  monthlyBudget: number
}) {
  const selectedRef = useRef<HTMLButtonElement>(null);
  const latest = useMemo(() => findLatestRecord(records), [records]);
  const [editingRecord, setEditingRecord] = useState<Transaction | null>(null);

  const dates = useMemo(() => {
    const arr = [];
    const base = parseLocalDate(selectedDate);
    // Generate a wider range to ensure smooth scrolling
    for (let i = -15; i <= 15; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      arr.push(formatLocalDate(d));
    }
    return arr;
  }, [selectedDate]);

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [selectedDate]);

  const handlePrevDay = () => {
    const d = parseLocalDate(selectedDate);
    d.setDate(d.getDate() - 1);
    onDateChange(formatLocalDate(d));
  };

  const handleNextDay = () => {
    const d = parseLocalDate(selectedDate);
    d.setDate(d.getDate() + 1);
    onDateChange(formatLocalDate(d));
  };
  
  const weekRange = useMemo(() => {
    const base = parseLocalDate(selectedDate);
    const day = base.getDay();
    const diff = base.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    const start = new Date(base);
    start.setDate(diff);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${formatLocalDate(start).replace(/-/g, '/')} - ${formatLocalDate(end).replace(/-/g, '/')}`;
  }, [selectedDate]);

  const monthRange = useMemo(() => {
    const base = parseLocalDate(selectedDate);
    const start = new Date(base.getFullYear(), base.getMonth(), 1);
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    return `${formatLocalDate(start).replace(/-/g, '/')} - ${formatLocalDate(end).replace(/-/g, '/')}`;
  }, [selectedDate]);

  const yearRange = useMemo(() => {
    const base = parseLocalDate(selectedDate);
    return `${base.getFullYear()}/01/01 - ${base.getFullYear()}/12/31`;
  }, [selectedDate]);
  
  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex flex-col gap-6 px-4 py-4"
      style={getFontFamily()}
    >
      <div className="relative py-2">
        <HorizontalScrollArea 
          onLeftClick={handlePrevDay}
          onRightClick={handleNextDay}
          className="px-8"
        >
          {dates.map(dateStr => {
            const d = dateStr.split('-')[2];
            const isSelected = dateStr === selectedDate;
            const dateObj = parseLocalDate(dateStr);
            return (
              <button 
                key={dateStr} 
                ref={isSelected ? selectedRef : null}
                onClick={() => onDateChange(dateStr)}
                className={`flex-shrink-0 w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-bold transition-all ${isSelected ? 'bg-[#FFD54F] text-[#5D4037] shadow-lg scale-110' : 'bg-white text-stone-300 hover:bg-stone-50'}`}
              >
                <span className="text-xs opacity-60 uppercase">{dateObj.toLocaleDateString('zh-TW', { weekday: 'short' })}</span>
                <span className="text-sm">{parseInt(d)}</span>
              </button>
            );
          })}
        </HorizontalScrollArea>
      </div>

      <div className="flex gap-4">
        <button 
          onClick={onRecordClick}
          className="flex-1 h-16 bg-[#FFD54F] rounded-full flex items-center justify-center gap-2 shadow-sm border-2 border-white"
        >
          <Smile className="w-6 h-6" />
          <span className="font-bold text-lg">記一筆</span>
        </button>
        <button 
          onClick={onAccountClick}
          className="flex-1 h-16 bg-[#FFFDF5] rounded-full flex items-center justify-center gap-2 shadow-sm border-2 border-white"
        >
          <Wallet className="w-6 h-6" />
          <span className="font-bold text-lg">帳戶</span>
        </button>
      </div>

      <div 
        className="bg-white rounded-[30px] p-6 shadow-sm border-2 border-white grid grid-cols-3 text-center items-center"
        style={getFontFamily()}
      >
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-[#5D4037]">本月收入</span>
          <span className="text-lg font-black text-[#03A9F4]">$ {stats.monthly.income.toLocaleString()}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-[#5D4037]">本月支出</span>
          <span className="text-lg font-black text-[#E91E63]">$ {stats.monthly.expense.toLocaleString()}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-[#5D4037]">可用預算</span>
          <span className="text-[24px] font-bold text-[#5D4037]">
            {(stats.monthly.income - stats.monthly.expense).toLocaleString()}
          </span>
        </div>
      </div>

      {latest && (() => {
        const acc = (Array.isArray(accounts) ? accounts : []).find(a => a.id === latest.accountId);
        const toAcc = latest.toAccountId ? (Array.isArray(accounts) ? accounts : []).find(a => a.id === latest.toAccountId) : undefined;
        const amt = Math.abs(latest.amount || 0);
        const isTransfer = latest.type === 'transfer';
        const isIncome = !isTransfer && latest.type === 'income';
        const timeText = latest.time ? ` ${formatTimeDisplay(latest.time)}` : '';
        return (
          <button
            type="button"
            onClick={() => setEditingRecord(latest)}
            className="w-full bg-white rounded-[24px] border-2 border-white shadow-sm p-4 text-left active:scale-[0.98] transition-transform"
            style={getFontFamily()}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-black text-[#5D4037]">📝 最近記的一筆</span>
              <span className="text-xs font-bold text-stone-500">點一下可以修改 ›</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#FFFDF5] rounded-2xl flex-shrink-0 flex items-center justify-center text-2xl border border-stone-100">
                {isTransfer ? <ArrowRightLeft size={22} className="text-stone-500" /> : getCategoryIcon(latest.category, latest.type, categories)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-black text-base text-[#5D4037] truncate">{getTransactionTitle(latest)}</div>
                <div className="text-xs font-bold text-stone-500 truncate">
                  {latest.date.replace(/-/g, '/')}{timeText}・{acc?.name || '未知帳戶'}{isTransfer && toAcc ? ` ➔ ${toAcc.name}` : ''}
                </div>
              </div>
              <div className={`shrink-0 font-black text-lg ${isTransfer ? 'text-stone-600' : isIncome ? 'text-[#03A9F4]' : 'text-[#E91E63]'}`}>
                {isTransfer ? '' : isIncome ? '+' : '-'}${amt.toLocaleString()}
              </div>
            </div>
          </button>
        );
      })()}

      <div className="flex flex-col gap-3">
        <StatCard title="本日" date={selectedDate.replace(/-/g, '/')} expense={stats.daily.expense} income={stats.daily.income} onClick={() => onStatClick('day')} />
        <StatCard title="本週" date={weekRange} expense={stats.weekly.expense} income={stats.weekly.income} onClick={() => onStatClick('week')} />
        <StatCard title="本月" date={monthRange} expense={stats.monthly.expense} income={stats.monthly.income} onClick={() => onStatClick('month')} />
        <StatCard title="本年" date={yearRange} expense={stats.yearly.expense} income={stats.yearly.income} onClick={() => onStatClick('year')} />
      </div>

      {/* Bottom Buffer */}
      <div className="h-[120px] w-full" />

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

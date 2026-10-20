import { getCategoryIcon, getFontFamily } from '../lib/financeUtils';
import { useMemo, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Account, Category, Transaction } from '../types';
import { getMergedRecords, getTransactionTitle, getTransferCounterpartName, getTwdEquivalentText } from '../lib/recordUtils';

export function CalendarView({ records, accounts, categories, onBack }: { records: Transaction[], accounts: Account[], categories: Category[], onBack: () => void }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewDate, setViewDate] = useState(new Date()); // Current month being viewed
  
  const filteredRecords = useMemo(() => records, [records]);
  const dayRecords = useMemo(() => {
    const raw = records.filter(r => r.date === selectedDate);
    return getMergedRecords(raw, accounts);
  }, [records, selectedDate, accounts]);
  
  const dayStats = useMemo(() => {
    return {
      income: dayRecords.filter(r => r.type === 'income' && !r.isPrepay).reduce((s, r) => s + Math.abs(r.amount), 0),
      expense: dayRecords.filter(r => r.type === 'expense' && !r.isPrepay).reduce((s, r) => s + (Math.abs(r.amount) + (r.fee || 0)), 0)
    };
  }, [dayRecords]);

  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    // Padding for previous month
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    // Days of current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  }, [viewDate]);

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="flex flex-col bg-white min-h-full"
      style={getFontFamily()}
    >
      <div className="p-4 bg-[#FFF9E3]">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-6 px-4">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-white/50 rounded-full transition-colors">
            <ChevronLeft className="w-5 h-5 text-[#5D4037]" />
          </button>
          <span className="font-black text-lg text-[#5D4037]">
            {viewDate.getFullYear()} / {String(viewDate.getMonth() + 1).padStart(2, '0')}
          </span>
          <button onClick={handleNextMonth} className="p-2 hover:bg-white/50 rounded-full transition-colors">
            <ChevronRight className="w-5 h-5 text-[#5D4037]" />
          </button>
        </div>

        <div className="grid grid-cols-7 text-center mb-2">
          {['日', '一', '二', '三', '四', '五', '六'].map((d, i) => (
            <span key={d} className={`text-xs font-bold ${i === 0 || i === 6 ? 'text-orange-400' : 'text-stone-400'}`}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 text-center gap-y-4">
          {calendarDays.map((d, i) => {
            if (d === null) return <div key={`empty-${i}`} className="h-10" />;
            
            const dateStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const hasRecords = filteredRecords.some(r => r.date === dateStr);
            const isSelected = selectedDate === dateStr;

            return (
              <div key={i} className="flex flex-col items-center justify-center h-10 relative cursor-pointer" onClick={() => setSelectedDate(dateStr)}>
                <span className={`text-sm font-bold ${isSelected ? 'text-white z-10' : (i % 7 === 0 || i % 7 === 6 ? 'text-orange-400' : 'text-[#5D4037]')}`}>
                  {d}
                </span>
                {isSelected && (
                  <div className="absolute inset-0 m-auto w-8 h-8 bg-[#5D4037] rounded-full -z-0" />
                )}
                {hasRecords && !isSelected && (
                  <div className="absolute bottom-1 w-1 h-1 bg-[#FFD54F] rounded-full" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 收入、支出、結餘 統計摘要列 (字體與數字加大，提升閱讀舒適度) */}
      <div className="flex justify-around items-center py-3.5 px-4 border-b border-stone-100 bg-white" style={getFontFamily()}>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-xs font-black text-stone-400">收入</span>
          <span className="text-base font-black text-blue-500">
            +{dayStats.income.toLocaleString()}
          </span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-xs font-black text-stone-400">支出</span>
          <span className="text-base font-black text-rose-500">
            -{dayStats.expense.toLocaleString()}
          </span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-xs font-black text-stone-400">結餘</span>
          <span className={`text-base font-black ${(dayStats.income - dayStats.expense) >= 0 ? 'text-[#5D4037]' : 'text-rose-500'}`}>
            {(dayStats.income - dayStats.expense).toLocaleString()}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4 flex-1 overflow-y-auto">
        <div className="flex justify-between items-center px-2">
          <span className="font-black text-[#5D4037]">{selectedDate.replace(/-/g, '/')} 明細</span>
          <span className="text-[11px] font-bold text-stone-500 bg-white px-3 py-1 rounded-full border border-stone-100">
            共 {dayRecords.length} 筆
          </span>
        </div>
        
        {dayRecords.length > 0 ? dayRecords.map(record => (
          <div 
            key={record.id} 
            className="flex items-center gap-4 py-4 border-b border-stone-50 last:border-0 group cursor-pointer hover:bg-stone-50/50 rounded-xl px-2 -mx-2 transition-colors"
          >
            <div className="w-14 h-14 bg-[#FFFDF5] rounded-2xl flex-shrink-0 flex items-center justify-center text-2xl shadow-sm border border-white">
              {getCategoryIcon(record.category, record.type, categories)}
            </div>
            
            <div className="flex-1 flex flex-col gap-1 min-w-0">
              {/* Line 1: Title */}
              <span className="font-black text-lg text-[#5D4037] whitespace-pre-wrap break-all leading-tight" style={getFontFamily()}>
                {getTransactionTitle(record)}
              </span>
              
              {/* Line 2 & 3: Account Info / Transfer Path */}
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
                  <span className="text-[10px] px-2 py-0.5 bg-stone-100 text-stone-400 rounded-full font-bold">
                    {(Array.isArray(accounts) ? accounts : []).find(a => a.id === record.accountId)?.name}
                  </span>
                  {record.isPrepay && (
                    <span className="text-[10px] px-2 py-0.5 bg-sky-100 text-sky-600 rounded-full font-bold">
                      代墊
                    </span>
                  )}
                </div>
              )}
              
                <div className="flex items-baseline justify-between mt-1 flex-wrap">
                  <span className={`font-black text-xl ${
                    (record.type === 'transfer' || record._isMergedTransfer) ? (record.amount < 0 ? 'text-[#E91E63]' : 'text-[#03A9F4]') :
                    record.type === 'income' ? 'text-[#03A9F4]' :
                    record.type === 'expense' ? 'text-[#E91E63]' : 'text-stone-400'
                  }`} style={getFontFamily()}>
                    {((record.type === 'transfer' || record._isMergedTransfer) ? (record.amount < 0 ? '-' : '+') : record.type === 'income' ? '+' : record.type === 'expense' ? '-' : '')} $ {Math.abs(record.amount).toLocaleString()}
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
        )) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 text-stone-200 py-10">
            <div className="w-24 h-24 bg-[#FFFDF5] rounded-full flex items-center justify-center border-4 border-white shadow-inner">
              <AlertCircle size={48} />
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="font-black text-lg text-stone-300">當日無紀錄</span>
            </div>
          </div>
        )}
        
        {/* Bottom Buffer */}
        <div className="h-[40px] w-full" />
      </div>
    </motion.div>
  );
}

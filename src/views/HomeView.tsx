import { getFontFamily } from '../lib/financeUtils';
import { useEffect, useMemo, useRef } from 'react';
import { Smile, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatLocalDate, parseLocalDate } from '../lib/dateUtils';
import { HorizontalScrollArea, StatCard } from '../components/Common';

// --- Views ---

export function HomeView({ stats, selectedDate, onDateChange, onRecordClick, onAccountClick, onStatClick, monthlyBudget }: { 
  stats: any, 
  selectedDate: string,
  onDateChange: (date: string) => void,
  onRecordClick: () => void, 
  onAccountClick: () => void,
  onStatClick: (type: 'day' | 'week' | 'month' | 'year') => void,
  monthlyBudget: number
}) {
  const selectedRef = useRef<HTMLButtonElement>(null);

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

      <div className="flex flex-col gap-3">
        <StatCard title="本日" date={selectedDate.replace(/-/g, '/')} expense={stats.daily.expense} income={stats.daily.income} onClick={() => onStatClick('day')} />
        <StatCard title="本週" date={weekRange} expense={stats.weekly.expense} income={stats.weekly.income} onClick={() => onStatClick('week')} />
        <StatCard title="本月" date={monthRange} expense={stats.monthly.expense} income={stats.monthly.income} onClick={() => onStatClick('month')} />
        <StatCard title="本年" date={yearRange} expense={stats.yearly.expense} income={stats.yearly.income} onClick={() => onStatClick('year')} />
      </div>

      {/* Bottom Buffer */}
      <div className="h-[120px] w-full" />
    </motion.div>
  );
}

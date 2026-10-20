import { getFontFamily } from '../lib/financeUtils';
import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export function NavButton({ active, icon, label, onClick }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-[#5D4037]' : 'text-stone-300'}`}>
      {React.cloneElement(icon as React.ReactElement, { size: 24, strokeWidth: active ? 2.5 : 2 })}
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}

export function StatCard({ title, date, expense, income, onClick }: { title: string, date: string, expense: number, income: number, onClick?: () => void }) {
  return (
    <motion.div 
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="bg-white rounded-[20px] p-4 shadow-sm border-2 border-white flex justify-between items-center cursor-pointer hover:bg-stone-50 transition-colors"
      style={getFontFamily()}
    >
      <div className="flex flex-col">
        <span className="text-[20px] font-bold text-[#5D4037]">{title}</span>
        <span className="text-[11px] font-bold text-stone-500">{date}</span>
      </div>
      <div className="flex flex-col items-end">
        <span className="text-[20px] font-bold text-[#E91E63]">- {expense.toLocaleString()}</span>
        <span className="text-[20px] font-bold text-[#03A9F4]">+ {income.toLocaleString()}</span>
      </div>
    </motion.div>
  );
}

export function DrawerItem({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="w-full px-6 py-4 flex items-center gap-4 hover:bg-stone-50 transition-colors text-[#5D4037] group"
      style={getFontFamily()}
    >
      <div className="text-stone-300 group-hover:text-[#FFD54F] transition-colors">{icon}</div>
      <span className="font-bold text-sm">{label}</span>
    </button>
  );
}

export function YearMonthPickerModal({ 
  initialYear, 
  initialMonth, 
  onClose, 
  onSelect 
}: { 
  initialYear: number, 
  initialMonth: number, 
  onClose: () => void, 
  onSelect: (year: number, month: number) => void 
}) {
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#5D4037]/60 backdrop-blur-md z-[90] flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="bg-[#FFFDF5] w-full max-w-xs rounded-[44px] flex flex-col shadow-2xl border-4 border-white overflow-hidden p-6 gap-6"
        style={getFontFamily()}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0 px-2">
          <h3 className="text-xl font-black text-[#5D4037]">選擇年月</h3>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-[#5D4037]" />
          </button>
        </div>

        {/* Year Selector */}
        <div className="flex items-center justify-between bg-white/60 p-2 rounded-2xl border border-stone-100 shadow-inner">
          <button 
            onClick={() => setSelectedYear(prev => prev - 1)}
            className="w-10 h-10 flex items-center justify-center text-[#5D4037] hover:bg-stone-50 rounded-xl transition-colors active:scale-90"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-lg font-black text-[#5D4037] tracking-wider">{selectedYear} 年</span>
          <button 
            onClick={() => setSelectedYear(prev => prev + 1)}
            className="w-10 h-10 flex items-center justify-center text-[#5D4037] hover:bg-stone-50 rounded-xl transition-colors active:scale-90"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Month Selector Grid */}
        <div className="grid grid-cols-3 gap-3">
          {months.map(m => {
            const isSelected = selectedYear === initialYear && m === initialMonth;
            return (
              <button
                key={m}
                onClick={() => {
                  onSelect(selectedYear, m);
                  onClose();
                }}
                className={`py-3.5 rounded-2xl text-sm font-black transition-all active:scale-90 border-2 ${
                  isSelected 
                    ? 'bg-[#FFD54F] text-[#5D4037] border-[#FFD54F] shadow-md' 
                    : 'bg-white text-stone-500 border-stone-50 hover:bg-stone-50 shadow-sm'
                }`}
              >
                {m} 月
              </button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

export const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const categoryColor = payload[0].color || '#FFD54F';
    return (
      <div 
        className="bg-[#5D4037] text-[#FFFDF5] p-2.5 rounded-2xl shadow-xl flex items-center gap-2 pointer-events-none border border-white/20 z-[50]"
        style={{
          boxShadow: '0 10px 25px -5px rgba(93, 64, 55, 0.4)',
          ...getFontFamily()
        }}
      >
        <div 
          className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
          style={{ backgroundColor: categoryColor }}
        />
        <div 
          className="flex items-center gap-1.5 text-xs font-black text-white"
        >
          <span>{data.name}</span>
          <span className="text-stone-300 font-normal">:</span>
          <span className="text-sm font-black text-[#FFD54F]">${data.value.toLocaleString()}</span>
        </div>
      </div>
    );
  }
  return null;
};

// --- Components ---

export function HorizontalScrollArea({ 
  children, 
  className = "", 
  onLeftClick, 
  onRightClick 
}: { 
  children: React.ReactNode, 
  className?: string,
  onLeftClick?: () => void,
  onRightClick?: () => void
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(true); // Always show for custom nav if requested
  const [showRight, setShowRight] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current && !onLeftClick) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeft(scrollLeft > 10);
      setShowRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      return () => {
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [children]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { clientWidth } = scrollRef.current;
      const scrollAmount = clientWidth * 0.8;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className={`relative group/scroll ${className}`}>
      <AnimatePresence>
        {(showLeft || onLeftClick) && (
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            onClick={(e) => { e.stopPropagation(); onLeftClick ? onLeftClick() : scroll('left'); }}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white/95 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center text-[#5D4037] border border-stone-100 active:scale-90 transition-all hover:bg-[#FFD54F] hover:text-white"
          >
            <ChevronLeft size={20} />
          </motion.button>
        )}
      </AnimatePresence>
      
      <div 
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto py-1 scroll-smooth"
      >
        {children}
      </div>

      <AnimatePresence>
        {(showRight || onRightClick) && (
              <motion.button
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            onClick={(e) => { e.stopPropagation(); onRightClick ? onRightClick() : scroll('right'); }}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white/95 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center text-[#5D4037] border border-stone-100 active:scale-90 transition-all hover:bg-[#FFD54F] hover:text-white"
          >
            <ChevronRight size={20} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

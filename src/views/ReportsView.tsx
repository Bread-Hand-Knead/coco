import { getFontFamily } from '../lib/financeUtils';
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Cell, Pie, PieChart as RePieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { endOfMonth, parseISO, startOfMonth, subMonths } from 'date-fns';
import type { Account, Category, Project, Transaction } from '../types';
import { parseCategoryHierarchy } from '../lib/defaults';
import { CustomTooltip } from '../components/Common';
import { AccountIcon } from '../components/AccountWidgets';
import { EditRecordModal } from './EditRecordModal';

export function CategoryDetailModal({
  categoryName,
  initialSubFilter = 'all',
  reportType = 'expense',
  dateInterval,
  records,
  categories,
  accounts = [],
  totalPeriodExpense,
  onClose,
  onSelectRecord
}: {
  categoryName: string,
  initialSubFilter?: string,
  reportType?: 'expense' | 'income',
  dateInterval: { start: Date, end: Date },
  records: Transaction[],
  categories: Category[],
  accounts?: Account[],
  totalPeriodExpense: number,
  onClose: () => void,
  onSelectRecord: (r: Transaction) => void
}) {
  const [subFilter, setSubFilter] = useState<string>(initialSubFilter);

  const catObj = useMemo(() => (Array.isArray(categories) ? categories : []).find(c => c.name === categoryName), [categories, categoryName]);
  const isParentCat = useMemo(() => !!catObj && Array.isArray(catObj.sub) && catObj.sub.length > 0, [catObj]);

  // Valid period records matching category/subcategory rules
  const matchingRecords = useMemo(() => {
    return records.filter(r => {
      if (r.isMergedChild || r.parentId || r.parentTransactionId || (r as any).isChildTransaction) return false;
      if (r.category === '初始資金' || r.category === '餘額校正' || r.isPrepay) return false;
      if (r.type !== reportType) return false;

      const d = parseISO(r.postingDate || r.date);
      if (d < dateInterval.start || d > dateInterval.end) return false;

      if (!r.category) return false;
      const { parentName, subName } = parseCategoryHierarchy(r.category, categories);

      if (isParentCat || categoryName === '其他') {
        return parentName === categoryName || r.category.includes(categoryName);
      } else {
        return parentName === categoryName || subName === categoryName || r.category.includes(categoryName);
      }
    });
  }, [records, dateInterval, categoryName, isParentCat, categories, reportType]);

  // Subcategories present in actual records
  const presentSubCategories = useMemo(() => {
    if (!isParentCat) return [];
    const subsSet = new Set<string>();
    matchingRecords.forEach(r => {
      const cleanCat = (r.category || '').trim();
      const parts = cleanCat.split(/\s*(?:＞|>)\s*/).map(p => p.trim());
      if (parts.length > 1 && parts[1]) {
        subsSet.add(parts[1]);
      } else if (parts[0] !== categoryName) {
        subsSet.add(parts[0]);
      } else {
        subsSet.add('主要 / 直屬');
      }
    });
    return Array.from(subsSet);
  }, [isParentCat, matchingRecords, categoryName]);

  // Filter records based on active subFilter tab inside modal
  const filteredRecords = useMemo(() => {
    if (subFilter === 'all') return matchingRecords;
    return matchingRecords.filter(r => {
      const cleanCat = (r.category || '').trim();
      const parts = cleanCat.split(/\s*(?:＞|>)\s*/).map(p => p.trim());
      if (subFilter === '主要 / 直屬') {
        return parts[0] === categoryName && parts.length === 1;
      }
      return parts.includes(subFilter) || cleanCat === subFilter;
    });
  }, [matchingRecords, subFilter, categoryName]);

  const catTotal = useMemo(() => {
    return matchingRecords.reduce((sum, r) => sum + (Math.abs(r.amount) + (r.fee || 0)), 0);
  }, [matchingRecords]);

  const percentage = useMemo(() => {
    if (totalPeriodExpense <= 0) return '0.0';
    return ((catTotal / totalPeriodExpense) * 100).toFixed(1);
  }, [catTotal, totalPeriodExpense]);

  // Sorted records (newest to oldest)
  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      const dateA = a.date + (a.time || '');
      const dateB = b.date + (b.time || '');
      return dateB.localeCompare(dateA);
    });
  }, [filteredRecords]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-6"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onClose();
      }}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 250 }}
        className="bg-[#FFFDF5] w-full max-w-4xl rounded-t-[32px] md:rounded-[36px] p-6 flex flex-col gap-4 max-h-[90vh] md:max-h-[85vh] overflow-hidden shadow-2xl border border-stone-100"
        onClick={e => {
          e.stopPropagation();
        }}
        style={getFontFamily()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200/60 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#FFD54F]/20 border border-[#FFD54F]/40 flex items-center justify-center text-xl shrink-0">
              <AccountIcon icon={catObj?.icon || '📁'} sizeClassName="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg md:text-xl font-black text-[#5D4037]">{categoryName}</h3>
                <span className="text-xs font-black bg-[#FFD54F] text-[#5D4037] px-2.5 py-0.5 rounded-full shadow-2xs">
                  {percentage}% 佔比
                </span>
              </div>
              <p className="text-xs font-bold text-stone-400 mt-0.5">
                {isParentCat ? '母分類 (含旗下所有子分類加總)' : '單一分類交易明細'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onClose();
            }}
            className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-400 hover:text-stone-600"
          >
            <X size={20} />
          </button>
        </div>

        {/* Responsive Body Layout: Mobile 1 column stack, Desktop 2 columns split */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 flex-1 min-h-0 overflow-hidden">
          
          {/* Left Column: Overview & Subcategory Filters */}
          <div className="flex flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar shrink-0 md:shrink">
            {/* Top Summary Banner */}
            <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs grid grid-cols-2 gap-3 items-center">
              <div>
                <span className="text-xs font-bold text-stone-400 block">此期間總花費</span>
                <span className={`text-xl md:text-2xl font-black ${reportType === 'expense' ? 'text-rose-600' : 'text-blue-600'}`}>
                  ${catTotal.toLocaleString()}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-stone-400 block">交易筆數</span>
                <span className="text-base font-black text-[#5D4037]">{matchingRecords.length} 筆交易</span>
              </div>
            </div>

            {/* Sub-category Filter Section (If Parent Category) */}
            {isParentCat && presentSubCategories.length > 0 && (
              <div className="bg-white/80 p-4 rounded-2xl border border-stone-200/60 shadow-2xs flex flex-col gap-2.5">
                <span className="text-xs font-black text-[#5D4037]">子分類快速導航與過濾</span>
                <div className="flex md:flex-wrap items-center gap-2 overflow-x-auto md:overflow-visible py-1 custom-scrollbar">
                  <button
                    type="button"
                    onClick={() => setSubFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 ${
                      subFilter === 'all'
                        ? 'bg-[#5D4037] text-white shadow-xs'
                        : 'bg-stone-50 text-stone-600 border border-stone-200/80 hover:bg-stone-100'
                    }`}
                  >
                    全部 ({matchingRecords.length})
                  </button>
                  {presentSubCategories.map(subName => {
                    const count = matchingRecords.filter(r => {
                      const cleanCat = (r.category || '').trim();
                      const parts = cleanCat.split(/\s*(?:＞|>)\s*/).map(p => p.trim());
                      if (subName === '主要 / 直屬') return parts[0] === categoryName && parts.length === 1;
                      return parts.includes(subName) || cleanCat === subName;
                    }).length;

                    return (
                      <button
                        key={subName}
                        type="button"
                        onClick={() => setSubFilter(subName)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 active:scale-95 ${
                          subFilter === subName
                            ? 'bg-[#FFD54F] text-[#5D4037] shadow-xs'
                            : 'bg-stone-50 text-stone-600 border border-stone-200/80 hover:bg-stone-100'
                        }`}
                      >
                        {subName} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Scrollable Transaction Detail List */}
          <div className="bg-white/80 p-4 rounded-3xl border border-stone-200/80 shadow-2xs flex flex-col gap-3 min-h-0 overflow-hidden">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-[#5D4037]">交易明細清單</span>
                {subFilter !== 'all' && (
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">
                    {subFilter}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-bold text-stone-400">
                共 {sortedRecords.length} 筆紀錄
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-0">
              {sortedRecords.length === 0 ? (
                <div className="py-12 text-center text-stone-400 text-sm font-bold bg-stone-50/50 rounded-2xl border border-dashed border-stone-200">
                  無相關交易明細紀錄
                </div>
              ) : (
                sortedRecords.map((r) => {
                  const accName = (Array.isArray(accounts) ? accounts : []).find(a => a.id === r.accountId)?.name || '未指定帳戶';
                  const amt = Math.abs(r.amount) + (r.fee || 0);

                  return (
                    <div
                      key={r.id}
                      onClick={() => onSelectRecord(r)}
                      className="p-3.5 bg-white hover:bg-amber-50/40 active:scale-[0.99] transition-all rounded-2xl border border-stone-200/80 shadow-2xs flex items-center justify-between cursor-pointer group"
                    >
                      <div className="flex flex-col gap-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-[#5D4037] text-sm truncate group-hover:text-amber-900">
                            {r.note || r.category || '消費明細'}
                          </span>
                          {r.category && r.category !== categoryName && (
                            <span className="text-[10px] font-bold bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full shrink-0">
                              {r.category}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-bold text-stone-400">
                          <span>📅 {r.date} {r.time || ''}</span>
                          <span>•</span>
                          <span className="text-stone-500">💳 {accName}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`text-base font-black ${reportType === 'expense' ? 'text-rose-600' : 'text-blue-600'}`}>
                          {reportType === 'expense' ? '-' : '+'}${amt.toLocaleString()}
                        </span>
                        {r.fee ? (
                          <span className="block text-[10px] font-bold text-stone-400">含手續費 ${r.fee}</span>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </motion.div>
    </motion.div>
  );
}

export function ReportsView({ 
  records, 
  projects, 
  categories,
  accounts = [],
  onUpdateRecord,
  onDeleteRecord,
  onDuplicateRecord
}: { 
  records: Transaction[], 
  projects: Project[], 
  categories: Category[],
  accounts?: Account[],
  onUpdateRecord?: (oldRecord: Transaction, updatedRecord: Partial<Transaction>, mergedIdsToDelete?: string[], restoredChildIds?: string[]) => void,
  onDeleteRecord?: (record: Transaction) => void,
  onDuplicateRecord?: (record: Transaction) => void
}) {
  const [dateRange, setDateRange] = useState<'thisMonth' | 'last3Months' | 'last6Months' | 'lastYear'>('thisMonth');
  const [reportType, setReportType] = useState<'expense' | 'income'>('expense');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeSector, setActiveSector] = useState<any>(null);

  // Category Detail Modal & Editing Record State
  const [detailCategoryInfo, setDetailCategoryInfo] = useState<{ categoryName: string; subFilter?: string; type?: 'expense' | 'income' } | null>(null);
  const [editingRecord, setEditingRecord] = useState<Transaction | null>(null);
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});
  
  const COLORS = ['#FFD54F', '#FFAB91', '#81C784', '#90CAF9', '#CE93D8', '#BCAAA4', '#B0BEC5', '#FFCCBC', '#C5E1A5', '#FFF59D'];

  // List of main categories for the category filter row (expense / income)
  const mainExpenseCategories = useMemo(() => {
    const list: { id: string; name: string; icon?: string }[] = [];
    (Array.isArray(categories) ? categories : [])
      .filter(c => c.type === 'expense' || !c.type)
      .forEach(cat => {
        if (!list.some(item => item.name === cat.name)) {
          list.push({ id: cat.id, name: cat.name, icon: cat.icon });
        }
      });
    return list;
  }, [categories]);

  const mainIncomeCategories = useMemo(() => {
    const list: { id: string; name: string; icon?: string }[] = [];
    (Array.isArray(categories) ? categories : [])
      .filter(c => c.type === 'income')
      .forEach(cat => {
        if (!list.some(item => item.name === cat.name)) {
          list.push({ id: cat.id, name: cat.name, icon: cat.icon });
        }
      });
    return list;
  }, [categories]);

  const activeMainCategories = reportType === 'expense' ? mainExpenseCategories : mainIncomeCategories;

  const dateInterval = useMemo(() => {
    const now = new Date();
    let start = startOfMonth(now);
    let end = endOfMonth(now);

    if (dateRange === 'last3Months') start = subMonths(startOfMonth(now), 2);
    if (dateRange === 'last6Months') start = subMonths(startOfMonth(now), 5);
    if (dateRange === 'lastYear') start = subMonths(startOfMonth(now), 11);

    return { start, end };
  }, [dateRange]);

  const stats = useMemo(() => {
    // 1. Strict filtering matching Homepage calculation rules
    // Exclude merged child transactions, prepayments, initial balance setup
    const validRecords = records.filter(r => {
      if (r.isMergedChild || r.parentId || r.parentTransactionId || (r as any).isChildTransaction) return false;
      if (r.category === '初始資金' || r.category === '餘額校正') return false;
      if (r.isPrepay) return false;

      const d = parseISO(r.postingDate || r.date);
      return d >= dateInterval.start && d <= dateInterval.end;
    });

    // Income & Expense total calculations for the entire period
    const income = validRecords
      .filter(r => r.type === 'income')
      .reduce((s, r) => s + Math.abs(r.amount), 0);

    const totalPeriodExpense = validRecords
      .reduce((s, r) => {
        if (r.type === 'expense') return s + (Math.abs(r.amount) + (r.fee || 0));
        if (r.type === 'transfer') return s + (r.fee || 0);
        return s;
      }, 0);

    const activeTotalAmount = reportType === 'expense' ? totalPeriodExpense : income;

    // 2. Filter records according to active reportType (expense / income) and selectedCategory
    let targetRecords = validRecords.filter(r => r.type === reportType);

    if (selectedCategory !== 'all') {
      targetRecords = targetRecords.filter(r => {
        const { parentName, subName } = parseCategoryHierarchy(r.category, categories);
        return parentName === selectedCategory || subName === selectedCategory || (r.category && r.category.includes(selectedCategory));
      });
    }

    const currentFilteredTotal = targetRecords.reduce((s, r) => s + Math.abs(r.amount) + (r.type === 'expense' ? (r.fee || 0) : 0), 0);

    // 3. Parent Category Aggregates Map Calculation
    const parentMap: Record<string, {
      name: string;
      icon?: string;
      totalAmount: number;
      subMap: Record<string, number>;
    }> = {};

    targetRecords.forEach(r => {
      const amt = Math.abs(r.amount) + (r.type === 'expense' ? (r.fee || 0) : 0);
      const { parentName, subName } = parseCategoryHierarchy(r.category, categories);

      const targetParentName = selectedCategory === 'all' ? parentName : selectedCategory;

      if (!parentMap[targetParentName]) {
        const catObj = (Array.isArray(categories) ? categories : []).find(c => c.name === targetParentName);
        parentMap[targetParentName] = {
          name: targetParentName,
          icon: catObj?.icon || (
            targetParentName === '飲食' ? '🍱' :
            targetParentName === '交通' ? '✈️' :
            targetParentName === '醫療&健康' ? '💊' :
            targetParentName === '娛樂' ? '✨' :
            targetParentName === '家庭' || targetParentName === '居住' ? '🏠' :
            targetParentName === '薪資' ? '💼' :
            targetParentName === '投資' ? '📈' :
            targetParentName === '副業' || targetParentName === '接案' ? '💻' :
            targetParentName === '獎金' ? '🎁' : '📁'
          ),
          totalAmount: 0,
          subMap: {}
        };
      }

      parentMap[targetParentName].totalAmount += amt;
      const actualSubName = (subName && subName !== '主要 / 直屬') ? subName : '主要 / 未細分';
      parentMap[targetParentName].subMap[actualSubName] = (parentMap[targetParentName].subMap[actualSubName] || 0) + amt;
    });

    const parentList = Object.values(parentMap).sort((a, b) => b.totalAmount - a.totalAmount);

    const pieData = parentList.map(p => ({
      name: p.name,
      value: p.totalAmount,
      icon: p.icon
    }));

    return {
      income,
      expense: totalPeriodExpense,
      activeTotal: selectedCategory === 'all' ? activeTotalAmount : currentFilteredTotal,
      pieData,
      parentList
    };
  }, [records, dateInterval, selectedCategory, reportType, categories]);

  // Safe Tooltip positioning algorithm with boundary protection & smart flip
  const getTooltipPosition = (sector: any) => {
    if (!sector || typeof sector.cx === 'undefined') return undefined;
    const { cx, cy, midAngle } = sector;
    const radian = -midAngle * (Math.PI / 180);

    const targetRadius = 115;
    const tx = cx + Math.cos(radian) * targetRadius;
    const ty = cy + Math.sin(radian) * targetRadius;

    const tooltipWidth = 140;
    const tooltipHeight = 44;

    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 375;

    let x = tx - tooltipWidth / 2;
    let y = ty - tooltipHeight / 2;

    // Smart flip & screen edge clamp (min 12px margin)
    if (tx < 110) {
      x = Math.max(12, tx + 10);
    } else if (tx > windowWidth - 110) {
      x = Math.min(windowWidth - tooltipWidth - 12, tx - tooltipWidth - 10);
    } else {
      x = Math.max(12, Math.min(x, windowWidth - tooltipWidth - 12));
    }

    y = Math.max(10, y);
    return { x, y };
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex-1 flex flex-col gap-6 px-4 py-8 bg-[#FFF9E3]/30 min-h-full pb-24 overflow-y-auto"
      style={getFontFamily()}
    >
      {/* Filters */}
      <div className="flex flex-col gap-4">
        {/* Date Range Selector */}
        <div className="flex bg-white/60 p-1 rounded-2xl border border-stone-100 shadow-sm overflow-x-auto">
          {(['thisMonth', 'last3Months', 'last6Months', 'lastYear'] as const).map(range => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`flex-1 min-w-[80px] py-2 px-3 rounded-xl text-xs font-black transition-all ${dateRange === range ? 'bg-[#FFD54F] text-[#5D4037] shadow-md' : 'text-stone-400 hover:text-stone-600'}`}
            >
              {range === 'thisMonth' ? '本月' : range === 'last3Months' ? '近三月' : range === 'last6Months' ? '近半年' : '近一年'}
            </button>
          ))}
        </div>
        
        {/* Category Filter Selector (Expense / Income) */}
        <div className="flex items-center gap-2 overflow-x-auto py-1 custom-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-black transition-all border flex items-center gap-1.5 shrink-0 ${
              selectedCategory === 'all' 
                ? (reportType === 'expense' ? 'bg-[#5D4037] text-[#FFFDF5] border-[#5D4037] shadow-sm' : 'bg-blue-600 text-white border-blue-600 shadow-sm')
                : 'bg-white text-stone-500 border-stone-100 hover:bg-stone-50'
            }`}
          >
            <span>全部分類</span>
          </button>

          {activeMainCategories.map(cat => (
            <button
              key={cat.id || cat.name}
              type="button"
              onClick={() => {
                setSelectedCategory(cat.name);
                setDetailCategoryInfo({ categoryName: cat.name, subFilter: 'all', type: reportType });
              }}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-black transition-all border flex items-center gap-1.5 shrink-0 active:scale-95 ${
                selectedCategory === cat.name 
                  ? 'bg-[#FFD54F] text-[#5D4037] border-[#FFD54F] shadow-sm scale-[1.02]' 
                  : 'bg-white text-stone-500 border-stone-100 hover:bg-stone-50'
              }`}
            >
              <AccountIcon icon={cat.icon} sizeClassName="w-4 h-4" />
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards with Interactive Click to Switch */}
      <div className="grid grid-cols-2 gap-4">
        {/* Total Expense Card */}
        <button
          type="button"
          onClick={() => {
            setReportType('expense');
            setSelectedCategory('all');
          }}
          className={`bg-white rounded-3xl p-5 text-left shadow-sm transition-all border-2 flex flex-col gap-1 cursor-pointer active:scale-[0.98] ${
            reportType === 'expense'
              ? 'border-rose-500 bg-rose-50/30 shadow-md ring-2 ring-rose-100'
              : 'border-stone-50 hover:border-rose-200/80 opacity-85 hover:opacity-100'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-500">
              <div className="w-5 h-5 rounded-lg bg-rose-100/80 flex items-center justify-center">
                <div className="w-2.5 h-0.5 bg-rose-500 rounded-full" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest">總支出</span>
            </div>
            {reportType === 'expense' && (
              <span className="text-[10px] font-black bg-rose-500 text-white px-2 py-0.5 rounded-full">
                檢視中
              </span>
            )}
          </div>
          <span className="text-xl font-black text-rose-600 mt-1">${stats.expense.toLocaleString()}</span>
        </button>

        {/* Total Income Card */}
        <button
          type="button"
          onClick={() => {
            setReportType('income');
            setSelectedCategory('all');
          }}
          className={`bg-white rounded-3xl p-5 text-left shadow-sm transition-all border-2 flex flex-col gap-1 cursor-pointer active:scale-[0.98] ${
            reportType === 'income'
              ? 'border-blue-500 bg-blue-50/30 shadow-md ring-2 ring-blue-100'
              : 'border-stone-50 hover:border-blue-200/80 opacity-85 hover:opacity-100'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-500">
              <div className="w-5 h-5 rounded-lg bg-blue-100/80 flex items-center justify-center">
                <Plus size={12} strokeWidth={3} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest">總收入</span>
            </div>
            {reportType === 'income' && (
              <span className="text-[10px] font-black bg-blue-500 text-white px-2 py-0.5 rounded-full">
                檢視中
              </span>
            )}
          </div>
          <span className="text-xl font-black text-blue-600 mt-1">${stats.income.toLocaleString()}</span>
        </button>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-[40px] p-6 sm:p-8 shadow-sm border border-stone-50 overflow-visible relative">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-black text-[#5D4037]">
              {reportType === 'expense'
                ? (selectedCategory === 'all' ? '支出分析 (全部分類彙整)' : `支出分析 (${selectedCategory} 細項拆分)`)
                : (selectedCategory === 'all' ? '收入分析 (全部分類彙整)' : `收入分析 (${selectedCategory} 細項拆分)`)}
            </h3>
            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mt-1">
              {reportType === 'expense'
                ? (selectedCategory === 'all' ? 'Parent Category Expense Breakdown' : `${selectedCategory} Subcategory Expense`)
                : (selectedCategory === 'all' ? 'Parent Category Income Breakdown' : `${selectedCategory} Subcategory Income`)}
            </p>
          </div>
        </div>
        
        {stats.pieData.length === 0 ? (
          <div className="h-[260px] w-full flex flex-col items-center justify-center gap-3 bg-stone-50/60 rounded-3xl border border-dashed border-stone-200 my-2">
            <div className="w-12 h-12 rounded-full bg-amber-100/60 flex items-center justify-center text-amber-800 text-xl shadow-xs">
              📊
            </div>
            <p className="text-sm font-bold text-[#5D4037]/70">此期間無相關{reportType === 'expense' ? '支出' : '收入'}紀錄</p>
          </div>
        ) : (
          <>
            <div className="h-[300px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={stats.pieData}
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={6}
                    dataKey="value"
                    stroke="none"
                    onMouseEnter={(data) => setActiveSector(data)}
                    onMouseLeave={() => setActiveSector(null)}
                    onClick={(data) => {
                      setActiveSector(data);
                      if (data && data.name) {
                        setDetailCategoryInfo({ categoryName: data.name, subFilter: 'all', type: reportType });
                      }
                    }}
                  >
                    {stats.pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="cursor-pointer" />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={<CustomTooltip />}
                    position={getTooltipPosition(activeSector)}
                  />
                </RePieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">
                  {selectedCategory === 'all' ? (reportType === 'expense' ? '總支出' : '總收入') : '類別金額'}
                </span>
                <span className={`text-2xl font-black ${reportType === 'expense' ? 'text-[#5D4037]' : 'text-blue-600'}`}>
                  ${stats.activeTotal.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Hierarchical Accordion List */}
            <div className="flex flex-col gap-3 mt-8">
              <div className="flex items-center justify-between px-1 mb-1">
                <h4 className="text-sm font-black text-[#5D4037]">
                  {reportType === 'expense' ? '支出母分類彙整排行榜與子項目' : '收入母分類彙整排行榜與子項目'}
                </h4>
                <span className="text-[11px] font-bold text-stone-400">點擊卡片查看明細 / 點擊箭頭展開子分類</span>
              </div>

              {stats.parentList.map((parent, index) => {
                const parentPercentage = stats.activeTotal > 0 ? ((parent.totalAmount / stats.activeTotal) * 100).toFixed(1) : '0.0';
                const color = COLORS[index % COLORS.length];

                const subEntries = Object.entries(parent.subMap)
                  .map(([subName, subAmt]) => ({ name: subName, value: Number(subAmt) }))
                  .sort((a, b) => b.value - a.value);

                const hasSubItems = subEntries.length > 0;
                const isExpanded = !!expandedParents[parent.name];

                return (
                  <div 
                    key={parent.name} 
                    className="bg-stone-50/70 hover:bg-stone-50 rounded-3xl p-4 shadow-2xs border border-stone-100 flex flex-col gap-2.5 transition-all"
                  >
                    {/* Parent Category Card Header */}
                    <div className="flex items-center justify-between gap-3">
                      {/* Left: Color dot, Icon, Parent Name */}
                      <button
                        type="button"
                        onClick={() => setDetailCategoryInfo({ categoryName: parent.name, subFilter: 'all', type: reportType })}
                        className="flex items-center gap-2.5 min-w-0 flex-1 text-left group"
                      >
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <AccountIcon icon={parent.icon} sizeClassName="w-5 h-5" />
                        <span className="text-sm font-black text-[#5D4037] truncate group-hover:text-amber-800 transition-colors">
                          {parent.name}
                        </span>
                      </button>

                      {/* Right: Total Amount, Percentage Badge, Subcount badge & Expand Toggle */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <div className={`text-sm font-black ${reportType === 'expense' ? 'text-[#5D4037]' : 'text-blue-600'}`}>
                            ${parent.totalAmount.toLocaleString()}
                          </div>
                          <div className="text-[10px] font-bold text-stone-400">
                            {parentPercentage}% 佔比
                          </div>
                        </div>

                        {/* View Detail Button */}
                        <button
                          type="button"
                          onClick={() => setDetailCategoryInfo({ categoryName: parent.name, subFilter: 'all', type: reportType })}
                          className="p-1.5 bg-white hover:bg-amber-50 rounded-xl text-stone-500 hover:text-amber-900 transition-all text-xs font-bold border border-stone-100 shadow-2xs"
                          title="查看該母分類完整交易明細"
                        >
                          🔍
                        </button>

                        {/* Expand / Collapse Button if children exist */}
                        {hasSubItems && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedParents(prev => ({ ...prev, [parent.name]: !prev[parent.name] }));
                            }}
                            className="p-1.5 bg-amber-100/60 hover:bg-amber-100 rounded-xl text-amber-900 transition-all flex items-center gap-1 text-xs font-bold"
                            title={isExpanded ? '收合子分類' : '展開子分類'}
                          >
                            <span className="text-[10px] bg-white/90 px-1.5 py-0.2 rounded-md border border-amber-200/60">
                              {subEntries.length}
                            </span>
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Subcategories Drawer (Expanded Accordion) */}
                    {hasSubItems && isExpanded && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="pt-2 border-t border-stone-200/60 flex flex-col gap-1.5 pl-4 pr-1"
                      >
                        {subEntries.map((sub) => {
                          const subShareInParent = parent.totalAmount > 0 ? ((Number(sub.value) / parent.totalAmount) * 100).toFixed(1) : '0.0';

                          return (
                            <button
                              key={sub.name}
                              type="button"
                              onClick={() => setDetailCategoryInfo({ categoryName: parent.name, subFilter: sub.name, type: reportType })}
                              className="flex items-center justify-between p-2.5 bg-white hover:bg-amber-50/80 rounded-2xl border border-stone-100 text-left transition-all group shadow-2xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-stone-500 group-hover:text-amber-500 font-bold text-xs">└</span>
                                <span className="text-xs font-bold text-[#5D4037] truncate">
                                  {sub.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-xs font-black ${reportType === 'expense' ? 'text-stone-700' : 'text-blue-600'}`}>
                                  ${sub.value.toLocaleString()}
                                </span>
                                <span className="text-[10px] font-bold text-amber-800 bg-amber-100/70 px-1.5 py-0.5 rounded-md">
                                  {subShareInParent}% (在{parent.name}內)
                                </span>
                                <span className="text-[10px] text-stone-400 group-hover:text-[#5D4037]">🔍</span>
                              </div>
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="h-[60px]" />

      {/* Category Detail Modal */}
      <AnimatePresence>
        {detailCategoryInfo && (
          <CategoryDetailModal
            categoryName={detailCategoryInfo.categoryName}
            initialSubFilter={detailCategoryInfo.subFilter}
            reportType={detailCategoryInfo.type || reportType}
            dateInterval={dateInterval}
            records={records}
            categories={categories}
            accounts={accounts}
            totalPeriodExpense={stats.activeTotal}
            onClose={() => setDetailCategoryInfo(null)}
            onSelectRecord={(r) => setEditingRecord(r)}
          />
        )}
      </AnimatePresence>

      {/* Edit Record Modal triggered from Category Detail Modal */}
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
              onUpdateRecord?.(editingRecord, updated, mergedIdsToDelete, restoredIds);
              setEditingRecord(null);
            }}
            onDelete={() => {
              onDeleteRecord?.(editingRecord);
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

import { getFontFamily } from '../lib/financeUtils';
import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Pencil,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Category, Transaction } from '../types';
import { formatLocalDate } from '../lib/dateUtils';
import { AccountIcon } from '../components/AccountWidgets';

export function BudgetManagementPage({
  monthlyBudget,
  setMonthlyBudget,
  syncBudgetToCloud,
  categories,
  onUpdateCategories,
  records,
  selectedDate,
  onDateChange,
  currencyMode,
  onBack
}: {
  monthlyBudget: number;
  setMonthlyBudget: (b: number) => void;
  syncBudgetToCloud: (b: number) => void;
  categories: Category[];
  onUpdateCategories: (newCats: Category[]) => Promise<void>;
  records: Transaction[];
  selectedDate: string;
  onDateChange: (d: string) => void;
  currencyMode: 'TWD' | 'FOREIGN' | null;
  onBack: () => void;
}) {
  const [editingOverall, setEditingOverall] = useState(false);
  const [tempOverallBudget, setTempOverallBudget] = useState(monthlyBudget.toString());
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [tempCategoryBudget, setTempCategoryBudget] = useState('');
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [tempSubBudget, setTempSubBudget] = useState('');

  const monthStr = selectedDate.substring(0, 7);

  // Month navigation handlers
  const handlePrevMonth = () => {
    try {
      const parts = selectedDate.split('-');
      if (parts.length >= 2) {
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const prev = new Date(year, month - 2, 1);
        onDateChange(formatLocalDate(prev));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleNextMonth = () => {
    try {
      const parts = selectedDate.split('-');
      if (parts.length >= 2) {
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const next = new Date(year, month, 1);
        onDateChange(formatLocalDate(next));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const monthRangeLabel = useMemo(() => {
    try {
      const parts = selectedDate.split('-');
      if (parts.length >= 2) {
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0);
        const format = (d: Date) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
        return `${format(start)} - ${format(end)}`;
      }
    } catch (e) {
      console.error(e);
    }
    return '';
  }, [selectedDate]);

  // Filter only expense categories
  const expenseCategories = useMemo(() => {
    return categories.filter(c => c.type === 'expense').sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [categories]);

  // Total expenses this month (TWD or foreign, filtered by currencyMode)
  const totalMonthlyExpenses = useMemo(() => {
    const monthlyRecords = records.filter(r => {
      const cur = r.currency || 'TWD';
      if (currencyMode === 'FOREIGN') return cur !== 'TWD';
      return cur === 'TWD';
    });

    return monthlyRecords
      .filter(r => {
        const pDate = r.postingDate || r.date;
        return pDate.startsWith(monthStr) && r.category !== '初始資金' && r.type === 'expense' && !r.isPrepay;
      })
      .reduce((sum, r) => sum + (Math.abs(r.amount) + (r.fee || 0)), 0);
  }, [records, monthStr, currencyMode]);

  // Category monthly expenses map
  const categoryExpensesMap = useMemo(() => {
    const map: Record<string, number> = {};
    
    const monthlyRecords = records.filter(r => {
      const cur = r.currency || 'TWD';
      if (currencyMode === 'FOREIGN') return cur !== 'TWD';
      return cur === 'TWD';
    });

    monthlyRecords.forEach(r => {
      const pDate = r.postingDate || r.date;
      if (pDate.startsWith(monthStr) && r.category !== '初始資金' && r.type === 'expense' && !r.isPrepay) {
        const parentCat = r.category.split(' > ')[0];
        const amount = Math.abs(r.amount) + (r.fee || 0);
        map[parentCat] = (map[parentCat] || 0) + amount;
      }
    });

    return map;
  }, [records, monthStr, currencyMode]);

  // Get monthly transactions for a category
  const getCategoryMonthlyTransactions = (catName: string) => {
    const monthlyRecords = records.filter(r => {
      const cur = r.currency || 'TWD';
      if (currencyMode === 'FOREIGN') return cur !== 'TWD';
      return cur === 'TWD';
    });

    return monthlyRecords
      .filter(r => {
        const pDate = r.postingDate || r.date;
        if (!pDate.startsWith(monthStr)) return false;
        if (r.type !== 'expense' || r.isPrepay) return false;
        const rCat = r.category.split(' > ')[0];
        return rCat === catName;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  };

  // Get monthly spent for a subcategory
  const getSubcategoryMonthlyExpense = (parentCatName: string, subCatName: string) => {
    const monthlyRecords = records.filter(r => {
      const cur = r.currency || 'TWD';
      if (currencyMode === 'FOREIGN') return cur !== 'TWD';
      return cur === 'TWD';
    });

    return monthlyRecords
      .filter(r => {
        const pDate = r.postingDate || r.date;
        if (!pDate.startsWith(monthStr)) return false;
        if (r.type !== 'expense' || r.isPrepay) return false;
        const parts = r.category.split(' > ');
        return parts[0] === parentCatName && parts[1] === subCatName;
      })
      .reduce((sum, r) => sum + (Math.abs(r.amount) + (r.fee || 0)), 0);
  };

  // Handle saving subcategory budget
  const handleSaveSubBudget = async (catId: string, subName: string) => {
    const val = tempSubBudget === '' ? undefined : parseInt(tempSubBudget);
    const updated = categories.map(c => {
      if (c.id === catId) {
        const subBudgets = { ...(c.subBudgets || {}) };
        if (val === undefined || val === 0) {
          delete subBudgets[subName];
        } else {
          subBudgets[subName] = val;
        }
        return { ...c, subBudgets };
      }
      return c;
    });
    await onUpdateCategories(updated);
    setEditingSubId(null);
  };

  const overallPercent = monthlyBudget > 0 ? (totalMonthlyExpenses / monthlyBudget) * 100 : 0;
  const remainingBudget = monthlyBudget - totalMonthlyExpenses;

  // Handle saving overall budget
  const handleSaveOverall = () => {
    const val = parseInt(tempOverallBudget) || 0;
    if (val > 0) {
      setMonthlyBudget(val);
      syncBudgetToCloud(val);
    }
    setEditingOverall(false);
  };

  // Handle saving category budget
  const handleSaveCategoryBudget = async (catId: string) => {
    const val = tempCategoryBudget === '' ? undefined : parseInt(tempCategoryBudget);
    const updated = categories.map(c => {
      if (c.id === catId) {
        return { ...c, budget: val === 0 ? undefined : val };
      }
      return c;
    });
    await onUpdateCategories(updated);
    setEditingCategoryId(null);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col h-full bg-[#FFFDF5]"
      style={getFontFamily()}
    >
      {/* Month Switcher Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-[#FFFDF5] border-b border-stone-100 flex-shrink-0">
        <button 
          onClick={handlePrevMonth} 
          className="w-10 h-10 rounded-full flex items-center justify-center text-[#5D4037] hover:bg-stone-50 transition-colors shadow-sm bg-white"
        >
          <ChevronLeft size={24} />
        </button>
        <span className="text-lg font-black text-[#5D4037] tracking-tight">{monthRangeLabel}</span>
        <button 
          onClick={handleNextMonth} 
          className="w-10 h-10 rounded-full flex items-center justify-center text-[#5D4037] hover:bg-stone-50 transition-colors shadow-sm bg-white"
        >
          <ChevronRight size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {/* Overall Budget Card */}
        <div className="bg-white rounded-[32px] p-6 shadow-sm border-2 border-stone-50 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-stone-400">本月預算狀態 ({monthStr.replace('-', '/')})</span>
            {!editingOverall ? (
              <button 
                onClick={() => {
                  setTempOverallBudget(monthlyBudget.toString());
                  setEditingOverall(true);
                }}
                className="flex items-center gap-1.5 text-xs font-bold text-[#5D4037] bg-stone-50 hover:bg-stone-100 px-3 py-1.5 rounded-full border border-stone-100 transition-colors"
              >
                <Pencil size={12} />
                調整總預算
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleSaveOverall}
                  className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm border border-emerald-100 hover:bg-emerald-100 transition-colors"
                >
                  <Check size={14} />
                </button>
                <button 
                  onClick={() => setEditingOverall(false)}
                  className="w-7 h-7 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shadow-sm border border-rose-100 hover:bg-rose-100 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          {editingOverall ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 bg-stone-50 p-4 rounded-2xl border-2 border-stone-100">
                <span className="text-lg font-black text-[#5D4037]">$</span>
                <input 
                  type="number" 
                  pattern="\d*"
                  inputMode="numeric"
                  value={tempOverallBudget} 
                  onChange={(e) => setTempOverallBudget(e.target.value)}
                  className="bg-transparent text-2xl font-black text-[#5D4037] focus:outline-none w-full"
                  placeholder="請輸入月預算"
                  autoFocus
                />
              </div>
              <input 
                type="range" min="5000" max="150000" step="5000"
                value={parseInt(tempOverallBudget) || 5000}
                onChange={(e) => setTempOverallBudget(e.target.value)}
                className="w-full h-2 bg-stone-100 rounded-lg appearance-none cursor-pointer accent-[#5D4037]"
              />
            </div>
          ) : (
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-black text-[#5D4037]">$</span>
              <span className="text-3xl font-black tracking-tight text-[#5D4037]">
                {monthlyBudget.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-stone-400 ml-2">/ 月</span>
            </div>
          )}

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden relative border border-stone-50">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(overallPercent, 100)}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={`h-full rounded-full ${
                  overallPercent > 100 
                    ? 'bg-gradient-to-r from-rose-400 to-rose-500' 
                    : overallPercent > 80 
                    ? 'bg-gradient-to-r from-amber-400 to-amber-500' 
                    : 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                }`}
              />
            </div>
            <div className="flex justify-between text-xs font-bold text-stone-400">
              <span>已支出: ${totalMonthlyExpenses.toLocaleString()}</span>
              <span>{overallPercent.toFixed(0)}%</span>
            </div>
          </div>

          <div className="border-t border-stone-100 pt-4 flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest leading-none mb-1">
                {remainingBudget >= 0 ? '剩餘預算' : '超出預算'}
              </span>
              <span className={`text-lg font-black ${remainingBudget >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                $ {Math.abs(remainingBudget).toLocaleString()}
              </span>
            </div>
            {remainingBudget < 0 && (
              <div className="bg-rose-50 border border-rose-100 text-rose-500 rounded-2xl px-3 py-2 text-[10px] font-bold flex items-center gap-1.5 shadow-sm">
                <AlertCircle size={14} />
                本月支出已超支！
              </div>
            )}
          </div>
        </div>

        {/* Category Budget Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[#5D4037]">分類預算設定 ({expenseCategories.length})</span>
            <span className="text-xs text-stone-400 font-bold">點選即可快速調整</span>
          </div>

          <div className="flex flex-col gap-3">
            {expenseCategories.map(cat => {
              const spent = categoryExpensesMap[cat.name] || 0;
              const hasBudget = cat.budget !== undefined && cat.budget > 0;
              const budgetVal = cat.budget || 0;
              const percent = hasBudget ? (spent / budgetVal) * 100 : 0;
              const isEditing = editingCategoryId === cat.id;
              const isExpanded = expandedCategoryId === cat.id;
              const catRecords = getCategoryMonthlyTransactions(cat.name);

              return (
                <div 
                  key={cat.id}
                  onClick={() => {
                    if (editingCategoryId !== cat.id) {
                      setExpandedCategoryId(isExpanded ? null : cat.id);
                    }
                  }}
                  className={`bg-white rounded-[24px] p-4 shadow-sm border-2 flex flex-col gap-3 transition-all cursor-pointer ${
                    isExpanded ? 'border-amber-100 bg-[#FFFDF9]' : 'border-stone-50 hover:border-stone-100'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    {/* Category Title */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#FFFDF5] rounded-xl flex items-center justify-center text-xl shadow-sm border border-stone-100/50 overflow-hidden">
                        <AccountIcon icon={cat.icon} sizeClassName="w-6 h-6" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-[#5D4037]">{cat.name}</span>
                        <span className="text-[10px] font-bold text-stone-400">已花費: ${spent.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Budget Setting & Chevron */}
                    <div className="flex items-center gap-2.5">
                      {isEditing ? (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1 bg-stone-50 px-3 py-1.5 rounded-xl border-2 border-stone-100 max-w-[120px]">
                            <span className="text-xs text-stone-400 font-bold">$</span>
                            <input 
                              type="number"
                              pattern="\d*"
                              inputMode="numeric"
                              value={tempCategoryBudget}
                              onChange={(e) => setTempCategoryBudget(e.target.value)}
                              className="bg-transparent text-sm font-black text-[#5D4037] focus:outline-none w-full text-right"
                              placeholder="預算金額"
                              autoFocus
                            />
                          </div>
                          <button 
                            onClick={() => handleSaveCategoryBudget(cat.id)}
                            className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm border border-emerald-100 hover:bg-emerald-100 transition-colors"
                          >
                            <Check size={14} />
                          </button>
                          <button 
                            onClick={() => setEditingCategoryId(null)}
                            className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shadow-sm border border-rose-100 hover:bg-rose-100 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            setTempCategoryBudget(hasBudget ? budgetVal.toString() : '');
                            setEditingCategoryId(cat.id);
                          }}
                          className="flex items-center gap-1.5 bg-stone-50 hover:bg-stone-100 border border-stone-100/50 rounded-full px-3 py-1.5 cursor-pointer transition-colors"
                        >
                          <span className="text-xs font-black text-[#5D4037]">
                            {hasBudget ? `$ ${budgetVal.toLocaleString()}` : '設定預算'}
                          </span>
                          <Pencil size={10} className="text-stone-400" />
                        </div>
                      )}
                      
                      <div className="text-stone-400 flex-shrink-0">
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar (only if budget is set) */}
                  {hasBudget && (
                    <div className="space-y-1 mt-1">
                      <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden relative border border-stone-50">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(percent, 100)}%` }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                          className={`h-full rounded-full ${
                            percent > 100 
                              ? 'bg-rose-400' 
                              : percent > 80 
                              ? 'bg-amber-400' 
                              : 'bg-emerald-400'
                          }`}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] font-bold text-stone-400">
                        <span>剩餘: ${Math.max(0, budgetVal - spent).toLocaleString()}</span>
                        <span>{percent.toFixed(0)}%</span>
                      </div>
                    </div>
                  )}

                  {/* Expanded Subcategories or fallback to Transaction Details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        onClick={(e) => e.stopPropagation()}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 pt-3 border-t border-stone-100 flex flex-col gap-3">
                          {cat.sub && cat.sub.length > 0 ? (
                            cat.sub.map(sub => {
                              const subSpent = getSubcategoryMonthlyExpense(cat.name, sub);
                              const subBudget = cat.subBudgets?.[sub] || 0;
                              const subPercent = subBudget > 0 ? (subSpent / subBudget) * 100 : 0;
                              const isEditingSub = editingSubId === `${cat.id}_${sub}`;

                              return (
                                <div key={sub} className="flex flex-col gap-1.5 py-1.5 border-b border-stone-50/50 last:border-0">
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="font-bold text-[#5D4037]">{sub}</span>
                                    
                                    {isEditingSub ? (
                                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center gap-1 bg-stone-50 px-2 py-1 rounded-lg border-2 border-stone-100 max-w-[80px]">
                                          <span className="text-[10px] text-stone-400 font-bold">$</span>
                                          <input 
                                            type="number"
                                            pattern="\d*"
                                            inputMode="numeric"
                                            value={tempSubBudget}
                                            onChange={(e) => setTempSubBudget(e.target.value)}
                                            className="bg-transparent text-[11px] font-black text-[#5D4037] focus:outline-none w-full text-right"
                                            placeholder="預算"
                                            autoFocus
                                          />
                                        </div>
                                        <button 
                                          onClick={() => handleSaveSubBudget(cat.id, sub)}
                                          className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-sm"
                                        >
                                          <Check size={12} />
                                        </button>
                                        <button 
                                          onClick={() => setEditingSubId(null)}
                                          className="w-6 h-6 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shadow-sm"
                                        >
                                          <X size={12} />
                                        </button>
                                      </div>
                                    ) : (
                                      <div 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setTempSubBudget(subBudget > 0 ? subBudget.toString() : '');
                                          setEditingSubId(`${cat.id}_${sub}`);
                                        }}
                                        className="flex flex-col items-end gap-0.5 cursor-pointer hover:opacity-85 text-right"
                                      >
                                        <span className="font-black text-rose-400 leading-none">
                                          $ {subSpent.toLocaleString()}
                                        </span>
                                        <div className="flex items-center gap-0.5 mt-0.5 leading-none">
                                          <span className="text-[9px] text-stone-400">
                                            $ {subBudget.toLocaleString()}
                                          </span>
                                          <Pencil size={8} className="text-stone-300" />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Subcategory budget progress bar */}
                                  <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden relative">
                                    <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: `${subBudget > 0 ? Math.min(subPercent, 100) : 0}%` }}
                                      transition={{ duration: 0.5, ease: "easeOut" }}
                                      className={`h-full rounded-full ${
                                        subPercent > 100 
                                          ? 'bg-rose-400' 
                                          : subPercent > 80 
                                          ? 'bg-amber-400' 
                                          : 'bg-emerald-400/80'
                                      }`}
                                    />
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            // Fallback to transaction details if no subcategories exist
                            catRecords.length > 0 ? (
                              catRecords.map(r => (
                                <div key={r.id} className="flex justify-between items-center text-xs py-1.5 border-b border-stone-50/50 last:border-0 hover:bg-stone-50/30 px-2 rounded-xl transition-colors gap-3">
                                  <div className="flex flex-col gap-0.5 flex-1 min-w-0 pr-1">
                                    <span className="font-bold text-[#5D4037] truncate block">{r.note || r.category}</span>
                                    <span className="text-[10px] text-stone-400">{r.date.replace(/-/g, '/')}</span>
                                  </div>
                                  <span className="font-black text-rose-400 flex-shrink-0 whitespace-nowrap">
                                    - $ {(Math.abs(r.amount) + (r.fee || 0)).toLocaleString()}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <span className="text-stone-300 text-xs text-center py-2">本月無消費明細</span>
                            )
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

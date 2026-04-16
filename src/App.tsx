import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Menu, 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  X, 
  Wallet, 
  Smile, 
  Home, 
  BarChart3, 
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
  Train,
  Smartphone,
  Coins,
  Settings2,
  Check,
  CreditCard,
  Banknote,
  Trash2,
  Edit3,
  Pencil,
  History,
  ArrowLeft,
  AlertCircle,
  Eye,
  EyeOff,
  HelpCircle,
  MoreVertical,
  Repeat,
  Briefcase,
  PieChart,
  Layers,
  Search,
  Star,
  Mic,
  Gift
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Types ---

interface Category {
  id: string;
  name: string;
  icon: string;
  type: 'income' | 'expense';
  sub: string[];
}

interface Transaction {
  id: string;
  amount: number;      // 原始金額 (來源帳戶幣別)
  category: string;
  note?: string;
  date: string;        // YYYY-MM-DD
  type: 'income' | 'expense' | 'transfer';
  accountId: string;   // 來源帳戶
  toAccountId?: string; // 轉帳目標帳戶
  toAmount?: number;   // 目標帳戶收到的金額 (換匯後)
  exchangeRate?: number; // 匯率 (1 來源幣別 = X 目標幣別)
}

interface Account {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'investment' | 'credit' | 'e-ticket';
  icon: string;
  parentId?: string;
  currency: string;    // 幣別 (如 "TWD", "USD", "JPY")
  closingDay?: number; // 信用卡結帳日 (1-31)
}

interface Template {
  id: string;
  name: string;
  amount: number;
  category: string;
  type: 'income' | 'expense' | 'transfer';
  fromAccountId: string;
  toAccountId?: string;
  icon: string;
  color: string;
  note?: string;
}

interface FixedRecord {
  id: string;
  name: string;
  amount: number;
  type: 'income' | 'expense';
  period: 'weekly' | 'monthly' | 'yearly';
  day: number; // 1-31 for monthly/yearly, 0-6 for weekly
  accountId: string;
  category: string;
  autoEntry: boolean;
  lastProcessedDate?: string; // YYYY-MM-DD
}

// --- Initial Data ---

const INITIAL_CATEGORIES: Category[] = [
  { id: 'c1', name: '食物', icon: '🍱', type: 'expense', sub: ['早餐', '午餐', '晚餐', '飲料', '零食'] },
  { id: 'c2', name: '交通', icon: '🚗', type: 'expense', sub: ['捷運', '公車', '火車', '加油', '停車'] },
  { id: 'c3', name: '購物', icon: '🛍️', type: 'expense', sub: ['服飾', '日用品', '電子產品', '美妝'] },
  { id: 'c4', name: '娛樂', icon: '🎮', type: 'expense', sub: ['電影', '遊戲', 'KTV', '旅遊'] },
  { id: 'c5', name: '生活', icon: '🏠', type: 'expense', sub: ['房租', '水電費', '電話費', '保險'] },
  { id: 'c6', name: '醫療', icon: '🏥', type: 'expense', sub: ['診所', '藥局', '保健品'] },
  { id: 'c7', name: '其他', icon: '✨', type: 'expense', sub: ['雜項', '捐款', '禮物'] },
  { id: 'c8', name: '薪資', icon: '💼', type: 'income', sub: ['月薪', '獎金', '兼職'] },
  { id: 'c9', name: '投資', icon: '📈', type: 'income', sub: ['股利', '利息', '價差'] },
];

const INITIAL_ACCOUNTS: Account[] = [
  { id: 'cash', name: '現金', type: 'cash', icon: '💰', currency: 'TWD' },
  { id: 'bank_ts_group', name: '台新銀行', type: 'bank', icon: '🏦', currency: 'TWD' },
  { id: 'bank_ts_1', name: '台新 - 活存', type: 'bank', icon: '🏦', parentId: 'bank_ts_group', currency: 'TWD' },
  { id: 'bank_ts_2', name: '台新 - 儲蓄', type: 'bank', icon: '🏦', parentId: 'bank_ts_group', currency: 'TWD' },
  { id: 'inv_cathay', name: '國泰證券 (006208)', type: 'investment', icon: '📈', currency: 'TWD' },
  { id: 'credit_ts', name: '台新信用卡', type: 'credit', icon: '💳', currency: 'TWD' },
  { id: 'easycard', name: '悠遊卡', type: 'e-ticket', icon: '🚌', currency: 'TWD' },
];

const INITIAL_RECORDS: Transaction[] = [
  { id: 'init_cash', amount: 3500, category: '初始資金', date: '2026-04-01', type: 'income', accountId: 'cash' },
  { id: 'init_bank_1', amount: 150000, category: '初始資金', date: '2026-04-01', type: 'income', accountId: 'bank_ts_1' },
  { id: 'init_bank_2', amount: 25800, category: '初始資金', date: '2026-04-01', type: 'income', accountId: 'bank_ts_2' },
  { id: 'init_inv', amount: 450000, category: '初始資金', date: '2026-04-01', type: 'income', accountId: 'inv_cathay' },
  { id: 'init_credit', amount: 8240, category: '初始資金', date: '2026-04-01', type: 'expense', accountId: 'credit_ts' },
  { id: 'init_easy', amount: 500, category: '初始資金', date: '2026-04-01', type: 'income', accountId: 'easycard' },
];

const INITIAL_TEMPLATES: Template[] = [
  { id: 't1', name: '火車通勤', amount: 41, category: '交通', type: 'expense', fromAccountId: 'cash', icon: '🚂', color: 'bg-blue-50' },
  { id: 't2', name: '自動加值', amount: 500, category: '交通', type: 'transfer', fromAccountId: 'credit_ts', toAccountId: 'easycard', icon: '⚡', color: 'bg-emerald-50' },
  { id: 't3', name: '薪資收入', amount: 29500, category: '薪資', type: 'income', fromAccountId: 'bank_ts_1', icon: '💼', color: 'bg-amber-50' },
];

// --- Main App ---

// Helper to parse date string "YYYY-MM-DD" to local Date object
const parseLocalDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// Helper to format Date object to "YYYY-MM-DD"
const formatLocalDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function App() {
  const [currentView, setCurrentView] = useState<'home' | 'reports' | 'more' | 'accounts' | 'calendar' | 'accountDetail' | 'history' | 'fixedRecords' | 'projects' | 'budget' | 'categories' | 'installments'>('home');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isAccountEditModalOpen, setIsAccountEditModalOpen] = useState(false);
  const [isAccountSortModalOpen, setIsAccountSortModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => formatLocalDate(new Date()));
  const [records, setRecords] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('kk_adv_records');
    return saved ? JSON.parse(saved) : INITIAL_RECORDS;
  });
  const [accounts, setAccounts] = useState<Account[]>(() => {
    const saved = localStorage.getItem('kk_adv_accounts');
    return saved ? JSON.parse(saved) : INITIAL_ACCOUNTS;
  });
  const [categories, setCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem('kk_adv_categories');
    return saved ? JSON.parse(saved) : INITIAL_CATEGORIES;
  });

  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [selectedAccountForDetail, setSelectedAccountForDetail] = useState<Account | null>(null);
  const [historyFilter, setHistoryFilter] = useState<{ type: 'day' | 'week' | 'month' | 'year', date: string }>({ type: 'day', date: selectedDate });
  const [templates, setTemplates] = useState<Template[]>(() => {
    const saved = localStorage.getItem('kk_adv_templates');
    return saved ? JSON.parse(saved) : INITIAL_TEMPLATES;
  });
  const [fixedRecords, setFixedRecords] = useState<FixedRecord[]>(() => {
    const saved = localStorage.getItem('kk_adv_fixed_records');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('kk_adv_records', JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    localStorage.setItem('kk_adv_accounts', JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    localStorage.setItem('kk_adv_templates', JSON.stringify(templates));
  }, [templates]);

  useEffect(() => {
    localStorage.setItem('kk_adv_fixed_records', JSON.stringify(fixedRecords));
  }, [fixedRecords]);

  useEffect(() => {
    localStorage.setItem('kk_adv_categories', JSON.stringify(categories));
  }, [categories]);

  const checkFixedRecords = () => {
    const today = new Date();
    const todayStr = formatLocalDate(today);
    
    let updatedRecords = [...records];
    let updatedFixed = [...fixedRecords];
    let changed = false;

    updatedFixed = updatedFixed.map(fr => {
      if (!fr.autoEntry) return fr;

      const lastProcessed = fr.lastProcessedDate ? parseLocalDate(fr.lastProcessedDate) : null;
      const now = today;
      
      let shouldProcess = false;
      if (fr.period === 'monthly') {
        if (now.getDate() === fr.day) {
          if (!lastProcessed || lastProcessed.getMonth() !== now.getMonth() || lastProcessed.getFullYear() !== now.getFullYear()) {
            shouldProcess = true;
          }
        }
      } else if (fr.period === 'weekly') {
        if (now.getDay() === fr.day) {
          if (!lastProcessed || (now.getTime() - lastProcessed.getTime()) > 6 * 24 * 60 * 60 * 1000) {
            shouldProcess = true;
          }
        }
      } else if (fr.period === 'yearly') {
        // For simplicity, yearly on the same day/month
        if (now.getDate() === fr.day && now.getMonth() === 0) { // Default to Jan if month not specified
          if (!lastProcessed || lastProcessed.getFullYear() !== now.getFullYear()) {
            shouldProcess = true;
          }
        }
      }

      if (shouldProcess) {
        const newTransaction: Transaction = {
          id: `fixed_${fr.id}_${todayStr}`,
          amount: fr.amount,
          category: fr.category,
          note: `[固定收支] ${fr.name}`,
          date: todayStr,
          type: fr.type,
          accountId: fr.accountId
        };
        updatedRecords.push(newTransaction);
        changed = true;
        return { ...fr, lastProcessedDate: todayStr };
      }
      return fr;
    });

    if (changed) {
      setRecords(updatedRecords);
      setFixedRecords(updatedFixed);
    }
  };

  useEffect(() => {
    checkFixedRecords();
  }, [selectedDate]);

  const headerTitle = useMemo(() => {
    if (currentView === 'accountDetail' && selectedAccountForDetail) {
      return selectedAccountForDetail.name;
    }
    if (currentView === 'accounts') return '帳戶列表';
    if (currentView === 'calendar') return '日曆明細';
    if (currentView === 'reports') return '收支報表';
    if (currentView === 'more') return '更多設定';
    if (currentView === 'history') {
      if (historyFilter.type === 'day') return '本日明細';
      if (historyFilter.type === 'week') return '本週明細';
      if (historyFilter.type === 'month') return '本月明細';
      if (historyFilter.type === 'year') return '本年明細';
      return '往來明細';
    }
    if (currentView === 'fixedRecords') return '固定收支管理';
    if (currentView === 'projects') return '專案管理';
    if (currentView === 'budget') return '預算管理';
    if (currentView === 'categories') return '分類管理';
    if (currentView === 'installments') return '分期付款管理';
    
    // For home view, show the year/month of selectedDate
    // Strictly parse the string to avoid any date object shifting
    try {
      const parts = selectedDate.split('-');
      if (parts.length >= 2) {
        return `${parts[0]} / ${parts[1]}`;
      }
    } catch (e) {
      console.error("Error parsing selectedDate for headerTitle", e);
    }
    return '2026 / 04';
  }, [currentView, selectedAccountForDetail, selectedDate]);

  const accountBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    accounts.forEach(acc => {
      balances[acc.id] = 0;
    });

    records.forEach(record => {
      if (record.type === 'income') {
        balances[record.accountId] = (balances[record.accountId] || 0) + record.amount;
      } else if (record.type === 'expense') {
        balances[record.accountId] = (balances[record.accountId] || 0) - record.amount;
      } else if (record.type === 'transfer') {
        // 來源帳戶：扣除原始金額
        balances[record.accountId] = (balances[record.accountId] || 0) - record.amount;
        
        // 目標帳戶：增加換匯後的金額
        if (record.toAccountId) {
          const receivedAmount = record.toAmount ?? (record.amount * (record.exchangeRate || 1));
          balances[record.toAccountId] = (balances[record.toAccountId] || 0) + receivedAmount;
        }
      }
    });

    // Handle group totals
    accounts.forEach(acc => {
      if (acc.parentId) {
        balances[acc.parentId] = (balances[acc.parentId] || 0) + balances[acc.id];
      }
    });

    return balances;
  }, [accounts, records]);

  const { netAssets, totalAssets, totalLiabilities } = useMemo(() => {
    let assets = 0;
    let liabilities = 0;
    
    // Only count top-level accounts for net worth to avoid double counting
    accounts.filter(a => !a.parentId).forEach(acc => {
      const bal = accountBalances[acc.id] || 0;
      if (bal > 0) assets += bal;
      else liabilities += bal;
    });

    return {
      netAssets: assets + liabilities,
      totalAssets: assets,
      totalLiabilities: Math.abs(liabilities)
    };
  }, [accounts, accountBalances]);

  const stats = useMemo(() => {
    const monthStr = selectedDate.substring(0, 7);
    
    // Filter out initial balance records from statistics
    const filteredRecords = records.filter(r => r.category !== '初始資金');
    const daily = filteredRecords.filter(r => r.date === selectedDate);
    const monthly = filteredRecords.filter(r => r.date.startsWith(monthStr));
    
    return {
      daily: {
        expense: daily.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0),
        income: daily.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0),
      },
      monthly: {
        expense: monthly.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0),
        income: monthly.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0),
      }
    };
  }, [records, selectedDate]);

  const handleSaveRecord = (record: Omit<Transaction, 'id'>) => {
    const newRecord = { ...record, id: Date.now().toString() };
    setRecords([...records, newRecord]);
    setIsRecordModalOpen(false);
  };

  const handleUpdateRecord = (oldRecord: Transaction, newRecord: Transaction) => {
    setRecords(prev => prev.map(r => r.id === newRecord.id ? newRecord : r));
  };

  const handleDeleteRecord = (record: Transaction) => {
    setRecords(prev => prev.filter(r => r.id !== record.id));
  };

  const handleAddAccount = () => {
    setEditingAccount({
      id: Date.now().toString(),
      name: '',
      type: 'cash',
      icon: '💰',
      currency: 'TWD'
    });
    setIsAccountEditModalOpen(true);
  };

  const handleSaveAccount = (updatedAcc: Account, initialAmount?: number) => {
    setAccounts(prev => {
      const exists = prev.find(a => a.id === updatedAcc.id);
      if (exists) {
        return prev.map(a => a.id === updatedAcc.id ? updatedAcc : a);
      } else {
        return [...prev, updatedAcc];
      }
    });
    
    if (initialAmount !== undefined) {
      setRecords(prev => {
        const existingInit = prev.find(r => r.accountId === updatedAcc.id && r.category === '初始資金');
        if (existingInit) {
          return prev.map(r => r.id === existingInit.id ? { ...r, amount: Math.abs(initialAmount), type: initialAmount >= 0 ? 'income' : 'expense' } : r);
        } else {
          return [...prev, {
            id: `init_${updatedAcc.id}_${Date.now()}`,
            amount: Math.abs(initialAmount),
            category: '初始資金',
            date: new Date().toISOString().split('T')[0],
            type: initialAmount >= 0 ? 'income' : 'expense',
            accountId: updatedAcc.id
          }];
        }
      });
    }

    if (selectedAccountForDetail?.id === updatedAcc.id) {
      setSelectedAccountForDetail(updatedAcc);
    }
    setIsAccountEditModalOpen(false);
    setEditingAccount(null);
  };

  const handleDeleteAccount = (id: string) => {
    setAccounts(prev => prev.filter(a => a.id !== id && a.parentId !== id));
    setRecords(prev => prev.filter(r => r.accountId !== id && r.toAccountId !== id));
    setCurrentView('accounts');
    setSelectedAccountForDetail(null);
    setIsAccountEditModalOpen(false);
    setEditingAccount(null);
  };

  return (
    <div className="h-screen w-full bg-[#FFF9E3] font-sans text-[#5D4037] flex justify-center overflow-hidden select-none">
      {/* Responsive Container for Desktop */}
      <div className="w-full max-w-md h-full flex flex-col bg-[#FFF9E3] relative shadow-2xl md:border-x border-stone-100">
        {/* Header */}
        <header className="px-4 py-4 flex items-center justify-between bg-[#FFF9E3] z-30 flex-shrink-0 relative">
          {currentView === 'home' ? (
            <Menu className="w-6 h-6 text-[#5D4037] cursor-pointer" onClick={() => setIsDrawerOpen(true)} />
          ) : (
            <button 
              onClick={() => {
                if (currentView === 'accountDetail') setCurrentView('accounts');
                else setCurrentView('home');
              }}
              className="p-1 -ml-1 hover:bg-white/50 rounded-full transition-colors"
            >
              <ChevronLeft className="w-7 h-7 text-[#5D4037]" />
            </button>
          )}
          <div className="text-[24px] font-bold text-[#000000]">{headerTitle}</div>
          
          <div className="flex items-center gap-2">
            {['fixedRecords', 'categories', 'history'].includes(currentView) ? (
              <button 
                onClick={() => {
                  if (currentView === 'fixedRecords') {
                    window.dispatchEvent(new CustomEvent('trigger-add-fixed-record'));
                  } else if (currentView === 'categories') {
                    window.dispatchEvent(new CustomEvent('trigger-add-category'));
                  } else if (currentView === 'history') {
                    setIsRecordModalOpen(true);
                  }
                }}
                className="w-10 h-10 bg-[#FFD54F] rounded-2xl flex items-center justify-center shadow-md active:scale-95 transition-all"
              >
                <Plus size={24} className="text-[#5D4037]" />
              </button>
            ) : (
              <div className="relative">
                <button 
                  onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                  className="p-1 hover:bg-white/50 rounded-full transition-colors"
                >
                  <MoreVertical className="w-6 h-6 text-[#5D4037]" />
                </button>

                <AnimatePresence>
                  {isMoreMenuOpen && (
                    <>
                      <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40"
                        onClick={() => setIsMoreMenuOpen(false)}
                      />
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-stone-100 py-2 z-50 overflow-hidden"
                      >
                        <button 
                          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-stone-50 transition-colors text-[#5D4037]"
                          onClick={() => { setCurrentView('calendar'); setIsMoreMenuOpen(false); }}
                        >
                          <CalendarIcon size={18} className="text-stone-400" />
                          <span className="font-bold text-sm">日曆模式</span>
                        </button>
                        <button 
                          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-stone-50 transition-colors text-[#5D4037]"
                          onClick={() => { setIsAccountSortModalOpen(true); setIsMoreMenuOpen(false); }}
                        >
                          <span className="text-lg font-bold text-stone-400 w-[18px] flex justify-center">☰↑</span>
                          <span className="font-bold text-sm">帳戶排序</span>
                        </button>
                        <button 
                          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-stone-50 transition-colors text-[#5D4037]"
                          onClick={() => { 
                            handleAddAccount();
                            setIsMoreMenuOpen(false);
                          }}
                        >
                          <Plus size={18} className="text-stone-400" />
                          <span className="font-bold text-sm">新增帳戶</span>
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </header>

        {/* Side Drawer */}
        <AnimatePresence>
          {isDrawerOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setIsDrawerOpen(false)}
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]"
              />
              <motion.div 
                initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed inset-y-0 left-0 w-4/5 max-w-[300px] bg-white z-[70] shadow-2xl flex flex-col"
              >
                {/* Drawer Header */}
                <div className="h-40 bg-gradient-to-br from-[#FFF9E3] to-[#FFFDF5] p-6 flex flex-col justify-end gap-2 border-b border-stone-100">
                  <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-3xl">🦊</div>
                  <span className="text-xl font-black text-[#5D4037]">功能管理</span>
                </div>

                {/* Drawer Items */}
                <div className="flex-1 overflow-y-auto py-4">
                  <DrawerItem 
                    icon={<Repeat size={20} />} 
                    label="固定收支" 
                    onClick={() => { setCurrentView('fixedRecords'); setIsDrawerOpen(false); }} 
                  />
                  <DrawerItem 
                    icon={<Briefcase size={20} />} 
                    label="專案管理" 
                    onClick={() => { setCurrentView('projects'); setIsDrawerOpen(false); }} 
                  />
                  <DrawerItem 
                    icon={<PieChart size={20} />} 
                    label="預算管理" 
                    onClick={() => { setCurrentView('budget'); setIsDrawerOpen(false); }} 
                  />
                  <DrawerItem 
                    icon={<Layers size={20} />} 
                    label="分類管理" 
                    onClick={() => { setCurrentView('categories'); setIsDrawerOpen(false); }} 
                  />
                  <DrawerItem 
                    icon={<CreditCard size={20} />} 
                    label="分期付款管理" 
                    onClick={() => { setCurrentView('installments'); setIsDrawerOpen(false); }} 
                  />
                  
                  <div className="my-4 border-t border-stone-50" />
                  
                  <DrawerItem 
                    icon={<Settings2 size={20} />} 
                    label="設定" 
                    onClick={() => { setCurrentView('more'); setIsDrawerOpen(false); }} 
                  />
                </div>

                <div className="p-6 border-t border-stone-50 text-[10px] font-bold text-stone-300 text-center">
                  CWMoney Pro Clone v1.0
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main Content Area (Scrollable) */}
        <main className="flex-1 overflow-y-auto no-scrollbar min-h-0">
          <AnimatePresence mode="wait">
            {currentView === 'home' && (
              <HomeView 
                stats={stats} 
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                onRecordClick={() => setIsRecordModalOpen(true)} 
                onAccountClick={() => setCurrentView('accounts')}
                onStatClick={(type) => {
                  setHistoryFilter({ type, date: selectedDate });
                  setCurrentView('history');
                }}
              />
            )}
            {currentView === 'accounts' && (
              <AccountsView 
                accounts={accounts} 
                netAssets={netAssets}
                totalAssets={totalAssets}
                totalLiabilities={totalLiabilities}
                onAccountClick={(acc) => {
                  setEditingAccount(acc);
                  setIsAccountEditModalOpen(true);
                }}
                onAddAccount={handleAddAccount}
                balances={accountBalances}
              />
            )}
            {currentView === 'accountDetail' && selectedAccountForDetail && (
              <AccountDetailView 
                account={selectedAccountForDetail}
                records={records}
                onBack={() => setCurrentView('accounts')}
                onEdit={() => {
                  setEditingAccount(selectedAccountForDetail);
                  setIsAccountEditModalOpen(true);
                }}
                onUpdateRecord={handleUpdateRecord}
                onDeleteRecord={handleDeleteRecord}
                accounts={accounts}
                balance={accountBalances[selectedAccountForDetail.id] || 0}
              />
            )}
            {currentView === 'history' && (
              <HistoryView 
                records={records} 
                accounts={accounts} 
                filter={historyFilter}
                onBack={() => setCurrentView('home')}
                onUpdateRecord={handleUpdateRecord}
                onDeleteRecord={handleDeleteRecord}
              />
            )}
            {currentView === 'fixedRecords' && (
              <FixedRecordsView 
                fixedRecords={fixedRecords} 
                accounts={accounts}
                categories={categories}
                onBack={() => setCurrentView('home')}
                onSave={(fr) => {
                  if (fixedRecords.find(r => r.id === fr.id)) {
                    setFixedRecords(prev => prev.map(r => r.id === fr.id ? fr : r));
                  } else {
                    setFixedRecords(prev => [...prev, fr]);
                  }
                }}
                onDelete={(id) => setFixedRecords(prev => prev.filter(r => r.id !== id))}
              />
            )}
            {currentView === 'projects' && <PlaceholderView title="專案管理" icon={<Briefcase size={48} />} onBack={() => setCurrentView('home')} />}
            {currentView === 'budget' && <PlaceholderView title="預算管理" icon={<PieChart size={48} />} onBack={() => setCurrentView('home')} />}
            {currentView === 'categories' && <CategoryManagementPage categories={categories} onSave={setCategories} onBack={() => setCurrentView('home')} />}
            {currentView === 'installments' && <PlaceholderView title="分期付款管理" icon={<CreditCard size={48} />} onBack={() => setCurrentView('home')} />}
            {currentView === 'calendar' && (
              <CalendarView 
                records={records} 
                accounts={accounts}
                onBack={() => setCurrentView('home')}
              />
            )}
            {currentView === 'reports' && (
              <ReportsView records={records} />
            )}
            {currentView === 'more' && (
              <MoreView />
            )}
          </AnimatePresence>
        </main>

        {/* Bottom Nav */}
        <nav className="bg-white/90 backdrop-blur-md border-t border-stone-100 h-20 flex items-center justify-around px-4 z-40 flex-shrink-0">
          <NavButton active={currentView === 'home'} icon={<Home />} label="首頁" onClick={() => setCurrentView('home')} />
          <NavButton active={currentView === 'reports'} icon={<BarChart3 />} label="報表" onClick={() => setCurrentView('reports')} />
          <NavButton active={currentView === 'more'} icon={<MoreHorizontal />} label="更多" onClick={() => setCurrentView('more')} />
        </nav>

        {/* Record Modal */}
        <AnimatePresence>
          {isRecordModalOpen && (
            <RecordModal 
              accounts={accounts}
              categories={categories}
              templates={templates}
              onUpdateTemplates={setTemplates}
              onClose={() => setIsRecordModalOpen(false)}
              onSave={handleSaveRecord}
              selectedDate={selectedDate}
            />
          )}
        </AnimatePresence>

        {/* Account Edit Modal */}
        <AnimatePresence>
          {isAccountEditModalOpen && editingAccount && (
            <AccountEditModal 
              account={editingAccount}
              accounts={accounts}
              records={records}
              onClose={() => {
                setIsAccountEditModalOpen(false);
                setEditingAccount(null);
              }}
              onSave={handleSaveAccount}
              onDelete={handleDeleteAccount}
              onViewDetail={(acc) => {
                setSelectedAccountForDetail(acc);
                setCurrentView('accountDetail');
                setIsAccountEditModalOpen(false);
                setEditingAccount(null);
              }}
            />
          )}
        </AnimatePresence>
        {/* Account Sort Modal */}
        <AnimatePresence>
          {isAccountSortModalOpen && (
            <AccountSortModal 
              accounts={accounts}
              onClose={() => setIsAccountSortModalOpen(false)}
              onSave={(newOrder) => {
                setAccounts(newOrder);
                setIsAccountSortModalOpen(false);
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-[#5D4037]' : 'text-stone-300'}`}>
      {React.cloneElement(icon as React.ReactElement, { size: 24, strokeWidth: active ? 2.5 : 2 })}
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}

// --- Views ---

function HomeView({ stats, selectedDate, onDateChange, onRecordClick, onAccountClick, onStatClick }: { 
  stats: any, 
  selectedDate: string,
  onDateChange: (date: string) => void,
  onRecordClick: () => void, 
  onAccountClick: () => void,
  onStatClick: (type: 'day' | 'week' | 'month' | 'year') => void
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
    const start = new Date(base);
    start.setDate(base.getDate() - day);
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
      className="flex flex-col gap-6 px-4"
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

      <div className="bg-white rounded-[30px] p-6 shadow-sm border-2 border-white grid grid-cols-3 text-center">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-stone-300">本月收入</span>
          <span className="text-lg font-black text-blue-400">$ {stats.monthly.income.toLocaleString()}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-stone-300">本月支出</span>
          <span className="text-lg font-black text-rose-400">$ {stats.monthly.expense.toLocaleString()}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-stone-300">可用預算</span>
          <span className="text-lg font-black">0</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <StatCard title="本日" date={selectedDate.replace(/-/g, '/')} expense={stats.daily.expense} income={stats.daily.income} onClick={() => onStatClick('day')} />
        <StatCard title="本週" date={weekRange} expense={0} income={0} onClick={() => onStatClick('week')} />
        <StatCard title="本月" date={monthRange} expense={stats.monthly.expense} income={stats.monthly.income} onClick={() => onStatClick('month')} />
        <StatCard title="本年" date={yearRange} expense={0} income={0} onClick={() => onStatClick('year')} />
      </div>

      {/* Bottom Buffer */}
      <div className="h-[120px] w-full" />
    </motion.div>
  );
}

function StatCard({ title, date, expense, income, onClick }: { title: string, date: string, expense: number, income: number, onClick?: () => void }) {
  return (
    <motion.div 
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="bg-white rounded-[20px] p-4 shadow-sm border-2 border-white flex justify-between items-center cursor-pointer hover:bg-stone-50 transition-colors"
    >
      <div className="flex flex-col">
        <span className="text-lg font-black">{title}</span>
        <span className="text-[10px] font-bold text-stone-300">{date}</span>
      </div>
      <div className="flex flex-col items-end">
        <span className="text-sm font-bold text-rose-400">- {expense.toLocaleString()}</span>
        <span className="text-sm font-bold text-blue-400">+ {income.toLocaleString()}</span>
      </div>
    </motion.div>
  );
}

function AccountsView({ accounts, netAssets, totalAssets, totalLiabilities, onAccountClick, onAddAccount, balances }: { 
  accounts: Account[], 
  netAssets: number,
  totalAssets: number,
  totalLiabilities: number,
  onAccountClick: (acc: Account) => void,
  onAddAccount: () => void,
  balances: Record<string, number>
}) {
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [showAmounts, setShowAmounts] = useState(true);

  const toggleGroup = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedGroups(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const accountTypeLabels: Record<Account['type'], string> = {
    cash: '現金',
    bank: '銀行',
    investment: '投資',
    credit: '信用卡',
    'e-ticket': '電子票證'
  };

  const groupedAccounts = useMemo(() => {
    const groups: Partial<Record<Account['type'], Account[]>> = {};
    accounts.filter(a => !a.parentId).forEach(acc => {
      if (!groups[acc.type]) groups[acc.type] = [];
      groups[acc.type]!.push(acc);
    });
    return groups;
  }, [accounts]);

  const formatAmount = (val: number) => {
    if (!showAmounts) return '****';
    return val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="flex flex-col bg-[#FFF9E3]"
    >
      {/* Top Dashboard (CW Money Style) */}
      <div className="px-6 py-8 bg-[#FFF9E3]">
        <div className="flex justify-between items-start mb-2">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-[#5D4037]">淨資產</span>
              <button onClick={() => setShowAmounts(!showAmounts)} className="text-[#5D4037]/60 hover:text-[#5D4037]">
                {showAmounts ? <Eye size={20} /> : <EyeOff size={20} />}
              </button>
            </div>
            <div className="text-4xl font-black text-[#5D4037] tracking-tight mt-2">
              $ {formatAmount(netAssets)}
            </div>
          </div>
          <div className="flex flex-col gap-4 text-right">
            <div className="flex flex-col">
              <div className="flex items-center justify-end gap-1 text-stone-400 text-xs font-bold">
                <span>資產</span>
                <HelpCircle size={12} />
              </div>
              <span className="text-blue-400 font-black text-lg">$ {formatAmount(totalAssets)}</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center justify-end gap-1 text-stone-400 text-xs font-bold">
                <span>負債</span>
                <HelpCircle size={12} />
              </div>
              <span className="text-rose-400 font-black text-lg">$ -{formatAmount(totalLiabilities)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Account List Groups */}
      <div className="flex flex-col gap-6 px-4">
        {(Object.entries(groupedAccounts) as [Account['type'], Account[]][]).map(([type, typeAccounts]) => {
          const typeTotal = typeAccounts.reduce((sum, acc) => {
            return sum + (balances[acc.id] || 0);
          }, 0);

          return (
            <div key={type} className="bg-white rounded-[30px] shadow-sm border-2 border-white overflow-hidden">
              {/* Group Header */}
              <div className="px-6 py-4 flex justify-between items-center border-b border-stone-50">
                <span className="text-sm font-bold text-stone-400">{accountTypeLabels[type as Account['type']]}</span>
                <span className={`text-sm font-black ${typeTotal < 0 ? 'text-rose-400' : 'text-stone-400'}`}>
                  $ {formatAmount(typeTotal)}
                </span>
              </div>

              {/* Account Cards */}
              <div className="flex flex-col">
                {typeAccounts.map(acc => {
                  const children = accounts.filter(c => c.parentId === acc.id);
                  const isExpanded = expandedGroups.includes(acc.id);
                  const hasChildren = children.length > 0;
                  const displayAmount = balances[acc.id] || 0;

                  return (
                    <div key={acc.id} className="flex flex-col border-b border-stone-50 last:border-0">
                      <div 
                        onClick={() => onAccountClick(acc)}
                        className="p-6 flex items-center justify-between cursor-pointer active:bg-stone-50 transition-colors"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-12 h-12 bg-[#FFFDF5] rounded-2xl flex-shrink-0 flex items-center justify-center text-2xl shadow-sm border border-white">
                            {acc.icon}
                          </div>
                          <div className="flex flex-col justify-center">
                            <span className="font-bold text-[#5D4037] text-lg leading-tight">{acc.name}</span>
                            <span className={`text-xl font-black mt-1 ${displayAmount < 0 ? 'text-rose-400' : 'text-[#5D4037]'}`}>
                              $ {formatAmount(displayAmount)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {hasChildren && (
                            <button 
                              onClick={(e) => toggleGroup(acc.id, e)}
                              className="p-1 hover:bg-black/5 rounded-full transition-colors"
                            >
                              <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
                                <ChevronDown className="w-6 h-6 text-stone-300" />
                              </motion.div>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Sub Accounts */}
                      <AnimatePresence>
                        {hasChildren && isExpanded && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-stone-50/50 flex flex-col gap-2 px-6 pb-4"
                          >
                            {children.map(child => (
                              <div 
                                key={child.id}
                                onClick={() => onAccountClick(child)}
                                className="p-4 bg-white rounded-2xl border border-white shadow-sm flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform"
                              >
                                <div className="flex items-center gap-3 flex-1">
                                  <div className="w-8 h-8 bg-white rounded-full flex-shrink-0 flex items-center justify-center text-base shadow-inner">{child.icon}</div>
                                  <div className="flex flex-col">
                                    <span className="text-xs font-bold text-[#5D4037] leading-tight">{child.name}</span>
                                    <span className={`text-sm font-black mt-0.5 ${balances[child.id] < 0 ? 'text-rose-400' : 'text-[#5D4037]'}`}>
                                      $ {formatAmount(balances[child.id] || 0)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                            <button 
                              onClick={() => onAccountClick(acc)}
                              className="text-[10px] font-bold text-stone-300 text-center py-2 hover:text-[#5D4037] transition-colors"
                            >
                              查看/編輯主帳戶詳情
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Buffer */}
      <div className="h-[120px] w-full" />
    </motion.div>
  );
}

function AccountDetailView({ account, records, onBack, onEdit, onUpdateRecord, onDeleteRecord, accounts, balance }: { 
  account: Account, 
  records: Transaction[],
  onBack: () => void,
  onEdit: () => void,
  onUpdateRecord: (old: Transaction, updated: Transaction) => void,
  onDeleteRecord: (record: Transaction) => void,
  accounts: Account[],
  balance: number
}) {
  const [editingRecord, setEditingRecord] = useState<Transaction | null>(null);
  
  const accountRecords = useMemo(() => {
    const childrenIds = accounts.filter(c => c.parentId === account.id).map(c => c.id);
    const targetIds = [account.id, ...childrenIds];
    
    // Filter out initial balance records from the detail list
    return records.filter(r => (targetIds.includes(r.accountId) || (r.toAccountId && targetIds.includes(r.toAccountId))) && r.category !== '初始資金')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [records, account.id, accounts]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full bg-[#FFF9E3]"
    >
      {/* Balance Section */}
      <div className="px-4 py-6">
        <div className="bg-white p-8 rounded-[40px] shadow-sm border-2 border-white flex justify-between items-center relative overflow-hidden">
          <div className="flex flex-col gap-2 z-10">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-stone-50 rounded-lg flex items-center justify-center text-xs border border-white">
                {account.icon}
              </div>
              <span className="text-xs font-bold text-stone-300 uppercase tracking-[0.2em]">目前餘額</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-black text-stone-300">$</span>
              <span className="text-4xl font-black text-[#5D4037] tracking-tight">
                {balance.toLocaleString()}
              </span>
            </div>
          </div>
          <button 
            onClick={onEdit}
            className="w-14 h-14 bg-[#FFD54F] rounded-full flex items-center justify-center shadow-lg border-4 border-white active:scale-90 transition-all z-10"
          >
            <Pencil size={24} className="text-[#5D4037]" />
          </button>
          
          {/* Decorative background element */}
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-[#FFD54F]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-4 -top-4 w-24 h-24 bg-[#5D4037]/5 rounded-full blur-2xl pointer-events-none" />
        </div>
      </div>

      {/* Transaction History Section */}
      <div className="flex-1 px-4 flex flex-col gap-4 mt-2">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#5D4037] rounded-lg flex items-center justify-center">
              <History size={14} className="text-white" />
            </div>
            <span className="font-black text-base text-[#5D4037]">往來明細</span>
          </div>
          <span className="text-[10px] font-bold text-stone-300 bg-white px-3 py-1 rounded-full border border-stone-100">
            {accountRecords.length} 筆紀錄
          </span>
        </div>

        <div className="flex-1 bg-white/80 backdrop-blur-sm rounded-[40px] shadow-sm border-2 border-white overflow-hidden flex flex-col">
          {accountRecords.length > 0 ? (
            <div className="overflow-y-auto p-6 space-y-4 no-scrollbar">
              {accountRecords.map(record => (
                <div 
                  key={record.id} 
                  onClick={() => setEditingRecord(record)}
                  className="flex items-center gap-4 py-4 border-b border-stone-50 last:border-0 group cursor-pointer hover:bg-stone-50/50 rounded-xl px-2 -mx-2 transition-colors"
                >
                  <div className="w-14 h-14 bg-[#FFFDF5] rounded-2xl flex-shrink-0 flex items-center justify-center text-2xl shadow-sm border border-white group-active:scale-95 transition-transform">
                    {record.category === '初始資金' ? '💎' : record.category === '餘額校正' ? '🔧' : record.type === 'income' ? '💰' : record.type === 'expense' ? '🍱' : '🔄'}
                  </div>
                  
                  <div className="flex-1 flex flex-col gap-1 min-w-0">
                    {/* Line 1: Title */}
                    <span className="font-black text-lg text-[#5D4037] truncate leading-tight">
                      {record.note || record.category}
                    </span>
                    
                    {/* Line 2: Date & Account Info */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-stone-300">{record.date}</span>
                      {account.parentId === undefined && record.accountId !== account.id && (
                        <span className="text-[10px] px-2 py-0.5 bg-stone-100 text-stone-400 rounded-full font-bold">
                          {accounts.find(a => a.id === record.accountId)?.name}
                        </span>
                      )}
                    </div>
                    
                    {/* Line 3: Amount */}
                    <div className="flex items-center justify-between mt-1">
                      <span className={`font-black text-xl ${record.type === 'income' ? 'text-blue-400' : record.type === 'expense' ? 'text-rose-400' : 'text-stone-400'}`}>
                         $ {record.amount.toLocaleString()}
                      </span>
                      {record.type === 'transfer' && (
                        <span className="text-[10px] font-black text-stone-300 bg-stone-50 px-2 py-0.5 rounded-lg border border-stone-100">
                          {record.accountId === account.id ? '轉出' : '轉入'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {/* Bottom Buffer inside scroll area */}
              <div className="h-[40px] w-full" />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 text-stone-200">
              <div className="w-24 h-24 bg-[#FFFDF5] rounded-full flex items-center justify-center border-4 border-white shadow-inner">
                <AlertCircle size={48} />
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="font-black text-lg text-stone-300">尚無明細紀錄</span>
                <span className="text-xs font-bold text-stone-200">開始記帳來追蹤您的資產吧！</span>
              </div>
            </div>
          )}
        </div>
        
        {/* Bottom Buffer outside scroll area if needed */}
        <div className="h-[40px] w-full" />
      </div>

      {/* Edit Record Modal */}
      <AnimatePresence>
        {editingRecord && (
          <EditRecordModal 
            record={editingRecord}
            accounts={accounts}
            onClose={() => setEditingRecord(null)}
            onSave={(updated) => {
              onUpdateRecord(editingRecord, updated);
              setEditingRecord(null);
            }}
            onDelete={() => {
              onDeleteRecord(editingRecord);
              setEditingRecord(null);
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function EditRecordModal({ record, accounts, onClose, onSave, onDelete }: {
  record: Transaction,
  accounts: Account[],
  onClose: () => void,
  onSave: (updated: Transaction) => void,
  onDelete: () => void
}) {
  const [edited, setEdited] = useState<Transaction>({ ...record });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[80] flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="bg-[#FFFDF5] w-full max-w-sm rounded-[30px] flex flex-col shadow-2xl relative overflow-hidden max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Delete Confirmation Overlay */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="absolute inset-0 bg-rose-500 z-[90] flex flex-col items-center justify-center p-8 text-white text-center gap-6"
            >
              <Trash2 size={64} className="mb-2" />
              <h4 className="text-2xl font-black">確定要刪除嗎？</h4>
              <p className="text-sm font-bold opacity-80 text-rose-100">刪除後將無法復原，帳戶餘額會自動更新。</p>
              <div className="flex w-full gap-3 mt-4">
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-4 bg-white/20 rounded-2xl font-bold hover:bg-white/30 transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={onDelete}
                  className="flex-1 py-4 bg-white text-rose-500 rounded-2xl font-black shadow-lg active:scale-95 transition-all"
                >
                  確定刪除
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-6 pb-2 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
              <ChevronLeft className="w-6 h-6 text-[#5D4037]" />
            </button>
            <h3 className="text-xl font-black text-[#5D4037]">編輯紀錄</h3>
          </div>
          <button 
            onClick={() => setShowDeleteConfirm(true)}
            className="p-3 text-rose-400 hover:bg-rose-50 rounded-2xl transition-colors active:scale-90"
          >
            <Trash2 size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-4 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">金額</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-stone-300 text-lg">$</span>
                <input 
                  type="number"
                  value={edited.amount}
                  onChange={e => setEdited({ ...edited, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full p-4 pl-10 bg-white border-2 border-stone-50 rounded-2xl font-black text-2xl text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">分類</label>
              <input 
                value={edited.category}
                onChange={e => setEdited({ ...edited, category: e.target.value })}
                className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[18px] font-bold text-[#000000] uppercase tracking-widest px-1">備註 (買了什麼？)</label>
              <input 
                value={edited.note || ''}
                onChange={e => setEdited({ ...edited, note: e.target.value })}
                className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#000000] text-[18px] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
                placeholder="買了什麼？"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">日期</label>
              <input 
                type="date"
                value={edited.date}
                onChange={e => setEdited({ ...edited, date: e.target.value })}
                className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">帳戶</label>
              <select 
                value={edited.accountId}
                onChange={e => setEdited({ ...edited, accountId: e.target.value })}
                className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm appearance-none focus:border-[#FFD54F] transition-all"
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            {edited.type === 'transfer' && (
              <>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">轉入帳戶</label>
                  <select 
                    value={edited.toAccountId || ''}
                    onChange={e => setEdited({ ...edited, toAccountId: e.target.value })}
                    className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm appearance-none focus:border-[#FFD54F] transition-all"
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">匯率</label>
                    <input 
                      type="number"
                      value={edited.exchangeRate || 1}
                      onChange={e => setEdited({ ...edited, exchangeRate: parseFloat(e.target.value) || 1 })}
                      className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">實收金額</label>
                    <input 
                      type="number"
                      value={edited.toAmount || edited.amount * (edited.exchangeRate || 1)}
                      onChange={e => setEdited({ ...edited, toAmount: parseFloat(e.target.value) || 0 })}
                      className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <button 
              onClick={() => onSave(edited)}
              className="w-full py-5 bg-[#5D4037] text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"
            >
              <Check size={24} /> 儲存變更
            </button>
          </div>
          
          {/* Bottom Spacing */}
          <div className="h-[40px]" />
        </div>
      </motion.div>
    </motion.div>
  );
}

function AccountEditModal({ account, accounts, records, onClose, onSave, onDelete, onViewDetail }: { 
  account: Account, 
  accounts: Account[],
  records: Transaction[],
  onClose: () => void, 
  onSave: (acc: Account, initialAmount: number) => void,
  onDelete: (id: string) => void,
  onViewDetail?: (acc: Account) => void
}) {
  const isNew = !accounts.find(a => a.id === account.id);
  const [editedAcc, setEditedAcc] = useState<Account>({ ...account });
  const [initialAmount, setInitialAmount] = useState(() => {
    const initRec = records.find(r => r.accountId === account.id && r.category === '初始資金');
    if (!initRec) return 0;
    return initRec.type === 'income' ? initRec.amount : -initRec.amount;
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const accountTypes: Account['type'][] = ['cash', 'bank', 'investment', 'credit', 'e-ticket'];

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#5D4037]/40 backdrop-blur-md z-[70] flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="bg-[#FFFDF5] w-full max-w-sm rounded-[40px] flex flex-col shadow-2xl border-2 border-white overflow-hidden max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-8 pb-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
              <ChevronLeft className="w-6 h-6 text-[#5D4037]" />
            </button>
            <h3 className="text-xl font-black text-[#5D4037]">{isNew ? '新增帳戶' : '編輯帳戶'}</h3>
          </div>
          <div className="w-10 h-10 bg-[#FFD54F] rounded-2xl flex items-center justify-center shadow-sm">
            {isNew ? <Plus size={20} className="text-[#5D4037]" /> : <Edit3 size={20} className="text-[#5D4037]" />}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-8 py-2 space-y-6">
          <div className="space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">帳戶名稱</label>
              <input 
                value={editedAcc.name}
                onChange={e => setEditedAcc({ ...editedAcc, name: e.target.value })}
                className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
                placeholder="例如：台新銀行 - 活存"
              />
            </div>

            {/* Initial Amount */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">初始金額</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-stone-300 text-lg">$</span>
                <input 
                  type="number"
                  disabled={!isNew}
                  value={initialAmount}
                  onChange={e => setInitialAmount(parseFloat(e.target.value) || 0)}
                  className={`w-full p-4 pl-10 bg-white border-2 border-stone-50 rounded-2xl font-black text-xl text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all ${!isNew ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
              </div>
              {!isNew && <p className="text-[10px] font-bold text-stone-300 px-1">現有帳戶不可修改初始金額</p>}
            </div>

            {/* Type Selection */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">帳戶類型</label>
              <div className="flex flex-wrap gap-2">
                {accountTypes.map(t => (
                  <button 
                    key={t}
                    onClick={() => setEditedAcc({ ...editedAcc, type: t })}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black border-2 transition-all ${editedAcc.type === t ? 'bg-[#5D4037] text-white border-[#5D4037] shadow-md' : 'bg-white text-stone-400 border-stone-50 shadow-sm'}`}
                  >
                    {t === 'cash' ? '現金' : t === 'bank' ? '銀行' : t === 'investment' ? '投資' : t === 'credit' ? '信用卡' : '電子票證'}
                  </button>
                ))}
              </div>
            </div>

            {/* Currency Selection */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">帳戶幣別</label>
              <div className="flex flex-wrap gap-2">
                {['TWD', 'USD', 'JPY', 'EUR', 'CNY'].map(curr => (
                  <button 
                    key={curr}
                    onClick={() => setEditedAcc({ ...editedAcc, currency: curr })}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black border-2 transition-all ${editedAcc.currency === curr ? 'bg-[#5D4037] text-white border-[#5D4037] shadow-md' : 'bg-white text-stone-400 border-stone-50 shadow-sm'}`}
                  >
                    {curr}
                  </button>
                ))}
              </div>
            </div>

            {/* Icon Selection */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">選擇圖示</label>
              <HorizontalScrollArea>
                {['💰', '🏦', '💳', '📔', '💵', '🪙', '📱', '🐷', '📈', '🏠', '🚗', '💼', '💎', '🛒', '🍱', '✈️', '🎮', '🎁'].map(icon => (
                  <button 
                    key={icon}
                    onClick={() => setEditedAcc({ ...editedAcc, icon })}
                    className={`flex-shrink-0 w-12 h-12 rounded-xl border-2 transition-all flex items-center justify-center text-xl ${editedAcc.icon === icon ? 'bg-[#FFD54F] border-[#FFD54F] shadow-md scale-110' : 'bg-white border-stone-50 shadow-sm'}`}
                  >
                    {icon}
                  </button>
                ))}
              </HorizontalScrollArea>
            </div>

            {/* Parent Selection */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">所屬主帳戶</label>
              <div className="relative">
                <select 
                  value={editedAcc.parentId || ''}
                  onChange={e => setEditedAcc({ ...editedAcc, parentId: e.target.value || undefined })}
                  className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl text-sm font-bold text-[#5D4037] outline-none shadow-sm appearance-none focus:border-[#FFD54F] transition-all"
                >
                  <option value="">無 (作為主帳戶)</option>
                  {accounts.filter(a => !a.parentId && a.id !== editedAcc.id).map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-300 pointer-events-none" />
              </div>
            </div>

            {/* Credit Card Closing Day */}
            {(editedAcc.type === 'credit' || editedAcc.name.includes('卡')) && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">信用卡結帳日</label>
                <div className="relative">
                  <input 
                    type="number"
                    min="1"
                    max="31"
                    value={editedAcc.closingDay || ''}
                    onChange={e => {
                      const val = parseInt(e.target.value);
                      setEditedAcc({ ...editedAcc, closingDay: isNaN(val) ? undefined : Math.min(31, Math.max(1, val)) });
                    }}
                    className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
                    placeholder="輸入日期 (1-31)"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-stone-300">日</span>
                </div>
                <p className="text-[10px] font-bold text-stone-300 px-1">設定結帳日以利後續計算帳單週期</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 pt-4">
            <div className="flex gap-3">
              <button 
                onClick={onClose}
                className="flex-1 py-4 bg-stone-100 text-stone-400 rounded-2xl font-black text-lg active:scale-95 transition-all"
              >
                取消
              </button>
              <button 
                onClick={() => onSave(editedAcc, initialAmount)}
                className="flex-[2] py-4 bg-[#5D4037] text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"
              >
                <Check size={24} /> 儲存
              </button>
            </div>
            
            {!isNew && (
              <div className="flex gap-3">
                {onViewDetail && (
                  <button 
                    onClick={() => onViewDetail(editedAcc)}
                    className="flex-1 py-3 bg-white border-2 border-stone-50 text-[#5D4037] rounded-xl font-bold text-sm active:scale-95 transition-all"
                  >
                    查看明細
                  </button>
                )}
                <button 
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex-1 py-3 bg-rose-50 text-rose-400 rounded-xl font-bold text-sm active:scale-95 transition-all"
                >
                  刪除帳戶
                </button>
              </div>
            )}
          </div>
          
          {/* Bottom Spacing */}
          <div className="h-[40px]" />
        </div>

        {/* Delete Confirmation Overlay */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#5D4037]/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="w-20 h-20 bg-rose-400 rounded-full flex items-center justify-center mb-6 shadow-lg">
                <Trash2 size={40} className="text-white" />
              </div>
              <h4 className="text-xl font-black text-white mb-2">確定要刪除嗎？</h4>
              <p className="text-white/60 text-sm mb-8 font-bold">刪除帳戶將會連同所有相關的明細紀錄一併移除，且無法復原。</p>
              <div className="flex flex-col w-full gap-3">
                <button 
                  onClick={() => onDelete(editedAcc.id)}
                  className="w-full py-4 bg-rose-400 text-white rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all"
                >
                  確定刪除
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full py-4 bg-white/10 text-white rounded-2xl font-black text-lg active:scale-95 transition-all"
                >
                  我再想想
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

function CalendarView({ records, accounts, onBack }: { records: Transaction[], accounts: Account[], onBack: () => void }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewDate, setViewDate] = useState(new Date()); // Current month being viewed
  
  const filteredRecords = useMemo(() => records.filter(r => r.category !== '初始資金'), [records]);
  const dayRecords = useMemo(() => filteredRecords.filter(r => r.date === selectedDate), [filteredRecords, selectedDate]);
  
  const dayStats = useMemo(() => {
    return {
      income: dayRecords.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0),
      expense: dayRecords.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0)
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

      <div className="flex justify-around py-3 border-b border-stone-100 text-[10px] font-bold bg-white">
        <div className="flex flex-col items-center"><span className="text-stone-300">收入</span><span className="text-blue-400">+{dayStats.income.toLocaleString()}</span></div>
        <div className="flex flex-col items-center"><span className="text-stone-300">支出</span><span className="text-rose-400">-{dayStats.expense.toLocaleString()}</span></div>
        <div className="flex flex-col items-center"><span className="text-stone-300">結餘</span><span className="text-[#5D4037]">{(dayStats.income - dayStats.expense).toLocaleString()}</span></div>
      </div>

      <div className="p-4 space-y-4 flex-1 overflow-y-auto no-scrollbar">
        <div className="flex justify-between items-center px-2">
          <span className="font-black text-[#5D4037]">{selectedDate.replace(/-/g, '/')} 明細</span>
          <span className="text-[10px] font-bold text-stone-300 bg-white px-3 py-1 rounded-full border border-stone-100">
            共 {dayRecords.length} 筆
          </span>
        </div>
        
        {dayRecords.length > 0 ? dayRecords.map(record => (
          <div 
            key={record.id} 
            className="flex items-center gap-4 py-4 border-b border-stone-50 last:border-0 group cursor-pointer hover:bg-stone-50/50 rounded-xl px-2 -mx-2 transition-colors"
          >
            <div className="w-14 h-14 bg-[#FFFDF5] rounded-2xl flex-shrink-0 flex items-center justify-center text-2xl shadow-sm border border-white">
              {record.category === '初始資金' ? '💎' : record.type === 'income' ? '💰' : record.type === 'expense' ? '🍱' : '🔄'}
            </div>
            
            <div className="flex-1 flex flex-col gap-1 min-w-0">
              {/* Line 1: Title */}
              <span className="font-black text-lg text-[#5D4037] truncate leading-tight">
                {record.note || record.category}
              </span>
              
              {/* Line 2: Account Info */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2 py-0.5 bg-stone-100 text-stone-400 rounded-full font-bold">
                  {accounts.find(a => a.id === record.accountId)?.name}
                </span>
              </div>
              
              {/* Line 3: Amount */}
              <div className="flex items-center justify-between mt-1">
                <span className={`font-black text-xl ${record.type === 'income' ? 'text-blue-400' : record.type === 'expense' ? 'text-rose-400' : 'text-stone-400'}`}>
                  {record.type === 'income' ? '+' : record.type === 'expense' ? '-' : ''} $ {record.amount.toLocaleString()}
                </span>
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

function DrawerItem({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="w-full px-6 py-4 flex items-center gap-4 hover:bg-stone-50 transition-colors text-[#5D4037] group"
    >
      <div className="text-stone-300 group-hover:text-[#FFD54F] transition-colors">{icon}</div>
      <span className="font-bold text-sm">{label}</span>
    </button>
  );
}

function FixedRecordsView({ fixedRecords, accounts, categories, onBack, onSave, onDelete }: { 
  fixedRecords: FixedRecord[], 
  accounts: Account[], 
  categories: Category[],
  onBack: () => void,
  onSave: (fr: FixedRecord) => void,
  onDelete: (id: string) => void
}) {
  const [editingRecord, setEditingRecord] = useState<FixedRecord | null>(null);

  useEffect(() => {
    const handleAdd = () => {
      setEditingRecord({
        id: Math.random().toString(36).substr(2, 9),
        name: '',
        amount: 0,
        type: 'expense',
        period: 'monthly',
        day: 1,
        accountId: accounts[0].id,
        category: '其他',
        autoEntry: true
      });
    };
    window.addEventListener('trigger-add-fixed-record', handleAdd);
    return () => window.removeEventListener('trigger-add-fixed-record', handleAdd);
  }, [accounts]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full bg-[#FFF9E3]"
    >
      <div className="flex-1 px-4 py-6 overflow-y-auto no-scrollbar pb-10">
        <div className="bg-white/80 backdrop-blur-sm rounded-[40px] shadow-sm border-2 border-white p-6 space-y-4">
          {fixedRecords.length > 0 ? fixedRecords.map(record => (
            <div 
              key={record.id} 
              onClick={() => setEditingRecord(record)}
              className="flex items-center gap-4 py-4 border-b border-stone-50 last:border-0 group cursor-pointer hover:bg-stone-50/50 rounded-xl px-2 -mx-2 transition-colors"
            >
              <div className="w-14 h-14 bg-[#FFFDF5] rounded-2xl flex-shrink-0 flex items-center justify-center text-2xl shadow-sm border border-white">
                {record.type === 'income' ? '💰' : '🍱'}
              </div>
              
              <div className="flex-1 flex flex-col gap-1 min-w-0">
                <span className="font-black text-lg text-[#5D4037] truncate leading-tight">
                  {record.name}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 bg-stone-100 text-stone-400 rounded-full font-bold uppercase">
                    {record.period === 'monthly' ? `每月 ${record.day} 號` : record.period === 'weekly' ? `每週 ${['日','一','二','三','四','五','六'][record.day]}` : '每年'}
                  </span>
                  {record.autoEntry && (
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-500 rounded-full font-bold">自動入帳</span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className={`font-black text-xl ${record.type === 'income' ? 'text-blue-400' : 'text-rose-400'}`}>
                    {record.type === 'income' ? '+' : '-'} $ {record.amount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )) : (
            <div className="flex flex-col items-center justify-center py-20 text-stone-300 gap-4">
              <Repeat size={48} />
              <span className="font-bold">尚無固定收支</span>
              <p className="text-xs">點擊右上角「＋」新增</p>
            </div>
          )}
        </div>
        <div className="h-[40px]" />
      </div>

      <AnimatePresence>
        {editingRecord && (
          <FixedRecordEditModal 
            record={editingRecord}
            accounts={accounts}
            categories={categories}
            onClose={() => setEditingRecord(null)}
            onSave={(updated) => {
              onSave(updated);
              setEditingRecord(null);
            }}
            onDelete={() => {
              onDelete(editingRecord.id);
              setEditingRecord(null);
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function FixedRecordEditModal({ record, accounts, categories, onClose, onSave, onDelete }: { 
  record: FixedRecord, 
  accounts: Account[], 
  categories: Category[],
  onClose: () => void, 
  onSave: (fr: FixedRecord) => void,
  onDelete: () => void
}) {
  const [edited, setEdited] = useState<FixedRecord>({ ...record });

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/30 backdrop-blur-md z-[80] flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        className="bg-[#FFFDF5] w-full max-w-md rounded-t-[40px] p-6 flex flex-col gap-4 max-h-[90vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6 text-[#5D4037]" />
          </button>
          <span className="text-lg font-bold text-[#5D4037]">設定固定收支</span>
          <button onClick={onDelete} className="p-2 text-rose-400 hover:bg-rose-50 rounded-full transition-colors">
            <Trash2 size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 px-1">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-300 uppercase">名稱</label>
                <input 
                  value={edited.name}
                  onChange={e => setEdited({ ...edited, name: e.target.value })}
                  className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                  placeholder="如：房租"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-300 uppercase">金額</label>
                <input 
                  type="number"
                  value={edited.amount}
                  onChange={e => setEdited({ ...edited, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-stone-300 uppercase">類型</label>
              <div className="flex gap-2">
                {['expense', 'income'].map(t => (
                  <button 
                    key={t}
                    onClick={() => setEdited({ ...edited, type: t as any })}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm border-2 transition-all ${edited.type === t ? 'bg-[#5D4037] text-white border-[#5D4037]' : 'bg-white text-stone-400 border-white'}`}
                  >
                    {t === 'expense' ? '支出' : '收入'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-stone-300 uppercase">週期</label>
              <div className="flex gap-2">
                {['monthly', 'weekly', 'yearly'].map(p => (
                  <button 
                    key={p}
                    onClick={() => setEdited({ ...edited, period: p as any })}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm border-2 transition-all ${edited.period === p ? 'bg-[#5D4037] text-white border-[#5D4037]' : 'bg-white text-stone-400 border-white'}`}
                  >
                    {p === 'monthly' ? '每月' : p === 'weekly' ? '每週' : '每年'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-stone-300 uppercase">
                {edited.period === 'monthly' ? '扣款日 (幾號)' : edited.period === 'weekly' ? '扣款日 (星期幾)' : '扣款日'}
              </label>
              {edited.period === 'weekly' ? (
                <div className="grid grid-cols-7 gap-1">
                  {['日','一','二','三','四','五','六'].map((d, i) => (
                    <button 
                      key={i}
                      onClick={() => setEdited({ ...edited, day: i })}
                      className={`h-10 rounded-lg font-bold text-xs border-2 transition-all ${edited.day === i ? 'bg-[#FFD54F] border-[#FFD54F]' : 'bg-white border-white text-stone-400'}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              ) : (
                <input 
                  type="number"
                  min="1" max="31"
                  value={edited.day}
                  onChange={e => setEdited({ ...edited, day: parseInt(e.target.value) || 1 })}
                  className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                />
              )}
            </div>

            <div className="space-y-2">
              <label className="text-[18px] font-bold text-[#000000] uppercase">扣款帳戶</label>
              <HorizontalScrollArea className="px-8">
                {accounts.map(acc => (
                  <button 
                    key={acc.id}
                    onClick={() => setEdited({ ...edited, accountId: acc.id })}
                    className={`flex-shrink-0 w-20 h-24 rounded-[20px] flex flex-col items-center justify-center gap-2 border-2 transition-all ${
                      edited.accountId === acc.id ? 'bg-[#FFD54F] border-[#FFD54F] shadow-md' : 'bg-white border-white shadow-sm'
                    }`}
                  >
                    <div className="w-10 h-10 bg-white/50 rounded-full flex items-center justify-center text-xl">{acc.icon}</div>
                    <span className="text-[18px] font-bold text-[#000000] text-center px-1 leading-tight">{acc.name}</span>
                  </button>
                ))}
              </HorizontalScrollArea>
            </div>

            <div className="space-y-2">
              <label className="text-[18px] font-bold text-[#000000] uppercase">選擇分類</label>
              <HorizontalScrollArea className="px-8">
                {categories.map(cat => (
                  <button 
                    key={cat.id}
                    onClick={() => setEdited({ ...edited, category: cat.name })}
                    className={`flex-shrink-0 w-20 h-24 rounded-[20px] flex flex-col items-center justify-center gap-2 border-2 transition-all ${
                      edited.category.split(' > ')[0] === cat.name ? 'bg-[#5D4037] text-white border-[#5D4037] shadow-md' : 'bg-white text-stone-400 border-white shadow-sm'
                    }`}
                  >
                    <div className={`w-10 h-10 ${edited.category.split(' > ')[0] === cat.name ? 'bg-white/20' : 'bg-stone-50'} rounded-full flex items-center justify-center text-xl`}>{cat.icon}</div>
                    <span className="text-[18px] font-bold text-[#000000] text-center px-1 leading-tight">{cat.name}</span>
                  </button>
                ))}
              </HorizontalScrollArea>
              
              {/* Sub Category Selection */}
              {categories.find(c => c.name === edited.category.split(' > ')[0]) && (
                <div className="mt-2">
                  <HorizontalScrollArea className="px-8">
                    {categories.find(c => c.name === edited.category.split(' > ')[0])?.sub.map(sub => (
                      <button 
                        key={sub}
                        onClick={() => setEdited({ ...edited, category: `${edited.category.split(' > ')[0]} > ${sub}` })}
                        className={`flex-shrink-0 px-6 h-12 rounded-full font-bold border-2 transition-all text-[18px] text-[#000000] ${
                          edited.category.includes(sub) ? 'bg-[#FFD54F] border-[#FFD54F] shadow-md' : 'bg-white border-white shadow-sm text-[#000000]'
                        }`}
                      >
                        {sub}
                      </button>
                    ))}
                  </HorizontalScrollArea>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-4 bg-white rounded-2xl border-2 border-stone-50 shadow-sm">
              <div className="flex flex-col">
                <span className="font-bold text-sm">自動入帳</span>
                <span className="text-[10px] text-stone-300">日期到了自動新增一筆明細</span>
              </div>
              <button 
                onClick={() => setEdited({ ...edited, autoEntry: !edited.autoEntry })}
                className={`w-12 h-6 rounded-full transition-all relative ${edited.autoEntry ? 'bg-emerald-400' : 'bg-stone-200'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${edited.autoEntry ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
          </div>

          <button 
            onClick={() => onSave(edited)}
            className="w-full py-5 bg-[#5D4037] text-white rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Check size={20} /> 儲存設定
          </button>

          <div className="h-[40px]" />
        </div>
      </motion.div>
    </motion.div>
  );
}

function AccountSortModal({ accounts, onClose, onSave }: { 
  accounts: Account[], 
  onClose: () => void, 
  onSave: (newOrder: Account[]) => void 
}) {
  const [sortedAccounts, setSortedAccounts] = useState([...accounts]);

  const moveAccount = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...sortedAccounts];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;
    setSortedAccounts(newOrder);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#5D4037]/40 backdrop-blur-md z-[80] flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="bg-[#FFFDF5] w-full max-w-sm rounded-[40px] flex flex-col shadow-2xl border-2 border-white overflow-hidden max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-8 pb-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
              <ChevronLeft className="w-6 h-6 text-[#5D4037]" />
            </button>
            <h3 className="text-xl font-black text-[#5D4037]">帳戶排序</h3>
          </div>
          <div className="w-10 h-10 bg-[#FFD54F] rounded-2xl flex items-center justify-center shadow-sm">
            <span className="text-lg font-bold text-[#5D4037]">☰↑</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-2 space-y-2">
          {sortedAccounts.map((acc, index) => (
            <div 
              key={acc.id}
              className={`flex items-center gap-3 p-4 bg-white rounded-2xl border-2 border-stone-50 shadow-sm transition-all ${acc.parentId ? 'ml-6 scale-95 opacity-80' : ''}`}
            >
              <div className="w-10 h-10 bg-[#FFFDF5] rounded-xl flex items-center justify-center text-xl border border-stone-50">
                {acc.icon}
              </div>
              <div className="flex-1 flex flex-col">
                <span className="font-black text-[#5D4037] text-sm truncate">{acc.name}</span>
                <span className="text-[10px] font-bold text-stone-300 uppercase tracking-widest">{acc.currency}</span>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  disabled={index === 0}
                  onClick={() => moveAccount(index, 'up')}
                  className="p-2 hover:bg-stone-100 rounded-lg text-stone-300 disabled:opacity-20 transition-all"
                >
                  <ChevronUp size={20} />
                </button>
                <button 
                  disabled={index === sortedAccounts.length - 1}
                  onClick={() => moveAccount(index, 'down')}
                  className="p-2 hover:bg-stone-100 rounded-lg text-stone-300 disabled:opacity-20 transition-all"
                >
                  <ChevronDown size={20} />
                </button>
              </div>
            </div>
          ))}
          <div className="h-[40px]" />
        </div>

        <div className="p-8 pt-4 flex-shrink-0">
          <button 
            onClick={() => onSave(sortedAccounts)}
            className="w-full py-5 bg-[#5D4037] text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"
          >
            <Check size={24} /> 完成排序
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CategoryManagementPage({ categories, onSave, onBack }: { 
  categories: Category[], 
  onSave: (cats: Category[]) => void,
  onBack: () => void 
}) {
  const [tab, setTab] = useState<'expense' | 'income'>('expense');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [newCat, setNewCat] = useState<Partial<Category>>({ name: '', icon: '✨', type: 'expense', sub: [] });
  
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [newSubIcon, setNewSubIcon] = useState('⭐');

  const filtered = categories.filter(c => c.type === tab);

  useEffect(() => {
    const handleAdd = () => {
      setNewCat({ name: '', icon: '✨', type: tab, sub: [] });
      setEditingCat(null);
      setIsAddModalOpen(true);
    };
    window.addEventListener('trigger-add-category', handleAdd);
    return () => window.removeEventListener('trigger-add-category', handleAdd);
  }, [tab]);

  const handleSave = () => {
    if (!newCat.name) return;
    const catToSave = {
      id: editingCat?.id || Math.random().toString(36).substr(2, 9),
      name: newCat.name,
      icon: newCat.icon || '✨',
      type: tab,
      sub: newCat.sub || []
    } as Category;

    if (editingCat) {
      onSave(categories.map(c => c.id === editingCat.id ? catToSave : c));
    } else {
      onSave([...categories, catToSave]);
    }
    setIsAddModalOpen(false);
    setEditingCat(null);
    setNewCat({ name: '', icon: '✨', type: 'expense', sub: [] });
  };

  const handleAddSub = () => {
    if (!newSubName) return;
    const subStr = `${newSubIcon} ${newSubName}`;
    setNewCat(prev => ({
      ...prev,
      sub: [...(prev.sub || []), subStr]
    }));
    setNewSubName('');
    setIsSubModalOpen(false);
  };

  const removeSub = (index: number) => {
    setNewCat(prev => ({
      ...prev,
      sub: (prev.sub || []).filter((_, i) => i !== index)
    }));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full bg-[#FFF9E3]"
    >
      <div className="p-6 flex flex-col gap-6">
        <div className="flex bg-white/50 p-1.5 rounded-2xl border-2 border-white shadow-sm">
          {(['expense', 'income'] as const).map(t => (
            <button 
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${tab === t ? 'bg-[#5D4037] text-white shadow-md' : 'text-stone-400'}`}
            >
              {t === 'expense' ? '支出分類' : '收入分類'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-6 space-y-3 pb-24">
        {filtered.map(cat => (
          <div 
            key={cat.id}
            className="bg-white p-4 rounded-[25px] border-2 border-white shadow-sm flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#FFFDF5] rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-stone-50">
                {cat.icon}
              </div>
              <div className="flex flex-col">
                <span className="font-black text-[#5D4037]">{cat.name}</span>
                <span className="text-[10px] font-bold text-stone-300 uppercase tracking-widest">
                  {cat.sub.length} 個子分類
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => { setEditingCat(cat); setNewCat(cat); setIsAddModalOpen(true); }}
                className="p-2 hover:bg-stone-50 rounded-xl text-stone-300 hover:text-[#5D4037] transition-all"
              >
                <Pencil size={18} />
              </button>
              <button 
                onClick={() => onSave(categories.filter(c => c.id !== cat.id))}
                className="p-2 hover:bg-rose-50 rounded-xl text-stone-200 hover:text-rose-400 transition-all"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#5D4037]/40 backdrop-blur-md"
              onClick={() => setIsAddModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="relative bg-[#FFFDF5] w-full max-w-sm rounded-[40px] shadow-2xl border-2 border-white overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-8 pb-4 flex items-center justify-between">
                <h3 className="text-xl font-black text-[#5D4037]">{editingCat ? '編輯分類' : '新增分類'}</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                  <X size={20} className="text-stone-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar p-8 pt-2 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">分類名稱</label>
                  <input 
                    value={newCat.name}
                    onChange={e => setNewCat({ ...newCat, name: e.target.value })}
                    className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                    placeholder="輸入分類名稱"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">分類圖示</label>
                  <div className="grid grid-cols-6 gap-2">
                    {['🍱', '🚗', '🛍️', '🎮', '🏠', '🏥', '✨', '💼', '📈', '🍔', '☕', '🎬', '👗', '💊', '🎁', '💡', '📚', '⚽'].map(icon => (
                      <button 
                        key={icon}
                        onClick={() => setNewCat({ ...newCat, icon })}
                        className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center text-xl transition-all ${newCat.icon === icon ? 'bg-[#FFD54F] border-[#FFD54F] shadow-md scale-110' : 'bg-white border-stone-50 shadow-sm'}`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest">子分類列表</label>
                    <button 
                      onClick={() => setIsSubModalOpen(true)}
                      className="text-[10px] font-black text-[#FFD54F] uppercase tracking-widest flex items-center gap-1 hover:opacity-80 transition-opacity"
                    >
                      <Plus size={12} /> 新增子分類
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {newCat.sub?.map((sub, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-xl border-2 border-stone-50 shadow-sm group">
                        <span className="font-bold text-[#5D4037] text-sm">{sub}</span>
                        <button 
                          onClick={() => removeSub(idx)}
                          className="p-1 text-stone-200 hover:text-rose-400 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    {(!newCat.sub || newCat.sub.length === 0) && (
                      <div className="text-center py-6 border-2 border-dashed border-stone-100 rounded-2xl">
                        <span className="text-xs font-bold text-stone-300">尚未新增子分類</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-8 pt-4">
                <button 
                  onClick={handleSave}
                  className="w-full py-5 bg-[#5D4037] text-white rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Check size={20} /> 儲存分類
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sub-category Add Modal */}
      <AnimatePresence>
        {isSubModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#5D4037]/20 backdrop-blur-sm"
              onClick={() => setIsSubModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-[280px] rounded-[30px] shadow-2xl p-6 space-y-6"
            >
              <h4 className="font-black text-[#5D4037] text-center">新增子分類</h4>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">名稱</label>
                <input 
                  autoFocus
                  value={newSubName}
                  onChange={e => setNewSubName(e.target.value)}
                  className="w-full p-3 bg-stone-50 rounded-xl font-bold text-[#5D4037] outline-none border-2 border-transparent focus:border-[#FFD54F] text-sm"
                  placeholder="子分類名稱"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">圖示</label>
                <div className="flex justify-around bg-stone-50 p-2 rounded-xl">
                  {[
                    { icon: <Star size={20} />, label: '⭐' },
                    { icon: <Mic size={20} />, label: '🎤' },
                    { icon: <Gift size={20} />, label: '🎁' },
                    { icon: <Star size={20} />, label: '💎' } // Using Star as fallback if Diamond not available, but I'll use Gem if I can find it
                  ].map(item => (
                    <button 
                      key={item.label}
                      onClick={() => setNewSubIcon(item.label)}
                      className={`p-2 rounded-lg transition-all ${newSubIcon === item.label ? 'bg-[#FFD54F] text-[#5D4037] shadow-sm scale-110' : 'text-stone-300 hover:text-[#5D4037]'}`}
                    >
                      {item.icon}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setIsSubModalOpen(false)}
                  className="flex-1 py-3 bg-stone-100 text-stone-400 rounded-xl font-black text-sm"
                >
                  取消
                </button>
                <button 
                  onClick={handleAddSub}
                  className="flex-1 py-3 bg-[#5D4037] text-white rounded-xl font-black text-sm shadow-lg active:scale-95"
                >
                  確定
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function PlaceholderView({ title, icon, onBack }: { title: string, icon: React.ReactNode, onBack: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
      className="flex flex-col h-full bg-[#FFF9E3]"
    >
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-10">
        <div className="bg-white/80 backdrop-blur-sm rounded-[40px] shadow-sm border-2 border-white p-10 flex flex-col items-center justify-center gap-6 text-center">
          <div className="w-24 h-24 bg-[#FFFDF5] rounded-[30px] flex items-center justify-center text-[#FFD54F] shadow-sm border border-white">
            {icon}
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-[#5D4037]">{title}</h2>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-black text-[#FFD54F] uppercase tracking-widest">Coming Soon</span>
              <p className="text-sm font-bold text-stone-300 leading-relaxed">
                此功能正在開發中<br />將在下個版本提供專業級的分析與管理！
              </p>
            </div>
          </div>
          
          <div className="w-full max-w-[200px] h-1.5 bg-stone-100 rounded-full overflow-hidden">
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="w-1/2 h-full bg-[#FFD54F]"
            />
          </div>

          <button 
            onClick={onBack}
            className="mt-4 px-8 py-3 bg-[#5D4037] text-white rounded-full font-bold shadow-lg active:scale-95 transition-transform"
          >
            返回首頁
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function HistoryView({ records, accounts, filter, onBack, onUpdateRecord, onDeleteRecord }: { 
  records: Transaction[], 
  accounts: Account[], 
  filter: { type: 'day' | 'week' | 'month' | 'year', date: string },
  onBack: () => void,
  onUpdateRecord: (old: Transaction, updated: Transaction) => void,
  onDeleteRecord: (record: Transaction) => void
}) {
  const [editingRecord, setEditingRecord] = useState<Transaction | null>(null);

  const filteredRecords = useMemo(() => {
    const base = parseLocalDate(filter.date);
    const start = new Date(base);
    const end = new Date(base);

    if (filter.type === 'day') {
      // Already set to base
    } else if (filter.type === 'week') {
      start.setDate(base.getDate() - base.getDay());
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

    return records.filter(r => r.category !== '初始資金' && r.date >= startStr && r.date <= endStr)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [records, filter]);

  const filterLabel = useMemo(() => {
    if (filter.type === 'day') return filter.date.replace(/-/g, '/');
    if (filter.type === 'week') return '本週明細';
    if (filter.type === 'month') return '本月明細';
    if (filter.type === 'year') return '本年明細';
    return '';
  }, [filter]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full bg-[#FFF9E3]"
    >
      <div className="flex-1 px-4 overflow-y-auto no-scrollbar pb-10 pt-4">
        <div className="bg-white/80 backdrop-blur-sm rounded-[40px] shadow-sm border-2 border-white p-6 space-y-4">
          {filteredRecords.length > 0 ? filteredRecords.map(record => (
            <div 
              key={record.id} 
              onClick={() => setEditingRecord(record)}
              className="flex items-center gap-4 py-4 border-b border-stone-50 last:border-0 group cursor-pointer hover:bg-stone-50/50 rounded-xl px-2 -mx-2 transition-colors"
            >
              <div className="w-14 h-14 bg-[#FFFDF5] rounded-2xl flex-shrink-0 flex items-center justify-center text-2xl shadow-sm border border-white">
                {record.type === 'income' ? '💰' : record.type === 'expense' ? '🍱' : '🔄'}
              </div>
              
              <div className="flex-1 flex flex-col gap-1 min-w-0">
                <span className="font-black text-lg text-[#5D4037] truncate leading-tight">
                  {record.note || record.category}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-300">{record.date}</span>
                  <span className="text-[10px] px-2 py-0.5 bg-stone-100 text-stone-400 rounded-full font-bold">
                    {accounts.find(a => a.id === record.accountId)?.name}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className={`font-black text-xl ${record.type === 'income' ? 'text-blue-400' : record.type === 'expense' ? 'text-rose-400' : 'text-stone-400'}`}>
                    {record.type === 'income' ? '+' : record.type === 'expense' ? '-' : ''} $ {record.amount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )) : (
            <div className="flex flex-col items-center justify-center py-20 text-stone-300 gap-4">
              <AlertCircle size={48} />
              <span className="font-bold">此期間無紀錄</span>
            </div>
          )}
        </div>
        <div className="h-[40px]" />
      </div>

      <AnimatePresence>
        {editingRecord && (
          <EditRecordModal 
            record={editingRecord}
            accounts={accounts}
            onClose={() => setEditingRecord(null)}
            onSave={(updated) => {
              onUpdateRecord(editingRecord, updated);
              setEditingRecord(null);
            }}
            onDelete={() => {
              onDeleteRecord(editingRecord);
              setEditingRecord(null);
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ReportsView({ records }: { records: Transaction[] }) {
  const filteredRecords = useMemo(() => records.filter(r => r.category !== '初始資金'), [records]);
  
  const monthlyStats = useMemo(() => {
    const now = new Date();
    const monthStr = now.toISOString().substring(0, 7);
    const monthly = filteredRecords.filter(r => r.date.startsWith(monthStr));
    
    const categories: Record<string, number> = {};
    monthly.filter(r => r.type === 'expense').forEach(r => {
      const cat = r.category.split(' > ')[0];
      categories[cat] = (categories[cat] || 0) + r.amount;
    });
    
    return {
      income: monthly.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0),
      expense: monthly.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0),
      categories: Object.entries(categories).sort((a, b) => b[1] - a[1])
    };
  }, [filteredRecords]);

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex flex-col gap-6 px-4 py-6"
    >
      <div className="bg-white rounded-[30px] p-6 shadow-sm border-2 border-white flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <span className="font-black text-lg">本月收支概況</span>
          <span className="text-xs font-bold text-stone-300">2026/04</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 p-4 rounded-2xl flex flex-col gap-1">
            <span className="text-[10px] font-bold text-blue-400 uppercase">總收入</span>
            <span className="text-xl font-black text-blue-600">$ {monthlyStats.income.toLocaleString()}</span>
          </div>
          <div className="bg-rose-50 p-4 rounded-2xl flex flex-col gap-1">
            <span className="text-[10px] font-bold text-rose-400 uppercase">總支出</span>
            <span className="text-xl font-black text-rose-600">$ {monthlyStats.expense.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[30px] p-6 shadow-sm border-2 border-white flex flex-col gap-4">
        <span className="font-black text-lg">支出分類統計</span>
        <div className="flex flex-col gap-4">
          {monthlyStats.categories.length > 0 ? monthlyStats.categories.map(([cat, amt]) => (
            <div key={cat} className="flex flex-col gap-2">
              <div className="flex justify-between text-sm font-bold">
                <span>{cat}</span>
                <span>$ {amt.toLocaleString()}</span>
              </div>
              <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#FFD54F]" 
                  style={{ width: `${(amt / monthlyStats.expense) * 100}%` }}
                />
              </div>
            </div>
          )) : (
            <div className="py-10 text-center text-stone-300 font-bold">本月尚無支出紀錄</div>
          )}
        </div>
      </div>
      
      <div className="h-[40px]" />
    </motion.div>
  );
}

function MoreView() {
  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex flex-col gap-4 px-4 py-6"
    >
      <div className="bg-white rounded-[30px] p-6 shadow-sm border-2 border-white flex flex-col gap-2">
        <span className="font-black text-lg mb-2">系統設定</span>
        <div className="flex items-center justify-between py-3 border-b border-stone-50">
          <span className="font-bold">匯出資料 (CSV)</span>
          <ChevronRight size={20} className="text-stone-300" />
        </div>
        <div className="flex items-center justify-between py-3 border-b border-stone-50">
          <span className="font-bold">備份與還原</span>
          <ChevronRight size={20} className="text-stone-300" />
        </div>
        <div className="flex items-center justify-between py-3">
          <span className="font-bold">關於 KK 記帳</span>
          <span className="text-xs text-stone-300">v2.4.0</span>
        </div>
      </div>
      
      <div className="bg-white rounded-[30px] p-6 shadow-sm border-2 border-white flex flex-col gap-2">
        <span className="font-black text-lg mb-2">顯示設定</span>
        <div className="flex items-center justify-between py-3 border-b border-stone-50">
          <span className="font-bold">深色模式</span>
          <div className="w-12 h-6 bg-stone-100 rounded-full relative">
            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
          </div>
        </div>
        <div className="flex items-center justify-between py-3">
          <span className="font-bold">隱藏金額</span>
          <div className="w-12 h-6 bg-[#5D4037] rounded-full relative">
            <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
          </div>
        </div>
      </div>
      
      <div className="h-[40px]" />
    </motion.div>
  );
}

// --- Components ---

function HorizontalScrollArea({ 
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
        className="flex gap-3 overflow-x-auto no-scrollbar py-1 scroll-smooth"
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

function RecordModal({ accounts, categories, templates, onUpdateTemplates, onClose, onSave, selectedDate }: { 
  accounts: Account[], 
  categories: Category[],
  templates: Template[], 
  onUpdateTemplates: (t: Template[]) => void,
  onClose: () => void, 
  onSave: (r: any) => void,
  selectedDate: string
}) {
  const [tab, setTab] = useState<'template' | 'expense' | 'income' | 'transfer'>('template');
  const [amount, setAmount] = useState('0');
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[1].id);
  const [toAccountId, setToAccountId] = useState(accounts[4].id);
  const [mainCategory, setMainCategory] = useState<string | null>(null);
  const [subCategory, setSubCategory] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [exchangeRate, setExchangeRate] = useState('1');
  const [toAmount, setToAmount] = useState('0');
  const [showCalculator, setShowCalculator] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  const currentAccount = accounts.find(a => a.id === selectedAccountId);
  const currentToAccount = accounts.find(a => a.id === toAccountId);
  const currentMainCat = categories.find(c => c.name === mainCategory);

  const filteredCategories = categories.filter(c => {
    if (tab === 'expense') return c.type === 'expense';
    if (tab === 'income') return c.type === 'income';
    return false;
  });

  const handleKey = (key: string) => {
    if (key === 'AC') { setAmount('0'); return; }
    if (key === '=') {
      const finalAmount = parseFloat(amount);
      const rate = parseFloat(exchangeRate) || 1;
      
      onSave({ 
        amount: finalAmount, 
        category: subCategory || mainCategory || (tab === 'transfer' ? '轉帳' : '其他'), 
        note: note.trim() || undefined,
        type: tab as any, 
        accountId: selectedAccountId, 
        toAccountId: tab === 'transfer' ? toAccountId : undefined, 
        toAmount: tab === 'transfer' ? (parseFloat(toAmount) || finalAmount * rate) : undefined,
        exchangeRate: tab === 'transfer' ? rate : undefined,
        date: selectedDate 
      });
      return;
    }
    if (amount === '0') { setAmount(key); } else { setAmount(amount + key); }
  };

  const handleApplyTemplate = (t: Template) => {
    onSave({ 
      amount: t.amount, 
      category: t.category, 
      note: t.note,
      type: t.type, 
      accountId: t.fromAccountId, 
      toAccountId: t.toAccountId,
      date: selectedDate 
    });
    onClose();
  };

  const handleSaveTemplateEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate) return;
    
    const exists = templates.find(t => t.id === editingTemplate.id);
    if (exists) {
      onUpdateTemplates(templates.map(t => t.id === editingTemplate.id ? editingTemplate : t));
    } else {
      onUpdateTemplates([...templates, editingTemplate]);
    }
    setEditingTemplate(null);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/30 backdrop-blur-md z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        className="bg-[#FFFDF5] w-full max-w-md rounded-t-[40px] p-6 flex flex-col gap-4 max-h-[95vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6 text-[#5D4037]" />
          </button>
          <span className="text-lg font-bold text-[#5D4037]">記一筆</span>
          <div className="flex items-center gap-1 bg-white px-3 py-1 rounded-full border border-stone-100 shadow-sm">
            <CalendarIcon className="w-3 h-3 text-[#5D4037]" />
            <span className="text-[10px] font-bold text-[#5D4037]">{selectedDate.replace(/-/g, '/')}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex justify-center">
          <div className="bg-stone-100 p-1 rounded-full flex w-full">
            {['template', 'expense', 'income', 'transfer'].map(t => (
              <button 
                key={t}
                onClick={() => {
                  setTab(t as any);
                  setShowCalculator(false);
                  setMainCategory(null);
                  setSubCategory(null);
                }}
                className={`flex-1 py-1.5 rounded-full text-[10px] font-bold transition-all ${tab === t ? 'bg-[#5D4037] text-white shadow-md' : 'text-stone-400'}`}
              >
                {t === 'template' ? '範本' : t === 'expense' ? '支出' : t === 'income' ? '收入' : '轉帳'}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-6 px-1">
          {tab === 'template' ? (
            <div className="space-y-4 py-2">
              <span className="text-[20px] font-bold text-[#000000] uppercase px-2">常用範本</span>
              <HorizontalScrollArea>
                {templates.map((t) => (
                  <div key={t.id} className="relative flex-shrink-0 w-[180px]">
                    <button 
                      onClick={() => handleApplyTemplate(t)}
                      className="w-full bg-white p-4 rounded-[25px] border-2 border-white shadow-sm flex flex-col gap-2 text-left hover:bg-stone-50 transition-colors h-full"
                    >
                      <div className={`w-10 h-10 ${t.color} rounded-2xl flex items-center justify-center text-xl shadow-sm`}>{t.icon}</div>
                      <div className="flex flex-col">
                        <span className="font-bold text-[#000000] text-[18px] truncate">{t.name}</span>
                        <span className="text-[16px] text-stone-400 font-medium">{t.type === 'transfer' ? '轉帳' : t.category}</span>
                        <span className={`font-black text-[18px] mt-1 ${t.type === 'income' ? 'text-blue-400' : 'text-rose-400'}`}>
                          {t.type === 'income' ? '+' : '-'}$ {t.amount.toLocaleString()}
                        </span>
                      </div>
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setEditingTemplate(t); }}
                      className="absolute right-3 top-3 p-1.5 text-stone-200 hover:text-[#5D4037] bg-white/50 rounded-full backdrop-blur-sm"
                    >
                      <Settings2 size={14} />
                    </button>
                  </div>
                ))}
                {/* Add Template Button */}
                <div className="flex-shrink-0 w-[180px]">
                  <button 
                    onClick={() => setEditingTemplate({
                      id: Math.random().toString(36).substr(2, 9),
                      name: '新範本',
                      amount: 0,
                      category: '食物',
                      type: 'expense',
                      fromAccountId: accounts[0].id,
                      icon: '✨',
                      color: 'bg-stone-100',
                      note: ''
                    })}
                    className="w-full h-full bg-stone-50 p-4 rounded-[25px] border-2 border-dashed border-stone-200 flex flex-col items-center justify-center gap-2 text-stone-400 hover:bg-stone-100 transition-colors group"
                  >
                    <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-xl shadow-sm group-hover:scale-110 transition-transform">➕</div>
                    <span className="font-bold text-xs">新增範本</span>
                  </button>
                </div>
              </HorizontalScrollArea>
              
              {/* Bottom Spacing */}
              <div className="h-[40px]" />
            </div>
          ) : (
            <div className="space-y-6 pb-4">
              {/* Step 1: Account Selection */}
              {tab === 'transfer' ? (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-2">
                      <span className="text-[18px] font-bold text-[#000000] uppercase">1. 來源帳戶 (錢從哪裡出)</span>
                      <span className="text-[16px] font-bold text-[#000000] bg-[#FFD54F]/20 px-2 py-0.5 rounded-full">
                        {currentAccount?.currency}
                      </span>
                    </div>
                    <HorizontalScrollArea className="px-8">
                      {accounts.map(acc => (
                        <button 
                          key={`from-${acc.id}`}
                          onClick={() => setSelectedAccountId(acc.id)}
                          className={`flex-shrink-0 w-20 h-24 rounded-[20px] flex flex-col items-center justify-center gap-2 border-2 transition-all ${
                            selectedAccountId === acc.id ? 'bg-[#FFD54F] border-[#FFD54F] shadow-md' : 'bg-white border-white shadow-sm'
                          }`}
                        >
                          <div className="w-10 h-10 bg-white/50 rounded-full flex items-center justify-center text-xl">{acc.icon}</div>
                          <span className="text-[18px] font-bold text-[#000000] text-center px-1 leading-tight">{acc.name}</span>
                        </button>
                      ))}
                    </HorizontalScrollArea>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-2">
                      <span className="text-[18px] font-bold text-[#000000] uppercase">2. 目的帳戶 (錢往哪裡去)</span>
                      <span className="text-[16px] font-bold text-[#000000] bg-[#FFD54F]/20 px-2 py-0.5 rounded-full">
                        {currentToAccount?.currency}
                      </span>
                    </div>
                    <HorizontalScrollArea className="px-8">
                      {accounts.map(acc => (
                        <button 
                          key={`to-${acc.id}`}
                          onClick={() => setToAccountId(acc.id)}
                          className={`flex-shrink-0 w-20 h-24 rounded-[20px] flex flex-col items-center justify-center gap-2 border-2 transition-all ${
                            toAccountId === acc.id ? 'bg-[#FFD54F] border-[#FFD54F] shadow-md' : 'bg-white border-white shadow-sm'
                          }`}
                        >
                          <div className="w-10 h-10 bg-white/50 rounded-full flex items-center justify-center text-xl">{acc.icon}</div>
                          <span className="text-[18px] font-bold text-[#000000] text-center px-1 leading-tight">{acc.name}</span>
                        </button>
                      ))}
                    </HorizontalScrollArea>
                  </div>

                  {/* Exchange Rate Logic */}
                  {currentAccount?.currency !== currentToAccount?.currency && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4 px-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-stone-300 uppercase">匯率 (1 {currentAccount?.currency} = ?)</label>
                          <input 
                            type="number"
                            value={exchangeRate}
                            onChange={e => setExchangeRate(e.target.value)}
                            className="w-full p-3 bg-white border-2 border-stone-50 rounded-xl font-bold text-sm outline-none shadow-sm focus:border-[#FFD54F]"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-stone-300 uppercase">實收金額 ({currentToAccount?.currency})</label>
                          <input 
                            type="number"
                            value={toAmount}
                            onChange={e => setToAmount(e.target.value)}
                            className="w-full p-3 bg-white border-2 border-stone-50 rounded-xl font-bold text-sm outline-none shadow-sm focus:border-[#FFD54F]"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <span className="text-[18px] font-bold text-[#000000] uppercase px-2">1. 選擇帳戶</span>
                  <HorizontalScrollArea className="px-8">
                    {accounts.map(acc => (
                      <button 
                        key={acc.id}
                        onClick={() => setSelectedAccountId(acc.id)}
                        className={`flex-shrink-0 w-20 h-24 rounded-[20px] flex flex-col items-center justify-center gap-2 border-2 transition-all ${
                          selectedAccountId === acc.id ? 'bg-[#FFD54F] border-[#FFD54F] shadow-md' : 'bg-white border-white shadow-sm'
                        }`}
                      >
                        <div className="w-10 h-10 bg-white/50 rounded-full flex items-center justify-center text-xl">{acc.icon}</div>
                        <span className="text-[18px] font-bold text-[#000000] text-center px-1 leading-tight">{acc.name}</span>
                      </button>
                    ))}
                  </HorizontalScrollArea>
                </div>
              )}

              {/* Step 2: Main Category Selection */}
              {tab !== 'transfer' && (
                <div className="space-y-2">
                  <span className="text-[18px] font-bold text-[#000000] uppercase px-2">2. 選擇主分類</span>
                  <HorizontalScrollArea className="px-8">
                    {filteredCategories.map(cat => (
                      <button 
                        key={cat.id}
                        onClick={() => {
                          setMainCategory(cat.name);
                          setSubCategory(null);
                          setShowCalculator(false);
                        }}
                        className={`flex-shrink-0 w-20 h-24 rounded-[20px] flex flex-col items-center justify-center gap-2 border-2 transition-all ${
                          mainCategory === cat.name ? 'bg-[#5D4037] text-white border-[#5D4037] shadow-md' : 'bg-white text-stone-400 border-white shadow-sm'
                        }`}
                      >
                        <div className={`w-10 h-10 ${mainCategory === cat.name ? 'bg-white/20' : 'bg-stone-50'} rounded-full flex items-center justify-center text-xl`}>{cat.icon}</div>
                        <span className="text-[18px] font-bold text-[#000000] text-center px-1 leading-tight">{cat.name}</span>
                      </button>
                    ))}
                  </HorizontalScrollArea>
                </div>
              )}

              {/* Step 3: Sub Category Selection */}
              {tab !== 'transfer' && mainCategory && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                  <span className="text-[18px] font-bold text-[#000000] uppercase px-2">3. 選擇子分類</span>
                  <HorizontalScrollArea className="px-8">
                    {currentMainCat?.sub.map(sub => (
                      <button 
                        key={sub}
                        onClick={() => {
                          setSubCategory(sub);
                          setShowCalculator(true);
                        }}
                        className={`flex-shrink-0 px-6 h-12 rounded-full font-bold border-2 transition-all text-[18px] text-[#000000] ${
                          subCategory === sub ? 'bg-[#FFD54F] border-[#FFD54F] shadow-md' : 'bg-white border-white shadow-sm text-[#000000]'
                        }`}
                      >
                        {sub}
                      </button>
                    ))}
                  </HorizontalScrollArea>
                </motion.div>
              )}

              {/* Note Input */}
              {tab !== 'template' && (
                <div className="space-y-2">
                  <span className="text-[18px] font-bold text-[#000000] uppercase px-2">備註 (買了什麼？)</span>
                  <input 
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#000000] text-[16px] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
                    placeholder="例如：開源社雞排、演唱會周邊"
                  />
                </div>
              )}

              {/* Transfer Mode Auto Trigger */}
              {tab === 'transfer' && selectedAccountId && toAccountId && !showCalculator && (
                <div className="flex justify-center py-4">
                  <button 
                    onClick={() => setShowCalculator(true)}
                    className="px-8 py-3 bg-[#5D4037] text-white rounded-full font-bold shadow-lg"
                  >
                    輸入轉帳金額
                  </button>
                </div>
              )}

              {/* Calculator & Amount Section (Integrated into Scroll) */}
              {tab !== 'template' && (
                <div className="flex flex-col gap-4 pt-4">
                  {/* Amount Box */}
                  <div 
                    onClick={() => setShowCalculator(true)}
                    className="bg-white border-2 border-[#FFD54F] rounded-[20px] p-4 flex items-center justify-between shadow-inner cursor-pointer"
                  >
                    <span className="text-xs font-bold text-stone-300">TWD</span>
                    <div className="flex items-center gap-4">
                      <span className="text-3xl font-black">{amount}</span>
                      <button onClick={(e) => { e.stopPropagation(); handleKey('AC'); }} className="w-10 h-10 bg-rose-50 text-rose-400 rounded-full flex items-center justify-center font-bold text-xs">AC</button>
                    </div>
                  </div>

                  {/* Calculator Grid */}
                  <AnimatePresence>
                    {showCalculator && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden flex flex-col gap-4"
                      >
                        {/* Confirmation Status Bar */}
                        <div className="bg-stone-100 px-4 py-2 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-1 text-[20px] font-bold text-[#000000] overflow-hidden whitespace-nowrap">
                            <span className="text-[#000000]">{currentAccount?.name}</span>
                            <span>&gt;</span>
                            {tab === 'transfer' ? (
                              <span className="text-[#000000]">{currentToAccount?.name}</span>
                            ) : (
                              <>
                                <span>{mainCategory}</span>
                                <span>&gt;</span>
                                <span className="text-[#000000]">{subCategory}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                          {['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', '.', '0', '=', '+'].map(k => (
                            <button 
                              key={k}
                              onClick={() => handleKey(k)}
                              className={`h-14 rounded-xl flex items-center justify-center text-xl font-bold shadow-sm ${['÷', '×', '-', '+', '='].includes(k) ? 'bg-[#FFD54F] text-[#5D4037]' : k === '=' ? 'bg-[#5D4037] text-white' : 'bg-white text-[#5D4037]'}`}
                            >
                              {k}
                            </button>
                          ))}
                        </div>
                        
                        <button 
                          onClick={() => handleKey('=')}
                          className="w-full py-5 bg-[#5D4037] text-white rounded-[25px] font-black text-xl shadow-xl mt-2 active:scale-95 transition-transform"
                        >
                          儲存紀錄
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
              
              {/* Bottom Spacing */}
              <div className="h-[40px]" />
            </div>
          )}
        </div>
      </motion.div>

      {/* Template Edit Modal */}
      <AnimatePresence>
        {editingTemplate && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4"
            onClick={() => setEditingTemplate(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-[#FFFDF5] w-full max-w-sm rounded-[30px] p-6 flex flex-col gap-4 max-h-[90vh] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditingTemplate(null)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                    <ChevronLeft className="w-5 h-5 text-[#5D4037]" />
                  </button>
                  <h3 className="text-lg font-bold text-[#5D4037]">
                    {templates.find(t => t.id === editingTemplate.id) ? '編輯範本' : '新增範本'}
                  </h3>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar space-y-5 pr-1">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-stone-300 uppercase">範本名稱</label>
                    <input 
                      value={editingTemplate.name} 
                      onChange={e => setEditingTemplate({...editingTemplate, name: e.target.value})}
                      className="w-full p-3 bg-white border border-stone-100 rounded-xl outline-none font-bold text-sm shadow-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-stone-300 uppercase">預設金額</label>
                    <input 
                      type="number"
                      value={editingTemplate.amount} 
                      onChange={e => setEditingTemplate({...editingTemplate, amount: parseFloat(e.target.value) || 0})}
                      className="w-full p-3 bg-white border border-stone-100 rounded-xl outline-none font-bold text-sm shadow-sm"
                    />
                  </div>
                </div>

                {/* Note Info */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-stone-300 uppercase">預設備註 (買了什麼？)</label>
                  <input 
                    value={editingTemplate.note || ''} 
                    onChange={e => setEditingTemplate({...editingTemplate, note: e.target.value})}
                    placeholder="例如：開源社雞排"
                    className="w-full p-3 bg-white border border-stone-100 rounded-xl outline-none font-bold text-sm shadow-sm"
                  />
                </div>

                {/* Type Selection */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-stone-300 uppercase">收支類型</label>
                  <div className="flex gap-2">
                    {['expense', 'income', 'transfer'].map(type => (
                      <button
                        key={type}
                        onClick={() => setEditingTemplate({...editingTemplate, type: type as any})}
                        className={`flex-1 py-2 rounded-xl border-2 transition-all text-[10px] font-bold ${editingTemplate.type === type ? 'bg-[#5D4037] text-white border-[#5D4037]' : 'bg-white border-white text-stone-400'}`}
                      >
                        {type === 'expense' ? '支出' : type === 'income' ? '收入' : '轉帳'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Account Selection */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-stone-300 uppercase">
                    {editingTemplate.type === 'transfer' ? '來源帳戶' : '預設帳戶'}
                  </label>
                  <HorizontalScrollArea>
                    {accounts.map(acc => (
                      <button 
                        key={acc.id}
                        onClick={() => setEditingTemplate({...editingTemplate, fromAccountId: acc.id})}
                        className={`flex-shrink-0 px-4 py-2 rounded-xl border-2 transition-all text-[10px] font-bold ${editingTemplate.fromAccountId === acc.id ? 'bg-[#FFD54F] border-[#FFD54F] text-[#5D4037]' : 'bg-white border-white text-stone-400'}`}
                      >
                        {acc.icon} {acc.name}
                      </button>
                    ))}
                  </HorizontalScrollArea>
                </div>

                {/* Destination Account (Transfer Only) */}
                {editingTemplate.type === 'transfer' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-stone-300 uppercase">目的帳戶</label>
                    <HorizontalScrollArea>
                      {accounts.map(acc => (
                        <button 
                          key={acc.id}
                          onClick={() => setEditingTemplate({...editingTemplate, toAccountId: acc.id})}
                          className={`flex-shrink-0 px-4 py-2 rounded-xl border-2 transition-all text-[10px] font-bold ${editingTemplate.toAccountId === acc.id ? 'bg-[#FFD54F] border-[#FFD54F] text-[#5D4037]' : 'bg-white border-white text-stone-400'}`}
                        >
                          {acc.icon} {acc.name}
                        </button>
                      ))}
                    </HorizontalScrollArea>
                  </div>
                )}

                {/* Category Selection (Non-Transfer) */}
                {editingTemplate.type !== 'transfer' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-stone-300 uppercase">主分類</label>
                      <HorizontalScrollArea>
                        {categories.map(cat => (
                          <button 
                            key={cat.id}
                            onClick={() => setEditingTemplate({...editingTemplate, category: cat.name})}
                            className={`flex-shrink-0 px-4 py-2 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${editingTemplate.category.split(' > ')[0] === cat.name ? 'bg-[#5D4037] text-white border-[#5D4037]' : 'bg-white border-white text-stone-400'}`}
                          >
                            <span className="text-sm">{cat.icon}</span>
                            <span className="text-[8px] font-bold">{cat.name}</span>
                          </button>
                        ))}
                      </HorizontalScrollArea>
                    </div>

                    {/* Sub Category */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">子分類</label>
                      <div className="grid grid-cols-3 gap-2">
                        {categories.find(c => c.name === editingTemplate.category.split(' > ')[0])?.sub.map(sub => (
                          <button 
                            key={sub}
                            onClick={() => setEditingTemplate({...editingTemplate, category: `${editingTemplate.category.split(' > ')[0]} > ${sub}`})}
                            className={`py-2 rounded-xl border-2 transition-all text-[9px] font-bold ${editingTemplate.category.includes(sub) ? 'bg-[#FFD54F] text-[#5D4037] border-[#FFD54F]' : 'bg-white border-white text-stone-400'}`}
                          >
                            {sub}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Save Button */}
                <div className="pt-2">
                  <button 
                    onClick={handleSaveTemplateEdit}
                    className="w-full py-5 bg-[#5D4037] text-white rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Check size={20} /> 儲存範本
                  </button>
                </div>

                {/* Bottom Spacing */}
                <div className="h-[40px]" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

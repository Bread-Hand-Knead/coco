import React, { useState, useMemo, useEffect } from 'react';
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
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Types ---

interface Transaction {
  id: string;
  amount: number;
  category: string;
  note?: string;
  date: string; // YYYY-MM-DD
  type: 'income' | 'expense' | 'transfer';
  accountId: string;
  toAccountId?: string;
}

interface Account {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'investment' | 'credit' | 'e-ticket';
  icon: string;
  parentId?: string;
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
}

// --- Initial Data ---

const INITIAL_ACCOUNTS: Account[] = [
  { id: 'cash', name: '現金', type: 'cash', icon: '💰' },
  { id: 'bank_ts_group', name: '台新銀行', type: 'bank', icon: '🏦' },
  { id: 'bank_ts_1', name: '台新 - 活存', type: 'bank', icon: '🏦', parentId: 'bank_ts_group' },
  { id: 'bank_ts_2', name: '台新 - 儲蓄', type: 'bank', icon: '🏦', parentId: 'bank_ts_group' },
  { id: 'inv_cathay', name: '國泰證券 (006208)', type: 'investment', icon: '📈' },
  { id: 'credit_ts', name: '台新信用卡', type: 'credit', icon: '💳' },
  { id: 'easycard', name: '悠遊卡', type: 'e-ticket', icon: '🚌' },
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
  { id: 't3', name: '薪資收入', amount: 29500, category: '薪資', type: 'income', fromAccountId: 'bank_ts', icon: '💼', color: 'bg-amber-50' },
];

// --- Main App ---

export default function App() {
  const [currentView, setCurrentView] = useState<'home' | 'reports' | 'more' | 'accounts' | 'calendar'>('home');
  const [records, setRecords] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('kk_adv_records');
    return saved ? JSON.parse(saved) : INITIAL_RECORDS;
  });
  const [accounts, setAccounts] = useState<Account[]>(() => {
    const saved = localStorage.getItem('kk_adv_accounts');
    return saved ? JSON.parse(saved) : INITIAL_ACCOUNTS;
  });

  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [selectedAccountForDetail, setSelectedAccountForDetail] = useState<Account | null>(null);
  const [templates, setTemplates] = useState<Template[]>(() => {
    const saved = localStorage.getItem('kk_adv_templates');
    return saved ? JSON.parse(saved) : INITIAL_TEMPLATES;
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

  const headerTitle = useMemo(() => {
    if (currentView === 'accountDetail' && selectedAccountForDetail) {
      return selectedAccountForDetail.name;
    }
    if (currentView === 'accounts') return '帳戶列表';
    if (currentView === 'calendar') return '日曆明細';
    if (currentView === 'reports') return '收支報表';
    if (currentView === 'more') return '更多設定';
    return '2026 / 04';
  }, [currentView, selectedAccountForDetail]);

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
        balances[record.accountId] = (balances[record.accountId] || 0) - record.amount;
        if (record.toAccountId) {
          balances[record.toAccountId] = (balances[record.toAccountId] || 0) + record.amount;
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
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const daily = records.filter(r => r.date === todayStr);
    const monthly = records.filter(r => r.date.startsWith(todayStr.substring(0, 7)));
    
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
  }, [records]);

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

  const handleSaveAccount = (updatedAcc: Account, initialAmount?: number) => {
    setAccounts(prev => prev.map(a => a.id === updatedAcc.id ? updatedAcc : a));
    
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
  };

  return (
    <div className="h-screen w-full bg-[#FFF9E3] font-sans text-[#5D4037] flex justify-center overflow-hidden select-none">
      {/* Responsive Container for Desktop */}
      <div className="w-full max-w-md h-full flex flex-col bg-[#FFF9E3] relative shadow-2xl md:border-x border-stone-100">
        {/* Header */}
        <header className="px-4 py-4 flex items-center justify-between bg-[#FFF9E3] z-30 flex-shrink-0">
          {currentView === 'home' ? (
            <Menu className="w-6 h-6 text-[#5D4037]" />
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
          <div className="text-lg font-bold text-[#5D4037]">{headerTitle}</div>
          <CalendarIcon className="w-6 h-6 cursor-pointer text-[#5D4037]" onClick={() => setCurrentView('calendar')} />
        </header>

        {/* Main Content Area (Scrollable) */}
        <main className="flex-1 overflow-y-auto no-scrollbar min-h-0">
          <AnimatePresence mode="wait">
            {currentView === 'home' && (
              <HomeView 
                stats={stats} 
                onRecordClick={() => setIsRecordModalOpen(true)} 
                onAccountClick={() => setCurrentView('accounts')}
              />
            )}
            {currentView === 'accounts' && (
              <AccountsView 
                accounts={accounts} 
                netAssets={netAssets}
                totalAssets={totalAssets}
                totalLiabilities={totalLiabilities}
                onAccountClick={(acc) => {
                  setSelectedAccountForDetail(acc);
                  setCurrentView('accountDetail');
                }}
                onAddAccount={() => {
                  const newId = Date.now().toString();
                  const newAcc: Account = { id: newId, name: '新帳戶', type: 'cash', icon: '💰' };
                  setAccounts([...accounts, newAcc]);
                  
                  // Create initial balance record
                  const initRecord: Transaction = {
                    id: `init_${newId}`,
                    amount: 0,
                    category: '初始資金',
                    date: new Date().toISOString().split('T')[0],
                    type: 'income',
                    accountId: newId
                  };
                  setRecords(prev => [...prev, initRecord]);
                  
                  setSelectedAccountForDetail(newAcc);
                  setCurrentView('accountDetail');
                }}
                balances={accountBalances}
              />
            )}
            {currentView === 'accountDetail' && selectedAccountForDetail && (
              <AccountDetailView 
                account={selectedAccountForDetail}
                records={records}
                onBack={() => setCurrentView('accounts')}
                onSave={handleSaveAccount}
                onDelete={(id) => {
                  setAccounts(prev => prev.filter(a => a.id !== id && a.parentId !== id));
                  setRecords(prev => prev.filter(r => r.accountId !== id && r.toAccountId !== id));
                  setCurrentView('accounts');
                  setSelectedAccountForDetail(null);
                }}
                onUpdateRecord={handleUpdateRecord}
                onDeleteRecord={handleDeleteRecord}
                accounts={accounts}
                balance={accountBalances[selectedAccountForDetail.id] || 0}
              />
            )}
            {currentView === 'calendar' && (
              <CalendarView 
                records={records} 
                onBack={() => setCurrentView('home')}
              />
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
              templates={templates}
              onUpdateTemplates={setTemplates}
              onClose={() => setIsRecordModalOpen(false)}
              onSave={handleSaveRecord}
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

function HomeView({ stats, onRecordClick, onAccountClick }: { stats: any, onRecordClick: () => void, onAccountClick: () => void }) {
  const dates = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  
  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex flex-col gap-6 px-4"
    >
      <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
        {dates.map(d => (
          <div key={d} className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-bold ${d === 12 ? 'bg-[#FFD54F] text-white shadow-md' : 'bg-white text-stone-300'}`}>
            {d}
          </div>
        ))}
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
          <span className="text-lg font-black text-blue-400">{stats.monthly.income}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-stone-300">本月支出</span>
          <span className="text-lg font-black text-rose-400">{stats.monthly.expense}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-stone-300">可用預算</span>
          <span className="text-lg font-black">0</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <StatCard title="本日" date="2026/4/12" expense={stats.daily.expense} income={stats.daily.income} />
        <StatCard title="本週" date="2026/4/12 - 2026/4/18" expense={0} income={0} />
        <StatCard title="本月" date="2026/4/1 - 2026/4/30" expense={stats.monthly.expense} income={stats.monthly.income} />
        <StatCard title="本年" date="2026/01/01 - 2026/12/31" expense={2289} income={0} />
      </div>

      {/* Bottom Buffer */}
      <div className="h-[120px] w-full" />
    </motion.div>
  );
}

function StatCard({ title, date, expense, income }: { title: string, date: string, expense: number, income: number }) {
  return (
    <div className="bg-white rounded-[20px] p-4 shadow-sm border-2 border-white flex justify-between items-center">
      <div className="flex flex-col">
        <span className="text-lg font-black">{title}</span>
        <span className="text-[10px] font-bold text-stone-300">{date}</span>
      </div>
      <div className="flex flex-col items-end">
        <span className="text-sm font-bold text-rose-400">- {expense}</span>
        <span className="text-sm font-bold text-blue-400">+ {income}</span>
      </div>
    </div>
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

      <div className="px-4 mt-6">
        <button 
          onClick={onAddAccount}
          className="w-full h-16 bg-[#FFD54F] rounded-full flex items-center justify-center gap-2 shadow-lg border-4 border-white active:scale-95 transition-all"
        >
          <Plus className="w-6 h-6 bg-white rounded-full p-1 text-[#5D4037]" />
          <span className="font-bold text-lg text-[#5D4037]">新增帳戶</span>
        </button>
      </div>

      {/* Bottom Buffer */}
      <div className="h-[120px] w-full" />
    </motion.div>
  );
}

function AccountDetailView({ account, records, onBack, onSave, onDelete, onUpdateRecord, onDeleteRecord, accounts, balance }: { 
  account: Account, 
  records: Transaction[],
  onBack: () => void,
  onSave: (acc: Account, initialAmount: number) => void,
  onDelete: (id: string) => void,
  onUpdateRecord: (old: Transaction, updated: Transaction) => void,
  onDeleteRecord: (record: Transaction) => void,
  accounts: Account[],
  balance: number
}) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Transaction | null>(null);
  
  const accountRecords = useMemo(() => {
    const childrenIds = accounts.filter(c => c.parentId === account.id).map(c => c.id);
    const targetIds = [account.id, ...childrenIds];
    
    return records.filter(r => targetIds.includes(r.accountId) || (r.toAccountId && targetIds.includes(r.toAccountId)))
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
            onClick={() => setIsEditModalOpen(true)}
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
                        {record.type === 'income' ? '+' : record.type === 'expense' ? '-' : ''} $ {record.amount.toLocaleString()}
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
              <div className="h-[120px] w-full" />
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
        <div className="h-[120px] w-full" />
      </div>

      {/* Edit Account Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <AccountEditModal 
            account={account}
            accounts={accounts}
            records={records}
            onClose={() => setIsEditModalOpen(false)}
            onSave={(updated, initialAmount) => {
              onSave(updated, initialAmount);
              setIsEditModalOpen(false);
            }}
            onDelete={onDelete}
          />
        )}
      </AnimatePresence>

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
              <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">備註</label>
              <input 
                value={edited.note || ''}
                onChange={e => setEdited({ ...edited, note: e.target.value })}
                className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
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

function AccountEditModal({ account, accounts, records, onClose, onSave, onDelete }: { 
  account: Account, 
  accounts: Account[],
  records: Transaction[],
  onClose: () => void, 
  onSave: (acc: Account, initialAmount: number) => void,
  onDelete: (id: string) => void
}) {
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
            <h3 className="text-xl font-black text-[#5D4037]">編輯帳戶</h3>
          </div>
          <div className="w-10 h-10 bg-[#FFD54F] rounded-2xl flex items-center justify-center shadow-sm">
            <Edit3 size={20} className="text-[#5D4037]" />
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
                  value={initialAmount}
                  onChange={e => setInitialAmount(parseFloat(e.target.value) || 0)}
                  className="w-full p-4 pl-10 bg-white border-2 border-stone-50 rounded-2xl font-black text-xl text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
                />
              </div>
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
          </div>

          <div className="flex flex-col gap-3 pt-4">
            <button 
              onClick={() => onSave(editedAcc, initialAmount)}
              className="w-full py-5 bg-[#5D4037] text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"
            >
              <Check size={24} /> 儲存變更
            </button>
            <button 
              onClick={() => {
                setShowDeleteConfirm(true);
              }}
              className="w-full py-3 text-rose-400 font-black flex items-center justify-center gap-2 text-sm hover:bg-rose-50 rounded-xl transition-colors"
            >
              <Trash2 size={18} /> 刪除帳戶
            </button>
          </div>
          
          {/* Bottom Spacing */}
          <div className="h-[40px]" />
        </div>

        {/* Delete Confirmation Overlay */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="absolute inset-0 bg-rose-500 z-50 flex flex-col items-center justify-center p-8 text-white text-center gap-6"
            >
              <Trash2 size={64} className="mb-2" />
              <h4 className="text-2xl font-black">確定要刪除嗎？</h4>
              <p className="text-sm font-bold opacity-80 text-rose-100">刪除後將無法復原，帳戶相關明細也會一併移除。</p>
              <div className="flex w-full gap-3 mt-4">
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-4 bg-white/20 rounded-2xl font-bold hover:bg-white/30 transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={() => onDelete(editedAcc.id)}
                  className="flex-1 py-4 bg-white text-rose-500 rounded-2xl font-black shadow-lg active:scale-95 transition-all"
                >
                  確定刪除
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

function CalendarView({ records, onBack }: { records: Transaction[], onBack: () => void }) {
  const selectedDay = 17;
  
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="flex flex-col bg-white min-h-full"
    >
      <div className="p-4 bg-[#FFF9E3]">
        <div className="grid grid-cols-7 text-center mb-2">
          {['日', '一', '二', '三', '四', '五', '六'].map((d, i) => (
            <span key={d} className={`text-xs font-bold ${i === 0 || i === 6 ? 'text-orange-400' : 'text-stone-400'}`}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 text-center gap-y-4">
          {Array.from({ length: 35 }).map((_, i) => {
            const d = i - 1; // Simplified calendar
            return (
              <div key={i} className="flex flex-col items-center justify-center h-10 relative">
                {d > 0 && d <= 31 && (
                  <>
                    <span className={`text-sm font-bold ${d === selectedDay ? 'text-white z-10' : (i % 7 === 0 || i % 7 === 6 ? 'text-orange-400' : 'text-[#5D4037]')}`}>
                      {d}
                    </span>
                    {d === selectedDay && (
                      <div className="absolute inset-0 m-auto w-8 h-8 bg-[#5D4037] rounded-full -z-0" />
                    )}
                    {d === selectedDay && (
                      <span className="absolute -bottom-2 text-[8px] text-rose-400 font-bold">763</span>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-around py-3 border-b border-stone-100 text-[10px] font-bold bg-white">
        <div className="flex flex-col items-center"><span className="text-stone-300">收入</span><span className="text-blue-400">+0</span></div>
        <div className="flex flex-col items-center"><span className="text-stone-300">支出</span><span className="text-rose-400">-763</span></div>
        <div className="flex flex-col items-center"><span className="text-stone-300">結餘</span><span className="text-[#5D4037]">-763</span></div>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex justify-between items-center"><span className="font-bold">2026/3/17 明細</span><span className="text-xs text-stone-400">共 1 筆</span></div>
        <div className="bg-white p-4 rounded-[20px] shadow-sm border border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center text-xl">🍱</div>
            <div className="flex flex-col"><span className="font-bold">食物</span><span className="text-[10px] text-stone-300">支出</span>Base</div>
          </div>
          <span className="text-lg font-black text-rose-400">- $763</span>
        </div>
        
        {/* Bottom Buffer */}
        <div className="h-[120px] w-full" />
      </div>
    </motion.div>
  );
}

// --- Category Data ---

const CATEGORIES = [
  { name: '食物', icon: '🍱', sub: ['早餐', '午餐', '晚餐', '飲料', '零食'] },
  { name: '交通', icon: '🚗', sub: ['捷運', '公車', '火車', '加油', '停車'] },
  { name: '購物', icon: '🛍️', sub: ['服飾', '日用品', '電子產品', '美妝'] },
  { name: '娛樂', icon: '🎮', sub: ['電影', '遊戲', 'KTV', '旅遊'] },
  { name: '生活', icon: '🏠', sub: ['房租', '水電費', '電話費', '保險'] },
  { name: '醫療', icon: '🏥', sub: ['診所', '藥局', '保健品'] },
  { name: '其他', icon: '✨', sub: ['雜項', '捐款', '禮物'] },
];

function RecordModal({ accounts, templates, onUpdateTemplates, onClose, onSave }: { 
  accounts: Account[], 
  templates: Template[], 
  onUpdateTemplates: (t: Template[]) => void,
  onClose: () => void, 
  onSave: (r: any) => void 
}) {
  const [tab, setTab] = useState<'template' | 'expense' | 'income' | 'transfer'>('template');
  const [amount, setAmount] = useState('0');
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[1].id);
  const [toAccountId, setToAccountId] = useState(accounts[4].id);
  const [mainCategory, setMainCategory] = useState<string | null>(null);
  const [subCategory, setSubCategory] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [showCalculator, setShowCalculator] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  const handleKey = (key: string) => {
    if (key === 'AC') { setAmount('0'); return; }
    if (key === '=') {
      onSave({ 
        amount: parseFloat(amount), 
        category: subCategory || mainCategory || '其他', 
        note: note.trim() || undefined,
        type: tab as any, 
        accountId: selectedAccountId, 
        toAccountId: tab === 'transfer' ? toAccountId : undefined, 
        date: new Date().toISOString().split('T')[0] 
      });
      return;
    }
    if (amount === '0') { setAmount(key); } else { setAmount(amount + key); }
  };

  const handleApplyTemplate = (t: Template) => {
    onSave({ 
      amount: t.amount, 
      category: t.category, 
      type: t.type, 
      accountId: t.fromAccountId, 
      toAccountId: t.toAccountId,
      date: new Date().toISOString().split('T')[0] 
    });
  };

  const handleSaveTemplateEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate) return;
    onUpdateTemplates(templates.map(t => t.id === editingTemplate.id ? editingTemplate : t));
    setEditingTemplate(null);
  };

  const currentAccount = accounts.find(a => a.id === selectedAccountId);
  const currentToAccount = accounts.find(a => a.id === toAccountId);
  const currentMainCat = CATEGORIES.find(c => c.name === mainCategory);

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
            <span className="text-[10px] font-bold text-[#5D4037]">2026/04/12</span>
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
            <div className="space-y-3 py-2">
              {templates.map((t) => (
                <div key={t.id} className="relative group">
                  <button 
                    onClick={() => handleApplyTemplate(t)}
                    className="w-full bg-white p-4 rounded-[20px] border-2 border-white shadow-sm flex items-center gap-4 text-left hover:bg-stone-50 transition-colors"
                  >
                    <div className={`w-12 h-12 ${t.color} rounded-2xl flex items-center justify-center text-xl`}>{t.icon}</div>
                    <div className="flex-1 flex flex-col">
                      <span className="font-bold">{t.name}</span>
                      <span className="text-[10px] text-stone-400">{t.type === 'transfer' ? '轉帳' : t.category}</span>
                    </div>
                    <div className="flex flex-col items-end mr-8">
                      <span className={`font-black text-lg ${t.type === 'income' ? 'text-blue-400' : 'text-rose-400'}`}>
                        {t.type === 'income' ? '+' : '-'}$ {t.amount.toLocaleString()}
                      </span>
                      {t.type === 'transfer' && (
                        <span className="text-[8px] text-stone-300">
                          {accounts.find(a => a.id === t.fromAccountId)?.name} → {accounts.find(a => a.id === t.toAccountId)?.name}
                        </span>
                      )}
                    </div>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setEditingTemplate(t); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-stone-300 hover:text-[#5D4037]"
                  >
                    <Settings2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6 pb-4">
              {/* Step 1: Account Selection */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-stone-300 uppercase px-2">1. 選擇帳戶</span>
                <div className="flex gap-3 overflow-x-auto no-scrollbar py-1">
                  {accounts.map(acc => (
                    <button 
                      key={acc.id}
                      onClick={() => {
                        if (tab === 'transfer') {
                          if (selectedAccountId === acc.id) return;
                          setToAccountId(acc.id);
                        } else {
                          setSelectedAccountId(acc.id);
                        }
                      }}
                      className={`flex-shrink-0 w-20 h-24 rounded-[20px] flex flex-col items-center justify-center gap-2 border-2 transition-all ${
                        (tab !== 'transfer' && selectedAccountId === acc.id) || (tab === 'transfer' && (selectedAccountId === acc.id || toAccountId === acc.id))
                        ? 'bg-[#FFD54F] border-[#FFD54F] shadow-md' : 'bg-white border-white shadow-sm'
                      }`}
                    >
                      <div className="w-10 h-10 bg-white/50 rounded-full flex items-center justify-center text-xl">{acc.icon}</div>
                      <span className="text-[9px] font-bold text-center px-1 leading-tight">{acc.name}</span>
                      {tab === 'transfer' && selectedAccountId === acc.id && <span className="text-[8px] text-[#5D4037] font-bold">來源</span>}
                      {tab === 'transfer' && toAccountId === acc.id && <span className="text-[8px] text-[#5D4037] font-bold">目的</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2: Main Category Selection */}
              {tab !== 'transfer' && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-stone-300 uppercase px-2">2. 選擇主分類</span>
                  <div className="grid grid-cols-4 gap-3">
                    {CATEGORIES.map(cat => (
                      <button 
                        key={cat.name}
                        onClick={() => {
                          setMainCategory(cat.name);
                          setSubCategory(null);
                          setShowCalculator(false);
                        }}
                        className={`flex flex-col items-center gap-1 py-3 rounded-2xl transition-all border-2 ${mainCategory === cat.name ? 'bg-[#5D4037] text-white border-[#5D4037]' : 'bg-white text-stone-400 border-white shadow-sm'}`}
                      >
                        <span className="text-xl">{cat.icon}</span>
                        <span className="text-[10px] font-bold">{cat.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Sub Category Selection */}
              {tab !== 'transfer' && mainCategory && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                  <span className="text-[10px] font-bold text-stone-300 uppercase px-2">3. 選擇子分類</span>
                  <div className="grid grid-cols-4 gap-3">
                    {currentMainCat?.sub.map(sub => (
                      <button 
                        key={sub}
                        onClick={() => {
                          setSubCategory(sub);
                          setShowCalculator(true);
                        }}
                        className={`py-3 rounded-xl text-[10px] font-bold transition-all border-2 ${subCategory === sub ? 'bg-[#FFD54F] text-[#5D4037] border-[#FFD54F]' : 'bg-white text-stone-400 border-white shadow-sm'}`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Note Input */}
              {tab !== 'template' && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-stone-300 uppercase px-2">備註 (買了什麼？)</span>
                  <input 
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
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
                          <div className="flex items-center gap-1 text-[10px] font-bold text-stone-500 overflow-hidden whitespace-nowrap">
                            <span className="text-[#5D4037]">{currentAccount?.name}</span>
                            <span>&gt;</span>
                            {tab === 'transfer' ? (
                              <span className="text-[#5D4037]">{currentToAccount?.name}</span>
                            ) : (
                              <>
                                <span>{mainCategory}</span>
                                <span>&gt;</span>
                                <span className="text-[#5D4037]">{subCategory}</span>
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
                  <h3 className="text-lg font-bold text-[#5D4037]">編輯範本</h3>
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

                {/* Account Selection */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-stone-300 uppercase">
                    {editingTemplate.type === 'transfer' ? '來源帳戶' : '預設帳戶'}
                  </label>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                    {accounts.map(acc => (
                      <button 
                        key={acc.id}
                        onClick={() => setEditingTemplate({...editingTemplate, fromAccountId: acc.id})}
                        className={`flex-shrink-0 px-4 py-2 rounded-xl border-2 transition-all text-[10px] font-bold ${editingTemplate.fromAccountId === acc.id ? 'bg-[#FFD54F] border-[#FFD54F] text-[#5D4037]' : 'bg-white border-white text-stone-400'}`}
                      >
                        {acc.icon} {acc.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Destination Account (Transfer Only) */}
                {editingTemplate.type === 'transfer' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-stone-300 uppercase">目的帳戶</label>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                      {accounts.map(acc => (
                        <button 
                          key={acc.id}
                          onClick={() => setEditingTemplate({...editingTemplate, toAccountId: acc.id})}
                          className={`flex-shrink-0 px-4 py-2 rounded-xl border-2 transition-all text-[10px] font-bold ${editingTemplate.toAccountId === acc.id ? 'bg-[#FFD54F] border-[#FFD54F] text-[#5D4037]' : 'bg-white border-white text-stone-400'}`}
                        >
                          {acc.icon} {acc.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Category Selection (Non-Transfer) */}
                {editingTemplate.type !== 'transfer' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-stone-300 uppercase">主分類</label>
                      <div className="grid grid-cols-4 gap-2">
                        {CATEGORIES.map(cat => (
                          <button 
                            key={cat.name}
                            onClick={() => setEditingTemplate({...editingTemplate, category: cat.name})}
                            className={`py-2 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${editingTemplate.category.split(' > ')[0] === cat.name ? 'bg-[#5D4037] text-white border-[#5D4037]' : 'bg-white border-white text-stone-400'}`}
                          >
                            <span className="text-sm">{cat.icon}</span>
                            <span className="text-[8px] font-bold">{cat.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sub Category */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-stone-300 uppercase">子分類</label>
                      <div className="grid grid-cols-3 gap-2">
                        {CATEGORIES.find(c => c.name === editingTemplate.category.split(' > ')[0])?.sub.map(sub => (
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
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setEditingTemplate(null)} className="flex-1 py-3 bg-stone-100 rounded-xl font-bold text-stone-400">取消</button>
                <button onClick={handleSaveTemplateEdit} className="flex-1 py-3 bg-[#5D4037] text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg">
                  <Check size={18} /> 儲存範本
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

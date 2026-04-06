import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  Menu, 
  CalendarDays, 
  Wallet, 
  MoreHorizontal, 
  Home, 
  QrCode, 
  Diamond, 
  BarChart3,
  X,
  Eye,
  Search,
  PiggyBank,
  ShoppingBasket,
  ChevronLeft,
  ChevronDown,
  Edit2,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Types ---

interface Transaction {
  id: string;
  amount: number;
  category: string;
  date: Date;
  type: 'income' | 'expense' | 'transfer';
  accountId?: string;
  toAccountId?: string; // For transfers
}

interface Account {
  id: string;
  name: string;
  amount: number;
  type: 'cash' | 'bank' | 'investment' | 'credit' | 'e-ticket' | 'other';
  icon: string;
  closingDay?: number;
}

const CATEGORIES = ['食物', '烘焙', 'K-pop', '投資', '交通', '娛樂', '購物', '醫療', '其他'];

const getCategoryEmoji = (category: string) => {
  const mainCat = category.split(' - ')[0];
  const emojiMap: Record<string, string> = {
    '食物': '🍱',
    '烘焙': '🍞',
    'K-pop': '💿',
    '投資': '📈',
    '交通': '🚌',
    '娛樂': '🎮',
    '購物': '🛍️',
    '醫療': '💊',
    '生活': '🏠',
    '其他': '🎁',
    '轉帳': '🔄',
  };
  return emojiMap[mainCat] || '💰';
};

// --- Components ---

const KouKouIcon = ({ 
  className = "w-8 h-8", 
  hasBorder = false,
  bgColor = "bg-white"
}: { 
  className?: string, 
  hasBorder?: boolean,
  bgColor?: string
}) => (
  <div className={`${className} ${bgColor} rounded-full ${hasBorder ? 'border-[2px] border-white' : ''} flex items-center justify-center shadow-sm overflow-hidden`}>
    <span className="text-[#5D4037] text-xl font-bold leading-none select-none" style={{ transform: 'translateY(-1px)' }}>
      ◡̈
    </span>
  </div>
);

export default function App() {
  const [records, setRecords] = useState<Transaction[]>([
    { id: '1', amount: 763, category: '食物', date: new Date(2026, 2, 17), type: 'expense' },
    { id: '2', amount: 1526, category: '購物', date: new Date(2026, 1, 15), type: 'expense' },
  ]);
  const [accounts, setAccounts] = useState<Account[]>([
    { id: '1', name: '現金', amount: 3500, type: 'cash', icon: '💰' },
    { id: '2', name: '台新銀行 - 活存', amount: 125800, type: 'bank', icon: '🏦' },
    { id: '2b', name: '台新銀行 - 儲蓄', amount: 50000, type: 'bank', icon: '🏦' },
    { id: '3', name: '國泰證券 (006208)', amount: 450000, type: 'investment', icon: '📈' },
    { id: '4', name: '信用卡 (本月待繳)', amount: -8240, type: 'credit', icon: '💳' },
  ]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentView, setCurrentView] = useState<'home' | 'account' | 'accountDetail' | 'calendar'>('home');
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [editingRecord, setEditingRecord] = useState<Transaction | null>(null);

  // --- Lifecycle & Refresh ---

  const refreshDate = useCallback(() => {
    const now = new Date();
    // Only update if the day has changed to avoid unnecessary re-renders
    setSelectedDate(prev => {
      if (prev.toDateString() === now.toDateString()) return prev;
      return now;
    });
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshDate();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refreshDate]);

  // --- Calculations ---

  const monthlyStats = useMemo(() => {
    const currentMonth = selectedDate.getMonth();
    const currentYear = selectedDate.getFullYear();
    
    const monthRecords = records.filter(r => 
      r.date.getMonth() === currentMonth && r.date.getFullYear() === currentYear
    );

    const income = monthRecords.filter(r => r.type === 'income').reduce((sum, r) => sum + r.amount, 0);
    const expense = monthRecords.filter(r => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0);
    
    return {
      income,
      expense,
      available: -expense + income
    };
  }, [records, selectedDate]);

  const groupedAccounts = useMemo<{ [key: string]: Account[] }>(() => {
    const groups: { [key: string]: Account[] } = {};
    accounts.forEach(acc => {
      // Try to extract bank name by splitting with " - " or " "
      const nameParts = acc.name.split(/ - | /);
      const bankName = nameParts[0];
      if (!groups[bankName]) {
        groups[bankName] = [];
      }
      groups[bankName].push(acc);
    });
    return groups;
  }, [accounts]);

  const dailyStats = useMemo(() => {
    const dayRecords = records.filter(r => 
      r.date.toDateString() === selectedDate.toDateString()
    );
    const income = dayRecords.filter(r => r.type === 'income').reduce((sum, r) => sum + r.amount, 0);
    const expense = dayRecords.filter(r => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0);
    return { income, expense };
  }, [records, selectedDate]);

  const yearlyStats = useMemo(() => {
    const yearRecords = records.filter(r => r.date.getFullYear() === selectedDate.getFullYear());
    const income = yearRecords.filter(r => r.type === 'income').reduce((sum, r) => sum + r.amount, 0);
    const expense = yearRecords.filter(r => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0);
    return { income, expense };
  }, [records, selectedDate]);

  // --- Handlers ---

  const handleSaveRecord = (amount: number, category: string, type: 'income' | 'expense' | 'transfer', accountId?: string, toAccountId?: string, date?: Date, recordId?: string) => {
    if (recordId) {
      // Update existing record
      const oldRecord = records.find(r => r.id === recordId);
      if (!oldRecord) return;

      // Revert old account balances
      if (oldRecord.type === 'transfer' && oldRecord.accountId && oldRecord.toAccountId) {
        setAccounts(prev => prev.map(acc => {
          if (acc.id === oldRecord.accountId) return { ...acc, amount: acc.amount + oldRecord.amount };
          if (acc.id === oldRecord.toAccountId) return { ...acc, amount: acc.amount - oldRecord.amount };
          return acc;
        }));
      } else if (oldRecord.accountId) {
        setAccounts(prev => prev.map(acc => {
          if (acc.id === oldRecord.accountId) {
            return { ...acc, amount: oldRecord.type === 'income' ? acc.amount - oldRecord.amount : acc.amount + oldRecord.amount };
          }
          return acc;
        }));
      }

      // Apply new record and update balances
      const updatedRecord: Transaction = {
        ...oldRecord,
        amount,
        category,
        date: date || oldRecord.date,
        type,
        accountId,
        toAccountId
      };

      setRecords(prev => prev.map(r => r.id === recordId ? updatedRecord : r));

      if (type === 'transfer' && accountId && toAccountId) {
        setAccounts(prev => prev.map(acc => {
          if (acc.id === accountId) return { ...acc, amount: acc.amount - amount };
          if (acc.id === toAccountId) return { ...acc, amount: acc.amount + amount };
          return acc;
        }));
      } else if (accountId) {
        setAccounts(prev => prev.map(acc => {
          if (acc.id === accountId) {
            return { ...acc, amount: type === 'income' ? acc.amount + amount : acc.amount - amount };
          }
          return acc;
        }));
      }
    } else {
      // Add new record
      const newRecord: Transaction = {
        id: Math.random().toString(36).substr(2, 9),
        amount,
        category,
        date: date || new Date(selectedDate),
        type,
        accountId,
        toAccountId
      };
      
      setRecords([...records, newRecord]);
      
      if (type === 'transfer' && accountId && toAccountId) {
        setAccounts(prev => prev.map(acc => {
          if (acc.id === accountId) return { ...acc, amount: acc.amount - amount };
          if (acc.id === toAccountId) return { ...acc, amount: acc.amount + amount };
          return acc;
        }));
      } else if (accountId) {
        setAccounts(prev => prev.map(acc => {
          if (acc.id === accountId) {
            return { ...acc, amount: type === 'income' ? acc.amount + amount : acc.amount - amount };
          }
          return acc;
        }));
      }
    }
    
    setIsModalOpen(false);
    setEditingRecord(null);
  };

  const deleteRecord = (recordId: string) => {
    const recordToDelete = records.find(r => r.id === recordId);
    if (!recordToDelete) return;

    // Revert account balances
    if (recordToDelete.type === 'transfer' && recordToDelete.accountId && recordToDelete.toAccountId) {
      setAccounts(prev => prev.map(acc => {
        if (acc.id === recordToDelete.accountId) return { ...acc, amount: acc.amount + recordToDelete.amount };
        if (acc.id === recordToDelete.toAccountId) return { ...acc, amount: acc.amount - recordToDelete.amount };
        return acc;
      }));
    } else if (recordToDelete.accountId) {
      setAccounts(prev => prev.map(acc => {
        if (acc.id === recordToDelete.accountId) {
          return { ...acc, amount: recordToDelete.type === 'income' ? acc.amount - recordToDelete.amount : acc.amount + recordToDelete.amount };
        }
        return acc;
      }));
    }

    setRecords(prev => prev.filter(r => r.id !== recordId));
    setIsModalOpen(false);
    setEditingRecord(null);
  };

  const formatAccountName = (name: string) => {
    if (name.length <= 2) return name;
    let finalName = name;
    if (name.includes(' ')) {
      finalName = name.replace(' ', '\n');
    } else if (name.includes('(')) {
      finalName = name.replace('(', '\n(');
    } else if (name.includes('-')) {
      finalName = name.replace('-', '\n-');
    }
    return finalName;
  };

  const addAccount = (name: string, type: string, amount: number, closingDay?: number) => {
    const formattedName = formatAccountName(name);
    const typeMap: Record<string, { type: Account['type'], icon: string }> = {
      '💰 現金': { type: 'cash', icon: '💰' },
      '🏦 銀行': { type: 'bank', icon: '🏦' },
      '📈 投資': { type: 'investment', icon: '📈' },
      '💳 信用卡': { type: 'credit', icon: '💳' },
      '🚌 電子票證': { type: 'e-ticket', icon: '🚌' },
      '🎁 其他': { type: 'other', icon: '🎁' },
    };
    const { type: accType, icon } = typeMap[type] || { type: 'cash', icon: '💰' };
    const newAccount: Account = {
      id: Math.random().toString(36).substr(2, 9),
      name: formattedName,
      amount,
      type: accType,
      icon,
      closingDay
    };
    setAccounts([...accounts, newAccount]);
    setIsAccountModalOpen(false);
  };

  const updateAccount = (accountId: string, newAmount: number, newName?: string, newClosingDay?: number) => {
    const formattedName = newName ? formatAccountName(newName) : undefined;
    setAccounts(accounts.map(acc => acc.id === accountId ? { ...acc, amount: newAmount, name: formattedName || acc.name, closingDay: newClosingDay ?? acc.closingDay } : acc));
    if (selectedAccount?.id === accountId) {
      setSelectedAccount({ ...selectedAccount, amount: newAmount, name: formattedName || selectedAccount.name, closingDay: newClosingDay ?? selectedAccount.closingDay });
    }
  };

  const handleAccountClick = (account: Account) => {
    setSelectedAccount(account);
    setCurrentView('accountDetail');
  };

  return (
    <div className="flex flex-col h-screen bg-[#FFFDF5] font-sans text-[#5D4037] overflow-hidden">
      <AnimatePresence mode="wait">
        {currentView === 'calendar' ? (
          <CalendarScreen 
            onBack={() => setCurrentView('home')}
            records={records}
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            onEditRecord={(record) => {
              setEditingRecord(record);
              setIsModalOpen(true);
            }}
          />
        ) : currentView === 'accountDetail' && selectedAccount ? (
          <AccountDetailPage 
            account={selectedAccount}
            transactions={records.filter(r => r.accountId === selectedAccount.id || r.toAccountId === selectedAccount.id)}
            accounts={accounts}
            onBack={() => setCurrentView('account')}
            onUpdateAccount={(newAmount, newName, newClosingDay) => updateAccount(selectedAccount.id, newAmount, newName, newClosingDay)}
          />
        ) : (
          <motion.div 
            key="main-layout"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col h-full"
          >
            {/* Header */}
            <header className="bg-transparent px-4 py-4 flex items-center justify-between">
              <Menu className="w-6 h-6 text-[#5D4037] cursor-pointer" />
              <h1 className="text-lg font-bold text-[#5D4037]">
                {selectedDate.getFullYear()} / {String(selectedDate.getMonth() + 1).padStart(2, '0')}
              </h1>
              <div className="flex gap-2">
                <CalendarDays 
                  className="w-5 h-5 text-[#5D4037] cursor-pointer" 
                  onClick={() => setCurrentView('calendar')}
                />
              </div>
            </header>

            {/* Main Content Scrollable Area */}
            <main className="flex-1 overflow-y-auto pb-24 no-scrollbar">
              <AnimatePresence mode="wait">
                {currentView === 'home' ? (
                  <motion.div
                    key="home"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* 1. 日曆區 (Cookie Style) */}
                    <CalendarStrip selectedDate={selectedDate} onDateSelect={setSelectedDate} />

                    {/* 2. 按鈕區 (Sticker Pill Style) */}
                    <div className="px-5 mt-6 flex gap-3">
                      {/* 1. 記一筆按鈕 (佔比較大 flex-7) */}
                      <motion.button 
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsModalOpen(true)}
                        className="flex-[7] h-[70px] bg-[#FFD54F] text-[#5D4037] rounded-full font-bold flex items-center justify-center gap-2.5 border-[3px] border-white shadow-[0_4px_10px_rgba(93,64,55,0.15)] transition-all"
                      >
                        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                          <span className="text-[#5D4037] text-xl font-bold leading-none select-none">◡̈</span>
                        </div>
                        <span className="text-lg font-bold">記一筆</span>
                      </motion.button>

                      {/* 2. 帳戶按鈕 (佔比較小 flex-3) */}
                      <motion.button 
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setCurrentView('account')}
                        className="flex-[3] h-[70px] bg-[#FFF9E3] text-[#5D4037] rounded-[20px] font-bold flex flex-col items-center justify-center border-[3px] border-white shadow-[0_4px_8px_rgba(93,64,55,0.1)] transition-all"
                      >
                        <Wallet className="w-6 h-6 text-[#5D4037]" />
                        <span className="text-[12px] font-bold">帳戶</span>
                      </motion.button>
                    </div>

                    {/* 3. 數據概覽 (White Card Style) */}
                    <div className="bg-white mx-5 mt-6 p-6 rounded-[25px] shadow-[0_15px_30px_rgba(0,0,0,0.05)] flex justify-around items-center">
                      <StatItem label="本月收入" value={`${monthlyStats.income}`} color="text-blue-400" />
                      <StatItem label="本月支出" value={`${monthlyStats.expense}`} color="text-rose-400" />
                      <StatItem 
                        label="可用預算" 
                        value={`${monthlyStats.available}`} 
                        color="text-[#5D4037]" 
                      />
                    </div>

                    {/* 4. 明細列表 (Hand-drawn List Style) */}
                    <div className="px-5 mt-6 space-y-3">
                      <SummaryCard 
                        title="本日" 
                        subtitle={selectedDate.toLocaleDateString('zh-TW')}
                        expense={`- ${dailyStats.expense}`} 
                        income={`+ ${dailyStats.income}`} 
                      />
                      <SummaryCard 
                        title="本週" 
                        subtitle={`${(() => {
                          const start = new Date(selectedDate);
                          start.setDate(selectedDate.getDate() - selectedDate.getDay());
                          const end = new Date(start);
                          end.setDate(start.getDate() + 6);
                          return `${start.toLocaleDateString('zh-TW')} ~ ${end.toLocaleDateString('zh-TW')}`;
                        })()}`}
                        expense="- 0" 
                        income="+ 0" 
                      />
                      <SummaryCard 
                        title="本月" 
                        subtitle={`${(() => {
                          const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
                          const end = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
                          return `${start.toLocaleDateString('zh-TW')} ~ ${end.toLocaleDateString('zh-TW')}`;
                        })()}`}
                        expense={`- ${monthlyStats.expense}`} 
                        income={`+ ${monthlyStats.income}`} 
                      />
                      <SummaryCard 
                        title="本年" 
                        subtitle={`${selectedDate.getFullYear()}/01/01 ~ ${selectedDate.getFullYear()}/12/31`}
                        expense={`- ${yearlyStats.expense}`} 
                        income={`+ ${yearlyStats.income}`} 
                      />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="account"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="px-5 pt-4 space-y-6"
                  >
                    {/* 1. 頂部總資產概覽卡片 - 瘦身版 */}
                    <div className="bg-[#FFE593] h-[65px] px-5 rounded-[15px] border-2 border-white shadow-[0_4px_10px_rgba(0,0,0,0.05)] flex items-center justify-between">
                      <span className="text-[#5D4037] text-[18px] font-bold">💰 總資產</span>
                      <div className="flex-1 flex justify-end overflow-hidden ml-4">
                        <span className={`text-[#5D4037] font-black whitespace-nowrap transition-all duration-200 ${
                          accounts.reduce((sum, acc) => sum + acc.amount, 0).toLocaleString().length > 15 ? 'text-[14px]' :
                          accounts.reduce((sum, acc) => sum + acc.amount, 0).toLocaleString().length > 12 ? 'text-[18px]' :
                          accounts.reduce((sum, acc) => sum + acc.amount, 0).toLocaleString().length > 9 ? 'text-[20px]' : 'text-[24px]'
                        }`}>
                          $ {accounts.reduce((sum, acc) => sum + acc.amount, 0).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* 2. 帳戶列表區 */}
                    <div className="space-y-3">
                      {Object.keys(groupedAccounts).map((groupName) => (
                        <ExpansionAccountItem 
                          key={groupName}
                          groupName={groupName}
                          accounts={groupedAccounts[groupName]}
                          onAccountClick={handleAccountClick}
                        />
                      ))}
                    </div>

                    {/* 3. 新增帳戶按鈕 */}
                    <motion.button 
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setIsAccountModalOpen(true)}
                      className="w-full h-[70px] bg-[#FFD54F] text-[#5D4037] rounded-full font-bold flex items-center justify-center gap-2.5 border-[3px] border-white shadow-[0_4px_10px_rgba(93,64,55,0.15)] transition-all"
                    >
                      <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                        <span className="text-[#5D4037] text-xl font-bold leading-none select-none">+</span>
                      </div>
                      <span className="text-lg font-bold">新增帳戶</span>
                    </motion.button>

                    {/* 預留空間 */}
                    <div className="pt-4 text-center">
                      <p className="text-[12px] text-stone-400 font-medium italic">
                        💡 這裡可以管理您的 ETF 與存款資產
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </main>

            {/* Bottom Navigation */}
            <nav className="bg-[#FFFDF5] h-20 flex items-center justify-around fixed bottom-0 left-0 right-0 z-10 rounded-t-[30px] shadow-[0_-10px_30px_rgba(93,64,55,0.05)] border-t border-stone-100">
              <NavItem icon={<Home />} label="首頁" active={selectedIndex === 0} onClick={() => { 
                setSelectedIndex(0); 
                setCurrentView('home');
                refreshDate();
              }} />
              <NavItem icon={<BarChart3 />} label="報表" active={selectedIndex === 1} onClick={() => setSelectedIndex(1)} />
              <NavItem icon={<MoreHorizontal />} label="更多" active={selectedIndex === 2} onClick={() => setSelectedIndex(2)} />
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Record Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <RecordModal 
            onClose={() => {
              setIsModalOpen(false);
              setEditingRecord(null);
            }} 
            onSave={handleSaveRecord} 
            onDelete={deleteRecord}
            accounts={accounts}
            initialRecord={editingRecord}
          />
        )}
      </AnimatePresence>

      {/* Add Account Modal */}
      <AnimatePresence>
        {isAccountModalOpen && (
          <AddAccountModal 
            onClose={() => setIsAccountModalOpen(false)} 
            onSave={addAccount} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function AccountDetailPage({ account, transactions, accounts, onBack, onUpdateAccount }: { 
  account: Account, 
  transactions: Transaction[], 
  accounts: Account[],
  onBack: () => void, 
  onUpdateAccount: (newAmount: number, newName: string, newClosingDay?: number) => void 
}) {
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

  const isCreditCard = account.type === 'credit';
  
  const getTransactionsInCurrentCycle = useCallback((currentDate: Date, closingDay: number) => {
    let start: Date;
    let end: Date;

    if (currentDate.getDate() > closingDay) {
      // Example: Closing day 10, today 15 -> Cycle is 11th this month to 10th next month
      start = new Date(currentDate.getFullYear(), currentDate.getMonth(), closingDay + 1);
      end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, closingDay);
    } else {
      // Example: Closing day 10, today 5 -> Cycle is 11th last month to 10th this month
      start = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, closingDay + 1);
      end = new Date(currentDate.getFullYear(), currentDate.getMonth(), closingDay);
    }

    const filtered = transactions.filter(t => 
      t.type === 'expense' && 
      t.date >= start && 
      t.date <= end
    );

    return { transactions: filtered, start, end };
  }, [transactions]);

  const cycleData = useMemo(() => {
    if (!isCreditCard || !account.closingDay) return null;
    return getTransactionsInCurrentCycle(new Date(), account.closingDay);
  }, [isCreditCard, account.closingDay, getTransactionsInCurrentCycle]);

  const billingPeriod = cycleData ? { start: cycleData.start, end: cycleData.end } : null;

  const filteredTransactions = useMemo(() => {
    if (isCreditCard && cycleData) {
      return cycleData.transactions;
    }
    return transactions;
  }, [isCreditCard, cycleData, transactions]);

  // Calculate total spending for credit card (sum of filtered transactions)
  const totalSpending = useMemo(() => {
    if (!cycleData) return 0;
    return cycleData.transactions.reduce((sum, t) => sum + t.amount, 0);
  }, [cycleData]);

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 bg-[#FFFDF5] z-40 flex flex-col"
    >
      {/* AppBar */}
      <header className="px-4 py-4 flex items-center bg-transparent">
        <button onClick={onBack} className="p-3 -ml-2 text-[#5D4037] hover:bg-stone-100 rounded-full transition-colors">
          <ChevronLeft className="w-8 h-8" />
        </button>
        <h1 className="flex-1 text-center text-xl font-bold text-[#5D4037] mr-10 flex items-center justify-center gap-2">
          <span>{account.icon}</span>
          <span className="whitespace-pre-line leading-[1.1] text-center">{account.name}</span>
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
        {/* Refined Slim Balance Card */}
        <div className="mx-4 mt-4 mb-2 px-5 py-3 bg-white rounded-[20px] border-2 border-[#FFE593] shadow-[0_10px_30px_rgba(0,0,0,0.03)] flex items-center justify-between gap-3 h-[90px]">
          <div className="flex flex-col justify-center flex-1 min-w-0">
            <span className="text-stone-400 text-sm font-medium mb-0.5">
              {isCreditCard ? '本月應繳總額' : '目前餘額'}
            </span>
            <div className="w-full overflow-hidden flex items-baseline">
              <span className={`font-bold text-[#5D4037] whitespace-nowrap transition-all duration-200 ${
                account.amount.toLocaleString().length > 15 ? 'text-lg' :
                account.amount.toLocaleString().length > 12 ? 'text-xl' : 
                account.amount.toLocaleString().length > 9 ? 'text-2xl' : 'text-3xl'
              }`}>
                $ {account.amount.toLocaleString()}
              </span>
            </div>
          </div>
          
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsCalculatorOpen(true)}
            className="w-[45px] h-[45px] flex-shrink-0 flex items-center justify-center bg-[#FFE593]/30 text-[#5D4037] rounded-full transition-all hover:bg-[#FFE593]/50"
          >
            <Edit2 className="w-5 h-5" />
          </motion.button>
        </div>

        {/* Credit Card Billing Period Summary - 標籤感風格 */}
        {isCreditCard && billingPeriod && (
          <div className="mx-[15px] mb-6">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#FFE593] rounded-[15px] border-2 border-white shadow-[0_8px_20px_rgba(0,0,0,0.05)] p-[15px] flex items-center justify-between relative"
            >
              <div className="flex flex-col gap-1">
                <span className="text-[12px] font-medium text-[#5D4037]">本期帳單：</span>
                <span className="text-[15px] font-bold text-stone-700">
                  {billingPeriod.start.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })} - {billingPeriod.end.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })}
                </span>
              </div>
              
              <div className="flex flex-col items-end gap-1">
                <span className="text-[12px] font-medium text-[#5D4037]">本期累計：</span>
                <div className="flex items-baseline overflow-hidden max-w-[150px]">
                  <span className={`font-bold text-rose-500 transition-all duration-200 ${
                    totalSpending.toLocaleString().length > 10 ? 'text-lg' : 
                    totalSpending.toLocaleString().length > 7 ? 'text-xl' : 'text-[22px]'
                  }`}>
                    $ {totalSpending.toLocaleString()}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Transaction List Container - Pulled up */}
        <div className="bg-white rounded-t-[40px] shadow-[0_-10px_40px_rgba(0,0,0,0.02)] mt-2 min-h-[500px]">
          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-[#5D4037]">
                {isCreditCard ? '當期刷卡明細' : '往來明細'}
              </h2>
              <span className="text-xs text-stone-400 font-medium">{filteredTransactions.length} 筆紀錄</span>
            </div>
            
            <div className="space-y-4">
              {filteredTransactions.length > 0 ? filteredTransactions.map(t => {
                const isTransfer = t.type === 'transfer';
                const isOut = t.accountId === account.id;
                const isIn = t.toAccountId === account.id;
                
                let displayType = t.type;
                let displaySign = '';
                let displayColor = 'text-stone-400';
                
                if (isTransfer) {
                  if (isOut) {
                    displaySign = '-';
                    displayColor = 'text-rose-500';
                  } else if (isIn) {
                    displaySign = '+';
                    displayColor = 'text-blue-500';
                  }
                } else {
                  displaySign = t.type === 'income' ? '+' : '-';
                  displayColor = t.type === 'income' ? 'text-blue-500' : 'text-rose-500';
                }

                return (
                  <div key={t.id} className="flex items-center justify-between p-4 bg-stone-50 rounded-[22px] border-2 border-white shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[#FFE593]/40 rounded-full flex items-center justify-center text-xl shadow-inner">
                        {getCategoryEmoji(t.category)}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-[#5D4037] text-base">
                          {isTransfer ? (
                            isOut ? `轉帳至 ${accounts.find(a => a.id === t.toAccountId)?.name.split('\n')[0]}` :
                            `來自 ${accounts.find(a => a.id === t.accountId)?.name.split('\n')[0]} 的轉帳`
                          ) : t.category}
                        </span>
                        <span className="text-[11px] text-stone-400 font-medium">
                          {t.date.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    <span className={`font-black text-lg ${displayColor}`}>
                      {displaySign}$ {t.amount.toLocaleString()}
                    </span>
                  </div>
                );
              }) : (
                <div className="py-24 flex flex-col items-center justify-center text-stone-300 gap-4">
                  <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center">
                    <Search className="w-8 h-8 opacity-20" />
                  </div>
                  <span className="italic font-medium">尚無明細紀錄</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isCalculatorOpen && (
          <BalanceCalculatorModal 
            initialValue={account.amount}
            initialName={account.name}
            initialClosingDay={account.closingDay}
            isCredit={isCreditCard}
            onClose={() => setIsCalculatorOpen(false)}
            onSave={(newAmount, newName, newClosingDay) => {
              onUpdateAccount(newAmount, newName, newClosingDay);
              setIsCalculatorOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function BalanceCalculatorModal({ initialValue, initialName, initialClosingDay, isCredit, onClose, onSave }: { 
  initialValue: number, 
  initialName: string,
  initialClosingDay?: number,
  isCredit: boolean,
  onClose: () => void, 
  onSave: (amount: number, name: string, closingDay?: number) => void 
}) {
  const [display, setDisplay] = useState(String(initialValue));
  const [accountName, setAccountName] = useState(initialName);
  const [closingDay, setClosingDay] = useState(String(initialClosingDay || 10));
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const calculate = (left: number, right: number, op: string) => {
    switch (op) {
      case '+': return left + right;
      case '−': return left - right;
      case '×': return left * right;
      case '÷': return right !== 0 ? left / right : 0;
      default: return right;
    }
  };

  const handleKeyPress = (key: string) => {
    if (/[0-9]/.test(key)) {
      if (waitingForOperand) {
        setDisplay(key);
        setWaitingForOperand(false);
      } else {
        setDisplay(display === '0' ? key : display + key);
      }
    } else if (key === '.') {
      if (waitingForOperand) {
        setDisplay('0.');
        setWaitingForOperand(false);
      } else if (!display.includes('.')) {
        setDisplay(display + '.');
      }
    } else if (key === '=') {
      if (operator && prevValue !== null) {
        const inputValue = parseFloat(display);
        const result = calculate(prevValue, inputValue, operator);
        setDisplay(String(result));
        setPrevValue(null);
        setOperator(null);
        setWaitingForOperand(true);
      }
    } else if (['+', '−', '×', '÷'].includes(key)) {
      const inputValue = parseFloat(display);
      if (waitingForOperand && operator) {
        setOperator(key);
        return;
      }
      if (prevValue === null) {
        setPrevValue(inputValue);
      } else if (operator) {
        const result = calculate(prevValue, inputValue, operator);
        setPrevValue(result);
        setDisplay(String(result));
      }
      setWaitingForOperand(true);
      setOperator(key);
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setPrevValue(null);
    setOperator(null);
    setWaitingForOperand(false);
  };

  const handleConfirm = () => {
    let finalAmount = parseFloat(display);
    if (operator && prevValue !== null && !waitingForOperand) {
      finalAmount = calculate(prevValue, finalAmount, operator);
    }
    onSave(finalAmount, accountName, isCredit ? parseInt(closingDay) : undefined);
  };

  const formatDisplay = (val: string) => {
    if (val === '0') return '0';
    const parts = val.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  const keys = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '.', '0', '=', '+'];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#5D4037]/40 backdrop-blur-sm z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="bg-[#FFFDF5] w-full max-w-md rounded-t-[20px] shadow-2xl overflow-hidden border-t-[4px] border-white flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{ height: '90vh', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex-shrink-0 flex items-center justify-between px-6 pt-3 pb-0">
          <button onClick={onClose} className="p-2 text-[#5D4037] hover:bg-stone-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-[22px] font-bold text-[#5D4037] whitespace-nowrap">修改帳戶餘額</h2>
          <div className="w-10" />
        </div>

        <div className="px-6 pt-1 pb-1 flex flex-col gap-1.5">
          {/* Account Name Input - Compressed */}
          <div className="flex flex-col gap-1">
            <label className="text-stone-600 text-[13px] font-bold ml-2 whitespace-nowrap">帳戶名稱</label>
            <input 
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="例如：台新 Richart"
              className="w-full h-[42px] bg-white border-2 border-[#FFE593]/50 rounded-[10px] px-4 py-1 text-[#5D4037] text-[16px] font-bold focus:outline-none focus:border-[#FFE593] transition-all shadow-sm"
            />
          </div>

          {/* Closing Day Input - Compressed */}
          {isCredit && (
            <div className="flex flex-col gap-1">
              <label className="text-stone-600 text-[13px] font-bold ml-2 whitespace-nowrap">帳單設定</label>
              <div className="bg-white border-2 border-[#FFE593] rounded-[10px] h-[42px] px-[15px] py-[4px] flex items-center shadow-sm">
                <CalendarDays className="w-[16px] h-[16px] text-[#5D4037] mr-[8px]" />
                <span className="text-[14px] text-[#5D4037] whitespace-nowrap">每月結帳日：</span>
                <div className="flex-1 flex justify-end items-center">
                  <select
                    value={closingDay}
                    onChange={(e) => setClosingDay(e.target.value)}
                    className="bg-transparent text-[#5D4037] font-bold text-[16px] outline-none cursor-pointer appearance-none text-right"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                      <option key={day} value={day}>{day} 號</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Slim Balance Card - 60px Height Label Tape Style */}
          <div className="bg-white border-2 border-[#FFE593] rounded-[12px] h-[60px] px-4 shadow-sm flex items-center justify-between overflow-hidden mt-1">
            <span className="text-stone-500 text-[14px] font-bold flex-shrink-0">餘額</span>
            <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
              <div className="flex-1 min-w-0 text-right overflow-hidden">
                <span className={`font-black text-[#5D4037] whitespace-nowrap transition-all duration-200 ${
                  display.length > 12 ? 'text-lg' : 
                  display.length > 9 ? 'text-xl' : 
                  display.length > 7 ? 'text-2xl' : 'text-[28px]'
                }`}>
                  $ {formatDisplay(display)}
                </span>
              </div>
              <button onClick={handleClear} className="text-xs font-bold text-rose-400 hover:text-rose-500 flex-shrink-0">AC</button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-end">
          <div className="bg-[#FFF9E3] rounded-t-[35px] pt-2 pb-2 px-8 shadow-[0_-15px_50px_rgba(0,0,0,0.05)] flex-1 flex flex-col justify-between">
            <div className="grid grid-cols-4 gap-x-3 gap-y-1">
              {keys.map((key) => {
                const isOperatorKey = ['÷', '×', '−', '+'].includes(key);
                return (
                  <motion.button
                    key={key}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleKeyPress(key)}
                    className={`
                      aspect-[1.8/1] rounded-[8px] text-lg font-bold border-2 border-white shadow-sm
                      flex items-center justify-center transition-all
                      ${isOperatorKey ? 'bg-[#FFD54F] text-[#5D4037]' : 'bg-white text-[#5D4037]'}
                    `}
                  >
                    {key}
                  </motion.button>
                );
              })}
            </div>

            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={handleConfirm}
              className="w-full h-[42px] bg-[#FFD54F] text-[#5D4037] rounded-[12px] font-bold text-base border-[3px] border-white shadow-lg transition-all mt-1"
            >
              確認修改
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// --- Sub-components ---

function CalendarStrip({ selectedDate, onDateSelect }: { selectedDate: Date, onDateSelect: (d: Date) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const result = [];
    for (let i = 1; i <= lastDay; i++) {
      result.push(new Date(year, month, i));
    }
    return result;
  }, [selectedDate.getFullYear(), selectedDate.getMonth()]);

  // Scroll to selected date on mount or month change
  useEffect(() => {
    if (scrollRef.current) {
      const selectedIdx = selectedDate.getDate() - 1;
      const element = scrollRef.current.children[selectedIdx] as HTMLElement;
      if (element) {
        scrollRef.current.scrollTo({
          left: element.offsetLeft - scrollRef.current.offsetWidth / 2 + element.offsetWidth / 2,
          behavior: 'smooth'
        });
      }
    }
  }, [selectedDate.getMonth(), selectedDate.getFullYear()]);

  return (
    <div ref={scrollRef} className="h-[70px] flex px-[10px] gap-2 overflow-x-auto no-scrollbar scroll-smooth">
      {days.map((date, idx) => {
        const isSelected = date.toDateString() === selectedDate.toDateString();
        
        return (
          <div 
            key={idx} 
            onClick={() => onDateSelect(date)}
            className={`
              min-w-[50px] h-[54px] m-2 flex items-center justify-center rounded-[15px] border-2 border-white shadow-[0_4px_4px_rgba(0,0,0,0.05)] cursor-pointer transition-all
              ${isSelected ? 'bg-[#FFD54F]' : 'bg-white'}
            `}
          >
            <span className={`text-base ${isSelected ? 'font-bold' : 'font-normal'} text-[#5D4037]`}>
              {date.getDate()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StatItem({ label, value, color }: { label: string, value: string, color: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[13px] text-stone-400 mb-2">{label}</span>
      <span className={`text-xl font-bold ${color}`}>{value}</span>
    </div>
  );
}

function SummaryCard({ title, subtitle, expense, income }: { title: string, subtitle: string, expense: string, income: string }) {
  return (
    <div className="bg-white/70 p-[15px] rounded-[20px] border border-white flex items-center justify-between shadow-sm">
      <div className="flex flex-col">
        <span className="text-base font-bold text-[#5D4037] mb-1">{title}</span>
        <span className="text-[10px] text-stone-300">{subtitle}</span>
      </div>
      <div className="flex flex-col items-end">
        <span className="text-rose-400 text-sm">{expense}</span>
        <span className="text-blue-400 text-sm">{income}</span>
      </div>
    </div>
  );
}

interface AccountItemProps {
  key?: React.Key;
  icon: string;
  name: string;
  amount: string;
  bgColor: string;
  onClick?: () => void;
}

function AccountItem({ icon, name, amount, bgColor, onClick }: AccountItemProps) {
  const amountValue = parseFloat(amount.replace(/,/g, ''));

  return (
    <motion.div 
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`${bgColor} p-[15px] rounded-[20px] border-[2px] border-white shadow-[0_10px_20px_rgba(0,0,0,0.05)] flex items-center transition-all cursor-pointer min-h-[75px] py-[12px]`}
    >
      {/* Icon - Fixed width */}
      <div className="w-10 h-10 flex items-center justify-center bg-white/50 rounded-full mr-3 flex-shrink-0">
        <span className="text-xl">{icon}</span>
      </div>

      {/* Content Column */}
      <div className="flex-1 flex flex-col items-start justify-center min-w-0">
        <span className="text-[18px] font-bold text-[#5D4037] truncate w-full">
          {name}
        </span>
        <div className="h-1" /> {/* Spacing (SizedBox height 4) */}
        <span className={`text-[16px] font-medium ${amountValue < 0 ? 'text-rose-500' : 'text-[#5D4037]'}`}>
          $ {amount}
        </span>
      </div>
    </motion.div>
  );
}

interface ExpansionAccountItemProps {
  key?: React.Key;
  groupName: string;
  accounts: Account[];
  onAccountClick: (acc: Account) => void;
}

function ExpansionAccountItem({ 
  groupName, 
  accounts, 
  onAccountClick 
}: ExpansionAccountItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const totalAmount = accounts.reduce((sum, acc) => sum + acc.amount, 0);
  
  if (accounts.length === 1) {
    const acc = accounts[0];
    return (
      <AccountItem 
        icon={acc.icon} 
        name={acc.name} 
        amount={acc.amount.toLocaleString()} 
        bgColor={acc.type === 'credit' ? 'bg-[#FEE2E2]' : acc.type === 'cash' ? 'bg-[#FFE593]' : 'bg-white'} 
        onClick={() => onAccountClick(acc)}
      />
    );
  }

  return (
    <div className="space-y-2">
      <motion.div 
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(!isOpen)}
        className="bg-white p-[15px] rounded-[20px] border-[2px] border-white shadow-[0_10px_20px_rgba(0,0,0,0.05)] flex items-center transition-all cursor-pointer min-h-[75px]"
      >
        <div className="w-10 h-10 flex items-center justify-center bg-stone-100 rounded-full mr-3 flex-shrink-0">
          <span className="text-xl">🏦</span>
        </div>
        
        {/* Content Column */}
        <div className="flex-1 flex flex-col items-start justify-center min-w-0">
          <span className="text-[18px] font-bold text-[#5D4037] truncate w-full">
            {groupName}
          </span>
          <div className="h-1" /> {/* Spacing */}
          <span className={`text-[16px] font-medium ${totalAmount < 0 ? 'text-rose-500' : 'text-[#5D4037]'}`}>
            $ {totalAmount.toLocaleString()}
          </span>
          <span className="text-stone-400 text-[10px] mt-0.5">共 {accounts.length} 個帳戶</span>
        </div>

        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
          className="ml-2"
        >
          <ChevronDown className="text-stone-400 w-5 h-5" />
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden space-y-2 pl-4"
          >
            {accounts.map(acc => (
              <AccountItem 
                key={acc.id}
                icon={acc.icon} 
                name={acc.name} 
                amount={acc.amount.toLocaleString()} 
                bgColor="bg-[#FFF9E3]/50" 
                onClick={() => onAccountClick(acc)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${active ? 'text-[#5D4037]' : 'text-gray-400'}`}
      style={{ minWidth: '80px' }}
    >
      <div className="w-7 h-7 flex items-center justify-center">
        {React.cloneElement(icon as React.ReactElement, { size: 28 })}
      </div>
      <span className="text-[14px] font-bold">{label}</span>
    </div>
  );
}

function AddAccountModal({ onClose, onSave }: { onClose: () => void, onSave: (name: string, type: string, amount: number, closingDay?: number) => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('💰 現金');
  const [amount, setAmount] = useState('0');
  const [closingDay, setClosingDay] = useState('10');

  const types = ['💰 現金', '🏦 銀行', '📈 投資', '💳 信用卡', '🚌 電子票證', '🎁 其他'];
  const isCredit = type === '💳 信用卡';

  const formatDisplay = (val: string) => {
    if (val === '0') return '0';
    const parts = val.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#5D4037]/40 backdrop-blur-sm z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="bg-[#FFFDF5] w-full max-w-md rounded-t-[30px] shadow-2xl overflow-hidden border-t-[4px] border-white flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{ height: '85vh' }}
      >
        <div className="flex-shrink-0 flex items-center justify-between px-6 pt-6 pb-2">
          <div className="w-10" />
          <h2 className="text-[22px] font-bold text-[#5D4037] whitespace-nowrap">新增帳戶</h2>
          <button onClick={onClose} className="p-2 text-[#5D4037] hover:bg-stone-100 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 no-scrollbar">
          {/* 1. 帳戶名稱 */}
          <div className="space-y-2">
            <label className="text-[16px] font-bold text-stone-600 ml-1 whitespace-nowrap">帳戶名稱</label>
            <div className="bg-white rounded-[15px] shadow-sm border-2 border-white overflow-hidden">
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="請輸入帳戶名稱，如：國泰證券"
                className="w-full px-5 py-4 text-[20px] text-[#5D4037] placeholder-stone-300 outline-none bg-transparent font-bold"
              />
            </div>
          </div>

          {/* 2. 帳戶類型 */}
          <div className="space-y-2">
            <label className="text-[16px] font-bold text-stone-600 ml-1 whitespace-nowrap">帳戶類型</label>
            <div className="flex flex-wrap gap-3">
              {types.map(t => {
                const isSelected = type === t;
                return (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`px-5 py-3 rounded-[15px] text-[18px] border-2 transition-all duration-200 ${
                      isSelected 
                      ? 'bg-[#FFE593] text-[#5D4037] border-white shadow-md font-bold' 
                      : 'bg-white text-[#5D4037] border-white/50 shadow-sm font-normal'
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. 初始金額 */}
          <div className="space-y-2">
            <label className="text-[16px] font-bold text-stone-600 ml-1 whitespace-nowrap">初始金額</label>
            <div className="bg-white rounded-[15px] shadow-sm border-2 border-[#FFE593] overflow-hidden flex items-center px-5 h-[70px]">
              <span className="text-[#5D4037]/30 text-[12px] font-bold mr-3">TWD</span>
              <div className="flex-1 text-right overflow-hidden">
                {/* FittedBox logic: scaleDown behavior using dynamic text sizing */}
                <input 
                  type="number" 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={`w-full text-right font-black text-[#5D4037] outline-none bg-transparent transition-all duration-200 ${
                    amount.length > 18 ? 'text-[10px]' :
                    amount.length > 15 ? 'text-[12px]' : 
                    amount.length > 12 ? 'text-[16px]' : 
                    amount.length > 9 ? 'text-[20px]' : 
                    amount.length > 7 ? 'text-[24px]' : 'text-[32px]'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* 4. 結帳日 (Only for Credit Card) */}
          {isCredit && (
            <div className="space-y-2">
              <label className="text-[16px] font-bold text-stone-600 ml-1 whitespace-nowrap">帳單設定</label>
              <div className="bg-white rounded-[12px] border-2 border-[#FFE593] px-[15px] py-[8px] flex items-center h-[50px] shadow-sm">
                <CalendarDays className="w-[18px] h-[18px] text-[#5D4037] mr-[10px]" />
                <span className="text-[18px] text-[#5D4037] whitespace-nowrap">每月結帳日：</span>
                <div className="flex-1 flex justify-end items-center">
                  <select
                    value={closingDay}
                    onChange={(e) => setClosingDay(e.target.value)}
                    className="bg-transparent text-[#5D4037] font-bold text-[18px] outline-none cursor-pointer appearance-none text-right"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                      <option key={day} value={day}>{day} 號</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-[11px] text-stone-400 ml-1 italic">💡 系統將根據結帳日自動統計每期消費</p>
            </div>
          )}
        </div>

        <div className="p-6">
          <motion.button 
            whileTap={{ scale: 0.92 }}
            onClick={() => onSave(name, type, parseFloat(amount) || 0, isCredit ? parseInt(closingDay) : undefined)}
            className="w-full h-[60px] bg-[#FFD54F] text-[#5D4037] rounded-[20px] font-bold text-lg border-[3px] border-white shadow-lg transition-all"
          >
            完成新增
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CalendarScreen({ 
  onBack, 
  records, 
  selectedDate, 
  onDateSelect,
  onEditRecord
}: { 
  onBack: () => void, 
  records: Transaction[], 
  selectedDate: Date,
  onDateSelect: (date: Date) => void,
  onEditRecord: (record: Transaction) => void
}) {
  const [viewDate, setViewDate] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  
  const daysInMonth = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days = [];
    const firstDayOfWeek = firstDay.getDay();
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  }, [viewDate]);

  const dailyTotals = useMemo(() => {
    const totals: Record<string, { expense: number, income: number }> = {};
    records.forEach(r => {
      const dateStr = r.date.toDateString();
      if (!totals[dateStr]) totals[dateStr] = { expense: 0, income: 0 };
      if (r.type === 'expense') totals[dateStr].expense += r.amount;
      if (r.type === 'income') totals[dateStr].income += r.amount;
    });
    return totals;
  }, [records]);

  const selectedDayRecords = useMemo(() => {
    return records.filter(r => r.date.toDateString() === selectedDate.toDateString());
  }, [records, selectedDate]);

  const selectedDayStats = useMemo(() => {
    const stats = { income: 0, expense: 0, balance: 0 };
    selectedDayRecords.forEach(r => {
      if (r.type === 'income') stats.income += r.amount;
      if (r.type === 'expense') stats.expense += r.amount;
    });
    stats.balance = stats.income - stats.expense;
    return stats;
  }, [selectedDayRecords]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full bg-[#FFF9E3]"
    >
      {/* Month Navigation Bar */}
      <div className="bg-[#F59E0B] h-12 flex items-center justify-between px-4 flex-none">
        <button onClick={onBack} className="p-2 text-[#5D4037] hover:bg-black/5 rounded-full transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
            className="p-2 text-[#5D4037] hover:bg-black/5 rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-[20px] font-bold text-[#5D4037] flex items-center">
            <span>{viewDate.getFullYear()}</span>
            <span className="mx-[10px]">/</span>
            <span>{String(viewDate.getMonth() + 1).padStart(2, '0')}</span>
          </h2>
          <button 
            onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
            className="p-2 text-[#5D4037] hover:bg-black/5 rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5 rotate-180" />
          </button>
        </div>
        <div className="w-10" />
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {/* Calendar Grid */}
        <div className="px-4 py-2 bg-[#FFF9E3]">
          <div className="grid grid-cols-7 mb-1">
            {['日', '一', '二', '三', '四', '五', '六'].map((d, idx) => (
              <div key={d} className={`text-center text-xs font-bold py-1 ${idx === 0 || idx === 6 ? 'text-[#F59E0B] opacity-70' : 'text-stone-400'}`}>
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {daysInMonth.map((date, idx) => {
              if (!date) return <div key={`empty-${idx}`} className="h-[48px]" />;
              
              const isSelected = date.toDateString() === selectedDate.toDateString();
              const isToday = date.toDateString() === new Date().toDateString();
              const dayOfWeek = date.getDay();
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
              const dailyExpense = dailyTotals[date.toDateString()]?.expense || 0;
              
              return (
                <div 
                  key={date.toISOString()} 
                  onClick={() => onDateSelect(date)}
                  className="flex flex-col items-center justify-start h-[48px] cursor-pointer relative"
                >
                  <div className={`
                    w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold transition-all
                    ${isSelected ? 'bg-[#5D4037] text-white' : isToday ? 'bg-[#FFD54F] text-[#5D4037]' : isWeekend ? 'text-[#F59E0B] opacity-70' : 'text-[#5D4037]'}
                  `}>
                    {date.getDate()}
                  </div>
                  {dailyExpense > 0 && (
                    <div className="text-[9px] font-bold text-rose-500 mt-0.5">
                      {dailyExpense}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Daily Details List (Bottom part) */}
        <div className="bg-white rounded-t-[30px] shadow-[0_-10px_30px_rgba(0,0,0,0.05)] flex flex-col min-h-[400px]">
          {/* Summary Row - Compressed */}
          <div className="px-6 py-3 flex justify-between items-center border-b border-stone-50">
            <div className="text-center">
              <div className="text-[9px] text-stone-400 font-bold mb-0.5">收入</div>
              <div className="text-xs font-bold text-blue-400">+{selectedDayStats.income}</div>
            </div>
            <div className="text-center">
              <div className="text-[9px] text-stone-400 font-bold mb-0.5">支出</div>
              <div className="text-xs font-bold text-rose-400">-{selectedDayStats.expense}</div>
            </div>
            <div className="text-center">
              <div className="text-[9px] text-stone-400 font-bold mb-0.5">結餘</div>
              <div className="text-xs font-bold text-[#5D4037]">{selectedDayStats.balance}</div>
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[#5D4037]">
                {selectedDate.toLocaleDateString()} 明細
              </h3>
              <span className="text-xs font-bold text-stone-400">
                共 {selectedDayRecords.length} 筆
              </span>
            </div>
            
            <div className="space-y-3">
              {selectedDayRecords.length > 0 ? (
                selectedDayRecords.map(record => (
                  <motion.div 
                    key={record.id} 
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onEditRecord(record)}
                    className="flex items-center justify-between p-3 bg-[#FFFDF5] rounded-[15px] border border-stone-100 cursor-pointer active:bg-stone-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-xl shadow-sm">
                        {getCategoryEmoji(record.category.split(' - ')[0])}
                      </div>
                      <div>
                        <div className="font-bold text-[#5D4037]">{record.category}</div>
                        <div className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">
                          {record.type === 'expense' ? '支出' : record.type === 'income' ? '收入' : '轉帳'}
                        </div>
                      </div>
                    </div>
                    <div className={`font-black ${record.type === 'expense' ? 'text-rose-400' : record.type === 'income' ? 'text-blue-400' : 'text-[#5D4037]'}`}>
                      {record.type === 'expense' ? '-' : record.type === 'income' ? '+' : ''} ${record.amount}
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 opacity-30">
                  <div className="text-4xl mb-2">🍃</div>
                  <div className="text-sm font-bold">這天沒有紀錄喔</div>
                </div>
              )}
            </div>
          </div>
          
          {/* Bottom Buffer */}
          <div className="h-10" />
        </div>
      </div>
    </motion.div>
  );
}

function DeleteConfirmDialog({ onCancel, onConfirm }: { onCancel: () => void, onConfirm: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#5D4037]/60 backdrop-blur-sm z-[60] flex items-center justify-center p-6"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-[#FFF9E3] w-full max-w-[300px] rounded-[20px] shadow-2xl overflow-hidden p-6 flex flex-col items-center text-center"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mb-4">
          <Trash2 className="w-8 h-8 text-rose-500" />
        </div>
        <h3 className="text-xl font-bold text-[#5D4037] mb-2">確定要刪除嗎？</h3>
        <p className="text-[#5D4037]/70 text-sm mb-6 leading-relaxed">
          刪除後資料將無法復原，<br />相關帳戶餘額也會自動調整。
        </p>
        <div className="flex w-full gap-3">
          <button 
            onClick={onCancel}
            className="flex-1 py-3 text-[#5D4037]/50 font-bold hover:bg-stone-100 rounded-[15px] transition-colors"
          >
            再想想
          </button>
          <button 
            onClick={onConfirm}
            className="flex-1 py-3 text-rose-500 font-black hover:bg-rose-50 rounded-[15px] transition-colors"
          >
            確定刪除
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function RecordModal({ 
  onClose, 
  onSave, 
  onDelete,
  accounts, 
  initialRecord 
}: { 
  onClose: () => void, 
  onSave: (amount: number, cat: string, type: 'income' | 'expense' | 'transfer', accountId?: string, toAccountId?: string, date?: Date, recordId?: string) => void, 
  onDelete?: (id: string) => void,
  accounts: Account[],
  initialRecord?: Transaction | null
}) {
  const [display, setDisplay] = useState('0');
  const [mainCategory, setMainCategory] = useState('食物');
  const [subCategory, setSubCategory] = useState('午晚餐');
  const [type, setType] = useState<'income' | 'expense' | 'transfer'>('expense');
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id || '');
  const [toAccountId, setToAccountId] = useState<string>(accounts[1]?.id || accounts[0]?.id || '');
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [recordDate, setRecordDate] = useState(new Date());
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectionStep, setSelectionStep] = useState<'account' | 'mainCategory' | 'subCategory'>('account');
  const dateInputRef = useRef<HTMLInputElement>(null);
  const currentYear = new Date().getFullYear();

  const categoryMap: Record<string, string[]> = {
    '食物': ['午晚餐', '咖啡下午茶', '烘焙材料', '零食'],
    '娛樂': ['K-pop 周邊', '電影', '演唱會', '遊戲'],
    '投資': ['ETF 加碼', '美股', '台股', '基金'],
    '生活': ['交通', '購物', '醫療', '日用品'],
  };

  useEffect(() => {
    if (initialRecord) {
      setDisplay(String(initialRecord.amount));
      const [main, sub] = initialRecord.category.split(' - ');
      setMainCategory(main || '食物');
      setSubCategory(sub || (categoryMap[main] ? categoryMap[main][0] : '午晚餐'));
      setType(initialRecord.type);
      setSelectedAccountId(initialRecord.accountId || accounts[0]?.id || '');
      setToAccountId(initialRecord.toAccountId || accounts[1]?.id || accounts[0]?.id || '');
      setRecordDate(new Date(initialRecord.date));
      setSelectionStep('subCategory');
    }
  }, [initialRecord, accounts]);

  useEffect(() => {
    if (!initialRecord && type !== 'transfer') {
      setSelectionStep('account');
    }
  }, [type, initialRecord]);

  const mainCategories = Object.keys(categoryMap);

  const calculate = (left: number, right: number, op: string) => {
    switch (op) {
      case '+': return left + right;
      case '−': return left - right;
      case '×': return left * right;
      case '÷': return right !== 0 ? left / right : 0;
      default: return right;
    }
  };

  const handleKeyPress = (key: string) => {
    if (/[0-9]/.test(key)) {
      if (waitingForOperand) {
        setDisplay(key);
        setWaitingForOperand(false);
      } else {
        setDisplay(display === '0' ? key : display + key);
      }
    } else if (key === '.') {
      if (waitingForOperand) {
        setDisplay('0.');
        setWaitingForOperand(false);
      } else if (!display.includes('.')) {
        setDisplay(display + '.');
      }
    } else if (key === '=') {
      if (operator && prevValue !== null) {
        const inputValue = parseFloat(display);
        const result = calculate(prevValue, inputValue, operator);
        setDisplay(String(result));
        setPrevValue(null);
        setOperator(null);
        setWaitingForOperand(true);
      }
    } else if (['+', '−', '×', '÷'].includes(key)) {
      const inputValue = parseFloat(display);
      
      if (waitingForOperand && operator) {
        setOperator(key);
        return;
      }

      if (prevValue === null) {
        setPrevValue(inputValue);
      } else if (operator) {
        const result = calculate(prevValue, inputValue, operator);
        setPrevValue(result);
        setDisplay(String(result));
      }
      setWaitingForOperand(true);
      setOperator(key);
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setPrevValue(null);
    setOperator(null);
    setWaitingForOperand(false);
  };

  const handleBackspace = () => {
    if (waitingForOperand) return;
    if (display.length === 1) {
      setDisplay('0');
    } else {
      setDisplay(display.slice(0, -1));
    }
  };

  const handleConfirm = () => {
    let finalAmount = parseFloat(display);
    if (operator && prevValue !== null && !waitingForOperand) {
      finalAmount = calculate(prevValue, finalAmount, operator);
    }
    onSave(finalAmount, type === 'transfer' ? '轉帳' : `${mainCategory} - ${subCategory}`, type, selectedAccountId, type === 'transfer' ? toAccountId : undefined, recordDate, initialRecord?.id);
  };

  const formatDisplay = (val: string) => {
    if (val === '0') return '0';
    const parts = val.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  const keys = [
    '7', '8', '9', '÷',
    '4', '5', '6', '×',
    '1', '2', '3', '−',
    '.', '0', '=', '+',
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#5D4037]/40 backdrop-blur-sm z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="bg-[#FFFDF5] w-full max-w-md rounded-t-[30px] shadow-2xl overflow-hidden border-t-[4px] border-white flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{ height: '95vh' }}
      >
        {/* Header */}
        <div className="flex-shrink-0 relative flex items-center justify-between px-4 pt-6 pb-2">
          <button onClick={onClose} className="p-2 text-[#5D4037] hover:bg-stone-100 rounded-full transition-colors z-10">
            <X className="w-6 h-6" />
          </button>
          <h2 className="absolute left-1/2 -translate-x-1/2 text-xl font-bold text-[#5D4037]">
            {initialRecord ? '修改紀錄' : '記一筆'}
          </h2>
          
          {initialRecord ? (
            <button 
              onClick={() => setIsDeleteDialogOpen(true)} 
              className="p-2 text-rose-500 hover:bg-rose-50 rounded-full transition-colors z-10"
            >
              <Trash2 className="w-6 h-6" />
            </button>
          ) : (
            <div className="w-10" />
          )}
        </div>

        <div className="px-4 pb-2 flex justify-center">
          <div 
            onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()}
            className="bg-[#FFF9E3] border border-[#5D4037]/20 rounded-[10px] px-3 py-1.5 flex items-center gap-2 cursor-pointer shadow-sm hover:bg-[#FFF4D0] transition-colors"
          >
            <CalendarDays className="w-4 h-4 text-[#5D4037]" />
            <span className="text-[15px] font-bold text-[#5D4037]">
              {recordDate.getFullYear()}/{String(recordDate.getMonth() + 1).padStart(2, '0')}/{String(recordDate.getDate()).padStart(2, '0')}
            </span>
            <input 
              type="date"
              ref={dateInputRef}
              className="sr-only"
              min={`${currentYear - 10}-01-01`}
              max={`${currentYear + 10}-12-31`}
              value={recordDate.toISOString().split('T')[0]}
              onChange={(e) => {
                const d = new Date(e.target.value);
                if (!isNaN(d.getTime())) setRecordDate(d);
              }}
            />
          </div>
        </div>

        <AnimatePresence>
          {isDeleteDialogOpen && (
            <DeleteConfirmDialog 
              onCancel={() => setIsDeleteDialogOpen(false)}
              onConfirm={() => {
                if (initialRecord) {
                  onDelete?.(initialRecord.id);
                  setIsDeleteDialogOpen(false);
                }
              }}
            />
          )}
        </AnimatePresence>

        <div className="flex-1 relative overflow-y-auto no-scrollbar">
          <div className="flex flex-col min-h-full">
            {/* Type Toggle - Now inside scrollable area */}
            <div className="flex justify-center px-6 mb-2 mt-2">
              <div className="bg-stone-100 p-1 rounded-full flex items-center w-full max-w-[320px] border-2 border-white shadow-inner">
                <button 
                  onClick={() => setType('expense')}
                  className={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all ${type === 'expense' ? 'bg-[#5D4037] text-white shadow-md' : 'text-stone-400'}`}
                >
                  支出
                </button>
                <button 
                  onClick={() => setType('income')}
                  className={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all ${type === 'income' ? 'bg-[#5D4037] text-white shadow-md' : 'text-stone-400'}`}
                >
                  收入
                </button>
                <button 
                  onClick={() => setType('transfer')}
                  className={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all ${type === 'transfer' ? 'bg-[#5D4037] text-white shadow-md' : 'text-stone-400'}`}
                >
                  轉帳
                </button>
              </div>
            </div>

            {/* 1. Selectors Section */}
            <div className="px-6 pt-1 pb-1 flex flex-col gap-1">
              {type === 'transfer' ? (
                <div className="flex flex-col gap-2">
                  {/* From Account Selector */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-stone-400 uppercase ml-1">轉出帳戶</span>
                    <div className="h-[100px] flex items-center gap-3 overflow-x-auto pb-2 flex-nowrap no-scrollbar">
                      {accounts.map(acc => (
                        <button
                          key={`from-${acc.id}`}
                          onClick={() => setSelectedAccountId(acc.id)}
                          className={`flex-shrink-0 w-[80px] h-[85px] flex flex-col items-center justify-center gap-1 rounded-[18px] border-2 transition-all ${
                            selectedAccountId === acc.id 
                            ? 'bg-[#FFD54F] text-[#5D4037] border-white shadow-md scale-105' 
                            : 'bg-white text-[#5D4037] border-white shadow-sm'
                          }`}
                        >
                          <span className="text-2xl">{acc.icon}</span>
                          <span className="text-[11px] font-bold whitespace-nowrap overflow-hidden text-ellipsis w-full px-1 text-center">
                            {acc.name.split('\n')[0]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Transfer Arrow */}
                  <div className="flex justify-center -my-2">
                    <div className="bg-[#FFE593] p-1 rounded-full shadow-sm border-2 border-white z-10">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-[#5D4037]">
                        <path d="M7 10l5 5 5-5" />
                        <path d="M12 15V3" />
                      </svg>
                    </div>
                  </div>

                  {/* To Account Selector */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-stone-400 uppercase ml-1">轉入帳戶</span>
                    <div className="h-[100px] flex items-center gap-3 overflow-x-auto pb-2 flex-nowrap no-scrollbar">
                      {accounts.map(acc => (
                        <button
                          key={`to-${acc.id}`}
                          onClick={() => setToAccountId(acc.id)}
                          className={`flex-shrink-0 w-[80px] h-[85px] flex flex-col items-center justify-center gap-1 rounded-[18px] border-2 transition-all ${
                            toAccountId === acc.id 
                            ? 'bg-[#FFD54F] text-[#5D4037] border-white shadow-md scale-105' 
                            : 'bg-white text-[#5D4037] border-white shadow-sm'
                          }`}
                        >
                          <span className="text-2xl">{acc.icon}</span>
                          <span className="text-[11px] font-bold whitespace-nowrap overflow-hidden text-ellipsis w-full px-1 text-center">
                            {acc.name.split('\n')[0]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {/* Breadcrumbs Navigation */}
                  <div className="flex items-center gap-1 ml-1 mb-1">
                    <button 
                      onClick={() => setSelectionStep('account')}
                      className={`text-[10px] font-bold transition-colors ${selectionStep === 'account' ? 'text-[#5D4037]' : 'text-stone-400 hover:text-stone-600'}`}
                    >
                      {accounts.find(a => a.id === selectedAccountId)?.name.split('\n')[0] || '帳戶'}
                    </button>
                    <span className="text-[10px] text-stone-300 mx-0.5">&gt;</span>
                    <button 
                      onClick={() => setSelectionStep('mainCategory')}
                      className={`text-[10px] font-bold transition-colors ${selectionStep === 'mainCategory' ? 'text-[#5D4037]' : 'text-stone-400 hover:text-stone-600'}`}
                    >
                      {mainCategory}
                    </button>
                    <span className="text-[10px] text-stone-300 mx-0.5">&gt;</span>
                    <button 
                      onClick={() => setSelectionStep('subCategory')}
                      className={`text-[10px] font-bold transition-colors ${selectionStep === 'subCategory' ? 'text-[#5D4037]' : 'text-stone-400 hover:text-stone-600'}`}
                    >
                      {subCategory}
                    </button>
                  </div>

                  {/* Dynamic Selection Area */}
                  <div className="h-[100px] relative overflow-hidden">
                    <AnimatePresence mode="wait">
                      {selectionStep === 'account' && (
                        <motion.div 
                          key="step-account"
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="h-full flex items-center gap-3 overflow-x-auto pb-2 flex-nowrap no-scrollbar"
                        >
                          {accounts.map(acc => (
                            <button
                              key={acc.id}
                              onClick={() => {
                                setSelectedAccountId(acc.id);
                                setSelectionStep('mainCategory');
                              }}
                              className={`flex-shrink-0 w-[80px] h-[85px] flex flex-col items-center justify-center gap-1 rounded-[18px] border-2 transition-all ${
                                selectedAccountId === acc.id 
                                ? 'bg-[#FFD54F] text-[#5D4037] border-white shadow-md scale-105' 
                                : 'bg-white text-[#5D4037] border-white shadow-sm'
                              }`}
                            >
                              <span className="text-2xl">{acc.icon}</span>
                              <span className="text-[11px] font-bold whitespace-nowrap overflow-hidden text-ellipsis w-full px-1 text-center">
                                {acc.name.split('\n')[0]}
                              </span>
                            </button>
                          ))}
                        </motion.div>
                      )}

                      {selectionStep === 'mainCategory' && (
                        <motion.div 
                          key="step-main"
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="h-full flex items-center gap-3 overflow-x-auto pb-2 flex-nowrap no-scrollbar"
                        >
                          {mainCategories.map(cat => (
                            <button
                              key={cat}
                              onClick={() => {
                                setMainCategory(cat);
                                setSubCategory(categoryMap[cat][0]);
                                setSelectionStep('subCategory');
                              }}
                              className={`flex-shrink-0 w-[80px] h-[85px] flex flex-col items-center justify-center gap-1 rounded-[18px] border-2 transition-all ${
                                mainCategory === cat 
                                ? 'bg-[#FFD54F] text-[#5D4037] border-white shadow-md scale-105' 
                                : 'bg-white text-[#5D4037] border-white shadow-sm'
                              }`}
                            >
                              <span className="text-2xl">{getCategoryEmoji(cat)}</span>
                              <span className="text-[11px] font-bold whitespace-nowrap">{cat}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}

                      {selectionStep === 'subCategory' && (
                        <motion.div 
                          key="step-sub"
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="h-full flex items-center gap-3 overflow-x-auto pb-2 flex-nowrap no-scrollbar"
                        >
                          {categoryMap[mainCategory].map(tag => (
                            <button
                              key={tag}
                              onClick={() => setSubCategory(tag)}
                              className={`flex-shrink-0 w-[80px] h-[85px] rounded-[18px] border-2 transition-all whitespace-nowrap text-[12px] font-bold shadow-sm ${
                                subCategory === tag 
                                ? 'bg-[#5D4037] text-white border-[#5D4037]' 
                                : 'bg-white text-[#5D4037] border-white'
                              }`}
                            >
                              {tag}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Amount Box */}
              <div className="bg-white border-2 border-[#FFD54F] rounded-[18px] h-[50px] px-4 shadow-sm flex items-center justify-between overflow-hidden">
                <span className="text-[#5D4037]/30 text-[11px] font-bold flex-shrink-0">TWD</span>
                <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                  <div className="flex-1 min-w-0 text-right overflow-hidden">
                    <span className={`font-black text-[#5D4037] whitespace-nowrap transition-all duration-200 ${
                      display.length > 12 ? 'text-lg' : 
                      display.length > 9 ? 'text-xl' : 
                      display.length > 7 ? 'text-2xl' : 'text-3xl'
                    }`}>
                      {formatDisplay(display)}
                    </span>
                  </div>
                  <button onClick={handleClear} className="w-8 h-8 flex items-center justify-center rounded-full bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors">
                    <span className="text-[10px] font-bold">AC</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Calculator Keyboard */}
            <div className="flex-1 flex flex-col justify-end">
              <div className="bg-[#FFF9E3] rounded-t-[35px] pt-3 pb-4 px-6 shadow-[0_-15px_40px_rgba(0,0,0,0.05)] pb-[calc(env(safe-area-inset-bottom)+10px)]">
                <div className="grid grid-cols-4 gap-x-3 gap-y-[4px] mb-3">
                  {keys.map((key) => {
                    const isOperatorKey = ['÷', '×', '−', '+'].includes(key);
                    const isEqualKey = key === '=';
                    return (
                      <motion.button
                        key={key}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleKeyPress(key)}
                        className={`
                          aspect-[1.6/1] rounded-[15px] text-[18px] font-bold border-2 border-white shadow-[0_2px_4px_rgba(0,0,0,0.04)]
                          flex items-center justify-center transition-all
                          ${isEqualKey ? 'bg-[#5D4037] text-white' : 
                            isOperatorKey ? 'bg-[#FFD54F] text-[#5D4037]' : 
                            'bg-white text-[#5D4037]'}
                        `}
                      >
                        {key}
                      </motion.button>
                    );
                  })}
                </div>

                {/* 3. Large Save Button */}
                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  onClick={handleConfirm}
                  className="w-full h-[50px] bg-[#5D4037] text-white rounded-[20px] font-bold text-lg border-[3px] border-white shadow-lg transition-all active:shadow-inner"
                >
                  {type === 'transfer' ? '確認轉帳' : '儲存紀錄'}
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

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
  Banknote
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Types ---

interface Transaction {
  id: string;
  amount: number;
  category: string;
  date: string; // YYYY-MM-DD
  type: 'income' | 'expense' | 'transfer';
  accountId: string;
  toAccountId?: string;
}

interface Account {
  id: string;
  name: string;
  amount: number;
  type: 'cash' | 'bank' | 'investment' | 'credit' | 'e-ticket';
  icon: string;
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
  { id: 'cash', name: '現金', amount: 3500, type: 'cash', icon: '💰' },
  { id: 'bank_ts', name: '台新銀行 - 活存', amount: 175800, type: 'bank', icon: '🏦' },
  { id: 'inv_cathay', name: '國泰證券 (006208)', amount: 450000, type: 'investment', icon: '📈' },
  { id: 'credit_ts', name: '台新信用卡', amount: -8240, type: 'credit', icon: '💳' },
  { id: 'easycard', name: '悠遊卡', amount: 500, type: 'e-ticket', icon: '🚌' },
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
    return saved ? JSON.parse(saved) : [];
  });
  const [accounts, setAccounts] = useState<Account[]>(() => {
    const saved = localStorage.getItem('kk_adv_accounts');
    return saved ? JSON.parse(saved) : INITIAL_ACCOUNTS;
  });
  const [templates, setTemplates] = useState<Template[]>(() => {
    const saved = localStorage.getItem('kk_adv_templates');
    return saved ? JSON.parse(saved) : INITIAL_TEMPLATES;
  });
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('kk_adv_records', JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    localStorage.setItem('kk_adv_accounts', JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    localStorage.setItem('kk_adv_templates', JSON.stringify(templates));
  }, [templates]);

  const totalAssets = useMemo(() => {
    return accounts.reduce((sum, acc) => sum + acc.amount, 0);
  }, [accounts]);

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
    
    setAccounts(prev => prev.map(acc => {
      if (acc.id === record.accountId) {
        if (record.type === 'income') return { ...acc, amount: acc.amount + record.amount };
        if (record.type === 'expense') return { ...acc, amount: acc.amount - record.amount };
        if (record.type === 'transfer') return { ...acc, amount: acc.amount - record.amount };
      }
      if (record.type === 'transfer' && acc.id === record.toAccountId) {
        return { ...acc, amount: acc.amount + record.amount };
      }
      return acc;
    }));
    setIsRecordModalOpen(false);
  };

  return (
    <div className="h-screen bg-[#FFF9E3] font-sans text-[#5D4037] flex flex-col overflow-hidden select-none">
      {/* Header */}
      <header className="px-4 py-4 flex items-center justify-between">
        <Menu className="w-6 h-6" />
        <div className="text-lg font-bold">2026 / 04</div>
        <CalendarIcon className="w-6 h-6 cursor-pointer" onClick={() => setCurrentView('calendar')} />
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
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
              totalAssets={totalAssets} 
            />
          )}
          {currentView === 'calendar' && (
            <CalendarView 
              records={records} 
              onBack={() => setCurrentView('home')}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-stone-100 h-20 flex items-center justify-around px-4 z-40">
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

function AccountsView({ accounts, totalAssets }: { accounts: Account[], totalAssets: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="flex flex-col gap-4 px-4"
    >
      <div className="bg-[#FFD54F] p-5 rounded-[20px] shadow-sm border-2 border-white flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-xl">💰</span>
          <span className="font-bold">總資產</span>
        </div>
        <span className="text-2xl font-black">$ {totalAssets.toLocaleString()}</span>
      </div>

      <div className="flex flex-col gap-3">
        {accounts.map(acc => (
          <div 
            key={acc.id} 
            className={`p-4 rounded-[20px] shadow-sm border-2 border-white flex items-center justify-between ${acc.type === 'cash' ? 'bg-[#FFECB3]' : acc.type === 'credit' ? 'bg-rose-50' : 'bg-white'}`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/50 rounded-full flex items-center justify-center text-xl shadow-inner">
                {acc.icon}
              </div>
              <div className="flex flex-col">
                <span className="font-bold">{acc.name}</span>
                {acc.type === 'bank' && <span className="text-[10px] text-stone-400">共 2 個帳戶</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-lg font-black ${acc.amount < 0 ? 'text-rose-400' : ''}`}>
                $ {acc.amount.toLocaleString()}
              </span>
              {acc.type === 'bank' && <ChevronDown className="w-4 h-4 text-stone-300" />}
            </div>
          </div>
        ))}
      </div>

      <button className="h-16 bg-[#FFD54F] rounded-full flex items-center justify-center gap-2 shadow-sm border-2 border-white mt-4">
        <Plus className="w-6 h-6 bg-white rounded-full p-1" />
        <span className="font-bold text-lg">新增帳戶</span>
      </button>

      <div className="text-center py-4">
        <p className="text-[10px] text-stone-400 italic">💡 這裡可以管理您的 ETF 與存款資產</p>
      </div>
    </motion.div>
  );
}

function CalendarView({ records, onBack }: { records: Transaction[], onBack: () => void }) {
  const selectedDay = 17;
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 bg-white z-50 flex flex-col"
    >
      <div className="bg-[#F59E0B] text-white p-4 flex items-center justify-between">
        <ChevronLeft className="cursor-pointer" onClick={onBack} />
        <div className="flex items-center gap-4 font-bold">
          <ChevronLeft className="w-4 h-4" />
          <span>2026 / 03</span>
          <ChevronRight className="w-4 h-4" />
        </div>
        <div />
      </div>

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

      <div className="flex justify-around py-3 border-b border-stone-100 text-[10px] font-bold">
        <div className="flex flex-col items-center"><span className="text-stone-300">收入</span><span className="text-blue-400">+0</span></div>
        <div className="flex flex-col items-center"><span className="text-stone-300">支出</span><span className="text-rose-400">-763</span></div>
        <div className="flex flex-col items-center"><span className="text-stone-300">結餘</span><span className="text-[#5D4037]">-763</span></div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex justify-between items-center"><span className="font-bold">2026/3/17 明細</span><span className="text-xs text-stone-400">共 1 筆</span></div>
        <div className="bg-white p-4 rounded-[20px] shadow-sm border border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center text-xl">🍱</div>
            <div className="flex flex-col"><span className="font-bold">食物</span><span className="text-[10px] text-stone-300">支出</span>Base</div>
          </div>
          <span className="text-lg font-black text-rose-400">- $763</span>
        </div>
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
  const [showCalculator, setShowCalculator] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  const handleKey = (key: string) => {
    if (key === 'AC') { setAmount('0'); return; }
    if (key === '=') {
      onSave({ 
        amount: parseFloat(amount), 
        category: subCategory || mainCategory || '其他', 
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
          <X className="w-6 h-6 cursor-pointer" onClick={onClose} />
          <span className="text-lg font-bold">記一筆</span>
          <div className="flex items-center gap-1 bg-white px-3 py-1 rounded-full border border-stone-100 shadow-sm">
            <CalendarIcon className="w-3 h-3" />
            <span className="text-[10px] font-bold">2026/04/12</span>
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
        <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-6">
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
            </div>
          )}
        </div>

        {/* Fixed Bottom Section (Amount & Calculator) */}
        <div className="flex flex-col gap-3 bg-[#FFFDF5] pt-2">
          {tab !== 'template' && (
            <>
              {/* Amount Box */}
              <div 
                onClick={() => setShowCalculator(true)}
                className="bg-white border-2 border-[#FFD54F] rounded-[20px] p-3 flex items-center justify-between shadow-inner cursor-pointer"
              >
                <span className="text-xs font-bold text-stone-300">TWD</span>
                <div className="flex items-center gap-4">
                  <span className="text-3xl font-black">{amount}</span>
                  <button onClick={(e) => { e.stopPropagation(); handleKey('AC'); }} className="w-8 h-8 bg-rose-50 text-rose-400 rounded-full flex items-center justify-center font-bold text-[10px]">AC</button>
                </div>
              </div>

              {/* Animated Calculator */}
              <AnimatePresence>
                {showCalculator && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden flex flex-col gap-3"
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
                      <button 
                        onClick={() => setShowCalculator(false)}
                        className="flex items-center gap-1 text-[10px] font-bold text-blue-400"
                      >
                        <ChevronDown size={12} className="rotate-180" />
                        修改
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      {['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', '.', '0', '=', '+'].map(k => (
                        <button 
                          key={k}
                          onClick={() => handleKey(k)}
                          className={`h-11 rounded-xl flex items-center justify-center text-lg font-bold shadow-sm ${['÷', '×', '-', '+', '='].includes(k) ? 'bg-[#FFD54F] text-[#5D4037]' : k === '=' ? 'bg-[#5D4037] text-white' : 'bg-white text-[#5D4037]'}`}
                        >
                          {k}
                        </button>
                      ))}
                    </div>
                    <button 
                      onClick={() => handleKey('=')}
                      className="w-full py-4 bg-[#5D4037] text-white rounded-[20px] font-black text-lg shadow-lg mb-2"
                    >
                      儲存紀錄
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
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
                <h3 className="text-lg font-bold">編輯範本</h3>
                <X className="w-5 h-5 cursor-pointer text-stone-300" onClick={() => setEditingTemplate(null)} />
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

import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  Plus, 
  Eye, 
  EyeOff, 
  HelpCircle, 
  ChevronDown, 
  Pencil, 
  History, 
  AlertCircle, 
  Trash2, 
  Edit3, 
  Check,
  X,
  ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Account, Transaction, Category } from './types';
import { HorizontalScrollArea } from './components/Common';
import { getCategoryIcon, getFontFamily } from './lib/financeUtils';

function renderAccountMemoAndInterest(acc: Account, balances: Record<string, number>, className = "mx-5 mb-4") {
  const isCredit = acc.type === 'credit';
  const hasInterest = acc.interestRate !== undefined;

  if (!isCredit && !hasInterest) return null;

  return (
    <div className={`${className} flex flex-col gap-1 border-t border-stone-100/50 pt-1.5`} style={getFontFamily()}>
      {isCredit && (
        <>
          {acc.benefits && (
            <div className="text-[11px] text-[#5D4037]/80 bg-[#FFD54F]/20 px-2 py-0.5 rounded-lg inline-block self-start font-bold truncate max-w-full" title={acc.benefits} style={getFontFamily()}>
              🎁 {acc.benefits}
            </div>
          )}
          {(acc.statementDate || acc.closingDay || acc.dueDate) && (
            <div className="text-[10px] font-bold text-stone-400 flex items-center gap-2 flex-wrap" style={getFontFamily()}>
              {(acc.statementDate || acc.closingDay) && <span>📅 結帳日: {acc.statementDate || acc.closingDay}日</span>}
              {acc.dueDate && <span>⏰ 繳款日: {acc.dueDate}日</span>}
            </div>
          )}
        </>
      )}
      {hasInterest && (
        <div className="text-[10px] font-bold text-stone-400 flex flex-wrap items-center gap-1.5" style={getFontFamily()}>
          <span className="text-blue-500 font-bold">％ 年利率: {acc.interestRate}%</span>
          {acc.interestLimit && <span className="bg-stone-100 text-stone-400 px-1 rounded">額度上限 ${acc.interestLimit.toLocaleString()}</span>}
          {(() => {
            const bal = balances[acc.id] || 0;
            if (bal <= 0) return null;
            const effectiveBal = acc.interestLimit ? Math.min(bal, acc.interestLimit) : bal;
            const rate = acc.interestRate || 0;
            const monthlyInt = (effectiveBal * rate / 100) / 12;
            return (
              <span className="text-[#5D4037]/80 font-black">
                預估月息: +$ {Math.round(monthlyInt).toLocaleString()}
              </span>
            );
          })()}
        </div>
      )}
    </div>
  );
}

export const INITIAL_ACCOUNTS: Account[] = [
  { id: 'cash', name: '現金', type: 'cash', icon: '💰', currency: 'TWD', order: 1 },
  { id: 'bank_ts_group', name: '台新銀行', type: 'bank', icon: '🏦', currency: 'TWD', order: 2 },
  { id: 'bank_ts_1', name: '台新 - 活存', type: 'bank', icon: '🏦', parentId: 'bank_ts_group', currency: 'TWD', order: 3 },
  { id: 'bank_ts_2', name: '台新 - 儲蓄', type: 'bank', icon: '🏦', parentId: 'bank_ts_group', currency: 'TWD', order: 4 },
  { id: 'inv_cathay', name: '國泰證券 (006208)', type: 'investment', icon: '📈', currency: 'TWD', order: 5 },
  { id: 'credit_ts', name: '台新信用卡', type: 'credit', icon: '💳', currency: 'TWD', order: 6 },
  { id: 'easycard', name: '悠遊卡', type: 'e-ticket', icon: '🚌', currency: 'TWD', order: 7 },
];

export function AccountsView({ accounts, netAssets, totalAssets, totalLiabilities, onAccountClick, onAddAccount, balances }: { 
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
      style={getFontFamily()}
    >
      {/* Top Dashboard */}
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
      <div className="flex flex-col gap-8 px-4 pb-12">
        {(Object.entries(groupedAccounts) as [Account['type'], Account[]][]).map(([type, typeAccounts]) => {
          const typeTotal = typeAccounts.reduce((sum, acc) => {
            return sum + (balances[acc.id] || 0);
          }, 0);

          return (
            <div key={type} className="flex flex-col gap-4">
              {/* Dynamic Header */}
              <div className="px-2 flex justify-between items-center border-b border-[#5D4037]/10 pb-2 mb-2">
                <span className="text-lg font-black text-[#5D4037]">{accountTypeLabels[type as Account['type']]}</span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-stone-300 uppercase tracking-wider">合計</span>
                  <span className={`text-sm font-black ${typeTotal < 0 ? 'text-rose-400' : 'text-stone-400'}`}>
                    $ {formatAmount(typeTotal)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {typeAccounts.map(acc => {
                  const children = accounts.filter(c => c.parentId === acc.id);
                  const isExpanded = expandedGroups.includes(acc.id);
                  const hasChildren = children.length > 0;
                  const displayAmount = balances[acc.id] || 0;

                  return (
                    <div 
                      key={acc.id} 
                      className="bg-white rounded-[28px] shadow-sm border-2 border-white flex flex-col overflow-hidden active:scale-[0.98] transition-all"
                    >
                      <div 
                        onClick={() => onAccountClick(acc)}
                        className="p-5 flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-14 h-14 bg-[#FFFDF5] rounded-2xl flex-shrink-0 flex items-center justify-center text-3xl shadow-sm border border-white">
                            {acc.icon}
                          </div>
                          <div className="flex flex-col justify-center">
                            <span className="text-[10px] font-bold text-stone-300 uppercase">{accountTypeLabels[acc.type]}</span>
                            <span className="font-black text-[#5D4037] text-xl leading-tight">{acc.name}</span>
                            <span className={`text-2xl font-black mt-1 ${displayAmount < 0 ? 'text-rose-400' : 'text-[#5D4037]'}`}>
                              $ {formatAmount(displayAmount)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {hasChildren && (
                            <button 
                              onClick={(e) => toggleGroup(acc.id, e)}
                              className="w-10 h-10 bg-stone-50 rounded-full flex items-center justify-center transition-colors"
                            >
                              <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
                                <ChevronDown className="w-5 h-5 text-stone-300" />
                              </motion.div>
                            </button>
                          )}
                        </div>
                      </div>

                      {renderAccountMemoAndInterest(acc, balances)}

                      <AnimatePresence>
                        {hasChildren && isExpanded && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-stone-50/30 flex flex-col gap-3 px-5 pb-5 border-t border-stone-50"
                          >
                            {children.map(child => (
                              <div 
                                key={child.id}
                                onClick={() => onAccountClick(child)}
                                className="p-4 bg-white rounded-2xl border border-white shadow-sm flex flex-col gap-1 cursor-pointer active:scale-[0.95] transition-transform"
                              >
                                <div className="flex items-center justify-between w-full">
                                  <div className="flex items-center gap-3 flex-1">
                                    <div className="w-10 h-10 bg-stone-50 rounded-full flex-shrink-0 flex items-center justify-center text-xl">{child.icon}</div>
                                    <div className="flex flex-col">
                                      <span className="text-[10px] font-bold text-stone-300">{child.name}</span>
                                      <span className={`text-base font-black ${balances[child.id] < 0 ? 'text-rose-400' : 'text-[#5D4037]'}`}>
                                        $ {formatAmount(balances[child.id] || 0)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                {renderAccountMemoAndInterest(child, balances, "mt-2")}
                              </div>
                            ))}
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

      <div className="h-[120px] w-full" />
    </motion.div>
  );
}

export function AccountDetailView({ account, records, onBack, onEdit, onUpdateRecord, onDeleteRecord, accounts, balance, categories }: { 
  account: Account, 
  records: Transaction[],
  onBack: () => void,
  onEdit: () => void,
  onUpdateRecord: (old: Transaction, updated: Transaction) => void,
  onDeleteRecord: (record: Transaction) => void,
  accounts: Account[],
  balance: number,
  categories: Category[]
}) {
  const [editingRecord, setEditingRecord] = useState<Transaction | null>(null);
  
  const accountRecords = useMemo(() => {
    const childrenIds = accounts.filter(c => c.parentId === account.id).map(c => c.id);
    const targetIds = [account.id, ...childrenIds];
    
    return records.filter(r => (targetIds.includes(r.accountId) || (r.toAccountId && targetIds.includes(r.toAccountId))) && r.category !== '初始資金')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [records, account.id, accounts]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full bg-[#FFF9E3]"
      style={getFontFamily()}
    >
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
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-[#FFD54F]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-4 -top-4 w-24 h-24 bg-[#5D4037]/5 rounded-full blur-2xl pointer-events-none" />
        </div>
      </div>

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
                    {getCategoryIcon(record.category, record.type, categories)}
                  </div>
                  
                  <div className="flex-1 flex flex-col gap-1 min-w-0">
                    <span className="font-black text-lg text-[#5D4037] truncate leading-tight">
                      {(() => {
                        const base = (record.note || record.category).replace(/\[固定收支\] /g, '').replace(/\[固定收支\]/g, '').trim();
                        if (record.isInstallment && record.currentInstallment && record.totalInstallments) {
                          return `${base} (分期 ${record.currentInstallment}/${record.totalInstallments})`;
                        }
                        return base;
                      })()}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-stone-300">{record.date}</span>
                      {account.parentId === undefined && record.accountId !== account.id && (
                        <span className="text-[10px] px-2 py-0.5 bg-stone-100 text-stone-400 rounded-full font-bold">
                          {accounts.find(a => a.id === record.accountId)?.name}
                        </span>
                      )}
                    </div>
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
        <div className="h-[40px] w-full" />
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

export function EditRecordModal({ record, accounts, onClose, onSave, onDelete }: {
  record: Transaction,
  accounts: Account[],
  onClose: () => void,
  onSave: (updated: Transaction) => void,
  onDelete: () => void
}) {
  const [edited, setEdited] = useState<Transaction>({ ...record });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isInstallment, setIsInstallment] = useState(() => !!record.isInstallment);
  const [totalInstallments, setTotalInstallments] = useState(() => record.totalInstallments || 12);
  const [amountStr, setAmountStr] = useState<string>(() => {
    const amt = record.isInstallment && record.totalInstallments 
      ? Math.abs(record.amount) * record.totalInstallments 
      : Math.abs(record.amount);
    return amt === 0 ? '' : amt.toString();
  });

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
                <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-4 bg-white/20 rounded-2xl font-bold hover:bg-white/30 transition-colors">取消</button>
                <button onClick={onDelete} className="flex-1 py-4 bg-white text-rose-500 rounded-2xl font-black shadow-lg active:scale-95 transition-all">確定刪除</button>
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
          <button onClick={() => setShowDeleteConfirm(true)} className="p-3 text-rose-400 hover:bg-rose-50 rounded-2xl transition-colors active:scale-90">
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
                  placeholder="0"
                  value={amountStr}
                  onChange={e => {
                    const val = e.target.value;
                    setAmountStr(val);
                    const rawAmt = val === '' ? 0 : parseFloat(val) || 0;
                    setEdited({ 
                      ...edited, 
                      amount: edited.type === 'expense' || edited.type === 'transfer' ? -rawAmt : rawAmt 
                    });
                  }}
                  className="w-full p-4 pl-10 bg-white border-2 border-stone-50 rounded-2xl font-black text-2xl text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">分類</label>
              <input value={edited.category} onChange={e => setEdited({ ...edited, category: e.target.value })} className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">備註</label>
              <input value={edited.note || ''} onChange={e => setEdited({ ...edited, note: e.target.value })} className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all" placeholder="買了什麼？" />
            </div>
            {/* Installment Section */}
            {edited.type === 'expense' && (
              <div className="space-y-4 bg-white/50 p-4 rounded-2xl border border-stone-200/50 shadow-sm" style={getFontFamily()}>
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-bold text-[#5D4037]">分期付款</span>
                  <button 
                    type="button"
                    onClick={() => setIsInstallment(!isInstallment)}
                    className={`w-12 h-6 rounded-full transition-all relative ${isInstallment ? 'bg-[#5D4037]' : 'bg-stone-200'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isInstallment ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
                
                {isInstallment && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4 overflow-hidden">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-stone-300 uppercase">分期期數 (1-36)</label>
                        <input 
                          type="number"
                          min="1"
                          max="36"
                          value={totalInstallments}
                          onChange={e => setTotalInstallments(parseInt(e.target.value) || 1)}
                          className="w-full p-3 bg-white border-2 border-stone-50 rounded-xl font-bold text-sm text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-stone-300 uppercase">每期金額</label>
                        <div className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl font-bold text-sm text-[#5D4037]">
                          {Math.round(Math.abs(edited.amount) / totalInstallments)}
                        </div>
                      </div>
                    </div>
                    <div className="p-3 bg-amber-50/80 border border-amber-200/50 rounded-xl text-[11px] font-bold text-amber-800 leading-snug">
                      💡 編輯此項目將同步更新整組分期計畫的金額、名稱與其他屬性。
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">日期</label>
              <input type="date" value={edited.date} onChange={e => setEdited({ ...edited, date: e.target.value })} className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">帳戶</label>
              <select value={edited.accountId} onChange={e => setEdited({ ...edited, accountId: e.target.value })} className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm appearance-none focus:border-[#FFD54F] transition-all">
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-3 pt-2">
            <button 
              onClick={() => onSave({
                ...edited,
                isInstallment,
                totalInstallments: isInstallment ? totalInstallments : undefined
              })} 
              className="w-full py-5 bg-[#5D4037] text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"
            >
              <Check size={24} /> 儲存變更
            </button>
          </div>
          <div className="h-[40px]" />
        </div>
      </motion.div>
    </motion.div>
  );
}

export function AccountEditModal({ account, accounts, records, onClose, onSave, onDelete, onViewDetail }: { 
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
            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">帳戶名稱</label>
              <input value={editedAcc.name} onChange={e => setEditedAcc({ ...editedAcc, name: e.target.value })} className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all" placeholder="例如：台新銀行 - 活存" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">初始金額</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-stone-300 text-lg">$</span>
                <input type="number" disabled={!isNew} value={initialAmount} onChange={e => setInitialAmount(parseFloat(e.target.value) || 0)} className={`w-full p-4 pl-10 bg-white border-2 border-stone-50 rounded-2xl font-black text-xl text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all ${!isNew ? 'opacity-50 cursor-not-allowed' : ''}`} />
              </div>
              {!isNew && <p className="text-[10px] font-bold text-stone-300 px-1">現有帳戶不可修改初始金額</p>}
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">帳戶類型</label>
              <div className="flex flex-wrap gap-2">
                {accountTypes.map(t => (
                  <button key={t} onClick={() => setEditedAcc({ ...editedAcc, type: t })} className={`px-4 py-2 rounded-xl text-[10px] font-black border-2 transition-all ${editedAcc.type === t ? 'bg-[#5D4037] text-white border-[#5D4037] shadow-md' : 'bg-white text-stone-400 border-stone-50 shadow-sm'}`}>{t === 'cash' ? '現金' : t === 'bank' ? '銀行' : t === 'investment' ? '投資' : t === 'credit' ? '信用卡' : '電子票證'}</button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">帳戶幣別</label>
              <div className="flex flex-wrap gap-2">
                {['TWD', 'USD', 'JPY', 'EUR', 'CNY'].map(curr => (
                  <button key={curr} onClick={() => setEditedAcc({ ...editedAcc, currency: curr })} className={`px-4 py-2 rounded-xl text-[10px] font-black border-2 transition-all ${editedAcc.currency === curr ? 'bg-[#5D4037] text-white border-[#5D4037] shadow-md' : 'bg-white text-stone-400 border-stone-50 shadow-sm'}`}>{curr}</button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">選擇圖示</label>
              <HorizontalScrollArea>
                {['💰', '🏦', '💳', '📔', '💵', '🪙', '📱', '🐷', '📈', '🏠', '🚗', '💼', '💎', '🛒', '🍱', '✈️', '🎮', '🎁'].map(icon => (
                  <button key={icon} onClick={() => setEditedAcc({ ...editedAcc, icon })} className={`flex-shrink-0 w-12 h-12 rounded-xl border-2 transition-all flex items-center justify-center text-xl ${editedAcc.icon === icon ? 'bg-[#FFD54F] border-[#FFD54F] shadow-md scale-110' : 'bg-white border-stone-50 shadow-sm'}`}>{icon}</button>
                ))}
              </HorizontalScrollArea>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">所屬主帳戶</label>
              <div className="relative">
                <select value={editedAcc.parentId || ''} onChange={e => setEditedAcc({ ...editedAcc, parentId: e.target.value || undefined })} className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl text-sm font-bold text-[#5D4037] outline-none shadow-sm appearance-none focus:border-[#FFD54F] transition-all">
                  <option value="">無 (作為主帳戶)</option>
                  {accounts.filter(a => !a.parentId && a.id !== editedAcc.id).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-300 pointer-events-none" />
              </div>
            </div>
            {(editedAcc.type === 'credit' || editedAcc.name.includes('卡')) && (
              <div className="space-y-4 border-t border-dashed border-stone-100 pt-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">信用卡優惠備忘</label>
                  <textarea 
                    value={editedAcc.benefits || ''} 
                    onChange={e => setEditedAcc({ ...editedAcc, benefits: e.target.value })} 
                    className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all min-h-[80px]" 
                    placeholder="例如：網購 3%、演唱會購票優惠"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">結帳日 (每月)</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        min="1" 
                        max="31" 
                        value={editedAcc.statementDate || editedAcc.closingDay || ''} 
                        onChange={e => {
                          const val = parseInt(e.target.value);
                          const updatedVal = isNaN(val) ? undefined : Math.min(31, Math.max(1, val));
                          setEditedAcc({ 
                            ...editedAcc, 
                            statementDate: updatedVal,
                            closingDay: updatedVal
                          });
                        }} 
                        className="w-full p-4 pr-8 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all" 
                        placeholder="1-31" 
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-stone-300">日</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">繳款日 (每月)</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        min="1" 
                        max="31" 
                        value={editedAcc.dueDate || ''} 
                        onChange={e => {
                          const val = parseInt(e.target.value);
                          setEditedAcc({ ...editedAcc, dueDate: isNaN(val) ? undefined : Math.min(31, Math.max(1, val)) });
                        }} 
                        className="w-full p-4 pr-8 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all" 
                        placeholder="1-31" 
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-stone-300">日</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {editedAcc.type === 'bank' && (
              <div className="space-y-4 border-t border-dashed border-stone-100 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">存款年利率 (%)</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        step="0.01" 
                        min="0" 
                        value={editedAcc.interestRate || ''} 
                        onChange={e => {
                          const val = parseFloat(e.target.value);
                          setEditedAcc({ ...editedAcc, interestRate: isNaN(val) ? undefined : val });
                        }} 
                        className="w-full p-4 pr-8 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all" 
                        placeholder="0.00" 
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-stone-300">%</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">高利限額 (選填)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-stone-300">$</span>
                      <input 
                        type="number" 
                        min="0" 
                        value={editedAcc.interestLimit || ''} 
                        onChange={e => {
                          const val = parseInt(e.target.value);
                          setEditedAcc({ ...editedAcc, interestLimit: isNaN(val) ? undefined : val });
                        }} 
                        className="w-full p-4 pl-7 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all" 
                        placeholder="不限" 
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 pt-4">
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-4 bg-stone-100 text-stone-400 rounded-2xl font-black text-lg active:scale-95 transition-all">取消</button>
              <button onClick={() => onSave(editedAcc, initialAmount)} className="flex-[2] py-4 bg-[#5D4037] text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"><Check size={24} /> 儲存</button>
            </div>
            {!isNew && (
              <div className="flex gap-3">
                {onViewDetail && <button onClick={() => onViewDetail(editedAcc)} className="flex-1 py-3 bg-white border-2 border-stone-50 text-[#5D4037] rounded-xl font-bold text-sm active:scale-95 transition-all">查看明細</button>}
                <button onClick={() => setShowDeleteConfirm(true)} className="flex-1 py-3 bg-rose-50 text-rose-400 rounded-xl font-bold text-sm active:scale-95 transition-all">刪除帳戶</button>
              </div>
            )}
          </div>
          <div className="h-[40px]" />
        </div>

        <AnimatePresence>
          {showDeleteConfirm && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#5D4037]/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-20 h-20 bg-rose-400 rounded-full flex items-center justify-center mb-6 shadow-lg"><Trash2 size={40} className="text-white" /></div>
              <h4 className="text-xl font-black text-white mb-2">確定要刪除嗎？</h4>
              <p className="text-white/60 text-sm mb-8 font-bold">刪除帳戶將會連同所有相關的明細紀錄一併移除，且無法復原。</p>
              <div className="flex flex-col w-full gap-3">
                <button onClick={() => onDelete(editedAcc.id)} className="w-full py-4 bg-rose-400 text-white rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all">確定刪除</button>
                <button onClick={() => setShowDeleteConfirm(false)} className="w-full py-4 bg-white/10 text-white rounded-2xl font-black text-lg active:scale-95 transition-all">我再想想</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

export function AccountSortModal({ accounts, onClose, onSave }: { 
  accounts: Account[], 
  onClose: () => void, 
  onSave: (newOrder: Account[]) => void 
}) {
  const [order, setOrder] = useState([...accounts]);

  const move = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...order];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= order.length) return;
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    setOrder(newOrder);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[80] flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="bg-[#FFFDF5] w-full max-w-sm rounded-[30px] flex flex-col shadow-2xl relative overflow-hidden max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-stone-50 flex items-center justify-between">
          <h3 className="text-xl font-black text-[#5D4037]">調整帳戶順序</h3>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors"><X size={24} className="text-stone-300" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
          {order.map((acc, idx) => (
            <div key={acc.id} className="p-4 bg-white rounded-2xl border border-stone-50 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">{acc.icon}</span>
                <span className="font-bold text-[#5D4037]">{acc.name}</span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => move(idx, 'up')} disabled={idx === 0} className="p-2 text-stone-300 hover:text-[#5D4037] disabled:opacity-20"><ChevronUp size={20} /></button>
                <button onClick={() => move(idx, 'down')} disabled={idx === order.length - 1} className="p-2 text-stone-300 hover:text-[#5D4037] disabled:opacity-20"><ChevronDown size={20} /></button>
              </div>
            </div>
          ))}
        </div>
        <div className="p-6">
          <button onClick={() => onSave(order)} className="w-full py-4 bg-[#5D4037] text-white rounded-2xl font-black shadow-xl active:scale-95 transition-all">儲存順序</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

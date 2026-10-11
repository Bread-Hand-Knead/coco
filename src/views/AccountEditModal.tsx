import { getFontFamily } from '../lib/financeUtils';
import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  Edit3,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Account, Transaction } from '../types';
import { convertCurrency } from '../lib/recordUtils';
import { checkAreAccountsSameBank, getBankKeyword } from '../lib/accountUtils';
import { HorizontalScrollArea } from '../components/Common';

export function AccountEditModal({ account, accounts, records, onClose, onSave, onDelete, onViewDetail }: { 
  account: Account, 
  accounts: Account[],
  records: Transaction[],
  onClose: () => void, 
  onSave: (acc: Account, initialAmount: number) => void,
  onDelete: (id: string) => void,
  onViewDetail?: (acc: Account) => void
}) {
  const accountTypes: Account['type'][] = ['cash', 'bank', 'investment', 'credit', 'e-ticket', 'e-payment', 'points', 'deposit', 'insurance', 'other'];
  const isNew = !(Array.isArray(accounts) ? accounts : []).find(a => a.id === account.id);
  const [editedAcc, setEditedAcc] = useState<Account>(() => {
    const baseAcc = { ...account };
    if (baseAcc.type === 'points' && baseAcc.excludeFromNetWorth === undefined) {
      baseAcc.excludeFromNetWorth = true;
    }
    // Migrate initialBalance from records if not present on account
    if (account.initialBalance !== undefined) return baseAcc;
    const initRec = (Array.isArray(records) ? records : []).find(r => r.accountId === account.id && r.category === '初始資金');
    const legacyInit = initRec ? (initRec.type === 'income' ? initRec.amount : -initRec.amount) : 0;
    return { ...baseAcc, initialBalance: legacyInit };
  });
  const [initialBalanceStr, setInitialBalanceStr] = useState<string>(
    (account.initialBalance !== undefined ? account.initialBalance : ((Array.isArray(records) ? records : []).find(r => r.accountId === account.id && r.category === '初始資金')?.amount || 0)) === 0 
      ? '' 
      : (account.initialBalance !== undefined ? account.initialBalance : ((Array.isArray(records) ? records : []).find(r => r.accountId === account.id && r.category === '初始資金')?.amount || 0)).toString()
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const prevParentId = useRef(editedAcc.parentId);
  const prevBankKey = useRef<string | null>(null);

  useEffect(() => {
    if (editedAcc.type !== 'credit') return;

    const parentAcc = editedAcc.parentId ? (Array.isArray(accounts) ? accounts : []).find(a => a.id === editedAcc.parentId) : undefined;
    const currentBankKey = getBankKeyword(editedAcc.name, parentAcc?.name);

    if (prevBankKey.current === null && currentBankKey) {
      prevBankKey.current = currentBankKey;
    }

    const parentIdChanged = editedAcc.parentId !== prevParentId.current;
    const bankKeyChanged = currentBankKey !== prevBankKey.current;

    if (isNew || parentIdChanged || bankKeyChanged) {
      const sameBankCard = (Array.isArray(accounts) ? accounts : []).find(a => {
        return checkAreAccountsSameBank(editedAcc, a, accounts);
      });

      if (sameBankCard) {
        const updates: Partial<Account> = {};
        if (sameBankCard.creditLimit !== undefined) {
          updates.creditLimit = convertCurrency(sameBankCard.creditLimit, sameBankCard.currency || 'TWD', editedAcc.currency || 'TWD', records, accounts);
        }
        if (sameBankCard.closingDay !== undefined) {
          updates.closingDay = sameBankCard.closingDay;
        }
        if (sameBankCard.billMonthOffset !== undefined) {
          updates.billMonthOffset = sameBankCard.billMonthOffset;
        }
        if (sameBankCard.customStatementLabels !== undefined) {
          updates.customStatementLabels = sameBankCard.customStatementLabels;
        }
        if (Object.keys(updates).length > 0) {
          setEditedAcc(prev => ({ ...prev, ...updates }));
        }
      }
    }

    prevParentId.current = editedAcc.parentId;
    prevBankKey.current = currentBankKey;
  }, [editedAcc.parentId, editedAcc.name, editedAcc.type, accounts, isNew]);

  const handleUploadIconImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 128;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/png');
          setEditedAcc(prev => ({ ...prev, icon: dataUrl }));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#5D4037]/40 backdrop-blur-md z-[70] flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="bg-[#FFF9E3] w-full max-w-sm rounded-[44px] flex flex-col shadow-2xl border-4 border-white overflow-hidden max-h-[90vh]"
        style={getFontFamily()}
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

        <div className="flex-1 overflow-y-auto px-8 py-2 space-y-6">
          <div className="space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">帳戶名稱</label>
              <input 
                value={editedAcc.name}
                onChange={e => setEditedAcc({ ...editedAcc, name: e.target.value })}
                className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
                placeholder="例如：台新銀行 - 活存"
                style={getFontFamily()}
              />
            </div>

            {/* Initial Amount */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">初始金額</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-stone-300 text-lg">$</span>
                <input 
                  type="number"
                  placeholder="0"
                  value={initialBalanceStr}
                  onChange={e => {
                    const val = e.target.value;
                    setInitialBalanceStr(val);
                    setEditedAcc({ ...editedAcc, initialBalance: val === '' ? 0 : parseFloat(val) || 0 });
                  }}
                  className="w-full p-4 pl-10 bg-white border-2 border-stone-50 rounded-2xl font-black text-xl text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
                  style={getFontFamily()}
                />
              </div>
            </div>

            {/* Type Selection */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1" style={getFontFamily()}>帳戶類型</label>
              <div className="flex flex-wrap gap-2">
                {accountTypes.map(t => {
                  const labelMap: Record<Account['type'], string> = {
                    cash: '現金',
                    bank: '銀行',
                    investment: '投資',
                    credit: '信用卡',
                    'e-ticket': '電子票證',
                    'e-payment': '電子支付',
                    points: '點數 / 虛擬資產',
                    deposit: '定存',
                    insurance: '保險',
                    other: '其他'
                  };
                  return (
                    <button 
                      key={t}
                      onClick={() => {
                        const isPoints = t === 'points';
                        setEditedAcc({
                          ...editedAcc,
                          type: t,
                          ...(isPoints ? { excludeFromNetWorth: true } : {})
                        });
                      }}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black border-2 transition-all ${editedAcc.type === t ? 'bg-[#5D4037] text-white border-[#5D4037] shadow-md' : 'bg-white text-stone-400 border-stone-50 shadow-sm'}`}
                      style={getFontFamily()}
                    >
                      {labelMap[t]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">幣別 (Currency)</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'TWD', label: '台幣' },
                  { id: 'USD', label: '美金' },
                  { id: 'JPY', label: '日圓' },
                  { id: 'KRW', label: '韓元' }
                ].map(cur => (
                  <button
                    key={cur.id}
                    onClick={() => setEditedAcc({ ...editedAcc, currency: cur.id })}
                    className={`py-3 rounded-xl font-bold text-sm border-2 transition-all ${editedAcc.currency === cur.id ? 'bg-[#5D4037] text-[#FFD54F] border-[#5D4037]' : 'bg-white text-stone-400 border-stone-50'}`}
                    style={getFontFamily()}
                  >
                    {cur.label} ({cur.id})
                  </button>
                ))}
              </div>
            </div>

            {/* Icon Selection */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">選擇圖示</label>
              <HorizontalScrollArea className="px-1">
                <div className="flex gap-2">
                  {/* Upload Custom Image Icon */}
                  <div className="relative flex-shrink-0">
                    <label className="w-12 h-12 rounded-xl border-2 border-dashed bg-white border-stone-300 shadow-sm flex flex-col items-center justify-center cursor-pointer hover:bg-stone-50 transition-all active:scale-95">
                      <Upload size={16} className="text-stone-400" />
                      <span className="text-[8px] font-black text-stone-400 mt-0.5" style={getFontFamily()}>上傳</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleUploadIconImage} 
                        className="hidden" 
                      />
                    </label>
                  </div>

                  {/* Render Custom Image Icon Preview if active */}
                  {editedAcc.icon && (editedAcc.icon.startsWith('data:image/') || editedAcc.icon.startsWith('http') || editedAcc.icon.startsWith('/')) && (
                    <div className="relative flex-shrink-0 w-12 h-12 rounded-xl border-2 border-[#FFD54F] bg-white shadow-md flex items-center justify-center overflow-hidden">
                      <img src={editedAcc.icon} className="w-full h-full object-contain p-1 select-none pointer-events-none" alt="custom-icon" />
                      <button 
                        type="button"
                        onClick={() => setEditedAcc({ ...editedAcc, icon: '💰' })}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center text-[8px] font-black shadow-sm"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Custom Emoji Input */}
                  <div className="relative flex-shrink-0">
                    <input 
                      type="text"
                      maxLength={4}
                      placeholder="⌨️"
                      className="w-12 h-12 rounded-xl border-2 bg-white border-stone-50 shadow-sm text-center text-xl outline-none focus:border-[#FFD54F] focus:ring-2 focus:ring-[#FFD54F]/20 transition-all placeholder:opacity-50"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.trim()) {
                          setEditedAcc({ ...editedAcc, icon: val.trim() });
                        }
                      }}
                    />
                  </div>

                  {['💰', '🏦', '💳', '📔', '💵', '🪙', '📱', '🛡️', '🐷', '📈', '🏠', '🚗', '💼', '💎', '🛒', '🍱', '✈️', '🎮', '🎁'].map(icon => (
                    <button 
                      key={icon}
                      onClick={() => setEditedAcc({ ...editedAcc, icon })}
                      className={`flex-shrink-0 w-12 h-12 rounded-xl border-2 transition-all flex items-center justify-center text-xl ${editedAcc.icon === icon ? 'bg-[#FFD54F] border-[#FFD54F] shadow-md scale-110' : 'bg-white border-stone-50 shadow-sm'}`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
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
                  {accounts
                    .filter(a => !a.parentId && a.id !== editedAcc.id)
                    .sort((a, b) => (a.order || 0) - (b.order || 0))
                    .map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-300 pointer-events-none" />
              </div>
            </div>

            {/* Exclude From Net Worth Toggle Switch */}
            <div className="p-4 bg-white border-2 border-stone-50 rounded-2xl flex items-center justify-between shadow-sm">
              <div className="flex flex-col gap-0.5 pr-2">
                <span className="font-black text-sm text-[#5D4037]" style={getFontFamily()}>不計入總資產 / 淨資產</span>
                <span className="text-[11px] font-bold text-stone-400 leading-tight" style={getFontFamily()}>
                  開啟後，此帳戶餘額將不計入個人總資產與淨資產統計（點數帳戶預設開啟）
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditedAcc({ ...editedAcc, excludeFromNetWorth: !editedAcc.excludeFromNetWorth })}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  editedAcc.excludeFromNetWorth ? 'bg-[#5D4037]' : 'bg-stone-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    editedAcc.excludeFromNetWorth ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Credit Card Fields */}
            {editedAcc.type === 'credit' && (
              <>
                {/* Credit Limit */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">信用總額度 (Credit Limit)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-stone-300 text-lg" style={getFontFamily()}>$</span>
                    <input 
                      type="number"
                      value={editedAcc.creditLimit || ''}
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        setEditedAcc({ ...editedAcc, creditLimit: isNaN(val) ? undefined : val });
                      }}
                      className="w-full p-4 pl-10 bg-white border-2 border-stone-50 rounded-2xl font-black text-xl text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all placeholder:text-stone-300"
                      placeholder="例如：100,000"
                      style={getFontFamily()}
                    />
                  </div>
                  <p className="text-[10px] font-bold text-stone-300 px-1" style={getFontFamily()}>設定總額度以計算可用信用額度與進度條</p>
                </div>

                {/* Credit Card Closing Day / Statement Date */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">信用卡結帳日</label>
                  <div className="relative">
                    <input 
                      type="number"
                      min="1"
                      max="31"
                      value={editedAcc.statementDate || editedAcc.closingDay || ''}
                      onChange={e => {
                        const val = parseInt(e.target.value);
                        const clampedVal = isNaN(val) ? undefined : Math.min(31, Math.max(1, val));
                        setEditedAcc({ ...editedAcc, statementDate: clampedVal, closingDay: clampedVal });
                      }}
                      className="w-full p-6 bg-white border-2 border-stone-50 rounded-[32px] font-black text-[#5D4037] text-2xl outline-none shadow-sm focus:border-[#FFD54F] transition-all placeholder:text-stone-300"
                      placeholder="輸入日期 (1-31)"
                      style={getFontFamily()}
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg border-2 border-stone-100 flex items-center justify-center text-stone-300">
                      <span className="text-sm font-black" style={getFontFamily()}>日</span>
                    </div>
                  </div>
                  <p className="text-[10px] font-bold text-stone-300 px-1" style={getFontFamily()}>設定結帳日以利後續計算帳單週期</p>
                </div>

                {/* Credit Card Due Date */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">每月繳款日</label>
                  <div className="relative">
                    <input 
                      type="number"
                      min="1"
                      max="31"
                      value={editedAcc.dueDate || ''}
                      onChange={e => {
                        const val = parseInt(e.target.value);
                        const clampedVal = isNaN(val) ? undefined : Math.min(31, Math.max(1, val));
                        setEditedAcc({ ...editedAcc, dueDate: clampedVal });
                      }}
                      className="w-full p-6 bg-white border-2 border-stone-50 rounded-[32px] font-black text-[#5D4037] text-2xl outline-none shadow-sm focus:border-[#FFD54F] transition-all placeholder:text-stone-300"
                      placeholder="輸入日期 (1-31)"
                      style={getFontFamily()}
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg border-2 border-stone-100 flex items-center justify-center text-stone-300">
                      <span className="text-sm font-black" style={getFontFamily()}>日</span>
                    </div>
                  </div>
                  <p className="text-[10px] font-bold text-stone-300 px-1" style={getFontFamily()}>設定繳款日以利帳單提醒</p>
                </div>

                {/* Credit Card Benefits */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">信用卡優惠備忘</label>
                  <textarea 
                    value={editedAcc.benefits || ''}
                    onChange={e => setEditedAcc({ ...editedAcc, benefits: e.target.value })}
                    className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] text-sm outline-none shadow-sm focus:border-[#FFD54F] transition-all placeholder:text-stone-300 min-h-[80px]"
                    placeholder="例如：網購 3%、演唱會購票優惠"
                    style={getFontFamily()}
                  />
                </div>
              </>
            )}

            {/* Bank/Deposit Account Fields */}
            {(editedAcc.type === 'bank' || editedAcc.type === 'deposit') && (
              <>
                {/* Interest Rate */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">存款年利率 (%)</label>
                  <div className="relative">
                    <input 
                      type="number"
                      step="0.01"
                      min="0"
                      value={editedAcc.interestRate !== undefined ? editedAcc.interestRate : ''}
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        setEditedAcc({ ...editedAcc, interestRate: isNaN(val) ? undefined : val });
                      }}
                      className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-black text-xl text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all placeholder:text-stone-300"
                      placeholder="例如：1.50"
                      style={getFontFamily()}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg border-2 border-stone-100 flex items-center justify-center text-stone-300">
                      <span className="text-sm font-black" style={getFontFamily()}>%</span>
                    </div>
                  </div>
                  <p className="text-[10px] font-bold text-stone-300 px-1" style={getFontFamily()}>設定年利率以自動估算每月利息</p>
                </div>

                {/* Interest Limit */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">高利活存額度上限</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-stone-300 text-lg" style={getFontFamily()}>$</span>
                    <input 
                      type="number"
                      min="0"
                      value={editedAcc.interestLimit !== undefined ? editedAcc.interestLimit : ''}
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        setEditedAcc({ ...editedAcc, interestLimit: isNaN(val) ? undefined : val });
                      }}
                      className="w-full p-4 pl-10 bg-white border-2 border-stone-50 rounded-2xl font-black text-xl text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all placeholder:text-stone-300"
                      placeholder="例如：100,000 (選填)"
                      style={getFontFamily()}
                    />
                  </div>
                  <p className="text-[10px] font-bold text-stone-300 px-1" style={getFontFamily()}>設定最高計息額度上限（選填）</p>
                </div>
              </>
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
                onClick={() => onSave(editedAcc, editedAcc.initialBalance || 0)}
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

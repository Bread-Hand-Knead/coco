import { getFontFamily } from '../lib/financeUtils';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Account, Transaction } from '../types';
import { convertCurrency, getLatestExchangeRate } from '../lib/recordUtils';
import { calculateAccountBalance, checkAreAccountsSameBank, getGroupedAndUngrouped, groupAccountsByInstitution, isImageIconString } from '../lib/accountUtils';
import { HorizontalScrollArea } from './Common';
import { ACCOUNT_TYPE_LABELS, defaultTypeOrder } from '../lib/defaults';

export function SafeAccountIcon({
  icon,
  name = '',
  className = "w-5 h-5 object-contain rounded inline-block mr-2"
}: {
  icon?: string;
  name?: string;
  className?: string;
}) {
  if (!icon) return null;
  if (isImageIconString(icon)) {
    return (
      <img
        src={icon}
        alt={name}
        className={className}
      />
    );
  }
  return <span className="mr-2 text-base">{icon}</span>;
}

export interface GroupedAccountDropdownProps {
  accounts: Account[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function GroupedAccountDropdown({
  accounts,
  value,
  onChange,
  placeholder = '選擇交割帳戶 / 點數戶',
}: GroupedAccountDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredAccounts = useMemo(() => {
    return (Array.isArray(accounts) ? accounts : []).filter(
      a => a.type === 'bank' || a.type === 'cash' || a.type === 'investment' || a.type === 'points'
    );
  }, [accounts]);

  const groupedAccounts = useMemo(() => {
    return groupAccountsByInstitution(filteredAccounts);
  }, [filteredAccounts]);

  const selectedAccount = useMemo(() => {
    return filteredAccounts.find(a => a.id === value);
  }, [filteredAccounts, value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative w-full max-w-full">
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-sm text-[#5D4037] flex items-center justify-between shadow-sm hover:border-[#FFD54F] transition-all cursor-pointer box-border max-w-full overflow-hidden"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 pr-2 truncate">
          {selectedAccount ? (
            <>
              <SafeAccountIcon icon={selectedAccount.icon || '🏦'} name={selectedAccount.name} className="w-5 h-5 object-contain rounded shrink-0 inline-block mr-1" />
              <span className="truncate font-black text-[#5D4037]">{selectedAccount.name}</span>
              <span className="text-xs text-stone-400 font-normal shrink-0">
                ({selectedAccount.type === 'points' ? '點數' : selectedAccount.currency})
              </span>
            </>
          ) : (
            <span className="text-stone-400 font-medium truncate">{placeholder}</span>
          )}
        </div>
        <ChevronDown size={18} className={`text-stone-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-[300] top-full left-0 right-0 w-full max-w-full mt-1 bg-white border-2 border-stone-100 rounded-2xl shadow-xl max-h-60 overflow-y-auto overflow-x-hidden p-2 space-y-2 box-border custom-scrollbar"
          >
            {groupedAccounts.length === 0 ? (
              <div className="p-3 text-center text-xs text-stone-400 font-medium">沒有可選擇的帳戶</div>
            ) : (
              groupedAccounts.map(group => (
                <div key={group.groupName} className="space-y-1">
                  <div className="text-[11px] font-black text-stone-500 bg-stone-100/90 px-2.5 py-1 rounded-lg border border-stone-200/40 sticky top-0 z-10 backdrop-blur-xs truncate">
                    {group.groupName}
                  </div>
                  <div className="space-y-0.5">
                    {group.accounts.map(acc => {
                      const isSelected = acc.id === value;
                      return (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => {
                            onChange(acc.id);
                            setIsOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 box-border max-w-full overflow-hidden ${
                            isSelected 
                              ? 'bg-[#FFD54F]/25 text-[#5D4037] font-black border border-[#FFD54F]/40' 
                              : 'hover:bg-stone-50 text-stone-700 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
                            <SafeAccountIcon icon={acc.icon || '🏦'} name={acc.name} className="w-4 h-4 object-contain rounded shrink-0 inline-block mr-1" />
                            <span className="truncate">{acc.name}</span>
                          </div>
                          <span className="text-[10px] text-stone-400 font-normal shrink-0">
                            ({acc.type === 'points' ? '點數' : acc.currency})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AccountIcon({ icon, className = "", sizeClassName = "w-6 h-6" }: { icon?: string, className?: string, sizeClassName?: string }) {
  if (!icon) return null;
  const isImage = icon.startsWith('http') || icon.startsWith('data:') || icon.startsWith('/') || icon.includes(';base64,');
  if (isImage) {
    return (
      <img 
        src={icon} 
        className={`${sizeClassName} object-contain rounded-md select-none pointer-events-none ${className}`} 
        alt="" 
      />
    );
  }
  return <span className={className}>{icon}</span>;
}

export interface AccountSelectorProps {
  accounts: Account[];
  records: Transaction[];
  currentSelectedId: string;
  onSelect: (id: string) => void;
  expandedState: { [key: string]: boolean };
  setExpandedState: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  keyPrefix: string;
  currentTab?: string;
  disabledAccountIds?: string[];
  disabledBadgeText?: string;
}

export function AccountSelector({
  accounts,
  records,
  currentSelectedId,
  onSelect,
  expandedState,
  setExpandedState,
  keyPrefix,
  currentTab,
  disabledAccountIds = [],
  disabledBadgeText
}: AccountSelectorProps) {
  const [subTabState, setSubTabState] = useState<{ [bankName: string]: 'bank' | 'credit' }>({});
  const { groupedList, singleList } = getGroupedAndUngrouped(accounts);

  // 母帳戶（底下有子帳戶的帳戶）分兩種：
  // - 自己也有錢的（有自己的明細或初始金額，例如台新Richart、國泰KOKO）→ 可以選
  // - 只是拿來裝子帳戶的「資料夾」（例如國泰世華實體戶，本身是 0）→ 不列出來
  const isFolderOnlyParent = (acc: Account) => {
    if (acc.id === currentSelectedId) return false; // 目前選中的照樣顯示
    if (acc.hideInPicker) return true; // 在編輯帳戶裡設定了「記帳時不顯示」
    if (!accounts.some(a => a.parentId === acc.id)) return false; // 沒有子帳戶，不是母帳戶
    if (acc.initialBalance) return false;
    const recs = Array.isArray(records) ? records : [];
    return !recs.some(r => !r.isDeleted && (r.accountId === acc.id || r.toAccountId === acc.id));
  };
  const leafSingles = singleList.filter(acc => !isFolderOnlyParent(acc));
  const tempGrouped = groupedList.map(g => ({
    ...g,
    accounts: g.accounts.filter(acc => !isFolderOnlyParent(acc))
  })).filter(g => g.accounts.length > 0);

  // 若群組內過濾後只剩下一個帳戶，則將其提升至單一帳戶列表，避免多點擊一次
  const finalSingles = [...leafSingles];
  const finalGrouped: typeof tempGrouped = [];

  tempGrouped.forEach(g => {
    if (g.accounts.length === 1) {
      finalSingles.push(g.accounts[0]);
    } else if (g.accounts.length > 1) {
      finalGrouped.push(g);
    }
  });

  const selectedAcc = currentSelectedId ? (Array.isArray(accounts) ? accounts : []).find(a => a.id === currentSelectedId) : null;
  const selectedAccBalance = selectedAcc ? calculateAccountBalance(selectedAcc, accounts, records) : 0;

  // 合併列表進行渲染：單一帳戶在前，群組帳戶在後
  const items: (
    | { type: 'single'; account: Account }
    | { type: 'group'; bankName: string; accounts: Account[] }
  )[] = [];

  finalSingles.forEach(acc => items.push({ type: 'single', account: acc }));
  finalGrouped.forEach(g => items.push({ type: 'group', bankName: g.bankName, accounts: g.accounts }));

  return (
    <div className="space-y-2">
      <HorizontalScrollArea className="px-8">
        {items.map((item) => {
          if (item.type === 'single') {
            const acc = item.account;
            const isSelected = currentSelectedId === acc.id;
            const isDisabled = disabledAccountIds.includes(acc.id);
            return (
              <button 
                key={`${keyPrefix}-${acc.id}`}
                disabled={isDisabled}
                onClick={() => {
                  if (isDisabled) return;
                  onSelect(isSelected ? '' : acc.id);
                }}
                type="button"
                className={`flex-shrink-0 w-20 h-24 rounded-[20px] flex flex-col items-center justify-center gap-1 border-2 transition-all relative ${
                  isDisabled
                    ? 'bg-stone-100/90 border-stone-200 text-stone-400 opacity-60 cursor-not-allowed'
                    : (isSelected ? 'bg-[#FFD54F] border-[#FFD54F] shadow-md' : 'bg-white border-white shadow-sm')
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${isDisabled ? 'bg-stone-200/50' : 'bg-white/50'}`}>
                  <AccountIcon icon={acc.icon} sizeClassName="w-6 h-6" />
                </div>
                <span className={`text-[13px] font-bold text-center px-1 leading-tight ${isDisabled ? 'text-stone-400 line-through' : 'text-[#000000]'}`} style={getFontFamily()}>{acc.name}</span>
                {isDisabled && (
                  <span className="text-[9px] font-black text-rose-500 text-center leading-none px-1">
                    {disabledBadgeText || '(已選)'}
                  </span>
                )}
              </button>
            );
          } else {
            const group = item;
            const activeSub = (Array.isArray(group?.accounts) ? group.accounts : []).find(a => a?.id === currentSelectedId);
            const isSelected = !!activeSub;
            const isExpanded = !!expandedState[group.bankName];

            // Display the selected sub-account icon/name if chosen, else parent/first sub-account icon
            const displayIcon = activeSub ? activeSub.icon : group.accounts[0].icon;
            const displayName = group.bankName;

            return (
              <button
                key={`${keyPrefix}-group-${group.bankName}`}
                onClick={() => {
                  setExpandedState(prev => {
                    const next = { ...prev };
                    // Toggle expanded
                    next[group.bankName] = !prev[group.bankName];
                    // Collapse all other groups
                    Object.keys(next).forEach(k => {
                      if (k !== group.bankName) next[k] = false;
                    });
                    return next;
                  });
                }}
                type="button"
                className={`flex-shrink-0 w-20 h-24 rounded-[20px] flex flex-col items-center justify-center gap-2 border-2 transition-all relative ${
                  isSelected ? 'bg-[#FFEDAE] border-[#FFD54F] shadow-md' : 'bg-stone-50 border-stone-200/40 shadow-sm'
                }`}
              >
                {/* Badge for number of sub-accounts */}
                <span className="absolute top-1 right-2 bg-[#5D4037] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full scale-90">
                  {group.accounts.length}
                </span>
                
                <div className="w-10 h-10 bg-white/50 rounded-full flex items-center justify-center text-xl">
                  <AccountIcon icon={displayIcon} sizeClassName="w-6 h-6" />
                </div>
                <span className="text-[14px] font-black text-[#000000] text-center px-1 leading-tight" style={getFontFamily()}>{displayName}</span>
                
                {/* Expansion indicator */}
                <span className="text-[10px] text-stone-500 font-black absolute bottom-1">
                  {isExpanded ? '▲' : '▼'}
                </span>
              </button>
            );
          }
        })}
      </HorizontalScrollArea>

      {/* Expanded Sub-Accounts Row */}
      {finalGrouped.map(group => {
        const isExpanded = !!expandedState[group.bankName];
        if (!isExpanded) return null;
        
        const activeSub = (Array.isArray(group?.accounts) ? group.accounts : []).find(a => a?.id === currentSelectedId);
        const bankAccounts = group.accounts.filter(a => a.type !== 'credit');
        const creditCards = group.accounts.filter(a => a.type === 'credit');

        // Smart default tab calculation
        const defaultSubTab = activeSub 
          ? (activeSub.type === 'credit' ? 'credit' : 'bank')
          : (currentTab === 'income' ? 'bank' : (creditCards.length > 0 ? 'credit' : 'bank'));
        const activeSubTab = subTabState[group.bankName] || defaultSubTab;
        const displayedAccounts = activeSubTab === 'credit' ? creditCards : bankAccounts;

        return (
          <div 
            key={`${keyPrefix}-drawer-${group.bankName}`}
            className="mt-2 mx-8 p-3.5 bg-stone-50 border border-stone-200/50 rounded-2xl space-y-3 shadow-inner animate-fade-in"
          >
            <div className="text-[12px] font-bold text-stone-400 px-1 flex items-center justify-between">
              <span>🏛️ {group.bankName} 卡片與帳戶</span>
              <button 
                onClick={() => {
                  setExpandedState(prev => ({ ...prev, [group.bankName]: false }));
                }}
                type="button"
                className="text-[11px] text-stone-400 hover:text-[#5D4037] font-bold"
              >
                收起 ▲
              </button>
            </div>

            {/* Sub-tab Big Card Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSubTabState(prev => ({ ...prev, [group.bankName]: 'bank' }))}
                className={`py-3 px-4 rounded-[22px] font-black text-sm transition-all border flex items-center justify-center gap-2 shadow-sm ${
                  activeSubTab === 'bank'
                    ? 'bg-white border-[#5D4037] text-[#5D4037] ring-2 ring-[#5D4037]/10 shadow-md'
                    : 'bg-white/80 border-stone-200 text-stone-500 hover:bg-white'
                }`}
              >
                <span className="text-base">🏛️</span>
                <span>銀行 {bankAccounts.length > 0 ? `(${bankAccounts.length})` : ''}</span>
              </button>

              <button
                type="button"
                onClick={() => setSubTabState(prev => ({ ...prev, [group.bankName]: 'credit' }))}
                className={`py-3 px-4 rounded-[22px] font-black text-sm transition-all border flex items-center justify-center gap-2 shadow-sm ${
                  activeSubTab === 'credit'
                    ? 'bg-white border-[#5D4037] text-[#5D4037] ring-2 ring-[#5D4037]/10 shadow-md'
                    : 'bg-white/80 border-stone-200 text-stone-500 hover:bg-white'
                }`}
              >
                <span className="text-base">💳</span>
                <span>信用卡 {creditCards.length > 0 ? `(${creditCards.length})` : ''}</span>
              </button>
            </div>

            {/* Sub-accounts List with Auto-Collapse on Select */}
            {displayedAccounts.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-stone-200/40">
                {displayedAccounts.map(subAcc => {
                  const isSubSelected = currentSelectedId === subAcc.id;
                  const isSubDisabled = disabledAccountIds.includes(subAcc.id);
                  const subBal = calculateAccountBalance(subAcc, accounts, records);
                  return (
                    <button
                      key={`${keyPrefix}-sub-${subAcc.id}`}
                      disabled={isSubDisabled}
                      onClick={() => {
                        if (isSubDisabled) return;
                        onSelect(isSubSelected ? '' : subAcc.id);
                        // Auto-collapse drawer on account selection
                        setExpandedState(prev => ({ ...prev, [group.bankName]: false }));
                      }}
                      type="button"
                      className={`px-3.5 py-2.5 rounded-xl text-[14px] font-bold shadow-sm transition-all border flex items-center gap-2 ${
                        isSubDisabled
                          ? 'bg-stone-100 border-stone-200 text-stone-400 opacity-60 cursor-not-allowed'
                          : (isSubSelected 
                              ? 'bg-[#FFD54F] border-[#FFD54F] text-[#5D4037] shadow-md scale-[1.02]' 
                              : 'bg-white border-stone-100 text-[#5D4037] active:bg-stone-100 hover:border-stone-200')
                      }`}
                    >
                      <AccountIcon icon={subAcc.icon} sizeClassName="w-5 h-5" className="text-lg flex items-center justify-center" />
                      <span className={isSubDisabled ? 'line-through' : ''}>
                        {subAcc.name} {subBal < 0 ? '-' : ''}${Math.abs(subBal).toLocaleString()}
                      </span>
                      {isSubDisabled && (
                        <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-200">
                          {disabledBadgeText || '(已選)'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-[12px] text-stone-400 font-bold py-3 text-center border-t border-stone-200/40">
                {activeSubTab === 'credit' ? '該機構尚無信用卡' : '該機構尚無銀行帳戶'}
              </div>
            )}
          </div>
        );
      })}

      {/* Selected Account Info Popup */}
      {selectedAcc && (
        <div className="mx-8 mt-2 flex flex-col gap-2">
          <div className="p-3.5 bg-[#FFFDF5] border border-[#FBC02D]/20 rounded-2xl flex items-center justify-between text-[#5D4037] shadow-inner animate-fade-in" style={getFontFamily()}>
            <span className="text-xs font-bold opacity-60">目前選擇帳戶</span>
            <span className="text-sm font-black flex items-center gap-1.5">
              <AccountIcon icon={selectedAcc.icon} sizeClassName="w-5 h-5" />
              <span>{selectedAcc.name}</span>
              <span className="opacity-30 font-bold">|</span>
              <span className={selectedAccBalance < 0 ? 'text-red-500 font-black' : 'text-blue-600 font-black'}>
                {selectedAccBalance < 0 ? '-' : ''}${Math.abs(selectedAccBalance).toLocaleString()}
              </span>
            </span>
          </div>
          {selectedAcc.benefits && (
            <div className="p-3 bg-[#FFD54F]/10 border border-[#FFD54F]/20 rounded-2xl text-xs font-bold text-[#5D4037] flex items-center gap-2 animate-fade-in" style={getFontFamily()}>
              <span>💡 優惠提示：{selectedAcc.benefits}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function DynamicAccountBalance({ 
  account, 
  accounts,
  transactions, 
  showAmounts,
  currencyMode = 'TWD',
  className = "text-xl sm:text-[26px] font-black mt-1",
  onOpenRateModal
}: { 
  account: Account | any, 
  accounts: Account[],
  transactions: Transaction[], 
  showAmounts: boolean,
  currencyMode?: 'TWD' | 'FOREIGN',
  className?: string,
  onOpenRateModal?: (acc: Account) => void
}) {
  const calculatedBalance = useMemo(() => {
    if (account.isBrandGroup && account.childAccounts) {
      return (Array.isArray(account?.childAccounts) ? account.childAccounts : []).reduce((sum: number, c: Account) => {
        const bal = calculateAccountBalance(c, accounts, transactions);
        const cur = c.currency || 'TWD';
        const rate = (currencyMode === 'FOREIGN' && cur !== 'TWD') ? getLatestExchangeRate(transactions, accounts, cur) : 1;
        return sum + (bal * rate);
      }, 0);
    }
    const isCredit = account.type === 'credit';
    if (isCredit) {
      return calculateAccountBalance(account, accounts, transactions);
    } else {
      return calculateAccountBalance(account, accounts, transactions);
    }
  }, [account, accounts, transactions, currencyMode]);

  const formatAmount = (val: number) => {
    if (!showAmounts) return '****';
    return val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const isNegative = calculatedBalance < 0;
  const isPoints = account.type === 'points';
  const colorClass = isNegative ? 'text-rose-400' : 'text-[#5D4037]';

  const twdText = useMemo(() => {
    if (!showAmounts) return null;
    if (isPoints || account.isBrandGroup || !account.currency || account.currency === 'TWD') return null;
    const rate = getLatestExchangeRate(transactions, accounts, account.currency);
    const twdBal = Math.round(calculatedBalance * rate);
    return `(約 NT$ ${twdBal.toLocaleString()})`;
  }, [account, accounts, transactions, calculatedBalance, showAmounts, isPoints]);

  const showTwdSymbol = currencyMode === 'FOREIGN' && (account.isBrandGroup || account.currency === 'TWD');

  return (
    <div className="flex items-baseline gap-1.5 flex-wrap" style={getFontFamily()}>
      <span className={`${className} ${colorClass}`} style={getFontFamily()}>
        {!isPoints && <span className="mr-1" style={getFontFamily()}>{showTwdSymbol ? 'NT$' : '$'}</span>}
        {formatAmount(calculatedBalance)}
        {isPoints && <span className="ml-1 text-sm sm:text-base font-black text-stone-500" style={getFontFamily()}>點</span>}
      </span>
      {twdText && (
        <span className="text-xs font-bold text-stone-400 flex items-center gap-1.5 flex-wrap" style={getFontFamily()}>
          <span>{twdText}</span>
          {onOpenRateModal && !account.isBrandGroup && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenRateModal(account);
              }}
              className="px-2 py-0.5 bg-amber-100/90 hover:bg-amber-200 text-amber-900 rounded-md text-[10px] font-black transition-all active:scale-95 shadow-2xs border border-amber-300/60 flex items-center gap-0.5 cursor-pointer"
              style={getFontFamily()}
              title="更新每日匯率與歷史紀錄"
            >
              <span>💱</span>
              <span>匯率</span>
            </button>
          )}
        </span>
      )}
    </div>
  );
}

export function AccountCardMeta({ acc, accounts, records }: { acc: Account; accounts: Account[]; records: Transaction[] }) {
  const isCredit = acc.type === 'credit';
  const hasInterest = acc.interestRate !== undefined;
  const [benefitsOpen, setBenefitsOpen] = useState(false);

  if (!isCredit && !hasInterest) return null;

  const splitBenefits = (benefitsStr: string): string[] => {
    if (!benefitsStr) return [];
    return benefitsStr
      .split(/[,，、;；\s]+/)
      .map(b => b.trim())
      .filter(b => b.length > 0);
  };

  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-stone-100/50 pt-2" style={getFontFamily()}>
      {isCredit && (
        <>
          {acc.benefits && (
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setBenefitsOpen(!benefitsOpen);
                }}
                className="flex items-center justify-between text-xs font-bold text-[#5D4037]/80 hover:text-[#5D4037] w-full text-left"
              >
                <span className="flex items-center gap-1">
                  🎁 回饋與通路 {splitBenefits(acc.benefits).length > 0 ? `(${splitBenefits(acc.benefits).length})` : ''}
                </span>
                <span className="text-[10px] text-stone-400">
                  {benefitsOpen ? '收起 ▲' : '展開 ▼'}
                </span>
              </button>

              {benefitsOpen && (
                <div className="flex flex-wrap gap-1.5 mt-1 animate-fade-in">
                  {splitBenefits(acc.benefits).map((benefit, idx) => (
                    <div 
                      key={idx} 
                      className="text-xs font-bold text-[#5D4037] bg-[#FFE082]/20 border border-[#FFE082]/50 px-2.5 py-1 rounded-xl flex items-center gap-1"
                      style={getFontFamily()}
                    >
                      <span>🎁</span>
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {(acc.statementDate || acc.closingDay || acc.dueDate) && (
            <div className="text-xs font-bold text-stone-500/90 flex flex-wrap items-center gap-2 mt-0.5" style={getFontFamily()}>
              {(acc.statementDate || acc.closingDay) && (
                <span className="flex items-center gap-1 bg-[#F5F5F5] px-2.5 py-1 rounded-xl border border-stone-200/40">
                  📅 結帳日: <strong className="text-[#5D4037]">{acc.statementDate || acc.closingDay}日</strong>
                </span>
              )}
              {acc.dueDate && (
                <span className="flex items-center gap-1 bg-[#F5F5F5] px-2.5 py-1 rounded-xl border border-stone-200/40">
                  ⏰ 繳款日: <strong className="text-[#5D4037]">{acc.dueDate}日</strong>
                </span>
              )}
            </div>
          )}
        </>
      )}
      {Boolean(hasInterest) && (
        <div className="text-[10px] font-bold text-stone-400 flex flex-wrap items-center gap-1.5" style={getFontFamily()}>
          <span className="text-blue-500 font-bold">％ 年利率: {acc.interestRate}%</span>
          {Boolean(acc.interestLimit != null && acc.interestLimit > 0) && (
            <span className="bg-stone-100 text-stone-400 px-1 rounded">額度上限 ${acc.interestLimit.toLocaleString()}</span>
          )}
          {(() => {
            const bal = calculateAccountBalance(acc, accounts, records);
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

export function renderAccountMemoAndInterest(acc: Account, accounts: Account[], records: Transaction[]) {
  return <AccountCardMeta acc={acc} accounts={accounts} records={records} />;
}

export function CreditLimitBar({ account, accounts, records }: { account: Account; accounts: Account[]; records: Transaction[] }) {
  if (account.type !== 'credit' || !account.creditLimit) return null;

  const sameBankCards = accounts.filter(a => a.type === 'credit' && (a.id === account.id || checkAreAccountsSameBank(account, a, accounts)));

  let totalUtilized = 0;
  sameBankCards.forEach(c => {
    const bal = Math.abs(calculateAccountBalance(c, accounts, records));
    const convertedBal = convertCurrency(bal, c.currency || 'TWD', account.currency || 'TWD', records, accounts);
    totalUtilized += convertedBal;
  });

  const creditLimit = account.creditLimit;
  const available = Math.max(0, creditLimit - totalUtilized);
  const percent = Math.min(100, Math.max(0, (totalUtilized / creditLimit) * 100));
  
  const isHighUsage = percent >= 70;
  const barColorClass = isHighUsage 
    ? 'bg-gradient-to-r from-[#FF7043] to-[#E64A19]' // Warning orange-red
    : 'bg-gradient-to-r from-[#4CAF50] to-[#2196F3]';  // Elegant blue-green

  const cur = account.currency || 'TWD';
  const showTwdEquiv = cur !== 'TWD';
  let availableTwdText = '';
  if (showTwdEquiv) {
    const availableTwd = convertCurrency(available, cur, 'TWD', records, accounts);
    availableTwdText = ` (約 NT$ ${Math.round(availableTwd).toLocaleString()})`;
  }

  return (
    <div 
      className="mt-3 p-3 bg-[#FFFDF5] rounded-2xl border border-[#FFD54F]/20 flex flex-col gap-1.5 w-full shadow-inner"
      style={getFontFamily()}
    >
      <div className="flex flex-row justify-between items-center text-[11px] font-bold text-[#5D4037]/80 flex-wrap gap-1">
        <span style={getFontFamily()}>
          可用額度：<span className={isHighUsage ? "text-rose-500 font-extrabold" : "text-emerald-700 font-extrabold"} style={getFontFamily()}>${available.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>{availableTwdText}
        </span>
        <span style={getFontFamily()}>
          總額度：<span className="font-extrabold" style={getFontFamily()}>${creditLimit.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span> ({percent.toFixed(1)}%)
        </span>
      </div>
      
      {/* Progress Bar Track */}
      <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden border border-stone-200/50">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full rounded-full ${barColorClass}`}
        />
      </div>
    </div>
  );
}

/**
 * 帳戶下拉選單的選項，依帳戶類型分組（💵 現金、🏦 銀行、💳 信用卡…），
 * 組內依使用者設定的帳戶排序。disabledId 的那個帳戶會變灰並加上 disabledSuffix。
 */
export function renderAccountOptionsByType(accountsList: Account[], disabledId?: string, disabledSuffix = '') {
  const list = [...(Array.isArray(accountsList) ? accountsList : [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  const option = (a: Account) => (
    <option key={a.id} value={a.id} disabled={a.id === disabledId} style={getFontFamily()}>
      {a.name}{a.id === disabledId && disabledSuffix ? ` ${disabledSuffix}` : ''}
    </option>
  );
  const groups = defaultTypeOrder
    .map(type => ({ type, items: list.filter(a => a.type === type) }))
    .filter(g => g.items.length > 0);
  const rest = list.filter(a => !defaultTypeOrder.includes(a.type));
  return (
    <>
      {groups.map(g => (
        <optgroup key={g.type} label={ACCOUNT_TYPE_LABELS[g.type] || g.type}>{g.items.map(option)}</optgroup>
      ))}
      {rest.length > 0 && <optgroup label="📦 其他">{rest.map(option)}</optgroup>}
    </>
  );
}

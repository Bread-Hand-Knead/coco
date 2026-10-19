import { getFontFamily } from '../lib/financeUtils';
import React, { useMemo, useState } from 'react';
import { ChevronDown, Eye, EyeOff, HelpCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Account, Category, CurrencyMode, Project, Stock, Transaction } from '../types';
import { getGroupOrder } from '../lib/defaults';
import { getLatestExchangeRate } from '../lib/recordUtils';
import { calculateAccountBalance, calculateCreditCardMonthlySpending, calculateCreditCardPreviousMonthSpending, calculateCreditCardUntransferred, hasCreditCardClosingDay } from '../lib/accountUtils';
import { AccountIcon, CreditLimitBar, DynamicAccountBalance, renderAccountMemoAndInterest } from '../components/AccountWidgets';
import { InvestmentSection } from './InvestmentSection';

export function AccountsView({ 
  accounts, 
  netAssets, 
  totalAssets, 
  totalLiabilities, 
  onAccountClick, 
  onAddAccount, 
  balances, 
  currencyMode, 
  onCurrencyModeChange, 
  records,
  stocks,
  onSaveStock,
  onDeleteStock,
  onAddRecord,
  categories,
  projects,
  onUpdateRecord,
  onDeleteRecord,
  onDuplicateRecord,
  onOpenRateModal
}: { 
  accounts: Account[], 
  netAssets: number,
  totalAssets: number,
  totalLiabilities: number,
  onAccountClick: (acc: Account) => void,
  onAddAccount: () => void,
  balances: Record<string, number>,
  currencyMode: CurrencyMode,
  onCurrencyModeChange: (mode: CurrencyMode) => void,
  records: Transaction[],
  stocks: Stock[],
  onSaveStock: (stock: Stock) => void,
  onDeleteStock: (stockId: string) => void,
  onAddRecord: (record: Omit<Transaction, 'id'>, keepOpen?: boolean) => void,
  categories: Category[],
  projects: Project[],
  onUpdateRecord: (old: Transaction, updated: Transaction, ...args: any[]) => void,
  onDeleteRecord: (record: Transaction) => void,
  onDuplicateRecord?: (record: Transaction) => void,
  onOpenRateModal?: (acc: Account) => void
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
    'e-ticket': '電子票證',
    'e-payment': '電子支付',
    points: '點數 / 回饋金',
    deposit: '定存',
    insurance: '保險',
    other: '其他'
  };

  const displayedAccounts = useMemo(() => {
    return accounts.filter(a => {
      const cur = a.currency || 'TWD';
      if (!currencyMode || currencyMode === 'INVESTMENT') return true;
      return currencyMode === 'FOREIGN' ? cur !== 'TWD' : cur === 'TWD';
    });
  }, [accounts, currencyMode]);

  const groupedAccounts = useMemo(() => {
    // Sort all accounts by order first
    const sortedRawAccounts = [...displayedAccounts].sort((a, b) => (a.order || 0) - (b.order || 0));
    
    // An account is "Top Level" in this view if it has no parent OR its parent is not in the current list
    const topLevelAccounts = sortedRawAccounts.filter(a => {
      if (!a.parentId) return true;
      return !displayedAccounts.some(p => p.id === a.parentId);
    });

    const groups: Partial<Record<Account['type'], any[]>> = {};
    
    topLevelAccounts.forEach(acc => {
      if (!groups[acc.type]) groups[acc.type] = [];
      groups[acc.type]!.push(acc);
    });

    // Smart Bank Brand Merging
    if (groups.bank) {
      const bankItems: any[] = [];
      const brandMap: Record<string, Account[]> = {};
      const BRAND_KEYWORDS = ['國泰', '台新', '中信', '中國信託', '玉山', '富邦', '永豐', '郵局', '兆豐', '第一', '華南', '渣打', '匯豐', '星展'];
      
      const unassignedBanks: Account[] = [];
      
      groups.bank.forEach(acc => {
        const foundBrand = BRAND_KEYWORDS.find(k => acc.name.startsWith(k));
        if (foundBrand) {
          const canonicalBrand = (foundBrand === '中信' || foundBrand === '中國信託') ? '中國信託' : foundBrand;
          if (!brandMap[canonicalBrand]) brandMap[canonicalBrand] = [];
          brandMap[canonicalBrand].push(acc);
        } else {
          unassignedBanks.push(acc);
        }
      });

      // Add merged groups
      Object.entries(brandMap).forEach(([brand, brandAccounts]) => {
        if (brandAccounts.length > 1) {
          // Inner sort for brand accounts
          const sortedBrandAccounts = [...brandAccounts].sort((a, b) => (a.order || 0) - (b.order || 0));
          bankItems.push({
            id: `brand_${brand}`,
            name: `${brand}${brand === '國泰' ? '世華銀行' : '銀行'}`,
            type: 'bank',
            icon: '🏦',
            isBrandGroup: true,
            childAccounts: sortedBrandAccounts
          });
        } else {
          bankItems.push(brandAccounts[0]);
        }
      });
      
      bankItems.push(...unassignedBanks);
      
      // Re-sort bankItems because merging might have messed up the order
      bankItems.sort((a, b) => {
        const getOrder = (item: any) => {
          if (item.isBrandGroup) {
            // Use the minimum order of its children
            return Math.min(...(Array.isArray(item?.childAccounts) ? item.childAccounts : []).map((c: Account) => c.order || 0));
          }
          return item.order || 0;
        };
        return getOrder(a) - getOrder(b);
      });

      groups.bank = bankItems;
    }

    // Smart Credit Brand Merging
    if (groups.credit) {
      const creditItems: any[] = [];
      const brandMap: Record<string, Account[]> = {};
      const BRAND_KEYWORDS = ['國泰', '台新', '中信', '中國信託', '玉山', '富邦', '永豐', '郵局', '兆豐', '第一', '華南', '渣打', '匯豐', '星展'];
      
      const unassignedCredits: Account[] = [];
      
      groups.credit.forEach(acc => {
        const foundBrand = BRAND_KEYWORDS.find(k => acc.name.startsWith(k));
        if (foundBrand) {
          const canonicalBrand = (foundBrand === '中信' || foundBrand === '中國信託') ? '中國信託' : foundBrand;
          if (!brandMap[canonicalBrand]) brandMap[canonicalBrand] = [];
          brandMap[canonicalBrand].push(acc);
        } else {
          unassignedCredits.push(acc);
        }
      });

      // Add merged groups
      Object.entries(brandMap).forEach(([brand, brandAccounts]) => {
        if (brandAccounts.length > 1) {
          // Inner sort for brand accounts
          const sortedBrandAccounts = [...brandAccounts].sort((a, b) => (a.order || 0) - (b.order || 0));
          creditItems.push({
            id: `brand_credit_${brand}`,
            name: `${brand}信用卡`,
            type: 'credit',
            icon: '💳',
            isBrandGroup: true,
            childAccounts: sortedBrandAccounts
          });
        } else {
          creditItems.push(brandAccounts[0]);
        }
      });
      
      creditItems.push(...unassignedCredits);
      
      // Re-sort creditItems because merging might have messed up the order
      creditItems.sort((a, b) => {
        const getOrder = (item: any) => {
          if (item.isBrandGroup) {
            // Use the minimum order of its children
            return Math.min(...(Array.isArray(item?.childAccounts) ? item.childAccounts : []).map((c: Account) => c.order || 0));
          }
          return item.order || 0;
        };
        return getOrder(a) - getOrder(b);
      });

      groups.credit = creditItems;
    }

    return groups;
  }, [displayedAccounts]);

  const formatAmount = (val: number) => {
    if (!showAmounts) return '****';
    return val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="flex flex-col bg-[#FFF9E3] min-h-screen"
      style={getFontFamily()}
    >
      {/* Currency Switching Toggle */}
      <div className="px-6 pt-6">
        <div className="bg-white/50 p-1 rounded-2xl border-2 border-white shadow-sm flex gap-1" style={getFontFamily()}>
          <button 
            onClick={() => onCurrencyModeChange('TWD')}
            className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${currencyMode === 'TWD' ? 'bg-[#5D4037] text-[#FFD54F] shadow-md' : 'text-stone-400 hover:text-[#5D4037]/70'}`}
          >
            台幣 (TWD)
          </button>
          <button 
            onClick={() => onCurrencyModeChange('FOREIGN')}
            className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${currencyMode === 'FOREIGN' ? 'bg-[#5D4037] text-[#FFD54F] shadow-md' : 'text-stone-400 hover:text-[#5D4037]/70'}`}
          >
            外幣
          </button>
          <button 
            onClick={() => onCurrencyModeChange('INVESTMENT')}
            className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${currencyMode === 'INVESTMENT' ? 'bg-[#5D4037] text-[#FFD54F] shadow-md' : 'text-stone-400 hover:text-[#5D4037]/70'}`}
          >
            投資
          </button>
        </div>
      </div>

      {currencyMode === 'INVESTMENT' ? (
        <InvestmentSection 
          records={records}
          accounts={accounts}
          stocks={stocks}
          onSaveStock={onSaveStock}
          onDeleteStock={onDeleteStock}
          onAddRecord={onAddRecord}
          categories={categories}
          projects={projects}
          onUpdateRecord={onUpdateRecord}
          onDeleteRecord={onDeleteRecord}
          onDuplicateRecord={onDuplicateRecord}
        />
      ) : (
        <>
          {/* Top Dashboard (CW Money Style) */}
      <div className="px-6 py-8 bg-[#FFF9E3]">
        <div className="flex justify-between items-start mb-2" style={getFontFamily()}>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-[#5D4037]">淨資產</span>
              <button onClick={() => setShowAmounts(!showAmounts)} className="text-[#5D4037]/60 hover:text-[#5D4037]">
                {showAmounts ? <Eye size={20} /> : <EyeOff size={20} />}
              </button>
            </div>
            <div className="text-4xl font-black text-[#5D4037] tracking-tight mt-2" style={getFontFamily()}>
              <span className="text-2xl mr-2">{currencyMode === 'FOREIGN' ? 'NT$' : '$'}</span>{formatAmount(netAssets)}
            </div>
          </div>
          <div className="flex flex-col gap-4 text-right">
            <div className="flex flex-col">
              <div className="flex items-center justify-end gap-1 text-stone-400 text-xs font-bold">
                <span>資產</span>
                <HelpCircle size={12} />
              </div>
              <span className="text-blue-400 font-black text-lg" style={getFontFamily()}>
                {currencyMode === 'FOREIGN' ? 'NT$ ' : '$ '}{formatAmount(totalAssets)}
              </span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center justify-end gap-1 text-stone-400 text-xs font-bold">
                <span>負債</span>
                <HelpCircle size={12} />
              </div>
              <span className="text-rose-400 font-black text-lg" style={getFontFamily()}>
                {currencyMode === 'FOREIGN' ? 'NT$ ' : '$ '}-{formatAmount(totalLiabilities)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Account List Groups */}
      <div className="flex flex-col gap-8 px-4 pb-24">
        {(Object.entries(groupedAccounts) as [Account['type'], any[]][])
          .sort(([typeA], [typeB]) => getGroupOrder(typeA, accounts) - getGroupOrder(typeB, accounts))
          .map(([type, typeAccounts]) => {
          const typeTotal = typeAccounts.reduce((sum, acc) => {
            if (acc.isBrandGroup && acc.childAccounts) {
              return sum + (Array.isArray(acc?.childAccounts) ? acc.childAccounts : []).reduce((cSum: number, c: Account) => {
                const bal = calculateAccountBalance(c, accounts, records);
                const cur = c.currency || 'TWD';
                const rate = (currencyMode === 'FOREIGN' && cur !== 'TWD') ? getLatestExchangeRate(records, accounts, cur) : 1;
                return cSum + (bal * rate);
              }, 0);
            }
            const bal = calculateAccountBalance(acc as Account, accounts, records);
            const cur = acc.currency || 'TWD';
            const rate = (currencyMode === 'FOREIGN' && cur !== 'TWD') ? getLatestExchangeRate(records, accounts, cur) : 1;
            return sum + (bal * rate);
          }, 0);

          const creditUntransferredTotal = type === 'credit' ? typeAccounts.reduce((sum, acc) => {
            if (acc.isBrandGroup && acc.childAccounts) {
              return sum + (Array.isArray(acc?.childAccounts) ? acc.childAccounts : []).reduce((cSum: number, c: Account) => {
                const untransferred = calculateCreditCardUntransferred(c, accounts, records);
                const cur = c.currency || 'TWD';
                const rate = (currencyMode === 'FOREIGN' && cur !== 'TWD') ? getLatestExchangeRate(records, accounts, cur) : 1;
                return cSum + (untransferred * rate);
              }, 0);
            }
            const untransferred = calculateCreditCardUntransferred(acc as Account, accounts, records);
            const cur = acc.currency || 'TWD';
            const rate = (currencyMode === 'FOREIGN' && cur !== 'TWD') ? getLatestExchangeRate(records, accounts, cur) : 1;
            return sum + (untransferred * rate);
          }, 0) : 0;

          return (
            <div key={type} className="flex flex-col gap-4">
              {/* Group Header */}
              <div className="px-2 flex justify-between items-end border-b border-[#5D4037]/10 pb-2">
                <span className="text-lg font-black text-[#5D4037]">{accountTypeLabels[type]}</span>
                <span className="text-sm font-bold text-stone-400 flex items-center gap-1.5" style={getFontFamily()}>
                  <span>
                    合計 {type === 'points' ? '' : (currencyMode === 'FOREIGN' ? 'NT$ ' : '$ ')}
                    {formatAmount(typeTotal)}
                    {type === 'points' ? ' 點' : ''}
                  </span>
                  {type === 'credit' && (
                    <>
                      <span>|</span>
                      <span className="text-rose-500 font-black">
                        未轉帳 {currencyMode === 'FOREIGN' ? 'NT$ ' : '$ '}{formatAmount(creditUntransferredTotal)}
                      </span>
                    </>
                  )}
                </span>
              </div>

              {/* Level 1: Group/Parent Cards */}
              <div className="flex flex-col gap-4">
                {typeAccounts.map(acc => {
                  const isBrandGroup = acc.isBrandGroup;
                  const level2Accounts = isBrandGroup 
                    ? [...acc.childAccounts].sort((a, b) => (a.order || 0) - (b.order || 0))
                    : accounts.filter(c => c.parentId === acc.id).sort((a, b) => (a.order || 0) - (b.order || 0));
                  const isExpanded = expandedGroups.includes(acc.id);
                  const hasLevel2 = level2Accounts.length > 0;

                  return (
                    <div key={acc.id} className="flex flex-col gap-3">
                      {/* Level 1 Card: Group Total */}
                      <div 
                        onClick={() => onAccountClick(acc as Account)}
                        className="bg-white p-4 sm:p-5 rounded-[32px] shadow-sm border-2 border-stone-50 flex flex-col gap-1 group transition-all relative overflow-hidden cursor-pointer active:scale-[0.98]"
                      >
                        <div className="flex flex-row items-center gap-3 sm:gap-4 w-full">
                          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-[#FFFDF5] rounded-2xl flex-shrink-0 flex items-center justify-center text-2xl sm:text-3xl shadow-sm border border-white">
                            <AccountIcon icon={acc.icon} sizeClassName="w-8 h-8 sm:w-10 sm:h-10" />
                          </div>
                          <div className="flex flex-col flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-[10px] sm:text-xs font-bold text-stone-500 uppercase tracking-widest leading-none truncate" style={getFontFamily()}>
                                {isBrandGroup ? `${acc.name}總額` : (acc.type === 'bank' ? `${acc.name}總額` : (acc.type === 'credit' ? '目前未繳金額' : accountTypeLabels[acc.type as Account['type']]))}
                              </span>
                              {acc.excludeFromNetWorth && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-400 font-bold border border-stone-200" style={getFontFamily()}>
                                  不計入資產
                                </span>
                              )}
                            </div>
                            <span className="text-lg sm:text-xl font-black text-[#5D4037] leading-tight truncate" style={getFontFamily()}>{acc.name}</span>
                            <DynamicAccountBalance
                              account={acc}
                              accounts={accounts}
                              transactions={records}
                              showAmounts={showAmounts}
                              currencyMode={currencyMode}
                              className="text-xl sm:text-[26px] font-black mt-1"
                              onOpenRateModal={onOpenRateModal}
                            />
                            {acc.type === 'credit' && (
                              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-stone-400 mt-1 flex-wrap" style={getFontFamily()}>
                                <span>{hasCreditCardClosingDay(acc as Account, accounts) ? '上期帳單：' : '上月刷卡：'}</span>
                                <span className="font-black text-[#5D4037]">
                                  {showAmounts ? `$${calculateCreditCardPreviousMonthSpending(acc as Account, accounts, records).toLocaleString()}` : '••••••'}
                                </span>
                                <span className="text-stone-300">|</span>
                                <span>{hasCreditCardClosingDay(acc as Account, accounts) ? '本期帳單：' : '本月刷卡：'}</span>
                                <span className="font-black text-[#5D4037]">
                                  {showAmounts ? `$${calculateCreditCardMonthlySpending(acc as Account, accounts, records).toLocaleString()}` : '••••••'}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          {hasLevel2 && (
                            <div className="pr-1">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleGroup(acc.id, e);
                                }}
                                className="w-10 h-10 rounded-full border-2 border-stone-100 flex items-center justify-center text-stone-400 hover:bg-stone-50 transition-colors shadow-sm"
                              >
                                <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
                                  <ChevronDown size={20} />
                                </motion.div>
                              </button>
                            </div>
                          )}
                        </div>

                        {!isBrandGroup && renderAccountMemoAndInterest(acc as Account, accounts, records)}

                        {/* Credit card progress bar */}
                        {!isBrandGroup && acc.type === 'credit' && Boolean(acc.creditLimit && acc.creditLimit > 0) && (
                          <div className="w-full">
                            <CreditLimitBar account={acc as Account} accounts={accounts} records={records} />
                          </div>
                        )}
                      </div>

                      {/* Level 2 & 3: Nested List */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="flex flex-col gap-4 pl-6 pr-1 overflow-hidden pb-4 relative"
                    >
                      {/* Vertical Line for Level 2 */}
                      <div className="absolute left-[18px] top-0 bottom-8 w-0.5 bg-[#5D4037]/10 rounded-full" />

                      {level2Accounts.map(l2acc => {
                        const level3Accounts = accounts.filter(c => c.parentId === l2acc.id).sort((a, b) => (a.order || 0) - (b.order || 0));
                        const isL2Expanded = expandedGroups.includes(l2acc.id);
                        const hasLevel3 = level3Accounts.length > 0;

                        return (
                          <div key={l2acc.id} className="flex flex-col gap-2 relative">
                            {/* Level 2 Main Account Card */}
                            <div className="flex items-center gap-3">
                              {/* Horizontal connection line */}
                              <div className="w-3 h-0.5 bg-[#5D4037]/10 flex-shrink-0" />
                              
                              <div 
                                onClick={() => onAccountClick(l2acc)}
                                className="flex-1 bg-white/80 p-3 sm:p-4 rounded-[24px] border border-white flex flex-col gap-1 cursor-pointer active:scale-95 transition-all shadow-sm overflow-hidden"
                              >
                                <div className="flex flex-row items-center gap-2 sm:gap-3 w-full">
                                  <div 
                                    className="w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-xl flex-shrink-0 flex items-center justify-center text-lg sm:text-xl shadow-inner active:scale-90 transition-transform"
                                  >
                                    <AccountIcon icon={l2acc.icon} sizeClassName="w-5 h-5 sm:w-6 sm:h-6" />
                                  </div>
                                  <div className="flex flex-col flex-1 min-w-0 justify-center">
                                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                      {l2acc.type === 'credit' ? (
                                        <span className="text-[10px] sm:text-[11px] font-bold text-stone-500 uppercase tracking-widest leading-none truncate" style={getFontFamily()}>
                                          目前未繳金額
                                        </span>
                                      ) : (
                                        l2acc.type !== 'e-ticket' && (
                                          <span className="text-[10px] sm:text-[11px] font-bold text-stone-500 uppercase tracking-widest leading-none truncate">
                                            主帳號
                                          </span>
                                        )
                                      )}
                                      {l2acc.excludeFromNetWorth && (
                                        <span className="text-[8px] px-1 py-0.2 rounded bg-stone-100 text-stone-400 font-bold border border-stone-200" style={getFontFamily()}>
                                          不計入資產
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-sm sm:text-base font-black text-[#5D4037] leading-tight truncate" style={getFontFamily()}>{l2acc.name}</span>
                                    <DynamicAccountBalance
                                      account={l2acc}
                                      accounts={accounts}
                                      transactions={records}
                                      showAmounts={showAmounts}
                                      currencyMode={currencyMode}
                                      className="text-base sm:text-lg font-black mt-0.5"
                                      onOpenRateModal={onOpenRateModal}
                                    />
                                    {l2acc.type === 'credit' && (
                                      <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-stone-400 mt-0.5 flex-wrap" style={getFontFamily()}>
                                        <span>{hasCreditCardClosingDay(l2acc, accounts) ? '上期帳單：' : '上月刷卡：'}</span>
                                        <span className="font-black text-[#5D4037]">
                                          {showAmounts ? `$${calculateCreditCardPreviousMonthSpending(l2acc, accounts, records).toLocaleString()}` : '••••••'}
                                        </span>
                                        <span className="text-stone-300">|</span>
                                        <span>{hasCreditCardClosingDay(l2acc, accounts) ? '本期帳單：' : '本月刷卡：'}</span>
                                        <span className="font-black text-[#5D4037]">
                                          {showAmounts ? `$${calculateCreditCardMonthlySpending(l2acc, accounts, records).toLocaleString()}` : '••••••'}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  {hasLevel3 && (
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleGroup(l2acc.id, e);
                                      }}
                                      className={`w-10 h-10 rounded-full flex items-center justify-center text-stone-400 transition-colors ${isL2Expanded ? 'bg-stone-100' : ''}`}
                                    >
                                      <motion.div animate={{ rotate: isL2Expanded ? 180 : 0 }}>
                                        <ChevronDown size={20} />
                                      </motion.div>
                                    </button>
                                  )}
                                </div>

                                {renderAccountMemoAndInterest(l2acc, accounts, records)}

                                {/* Credit card progress bar */}
                                {l2acc.type === 'credit' && Boolean(l2acc.creditLimit && l2acc.creditLimit > 0) && (
                                  <div className="w-full">
                                    <CreditLimitBar account={l2acc} accounts={accounts} records={records} />
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Level 3: Sub-Accounts */}
                            <AnimatePresence>
                              {isL2Expanded && (
                                <motion.div 
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="flex flex-col gap-2 pl-10 pr-1 overflow-hidden pb-1 relative"
                                >
                                  {/* Nested vertical line */}
                                  <div className="absolute left-[34px] top-0 bottom-4 w-0.5 bg-[#5D4037]/5 rounded-full" />
                                  
                                  {level3Accounts.map(l3acc => (
                                    <div key={l3acc.id} className="flex items-center gap-3">
                                      <div className="w-3 h-0.5 bg-[#5D4037]/5 flex-shrink-0" />
                                      <div 
                                        onClick={() => onAccountClick(l3acc)}
                                        className="flex-1 bg-white/40 p-2 sm:p-3 rounded-[20px] border border-white/50 flex flex-col gap-1 cursor-pointer active:scale-95 transition-all overflow-hidden"
                                      >
                                        <div className="flex flex-row items-center gap-2 sm:gap-3 w-full">
                                          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-white/80 rounded-lg flex-shrink-0 flex items-center justify-center text-base sm:text-lg shadow-sm">
                                            <AccountIcon icon={l3acc.icon} sizeClassName="w-4 h-4 sm:w-5 sm:h-5" />
                                          </div>
                                          <div className="flex flex-col flex-1 min-w-0 justify-center">
                                            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                              {l3acc.type === 'credit' ? (
                                                <span className="text-[10px] sm:text-[11px] font-bold text-stone-500 uppercase tracking-widest leading-none truncate" style={getFontFamily()}>目前未繳金額</span>
                                              ) : (
                                                l3acc.type !== 'e-ticket' && (
                                                  <span className="text-[10px] sm:text-[11px] font-bold text-stone-500 uppercase tracking-widest leading-none truncate">子帳戶</span>
                                                )
                                              )}
                                              {l3acc.excludeFromNetWorth && (
                                                <span className="text-[8px] px-1 py-0.2 rounded bg-stone-100 text-stone-400 font-bold border border-stone-200" style={getFontFamily()}>
                                                  不計入資產
                                                </span>
                                              )}
                                            </div>
                                            <span className="text-xs sm:text-sm font-bold text-[#5D4037] leading-tight truncate" style={getFontFamily()}>{l3acc.name}</span>
                                            <DynamicAccountBalance
                                              account={l3acc}
                                              accounts={accounts}
                                              transactions={records}
                                              showAmounts={showAmounts}
                                              currencyMode={currencyMode}
                                              className="text-sm sm:text-base font-black"
                                              onOpenRateModal={onOpenRateModal}
                                            />
                                            {l3acc.type === 'credit' && (
                                              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-stone-400 mt-0.5 flex-wrap" style={getFontFamily()}>
                                                <span>{(l3acc.closingDay || l3acc.statementDate) ? '上期帳單：' : '上月刷卡：'}</span>
                                                <span className="font-black text-[#5D4037]">
                                                  {showAmounts ? `$${calculateCreditCardPreviousMonthSpending(l3acc, accounts, records).toLocaleString()}` : '••••••'}
                                                </span>
                                                <span className="text-stone-300">|</span>
                                                <span>{(l3acc.closingDay || l3acc.statementDate) ? '本期帳單：' : '本月刷卡：'}</span>
                                                <span className="font-black text-[#5D4037]">
                                                  {showAmounts ? `$${calculateCreditCardMonthlySpending(l3acc, accounts, records).toLocaleString()}` : '••••••'}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        {renderAccountMemoAndInterest(l3acc, accounts, records)}

                                        {/* Credit card progress bar */}
                                        {l3acc.type === 'credit' && Boolean(l3acc.creditLimit && l3acc.creditLimit > 0) && (
                                          <div className="w-full">
                                            <CreditLimitBar account={l3acc} accounts={accounts} records={records} />
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
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
      </>
      )}
    </motion.div>
  );
}

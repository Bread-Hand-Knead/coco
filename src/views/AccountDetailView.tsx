import { auth, db } from '../lib/firebase';
import { getCategoryIcon, getFontFamily } from '../lib/financeUtils';
import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  CreditCard,
  History,
  Pencil,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { doc, setDoc } from 'firebase/firestore';
import type { Account, Category, Project, Transaction } from '../types';
import { cleanData } from '../lib/firestoreSync';
import { formatLocalDate, formatTime24 } from '../lib/dateUtils';
import { getLatestExchangeRate, getMergedRecords, getTransactionTitle, getTransferCounterpartName, getTransferInAmountForAccount, getTransferSourceAndDest, getTwdEquivalentText, isTransferInForAccount } from '../lib/recordUtils';
import { calculateAccountBalance, calculateCreditCardMonthlySpending, calculateCreditCardPreviousMonthSpending, checkAreAccountsSameBank, hasCreditCardClosingDay } from '../lib/accountUtils';
import { YearMonthPickerModal } from '../components/Common';
import { AccountIcon, renderAccountMemoAndInterest } from '../components/AccountWidgets';
import { EditRecordModal } from './EditRecordModal';

export function AccountDetailView({ account, records, selectedDate, onBack, onEdit, onUpdateRecord, onDeleteRecord, accounts, projects, balance, categories, onUpdateAccountsList, onDuplicateRecord, onOpenRateModal }: { 
  account: Account, 
  records: Transaction[],
  selectedDate: string,
  onBack: () => void,
  onEdit: () => void,
  onUpdateRecord: (oldRecord: Transaction, updatedRecord: Transaction, ...args: any[]) => void,
  onDeleteRecord: (record: Transaction) => void,
  accounts: Account[],
  projects: Project[],
  balance: number,
  categories: Category[],
  onUpdateAccountsList?: React.Dispatch<React.SetStateAction<Account[]>>,
  onDuplicateRecord?: (record: Transaction) => void,
  onOpenRateModal?: (acc: Account) => void
}) {
  const [editingRecord, setEditingRecord] = useState<Transaction | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  type SortMode = 'date-desc' | 'date-asc' | 'posting-desc' | 'posting-asc' | 'billing-cycle';
  const [sortMode, setSortMode] = useState<SortMode>('date-desc');

  const compareCreditCardRecords = (a: Transaction, b: Transaction, mode: SortMode) => {
    // 1. 第一層：依消費日 (date) 排序
    let dateCompare = 0;
    if (mode === 'date-asc' || mode === 'posting-asc' || mode === 'billing-cycle') {
      dateCompare = (a.date || '').localeCompare(b.date || '');
    } else {
      // mode === 'date-desc' 或 'posting-desc'
      dateCompare = (b.date || '').localeCompare(a.date || '');
    }

    if (dateCompare !== 0) return dateCompare;

    // 2. 第二層：同一天消費日，依 [序號] 由小到大排序 (序號 1 ➔ 序號 2 ➔ 序號 3)
    const parseOrder = (val: any): number | null => {
      if (val === undefined || val === null || val === '') return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    };

    const orderA = parseOrder(a.postingOrder);
    const orderB = parseOrder(b.postingOrder);

    if (orderA !== null && orderB !== null) {
      if (orderA !== orderB) return orderA - orderB;
    } else if (orderA !== null) {
      return -1; // a 有序號，排在前面
    } else if (orderB !== null) {
      return 1;  // b 有序號，排在前面
    }

    // 3. 第三層：同日且都無序號時，依交易時間 (time) 排序
    const isDesc = (mode === 'date-desc' || mode === 'posting-desc');
    const timeA = a.time || '';
    const timeB = b.time || '';
    if (timeA !== timeB) {
      return isDesc ? timeB.localeCompare(timeA) : timeA.localeCompare(timeB);
    }

    // 4. 若時間亦相同，比金額
    return isDesc ? (b.amount - a.amount) : (a.amount - b.amount);
  };
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date(selectedDate);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [showDiagnostic, setShowDiagnostic] = useState(false);

  const [selectedCardFilterId, setSelectedCardFilterId] = useState<string | null>(null);

  // 依卡片分組顯示（卡片分區依序排列）：開關與卡片順序皆以 account.id 為鍵持久化於 LocalStorage
  const cardGroupEnabledKey = `coco_card_group_enabled_${account.id}`;
  const cardGroupOrderKey = `coco_card_group_order_${account.id}`;
  const [groupByCard, setGroupByCardState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(cardGroupEnabledKey) === '1';
    } catch {
      return false;
    }
  });
  const [cardOrder, setCardOrderState] = useState<string[]>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(cardGroupOrderKey) || '[]');
      return Array.isArray(parsed) ? parsed.filter((v: unknown) => typeof v === 'string') : [];
    } catch {
      return [];
    }
  });
  const setGroupByCard = (enabled: boolean) => {
    setGroupByCardState(enabled);
    try {
      localStorage.setItem(cardGroupEnabledKey, enabled ? '1' : '0');
    } catch {
      /* 無痕模式或容量不足時忽略 */
    }
  };
  const setCardOrder = (order: string[]) => {
    setCardOrderState(order);
    try {
      localStorage.setItem(cardGroupOrderKey, JSON.stringify(order));
    } catch {
      /* 無痕模式或容量不足時忽略 */
    }
  };

  // 依使用者設定順序排列子卡；新增的卡片（尚未出現在順序中）自動附加於最後
  const orderedChildCards = useMemo<Account[]>(() => {
    const children: Account[] = Array.isArray((account as any)?.childAccounts) ? (account as any).childAccounts : [];
    const rank = new Map(cardOrder.map((id, i) => [id, i]));
    return children
      .map((c, i) => ({ c, i }))
      .sort((a, b) => {
        const ra = rank.has(a.c.id) ? rank.get(a.c.id)! : cardOrder.length + a.i;
        const rb = rank.has(b.c.id) ? rank.get(b.c.id)! : cardOrder.length + b.i;
        return ra - rb;
      })
      .map(x => x.c);
  }, [account, cardOrder]);

  const moveCard = (index: number, delta: -1 | 1) => {
    const ids = orderedChildCards.map(c => c.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setCardOrder(ids);
  };

  const isCardGroupingActive =
    account.type === 'credit' && !!account.isBrandGroup && groupByCard && !selectedCardFilterId && orderedChildCards.length > 1;

  const childrenIds = useMemo(() => {
    if (account.isBrandGroup && (account as any).childAccounts) {
      return (Array.isArray((account as any)?.childAccounts) ? (account as any).childAccounts : []).map((c: any) => c.id);
    }
    return accounts.filter(c => c.parentId === account.id).map(c => c.id);
  }, [account, accounts]);

  const effectiveChildrenIds = useMemo(() => {
    if (selectedCardFilterId) {
      return [selectedCardFilterId];
    }
    return childrenIds;
  }, [childrenIds, selectedCardFilterId]);

  const effectiveParentId = useMemo(() => {
    if (selectedCardFilterId) {
      return selectedCardFilterId;
    }
    return account.id;
  }, [account.id, selectedCardFilterId]);

  const targetIds = useMemo(() => {
    if (selectedCardFilterId) {
      return [selectedCardFilterId];
    }
    if (account.isBrandGroup && (account as any).childAccounts) {
      return (Array.isArray((account as any)?.childAccounts) ? (account as any).childAccounts : []).map((c: any) => c.id);
    }
    return [account.id, ...childrenIds];
  }, [account, childrenIds, selectedCardFilterId]);

  const effectiveClosingDay = useMemo(() => {
    if (selectedCardFilterId) {
      const childAcc = (Array.isArray(accounts) ? accounts : []).find(a => a.id === selectedCardFilterId);
      if (childAcc && childAcc.closingDay) return childAcc.closingDay;
    }
    if (account.isBrandGroup && (account as any).childAccounts) {
      const childWithClosing = (Array.isArray((account as any)?.childAccounts) ? (account as any).childAccounts : []).find((c: any) => c.closingDay);
      return childWithClosing ? childWithClosing.closingDay : null;
    }
    return account.closingDay;
  }, [account, accounts, selectedCardFilterId]);

  const balanceMap = useMemo(() => {
    const mergedHistory = getMergedRecords(records, accounts);
    const relevant = mergedHistory
      .filter(r => (targetIds.includes(r.accountId) || isTransferInForAccount(r, targetIds)) && r.category !== '初始資金')
      .sort((a, b) => {
        const dateDiff = a.date.localeCompare(b.date);
        if (dateDiff !== 0) return dateDiff;
        const timeA = a.time || '00:00';
        const timeB = b.time || '00:00';
        const timeDiff = timeA.localeCompare(timeB);
        if (timeDiff !== 0) return timeDiff;
        return a.id.localeCompare(b.id);
      });
      
    const map: Record<string, number> = {};
    const initialBal = selectedCardFilterId
      ? ((Array.isArray(accounts) ? accounts : []).find(a => a.id === selectedCardFilterId)?.initialBalance || 0)
      : (account.initialBalance || 0);
    let bal = initialBal;
    
    relevant.forEach(r => {
      if (targetIds.includes(r.accountId)) {
        if (r.type === 'transfer') {
          bal -= Math.abs(r.amount);
        } else {
          bal += r.amount;
        }
        if (r.fee) bal -= r.fee;
      }
      if (r.type === 'transfer') {
        const inAmt = targetIds.reduce((sum, tid) => sum + getTransferInAmountForAccount(r, tid), 0);
        bal += inAmt;
      }
      map[r.id] = bal;
      if ((r as any)._mergedRecordIds) {
        (r as any)._mergedRecordIds.forEach((id: string) => {
          map[id] = bal;
        });
      }
    });
    
    return map;
  }, [records, account, targetIds, accounts, selectedCardFilterId]);

  const diagnosticInfo = useMemo(() => {
    const merged = getMergedRecords(records, accounts);
    
    let bal = account.type === 'credit' ? 0 : (account.initialBalance || 0);
    const log: Array<{ date: string; desc: string; amount: number; running: number; type: string }> = [];
    
    log.push({ date: '初始設定', desc: '初始金額', amount: account.type === 'credit' ? 0 : (account.initialBalance || 0), running: bal, type: 'init' });
    
    merged.forEach(r => {
      if (r.category === '初始資金') return;
      
      let matched = false;
      let change = 0;
      let desc = '';
      
      if (targetIds.includes(r.accountId)) {
        const changeAmt = r.type === 'transfer' ? -Math.abs(r.amount) : r.amount;
        change += changeAmt;
        if (r.fee) change -= r.fee;
        matched = true;
        desc = `支出/轉出 (${getTransactionTitle(r)})`;
      }
      if (r.type === 'transfer') {
        const inAmt = targetIds.reduce((sum, tid) => sum + getTransferInAmountForAccount(r, tid), 0);
        if (inAmt > 0) {
          change += inAmt;
          matched = true;
          desc = `收入/轉入 (${getTransactionTitle(r)})`;
        }
      }
      
      if (matched) {
        bal += change;
        log.push({
          date: r.date,
          desc,
          amount: change,
          running: bal,
          type: r.type
        });
      }
    });
    
    const children = account.isBrandGroup && (account as any).childAccounts
      ? (account as any).childAccounts
      : accounts.filter(c => c.parentId === account.id);
    const childrenBals = children.map((child: any) => {
      const childBal = calculateAccountBalance(child, accounts, records);
      return { name: child.name, balance: childBal };
    });
    
    return { log, childrenBals, initial: account.type === 'credit' ? 0 : (account.initialBalance || 0) };
  }, [records, account, targetIds, accounts]);

  const dateRangeStrings = useMemo(() => {
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    
    const fmt = (d: Date) => {
      const y = d.getFullYear();
      const m = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      return `${y}/${m}/${day}`;
    };
    
    return {
      range: `${fmt(firstDay)} - ${fmt(lastDay)}`,
      filter: `${currentMonth.getFullYear()}-${(currentMonth.getMonth() + 1).toString().padStart(2, '0')}`
    };
  }, [currentMonth]);

  const changeMonth = (offset: number) => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const handleRenameStatement = async (stmtKey: string, currentLabel: string) => {
    const newName = window.prompt(`請輸入新的帳單名稱（目前為：${currentLabel}）：`, currentLabel);
    if (newName === null) return; // User cancelled
    
    const trimmed = newName.trim();
    if (!trimmed) {
      alert('帳單名稱不能為空！');
      return;
    }

    const updatedLabels = {
      ...(account.customStatementLabels || {}),
      [stmtKey]: trimmed
    };

    const updatedAccount: Account = {
      ...account,
      customStatementLabels: updatedLabels
    };

    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const docRef = doc(db, 'users', currentUser.uid, 'accounts', account.id);
        await setDoc(docRef, cleanData(updatedAccount));
        
        const sameBankCards = accounts.filter(a => checkAreAccountsSameBank(updatedAccount, a, accounts));
        for (const card of sameBankCards) {
          const updatedCard = {
            ...card,
            customStatementLabels: updatedLabels
          };
          const cardDocRef = doc(db, 'users', currentUser.uid, 'accounts', card.id);
          await setDoc(cardDocRef, cleanData(updatedCard));
        }
      }
      
      if (onUpdateAccountsList) {
        onUpdateAccountsList(prev => prev.map(a => {
          if (a.id === account.id) return updatedAccount;
          if (checkAreAccountsSameBank(updatedAccount, a, accounts)) {
            return { ...a, customStatementLabels: updatedLabels };
          }
          return a;
        }));
      }
    } catch (err) {
      console.error('Rename statement failed:', err);
      alert('更新帳單名稱失敗，請重試。');
    }
  };
  
  const billingCycleRange = useMemo(() => {
    const closingDayVal = effectiveClosingDay || account.statementDate || 15;
    const refYear = currentMonth.getFullYear();
    const refMonth = currentMonth.getMonth();

    const maxDaysCurrent = new Date(refYear, refMonth + 1, 0).getDate();
    const maxDaysPrev = new Date(refYear, refMonth, 0).getDate();

    const currentClosingDate = new Date(refYear, refMonth, Math.min(closingDayVal, maxDaysCurrent));
    const prevClosingDate = new Date(refYear, refMonth - 1, Math.min(closingDayVal, maxDaysPrev));

    const startDate = new Date(prevClosingDate.getFullYear(), prevClosingDate.getMonth(), prevClosingDate.getDate() + 1);
    const endDate = currentClosingDate;

    const startStr = formatLocalDate(startDate);
    const endStr = formatLocalDate(endDate);
    const label = `${startStr.replace(/-/g, '/')} ~ ${endStr.replace(/-/g, '/')}`;

    return { startDate, endDate, startStr, endStr, label };
  }, [currentMonth, effectiveClosingDay, account.statementDate]);

  const billingCycleStatementKey = useMemo(() => {
    const m = currentMonth.getMonth() + 1;
    return `${currentMonth.getFullYear()}-${String(m).padStart(2, '0')}`;
  }, [currentMonth]);

  const billingCycleStatementLabel = useMemo(() => {
    const m = currentMonth.getMonth() + 1;
    const calculated = `${m}月 帳單`;
    return account.customStatementLabels?.[billingCycleStatementKey] || calculated;
  }, [account.customStatementLabels, billingCycleStatementKey, currentMonth]);

  const accountRecords = useMemo(() => {
    const targetYearMonth = dateRangeStrings.filter;
    
    const raw = records.filter(r => {
      if (r.isMergedChild || r.parentId || r.parentTransactionId || r.isChildTransaction) return false;
      if (!(targetIds.includes(r.accountId) || isTransferInForAccount(r, targetIds))) return false;
      if (r.category === '初始資金') return false;
      
      if (sortMode === 'billing-cycle') {
        if (!r.postingDate || r.isPending) return false;
        return r.postingDate >= billingCycleRange.startStr && r.postingDate <= billingCycleRange.endStr;
      } else {
        const filterDate = (sortMode === 'date-desc' || sortMode === 'date-asc') 
          ? r.date 
          : (r.postingDate || r.date);
        return filterDate.startsWith(targetYearMonth);
      }
    });
    
    const merged = getMergedRecords(raw, accounts);
    
    return merged.sort((a, b) => compareCreditCardRecords(a, b, sortMode));
  }, [records, accounts, dateRangeStrings.filter, targetIds, sortMode, billingCycleRange]);

  const calculatedBalance = useMemo(() => { 
    if (selectedCardFilterId) {
      const childAcc = (Array.isArray(accounts) ? accounts : []).find(a => a.id === selectedCardFilterId);
      if (childAcc) {
        return calculateAccountBalance(childAcc, accounts, records);
      }
    }
    return calculateAccountBalance(account, accounts, records); 
  }, [account, accounts, records, selectedCardFilterId]);

  const { paymentRecords, normalRecords } = useMemo(() => {
    if (account.type !== 'credit') {
      const sortedNormals = [...accountRecords];
      sortedNormals.sort((a, b) => compareCreditCardRecords(a, b, sortMode));
      return { paymentRecords: [], normalRecords: sortedNormals };
    }
    
    const paymentRecords: Transaction[] = [];
    const normalRecords: Transaction[] = [];
    
    accountRecords.forEach(r => {
      const noteText = (r.note || '') + (r.remark || '') + (r.category || '');
      const hasKeywords = 
        (noteText.includes('自動') && noteText.includes('扣繳')) || 
        (noteText.includes('自動') && noteText.includes('繳款')) || 
        (noteText.includes('自動') && noteText.includes('扣款')) ||
        noteText.includes('轉帳扣繳') ||
        noteText.includes('扣繳信用卡款') ||
        noteText.includes('自動扣繳');
      const isRepayment = (r.type === 'transfer' && isTransferInForAccount(r, targetIds)) || hasKeywords;
      
      if (isRepayment) {
        paymentRecords.push(r);
      } else {
        normalRecords.push(r);
      }
    });

    // Apply sortMode to normalRecords
    normalRecords.sort((a, b) => compareCreditCardRecords(a, b, sortMode));
    
    return { paymentRecords, normalRecords };
  }, [accountRecords, account.type, targetIds, sortMode]);

  const creditCardStats = useMemo(() => {
    let tCount = 0;
    let tSum = 0;
    let ntCount = 0;
    let ntSum = 0;

    let cycleSum = 0;
    let cycleCount = 0;

    accountRecords.forEach(r => {
      const noteText = (r.note || '') + (r.remark || '') + (r.category || '');
      const noteLower = noteText.toLowerCase();
      const isFeedback = 
        noteLower.includes('回饋') || 
        noteLower.includes('返現') || 
        noteLower.includes('紅利') || 
        noteLower.includes('折抵') || 
        noteLower.includes('cashback') || 
        noteLower.includes('reward') ||
        r.type === 'income' ||
        r.category === '回饋' ||
        r.category === '退款';

      const isTransferPayment = r.type === 'transfer';
      const isTransferOutFromCard = isTransferPayment && r.accountId && targetIds.includes(r.accountId) && !(r.toAccountId && targetIds.includes(r.toAccountId));
      const isTransferInToCard = isTransferPayment && r.toAccountId && targetIds.includes(r.toAccountId);
      
      let isAutoPay = false;
      if (isTransferInToCard) {
        isAutoPay = 
          (noteText.includes('自動') && noteText.includes('扣繳')) || 
          (noteText.includes('自動') && noteText.includes('繳款')) || 
          (noteText.includes('自動') && noteText.includes('扣款')) ||
          noteText.includes('轉帳扣繳') ||
          noteText.includes('扣繳信用卡款') ||
          noteText.includes('自動扣繳');
      }

      if (r.type === 'expense') {
        cycleSum += Math.abs(Number(r.amount || 0));
        cycleCount++;
      } else if (isTransferOutFromCard) {
        // Credit card transfer out (e.g. top up e-wallet/EasyCard/icash)
        cycleSum += Math.abs(Number(r.amount || 0));
        cycleCount++;
      } else if (isFeedback || r.type === 'income') {
        // Only deduct merchant refunds or cashback rebates
        cycleSum -= Math.abs(Number(r.amount || 0));
        cycleCount++;
      }

      if (isFeedback) {
        return; // skip cashbacks / rewards entirely from transfer statistics
      }

      if (isAutoPay) {
        return; // skip auto-pay
      }

      // Counts as transferred if manually marked or if it is an incoming transfer payment (repayment)
      const isTransferred = r.transferredDate || (isTransferPayment && isTransferInToCard);

      if (isTransferred) {
        tCount++;
        tSum += Math.abs(r.amount);
      } else {
        ntCount++;
        ntSum += r.amount;
      }
    });
    
    return {
      transferredCount: tCount,
      transferredSum: tSum,
      notTransferredCount: ntCount,
      notTransferredSum: ntSum,
      billingCycleSum: cycleSum,
      billingCycleCount: cycleCount
    };
  }, [accountRecords, targetIds]);

  const creditCardStatements = useMemo(() => {
    if (account.type !== 'credit' || !effectiveClosingDay) return [];

    const targetYearMonth = dateRangeStrings.filter; // e.g. "2026-07"

    const getNextStatementKey = (key: string) => {
      const parts = key.split('-');
      if (parts.length < 2) return key;
      let y = parseInt(parts[0]);
      let m = parseInt(parts[1]);
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      return `${y}-${String(m).padStart(2, '0')}`;
    };

    const getStatementLabelAndKey = (dateStr: string, closingDay: number) => {
      const parts = dateStr.split('-');
      if (parts.length < 3) return { label: '未分類帳單', key: '9999-12' };
      const y = parseInt(parts[0]);
      const m = parseInt(parts[1]);
      const d = parseInt(parts[2]);

      let stmtYear = y;
      let stmtMonth = m;

      if (d > closingDay) {
        stmtMonth += 1;
        if (stmtMonth > 12) {
          stmtMonth = 1;
          stmtYear += 1;
        }
      }

      // 帳單月份嚴格以結帳日所屬之月份命名（9月結帳即為 9月帳單），不以繳款日額外偏移
      const key = `${stmtYear}-${String(stmtMonth).padStart(2, '0')}`;
      const calculatedLabel = `${stmtMonth}月帳單`;
      const label = account.customStatementLabels?.[key] || calculatedLabel;
      return { label, key };
    };

    // Filter transactions only for the selected calendar month (so users see them in the month they occurred)
    const filterBasis = (sortMode === 'date-desc' || sortMode === 'date-asc') ? 'date' : 'posting';

    // Filter ALL history transactions for this card
    const allHistoryCardRecords = records.filter(r => 
      !r.isMergedChild && !r.parentId && !r.parentTransactionId && !r.isChildTransaction &&
      (targetIds.includes(r.accountId) || (r.toAccountId && targetIds.includes(r.toAccountId))) && 
      r.category !== '初始資金'
    );

    const groups: Record<string, { label: string; key: string; records: Transaction[]; balance: number }> = {};
    const transferPayments: Transaction[] = [];

    allHistoryCardRecords.forEach(r => {
      const noteText = (r.note || '') + (r.remark || '') + (r.category || '');
      const noteLower = noteText.toLowerCase();
      const isFeedback = 
        noteLower.includes('回饋') || 
        noteLower.includes('返現') || 
        noteLower.includes('紅利') || 
        noteLower.includes('折抵') || 
        noteLower.includes('cashback') || 
        noteLower.includes('reward');

      const isTransferInCard = r.type === 'transfer' && 
        r.toAccountId && 
        (r.toAccountId === effectiveParentId || effectiveChildrenIds.includes(r.toAccountId));
      const isTransferIn = isTransferInCard && !isFeedback;
      
      if (isTransferIn) {
        // Payments are filtered by calendar month
        const filterDate = filterBasis === 'date' ? r.date : (r.postingDate || r.date);
        if (filterDate.startsWith(targetYearMonth)) {
          transferPayments.push(r);
        }
      } else {
        // 未入帳自動順延機制：
        // 1. 若已有入帳日（postingDate && !isPending），則依照入帳日落入該期帳單
        // 2. 若未填寫入帳日（!postingDate || isPending），本期帳單不予包含，自動順延至下一期（nextKey）預估明細
        let key = '';
        let label = '';

        if (r.postingDate && !r.isPending) {
          const stmt = getStatementLabelAndKey(r.postingDate, effectiveClosingDay!);
          key = stmt.key;
          label = stmt.label;
        } else {
          const origStmt = getStatementLabelAndKey(r.date, effectiveClosingDay!);
          key = getNextStatementKey(origStmt.key);
          const nextMonthNum = parseInt(key.split('-')[1]);
          const calculatedLabel = `${nextMonthNum}月帳單`;
          label = account.customStatementLabels?.[key] || calculatedLabel;
        }

        if (!groups[key]) {
          groups[key] = {
            label,
            key,
            records: [],
            balance: 0
          };
        }
        groups[key].records.push(r);
      }
    });

    // 篩選與目前檢視月份相關或非空之帳單群組
    const statementList = Object.values(groups)
      .map(g => {
        // 嚴格依據當前月份 (targetYearMonth) 與排序模式 (filterBasis) 篩選該帳單卡片內之交易紀錄
        // 避免次月 (例如 6/28) 的消費因為被分配到同一個帳單 key 而誤在 5 月檢視中顯示
        const groupRecords = g.records.filter(r => {
          if (sortMode === 'billing-cycle') {
            if (!r.postingDate || r.isPending) return false;
            return r.postingDate >= billingCycleRange.startStr && r.postingDate <= billingCycleRange.endStr;
          }
          if (!targetYearMonth) return true;
          const filterDate = filterBasis === 'date' ? r.date : (r.postingDate || r.date);
          return filterDate.startsWith(targetYearMonth);
        });

        if (groupRecords.length === 0) return null;

        const sortedRecords = getMergedRecords(groupRecords, accounts).sort((a, b) => compareCreditCardRecords(a, b, sortMode));

        // 帳單金額加總：統計該帳單卡片中包含的當月符合交易款項，確保頂部金額與明細列表總額 100% 一致
        let bal = 0;
        groupRecords.forEach(r => {
          const isFromCard = targetIds.includes(r.accountId);
          const isToCard = Boolean(r.toAccountId && targetIds.includes(r.toAccountId));

          if (!isFromCard && !isToCard) return;

          const noteText = (r.note || '') + (r.remark || '') + (r.category || '');
          const noteLower = noteText.toLowerCase();
          const isFeedback = 
            noteLower.includes('回饋') || 
            noteLower.includes('返現') || 
            noteLower.includes('紅利') || 
            noteLower.includes('折抵') || 
            noteLower.includes('cashback') || 
            noteLower.includes('reward') ||
            r.type === 'income' ||
            r.category === '回饋' ||
            r.category === '退款';

          const isTransfer = r.type === 'transfer';
          if (isFromCard && isToCard) return;
          if (isTransfer && isToCard && !isFeedback) return;

          let change = 0;
          if (r.type === 'expense') {
            change = Math.abs(Number(r.amount || 0));
          } else if (isTransfer && isFromCard && !isToCard) {
            change = Math.abs(Number(r.amount || 0));
          } else if (r.type === 'income' || isFeedback) {
            change = -Math.abs(Number(r.amount || 0));
          }
          bal += change;
          if (r.fee && isFromCard) {
            bal += Math.abs(Number(r.fee || 0));
          }
        });

        return {
          ...g,
          records: sortedRecords,
          balance: bal
        };
      })
      .filter((g): g is { label: string; key: string; records: Transaction[]; balance: number } => g !== null && g.records.length > 0);

    statementList.sort((a, b) => b.key.localeCompare(a.key));

    if (transferPayments.length > 0) {
      const sortedPayments = getMergedRecords(transferPayments, accounts).sort((a, b) => compareCreditCardRecords(a, b, sortMode));

      let paymentTotal = 0;
      sortedPayments.forEach(r => {
        paymentTotal += (r.toAmount !== undefined ? r.toAmount : Math.abs(r.amount * (r.exchangeRate || 1)));
      });

      statementList.unshift({
        label: '扣繳資訊',
        key: '9999-99-payments',
        records: sortedPayments,
        balance: paymentTotal
      });
    }

    return statementList;
  }, [records, account, accounts, dateRangeStrings.filter, targetIds, effectiveChildrenIds, effectiveParentId, sortMode, effectiveClosingDay]);

  const listBalance = useMemo(() => {
    if (account.type === 'credit' && effectiveClosingDay) {
      let total = 0;
      creditCardStatements.forEach(s => {
        total += s.balance;
      });
      return total;
    }

    const targetYearMonth = dateRangeStrings.filter;

    const mergedRecords = getMergedRecords(records, accounts);
    const monthRecords = mergedRecords.filter(r => {
      if (r.category === '初始資金') return false;
      const filterDate = (sortMode === 'date-desc' || sortMode === 'date-asc') 
        ? r.date 
        : (r.postingDate || r.date);
      return targetYearMonth ? filterDate.startsWith(targetYearMonth) : true;
    });

    const getBaseBalance = (acc: Account) => {
      let bal = 0;
      monthRecords.forEach(r => {
        if (r.accountId === acc.id) {
          if (r.type === 'transfer') {
            bal -= Math.abs(r.amount);
          } else {
            bal += r.amount;
          }
          if (r.fee) bal -= r.fee;
        }
        if (r.type === 'transfer') {
          bal += getTransferInAmountForAccount(r, acc.id);
        }
      });
      return bal;
    };

    const getRecursiveBalance = (id: string): number => {
      const acc = (Array.isArray(accounts) ? accounts : []).find(a => a.id === id);
      if (!acc) return 0;
      let total = getBaseBalance(acc);
      const children = accounts.filter(a => a.parentId === id);
      children.forEach(child => {
        total += getRecursiveBalance(child.id);
      });
      return total;
    };

    if (account.isBrandGroup && (account as any).childAccounts) {
      return (Array.isArray((account as any)?.childAccounts) ? (account as any).childAccounts : []).reduce((sum: number, c: Account) => {
        return sum + getRecursiveBalance(c.id);
      }, 0);
    }

    return getRecursiveBalance(account.id);
  }, [account, accounts, records, dateRangeStrings.filter, creditCardStatements]);

  // 單筆交易對信用卡應繳金額的影響（與帳單金額加總邏輯一致）
  const getCardBillChange = (r: Transaction, ids: string[]) => {
    const isFromCard = ids.includes(r.accountId);
    const isToCard = Boolean(r.toAccountId && ids.includes(r.toAccountId));
    if (!isFromCard && !isToCard) return 0;
    if (isFromCard && isToCard) return 0;
    const noteLower = ((r.note || '') + (r.remark || '') + (r.category || '')).toLowerCase();
    const isFeedback =
      ['回饋', '返現', '紅利', '折抵', 'cashback', 'reward'].some(k => noteLower.includes(k)) ||
      r.type === 'income' ||
      r.category === '回饋' ||
      r.category === '退款';
    const isTransfer = r.type === 'transfer';
    if (isTransfer && isToCard && !isFeedback) return 0;
    const amt = Math.abs(Number(r.amount || 0));
    let change = 0;
    if (r.type === 'expense' || (isTransfer && isFromCard)) change = amt;
    else if (isFeedback) change = -amt;
    if (r.fee && isFromCard) change += Math.abs(Number(r.fee || 0));
    return change;
  };

  // 依卡片分組渲染明細；未啟用分組時維持原本的平鋪清單
  const renderRecordList = (list: Transaction[], emptyText: string) => {
    if (list.length === 0) {
      return <div className="text-center py-4 text-xs font-bold text-stone-500">{emptyText}</div>;
    }
    if (!isCardGroupingActive) return list.map(renderRecord);

    const childIdSet = new Set(orderedChildCards.map(c => c.id));
    const buckets = new Map<string, Transaction[]>();
    list.forEach(r => {
      const cid = childIdSet.has(r.accountId)
        ? r.accountId
        : r.toAccountId && childIdSet.has(r.toAccountId)
          ? r.toAccountId
          : '__other__';
      const bucket = buckets.get(cid);
      if (bucket) bucket.push(r);
      else buckets.set(cid, [r]);
    });

    // list 已依目前排序模式（消費日 / 入帳日 + 序號）排好，分桶時保留原相對順序
    const sections = [
      ...orderedChildCards.map(c => ({ id: c.id, name: c.name, icon: c.icon as string | undefined })),
      { id: '__other__', name: '其他明細', icon: undefined },
    ]
      .filter(s => (buckets.get(s.id)?.length || 0) > 0)
      .map(s => {
        const items = buckets.get(s.id)!;
        const subtotal = items.reduce((sum, r) => sum + getCardBillChange(r, targetIds), 0);
        return { ...s, items, subtotal };
      });
    const grandTotal = sections.reduce((sum, s) => sum + s.subtotal, 0);

    return (
      <>
        {sections.map((s, idx) => (
          <div key={s.id} className={`flex flex-col ${idx > 0 ? 'mt-3 pt-3 border-t-2 border-dashed border-stone-100' : ''}`}>
            <div
              className="sticky top-0 z-10 flex items-center justify-between gap-2 px-3 py-2.5 mb-1 rounded-2xl bg-[#FFF9E3] border border-[#F5E6B8]"
              style={getFontFamily()}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#5D4037] text-white text-[11px] font-black flex items-center justify-center">
                  {idx + 1}
                </span>
                {s.icon ? <AccountIcon icon={s.icon} sizeClassName="w-6 h-6" /> : <CreditCard size={18} className="text-[#5D4037] flex-shrink-0" />}
                <span className="font-black text-sm text-[#5D4037] truncate">{s.name}</span>
                <span className="text-[11px] font-bold text-stone-400 flex-shrink-0">{s.items.length} 筆</span>
              </div>
              <span className="text-xs font-bold text-stone-400 flex-shrink-0">
                本期小計：<span className="font-black text-sm text-[#5D4037]">${Math.abs(s.subtotal).toLocaleString()}</span>
              </span>
            </div>
            {s.items.map(renderRecord)}
          </div>
        ))}
        <div
          className="mt-3 flex items-center justify-between px-4 py-3 rounded-2xl bg-[#5D4037] text-white"
          style={getFontFamily()}
        >
          <span className="font-black text-sm">全部卡片應繳總計</span>
          <span className="font-black text-base">${grandTotal.toLocaleString()}</span>
        </div>
      </>
    );
  };

  const renderRecord = (record: Transaction) => {
    const isExpanded = expandedRecordId === record.id;
    return (
      <div key={record.id} className="flex flex-col border-b border-stone-100/80 last:border-0 py-1">
        {/* 主資訊行 (可點選展開)：左右分離配置，禁止重疊 */}
        <div 
          onClick={() => setExpandedRecordId(isExpanded ? null : record.id)}
          className="flex items-center justify-between gap-2.5 sm:gap-3 py-3 cursor-pointer hover:bg-stone-50/60 rounded-2xl px-2.5 -mx-2 transition-colors select-none"
        >
          {/* 左側資訊區：包含圖示、標題、日期標籤等 */}
          <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
            {/* 左邊圖示 */}
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#FFFDF5] rounded-2xl flex-shrink-0 flex items-center justify-center text-2xl shadow-xs border border-white">
              {getCategoryIcon(record.category, record.type, categories)}
            </div>
            
            {/* 中間主要資訊 (直向分層排版) */}
            <div className="flex-1 min-w-0 flex flex-col gap-[3px]" style={getFontFamily()}>
              {/* 第一層（頂部標題） */}
              <span className="font-black text-base text-[#5D4037] break-words leading-snug block">
                {getTransactionTitle(record)}
              </span>
              
              {/* 第二層至第四層資訊 */}
              {record.type === 'transfer' ? (
                (() => {
                  const isPos = record.amount > 0;
                  const currentAccName = (Array.isArray(accounts) ? accounts : []).find(a => a.id === record.accountId)?.name || '未知帳戶';
                  const counterpartAccName = getTransferCounterpartName(record, accounts);
                  const firstAccName = isPos ? counterpartAccName : currentAccName;
                  const secondAccName = isPos ? currentAccName : counterpartAccName;
                  return (
                    <>
                      {/* 第二層（日期時間）：完整單行呈現時間，移除 truncate 省略號 */}
                      <div className="text-xs font-bold text-stone-400 whitespace-nowrap block leading-none">
                        {((sortMode === 'posting-desc' || sortMode === 'posting-asc') && record.postingDate) 
                          ? `入帳: ${record.postingDate}${record.postingOrder ? ` [序號 ${record.postingOrder}]` : ''}` 
                          : `轉帳: ${record.date}`}
                        {record.time && ` ${formatTime24(record.time)}`}
                      </div>
                      {/* 第三層（轉帳路徑與標籤） */}
                      <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-[#5D4037]">
                        <span className="opacity-80 whitespace-nowrap flex-shrink-0">{firstAccName}</span>
                        <span className="text-amber-600 font-bold flex-shrink-0">➔</span>
                        <span className="opacity-80 font-black text-amber-800 whitespace-nowrap flex-shrink-0">{secondAccName}</span>
                        {record.transferredDate && (
                          <span className="inline-block whitespace-nowrap w-fit text-[11px] px-2.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-bold leading-none ml-1">
                            已轉帳
                          </span>
                        )}
                      </div>
                    </>
                  );
                })()
              ) : (
                <>
                  {/* 第二層（日期時間）：完整單行呈現消費日與時間，移除過嚴的省略號截斷 */}
                  <div className="text-xs font-bold text-stone-500 whitespace-nowrap block leading-none">
                    {((sortMode === 'posting-desc' || sortMode === 'posting-asc') && record.postingDate) 
                      ? `入帳: ${record.postingDate}${record.postingOrder ? ` [序號 ${record.postingOrder}]` : ''}` 
                      : `消費: ${record.date}${record.postingOrder ? ` [序號 ${record.postingOrder}]` : ''}`}
                    {record.time && ` ${formatTime24(record.time)}`}
                  </div>

                  {/* 第三層與第四層（狀態標籤與卡別/帳戶膠囊：桌面版 md:flex md:flex-row md:items-center md:gap-2 md:flex-wrap 橫向整齊並排） */}
                  {((account.type === 'credit' && (!record.postingDate || record.isPending)) || record.transferredDate || (record.isPrepay || (record.subItems && record.subItems.some(i => i.isPrepay))) || ((account.parentId === undefined || account.isBrandGroup) && record.accountId !== account.id)) && (
                    <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 md:flex-wrap mt-0.5">
                      {account.type === 'credit' && (!record.postingDate || record.isPending) && (
                        <span className="inline-block whitespace-nowrap w-fit text-[11px] px-2.5 py-0.5 bg-[#FFF4D3] text-[#B87A14] rounded-full font-bold leading-none">
                          待請款/順延
                        </span>
                      )}
                      {record.transferredDate && (
                        <span className="inline-block whitespace-nowrap w-fit text-[11px] px-2.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-bold leading-none">
                          已轉帳
                        </span>
                      )}
                      {(record.isPrepay || (record.subItems && record.subItems.some(i => i.isPrepay))) && (
                        <span className="inline-block whitespace-nowrap w-fit text-[11px] px-2.5 py-0.5 bg-amber-100/90 text-amber-900 rounded-full font-bold leading-none border border-amber-200/60 shadow-xs">
                          🏠 代墊 {record.subItems && record.subItems.some(i => i.isPrepay) ? `$ ${record.subItems.filter(i => i.isPrepay).reduce((s, i) => s + (i.amount || 0), 0).toLocaleString()}` : ''}
                        </span>
                      )}
                      {(account.parentId === undefined || account.isBrandGroup) && record.accountId !== account.id && (
                        <span className="inline-block whitespace-nowrap w-fit text-[11px] px-2.5 py-0.5 bg-[#F3F4F6] text-[#4B5563] rounded-full font-bold leading-none">
                          {(Array.isArray(accounts) ? accounts : []).find(a => a.id === record.accountId)?.name}
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          
          {/* 右側金額與箭頭區：固定緊湊配置，flex-shrink: 0 確保金額獨立且不被壓縮，剩餘空間全部分配給左側 */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 ml-1">
            <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
              {/* 金額顯示 */}
              {(() => {
                let isFrom = targetIds.includes(record.accountId);
                let isTo = isTransferInForAccount(record, targetIds);
                
                if (record.type === 'transfer' || record._isMergedTransfer) {
                  const { src, dst } = getTransferSourceAndDest(record);
                  isFrom = targetIds.includes(src);
                  isTo = (dst && targetIds.includes(dst)) || isTransferInForAccount(record, targetIds);
                }
                
                let colorClass = 'text-stone-400';
                let sign = '';
                const twdText = getTwdEquivalentText(records, accounts, record);
                
                if (record.type === 'transfer' || record._isMergedTransfer) {
                  if (isFrom && !isTo) {
                    colorClass = 'text-[#E91E63]';
                    sign = '-';
                    const displayAmt = Math.abs(record.amount) + (record.fee || 0);
                    return (
                      <div className="flex flex-col items-end">
                        <span className={`font-black text-lg sm:text-xl ${colorClass}`} style={getFontFamily()}>
                           {sign} $ {Math.abs(displayAmt).toLocaleString()}
                        </span>
                        {record.fee ? <span className="text-[11px] text-stone-500 font-bold" style={getFontFamily()}>含手續費 $ {record.fee}</span> : null}
                      </div>
                    );
                  } else if (isTo && !isFrom) {
                    colorClass = 'text-[#03A9F4]';
                    sign = '+';
                    let displayAmt = record.toAmount !== undefined ? record.toAmount : Math.abs(record.amount * (record.exchangeRate || 1));
                    if (record.subItems && record.subItems.some(s => s.toAccountId)) {
                      const cardPortion = targetIds.reduce((sum, tid) => sum + getTransferInAmountForAccount(record, tid), 0);
                      if (cardPortion > 0) displayAmt = cardPortion;
                    }
                     return (
                       <div className="flex flex-col items-end">
                         <span className={`font-black text-lg sm:text-xl ${colorClass}`} style={getFontFamily()}>
                            {sign} $ {Math.abs(displayAmt).toLocaleString()}
                         </span>
                         {twdText && <span className="text-[11px] text-stone-400 font-bold" style={getFontFamily()}>{twdText}</span>}
                       </div>
                     );
                  } else {
                    const isOut = record.amount < 0;
                    colorClass = isOut ? 'text-[#E91E63]' : 'text-[#03A9F4]';
                    sign = isOut ? '-' : '+';
                  }
                } else if (record.type === 'income') {
                  colorClass = 'text-[#03A9F4]';
                  sign = '+';
                } else if (record.type === 'expense') {
                  colorClass = 'text-[#E91E63]';
                  sign = '-';
                }
                
                 return (
                   <div className="flex flex-col items-end">
                     <span className={`font-black text-lg sm:text-xl ${colorClass}`} style={getFontFamily()}>
                        {sign} $ {Math.abs(record.amount).toLocaleString()}
                     </span>
                     {twdText && <span className="text-[11px] text-stone-400 font-bold" style={getFontFamily()}>{twdText}</span>}
                   </div>
                 );
              })()}
              
              {/* 轉入轉出標籤 */}
              {(record.type === 'transfer' || record._isMergedTransfer) && (
                (() => {
                  let isFrom = targetIds.includes(record.accountId);
                  if (record.type === 'transfer' || record._isMergedTransfer) {
                    const { src } = getTransferSourceAndDest(record);
                    isFrom = targetIds.includes(src);
                  }
                  return (
                    <span className="text-[11px] font-black text-stone-500 bg-stone-50 px-2 py-0.5 rounded-lg border border-stone-100" style={getFontFamily()}>
                      {isFrom ? '轉出' : '轉入'}
                    </span>
                  );
                })()
              )}
            </div>
            
            {/* 展開箭頭 */}
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-stone-300 flex-shrink-0"
            >
              <ChevronDown size={20} />
            </motion.div>
          </div>
        </div>
        
        {/* 展開詳細資訊區：單一垂直直向堆疊 (flex-col)，取消左右分欄與絕對懸浮定位 */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden bg-[#FFFDF8] rounded-[24px] border-2 border-stone-100/40 p-4 sm:p-5 mt-1 mb-2 mx-1 shadow-inner flex flex-col gap-3"
              style={getFontFamily()}
            >
              {/* 上半部：所有資訊欄位 (垂直堆疊，各欄位滿寬呈現，標籤統一寬度對齊) */}
              <div className="w-full flex flex-col gap-3 text-[13px] font-bold text-[#5D4037]">
                {/* 項目 1：分類 (獨立一行，膠囊框保持完整橫向寬度，禁止折字) */}
                <div className="flex items-center gap-2.5 w-full">
                  <span className="text-stone-400 font-bold min-w-[65px] flex-shrink-0 text-xs sm:text-[13px]">交易分類:</span>
                  <div className="flex-1 min-w-0">
                    <span className="bg-[#FFF9E3] px-3.5 py-1 rounded-full text-xs font-black text-[#8D6E63] border border-[#FFD54F]/30 whitespace-nowrap inline-flex items-center shadow-xs">
                      {record.category || (record.type === 'transfer' ? '轉帳' : '未分類')}
                    </span>
                  </div>
                </div>
                
                {/* 項目 2：日期 (獨立一行，完整顯示日期、時間與入帳日，禁止垂直斷行) */}
                <div className="flex items-center gap-2.5 w-full">
                  <span className="text-stone-400 font-bold min-w-[65px] flex-shrink-0 text-xs sm:text-[13px]">交易日期:</span>
                  <div className="flex-1 min-w-0 font-black text-stone-600 text-xs sm:text-[13px] whitespace-nowrap overflow-x-auto">
                    {record.date} {record.time ? `${formatTime24(record.time)} ` : ''}{record.postingDate ? `(入帳: ${record.postingDate}${record.postingOrder ? ` [序號 ${record.postingOrder}]` : ''})` : ''}
                  </div>
                </div>
                
                {/* 拆分子項目明細 (母子交易) */}
                {record.subItems && record.subItems.length > 0 && (
                  <div className="flex flex-col gap-2.5 bg-amber-50/50 p-3.5 rounded-2xl border border-amber-200/70 w-full mb-1">
                    <div className="flex items-center justify-between font-black text-xs text-[#5D4037]">
                      <span className="flex items-center gap-1.5">
                        <span className="text-amber-600">{record.type === 'transfer' ? '💸' : '🛍️'}</span>
                        <span>{record.type === 'transfer' ? '各卡繳款 / 轉帳明細' : '商品拆分歸屬明細'} ({record.subItems.length} 項)</span>
                      </span>
                      <span className="text-amber-900/80 font-bold text-[11px]">
                        {record.type === 'transfer' ? '扣款總金額' : '刷卡對帳總額'}: ${Math.abs(record.amount).toLocaleString()}
                      </span>
                    </div>

                    {record.type === 'transfer' ? (
                      <div className="bg-white p-3 rounded-xl border border-stone-200/80 space-y-2 shadow-xs">
                        <div className="space-y-2 pt-0.5">
                          {record.subItems.map((item, idx) => {
                            const destCard = (Array.isArray(accounts) ? accounts : []).find(a => a.id === item.toAccountId);
                            const isThisCard = item.toAccountId && targetIds.includes(item.toAccountId);
                            return (
                              <div 
                                key={item.id || idx} 
                                className={`flex items-center justify-between text-xs p-2 rounded-lg border ${
                                  isThisCard 
                                    ? 'bg-amber-50/90 border-amber-300 font-black' 
                                    : 'bg-stone-50/60 border-stone-200/60 font-bold text-stone-700'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className="text-amber-700">💳</span>
                                  <div className="flex flex-col min-w-0">
                                    <span className="truncate text-[#5D4037]">
                                      {destCard?.name || item.name || '信用卡/帳戶'}
                                    </span>
                                    {item.name && item.name !== destCard?.name && (
                                      <span className="text-[10px] text-stone-400 truncate">{item.name}</span>
                                    )}
                                  </div>
                                </div>
                                <span className={`font-black ml-2 ${isThisCard ? 'text-amber-900' : 'text-[#5D4037]'}`}>
                                  $ {Math.abs(item.amount).toLocaleString()}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* 🛒 個人消費清單及小計 */}
                        {(() => {
                          const personalItems = record.subItems.filter(i => !i.isPrepay);
                          const personalSum = personalItems.reduce((s, i) => s + (i.amount || 0), 0);
                          if (personalItems.length === 0) return null;
                          return (
                            <div className="bg-white p-3 rounded-xl border border-stone-200/80 space-y-1.5 shadow-xs">
                              <div className="flex items-center justify-between text-xs font-black text-[#5D4037] pb-1 border-b border-stone-100">
                                <span className="flex items-center gap-1">
                                  <span>🛒</span>
                                  <span>個人實質支出 ({personalItems.length} 項)</span>
                                </span>
                                <span className="text-[#5D4037] font-black">小計: ${personalSum.toLocaleString()}</span>
                              </div>
                              <div className="space-y-1.5 pt-0.5">
                                {personalItems.map((item, idx) => {
                                  const subProjectName = item.projectName || (item.projectId && (Array.isArray(projects) ? projects : []).find(p => p.id === item.projectId)?.name);
                                  return (
                                    <div key={item.id || idx} className="flex items-start justify-between gap-2 text-xs font-bold text-stone-700">
                                      {/* 手機：一行顯示，太長可以左右滑動；電腦：自動換行，完整顯示 */}
                                      <span className="flex-1 min-w-0 overflow-x-auto whitespace-nowrap md:overflow-visible md:whitespace-normal text-stone-800 flex items-center md:flex-wrap gap-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" onClick={e => e.stopPropagation()}>
                                        <span className="shrink-0 md:shrink">• {item.name} {item.category ? `(${item.category})` : ''}</span>
                                        {subProjectName && (
                                          <span className="shrink-0 text-[10px] text-amber-800 bg-amber-100/90 px-1.5 py-0.2 rounded font-black border border-amber-300/40">
                                            📁 {subProjectName}
                                          </span>
                                        )}
                                      </span>
                                      <span className={`shrink-0 font-black ${item.amount < 0 ? 'text-emerald-600' : 'text-[#5D4037]'}`}>
                                        {item.amount < 0 ? '-' : ''}${Math.abs(item.amount).toLocaleString()}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}

                        {/* 🏠 家裡代墊清單及小計 */}
                        {(() => {
                          const prepayItems = record.subItems.filter(i => !!i.isPrepay);
                          const prepaySum = prepayItems.reduce((s, i) => s + (i.amount || 0), 0);
                          if (prepayItems.length === 0) return null;
                          return (
                            <div className="bg-[#FFF4D3] p-3 rounded-xl border border-amber-200/80 space-y-1.5 shadow-xs">
                              <div className="flex items-center justify-between text-xs font-black text-amber-900 pb-1 border-b border-amber-200/60">
                                <span className="flex items-center gap-1">
                                  <span>🏠</span>
                                  <span>家裡代墊 ({prepayItems.length} 項)</span>
                                  <span className="text-[10px] px-2 py-0.5 bg-amber-200 text-amber-900 rounded-full font-bold">代墊</span>
                                </span>
                                <span className="text-amber-950 font-black">小計: ${prepaySum.toLocaleString()}</span>
                              </div>
                              <div className="space-y-1.5 pt-0.5">
                                {prepayItems.map((item, idx) => {
                                  const subProjectName = item.projectName || (item.projectId && (Array.isArray(projects) ? projects : []).find(p => p.id === item.projectId)?.name);
                                  return (
                                    <div key={item.id || idx} className="flex items-start justify-between gap-2 text-xs font-bold text-amber-900/90">
                                      <span className="flex-1 min-w-0 overflow-x-auto whitespace-nowrap md:overflow-visible md:whitespace-normal flex items-center md:flex-wrap gap-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" onClick={e => e.stopPropagation()}>
                                        <span className="shrink-0 md:shrink">• {item.name} {item.category ? `(${item.category})` : ''}</span>
                                        {subProjectName && (
                                          <span className="shrink-0 text-[10px] text-amber-900 bg-amber-200/80 px-1.5 py-0.2 rounded font-black border border-amber-300/60">
                                            📁 {subProjectName}
                                          </span>
                                        )}
                                      </span>
                                      <span className={`shrink-0 font-black ${item.amount < 0 ? 'text-emerald-700' : 'text-amber-950'}`}>
                                        {item.amount < 0 ? '-' : ''}${Math.abs(item.amount).toLocaleString()}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                )}

                {/* 項目 3：備註明細 (100% 寬度容器，橫向正常流動，單行即可完整呈現，禁止縱向單字斷行) */}
                <div className="flex items-start gap-2.5 w-full">
                  <span className="text-stone-400 font-bold min-w-[65px] flex-shrink-0 text-xs sm:text-[13px] pt-2">備註明細:</span>
                  <div className="flex-1 min-w-0 w-full">
                    <textarea 
                      defaultValue={record.note || record.remark || ''}
                      key={`${record.id}_${record.note || ''}_${record.remark || ''}`}
                      onClick={e => e.stopPropagation()}
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val !== (record.note || '').trim() || val !== (record.remark || '').trim()) {
                          onUpdateRecord(record, { 
                            ...record, 
                            note: val,
                            remark: val 
                          });
                        }
                      }}
                      className="w-full font-bold text-stone-700 bg-white px-3.5 py-2 rounded-xl border border-stone-200 min-h-[38px] max-h-[120px] outline-none focus:border-[#FFD54F] shadow-sm text-xs resize-y block leading-relaxed"
                      placeholder="無備註 (點擊輸入修改)..."
                      rows={1}
                    />
                  </div>
                </div>

                {/* 轉帳附加資訊：手續費與匯率 */}
                {(record.type === 'transfer' || record._isMergedTransfer) && (() => {
                  const { src, dst } = getTransferSourceAndDest(record);
                  const srcAcc = (Array.isArray(accounts) ? accounts : []).find(a => a.id === src);
                  const dstAcc = (Array.isArray(accounts) ? accounts : []).find(a => a.id === dst);
                  const srcCur = srcAcc?.currency || 'TWD';
                  const dstCur = dstAcc?.currency || 'TWD';
                  
                  const hasConversion = srcCur !== dstCur || !!record.exchangeRate;
                  const rate = record.exchangeRate || 1;
                  const toAmt = record.toAmount !== undefined ? record.toAmount : Math.abs(record.amount * rate);
                  
                  let rateStr = '';
                  if (srcCur === 'TWD' && dstCur !== 'TWD') {
                    rateStr = `1 ${dstCur} = ${rate} TWD`;
                  } else if (srcCur !== 'TWD' && dstCur === 'TWD') {
                    rateStr = `1 ${srcCur} = ${rate} TWD`;
                  } else {
                    rateStr = `1 ${srcCur} = ${rate} ${dstCur}`;
                  }
                  
                  return (
                    <div className="flex flex-col gap-2 w-full">
                      {hasConversion && (
                        <>
                          <div className="flex items-center gap-2.5 w-full">
                            <span className="text-stone-400 font-bold min-w-[65px] flex-shrink-0 text-xs sm:text-[13px]">當時匯率:</span>
                            <span className="font-black text-[#5D4037] text-xs sm:text-[13px]">
                              {rateStr}
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5 w-full">
                            <span className="text-stone-400 font-bold min-w-[65px] flex-shrink-0 text-xs sm:text-[13px]">實收金額:</span>
                            <span className="font-black text-[#5D4037] text-xs sm:text-[13px]">
                              {dstCur} {Math.abs(toAmt).toLocaleString()}
                            </span>
                          </div>
                        </>
                      )}
                      {record.fee ? (
                        <div className="flex items-center gap-2.5 w-full">
                          <span className="text-stone-400 font-bold min-w-[65px] flex-shrink-0 text-xs sm:text-[13px]">手續費:</span>
                          <span className="font-black text-rose-500 text-xs sm:text-[13px]">
                            $ {record.fee.toLocaleString()} ({srcCur})
                          </span>
                        </div>
                      ) : null}
                    </div>
                  );
                })()}

                {/* 項目 3.5：已轉帳狀態與日期 (消費與轉帳皆適用) */}
                {(record.type === 'expense' || record.type === 'transfer') && (
                  <div className="flex items-center gap-2.5 w-full flex-wrap">
                    <span className="text-stone-400 font-bold min-w-[65px] flex-shrink-0 text-xs sm:text-[13px]">轉帳狀態:</span>
                    {record.transferredDate ? (
                      <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                        <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg text-xs font-black border border-emerald-200 whitespace-nowrap">
                          ✓ 已轉帳 ({record.transferredDate})
                        </span>
                        <input 
                          type="date"
                          value={record.transferredDate}
                          onClick={e => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            onUpdateRecord(record, { ...record, transferredDate: e.target.value || undefined });
                          }}
                          className="px-2 py-0.5 bg-white border border-stone-200 rounded-lg text-[11px] font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                        />
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateRecord(record, { ...record, transferredDate: undefined });
                          }}
                          className="text-stone-400 hover:text-rose-500 text-xs font-bold px-1.5 py-0.5 rounded hover:bg-stone-100"
                          title="清除轉帳日期"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateRecord(record, { ...record, transferredDate: formatLocalDate(new Date()) });
                          }}
                          className="bg-stone-50 hover:bg-stone-100 text-stone-600 px-2.5 py-1 rounded-lg text-xs font-bold border border-stone-200 active:scale-95 transition-all whitespace-nowrap"
                        >
                          標記為已轉帳
                        </button>
                        <span className="text-[#8C7B72]/70 text-xs whitespace-nowrap">或選擇日期:</span>
                        <input 
                          type="date"
                          onClick={e => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            onUpdateRecord(record, { ...record, transferredDate: e.target.value || undefined });
                          }}
                          className="px-2 py-0.5 bg-white border border-stone-200 rounded-lg text-[11px] font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                        />
                      </div>
                    )}
                  </div>
                )}
                
                {/* 項目 4：當下餘額或刷卡累積 */}
                <div className="flex items-center gap-2.5 border-t border-dashed border-stone-200/80 pt-2.5 mt-1 w-full">
                  <span className="text-stone-400 font-bold min-w-[65px] flex-shrink-0 text-xs sm:text-[13px]">
                    {account.type === 'credit' ? '刷卡累積:' : '帳戶餘額:'}
                  </span>
                  <span className={`font-black text-sm ${account.type === 'credit' ? 'text-rose-500' : ((balanceMap[record.id] || 0) < 0 ? 'text-rose-400' : 'text-[#5D4037]')}`}>
                    {account.type === 'credit' 
                      ? `$ ${Math.abs(balanceMap[record.id] || 0).toLocaleString()}` 
                      : `${(balanceMap[record.id] || 0) < 0 ? '- $ ' : '$ '}${Math.abs(balanceMap[record.id] || 0).toLocaleString()}`}
                  </span>
                </div>
              </div>
              
              {/* 項目 5：底部操作按鈕列 (Footer Actions Row - 獨立最下方一列，完全解除懸浮與覆蓋，絕不遮擋上方文字) */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-100 mt-1 w-full">
                {typeof onDuplicateRecord === 'function' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (typeof onDuplicateRecord === 'function') {
                        onDuplicateRecord(record);
                      }
                    }}
                    className="h-10 px-4 rounded-xl bg-[#FFD54F] text-[#5D4037] flex items-center justify-center gap-1.5 shadow-xs active:scale-95 hover:bg-[#ffe082] transition-all font-black text-xs border border-[#FFD54F]"
                    title="以此紀錄再記一筆"
                  >
                    <Copy size={15} />
                    <span>再記一筆</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingRecord(record);
                  }}
                  className="h-10 px-4 rounded-xl bg-[#5D4037] text-white flex items-center justify-center gap-1.5 shadow-xs active:scale-95 hover:bg-[#4E342E] transition-all font-black text-xs"
                  title="編輯此紀錄"
                >
                  <Pencil size={15} />
                  <span>編輯</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full bg-[#FFF9E3]"
      style={getFontFamily()}
    >
      {/* Balance Section */}
      <div className="px-4 py-6">
        <div className="bg-white p-8 rounded-[40px] shadow-sm border-2 border-white flex justify-between items-center relative overflow-hidden">
          <div className="flex flex-col gap-2 z-10">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-stone-50 rounded-lg flex items-center justify-center text-xs border border-white">
                <AccountIcon icon={account.icon} sizeClassName="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-stone-500 uppercase tracking-[0.2em]" style={getFontFamily()}>
                {account.type === 'credit' ? '目前未繳金額' : '目前餘額'}
              </span>
              {account.excludeFromNetWorth && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-400 font-bold border border-stone-200" style={getFontFamily()}>
                  不計入資產
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1 flex-wrap" style={getFontFamily()}>
              {account.type !== 'points' && <span className="text-sm font-black text-stone-300">$</span>}
              <span className={`text-4xl font-black tracking-tight ${calculatedBalance < 0 ? 'text-rose-400' : 'text-[#5D4037]'}`} style={getFontFamily()}>
                {calculatedBalance.toLocaleString()}
              </span>
              {account.type === 'points' && (
                <span className="text-lg font-black text-stone-500 ml-1" style={getFontFamily()}>
                  點
                </span>
              )}
              {account.type !== 'points' && (() => {
                const activeCurrency = selectedCardFilterId 
                  ? (Array.isArray(accounts) ? accounts : []).find(a => a.id === selectedCardFilterId)?.currency || account.currency 
                  : account.currency;
                if (!activeCurrency || activeCurrency === 'TWD') return null;
                const rate = getLatestExchangeRate(records, accounts, activeCurrency);
                const twdBal = Math.round(calculatedBalance * rate);
                const activeAcc = (selectedCardFilterId ? (Array.isArray(accounts) ? accounts : []).find(a => a.id === selectedCardFilterId) : account) || account;
                return (
                  <span className="text-sm font-bold text-stone-400 ml-1.5 flex items-center gap-1.5 flex-wrap" style={getFontFamily()}>
                    <span>(約 NT$ {twdBal.toLocaleString()})</span>
                    {onOpenRateModal && !activeAcc.isBrandGroup && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenRateModal(activeAcc);
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
                );
              })()}
            </div>
            {account.type === 'credit' && (
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-stone-400 mt-1 flex-wrap" style={getFontFamily()}>
                <span>{hasCreditCardClosingDay(account, accounts) ? '上期帳單：' : '上月刷卡：'}</span>
                <span className="font-black text-[#5D4037]">
                  ${calculateCreditCardPreviousMonthSpending(account, accounts, records).toLocaleString()}
                </span>
                <span className="text-stone-300">|</span>
                <span>{hasCreditCardClosingDay(account, accounts) ? '本期帳單：' : '本月刷卡：'}</span>
                <span className="font-black text-[#5D4037]">
                  ${calculateCreditCardMonthlySpending(account, accounts, records).toLocaleString()}
                </span>
              </div>
            )}
            {!account.isBrandGroup && renderAccountMemoAndInterest(account, accounts, records)}
          </div>
          {!account.isBrandGroup && (
            <button 
              onClick={onEdit}
              className="w-14 h-14 bg-[#FFD54F] rounded-full flex items-center justify-center shadow-lg border-4 border-white active:scale-90 transition-all z-10"
            >
              <Pencil size={24} className="text-[#5D4037]" />
            </button>
          )}
          
          {/* Decorative background element */}
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-[#FFD54F]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-4 -top-4 w-24 h-24 bg-[#5D4037]/5 rounded-full blur-2xl pointer-events-none" />
        </div>
      </div>

      {/* Diagnostic tool */}
      <div className="px-4 mb-2">
        <button
          onClick={() => setShowDiagnostic(!showDiagnostic)}
          className="w-full bg-[#EFEBE9] hover:bg-[#D7CCC8] text-[#5D4037] text-xs font-black py-2.5 px-4 rounded-2xl flex justify-between items-center transition-colors border border-stone-200 shadow-sm"
          style={getFontFamily()}
        >
          <span>🔍 帳戶餘額診斷工具 (點選展開/收合)</span>
          <span>{showDiagnostic ? '▲' : '▼'}</span>
        </button>
        {showDiagnostic && (
          <div className="mt-2 bg-white rounded-3xl p-4 border border-stone-200 text-xs text-stone-600 font-bold space-y-2 max-h-[300px] overflow-y-auto shadow-inner" style={getFontFamily()}>
            <div>帳戶名稱: {account.name} (ID: <span className="font-mono">{account.id}</span>)</div>
            <div>初始金額: ${diagnosticInfo.initial.toLocaleString()}</div>
            {diagnosticInfo.childrenBals.length > 0 && (
              <div className="border-t pt-1 mt-1">
                <div className="text-amber-800">子帳戶加總：</div>
                {diagnosticInfo.childrenBals.map((c, idx) => (
                  <div key={idx} className="pl-2">
                    • {c.name}: ${c.balance.toLocaleString()}
                  </div>
                ))}
              </div>
            )}
            <div className="border-t pt-2 mt-2">
              <div className="text-[#5D4037] font-black mb-1">歷史交易變動明細：</div>
              <div className="space-y-1">
                {diagnosticInfo.log.map((item, idx) => (
                  <div key={idx} className="flex justify-between border-b border-stone-50 pb-1">
                    <div>
                      <span className="text-[11px] text-stone-500 mr-1.5">{item.date}</span>
                      <span>{item.desc}</span>
                    </div>
                    <div className="text-right">
                      <span className={item.amount < 0 ? 'text-rose-500' : item.amount > 0 ? 'text-blue-500' : ''}>
                        {item.amount > 0 ? '+' : ''}{item.amount.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-stone-400 ml-1.5">(累計: ${item.running.toLocaleString()})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Transaction History Section */}
      <div className="flex-1 px-4 flex flex-col gap-4 mt-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-2 gap-4">
            {/* Left Column: Icon + Title & Sorting Button */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#5D4037] rounded-full flex items-center justify-center shrink-0 shadow-md">
                <History size={18} className="text-white" />
              </div>
              <div className="flex flex-col gap-1.5 items-start">
                <span className="font-black text-base text-[#5D4037]" style={getFontFamily()}>往來明細</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setIsSortModalOpen(true)}
                    className="px-3.5 py-1.5 bg-[#FFFDF5] border border-[#5D4037]/25 rounded-2xl font-black text-xs text-[#5D4037]/80 hover:bg-stone-50 hover:text-[#5D4037] active:scale-95 transition-all flex items-center gap-1.5 shrink-0 shadow-sm"
                    title={account.type === 'credit' ? '選擇排序與卡片' : '選擇排序'}
                    style={getFontFamily()}
                  >
                    <ArrowUpDown size={12} className="text-[#5D4037]/50" />
                    <span>
                      {sortMode === 'date-desc' && '消費日 - 新到舊'}
                      {sortMode === 'date-asc' && '消費日 - 舊到新'}
                      {sortMode === 'posting-desc' && (account.type === 'credit' ? '入帳日 - 新到舊' : '入帳 - 新到舊')}
                      {sortMode === 'posting-asc' && (account.type === 'credit' ? '入帳日 - 舊到新' : '入帳 - 舊到新')}
                      {sortMode === 'billing-cycle' && '💳 本期帳單明細 (依結帳日)'}
                    </span>
                  </button>
                  {account.type === 'credit' && selectedCardFilterId && (
                    <span 
                      className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-full font-black text-[10px] flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer transition-all"
                      onClick={() => setSelectedCardFilterId(null)}
                      title="點擊清除卡片篩選"
                      style={getFontFamily()}
                    >
                      <span>卡片: {(Array.isArray(accounts) ? accounts : []).find(a => a.id === selectedCardFilterId)?.name}</span>
                      <span className="text-[8px] opacity-60 ml-0.5">✕</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right Card: Statistics */}
            <div className="bg-white p-3 px-4 rounded-[25px] shadow-sm border border-stone-50 flex flex-col gap-0.5 text-[11px] font-bold text-stone-400 shrink-0 text-left" style={getFontFamily()}>
              <div className="flex items-center justify-between gap-1">
                <span>{accountRecords.length} 筆紀錄</span>
                <span>|</span>
              </div>
              {sortMode === 'billing-cycle' ? (
                <>
                  <div className="flex items-center justify-between gap-1">
                    <span>本期應繳 <span className="text-rose-500 font-black">${creditCardStats.billingCycleSum.toLocaleString()}</span></span>
                    <span>/</span>
                  </div>
                  <div>
                    <span>本期總計 <span className="text-[#5D4037] font-black">{creditCardStats.billingCycleCount}</span> 筆</span>
                  </div>
                </>
              ) : account.type === 'credit' ? (
                <>
                  <div className="flex items-center justify-between gap-1">
                    <span>已轉帳 <span className="text-[#00B0FF] font-black">{creditCardStats.transferredCount}</span> 筆 <span className="text-emerald-600 font-black">${creditCardStats.transferredSum.toLocaleString()}</span></span>
                    <span>/</span>
                  </div>
                  <div>
                    <span>未轉帳 <span className="text-[#FF5252] font-black">{creditCardStats.notTransferredCount}</span> 筆 <span className="text-rose-500 font-black">${creditCardStats.notTransferredSum < 0 ? '-' : ''}{Math.abs(creditCardStats.notTransferredSum).toLocaleString()}</span></span>
                  </div>
                </>
              ) : (
                <div>
                  <span>結餘：<span className={`font-black ${listBalance >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                    {listBalance < 0 ? '-' : ''}${Math.abs(listBalance).toLocaleString()}
                  </span></span>
                </div>
              )}
            </div>
          </div>
          
          {/* Month Switcher Row */}
          <div className="flex items-center justify-center gap-4 bg-white/40 py-2 rounded-2xl mx-1">
            <button 
              onClick={() => changeMonth(-1)}
              className="w-8 h-8 flex items-center justify-center text-[#5D4037] hover:bg-white/60 rounded-full transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <button 
              onClick={() => setIsDatePickerOpen(true)}
              className="text-stone-500 font-bold text-sm tracking-tighter px-3 py-1 hover:bg-white/40 active:scale-95 rounded-xl transition-all"
            >
              {sortMode === 'billing-cycle' ? billingCycleRange.label : dateRangeStrings.range}
            </button>
            <button 
              onClick={() => changeMonth(1)}
              className="w-8 h-8 flex items-center justify-center text-[#5D4037] hover:bg-white/60 rounded-full transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Billing Cycle Summary Header Bar */}
          {sortMode === 'billing-cycle' && (
            <div className="flex items-center justify-between px-3 py-2 border-b border-stone-100/60 my-1 mx-2" style={getFontFamily()}>
              <div className="flex items-center gap-1.5 font-black text-base text-[#5D4037]">
                <span>{billingCycleStatementLabel}</span>
                {!account.isBrandGroup && (
                  <button
                    onClick={() => handleRenameStatement(billingCycleStatementKey, billingCycleStatementLabel)}
                    className="p-1 hover:text-[#FBC02D] active:scale-95 transition-all text-stone-400 hover:text-[#5D4037]"
                    title="點選自訂帳單名稱"
                  >
                    <Pencil size={13} className="opacity-60 hover:opacity-100 transition-opacity" />
                  </button>
                )}
              </div>
              <div className="text-xs font-bold text-stone-500">
                金額: <span className="font-black text-base text-[#5D4037]">${creditCardStats.billingCycleSum.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 bg-white/80 backdrop-blur-sm rounded-[40px] shadow-sm border-2 border-white overflow-hidden flex flex-col">
          {account.type === 'credit' && effectiveClosingDay && sortMode !== 'billing-cycle' ? (
            creditCardStatements.length > 0 ? (
              <div className="overflow-y-auto p-6 space-y-6">
                {creditCardStatements.map(stmt => (
                  <div key={stmt.key} className="space-y-3">
                    {/* Statement Header */}
                    <div className="flex justify-between items-center px-1" style={getFontFamily()}>
                      {stmt.key === '9999-99-payments' ? (
                        <span className="font-black text-sm text-[#5D4037]">
                          {stmt.label}
                        </span>
                      ) : account.isBrandGroup ? (
                        <span className="font-black text-sm text-[#5D4037]">
                          {stmt.label}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleRenameStatement(stmt.key, stmt.label)}
                          className="font-black text-sm text-[#5D4037] hover:text-[#FBC02D] flex items-center gap-1 active:scale-95 transition-all text-left"
                          title="點選自訂帳單名稱"
                        >
                          <span>{stmt.label}</span>
                          <Pencil size={11} className="opacity-45 hover:opacity-100 transition-opacity" />
                        </button>
                      )}
                      <span className="text-xs font-bold text-stone-400">
                        金額: <span className="font-black text-sm text-[#5D4037]">${Math.abs(stmt.balance).toLocaleString()}</span>
                      </span>
                    </div>

                    {/* Statement Transactions Container */}
                    <div className="bg-white rounded-[32px] p-4 shadow-sm border-2 border-white flex flex-col gap-2">
                      {stmt.key === '9999-99-payments'
                        ? stmt.records.map(renderRecord)
                        : renderRecordList(stmt.records, '本期無任何交易紀錄')}
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
                  <span className="font-black text-lg text-stone-300">本月無任何帳單紀錄</span>
                </div>
              </div>
            )
          ) : account.type === 'credit' && !effectiveClosingDay ? (
            accountRecords.length > 0 ? (
              <div className="overflow-y-auto p-6 space-y-6">
                {paymentRecords.length > 0 && (
                  <div className="space-y-3">
                    <div className="px-1 font-black text-sm text-[#5D4037]">
                      轉帳紀錄
                      <span className="text-xs font-bold text-stone-400 ml-2">
                        金額: <span className="font-black text-sm text-[#5D4037]">
                          $ {paymentRecords.reduce((sum, r) => sum + (r.toAmount !== undefined ? r.toAmount : Math.abs(r.amount * (r.exchangeRate || 1))), 0).toLocaleString()}
                        </span>
                      </span>
                    </div>
                    <div className="bg-white rounded-[32px] p-4 shadow-sm border-2 border-white flex flex-col gap-2">
                      {paymentRecords.map(renderRecord)}
                    </div>
                  </div>
                )}
                
                <div className="space-y-3">
                  {paymentRecords.length > 0 && (
                    <div className="px-1 font-black text-sm text-[#5D4037]">
                      本月明細
                    </div>
                  )}
                  <div className="bg-white rounded-[32px] p-4 shadow-sm border-2 border-white flex flex-col gap-2">
                    {renderRecordList(normalRecords, '本月無任何消費明細紀錄')}
                  </div>
                </div>
                <div className="h-[40px] w-full" />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-6 text-stone-200">
                <div className="w-24 h-24 bg-[#FFFDF5] rounded-full flex items-center justify-center border-4 border-white shadow-inner">
                  <AlertCircle size={48} />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="font-black text-lg text-stone-300">本月無任何交易紀錄</span>
                </div>
              </div>
            )
          ) : (
            normalRecords.length > 0 ? (
              <div className="overflow-y-auto p-6 space-y-4">
                {renderRecordList(normalRecords, '尚無明細紀錄')}
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
            )
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
            records={records}
            accounts={accounts}
            projects={projects}
            categories={categories}
            onClose={() => setEditingRecord(null)}
            onSave={(updated, mergedIdsToDelete, restoredIds) => {
              onUpdateRecord(editingRecord, updated, mergedIdsToDelete, restoredIds);
              setEditingRecord(null);
            }}
            onDelete={() => {
              onDeleteRecord(editingRecord);
              setEditingRecord(null);
            }}
            onDuplicate={(rec) => {
              setEditingRecord(null);
              onDuplicateRecord?.(rec);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDatePickerOpen && (
          <YearMonthPickerModal 
            initialYear={currentMonth.getFullYear()}
            initialMonth={currentMonth.getMonth() + 1}
            onClose={() => setIsDatePickerOpen(false)}
            onSelect={(year, month) => {
              setCurrentMonth(new Date(year, month - 1, 1));
            }}
          />
        )}
      </AnimatePresence>

      {/* Sort Options Modal */}
      <AnimatePresence>
        {isSortModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-[#5D4037]/40 backdrop-blur-md" 
              onClick={() => setIsSortModalOpen(false)} 
            />
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} 
              className="relative bg-[#FFFDF5] w-full max-w-xs rounded-[35px] shadow-2xl border-2 border-white flex flex-col p-6 space-y-4 max-h-[85vh]"
            >
              <div className="flex items-center justify-between border-b border-stone-100 pb-2 flex-shrink-0">
                <h4 className="font-black text-[#5D4037] text-base" style={getFontFamily()}>選擇排序</h4>
                <button onClick={() => setIsSortModalOpen(false)} className="p-1 hover:bg-stone-100 rounded-full transition-colors">
                  <X size={18} className="text-stone-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 space-y-4 max-h-[60vh] custom-scrollbar">
                <div className="flex flex-col gap-2">
                  {(account.type === 'credit' ? [
                    { mode: 'date-desc', label: '消費日 - 新到舊' },
                    { mode: 'date-asc', label: '消費日 - 舊到新' },
                    { mode: 'posting-desc', label: '入帳日 - 新到舊' },
                    { mode: 'posting-asc', label: '入帳日 - 舊到新' },
                    { mode: 'billing-cycle', label: '💳 本期帳單明細 (依結帳日週期)' }
                  ] : [
                    { mode: 'date-desc', label: '消費日 - 新到舊' },
                    { mode: 'date-asc', label: '消費日 - 舊到新' },
                    { mode: 'posting-desc', label: '入帳 - 新到舊' },
                    { mode: 'posting-asc', label: '入帳 - 舊到新' }
                  ]).map(opt => (
                    <button
                      key={opt.mode}
                      onClick={() => {
                        setSortMode(opt.mode as any);
                        setIsSortModalOpen(false);
                      }}
                      className={`w-full py-4 px-6 rounded-2xl font-bold text-left text-sm transition-all active:scale-98 ${sortMode === opt.mode ? 'bg-[#5D4037] text-white shadow-md' : 'bg-white hover:bg-stone-50 text-[#5D4037] border border-stone-100 shadow-sm'}`}
                      style={getFontFamily()}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {account.type === 'credit' && account.isBrandGroup && orderedChildCards.length > 1 && (
                  <div className="border-t border-stone-100 pt-3 flex flex-col gap-2" style={getFontFamily()}>
                    <div className="text-xs font-black text-stone-500 uppercase tracking-widest px-1">卡片分區 (GROUP BY CARD)</div>
                    <button
                      onClick={() => setGroupByCard(!groupByCard)}
                      className={`w-full py-4 px-5 rounded-2xl font-bold text-left text-sm transition-all active:scale-98 flex items-center justify-between gap-2 ${groupByCard ? 'bg-[#5D4037] text-white shadow-md' : 'bg-white hover:bg-stone-50 text-[#5D4037] border border-stone-100 shadow-sm'}`}
                    >
                      <span>🗂️ 依卡片分組顯示（卡片分區依序排列）</span>
                      <span
                        className={`flex-shrink-0 w-10 h-6 rounded-full p-0.5 transition-colors ${groupByCard ? 'bg-[#FBC02D]' : 'bg-stone-200'}`}
                      >
                        <span
                          className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${groupByCard ? 'translate-x-4' : 'translate-x-0'}`}
                        />
                      </span>
                    </button>

                    {groupByCard && (
                      <div className="flex flex-col gap-1.5 bg-white rounded-2xl border border-stone-100 p-2">
                        <div className="text-[11px] font-bold text-stone-400 px-2 pt-1">調整卡片排列順序（由上而下顯示）</div>
                        {orderedChildCards.map((card, idx) => (
                          <div
                            key={card.id}
                            className="flex items-center gap-2 px-2 py-2 rounded-xl bg-[#FFFDF5] border border-stone-100"
                          >
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#5D4037] text-white text-[10px] font-black flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="flex-1 min-w-0 text-xs font-black text-[#5D4037] truncate">{card.name}</span>
                            <button
                              onClick={() => moveCard(idx, -1)}
                              disabled={idx === 0}
                              className="p-1 rounded-lg hover:bg-stone-100 disabled:opacity-25 disabled:cursor-not-allowed"
                              title="上移"
                            >
                              <ChevronUp size={16} className="text-[#5D4037]" />
                            </button>
                            <button
                              onClick={() => moveCard(idx, 1)}
                              disabled={idx === orderedChildCards.length - 1}
                              className="p-1 rounded-lg hover:bg-stone-100 disabled:opacity-25 disabled:cursor-not-allowed"
                              title="下移"
                            >
                              <ChevronDown size={16} className="text-[#5D4037]" />
                            </button>
                          </div>
                        ))}
                        {selectedCardFilterId && (
                          <div className="text-[11px] font-bold text-amber-600 px-2 pb-1">
                            目前已篩選單一卡片，請切換為「全部卡片明細」以顯示分區。
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {account.isBrandGroup && (account as any).childAccounts && (account as any).childAccounts.length > 0 && (
                  <div className="border-t border-stone-100 pt-3 flex flex-col gap-2">
                    <div className="text-xs font-black text-stone-500 uppercase tracking-widest px-1">分卡別篩選 (FILTER BY CARD)</div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => {
                          setSelectedCardFilterId(null);
                          setIsSortModalOpen(false);
                        }}
                        className={`w-full py-4 px-6 rounded-2xl font-bold text-left text-sm transition-all active:scale-98 ${selectedCardFilterId === null ? 'bg-[#5D4037] text-white shadow-md' : 'bg-white hover:bg-stone-50 text-[#5D4037] border border-stone-100 shadow-sm'}`}
                        style={getFontFamily()}
                      >
                        💳 全部卡片明細
                      </button>
                      {(Array.isArray((account as any)?.childAccounts) ? (account as any).childAccounts : []).map((child: any) => (
                        <button
                          key={child.id}
                          onClick={() => {
                            setSelectedCardFilterId(child.id);
                            setIsSortModalOpen(false);
                          }}
                          className={`w-full py-4 px-6 rounded-2xl font-bold text-left text-sm transition-all active:scale-98 ${selectedCardFilterId === child.id ? 'bg-[#5D4037] text-white shadow-md' : 'bg-white hover:bg-stone-50 text-[#5D4037] border border-stone-100 shadow-sm'}`}
                          style={getFontFamily()}
                        >
                          💳 {child.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

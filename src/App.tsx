import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  Menu, 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  X, 
  Delete, 
  Wallet, 
  Smile, 
  Home, 
  BarChart3, 
  MoreHorizontal,
  Camera,
  Loader2,
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
  ArrowRightLeft,
  ArrowUpDown,
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
  Gift,
  Lightbulb,
  Heart,
  Utensils,
  ShoppingCart,
  Bus,
  Home as HomeIcon,
  Banknote as BanknoteIcon,
  Diamond,
  Database,
  Download,
  Upload,
  ShieldCheck,
  LogOut,
  Cloud,
  CloudUpload,
  CloudDownload,
  Loader2,
  GripVertical,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut,
  User
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  collection, 
  onSnapshot, 
  deleteDoc,
  getDocFromServer,
  writeBatch,
  serverTimestamp,
  getDocs,
  getDoc
} from 'firebase/firestore';
import { 
  PieChart as RePieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend,
  LineChart,
  Line
} from 'recharts';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, isSameMonth, parseISO } from 'date-fns';
import { db, auth, googleProvider } from './lib/firebase';

// --- Firebase Error Handling ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Types ---

interface Category {
  id: string;
  name: string;
  icon: string;
  type: 'income' | 'expense';
  sub: string[];
  order?: number;
  budget?: number;
  subBudgets?: Record<string, number>;
}

interface Transaction {
  id: string;
  amount: number;      // 原始金額 (來源帳戶幣別)
  category: string;
  note?: string;
  remark?: string;
  date: string;        // 消費日 YYYY-MM-DD
  postingDate?: string; // 入帳日 YYYY-MM-DD
  isPending?: boolean;  // 待入帳
  type: 'income' | 'expense' | 'transfer';
  accountId: string;   // 來源帳戶
  toAccountId?: string; // 轉帳目標帳戶
  toAmount?: number;   // 目標帳戶收到的金額 (換匯後)
  exchangeRate?: number; // 匯率 (1 來源幣別 = X 目標幣別)
  isInstallment?: boolean;
  totalInstallments?: number;
  currentInstallment?: number;
  installmentGroupId?: string;
  projectId?: string;
  fee?: number;
  transferredDate?: string;
  isCompleted?: boolean;
  status?: 'active' | 'settled';
  paidCount?: number;
  paidTerms?: number;
  totalTerms?: number;
  currency?: string;   // 幣別 (如 "TWD", "USD", "JPY", "KRW")
  order?: number;
  _importSourceAccountName?: string;
  _importDestAccountName?: string;
  _importProjectName?: string;
  _importBalance?: number;
  _importMainAccountName?: string;
  _isMergedTransfer?: boolean;
  _mergedRecordIds?: string[];
  _mergedDisplayName?: string;
}

type CurrencyMode = 'TWD' | 'FOREIGN' | null;

interface Account {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'investment' | 'credit' | 'e-ticket' | 'e-payment' | 'points' | 'deposit' | 'insurance' | 'other';
  icon: string;
  parentId?: string;
  currency: string;    // 幣別 (如 "TWD", "USD", "JPY")
  closingDay?: number; // 信用卡結帳日 (1-31)
  billMonthOffset?: number; // 信用卡帳單月份偏移量 (如 -1 代表前一個月)
  customStatementLabels?: Record<string, string>; // 自訂帳單名稱對照表 (Key為 YYYY-MM)
  initialBalance?: number; // 初始金額
  order?: number;      // 排序權重
  creditLimit?: number; // 信用總額度
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
  note?: string;
}

interface Installment {
  id: string;
  name: string;
  totalAmount: number;
  accountId: string;
  category: string;
  startDate: string;
  totalTerms: number;
  period: 'monthly';
}

interface Project {
  id: string;
  name: string;
  budget?: number;
  icon?: string;
  color?: string;
  description?: string;
  parentId?: string;
  order?: number;
}

// --- Initial Data ---

const INITIAL_CATEGORIES: Category[] = [
  { id: 'c1', name: '食物', icon: '🍱', type: 'expense', sub: ['早餐', '午餐', '晚餐', '飲料', '零食'], order: 1 },
  { id: 'c2', name: '交通', icon: '🚗', type: 'expense', sub: ['捷運', '公車', '火車', '加油', '停車'], order: 2 },
  { id: 'c3', name: '購物', icon: '🛍️', type: 'expense', sub: ['服飾', '日用品', '電子產品', '美妝'], order: 3 },
  { id: 'c4', name: '娛樂', icon: '🍿', type: 'expense', sub: ['電影', '遊戲', 'KTV', '旅遊'], order: 4 },
  { id: 'c10', name: '電影', icon: '🎬', type: 'expense', sub: ['威秀電影', '國賓影城', 'Netflix'], order: 5 },
  { id: 'c5', name: '生活', icon: '🏠', type: 'expense', sub: ['房租', '水電費', '電話費', '保險'], order: 6 },
  { id: 'c6', name: '醫療', icon: '🏥', type: 'expense', sub: ['診所', '藥局', '保健品'], order: 7 },
  { id: 'c7', name: '其他', icon: '✨', type: 'expense', sub: ['雜項', '捐款', '禮物'], order: 8 },
  { id: 'c8', name: '薪資', icon: '💼', type: 'income', sub: ['月薪', '獎金', '兼職'], order: 1 },
  { id: 'c9', name: '投資', icon: '📈', type: 'income', sub: ['股利', '利息', '價差'], order: 2 },
];

const INITIAL_ACCOUNTS: Account[] = [
  { id: 'cash', name: '現金', type: 'cash', icon: '💰', currency: 'TWD', order: 1 },
];

const INITIAL_RECORDS: Transaction[] = [];

const INITIAL_TEMPLATES: Template[] = [
  { id: 't1', name: '火車通勤', amount: 41, category: '交通', type: 'expense', fromAccountId: 'cash', icon: '🚂', color: 'bg-blue-50' },
  { id: 't2', name: '自動加值', amount: 500, category: '交通', type: 'transfer', fromAccountId: 'credit_ts', toAccountId: 'easycard', icon: '⚡', color: 'bg-emerald-50' },
  { id: 't3', name: '薪資收入', amount: 29500, category: '薪資', type: 'income', fromAccountId: 'bank_ts_1', icon: '💼', color: 'bg-amber-50' },
];

const INITIAL_PROJECTS: Project[] = [
  { id: 'p1', name: '預設專案', icon: '📂', color: 'bg-stone-100', description: '系統預設專案', order: 1 },
];

// --- Main App ---

import { getCategoryIcon, getFontFamily } from './lib/financeUtils';

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

const getTransferSourceAndDest = (tx: Transaction) => {
  const isPos = tx.amount > 0;
  const src = isPos ? (tx.toAccountId || '') : tx.accountId;
  const dst = isPos ? tx.accountId : (tx.toAccountId || '');
  return { src, dst };
};

const getLatestExchangeRate = (records: Transaction[], accounts: Account[], targetCurrency: string, beforeDate?: string): number => {
  if (!targetCurrency || targetCurrency === 'TWD') return 1;
  
  const relevantTransfers = records.filter(r => {
    if (r.type !== 'transfer' && !r._isMergedTransfer) return false;
    if (beforeDate && r.date > beforeDate) return false;
    
    const srcAcc = accounts.find(a => a.id === r.accountId);
    const dstAcc = accounts.find(a => a.id === r.toAccountId);
    const srcCur = srcAcc?.currency || 'TWD';
    const dstCur = dstAcc?.currency || 'TWD';
    
    return (srcCur === 'TWD' && dstCur === targetCurrency) || (srcCur === targetCurrency && dstCur === 'TWD');
  });
  
  if (relevantTransfers.length > 0) {
    relevantTransfers.sort((a, b) => {
      const dateDiff = b.date.localeCompare(a.date);
      if (dateDiff !== 0) return dateDiff;
      return b.id.localeCompare(a.id);
    });
    const latest = relevantTransfers[0];
    if (latest.exchangeRate) {
      return latest.exchangeRate;
    }
  }
  
  if (targetCurrency === 'JPY') return 0.22;
  if (targetCurrency === 'USD') return 32.5;
  if (targetCurrency === 'KRW') return 0.024;
  if (targetCurrency === 'EUR') return 35.0;
  return 1;
};

const convertCurrency = (amount: number, fromCurrency: string, toCurrency: string, records: Transaction[], accounts: Account[]): number => {
  if (fromCurrency === toCurrency) return amount;
  
  // Convert to TWD first
  let twdAmount = amount;
  if (fromCurrency !== 'TWD') {
    const rate = getLatestExchangeRate(records, accounts, fromCurrency);
    twdAmount = amount * rate;
  }
  
  // Convert TWD to target currency
  if (toCurrency === 'TWD') {
    return twdAmount;
  } else {
    const rate = getLatestExchangeRate(records, accounts, toCurrency);
    return rate > 0 ? twdAmount / rate : twdAmount;
  }
};

const getTwdEquivalentText = (records: Transaction[], accounts: Account[], record: Transaction): string | null => {
  const recordCurrency = record.currency || accounts.find(a => a.id === record.accountId)?.currency || 'TWD';
  if (recordCurrency === 'TWD') return null;
  
  let twdAmt = 0;
  
  if (record.type === 'transfer' || record._isMergedTransfer) {
    const { src, dst } = getTransferSourceAndDest(record);
    const srcAcc = accounts.find(a => a.id === src);
    const dstAcc = accounts.find(a => a.id === dst);
    const srcCur = srcAcc?.currency || 'TWD';
    const dstCur = dstAcc?.currency || 'TWD';
    
    if (srcCur === 'TWD') {
      twdAmt = Math.abs(record.amount);
    } else if (dstCur === 'TWD') {
      twdAmt = record.toAmount !== undefined ? record.toAmount : Math.abs(record.amount * (record.exchangeRate || 1));
    } else {
      const rate = record.exchangeRate || getLatestExchangeRate(records, accounts, srcCur, record.date);
      twdAmt = Math.abs(record.amount) * rate;
    }
  } else {
    const rate = getLatestExchangeRate(records, accounts, recordCurrency, record.date);
    twdAmt = Math.abs(record.amount) * rate;
  }
  
  return `(約 NT$ ${Math.round(twdAmt).toLocaleString()})`;
};

const getBankKeyword = (name: string, parentName?: string): string | null => {
  const banks = [
    '中國信託', '中信', '國泰世華', '國泰', '玉山', '台北富邦', '富邦', '台新', 
    '聯邊', '聯邦', '永豐', '星展', 'DBS', '渣打', '匯豐', 'HSBC', '新光', '元大', '華南', 
    '兆豐', '第一', '一銀', '合作金庫', '合庫', '彰化', '彰銀', '土地', '土銀', 
    '臺灣銀行', '台銀', '上海', '凱基', '樂天'
  ];
  for (const b of banks) {
    if (name.includes(b)) {
      if (b === '中國信託' || b === '中信') return '中信';
      if (b === '國泰世華' || b === '國泰') return '國泰';
      if (b === '台北富邦' || b === '富邦') return '富邦';
      if (b === '一銀' || b === '第一') return '第一';
      if (b === '合作金庫' || b === '合庫') return '合庫';
      if (b === '彰化' || b === '彰銀') return '彰銀';
      if (b === '土地' || b === '土銀') return '土銀';
      if (b === '臺灣銀行' || b === '台銀') return '台銀';
      return b;
    }
  }
  if (parentName) {
    for (const b of banks) {
      if (parentName.includes(b)) {
        if (b === '中國信託' || b === '中信') return '中信';
        if (b === '國泰世華' || b === '國泰') return '國泰';
        if (b === '台北富邦' || b === '富邦') return '富邦';
        if (b === '一銀' || b === '第一') return '第一';
        if (b === '合作金庫' || b === '合庫') return '合庫';
        if (b === '彰化' || b === '彰銀') return '彰銀';
        if (b === '土地' || b === '土銀') return '土銀';
        if (b === '臺灣銀行' || b === '台銀') return '台銀';
        return b;
      }
    }
  }
  return null;
};

export const getGroupedAndUngrouped = (accountsList: Account[]) => {
  const groups: { [key: string]: Account[] } = {};
  const ungrouped: Account[] = [];

  accountsList.forEach(acc => {
    const parentName = acc.parentId ? accountsList.find(x => x.id === acc.parentId)?.name : undefined;
    const bankKey = getBankKeyword(acc.name, parentName);
    if (bankKey) {
      if (!groups[bankKey]) groups[bankKey] = [];
      groups[bankKey].push(acc);
    } else {
      ungrouped.push(acc);
    }
  });

  const grouped: { bankName: string; accounts: Account[] }[] = [];
  const single: Account[] = [...ungrouped];

  Object.keys(groups).forEach(key => {
    if (groups[key].length > 1) {
      grouped.push({ bankName: key, accounts: groups[key] });
    } else {
      single.push(...groups[key]);
    }
  });

  return { groupedList: grouped, singleList: single };
};

const checkAreAccountsSameBank = (accA: { id: string; name: string; parentId?: string; type: string }, accB: { id: string; name: string; parentId?: string; type: string }, accountsList: Account[]): boolean => {
  if (accA.id === accB.id) return false;
  if (accA.type !== 'credit' || accB.type !== 'credit') return false;
  
  // 1. Same parentId (non-empty)
  if (accA.parentId && accB.parentId && accA.parentId === accB.parentId) return true;
  
  // 2. Same bank keyword in their name or parent name
  const getParentName = (a: { id: string; name: string; parentId?: string }) => a.parentId ? accountsList.find(x => x.id === a.parentId)?.name : undefined;
  const keywordA = getBankKeyword(accA.name, getParentName(accA));
  const keywordB = getBankKeyword(accB.name, getParentName(accB));
  
  return !!(keywordA && keywordB && keywordA === keywordB);
};

const getMergedRecords = (txs: Transaction[], accounts: Account[]): Transaction[] => {
  const cleanedTxs = txs.map(t => {
    if (t.type === 'transfer' && t.accountId && t.toAccountId && t.amount > 0) {
      return {
        ...t,
        accountId: t.toAccountId,
        toAccountId: t.accountId,
        amount: -t.amount
      };
    }
    return t;
  });

  const result: Transaction[] = [];
  const matchedIds = new Set<string>();

  for (let i = 0; i < cleanedTxs.length; i++) {
    const A = cleanedTxs[i];
    if (matchedIds.has(A.id)) {
      continue;
    }

    if (A.type === 'transfer' && A.amount !== 0) {
      // Look for a matching transfer with opposite sign and same details
      const A_isPos = A.amount > 0;
      const A_src = A_isPos ? (A.toAccountId || '') : A.accountId;
      const A_dst = A_isPos ? A.accountId : (A.toAccountId || '');

      let foundMatch = false;
      for (let j = i + 1; j < txs.length; j++) {
        const B = txs[j];
        if (matchedIds.has(B.id)) {
          continue;
        }

        if (
          B.type === 'transfer' &&
          B.date === A.date &&
          Math.abs(B.amount) === Math.abs(A.amount) &&
          B.amount * A.amount < 0
        ) {
          const B_isPos = B.amount > 0;
          const B_src = B_isPos ? (B.toAccountId || '') : B.accountId;
          const B_dst = B_isPos ? B.accountId : (B.toAccountId || '');

          const resolvedSender = A_src || B_src;
          const resolvedDest = A_dst || B_dst;

          // Conflict resolution:
          const hasSenderConflict = A_src && B_src && A_src !== B_src;
          const hasDestConflict = A_dst && B_dst && A_dst !== B_dst;

          if (!hasSenderConflict && !hasDestConflict && resolvedSender && resolvedDest && resolvedSender !== resolvedDest) {
            matchedIds.add(B.id);
            // primary uses the negative amount/transfer out
            const primary = A.amount < 0 ? A : B;
            const secondary = A.amount < 0 ? B : A;
            
            const srcName = accounts.find(a => a.id === resolvedSender)?.name || '未知帳戶';
            const dstName = accounts.find(a => a.id === resolvedDest)?.name || '未知帳戶';

            const mergedTx: Transaction = {
              ...primary,
              accountId: resolvedSender,
              toAccountId: resolvedDest,
              _isMergedTransfer: true,
              _mergedRecordIds: [primary.id, secondary.id],
              _mergedDisplayName: `轉帳：${srcName} ➔ ${dstName}`,
            };
            result.push(mergedTx);
            foundMatch = true;
            break;
          }
        }
      }

      if (!foundMatch) {
         result.push(A);
      }
    } else {
      result.push(A);
    }
  }

  // Deduplicate transfer records that represent the same physical transfer
  const finalResult: Transaction[] = [];
  const processedKeys = new Set<string>(); // key format: date_amount_src_dst

  result.forEach(tx => {
    if (tx.type === 'transfer' || tx._isMergedTransfer) {
      const { src, dst } = getTransferSourceAndDest(tx);
      const absAmt = Math.abs(tx.amount);
      const date = tx.date;
      
      let isDuplicate = false;
      for (const processedKey of processedKeys) {
        const [pDate, pAmtStr, pSrc, pDst] = processedKey.split('|');
        const pAmt = parseFloat(pAmtStr);
        if (pDate === date && pAmt === absAmt) {
          // Check for matches or overlaps
          if (
            (src && dst && pSrc === src && pDst === dst) ||
            (!src && dst && pDst === dst) ||
            (src && !dst && pSrc === src)
          ) {
            isDuplicate = true;
            break;
          }
        }
      }
      
      if (isDuplicate) {
        return; // Skip adding duplicate transfers to the active collection
      }
      
      processedKeys.add(`${date}|${absAmt}|${src}|${dst}`);
    }
    finalResult.push(tx);
  });

  return finalResult;
};

const getTransactionTitle = (record: Transaction): string => {
  const cleanRemark = (record.remark || '').replace(/\[固定收支\] /g, '').replace(/\[固定收支\]/g, '').trim();
  const cleanNote = (record.note || '').replace(/\[固定收支\] /g, '').replace(/\[固定收支\]/g, '').trim();
  
  if (record.type === 'transfer' || record._isMergedTransfer) {
    if (cleanRemark) return cleanRemark;
    if (cleanNote && cleanNote !== '轉帳' && cleanNote !== '未命名明細') return cleanNote;
    if (record._isMergedTransfer && record._mergedDisplayName) {
      return record._mergedDisplayName;
    }
    return '轉帳';
  }
  return (record.note || record.category).replace(/\[固定收支\] /g, '').replace(/\[固定收支\]/g, '').trim();
};

// Firestore sync functions
const cleanData = (obj: any) => {
  if (obj === null || typeof obj !== 'object') return obj;
  const newObj = Array.isArray(obj) ? [...obj] : { ...obj };
  Object.keys(newObj).forEach(key => {
    if (newObj[key] === undefined) {
      delete newObj[key];
    } else if (newObj[key] !== null && typeof newObj[key] === 'object') {
      newObj[key] = cleanData(newObj[key]);
    }
  });
  return newObj;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'home' | 'reports' | 'more' | 'accounts' | 'calendar' | 'accountDetail' | 'history' | 'fixedRecords' | 'projects' | 'budget' | 'categories' | 'installments' | 'search'>('home');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isCategoryActionMenuOpen, setIsCategoryActionMenuOpen] = useState(false);
  const [isProjectActionMenuOpen, setIsProjectActionMenuOpen] = useState(false);
  const [isAccountEditModalOpen, setIsAccountEditModalOpen] = useState(false);
  const [isAccountSortModalOpen, setIsAccountSortModalOpen] = useState(false);
  const [isProjectEditModalOpen, setIsProjectEditModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => formatLocalDate(new Date()));
  const [records, setRecords] = useState<Transaction[]>(INITIAL_RECORDS);
  const [accounts, setAccounts] = useState<Account[]>(INITIAL_ACCOUNTS);
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [monthlyBudget, setMonthlyBudget] = useState<number>(30000);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [selectedAccountForDetail, setSelectedAccountForDetail] = useState<Account | null>(null);
  const [historyFilter, setHistoryFilter] = useState<{ type: 'day' | 'week' | 'month' | 'year', date: string }>({ type: 'day', date: selectedDate });
  const [templates, setTemplates] = useState<Template[]>(INITIAL_TEMPLATES);
  const [fixedRecords, setFixedRecords] = useState<FixedRecord[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [rawProjects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const projects = useMemo(() => {
    return [...rawProjects].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }, [rawProjects]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isProjectSortModalOpen, setIsProjectSortModalOpen] = useState(false);
  const [currencyMode, setCurrencyMode] = useState<'TWD' | 'FOREIGN' | null>('TWD');

  // --- History Navigation Sync for Hardware Back Button ---
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state) {
        if (event.state.view) setCurrentView(event.state.view);
        setSelectedProjectId(event.state.projectId || null);
        setIsDrawerOpen(!!event.state.isDrawerOpen);
        setIsRecordModalOpen(!!event.state.isRecordModalOpen);
      } else {
        setCurrentView('home');
        setSelectedProjectId(null);
        setIsDrawerOpen(false);
        setIsRecordModalOpen(false);
      }
    };

    // Initialize root state
    if (!window.history.state) {
      window.history.replaceState({ 
        view: 'home', 
        projectId: null, 
        isDrawerOpen: false,
        isRecordModalOpen: false
      }, '');
    }

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    const currentState = window.history.state;
    const matchesView = currentState && currentState.view === currentView;
    const matchesProject = currentState && currentState.projectId === selectedProjectId;
    const matchesDrawer = currentState && !!currentState.isDrawerOpen === isDrawerOpen;
    const matchesRecordModal = currentState && !!currentState.isRecordModalOpen === isRecordModalOpen;

    if (!matchesView || !matchesProject || !matchesDrawer || !matchesRecordModal) {
      window.history.pushState({ 
        view: currentView, 
        projectId: selectedProjectId, 
        isDrawerOpen: isDrawerOpen,
        isRecordModalOpen: isRecordModalOpen
      }, '');
    }
  }, [currentView, selectedProjectId, isDrawerOpen, isRecordModalOpen]);

  // --- PWA Installation Logic ---
  const deferredPromptRef = useRef<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [showPWAReminder, setShowPWAReminder] = useState(true);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event in ref to avoid React state proxy contexts losses
      deferredPromptRef.current = e;
      setIsInstallable(true);
      console.log('PWA beforeinstallprompt event captured.');
    };

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setIsInstallable(false);
      deferredPromptRef.current = null;
      console.log('PWA was installed.');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check if app is already installed / running in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
      setIsAppInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    const promptEvent = deferredPromptRef.current;
    if (!promptEvent) return;
    
    try {
      // Show the install prompt
      promptEvent.prompt();
      // Wait for the user to respond to the prompt
      const { outcome } = await promptEvent.userChoice;
      console.log(`User response to install prompt: ${outcome}`);
    } catch (err) {
      console.error("PWA installation prompt execution failed:", err);
    } finally {
      // Discard the prompt to prevent multiple invocation crashes
      deferredPromptRef.current = null;
      setIsInstallable(false);
    }
  };

  // --- Auth & Firebase Logic ---

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error: any) {
        // unreachable, unavailable, or similar network-level errors
        if(error.message?.includes('the client is offline') || error.code === 'unavailable' || error.code === 'unreachable') {
          console.error("Firebase 連線失敗：無法接觸到資料庫伺服器。", error);
          if (navigator.onLine) {
            alert('【Firebase 資料庫連線失敗】\n\n這通常是因為以下原因之一：\n1. 您尚未在 Firebase 控制台「建立」Firestore 資料庫。\n2. 資料庫建立時「ID」不是 (default)。\n3. 您的網路環境阻擋了 WebSockets (已嘗試切換長輪詢模式)。\n\n請前往 Firebase 控制台確認資料庫狀態。');
          }
        } else if (error.code === 'permission-denied') {
          // This is actually GOOD - it means we reached the server and it rejected us (because we are not logged in yet)
          console.log("Firebase 連線成功 (權限已驗證)");
        } else {
          console.error("Firebase 初始化測試異常:", error);
        }
      }
    };
    testConnection();

    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      if (!u) {
        // Reset state to truly empty data on logout
        setRecords([]);
        setAccounts([]);
        setCategories(INITIAL_CATEGORIES);
        setProjects([]);
        setTemplates([]);
        setFixedRecords([]);
        setInstallments([]);
        setMonthlyBudget(0);
      }
    });
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error('Login failed', error);
      if (error.code === 'auth/configuration-not-found') {
        alert('【關鍵設定缺失】\n您的 Firebase 專案尚未啟用 Google 登入。\n\n請執行以下步驟：\n1. 前往 Firebase 控制台\n2. 點擊左側「Authentication」\n3. 進入「Sign-in method」頁籤\n4. 點擊「Add new provider」並選擇「Google」並儲存。');
      } else if (error.code === 'auth/unauthorized-domain') {
        const currentDomain = window.location.hostname;
        alert(`【網域未授權】\n目前網域 (${currentDomain}) 尚未加入授權清單。\n\n請執行以下步驟：\n1. 前往 Firebase 控制台 > Authentication > Settings\n2. 找到「Authorized domains」\n3. 將 ${currentDomain} 加入清單中。`);
      } else {
        alert(`登入失敗：${error.message || '請檢查網路連線或稍後再試'}`);
      }
    }
  };

  const handleLogout = async () => {
    try {
      localStorage.clear();
      await signOut(auth);
      // Reset all finance states manually as requested
      setRecords([]);
      setAccounts([]);
      setProjects([]);
      setMonthlyBudget(0);
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  // Real-time synchronization
  useEffect(() => {
    if (!user) return;

    const unsubRecords = onSnapshot(collection(db, 'users', user.uid, 'transactions'), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Transaction);
      // Removed Length check to allow clearing records locally when DB is empty
      setRecords(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/transactions`));

    const unsubAccounts = onSnapshot(collection(db, 'users', user.uid, 'accounts'), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Account);
      // 強制依 order 排序
      const sortedData = data.sort((a, b) => (a.order || 0) - (b.order || 0));
      setAccounts(sortedData);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/accounts`));

    const unsubCategories = onSnapshot(collection(db, 'users', user.uid, 'categories'), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Category);
      setCategories(snapshot.docs.length > 0 ? data : INITIAL_CATEGORIES);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/categories`));

    const unsubProjects = onSnapshot(collection(db, 'users', user.uid, 'projects'), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Project);
      setProjects(snapshot.docs.length > 0 ? data : INITIAL_PROJECTS);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/projects`));

    const unsubFixed = onSnapshot(collection(db, 'users', user.uid, 'fixedRecords'), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as FixedRecord);
      setFixedRecords(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/fixedRecords`));

    const unsubInstallments = onSnapshot(collection(db, 'users', user.uid, 'installments'), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Installment);
      setInstallments(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/installments`));

    const unsubTemplates = onSnapshot(collection(db, 'users', user.uid, 'templates'), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Template);
      setTemplates(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/templates`));

    const unsubProfile = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      const data = snapshot.data();
      if (data?.monthlyBudget) setMonthlyBudget(data.monthlyBudget);
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}`));

    return () => {
      unsubRecords();
      unsubAccounts();
      unsubCategories();
      unsubProjects();
      unsubFixed();
      unsubInstallments();
      unsubTemplates();
      unsubProfile();
    };
  }, [user]);

  // Ensure at least one default account and project exists for logged-in users who have none
  useEffect(() => {
    // Only proceed if loading is finished, user is present, and NO accounts exist.
    // We add a tiny delay or check a flag if necessary, but checking accounts.length usually suffices
    // as long as the snapshot listener has had a chance to run.
    if (user && !authLoading && accounts.length === 0) {
      // Check if we are currently importing to avoid race conditions
      // (Though length won't be 0 if import started, but safety first)
      const defaultAcc: Account = { id: 'cash', name: '現金', type: 'cash', icon: '💰', currency: 'TWD', order: 1 };
      setDoc(doc(db, 'users', user.uid, 'accounts', 'cash'), cleanData(defaultAcc)).catch(console.error);
    }
    if (user && !authLoading && projects.length === 0) {
      const defaultProject: Project = { id: 'p1', name: '預設專案', icon: '📂', color: 'bg-stone-100', description: '系統預設專案' };
      setDoc(doc(db, 'users', user.uid, 'projects', 'p1'), cleanData(defaultProject)).catch(console.error);
    }
  }, [user, authLoading, accounts.length, projects.length]);

  // One-time migration for fixed/recurring transactions with positive amount bug
  const hasMigratedFixedRef = useRef(false);
  useEffect(() => {
    if (hasMigratedFixedRef.current || records.length === 0 || authLoading) return;
    hasMigratedFixedRef.current = true;

    let changed = false;
    const updated = records.map(r => {
      if (r.id && String(r.id).startsWith('fixed_') && r.type === 'expense' && r.amount > 0) {
        changed = true;
        const updatedRec = { ...r, amount: -r.amount };
        if (user) {
          setDoc(doc(db, 'users', user.uid, 'transactions', r.id), cleanData(updatedRec)).catch(console.error);
        }
        return updatedRec;
      }
      return r;
    });

    if (changed) {
      setRecords(updated);
      console.log('Successfully migrated positive fixed expense transaction amounts.');
    }
  }, [records, user, authLoading]);

  // One-time migration for installment date month-overflow bug
  const hasMigratedRef = useRef(false);
  useEffect(() => {
    if (hasMigratedRef.current || records.length === 0 || authLoading) return;
    hasMigratedRef.current = true;

    const getCorrectInstallmentDate = (startDateStr: string, currentInstallment: number) => {
      const startDate = new Date(startDateStr);
      if (isNaN(startDate.getTime())) return null;
      
      const targetYear = startDate.getFullYear();
      const targetMonth = startDate.getMonth() + (currentInstallment - 1);
      
      const maxDays = new Date(targetYear, targetMonth + 1, 0).getDate();
      const targetDay = Math.min(startDate.getDate(), maxDays);
      
      const currentDate = new Date(targetYear, targetMonth, targetDay);
      return formatLocalDate(currentDate);
    };

    let changed = false;
    const updated = records.map(r => {
      if (r.isInstallment && r.installmentGroupId && r.currentInstallment) {
        const correctDate = getCorrectInstallmentDate(r.date, r.currentInstallment);
        if (correctDate && r.postingDate !== correctDate) {
          changed = true;
          const updatedRec = { ...r, postingDate: correctDate };
          if (user) {
            setDoc(doc(db, 'users', user.uid, 'transactions', r.id), cleanData(updatedRec)).catch(console.error);
          }
          return updatedRec;
        }
      }
      return r;
    });

    if (changed) {
      setRecords(updated);
      console.log('Successfully migrated credit card installment dates.');
    }
  }, [records, user, authLoading]);

  const syncToCloud = async (path: string, data: any, id: string) => {
    if (!user) return;
    try {
      const sanitizedData = cleanData(data);
      await setDoc(doc(db, 'users', user.uid, path, id), sanitizedData);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/${path}/${id}`);
    }
  };

  const deleteFromCloud = async (path: string, id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, path, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/${path}/${id}`);
    }
  };

  const syncBudgetToCloud = async (budget: number) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), { monthlyBudget: budget }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const handleForceSync = async () => {
    if (!user) {
      alert('請先登入後再進行同步。');
      return;
    }

    try {
      // Create a historical backup snapshot before overwriting
      const backupId = `bk_${Date.now()}`;
      const backupDocRef = doc(db, 'users', user.uid, 'backups', backupId);
      await setDoc(backupDocRef, cleanData({
        id: backupId,
        timestamp: new Date().toISOString(),
        records,
        accounts,
        projects,
        categories,
        fixedRecords,
        installments,
        templates,
        monthlyBudget
      }));

      // Maintain only the last 5 backups
      const backupsSnapshot = await getDocs(collection(db, 'users', user.uid, 'backups'));
      const backupsList = backupsSnapshot.docs.map(doc => doc.data());
      backupsList.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      if (backupsList.length > 5) {
        for (let i = 5; i < backupsList.length; i++) {
          await deleteDoc(doc(db, 'users', user.uid, 'backups', backupsList[i].id));
        }
      }

      const batch = writeBatch(db);
      
      categories.forEach(item => {
        batch.set(doc(db, 'users', user.uid, 'categories', item.id), cleanData(item));
      });
      accounts.forEach(item => {
        batch.set(doc(db, 'users', user.uid, 'accounts', item.id), cleanData(item));
      });
      records.forEach(item => {
        batch.set(doc(db, 'users', user.uid, 'transactions', item.id), cleanData(item));
      });
      projects.forEach(item => {
        batch.set(doc(db, 'users', user.uid, 'projects', item.id), cleanData(item));
      });
      templates.forEach(item => {
        batch.set(doc(db, 'users', user.uid, 'templates', item.id), cleanData(item));
      });
      fixedRecords.forEach(item => {
        batch.set(doc(db, 'users', user.uid, 'fixedRecords', item.id), cleanData(item));
      });
      installments.forEach(item => {
        batch.set(doc(db, 'users', user.uid, 'installments', item.id), cleanData(item));
      });

      await batch.commit();
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'force-sync');
      throw error;
    }
  };

  const handleSortAccounts = async (newOrder: Account[]) => {
    // Assign order based on the new array index
    const updatedAccounts = newOrder.map((acc, index) => ({
      ...acc,
      order: index
    }));
    
    // Immediate local state update
    setAccounts(updatedAccounts);
    setIsAccountSortModalOpen(false);
    
    if (user) {
      try {
        const batch = writeBatch(db);
        updatedAccounts.forEach(acc => {
          // Sync only relevant fields to reduce overhead
          batch.update(doc(db, 'users', user.uid, 'accounts', acc.id), { 
            order: acc.order,
            updatedAt: serverTimestamp() 
          });
        });
        await batch.commit();
        // Feedback is usually not needed for background sync, but user requested explicit feedback in logic elsewhere
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/accounts/sort`);
      }
    }
  };
  
  const handleSortProjects = async (updatedProjects: Project[]) => {
    // 立即更新本地 state 以獲得流暢體驗
    setProjects(updatedProjects);
    setIsProjectSortModalOpen(false);
    
    if (user) {
      try {
        const batch = writeBatch(db);
        updatedProjects.forEach(proj => {
          batch.update(doc(db, 'users', user.uid, 'projects', proj.id), {
            order: proj.order,
            updatedAt: serverTimestamp()
          });
        });
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/projects/sort`);
      }
    }
  };

  const handleUpdateCategories = async (newCats: Category[]) => {
    if (user) {
      try {
        const batch = writeBatch(db);
        
        // Identify deleted categories (exist in current state but not in new list)
        const deletedCats = categories.filter(oldCat => !newCats.some(newCat => newCat.id === oldCat.id));
        deletedCats.forEach(cat => {
          batch.delete(doc(db, 'users', user.uid, 'categories', cat.id));
        });

        // Update/Set remaining or new categories
        newCats.forEach(cat => {
          batch.set(doc(db, 'users', user.uid, 'categories', cat.id), cleanData(cat));
        });
        
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'batch/categories');
        alert("分類更新或刪除失敗，請再試一次。");
      }
    } else {
      setCategories(newCats);
    }
  };

  const handleMoveSubCategory = async (subName: string, fromCatName: string, toCatName: string) => {
    const updatedCategories = categories.map(cat => {
      if (cat.name === fromCatName) {
        return {
          ...cat,
          sub: cat.sub.filter(s => s !== subName)
        };
      }
      if (cat.name === toCatName) {
        return {
          ...cat,
          sub: [...(cat.sub || []), subName]
        };
      }
      return cat;
    });

    const oldPath = `${fromCatName} > ${subName}`;
    const newPath = `${toCatName} > ${subName}`;

    if (user) {
      try {
        const batch = writeBatch(db);
        
        // Update categories
        updatedCategories.forEach(cat => {
          batch.set(doc(db, 'users', user.uid, 'categories', cat.id), cleanData(cat));
        });

        // Update records in Firestore
        records.forEach(r => {
          if (r.category === oldPath) {
            batch.set(doc(db, 'users', user.uid, 'transactions', r.id), cleanData({ ...r, category: newPath }));
          }
        });

        // Update fixedRecords in Firestore
        fixedRecords.forEach(r => {
          if (r.category === oldPath) {
            batch.set(doc(db, 'users', user.uid, 'fixedRecords', r.id), cleanData({ ...r, category: newPath }));
          }
        });

        // Update templates in Firestore
        templates.forEach(t => {
          if (t.category === oldPath) {
            batch.set(doc(db, 'users', user.uid, 'templates', t.id), cleanData({ ...t, category: newPath }));
          }
        });

        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'batch/move-subcategory');
        alert("子分類搬移失敗，請重試。");
        return;
      }
    } else {
      setCategories(updatedCategories);
      setRecords(records.map(r => r.category === oldPath ? { ...r, category: newPath } : r));
      setFixedRecords(fixedRecords.map(r => r.category === oldPath ? { ...r, category: newPath } : r));
      setTemplates(templates.map(t => t.category === oldPath ? { ...t, category: newPath } : t));
    }
  };

  const handleUpdateTemplates = async (newTemplates: Template[]) => {
    if (user) {
      try {
        const batch = writeBatch(db);
        const deletedTemplates = templates.filter(oldT => !newTemplates.some(newT => newT.id === oldT.id));
        deletedTemplates.forEach(t => {
          batch.delete(doc(db, 'users', user.uid, 'templates', t.id));
        });
        newTemplates.forEach(t => {
          batch.set(doc(db, 'users', user.uid, 'templates', t.id), cleanData(t));
        });
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'batch/templates');
        alert("模板更新失敗。");
      }
    } else {
      setTemplates(newTemplates);
    }
  };

  const handleUpdateProjects = async (newProjects: Project[]) => {
    if (user) {
      try {
        const batch = writeBatch(db);
        const deletedProjects = projects.filter(oldP => !newProjects.some(newP => newP.id === oldP.id));
        deletedProjects.forEach(p => {
          batch.delete(doc(db, 'users', user.uid, 'projects', p.id));
        });
        newProjects.forEach(p => {
          batch.set(doc(db, 'users', user.uid, 'projects', p.id), cleanData(p));
        });
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'batch/projects');
        alert("專案更新失敗。");
      }
    } else {
      setProjects(newProjects);
    }
  };

  const checkFixedRecords = async () => {
    const today = new Date();
    const todayStr = formatLocalDate(today);
    
    let updatedFixed = [...fixedRecords];
    let recordsToSync: Transaction[] = [];
    let changed = false;

    updatedFixed = updatedFixed.map(fr => {
      if (!fr.autoEntry) return fr;

      const lastProcessed = fr.lastProcessedDate;
      const now = today;
      
      let shouldProcess = false;
      let processDateStr = '';

      if (fr.period === 'monthly') {
        const targetYear = now.getFullYear();
        const targetMonth = now.getMonth();
        const maxDays = new Date(targetYear, targetMonth + 1, 0).getDate();
        const targetDay = Math.min(fr.day, maxDays);
        
        const scheduledDate = new Date(targetYear, targetMonth, targetDay);
        const scheduledDateStr = formatLocalDate(scheduledDate);
        
        if (now >= scheduledDate) {
          if (!lastProcessed || lastProcessed < scheduledDateStr) {
            shouldProcess = true;
            processDateStr = scheduledDateStr;
          }
        } else {
          const prevYear = targetMonth === 0 ? targetYear - 1 : targetYear;
          const prevMonth = targetMonth === 0 ? 11 : targetMonth - 1;
          const prevMaxDays = new Date(prevYear, prevMonth + 1, 0).getDate();
          const prevTargetDay = Math.min(fr.day, prevMaxDays);
          const prevScheduledDate = new Date(prevYear, prevMonth, prevTargetDay);
          const prevScheduledDateStr = formatLocalDate(prevScheduledDate);
          
          if (!lastProcessed || lastProcessed < prevScheduledDateStr) {
            shouldProcess = true;
            processDateStr = prevScheduledDateStr;
          }
        }
      } else if (fr.period === 'weekly') {
        const daysDiff = (now.getDay() - fr.day + 7) % 7;
        const lastScheduledDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysDiff);
        const lastScheduledDateStr = formatLocalDate(lastScheduledDate);
        
        if (!lastProcessed || lastProcessed < lastScheduledDateStr) {
          shouldProcess = true;
          processDateStr = lastScheduledDateStr;
        }
      } else if (fr.period === 'yearly') {
        const targetYear = now.getFullYear();
        const targetDay = Math.min(fr.day, 31);
        const scheduledDate = new Date(targetYear, 0, targetDay);
        const scheduledDateStr = formatLocalDate(scheduledDate);
        
        if (now >= scheduledDate) {
          if (!lastProcessed || lastProcessed < scheduledDateStr) {
            shouldProcess = true;
            processDateStr = scheduledDateStr;
          }
        } else {
          const prevScheduledDate = new Date(targetYear - 1, 0, targetDay);
          const prevScheduledDateStr = formatLocalDate(prevScheduledDate);
          if (!lastProcessed || lastProcessed < prevScheduledDateStr) {
            shouldProcess = true;
            processDateStr = prevScheduledDateStr;
          }
        }
      }

      if (shouldProcess && processDateStr) {
        const id = `fixed_${fr.id}_${processDateStr}`;
        const newTransaction: Transaction = {
          id,
          amount: (fr.type === 'expense' || fr.type === 'transfer') ? -Math.abs(fr.amount) : Math.abs(fr.amount),
          category: fr.category,
          note: fr.name,
          date: processDateStr,
          type: fr.type,
          accountId: fr.accountId
        };
        recordsToSync.push(newTransaction);
        changed = true;
        return { ...fr, lastProcessedDate: processDateStr };
      }
      return fr;
    });

    if (changed) {
      if (user) {
        const batch = writeBatch(db);
        recordsToSync.forEach(r => batch.set(doc(db, 'users', user.uid, 'transactions', r.id), cleanData(r)));
        updatedFixed.forEach(f => batch.set(doc(db, 'users', user.uid, 'fixedRecords', f.id), cleanData(f)));
        await batch.commit().catch(e => handleFirestoreError(e, OperationType.WRITE, 'batch/fixed_sync'));
      } else {
        setRecords(prev => [...prev, ...recordsToSync]);
        setFixedRecords(updatedFixed);
      }
    }
  };

  useEffect(() => {
    if (fixedRecords.length > 0 && !authLoading) {
      checkFixedRecords();
    }
  }, [selectedDate, fixedRecords, user, authLoading]);

  const headerTitle = useMemo(() => {
    if (currentView === 'accountDetail' && selectedAccountForDetail) {
      return `${selectedAccountForDetail.name} 往來明細`;
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
    if (currentView === 'projects') {
      if (selectedProjectId) {
        return projects.find(p => p.id === selectedProjectId)?.name || '專案明細';
      }
      return '專案管理';
    }
    if (currentView === 'budget') return '預算管理';
    if (currentView === 'categories') return '分類管理';
    if (currentView === 'categoryManage') return '管理與排序';
    if (currentView === 'installments') return '分期付款管理';
    if (currentView === 'search') return '搜尋明細';
    
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
    const mergedRecords = getMergedRecords(records, accounts);
    // Recursive Balance Calculation (Dynamic Real-time Formula)
    const getBaseBalance = (id: string) => {
      const acc = accounts.find(a => a.id === id);
      if (!acc) return 0;
      let bal = acc.initialBalance || 0;
      if (acc.type === 'credit' && !acc.initialBalance) {
        bal = 0;
      }
      mergedRecords.forEach(r => {
        // Skip '初始資金' records if we are using account.initialBalance for the total
        if (r.category === '初始資金') return;

        // Dynamic Update Logic: directly add the signed transaction amount to the account balance
        if (r.accountId === id) {
          bal += r.amount;
          if (r.fee) bal -= r.fee;
        }
        
        // Symmetrical Transfer Logic: Balance updates based on exact transfer receiver amounts
        if (r.type === 'transfer' && r.toAccountId === id) {
          bal += (r.toAmount !== undefined ? r.toAmount : Math.abs(r.amount * (r.exchangeRate || 1)));
        }
      });
      return bal;
    };

    const getRecursiveBalance = (id: string): number => {
      let total = getBaseBalance(id);
      const children = accounts.filter(a => a.parentId === id);
      children.forEach(child => {
        total += getRecursiveBalance(child.id);
      });
      return total;
    };

    const result: Record<string, number> = {};
    accounts.forEach(acc => {
      result[acc.id] = getRecursiveBalance(acc.id);
    });

    return result;
  }, [accounts, records]);

  // Provide a way to get ONLY the account's own balance (without children) for detail view logic if needed
  const ownBalances = useMemo(() => {
    const mergedRecords = getMergedRecords(records, accounts);
    const balances: Record<string, number> = {};
    accounts.forEach(acc => {
      let bal = acc.initialBalance || 0;
      if (acc.type === 'credit' && !acc.initialBalance) {
        bal = 0;
      }
      mergedRecords.forEach(r => {
        if (r.category === '初始資金') return;
        if (r.accountId === acc.id) {
          bal += r.amount;
          if (r.fee) bal -= r.fee;
        }
        if (r.type === 'transfer' && r.toAccountId === acc.id) {
          bal += (r.toAmount !== undefined ? r.toAmount : Math.abs(r.amount * (r.exchangeRate || 1)));
        }
      });
      balances[acc.id] = bal;
    });
    return balances;
  }, [accounts, records]);

  const { netAssets, totalAssets, totalLiabilities } = useMemo(() => {
    let assets = 0;
    let liabilities = 0;
    
    const filteredAccounts = accounts.filter(a => {
      const cur = a.currency || 'TWD';
      if (currencyMode === 'FOREIGN') return cur !== 'TWD';
      return cur === 'TWD';
    });

    // Count accounts for net worth: 
    // Include account if it's in filtered list AND its parent is NOT in the filtered list
    // This avoids double counting while ensuring orphans (due to filtering) are counted.
    filteredAccounts.forEach(acc => {
      const parentInFiltered = acc.parentId && filteredAccounts.some(p => p.id === acc.parentId);
      if (!parentInFiltered) {
        const bal = accountBalances[acc.id] || 0;
        const cur = acc.currency || 'TWD';
        let twdBal = bal;
        if (currencyMode === 'FOREIGN' && cur !== 'TWD') {
          const rate = getLatestExchangeRate(records, accounts, cur);
          twdBal = bal * rate;
        }
        if (twdBal >= 0) assets += twdBal;
        else liabilities += twdBal;
      }
    });

    return {
      netAssets: assets + liabilities,
      totalAssets: assets,
      totalLiabilities: Math.abs(liabilities)
    };
  }, [accounts, accountBalances, currencyMode, records]);

  const stats = useMemo(() => {
    const monthStr = selectedDate.substring(0, 7);
    const yearStr = selectedDate.substring(0, 4);
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Calculate week range (Monday to Sunday)
    const base = parseLocalDate(selectedDate);
    const day = base.getDay();
    const diff = base.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    const startOfWeek = new Date(base);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    const startOfWeekStr = formatLocalDate(startOfWeek);
    const endOfWeekStr = formatLocalDate(endOfWeek);

    // Filter records based on currency mode
    const filteredByCurrency = records.filter(r => {
      const cur = r.currency || 'TWD';
      // If currencyMode is null or TWD, show TWD. If FOREIGN, show non-TWD
      if (currencyMode === 'FOREIGN') return cur !== 'TWD';
      return cur === 'TWD';
    });

    // Monthly/Weekly/Daily stats now use postingDate
    const daily = filteredByCurrency.filter(r => (r.postingDate || r.date) === selectedDate);
    const weekly = filteredByCurrency.filter(r => {
      const pDate = r.postingDate || r.date;
      return pDate >= startOfWeekStr && pDate <= endOfWeekStr;
    });
    const monthly = filteredByCurrency.filter(r => (r.postingDate || r.date).startsWith(monthStr));
    const yearly = filteredByCurrency.filter(r => (r.postingDate || r.date).startsWith(yearStr));
    
    return {
      daily: {
        expense: daily.reduce((s, r) => s + (r.type === 'expense' ? (Math.abs(r.amount) + (r.fee || 0)) : r.type === 'transfer' ? (r.fee || 0) : 0), 0),
        income: daily.filter(r => r.type === 'income').reduce((s, r) => s + Math.abs(r.amount), 0),
      },
      weekly: {
        expense: weekly.reduce((s, r) => s + (r.type === 'expense' ? (Math.abs(r.amount) + (r.fee || 0)) : r.type === 'transfer' ? (r.fee || 0) : 0), 0),
        income: weekly.filter(r => r.type === 'income').reduce((s, r) => s + Math.abs(r.amount), 0),
      },
      monthly: {
        expense: monthly.reduce((s, r) => s + (r.type === 'expense' ? (Math.abs(r.amount) + (r.fee || 0)) : r.type === 'transfer' ? (r.fee || 0) : 0), 0),
        income: monthly.filter(r => r.type === 'income').reduce((s, r) => s + Math.abs(r.amount), 0),
      },
      yearly: {
        expense: yearly.reduce((s, r) => s + (r.type === 'expense' ? (Math.abs(r.amount) + (r.fee || 0)) : r.type === 'transfer' ? (r.fee || 0) : 0), 0),
        income: yearly.filter(r => r.type === 'income').reduce((s, r) => s + Math.abs(r.amount), 0),
      }
    };
  }, [records, selectedDate, currencyMode]);

  const handleSaveRecord = async (record: Omit<Transaction, 'id'>, keepOpen?: boolean) => {
    if (record.isInstallment && record.totalInstallments && record.totalInstallments > 1) {
      const installmentGroupId = Date.now().toString();
      const perAmount = Math.round(record.amount / record.totalInstallments);
      const startDate = new Date(record.date);
      
      const batch = user ? writeBatch(db) : null;

      for (let i = 1; i <= record.totalInstallments; i++) {
        const targetYear = startDate.getFullYear();
        const targetMonth = startDate.getMonth() + (i - 1);
        const maxDays = new Date(targetYear, targetMonth + 1, 0).getDate();
        const targetDay = Math.min(startDate.getDate(), maxDays);
        const currentDate = new Date(targetYear, targetMonth, targetDay);
        const dateStr = formatLocalDate(currentDate);
        
        const id = `${installmentGroupId}-${i}`;
        const newPart: Transaction = {
          ...record,
          id,
          amount: perAmount,
          note: record.note?.trim(),
          date: record.date,
          postingDate: dateStr,
          currentInstallment: i,
          installmentGroupId
        } as any;

        if (batch && user) {
          batch.set(doc(db, 'users', user.uid, 'transactions', id), cleanData(newPart));
        } else {
          setRecords(prev => [...prev, newPart]);
        }
      }
      if (batch) await batch.commit().catch(e => handleFirestoreError(e, OperationType.WRITE, 'batch/transactions'));
    } else {
      const id = Date.now().toString();
      const newRecord = { ...record, id };
      if (user) {
        await syncToCloud('transactions', newRecord, id);
      } else {
        setRecords(prev => [...prev, newRecord]);
      }
    }
    if (!keepOpen) {
      setIsRecordModalOpen(false);
    }
  };

  const handleUpdateRecord = async (oldRecord: Transaction, newRecord: Transaction) => {
    if (oldRecord._isMergedTransfer && oldRecord._mergedRecordIds && oldRecord._mergedRecordIds.length >= 2) {
      const primaryId = oldRecord._mergedRecordIds[0];
      const secondaryId = oldRecord._mergedRecordIds[1];
      
      const cleanedRecord = { ...newRecord };
      delete (cleanedRecord as any)._isMergedTransfer;
      delete (cleanedRecord as any)._mergedRecordIds;
      delete (cleanedRecord as any)._mergedDisplayName;

      if (user) {
        try {
          await syncToCloud('transactions', cleanedRecord, primaryId);
          await deleteFromCloud('transactions', secondaryId);
        } catch (error) {
          console.error('Merged update sync failed:', error);
        }
      } else {
        setRecords(prev => prev
          .map(r => r.id === primaryId ? cleanedRecord : r)
          .filter(r => r.id !== secondaryId)
        );
      }
    } else {
      if (user) {
        await syncToCloud('transactions', newRecord, newRecord.id);
      } else {
        setRecords(prev => prev.map(r => r.id === newRecord.id ? newRecord : r));
      }
    }
  };

  const handleReorderRecords = async (updatedRecords: Transaction[]) => {
    if (user) {
      try {
        const batch = writeBatch(db);
        updatedRecords.forEach(r => {
          const ref = doc(db, 'users', user.uid, 'transactions', r.id);
          batch.update(ref, { order: r.order });
        });
        await batch.commit();
      } catch (error) {
        console.error('Reorder sync failed:', error);
      }
    } else {
      setRecords(prev => {
        const next = [...prev];
        updatedRecords.forEach(ur => {
          const idx = next.findIndex(r => r.id === ur.id);
          if (idx !== -1) next[idx] = { ...next[idx], order: ur.order };
        });
        return next;
      });
    }
  };

  const [recordToDelete, setRecordToDelete] = useState<Transaction | null>(null);

  const handleDeleteRecord = (record: Transaction) => {
    setRecordToDelete(record);
  };

  const confirmDeleteRecord = async () => {
    if (!recordToDelete) return;
    
    const targetIds = recordToDelete._isMergedTransfer && recordToDelete._mergedRecordIds 
      ? recordToDelete._mergedRecordIds 
      : [recordToDelete.id];
    
    // 1. 樂觀 UI (Optimistic UI): 立即從本地介面移除
    setRecords(prev => prev.filter(r => !targetIds.includes(r.id)));
    
    // 2. 執行背景異步刪除
    if (user) {
      try {
        for (const tid of targetIds) {
          await deleteFromCloud('transactions', tid);
        }
      } catch (error) {
        console.error('Delete failed:', error);
        alert('同步刪除失敗，請檢查網路連線或稍後再試。');
      }
    }
    
    setRecordToDelete(null);
  };

  const handleAddAccount = () => {
    setEditingAccount({
      id: Date.now().toString(),
      name: '',
      type: 'cash',
      icon: '💰',
      currency: currencyMode === 'FOREIGN' ? 'USD' : 'TWD'
    });
    setIsAccountEditModalOpen(true);
  };

  const handleAddProject = () => {
    setEditingProject({
      id: `p_${Date.now()}`,
      name: '',
      icon: '📝'
    });
    setIsProjectEditModalOpen(true);
  };

  const handleSaveAccount = async (updatedAcc: Account, initialAmount?: number) => {
    let finalAccount = { ...updatedAcc };
    if (initialAmount !== undefined) {
      finalAccount.initialBalance = initialAmount;
    }
    
    // 如果是新帳戶（不在目前的 accounts 列表中），則計算新順序：最大 order + 1
    if (!accounts.find(a => a.id === updatedAcc.id)) {
      const maxOrder = accounts.reduce((max, a) => Math.max(max, a.order || 0), 0);
      finalAccount.order = maxOrder + 1;
    }

    if (user) {
      await syncToCloud('accounts', finalAccount, finalAccount.id);
      
      if (finalAccount.type === 'credit') {
        const sameBankCards = accounts.filter(a => checkAreAccountsSameBank(finalAccount, a, accounts));
        for (const card of sameBankCards) {
          const updatedCard = {
            ...card,
            creditLimit: convertCurrency(finalAccount.creditLimit || 0, finalAccount.currency || 'TWD', card.currency || 'TWD', records, accounts),
            closingDay: finalAccount.closingDay,
            billMonthOffset: finalAccount.billMonthOffset,
            customStatementLabels: finalAccount.customStatementLabels
          };
          await syncToCloud('accounts', updatedCard, card.id);
        }
      }
    } else {
      setAccounts(prev => {
        const exists = prev.find(a => a.id === finalAccount.id);
        let newList;
        if (exists) {
          newList = prev.map(a => a.id === finalAccount.id ? finalAccount : a);
        } else {
          newList = [...prev, finalAccount];
        }
        
        if (finalAccount.type === 'credit') {
          const sameBankCards = newList.filter(a => checkAreAccountsSameBank(finalAccount, a, newList));
          sameBankCards.forEach(card => {
            newList = newList.map(a => a.id === card.id ? {
              ...card,
              creditLimit: convertCurrency(finalAccount.creditLimit || 0, finalAccount.currency || 'TWD', card.currency || 'TWD', records, newList),
              closingDay: finalAccount.closingDay,
              billMonthOffset: finalAccount.billMonthOffset,
              customStatementLabels: finalAccount.customStatementLabels
            } : a);
          });
        }
        
        return newList.sort((a, b) => (a.order || 0) - (b.order || 0));
      });
    }
    if (initialAmount !== undefined) {
      const existingInit = records.find(r => r.accountId === finalAccount.id && r.category === '初始資金');
      const id = existingInit ? existingInit.id : `init_${finalAccount.id}_${Date.now()}`;
      const initRecord: Transaction = {
        id,
        amount: Math.abs(initialAmount),
        category: '初始資金',
        date: formatLocalDate(new Date()),
        type: initialAmount >= 0 ? 'income' : 'expense',
        accountId: finalAccount.id,
        currency: finalAccount.currency
      };

      if (user) {
        await syncToCloud('transactions', initRecord, id);
      } else {
        setRecords(prev => {
          if (existingInit) {
            return prev.map(r => r.id === id ? initRecord : r);
          } else {
            return [...prev, initRecord];
          }
        });
      }
    }

    if (selectedAccountForDetail?.id === finalAccount.id) {
      setSelectedAccountForDetail(finalAccount);
    }
    setIsAccountEditModalOpen(false);
    setEditingAccount(null);
  };

  const handleSaveProject = async (p: Project) => {
    let finalProject = { ...p };
    if (!projects.find(x => x.id === p.id)) {
      const maxOrder = projects.reduce((max, x) => Math.max(max, x.order || 0), 0);
      finalProject.order = maxOrder + 1;
    }

    if (user) {
      await syncToCloud('projects', finalProject, finalProject.id);
    } else {
      setProjects(prev => {
        if (prev.find(x => x.id === finalProject.id)) {
          return prev.map(x => x.id === finalProject.id ? finalProject : x);
        } else {
          return [...prev, finalProject];
        }
      });
    }
    setIsProjectEditModalOpen(false);
    setEditingProject(null);
  };

  const handleDeleteProject = async (id: string) => {
    if (user) { // Delete is handled by deleteFromCloud usually but projects need specific handling to avoid orphans if it were a full app
      await deleteFromCloud('projects', id);
    } else {
      setProjects(prev => prev.filter(p => p.id !== id));
    }
    setIsProjectEditModalOpen(false);
    setEditingProject(null);
  };

  const handleDeleteAccount = async (id: string) => {
    if (user) {
      // In a real app, you'd batch delete related records or use a Cloud Function
      // For now, let's just delete the account. The records will technically be orpaned.
      await deleteFromCloud('accounts', id);
    } else {
      setAccounts(prev => prev.filter(a => a.id !== id && a.parentId !== id));
      setRecords(prev => prev.filter(r => r.accountId !== id && r.toAccountId !== id));
    }
    setCurrentView('accounts');
    setSelectedAccountForDetail(null);
    setIsAccountEditModalOpen(false);
    setEditingAccount(null);
  };

  return (
    <div className="h-screen w-full bg-[#FFF9E3] font-sans text-[#5D4037] flex justify-center overflow-hidden select-none" style={getFontFamily()}>
      {/* Responsive Container for Desktop */}
      <div className="w-full max-w-md md:max-w-4xl h-full flex flex-col bg-[#FFF9E3] relative shadow-2xl md:border-x border-stone-100">
        {/* Header */}
        <header className="px-4 py-4 flex items-center justify-between bg-[#FFF9E3] z-30 flex-shrink-0 relative">
          {currentView === 'home' ? (
            <Menu className="w-6 h-6 text-[#5D4037] cursor-pointer" onClick={() => setIsDrawerOpen(true)} />
          ) : (
            <button 
              onClick={() => {
                if (currentView === 'accountDetail') setCurrentView('accounts');
                else if (currentView === 'projects' && selectedProjectId) setSelectedProjectId(null);
                else if (currentView === 'categoryManage') setCurrentView('categories');
                else setCurrentView('home');
              }}
              className="p-1 -ml-1 hover:bg-white/50 rounded-full transition-colors"
            >
              <ChevronLeft className="w-7 h-7 text-[#5D4037]" />
            </button>
          )}
          <div className="text-[24px] font-bold text-[#5D4037]" style={getFontFamily()}>{headerTitle}</div>
          
          <div className="flex items-center gap-2">
            {currentView === 'projects' && (
              <div className="flex items-center gap-1">
                {selectedProjectId ? (
                  <>
                    <button className="p-2 hover:bg-white/50 rounded-full transition-colors"><Settings2 size={24} className="text-[#5D4037]" /></button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={() => setIsProjectSortModalOpen(true)}
                      className="p-2 hover:bg-white/50 rounded-full transition-colors"
                    >
                      <Layers size={24} className="text-[#5D4037]" />
                    </button>
                    <button 
                      onClick={handleAddProject}
                      className="p-2 hover:bg-white/50 rounded-full transition-colors"
                    >
                      <Plus size={24} className="text-[#5D4037]" />
                    </button>
                  </>
                )}
              </div>
            )}
            {['fixedRecords', 'categories', 'history', 'installments'].includes(currentView) ? (
              currentView === 'categories' ? (
                <div className="relative">
                  <button 
                    onClick={() => setIsCategoryActionMenuOpen(!isCategoryActionMenuOpen)}
                    className="w-10 h-10 bg-[#FFD54F] rounded-2xl flex items-center justify-center shadow-md active:scale-95 transition-all text-[#5D4037]"
                  >
                    <MoreVertical size={24} />
                  </button>

                  <AnimatePresence>
                    {isCategoryActionMenuOpen && (
                      <>
                        <motion.div 
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="fixed inset-0 z-40"
                          onClick={() => setIsCategoryActionMenuOpen(false)}
                        />
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-stone-100 py-2 z-50 overflow-hidden"
                          style={getFontFamily()}
                        >
                          <button 
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-stone-50 transition-colors text-[#5D4037]"
                            onClick={() => { 
                              window.dispatchEvent(new CustomEvent('trigger-add-category'));
                              setIsCategoryActionMenuOpen(false); 
                            }}
                          >
                            <Plus size={18} className="text-stone-400" />
                            <span className="font-bold text-sm">新增分類</span>
                          </button>
                          <button 
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-stone-50 transition-colors text-[#5D4037]"
                            onClick={() => { 
                              setCurrentView('categoryManage'); 
                              setIsCategoryActionMenuOpen(false); 
                            }}
                          >
                            <Settings2 size={18} className="text-stone-400" />
                            <span className="font-bold text-sm">管理與排序</span>
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <button 
                  onClick={() => {
                    if (currentView === 'fixedRecords') {
                      window.dispatchEvent(new CustomEvent('trigger-add-fixed-record'));
                    } else if (currentView === 'categories') {
                      window.dispatchEvent(new CustomEvent('trigger-add-category'));
                    } else if (currentView === 'history' || currentView === 'installments') {
                      setIsRecordModalOpen(true);
                    }
                  }}
                  className="w-10 h-10 bg-[#FFD54F] rounded-2xl flex items-center justify-center shadow-md active:scale-95 transition-all"
                >
                  <Plus size={24} className="text-[#5D4037]" />
                </button>
              )
            ) : (
              !['projects', 'budget'].includes(currentView) && (
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
                            <span className="font-bold text-sm" style={getFontFamily()}>日曆模式</span>
                          </button>
                          <button 
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-stone-50 transition-colors text-[#5D4037]"
                            onClick={() => { setCurrentView('search'); setIsMoreMenuOpen(false); }}
                          >
                            <Search size={18} className="text-stone-400" />
                            <span className="font-bold text-sm" style={getFontFamily()}>搜尋明細</span>
                          </button>
                          <button 
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-stone-50 transition-colors text-[#5D4037]"
                            onClick={() => { setIsAccountSortModalOpen(true); setIsMoreMenuOpen(false); }}
                          >
                            <span className="text-lg font-bold text-stone-400 w-[18px] flex justify-center">☰↑</span>
                            <span className="font-bold text-sm" style={getFontFamily()}>帳戶排序</span>
                          </button>
                          <button 
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-stone-50 transition-colors text-[#5D4037]"
                            onClick={() => { 
                              handleAddAccount();
                              setIsMoreMenuOpen(false);
                            }}
                          >
                            <Plus size={18} className="text-stone-400" />
                            <span className="font-bold text-sm" style={getFontFamily()}>新增帳戶</span>
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              )
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
                <div className="h-48 bg-gradient-to-br from-[#FFF9E3] to-[#FFFDF5] p-6 flex flex-col justify-end gap-3 border-b border-stone-100">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white rounded-[24px] shadow-sm flex items-center justify-center text-3xl overflow-hidden border border-white">
                      {user?.photoURL ? (
                        <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                      ) : '🦊'}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xl font-black text-[#5D4037] leading-tight" style={getFontFamily()}>
                        {user ? user.displayName : '訪客模式'}
                      </span>
                      <span className="text-[10px] font-bold text-stone-300 uppercase tracking-widest">
                        {user ? '雲端同步中' : '未登入'}
                      </span>
                    </div>
                  </div>
                  
                  {user ? (
                    <button 
                      onClick={handleLogout}
                      className="flex items-center gap-2 text-xs font-bold text-stone-400 hover:text-rose-400 transition-colors"
                    >
                      <LogOut size={14} /> 登出帳號
                    </button>
                  ) : (
                    <button 
                      onClick={handleLogin}
                      className="w-full py-3 bg-[#5D4037] text-white rounded-2xl text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-stone-200 active:scale-95 transition-all"
                      style={getFontFamily()}
                    >
                      <Cloud size={16} /> 同步登入
                    </button>
                  )}
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
                  
                  {isInstallable && !isAppInstalled && (
                    <div className="mx-6 my-4">
                      <button 
                        onClick={() => {
                          handleInstallApp();
                          setIsDrawerOpen(false);
                        }}
                        className="w-full py-3.5 bg-gradient-to-r from-[#FFD54F] to-[#FFA000] text-[#5D4037] rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-95 transition-all border border-[#FFD54F]/20"
                        style={getFontFamily()}
                      >
                        <Download size={14} /> 下載/安裝 App
                      </button>
                    </div>
                  )}
                </div>


              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main Content Area (Scrollable) */}
        <main className="flex-1 overflow-y-auto min-h-0">
          {currentView === 'home' && isInstallable && !isAppInstalled && showPWAReminder && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -20 }}
              className="mx-4 mt-4 p-4 bg-gradient-to-br from-white to-[#FFFDF5] rounded-3xl border border-[#FFD54F]/30 shadow-sm flex items-center justify-between gap-3 relative overflow-hidden"
              style={getFontFamily()}
            >
              {/* Decorative background circle */}
              <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-[#FFD54F]/10 rounded-full blur-xl pointer-events-none" />
              
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#FFF9E3] rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-white flex-shrink-0">
                  💰
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-black text-[#5D4037]">將「扣扣」安裝至手機</span>
                  <span className="text-[10px] font-bold text-stone-400">隨時隨地，離線記帳更順手</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 z-10">
                <button
                  onClick={handleInstallApp}
                  className="px-3.5 py-2 bg-[#FFD54F] text-[#5D4037] text-[11px] font-black rounded-xl shadow-sm hover:shadow active:scale-95 transition-all flex-shrink-0"
                >
                  安裝 App
                </button>
                <button
                  onClick={() => setShowPWAReminder(false)}
                  className="p-1.5 hover:bg-stone-50 rounded-lg text-stone-300 hover:text-stone-400 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            </motion.div>
          )}
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
                monthlyBudget={monthlyBudget}
              />
            )}
            {currentView === 'accounts' && (
              <AccountsView 
                accounts={accounts.filter(a => {
                  const cur = a.currency || 'TWD';
                  if (!currencyMode) return true;
                  // If mode is FOREIGN, show ANY non-TWD account
                  // If mode is TWD, show only TWD accounts
                  return currencyMode === 'FOREIGN' ? cur !== 'TWD' : cur === 'TWD';
                })} 
                netAssets={netAssets}
                totalAssets={totalAssets}
                totalLiabilities={totalLiabilities}
                onAccountClick={(acc) => {
                  setSelectedAccountForDetail(acc);
                  setCurrentView('accountDetail');
                }}
                onAddAccount={handleAddAccount}
                balances={accountBalances}
                currencyMode={currencyMode}
                onCurrencyModeChange={setCurrencyMode}
                records={records}
              />
            )}
            {currentView === 'accountDetail' && selectedAccountForDetail && (
              <AccountDetailView 
                account={accounts.find(a => a.id === selectedAccountForDetail.id) || selectedAccountForDetail}
                records={records}
                selectedDate={selectedDate}
                onBack={() => {
                  setSelectedAccountForDetail(null);
                  setCurrentView('accounts');
                }}
                onEdit={() => {
                  setEditingAccount(accounts.find(a => a.id === selectedAccountForDetail.id) || selectedAccountForDetail);
                  setIsAccountEditModalOpen(true);
                }}
                onUpdateRecord={handleUpdateRecord}
                onDeleteRecord={handleDeleteRecord}
                accounts={accounts}
                projects={projects}
                balance={accountBalances[selectedAccountForDetail.id] || 0}
                categories={categories}
                onUpdateAccountsList={setAccounts}
              />
            )}
            {currentView === 'history' && (
              <HistoryView 
                records={records}
                accounts={accounts} 
                categories={categories}
                projects={projects}
                filter={historyFilter}
                currencyMode={currencyMode}
                onBack={() => setCurrentView('home')}
                onUpdateRecord={handleUpdateRecord}
                onDeleteRecord={handleDeleteRecord}
                onReorder={handleReorderRecords}
              />
            )}
            {currentView === 'fixedRecords' && (
              <FixedRecordsView 
                fixedRecords={fixedRecords} 
                accounts={accounts}
                categories={categories}
                records={records}
                onBack={() => setCurrentView('home')}
                onSave={async (fr) => {
                  if (user) {
                    await syncToCloud('fixedRecords', fr, fr.id);
                  } else {
                    if (fixedRecords.find(r => r.id === fr.id)) {
                      setFixedRecords(prev => prev.map(r => r.id === fr.id ? fr : r));
                    } else {
                      setFixedRecords(prev => [...prev, fr]);
                    }
                  }
                }}
                onDelete={async (id) => {
                  if (user) {
                    await deleteFromCloud('fixedRecords', id);
                  } else {
                    setFixedRecords(prev => prev.filter(r => r.id !== id));
                  }
                }}
              />
            )}
            {currentView === 'projects' && (
              selectedProjectId ? (
                <ProjectDetailView 
                  project={projects.find(p => p.id === selectedProjectId)!}
                  records={records}
                  accounts={accounts}
                  categories={categories}
                  projects={projects}
                  onBack={() => setSelectedProjectId(null)}
                  onUpdateRecord={handleUpdateRecord}
                  onDeleteRecord={handleDeleteRecord}
                  onAddRecord={() => setIsRecordModalOpen(true)}
                />
              ) : (
                <ProjectsView 
                  projects={projects}
                  records={records}
                  onProjectClick={(id) => setSelectedProjectId(id)}
                  onEditProject={(p) => {
                    setEditingProject(p);
                    setIsProjectEditModalOpen(true);
                  }}
                  onBack={() => setCurrentView('home')}
                />
              )
            )}
            {currentView === 'budget' && (
              <BudgetManagementPage 
                monthlyBudget={monthlyBudget}
                setMonthlyBudget={setMonthlyBudget}
                syncBudgetToCloud={syncBudgetToCloud}
                categories={categories}
                onUpdateCategories={handleUpdateCategories}
                records={records}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                currencyMode={currencyMode}
                onBack={() => setCurrentView('home')}
              />
            )}
            {currentView === 'categories' && <CategoryManagementPage categories={categories} onSave={handleUpdateCategories} onBack={() => setCurrentView('home')} />}
            {currentView === 'categoryManage' && <CategoryManagePage categories={categories} onSave={handleUpdateCategories} onBack={() => setCurrentView('categories')} onMoveSubCategory={handleMoveSubCategory} />}
            {currentView === 'installments' && (
              <InstallmentManagementPage 
                records={records} 
                onDeleteGroup={(groupId) => setRecords(prev => prev.filter(r => r.installmentGroupId !== groupId))}
                onEarlySettlement={(groupId, remainingAmount, firstRecord) => {
                  setRecords(prev => {
                    const today = new Date().toISOString().split('T')[0];
                    
                    // 1. 找出並更新已存在的紀錄為「已完成」狀態，並將期數設為總期數
                    const updatedRecords = prev.map(r => {
                      if (r.installmentGroupId === groupId) {
                        const total = r.totalInstallments || 3;
                        return {
                          ...r,
                          isInstallment: true,
                          isCompleted: true,
                          status: 'settled',
                          currentInstallment: total,
                          paidCount: total,
                          paidTerms: total,
                          totalTerms: total
                        };
                      }
                      return r;
                    });

                    // 2. 刪除該計畫原本預定在未來月份產生的所有分期紀錄
                    const filtered = updatedRecords.filter(r => r.installmentGroupId !== groupId || (r.postingDate || r.date) <= today);
                    
                    // 3. 在「今天」自動產生一筆總額為「剩餘未付金額」的支出紀錄
                    const settlementRecord: Transaction = {
                      ...firstRecord,
                      id: `settle-${groupId}-${Date.now()}`,
                      amount: remainingAmount,
                      date: today,
                      note: `${firstRecord.note?.split(' (分期')[0]} (分期提前結清)`,
                      isInstallment: false,
                      installmentGroupId: undefined,
                      currentInstallment: undefined,
                      totalInstallments: undefined
                    };
                    
                    return [...filtered, settlementRecord];
                  });
                }}
              />
            )}
            {currentView === 'search' && (
              <SearchView 
                records={records}
                accounts={accounts}
                categories={categories}
                projects={projects}
                onBack={() => setCurrentView('home')}
                onUpdateRecord={handleUpdateRecord}
                onDeleteRecord={handleDeleteRecord}
                onReorder={handleReorderRecords}
              />
            )}
            {currentView === 'calendar' && (
              <CalendarView 
                records={records} 
                accounts={accounts}
                categories={categories}
                onBack={() => setCurrentView('home')}
              />
            )}
            {currentView === 'reports' && (
              <ReportsView 
                records={records} 
                projects={projects}
                categories={categories}
              />
            )}
            {currentView === 'more' && (
              <MoreView 
                records={records} 
                accounts={accounts} 
                installments={installments}
                projects={projects}
                categories={categories}
                templates={templates}
                fixedRecords={fixedRecords}
                user={user}
                onForceSync={handleForceSync}
                setRecords={setRecords}
                setAccounts={setAccounts}
                setInstallments={setInstallments}
                setProjects={setProjects}
                setTemplates={setTemplates}
                setFixedRecords={setFixedRecords}
                onUpdateTemplates={handleUpdateTemplates}
                onUpdateCategories={handleUpdateCategories}
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
              categories={categories}
              templates={templates}
              projects={projects}
              initialProjectId={selectedProjectId || undefined}
              onUpdateTemplates={handleUpdateTemplates}
              onUpdateCategories={handleUpdateCategories}
              onClose={() => setIsRecordModalOpen(false)}
              onSave={handleSaveRecord}
              selectedDate={selectedDate}
              records={records}
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
              onSave={handleSortAccounts}
            />
          )}
        </AnimatePresence>

        {/* Project Sort Modal */}
        <AnimatePresence>
          {isProjectSortModalOpen && (
            <ProjectSortModal 
              projects={projects}
              onClose={() => setIsProjectSortModalOpen(false)}
              onSave={handleSortProjects}
            />
          )}
        </AnimatePresence>

        {/* Project Edit Modal */}
        <AnimatePresence>
          {isProjectEditModalOpen && editingProject && (
            <ProjectEditModal 
              project={editingProject}
              projects={projects}
              onClose={() => {
                setIsProjectEditModalOpen(false);
                setEditingProject(null);
              }}
              onSave={handleSaveProject}
              onDelete={handleDeleteProject}
            />
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {recordToDelete && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[#5D4037]/60 backdrop-blur-md z-[100] flex items-center justify-center p-6"
              onClick={() => setRecordToDelete(null)}
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                className="bg-[#FFF9E3] w-full max-w-xs rounded-[44px] p-8 flex flex-col items-center gap-6 shadow-2xl border-4 border-white overflow-hidden text-center"
                style={getFontFamily()}
                onClick={e => e.stopPropagation()}
              >
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-4xl shadow-inner mb-2">
                  🗑️
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-[#5D4037]">刪除紀錄</h3>
                  <p className="text-sm font-bold text-stone-400">確定要刪除這筆明細嗎？</p>
                </div>
                <div className="flex w-full gap-3 mt-2">
                  <button 
                    onClick={() => setRecordToDelete(null)}
                    className="flex-1 py-4 bg-white text-stone-400 rounded-2xl font-black text-base shadow-sm active:scale-95 transition-all border-2 border-stone-50"
                  >
                    取消
                  </button>
                  <button 
                    onClick={confirmDeleteRecord}
                    className="flex-[1.5] py-4 bg-rose-500 text-white rounded-2xl font-black text-base shadow-lg shadow-rose-100 active:scale-95 transition-all"
                  >
                    確認刪除
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function AccountIcon({ icon, className = "", sizeClassName = "w-6 h-6" }: { icon: string, className?: string, sizeClassName?: string }) {
  if (!icon) return null;
  const isImage = icon.startsWith('http') || icon.startsWith('data:image/') || icon.startsWith('/');
  if (isImage) {
    return (
      <img 
        src={icon} 
        className={`${sizeClassName} object-contain rounded-md select-none pointer-events-none ${className}`} 
        alt="icon" 
      />
    );
  }
  return <span className={className}>{icon}</span>;
}

interface AccountSelectorProps {
  accounts: Account[];
  records: Transaction[];
  currentSelectedId: string;
  onSelect: (id: string) => void;
  expandedState: { [key: string]: boolean };
  setExpandedState: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  keyPrefix: string;
}

function AccountSelector({
  accounts,
  records,
  currentSelectedId,
  onSelect,
  expandedState,
  setExpandedState,
  keyPrefix
}: AccountSelectorProps) {
  const { groupedList, singleList } = getGroupedAndUngrouped(accounts);

  const selectedAcc = currentSelectedId ? accounts.find(a => a.id === currentSelectedId) : null;
  const selectedAccBalance = selectedAcc ? calculateAccountBalance(selectedAcc, accounts, records) : 0;

  // Merge lists to render: singles first, then groups
  const items: (
    | { type: 'single'; account: Account }
    | { type: 'group'; bankName: string; accounts: Account[] }
  )[] = [];

  singleList.forEach(acc => items.push({ type: 'single', account: acc }));
  groupedList.forEach(g => items.push({ type: 'group', bankName: g.bankName, accounts: g.accounts }));

  return (
    <div className="space-y-2">
      <HorizontalScrollArea className="px-8">
        {items.map((item) => {
          if (item.type === 'single') {
            const acc = item.account;
            const isSelected = currentSelectedId === acc.id;
            return (
              <button 
                key={`${keyPrefix}-${acc.id}`}
                onClick={() => onSelect(isSelected ? '' : acc.id)}
                type="button"
                className={`flex-shrink-0 w-20 h-24 rounded-[20px] flex flex-col items-center justify-center gap-2 border-2 transition-all ${
                  isSelected ? 'bg-[#FFD54F] border-[#FFD54F] shadow-md' : 'bg-white border-white shadow-sm'
                }`}
              >
                <div className="w-10 h-10 bg-white/50 rounded-full flex items-center justify-center text-xl">
                  <AccountIcon icon={acc.icon} sizeClassName="w-6 h-6" />
                </div>
                <span className="text-[14px] font-bold text-[#000000] text-center px-1 leading-tight" style={getFontFamily()}>{acc.name}</span>
              </button>
            );
          } else {
            const group = item;
            const activeSub = group.accounts.find(a => a.id === currentSelectedId);
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
      {groupedList.map(group => {
        const isExpanded = !!expandedState[group.bankName];
        if (!isExpanded) return null;
        const activeSub = group.accounts.find(a => a.id === currentSelectedId);

        return (
          <div 
            key={`${keyPrefix}-drawer-${group.bankName}`}
            className="mt-2 mx-8 p-3.5 bg-stone-50 border border-stone-200/50 rounded-2xl space-y-2 shadow-inner"
          >
            <div className="text-[12px] font-bold text-stone-400 px-2 flex items-center justify-between">
              <span>🏦 {group.bankName} 卡片與帳戶</span>
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
            <div className="flex flex-wrap gap-2">
              {group.accounts.map(subAcc => {
                const isSubSelected = currentSelectedId === subAcc.id;
                const subBal = calculateAccountBalance(subAcc, accounts, records);
                return (
                  <button
                    key={`${keyPrefix}-sub-${subAcc.id}`}
                    onClick={() => onSelect(isSubSelected ? '' : subAcc.id)}
                    type="button"
                    className={`px-3 py-2 rounded-xl text-[14px] font-bold shadow-sm transition-all border flex items-center gap-1.5 ${
                      isSubSelected 
                        ? 'bg-[#FFD54F] border-[#FFD54F] text-[#5D4037]' 
                        : 'bg-white border-stone-100 text-[#5D4037] active:bg-stone-100'
                    }`}
                  >
                    <AccountIcon icon={subAcc.icon} sizeClassName="w-5 h-5" className="text-lg flex items-center justify-center" />
                    <span>
                      {subAcc.name} {subBal < 0 ? '-' : ''}${Math.abs(subBal).toLocaleString()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Selected Account Info Popup */}
      {selectedAcc && (
        <div className="mx-8 mt-2 p-3.5 bg-[#FFFDF5] border border-[#FBC02D]/20 rounded-2xl flex items-center justify-between text-[#5D4037] shadow-inner animate-fade-in" style={getFontFamily()}>
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
      )}
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

function HomeView({ stats, selectedDate, onDateChange, onRecordClick, onAccountClick, onStatClick, monthlyBudget }: { 
  stats: any, 
  selectedDate: string,
  onDateChange: (date: string) => void,
  onRecordClick: () => void, 
  onAccountClick: () => void,
  onStatClick: (type: 'day' | 'week' | 'month' | 'year') => void,
  monthlyBudget: number
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
    const diff = base.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    const start = new Date(base);
    start.setDate(diff);
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
      className="flex flex-col gap-6 px-4 py-4"
      style={getFontFamily()}
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

      <div 
        className="bg-white rounded-[30px] p-6 shadow-sm border-2 border-white grid grid-cols-3 text-center items-center"
        style={getFontFamily()}
      >
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-[#5D4037]">本月收入</span>
          <span className="text-lg font-black text-[#03A9F4]">$ {stats.monthly.income.toLocaleString()}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-[#5D4037]">本月支出</span>
          <span className="text-lg font-black text-[#E91E63]">$ {stats.monthly.expense.toLocaleString()}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-[#5D4037]">可用預算</span>
          <span className="text-[24px] font-bold text-[#5D4037]">
            {(stats.monthly.income - stats.monthly.expense).toLocaleString()}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <StatCard title="本日" date={selectedDate.replace(/-/g, '/')} expense={stats.daily.expense} income={stats.daily.income} onClick={() => onStatClick('day')} />
        <StatCard title="本週" date={weekRange} expense={stats.weekly.expense} income={stats.weekly.income} onClick={() => onStatClick('week')} />
        <StatCard title="本月" date={monthRange} expense={stats.monthly.expense} income={stats.monthly.income} onClick={() => onStatClick('month')} />
        <StatCard title="本年" date={yearRange} expense={stats.yearly.expense} income={stats.yearly.income} onClick={() => onStatClick('year')} />
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
      style={getFontFamily()}
    >
      <div className="flex flex-col">
        <span className="text-[20px] font-bold text-[#5D4037]">{title}</span>
        <span className="text-[10px] font-bold text-stone-300">{date}</span>
      </div>
      <div className="flex flex-col items-end">
        <span className="text-[20px] font-bold text-[#E91E63]">- {expense.toLocaleString()}</span>
        <span className="text-[20px] font-bold text-[#03A9F4]">+ {income.toLocaleString()}</span>
      </div>
    </motion.div>
  );
}

export function calculateAccountBalance(account: Account, accounts: Account[], records: Transaction[]): number {
  if (account.isBrandGroup && (account as any).childAccounts) {
    return (account as any).childAccounts.reduce((sum: number, c: Account) => {
      return sum + calculateAccountBalance(c, accounts, records);
    }, 0);
  }

  const mergedRecords = getMergedRecords(records, accounts);
  const getBaseBalance = (acc: Account) => {
    let bal = acc.type === 'credit' ? 0 : (acc.initialBalance || 0);
    console.log(`[DEBUG] getBaseBalance for ${acc.name} (${acc.id}): starting with initial ${acc.initialBalance || 0}`);
    mergedRecords.forEach(r => {
      if (r.category === '初始資金') return;
      if (r.accountId === acc.id) {
        bal += r.amount;
        console.log(`  - Subtracting spending/transfer-out: ${r.date} | ${r.note || r.category} | amount: ${r.amount} | type: ${r.type} | new bal: ${bal}`);
        if (r.fee) {
          bal -= r.fee;
          console.log(`    - Fee: ${r.fee} | new bal: ${bal}`);
        }
      }
      if (r.type === 'transfer' && r.toAccountId === acc.id) {
        const toAmt = r.toAmount !== undefined ? r.toAmount : Math.abs(r.amount * (r.exchangeRate || 1));
        bal += toAmt;
        console.log(`  + Adding deposit/transfer-in: ${r.date} | ${r.note || r.category} | amount: ${toAmt} | new bal: ${bal}`);
      }
    });
    return bal;
  };

  const getRecursiveBalance = (id: string): number => {
    const acc = accounts.find(a => a.id === id);
    if (!acc) return 0;
    let total = getBaseBalance(acc);
    const children = accounts.filter(a => a.parentId === id);
    children.forEach(child => {
      const childBal = getRecursiveBalance(child.id);
      total += childBal;
      console.log(`  + Adding child account ${child.name} (${child.id}) balance: ${childBal} | new total: ${total}`);
    });
    return total;
  };

  const result = getRecursiveBalance(account.id);
  console.log(`[DEBUG] Final recursive balance for ${account.name}: ${result}`);
  return result;
}

export function calculateCreditCardUntransferred(
  account: Account,
  accounts: Account[],
  records: Transaction[]
): number {
  if (account.isBrandGroup && (account as any).childAccounts) {
    return (account as any).childAccounts.reduce((sum: number, c: Account) => {
      return sum + calculateCreditCardUntransferred(c, accounts, records);
    }, 0);
  }

  const childrenIds = accounts.filter(a => a.parentId === account.id).map(a => a.id);
  const targetIds = [account.id, ...childrenIds];

  const mergedRecords = getMergedRecords(records, accounts);
  
  const accountRecords = mergedRecords.filter(r => 
    (targetIds.includes(r.accountId) || (r.toAccountId && targetIds.includes(r.toAccountId))) && 
    r.category !== '初始資金'
  );

  let ntSum = 0;

  accountRecords.forEach(r => {
    const noteText = (r.note || '') + (r.remark || '') + (r.category || '');
    const noteLower = noteText.toLowerCase();
    const isFeedback = 
      noteLower.includes('回饋') || 
      noteLower.includes('返現') || 
      noteLower.includes('紅利') || 
      noteLower.includes('折抵') || 
      noteLower.includes('cashback') || 
      noteLower.includes('reward');
    
    if (isFeedback) {
      return;
    }

    const isTransferPayment = r.type === 'transfer';
    let isTransferIn = false;
    let isAutoPay = false;
    
    if (isTransferPayment) {
      isTransferIn = r.toAccountId && targetIds.includes(r.toAccountId);
      
      if (isTransferIn) {
        isAutoPay = 
          (noteText.includes('自動') && noteText.includes('扣繳')) || 
          (noteText.includes('自動') && noteText.includes('繳款')) || 
          (noteText.includes('自動') && noteText.includes('扣款')) ||
          noteText.includes('轉帳扣繳') ||
          noteText.includes('扣繳信用卡款') ||
          noteText.includes('自動扣繳');
      }
    }

    if (isAutoPay) {
      return;
    }

    const isTransferred = r.transferredDate || (isTransferPayment && isTransferIn);

    if (!isTransferred) {
      ntSum += r.amount;
    }
  });

  return ntSum;
}

function DynamicAccountBalance({ 
  account, 
  accounts,
  transactions, 
  showAmounts,
  currencyMode = 'TWD',
  className = "text-xl sm:text-[26px] font-black mt-1"
}: { 
  account: Account | any, 
  accounts: Account[],
  transactions: Transaction[], 
  showAmounts: boolean,
  currencyMode?: 'TWD' | 'FOREIGN',
  className?: string
}) {
  const calculatedBalance = useMemo(() => {
    if (account.isBrandGroup && account.childAccounts) {
      return account.childAccounts.reduce((sum: number, c: Account) => {
        const bal = calculateAccountBalance(c, accounts, transactions);
        const cur = c.currency || 'TWD';
        const rate = (currencyMode === 'FOREIGN' && cur !== 'TWD') ? getLatestExchangeRate(transactions, accounts, cur) : 1;
        return sum + (bal * rate);
      }, 0);
    }
    const isCredit = account.type === 'credit';
    if (isCredit) {
      // 信用卡帳戶 (負債類) 雙軌制動態計算
      return calculateAccountBalance(account, accounts, transactions);
    } else {
      // 銀行/現金/電子支付帳戶 (資產類)
      return calculateAccountBalance(account, accounts, transactions);
    }
  }, [account, accounts, transactions, currencyMode]);

  const formatAmount = (val: number) => {
    if (!showAmounts) return '****';
    return val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const isNegative = calculatedBalance < 0;
  const colorClass = isNegative ? 'text-rose-400' : 'text-[#5D4037]';

  const twdText = useMemo(() => {
    if (!showAmounts) return null;
    if (account.isBrandGroup || !account.currency || account.currency === 'TWD') return null;
    const rate = getLatestExchangeRate(transactions, accounts, account.currency);
    const twdBal = Math.round(calculatedBalance * rate);
    return `(約 NT$ ${twdBal.toLocaleString()})`;
  }, [account, accounts, transactions, calculatedBalance, showAmounts]);

  const showTwdSymbol = currencyMode === 'FOREIGN' && (account.isBrandGroup || account.currency === 'TWD');

  return (
    <div className="flex items-baseline gap-1.5 flex-wrap" style={getFontFamily()}>
      <span className={`${className} ${colorClass}`} style={getFontFamily()}>
        <span className="mr-1" style={getFontFamily()}>{showTwdSymbol ? 'NT$' : '$'}</span>
        {formatAmount(calculatedBalance)}
      </span>
      {twdText && (
        <span className="text-xs font-bold text-stone-400" style={getFontFamily()}>
          {twdText}
        </span>
      )}
    </div>
  );
}

function AccountsView({ accounts, netAssets, totalAssets, totalLiabilities, onAccountClick, onAddAccount, balances, currencyMode, onCurrencyModeChange, records }: { 
  accounts: Account[], 
  netAssets: number,
  totalAssets: number,
  totalLiabilities: number,
  onAccountClick: (acc: Account) => void,
  onAddAccount: () => void,
  balances: Record<string, number>,
  currencyMode: 'TWD' | 'FOREIGN',
  onCurrencyModeChange: (mode: 'TWD' | 'FOREIGN') => void,
  records: Transaction[]
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
    points: '點數',
    deposit: '定存',
    insurance: '保險',
    other: '其他'
  };

  const groupedAccounts = useMemo(() => {
    // Sort all accounts by order first
    const sortedRawAccounts = [...accounts].sort((a, b) => (a.order || 0) - (b.order || 0));
    
    // An account is "Top Level" in this view if it has no parent OR its parent is not in the current list
    const topLevelAccounts = sortedRawAccounts.filter(a => {
      if (!a.parentId) return true;
      return !accounts.some(p => p.id === a.parentId);
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
            return Math.min(...item.childAccounts.map((c: Account) => c.order || 0));
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
            return Math.min(...item.childAccounts.map((c: Account) => c.order || 0));
          }
          return item.order || 0;
        };
        return getOrder(a) - getOrder(b);
      });

      groups.credit = creditItems;
    }

    return groups;
  }, [accounts]);

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
        <div className="bg-white/50 p-1 rounded-2xl border-2 border-white shadow-sm flex" style={getFontFamily()}>
          <button 
            onClick={() => onCurrencyModeChange('TWD')}
            className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${currencyMode === 'TWD' ? 'bg-[#5D4037] text-[#FFD54F] shadow-md' : 'text-stone-400'}`}
          >
            台幣 (TWD)
          </button>
          <button 
            onClick={() => onCurrencyModeChange('FOREIGN')}
            className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${currencyMode === 'FOREIGN' ? 'bg-[#5D4037] text-[#FFD54F] shadow-md' : 'text-stone-400'}`}
          >
            外幣
          </button>
        </div>
      </div>

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
              return sum + acc.childAccounts.reduce((cSum: number, c: Account) => {
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
              return sum + acc.childAccounts.reduce((cSum: number, c: Account) => {
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
                  <span>合計 {currencyMode === 'FOREIGN' ? 'NT$ ' : '$ '}{formatAmount(typeTotal)}</span>
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
                            <span className="text-[10px] sm:text-xs font-bold text-stone-300 uppercase tracking-widest mb-1 leading-none truncate" style={getFontFamily()}>
                              {isBrandGroup ? `${acc.name}總額` : (acc.type === 'bank' ? `${acc.name}總額` : (acc.type === 'credit' ? '目前未繳金額' : accountTypeLabels[acc.type as Account['type']]))}
                            </span>
                            <span className="text-lg sm:text-xl font-black text-[#5D4037] leading-tight truncate" style={getFontFamily()}>{acc.name}</span>
                            <DynamicAccountBalance
                              account={acc}
                              accounts={accounts}
                              transactions={records}
                              showAmounts={showAmounts}
                              currencyMode={currencyMode}
                              className="text-xl sm:text-[26px] font-black mt-1"
                            />
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

                        {/* Credit card progress bar */}
                        {!isBrandGroup && acc.type === 'credit' && acc.creditLimit && (
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
                                      onClick={() => hasLevel3 ? toggleGroup(l2acc.id) : onAccountClick(l2acc)}
                                      className="flex-1 bg-white/80 p-3 sm:p-4 rounded-[24px] border border-white flex flex-col gap-1 cursor-pointer active:scale-95 transition-all shadow-sm overflow-hidden"
                                    >
                                      <div className="flex flex-row items-center gap-2 sm:gap-3 w-full">
                                        <div 
                                          onClick={(e) => {
                                            if (hasLevel3) {
                                              e.stopPropagation();
                                              onAccountClick(l2acc);
                                            }
                                          }}
                                          className="w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-xl flex-shrink-0 flex items-center justify-center text-lg sm:text-xl shadow-inner active:scale-90 transition-transform"
                                        >
                                          <AccountIcon icon={l2acc.icon} sizeClassName="w-5 h-5 sm:w-6 sm:h-6" />
                                        </div>
                                        <div className="flex flex-col flex-1 min-w-0 justify-center">
                                          {l2acc.type === 'credit' ? (
                                            <span className="text-[9px] sm:text-[10px] font-bold text-stone-300 uppercase tracking-widest leading-none mb-0.5 truncate" style={getFontFamily()}>
                                              目前未繳金額
                                            </span>
                                          ) : (
                                            l2acc.type !== 'e-ticket' && (
                                              <span className="text-[9px] sm:text-[10px] font-bold text-stone-300 uppercase tracking-widest leading-none mb-0.5 truncate">
                                                主帳號
                                              </span>
                                            )
                                          )}
                                          <span className="text-sm sm:text-base font-black text-[#5D4037] leading-tight truncate" style={getFontFamily()}>{l2acc.name}</span>
                                          <DynamicAccountBalance
                                            account={l2acc}
                                            accounts={accounts}
                                            transactions={records}
                                            showAmounts={showAmounts}
                                            currencyMode={currencyMode}
                                            className="text-base sm:text-lg font-black mt-0.5"
                                          />
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

                                      {/* Credit card progress bar */}
                                      {l2acc.type === 'credit' && l2acc.creditLimit && (
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
                                                  {l3acc.type === 'credit' ? (
                                                    <span className="text-[8px] sm:text-[9px] font-bold text-stone-300 uppercase tracking-widest leading-none mb-0.5 truncate" style={getFontFamily()}>目前未繳金額</span>
                                                  ) : (
                                                    l3acc.type !== 'e-ticket' && (
                                                      <span className="text-[8px] sm:text-[9px] font-bold text-stone-300 uppercase tracking-widest leading-none mb-0.5 truncate">子帳戶</span>
                                                    )
                                                  )}
                                                  <span className="text-xs sm:text-sm font-bold text-[#5D4037] leading-tight truncate" style={getFontFamily()}>{l3acc.name}</span>
                                                  <DynamicAccountBalance
                                                    account={l3acc}
                                                    accounts={accounts}
                                                    transactions={records}
                                                    showAmounts={showAmounts}
                                                    currencyMode={currencyMode}
                                                    className="text-sm sm:text-base font-black"
                                                  />
                                                </div>
                                              </div>

                                              {/* Credit card progress bar */}
                                              {l3acc.type === 'credit' && l3acc.creditLimit && (
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
    </motion.div>
  );
}

function AccountDetailView({ account, records, selectedDate, onBack, onEdit, onUpdateRecord, onDeleteRecord, accounts, projects, balance, categories, onUpdateAccountsList }: { 
  account: Account, 
  records: Transaction[],
  selectedDate: string,
  onBack: () => void,
  onEdit: () => void,
  onUpdateRecord: (old: Transaction, updated: Transaction) => void,
  onDeleteRecord: (record: Transaction) => void,
  accounts: Account[],
  projects: Project[],
  balance: number,
  categories: Category[],
  onUpdateAccountsList?: React.Dispatch<React.SetStateAction<Account[]>>
}) {
  const [editingRecord, setEditingRecord] = useState<Transaction | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  type SortMode = 'date-desc' | 'date-asc' | 'posting-desc' | 'posting-asc';
  const [sortMode, setSortMode] = useState<SortMode>('date-desc');
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date(selectedDate);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [showDiagnostic, setShowDiagnostic] = useState(false);

  const [selectedCardFilterId, setSelectedCardFilterId] = useState<string | null>(null);

  const childrenIds = useMemo(() => {
    if (account.isBrandGroup && (account as any).childAccounts) {
      return (account as any).childAccounts.map((c: any) => c.id);
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
      return (account as any).childAccounts.map((c: any) => c.id);
    }
    return [account.id, ...childrenIds];
  }, [account, childrenIds, selectedCardFilterId]);

  const effectiveClosingDay = useMemo(() => {
    if (selectedCardFilterId) {
      const childAcc = accounts.find(a => a.id === selectedCardFilterId);
      if (childAcc && childAcc.closingDay) return childAcc.closingDay;
    }
    if (account.isBrandGroup && (account as any).childAccounts) {
      const childWithClosing = (account as any).childAccounts.find((c: any) => c.closingDay);
      return childWithClosing ? childWithClosing.closingDay : null;
    }
    return account.closingDay;
  }, [account, accounts, selectedCardFilterId]);

  const balanceMap = useMemo(() => {
    
    const relevant = records
      .filter(r => (targetIds.includes(r.accountId) || (r.toAccountId && targetIds.includes(r.toAccountId))) && r.category !== '初始資金')
      .sort((a, b) => {
        const dateDiff = a.date.localeCompare(b.date);
        if (dateDiff !== 0) return dateDiff;
        return a.id.localeCompare(b.id);
      });
      
    const map: Record<string, number> = {};
    const initialBal = selectedCardFilterId
      ? (accounts.find(a => a.id === selectedCardFilterId)?.initialBalance || 0)
      : (account.initialBalance || 0);
    let bal = initialBal;
    
    relevant.forEach(r => {
      if (targetIds.includes(r.accountId)) {
        bal += r.amount;
        if (r.fee) bal -= r.fee;
      }
      if (r.type === 'transfer' && r.toAccountId && targetIds.includes(r.toAccountId)) {
        bal += (r.toAmount !== undefined ? r.toAmount : Math.abs(r.amount * (r.exchangeRate || 1)));
      }
      map[r.id] = bal;
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
        change += r.amount;
        if (r.fee) change -= r.fee;
        matched = true;
        desc = `支出/轉出 (${getTransactionTitle(r)})`;
      }
      if (r.type === 'transfer' && r.toAccountId && targetIds.includes(r.toAccountId)) {
        const toAmt = r.toAmount !== undefined ? r.toAmount : Math.abs(r.amount * (r.exchangeRate || 1));
        change += toAmt;
        matched = true;
        desc = `收入/轉入 (${getTransactionTitle(r)})`;
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
  
  const accountRecords = useMemo(() => {
    const targetYearMonth = dateRangeStrings.filter;
    
    const raw = records.filter(r => 
      (targetIds.includes(r.accountId) || (r.toAccountId && targetIds.includes(r.toAccountId))) && 
      r.category !== '初始資金' &&
      (r.postingDate || r.date).startsWith(targetYearMonth)
    );
    
    const merged = getMergedRecords(raw, accounts);
    
    return merged.sort((a, b) => {
      const dateDiff = b.date.localeCompare(a.date);
      if (dateDiff !== 0) return dateDiff;
      return b.amount - a.amount;
    });
  }, [records, accounts, dateRangeStrings.filter, targetIds]);

  const calculatedBalance = useMemo(() => { 
    if (selectedCardFilterId) {
      const childAcc = accounts.find(a => a.id === selectedCardFilterId);
      if (childAcc) {
        return calculateAccountBalance(childAcc, accounts, records);
      }
    }
    return calculateAccountBalance(account, accounts, records); 
  }, [account, accounts, records, selectedCardFilterId]);

  const { paymentRecords, normalRecords } = useMemo(() => {
    if (account.type !== 'credit') return { paymentRecords: [], normalRecords: accountRecords };
    
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
      const isRepayment = (r.type === 'transfer' && r.toAccountId && targetIds.includes(r.toAccountId)) || hasKeywords;
      
      if (isRepayment) {
        paymentRecords.push(r);
      } else {
        normalRecords.push(r);
      }
    });

    // Apply sortMode to normalRecords
    normalRecords.sort((a, b) => {
      if (sortMode === 'date-desc') {
        const diff = b.date.localeCompare(a.date);
        return diff !== 0 ? diff : b.amount - a.amount;
      } else if (sortMode === 'date-asc') {
        const diff = a.date.localeCompare(b.date);
        return diff !== 0 ? diff : a.amount - b.amount;
      } else if (sortMode === 'posting-desc') {
        const diff = (b.postingDate || b.date).localeCompare(a.postingDate || a.date);
        return diff !== 0 ? diff : b.amount - a.amount;
      } else { // 'posting-asc'
        const diff = (a.postingDate || a.date).localeCompare(a.postingDate || a.date);
        return diff !== 0 ? diff : a.amount - b.amount;
      }
    });
    
    return { paymentRecords, normalRecords };
  }, [accountRecords, account.type, targetIds, sortMode]);

  const creditCardStats = useMemo(() => {
    let tCount = 0;
    let tSum = 0;
    let ntCount = 0;
    let ntSum = 0;

    accountRecords.forEach(r => {
      const noteText = (r.note || '') + (r.remark || '') + (r.category || '');
      const noteLower = noteText.toLowerCase();
      const isFeedback = 
        noteLower.includes('回饋') || 
        noteLower.includes('返現') || 
        noteLower.includes('紅利') || 
        noteLower.includes('折抵') || 
        noteLower.includes('cashback') || 
        noteLower.includes('reward');
      
      if (isFeedback) {
        return; // skip cashbacks / rewards entirely from transfer statistics
      }

      const isTransferPayment = r.type === 'transfer';
      let isTransferIn = false;
      let isAutoPay = false;
      
      if (isTransferPayment) {
        // Only count as repayment transfer if it's transferring money INTO the credit card account/sub-accounts
        isTransferIn = r.toAccountId && targetIds.includes(r.toAccountId);
        
        if (isTransferIn) {
          isAutoPay = 
            (noteText.includes('自動') && noteText.includes('扣繳')) || 
            (noteText.includes('自動') && noteText.includes('繳款')) || 
            (noteText.includes('自動') && noteText.includes('扣款')) ||
            noteText.includes('轉帳扣繳') ||
            noteText.includes('扣繳信用卡款') ||
            noteText.includes('自動扣繳');
        }
      }

      if (isAutoPay) {
        return; // skip auto-pay
      }

      // Counts as transferred if manually marked or if it is an incoming transfer payment (repayment)
      const isTransferred = r.transferredDate || (isTransferPayment && isTransferIn);

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
      notTransferredSum: ntSum
    };
  }, [accountRecords, targetIds]);

  const creditCardStatements = useMemo(() => {
    if (account.type !== 'credit' || !effectiveClosingDay) return [];

    const targetYearMonth = dateRangeStrings.filter; // e.g. "2026-07"

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

      // Apply bill month offset (e.g. -1 for previous month)
      const offset = account.billMonthOffset || 0;
      if (offset !== 0) {
        stmtMonth += offset;
        if (stmtMonth <= 0) {
          const absOffset = Math.abs(stmtMonth);
          const yearDiff = Math.floor(absOffset / 12) + 1;
          stmtYear -= yearDiff;
          stmtMonth = 12 - (absOffset % 12);
        } else if (stmtMonth > 12) {
          const yearDiff = Math.floor((stmtMonth - 1) / 12);
          stmtYear += yearDiff;
          stmtMonth = ((stmtMonth - 1) % 12) + 1;
        }
      }

      const key = `${stmtYear}-${String(stmtMonth).padStart(2, '0')}`;
      const calculatedLabel = `${stmtMonth}月帳單`;
      const label = account.customStatementLabels?.[key] || calculatedLabel;
      return { label, key };
    };

    // Filter transactions only for the selected calendar month (so users see them in the month they occurred)
    const cardRecords = records.filter(r => 
      (targetIds.includes(r.accountId) || (r.toAccountId && targetIds.includes(r.toAccountId))) && 
      r.category !== '初始資金' &&
      (r.postingDate || r.date).startsWith(targetYearMonth)
    );

    // Filter ALL history transactions for this card (to calculate the true statement totals)
    const allHistoryCardRecords = records.filter(r => 
      (targetIds.includes(r.accountId) || (r.toAccountId && targetIds.includes(r.toAccountId))) && 
      r.category !== '初始資金'
    );

    const groups: Record<string, { label: string; key: string; records: Transaction[]; balance: number }> = {};
    const transferPayments: Transaction[] = [];

    cardRecords.forEach(r => {
      const noteText = (r.note || '') + (r.remark || '') + (r.category || '');
      const noteLower = noteText.toLowerCase();
      const isFeedback = 
        noteLower.includes('回饋') || 
        noteLower.includes('返現') || 
        noteLower.includes('紅利') || 
        noteLower.includes('折抵') || 
        noteLower.includes('cashback') || 
        noteLower.includes('reward');

      const hasKeywords = 
        (noteText.includes('自動') && noteText.includes('扣繳')) || 
        (noteText.includes('自動') && noteText.includes('繳款')) || 
        (noteText.includes('自動') && noteText.includes('扣款')) ||
        noteText.includes('轉帳扣繳') ||
        noteText.includes('扣繳信用卡款');
      const isTransferIn = !isFeedback && (((r.type === 'transfer' && (r.toAccountId === effectiveParentId || effectiveChildrenIds.includes(r.toAccountId!))) || hasKeywords));
      
      if (isTransferIn) {
        // Payments are filtered by calendar month (when the payment actually occurred)
        if ((r.postingDate || r.date).startsWith(targetYearMonth)) {
          transferPayments.push(r);
        }
      } else {
        const dateStr = r.postingDate || r.date;
        const { label, key } = getStatementLabelAndKey(dateStr, effectiveClosingDay!);
        
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

    const statementList = Object.values(groups).map(g => {
      const sortedRecords = getMergedRecords(g.records, accounts).sort((a, b) => {
        if (sortMode === 'date-desc') {
          const diff = b.date.localeCompare(a.date);
          return diff !== 0 ? diff : b.amount - a.amount;
        } else if (sortMode === 'date-asc') {
          const diff = a.date.localeCompare(b.date);
          return diff !== 0 ? diff : a.amount - b.amount;
        } else if (sortMode === 'posting-desc') {
          const diff = (b.postingDate || b.date).localeCompare(a.postingDate || a.date);
          return diff !== 0 ? diff : b.amount - a.amount;
        } else { // 'posting-asc'
          const diff = (a.postingDate || a.date).localeCompare(b.postingDate || b.date);
          return diff !== 0 ? diff : a.amount - b.amount;
        }
      });

      // Calculate the true balance of this billing cycle across all history transactions
      let bal = 0;
      allHistoryCardRecords.forEach(r => {
        const dateStr = r.postingDate || r.date;
        const { key } = getStatementLabelAndKey(dateStr, effectiveClosingDay!);
        if (key === g.key) {
          if (r.accountId === effectiveParentId || effectiveChildrenIds.includes(r.accountId)) {
            bal += r.amount;
            if (r.fee) bal -= r.fee;
          }
        }
      });

      return {
        ...g,
        records: sortedRecords,
        balance: bal
      };
    });

    statementList.sort((a, b) => b.key.localeCompare(a.key));

    if (transferPayments.length > 0) {
      const sortedPayments = getMergedRecords(transferPayments, accounts).sort((a, b) => {
        const dateDiff = b.date.localeCompare(a.date);
        if (dateDiff !== 0) return dateDiff;
        return b.amount - a.amount;
      });

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
    const monthRecords = mergedRecords.filter(r => 
      (targetYearMonth ? (r.postingDate || r.date).startsWith(targetYearMonth) : true) &&
      r.category !== '初始資金'
    );

    const getBaseBalance = (acc: Account) => {
      let bal = 0;
      monthRecords.forEach(r => {
        if (r.accountId === acc.id) {
          bal += r.amount;
          if (r.fee) bal -= r.fee;
        }
        if (r.type === 'transfer' && r.toAccountId === acc.id) {
          bal += (r.toAmount !== undefined ? r.toAmount : Math.abs(r.amount * (r.exchangeRate || 1)));
        }
      });
      return bal;
    };

    const getRecursiveBalance = (id: string): number => {
      const acc = accounts.find(a => a.id === id);
      if (!acc) return 0;
      let total = getBaseBalance(acc);
      const children = accounts.filter(a => a.parentId === id);
      children.forEach(child => {
        total += getRecursiveBalance(child.id);
      });
      return total;
    };

    if (account.isBrandGroup && (account as any).childAccounts) {
      return (account as any).childAccounts.reduce((sum: number, c: Account) => {
        return sum + getRecursiveBalance(c.id);
      }, 0);
    }

    return getRecursiveBalance(account.id);
  }, [account, accounts, records, dateRangeStrings.filter, creditCardStatements]);

  const renderRecord = (record: Transaction) => {
                const isExpanded = expandedRecordId === record.id;
                return (
                  <div key={record.id} className="flex flex-col border-b border-stone-50 last:border-0 py-1">
                    {/* 主資訊行 (可點選展開) */}
                    <div 
                      onClick={() => setExpandedRecordId(isExpanded ? null : record.id)}
                      className="flex items-center gap-4 py-3 cursor-pointer hover:bg-stone-50/50 rounded-xl px-2 -mx-2 transition-colors"
                    >
                      {/* 左邊圖示 */}
                      <div className="w-14 h-14 bg-[#FFFDF5] rounded-2xl flex-shrink-0 flex items-center justify-center text-2xl shadow-sm border border-white">
                        {getCategoryIcon(record.category, record.type, categories)}
                      </div>
                      
                      {/* 中間主要資訊 */}
                      <div className="flex-1 min-w-0">
                        <span className="font-black text-lg text-[#5D4037] whitespace-pre-wrap break-all leading-tight block" style={getFontFamily()}>
                          {getTransactionTitle(record)}
                        </span>
                        
                        {/* 轉帳帳戶路徑或未入帳標籤 (收合時也能一目了然) */}
                        {record.type === 'transfer' ? (
                          (() => {
                            const isPos = record.amount > 0;
                            const currentAccName = accounts.find(a => a.id === record.accountId)?.name || '未知帳戶';
                            const counterpartAccName = accounts.find(a => a.id === record.toAccountId)?.name || '未知帳戶';
                            const firstAccName = isPos ? counterpartAccName : currentAccName;
                            const secondAccName = isPos ? currentAccName : counterpartAccName;
                            return (
                              <div className="flex flex-col gap-0.5 mt-0.5" style={getFontFamily()}>
                                <div className="flex items-center gap-1.5 text-xs font-bold text-[#5D4037]">
                                  <span className="opacity-80">{firstAccName}</span>
                                  <span className="text-amber-600 font-bold">➔</span>
                                  <span className="opacity-80 font-black text-amber-800">{secondAccName}</span>
                                  {record.transferredDate && (
                                    <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded-full font-bold ml-1">
                                      已轉帳
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs font-bold text-stone-300">
                                  {record.postingDate ? `入帳: ${record.postingDate}` : `轉帳: ${record.date}`}
                                </span>
                              </div>
                            );
                          })()
                        ) : (
                          <div className="flex items-center gap-2 mt-0.5" style={getFontFamily()}>
                            <span className="text-xs font-bold text-stone-300">
                              {record.postingDate ? `入帳: ${record.postingDate}` : `消費: ${record.date}`}
                            </span>
                            {account.type === 'credit' && (!record.postingDate || record.isPending) && (
                              <span className="text-[10px] px-2 py-0.5 bg-orange-100 text-orange-500 rounded-full font-bold">
                                未入帳
                              </span>
                            )}
                            {record.transferredDate && (
                              <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded-full font-bold">
                                已轉帳
                              </span>
                            )}
                            {account.parentId === undefined && record.accountId !== account.id && (
                              <span className="text-[10px] px-2 py-0.5 bg-stone-100 text-stone-400 rounded-full font-bold">
                                {accounts.find(a => a.id === record.accountId)?.name}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* 右邊金額與箭頭 */}
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end gap-1">
                          {/* 金額顯示 */}
                          {(() => {
                            let isFrom = targetIds.includes(record.accountId);
                            let isTo = record.toAccountId && targetIds.includes(record.toAccountId);
                            
                            if (record.type === 'transfer' || record._isMergedTransfer) {
                              const { src, dst } = getTransferSourceAndDest(record);
                              isFrom = targetIds.includes(src);
                              isTo = dst && targetIds.includes(dst);
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
                                    <span className={`font-black text-xl ${colorClass}`} style={getFontFamily()}>
                                       {sign} $ {Math.abs(displayAmt).toLocaleString()}
                                    </span>
                                    {record.fee ? <span className="text-[10px] text-stone-300" style={getFontFamily()}>含手續費 $ {record.fee}</span> : null}
                                  </div>
                                );
                              } else if (isTo && !isFrom) {
                                colorClass = 'text-[#03A9F4]';
                                sign = '+';
                                const displayAmt = record.toAmount !== undefined ? record.toAmount : Math.abs(record.amount * (record.exchangeRate || 1));
                                 return (
                                   <div className="flex flex-col items-end">
                                     <span className={`font-black text-xl ${colorClass}`} style={getFontFamily()}>
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
                                 <span className={`font-black text-xl ${colorClass}`} style={getFontFamily()}>
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
                                <span className="text-[10px] font-black text-stone-300 bg-stone-50 px-2 py-0.5 rounded-lg border border-stone-100" style={getFontFamily()}>
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
                          className="text-stone-300"
                        >
                          <ChevronDown size={20} />
                        </motion.div>
                      </div>
                    </div>
                    
                    {/* 展開詳細資訊區 */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: 'easeInOut' }}
                          className="overflow-hidden bg-[#FFFDF8] rounded-[24px] border-2 border-stone-100/40 p-5 mt-1 mb-2 mx-1 shadow-inner flex justify-between items-end gap-4"
                          style={getFontFamily()}
                        >
                          <div className="flex-1 flex flex-col gap-2.5 text-[13px] font-bold text-[#5D4037]">
                            {/* 項目 1：分類 */}
                            <div className="flex items-center gap-2">
                              <span className="text-stone-400 font-bold min-w-[65px]">交易分類:</span>
                              <span className="bg-[#FFF9E3] px-3 py-1 rounded-full text-xs font-black text-[#8D6E63] border border-[#FFD54F]/20">
                                {record.category || (record.type === 'transfer' ? '轉帳' : '未分類')}
                              </span>
                            </div>
                            
                            {/* 項目 2：日期 */}
                            <div className="flex items-center gap-2">
                              <span className="text-stone-400 font-bold min-w-[65px]">交易日期:</span>
                              <span className="font-black text-stone-600">
                                {record.date} {record.postingDate ? `(入帳: ${record.postingDate})` : ''}
                              </span>
                            </div>
                            
                            {/* 項目 3：備註明細 */}
                            <div className="flex items-start gap-2">
                              <span className="text-stone-400 font-bold min-w-[65px]">備註明細:</span>
                              <span className="font-bold text-stone-600 break-all bg-white p-2 rounded-xl border border-stone-100 flex-1 min-h-[36px] block">
                                {record.note ? record.note.replace(/\[固定收支\]/g, '').trim() : '無備註'}
                              </span>
                            </div>

                            {/* 轉帳附加資訊：手續費與匯率 */}
                            {(record.type === 'transfer' || record._isMergedTransfer) && (() => {
                              const { src, dst } = getTransferSourceAndDest(record);
                              const srcAcc = accounts.find(a => a.id === src);
                              const dstAcc = accounts.find(a => a.id === dst);
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
                                <>
                                  {hasConversion && (
                                    <>
                                      <div className="flex items-center gap-2">
                                        <span className="text-stone-400 font-bold min-w-[65px]">當時匯率:</span>
                                        <span className="font-black text-[#5D4037]">
                                          {rateStr}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-stone-400 font-bold min-w-[65px]">實收金額:</span>
                                        <span className="font-black text-[#5D4037]">
                                          {dstCur} {Math.abs(toAmt).toLocaleString()}
                                        </span>
                                      </div>
                                    </>
                                  )}
                                  {record.fee ? (
                                    <div className="flex items-center gap-2">
                                      <span className="text-stone-400 font-bold min-w-[65px]">手續費:</span>
                                      <span className="font-black text-rose-500">
                                        $ {record.fee.toLocaleString()} ({srcCur})
                                      </span>
                                    </div>
                                  ) : null}
                                </>
                              );
                            })()}

                            {/* 項目 3.5：已轉帳狀態與日期 (消費與轉帳皆適用) */}
                            {(record.type === 'expense' || record.type === 'transfer') && (
                              <div className="flex items-center gap-2">
                                <span className="text-stone-400 font-bold min-w-[65px]">轉帳狀態:</span>
                                {record.transferredDate ? (
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg text-xs font-black border border-emerald-200">
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
                                      className="px-1.5 py-0.5 bg-white border border-stone-200 rounded-lg text-[11px] font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                                    />
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onUpdateRecord(record, { ...record, transferredDate: undefined });
                                      }}
                                      className="text-stone-400 hover:text-rose-500 text-xs font-bold px-1"
                                      title="清除轉帳日期"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onUpdateRecord(record, { ...record, transferredDate: formatLocalDate(new Date()) });
                                      }}
                                      className="bg-stone-50 hover:bg-stone-100 text-stone-600 px-2 py-1 rounded-lg text-xs font-bold border border-stone-200 active:scale-95 transition-all"
                                    >
                                      標記為已轉帳
                                    </button>
                                    <span className="text-[#8C7B72]/70 text-xs">或選擇日期:</span>
                                    <input 
                                      type="date"
                                      onClick={e => e.stopPropagation()}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        onUpdateRecord(record, { ...record, transferredDate: e.target.value || undefined });
                                      }}
                                      className="px-1.5 py-0.5 bg-white border border-stone-200 rounded-lg text-[11px] font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* 項目 4：當下餘額或刷卡累積 */}
                            <div className="flex items-center gap-2 border-t border-dashed border-stone-100 pt-2.5 mt-1">
                              <span className="text-stone-400 font-bold min-w-[65px]">
                                {account.type === 'credit' ? '刷卡累積:' : '帳戶餘額:'}
                              </span>
                              <span className={`font-black text-sm ${account.type === 'credit' ? 'text-rose-500' : ((balanceMap[record.id] || 0) < 0 ? 'text-rose-400' : 'text-[#5D4037]')}`}>
                                {account.type === 'credit' 
                                  ? `$ ${Math.abs(balanceMap[record.id] || 0).toLocaleString()}` 
                                  : `${(balanceMap[record.id] || 0) < 0 ? '- $ ' : '$ '}${Math.abs(balanceMap[record.id] || 0).toLocaleString()}`
                                }
                              </span>
                            </div>
                          </div>
                          
                          {/* 項目 5：鉛筆編輯按鈕 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingRecord(record);
                            }}
                            className="w-12 h-12 rounded-2xl bg-[#5D4037] text-white flex items-center justify-center shadow-md active:scale-90 hover:bg-[#4E342E] transition-all flex-shrink-0"
                          >
                            <Pencil size={18} />
                          </button>
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
              <span className="text-xs font-bold text-stone-300 uppercase tracking-[0.2em]" style={getFontFamily()}>
                {account.type === 'credit' ? '目前未繳金額' : '目前餘額'}
              </span>
            </div>
            <div className="flex items-baseline gap-1 flex-wrap" style={getFontFamily()}>
              <span className="text-sm font-black text-stone-300">$</span>
              <span className={`text-4xl font-black tracking-tight ${calculatedBalance < 0 ? 'text-rose-400' : 'text-[#5D4037]'}`} style={getFontFamily()}>
                {calculatedBalance.toLocaleString()}
              </span>
              {(() => {
                const activeCurrency = selectedCardFilterId 
                  ? accounts.find(a => a.id === selectedCardFilterId)?.currency || account.currency 
                  : account.currency;
                if (!activeCurrency || activeCurrency === 'TWD') return null;
                const rate = getLatestExchangeRate(records, accounts, activeCurrency);
                const twdBal = Math.round(calculatedBalance * rate);
                return (
                  <span className="text-sm font-bold text-stone-400 ml-1.5" style={getFontFamily()}>
                    (約 NT$ {twdBal.toLocaleString()})
                  </span>
                );
              })()}
            </div>
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
                      <span className="text-[10px] text-stone-300 mr-1.5">{item.date}</span>
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
                {account.type === 'credit' && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setIsSortModalOpen(true)}
                      className="px-3.5 py-1.5 bg-[#FFFDF5] border border-[#5D4037]/25 rounded-2xl font-black text-xs text-[#5D4037]/80 hover:bg-stone-50 hover:text-[#5D4037] active:scale-95 transition-all flex items-center gap-1.5 shrink-0 shadow-sm"
                      title="選擇排序與卡片"
                      style={getFontFamily()}
                    >
                      <ArrowUpDown size={12} className="text-[#5D4037]/50" />
                      <span>
                        {sortMode === 'date-desc' && '消費日 - 新到舊'}
                        {sortMode === 'date-asc' && '消費日 - 舊到新'}
                        {sortMode === 'posting-desc' && '入帳日 - 新到舊'}
                        {sortMode === 'posting-asc' && '入帳日 - 舊到新'}
                      </span>
                    </button>
                    {selectedCardFilterId && (
                      <span 
                        className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-full font-black text-[10px] flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer transition-all"
                        onClick={() => setSelectedCardFilterId(null)}
                        title="點擊清除卡片篩選"
                        style={getFontFamily()}
                      >
                        <span>卡片: {accounts.find(a => a.id === selectedCardFilterId)?.name}</span>
                        <span className="text-[8px] opacity-60 ml-0.5">✕</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Card: Statistics */}
            <div className="bg-white p-3 px-4 rounded-[25px] shadow-sm border border-stone-50 flex flex-col gap-0.5 text-[11px] font-bold text-stone-400 shrink-0 text-left" style={getFontFamily()}>
              <div className="flex items-center justify-between gap-1">
                <span>{accountRecords.length} 筆紀錄</span>
                <span>|</span>
              </div>
              {account.type === 'credit' ? (
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
              {dateRangeStrings.range}
            </button>
            <button 
              onClick={() => changeMonth(1)}
              className="w-8 h-8 flex items-center justify-center text-[#5D4037] hover:bg-white/60 rounded-full transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 bg-white/80 backdrop-blur-sm rounded-[40px] shadow-sm border-2 border-white overflow-hidden flex flex-col">
          {account.type === 'credit' && effectiveClosingDay ? (
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
                      {stmt.records.length > 0 ? (
                        stmt.records.map(renderRecord)
                      ) : (
                        <div className="text-center py-4 text-xs font-bold text-stone-300">
                          本期無任何交易紀錄
                        </div>
                      )}
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
                    <div className="flex justify-between items-center px-1" style={getFontFamily()}>
                      <span className="font-black text-sm text-[#5D4037]">扣繳資訊</span>
                      <span className="text-xs font-bold text-stone-400">
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
                    {normalRecords.length > 0 ? (
                      normalRecords.map(renderRecord)
                    ) : (
                      <div className="text-center py-4 text-xs font-bold text-stone-300">
                        本月無任何消費明細紀錄
                      </div>
                    )}
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
            accountRecords.length > 0 ? (
              <div className="overflow-y-auto p-6 space-y-4">
                {accountRecords.map(renderRecord)}
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
            accounts={accounts}
            projects={projects}
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
                  {[
                    { mode: 'date-desc', label: '消費日 - 新到舊' },
                    { mode: 'date-asc', label: '消費日 - 舊到新' },
                    { mode: 'posting-desc', label: '入帳日 - 新到舊' },
                    { mode: 'posting-asc', label: '入帳日 - 舊到新' }
                  ].map(opt => (
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

                {account.isBrandGroup && (account as any).childAccounts && (account as any).childAccounts.length > 0 && (
                  <div className="border-t border-stone-100 pt-3 flex flex-col gap-2">
                    <div className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">分卡別篩選 (FILTER BY CARD)</div>
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
                      {(account as any).childAccounts.map((child: any) => (
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

function EditRecordModal({ record, accounts, projects, onClose, onSave, onDelete }: {
  record: Transaction,
  accounts: Account[],
  projects: Project[],
  onClose: () => void,
  onSave: (updated: Transaction) => void,
  onDelete: () => void
}) {
  const [edited, setEdited] = useState<Transaction>(() => {
    const initial = { ...record };
    if (initial.type === 'transfer' && initial.amount > 0) {
      const temp = initial.accountId;
      initial.accountId = initial.toAccountId || '';
      initial.toAccountId = temp;
      initial.amount = -initial.amount;
    }
    if (initial.type === 'transfer' && !initial.toAccountId) {
      const otherAcc = accounts.find(a => a.id !== initial.accountId);
      initial.toAccountId = otherAcc?.id || '';
    }
    return initial;
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isProjectPickerOpen, setIsProjectPickerOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [amountStr, setAmountStr] = useState<string>(
    record.amount === 0 ? '' : Math.abs(record.amount).toString()
  );

  const fromAcc = accounts.find(a => a.id === edited.accountId);
  const toAcc = accounts.find(a => a.id === edited.toAccountId);

  const editRateLabel = useMemo(() => {
    const srcCur = fromAcc?.currency || 'TWD';
    const dstCur = toAcc?.currency || 'TWD';
    if (srcCur === 'TWD' && dstCur !== 'TWD') {
      return `匯率 (1 ${dstCur} = ? TWD)`;
    } else if (srcCur !== 'TWD' && dstCur === 'TWD') {
      return `匯率 (1 ${srcCur} = ? TWD)`;
    }
    return `匯率 (1 ${srcCur} = ? ${dstCur})`;
  }, [fromAcc, toAcc]);

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
        style={getFontFamily()}
      >
        <AnimatePresence>
          {isProjectPickerOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-[#5D4037]/40 backdrop-blur-md"
                onClick={() => setIsProjectPickerOpen(false)}
              />
              <motion.div 
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                className="relative bg-[#FFFDF5] w-full max-w-sm rounded-[40px] shadow-2xl border-2 border-white overflow-hidden flex flex-col max-h-[80vh]"
                style={getFontFamily()}
              >
                <div className="p-6 pb-2 border-b border-stone-50 flex items-center justify-between">
                  <h3 className="text-xl font-black text-[#5D4037]">選取專案</h3>
                  <button onClick={() => setIsProjectPickerOpen(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                    <X size={20} className="text-stone-400" />
                  </button>
                </div>
                
                <div className="p-4 border-b border-stone-50">
                  <div className="relative" onClick={e => e.stopPropagation()} onFocus={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" />
                    <input 
                      value={projectSearch}
                      onChange={e => setProjectSearch(e.target.value)}
                      onClick={e => e.stopPropagation()}
                      onFocus={e => e.stopPropagation()}
                      onTouchStart={e => e.stopPropagation()}
                      placeholder="搜尋專案..."
                      className="w-full pl-10 pr-4 py-3 bg-white border-2 border-stone-50 rounded-2xl text-sm font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                      style={getFontFamily()}
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                  {projects.filter(p => !p.parentId && (p.name.includes(projectSearch) || projects.some(c => c.parentId === p.id && c.name.includes(projectSearch)))).map(p => {
                    const children = projects.filter(c => c.parentId === p.id && (c.name.includes(projectSearch) || p.name.includes(projectSearch)));
                    return (
                      <div key={p.id} className="space-y-1">
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation();
                            setEdited({ ...edited, projectId: p.id }); 
                            setIsProjectPickerOpen(false); 
                          }}
                          className={`w-full p-4 rounded-3xl flex items-center gap-3 transition-all ${(edited.projectId || 'p1') === p.id ? 'bg-[#FFD54F] shadow-md scale-[1.02]' : 'bg-white hover:bg-[#FFFDF5] shadow-sm border border-stone-50'}`}
                        >
                          <AccountIcon icon={p.icon} sizeClassName="w-5 h-5" className="text-xl flex items-center justify-center" />
                          <span className="font-black text-[#5D4037]">{p.name}</span>
                          {(edited.projectId || 'p1') === p.id && <Check size={18} className="ml-auto text-[#5D4037]" />}
                        </button>
                        {children.map(c => (
                          <button 
                            key={c.id}
                            onClick={(e) => { 
                              e.stopPropagation();
                              setEdited({ ...edited, projectId: c.id }); 
                              setIsProjectPickerOpen(false); 
                            }}
                            className={`w-[90%] ml-auto p-3 rounded-2xl flex items-center gap-3 transition-all ${(edited.projectId || 'p1') === c.id ? 'bg-[#FFEDAE] shadow-md scale-[1.02]' : 'bg-stone-50/50 hover:bg-stone-100 shadow-sm border border-stone-50/50'}`}
                          >
                            <AccountIcon icon={c.icon} sizeClassName="w-4 h-4" className="text-lg flex items-center justify-center" />
                            <span className="font-bold text-[#5D4037] text-sm">{c.name}</span>
                            {(edited.projectId || 'p1') === c.id && <Check size={16} className="ml-auto text-[#5D4037]" />}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

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

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
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
              <input 
                value={edited.category}
                onChange={e => setEdited({ ...edited, category: e.target.value })}
                className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">備註 (買了什麼？)</label>
              <textarea 
                value={edited.note || ''}
                onChange={e => setEdited({ ...edited, note: e.target.value })}
                className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#000000] text-[18px] outline-none shadow-sm focus:border-[#FFD54F] transition-all min-h-[100px] resize-none whitespace-pre-wrap break-all"
                placeholder="買了什麼？"
                style={getFontFamily()}
              />
            </div>

            {/* Project Picker */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">所屬專案</label>
              <div 
                onClick={() => setIsProjectPickerOpen(true)}
                className="w-full p-4 bg-white border-2 border-[#FFD54F]/30 rounded-2xl flex items-center gap-3 cursor-pointer hover:bg-stone-50 transition-all shadow-sm"
              >
                <div className="w-8 h-8 bg-[#FFFDF5] rounded-lg flex items-center justify-center shadow-inner border border-[#FFD54F]/20">
                  <Layers size={14} className="text-[#FFD54F]" />
                </div>
                <div className="flex-1">
                  <span className="text-[15px] font-black text-[#5D4037] flex items-center gap-1.5">
                    <AccountIcon icon={projects.find(p => p.id === (edited.projectId || 'p1'))?.icon || ''} sizeClassName="w-5 h-5" />
                    <span>{projects.find(p => p.id === (edited.projectId || 'p1'))?.name || '無特別專案'}</span>
                  </span>
                </div>
                <ChevronRight size={18} className="text-stone-300" />
              </div>
            </div>

            <div className="space-y-4 bg-stone-50/50 p-4 rounded-3xl border border-white shadow-sm flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-stone-300 uppercase flex items-center gap-1">
                    <CalendarIcon size={10} /> 消費日 (實際購買)
                  </label>
                  <input 
                    type="date"
                    value={edited.date}
                    onChange={e => setEdited({ ...edited, date: e.target.value })}
                    className="w-full p-3 bg-white border-2 border-stone-50 rounded-xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
                    style={getFontFamily()}
                  />
                </div>
                <div className={`flex flex-col gap-1 transition-opacity ${edited.isPending ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                  <label className="text-[10px] font-bold text-stone-300 uppercase flex items-center gap-1">
                    <Banknote size={10} /> 入帳日 (信用卡結算)
                  </label>
                  <input 
                    type="date"
                    value={edited.postingDate || edited.date}
                    onChange={e => setEdited({ ...edited, postingDate: e.target.value, isPending: false })}
                    className="w-full p-3 bg-white border-2 border-stone-50 rounded-xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
                    style={getFontFamily()}
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pr-2">
                <span className="text-[11px] font-bold text-stone-400">待入帳 (暫不計入本月結餘)</span>
                <button 
                  onClick={() => setEdited({ ...edited, isPending: !edited.isPending, postingDate: !edited.isPending ? undefined : (edited.postingDate || edited.date) })}
                  className={`w-10 h-5 rounded-full transition-all relative ${edited.isPending ? 'bg-orange-400' : 'bg-stone-200'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${edited.isPending ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
            </div>

            {(edited.type === 'expense' || edited.type === 'transfer') && (
              <div className="space-y-2 bg-[#E8F5E9]/20 p-4 rounded-3xl border border-white shadow-sm flex flex-col gap-1">
                <label className="text-[10px] font-black text-[#2E7D32] uppercase tracking-widest px-1">轉帳過去的日期 (已付款)</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="date"
                    value={edited.transferredDate || ''}
                    onChange={e => setEdited({ ...edited, transferredDate: e.target.value || undefined })}
                    className="flex-1 p-3 bg-white border-2 border-stone-50 rounded-xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
                    style={getFontFamily()}
                  />
                  {edited.transferredDate && (
                    <button 
                      onClick={() => setEdited({ ...edited, transferredDate: undefined })}
                      className="px-4 py-3 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl font-bold transition-all text-sm"
                    >
                      清除
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">幣別</label>
              <select 
                value={edited.currency || 'TWD'}
                onChange={e => setEdited({ ...edited, currency: e.target.value })}
                className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm appearance-none focus:border-[#FFD54F] transition-all"
                style={getFontFamily()}
              >
                <option value="TWD">台幣 (TWD)</option>
                <option value="USD">美金 (USD)</option>
                <option value="JPY">日圓 (JPY)</option>
                <option value="KRW">韓元 (KRW)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1" style={getFontFamily()}>帳戶</label>
              <select 
                value={edited.accountId}
                onChange={e => {
                  const newAccountId = e.target.value;
                  let newToAccountId = edited.toAccountId;
                  if (edited.type === 'transfer' && newAccountId === newToAccountId) {
                    const other = accounts.find(a => a.id !== newAccountId);
                    newToAccountId = other?.id || '';
                  }
                  setEdited({ ...edited, accountId: newAccountId, toAccountId: newToAccountId });
                }}
                className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm appearance-none focus:border-[#FFD54F] transition-all"
                style={getFontFamily()}
              >
                {[...accounts].sort((a, b) => (a.order || 0) - (b.order || 0)).map(a => (
                  <option key={a.id} value={a.id} style={getFontFamily()}>{a.name}</option>
                ))}
              </select>
            </div>

            {edited.type === 'transfer' && (
              <>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1" style={getFontFamily()}>轉入帳戶</label>
                  <select 
                    value={edited.toAccountId || ''}
                    onChange={e => {
                      const newToAccountId = e.target.value;
                      let newAccountId = edited.accountId;
                      if (newToAccountId === newAccountId) {
                        const other = accounts.find(a => a.id !== newToAccountId);
                        newAccountId = other?.id || '';
                      }
                      setEdited({ ...edited, toAccountId: newToAccountId, accountId: newAccountId });
                    }}
                    className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm appearance-none focus:border-[#FFD54F] transition-all"
                    style={getFontFamily()}
                  >
                    {[...accounts].sort((a, b) => (a.order || 0) - (b.order || 0)).map(a => (
                      <option key={a.id} value={a.id} style={getFontFamily()}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">{editRateLabel}</label>
                    <input 
                      type="number"
                      value={edited.exchangeRate || 1}
                      onChange={e => {
                        const rate = parseFloat(e.target.value) || 1;
                        const amt = Math.abs(edited.amount);
                        let toAmt = amt * rate;
                        if (fromAcc?.currency === 'TWD' && toAcc?.currency !== 'TWD') {
                          toAmt = amt / rate;
                        } else if (fromAcc?.currency !== 'TWD' && toAcc?.currency === 'TWD') {
                          toAmt = amt * rate;
                        }
                        if (toAcc?.currency === 'JPY') {
                          toAmt = Math.round(toAmt);
                        }
                        setEdited({ ...edited, exchangeRate: rate, toAmount: toAmt });
                      }}
                      className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">實收金額 ({toAcc?.currency})</label>
                    <input 
                      type="number"
                      value={edited.toAmount !== undefined ? edited.toAmount : (() => {
                        const amt = Math.abs(edited.amount);
                        const rate = edited.exchangeRate || 1;
                        let toAmt = amt * rate;
                        if (fromAcc?.currency === 'TWD' && toAcc?.currency !== 'TWD') {
                          toAmt = amt / rate;
                        }
                        if (toAcc?.currency === 'JPY') {
                          toAmt = Math.round(toAmt);
                        }
                        return toAmt;
                      })()}
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
              onClick={() => {
                const rawAmt = edited.amount;
                let resolvedType = edited.type;
                if (rawAmt < 0) {
                  resolvedType = edited.type === 'transfer' ? 'transfer' : 'expense';
                } else {
                  if (edited.type === 'expense') resolvedType = 'expense';
                  else if (edited.type === 'income') resolvedType = 'income';
                  else if (edited.type === 'transfer') resolvedType = 'transfer';
                }
                const finalAmt = (resolvedType === 'expense' || resolvedType === 'transfer') ? -Math.abs(rawAmt) : Math.abs(rawAmt);
                
                let finalToAccountId = edited.toAccountId;
                if (resolvedType === 'transfer' && !finalToAccountId) {
                  const other = accounts.find(a => a.id !== edited.accountId);
                  finalToAccountId = other?.id || '';
                }

                onSave({
                  ...edited,
                  type: resolvedType,
                  amount: finalAmt,
                  toAccountId: resolvedType === 'transfer' ? finalToAccountId : undefined
                });
              }}
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

function CreditLimitBar({ account, accounts, records }: { account: Account; accounts: Account[]; records: Transaction[] }) {
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

function AccountEditModal({ account, accounts, records, onClose, onSave, onDelete, onViewDetail }: { 
  account: Account, 
  accounts: Account[],
  records: Transaction[],
  onClose: () => void, 
  onSave: (acc: Account, initialAmount: number) => void,
  onDelete: (id: string) => void,
  onViewDetail?: (acc: Account) => void
}) {
  const accountTypes: Account['type'][] = ['cash', 'bank', 'investment', 'credit', 'e-ticket', 'e-payment', 'points', 'deposit', 'insurance', 'other'];
  const isNew = !accounts.find(a => a.id === account.id);
  const [editedAcc, setEditedAcc] = useState<Account>(() => {
    // Migrate initialBalance from records if not present on account
    if (account.initialBalance !== undefined) return { ...account };
    const initRec = records.find(r => r.accountId === account.id && r.category === '初始資金');
    const legacyInit = initRec ? (initRec.type === 'income' ? initRec.amount : -initRec.amount) : 0;
    return { ...account, initialBalance: legacyInit };
  });
  const [initialBalanceStr, setInitialBalanceStr] = useState<string>(
    (account.initialBalance !== undefined ? account.initialBalance : (records.find(r => r.accountId === account.id && r.category === '初始資金')?.amount || 0)) === 0 
      ? '' 
      : (account.initialBalance !== undefined ? account.initialBalance : (records.find(r => r.accountId === account.id && r.category === '初始資金')?.amount || 0)).toString()
  );

  const otherRecordsSum = useMemo(() => {
    const mergedRecords = getMergedRecords(records, accounts);
    let sum = 0;
    mergedRecords.forEach(r => {
      if (r.category === '初始資金') return;
      if (r.accountId === account.id) {
        sum += r.amount;
        if (r.fee) sum -= r.fee;
      }
      if (r.type === 'transfer' && r.toAccountId === account.id) {
        sum += (r.toAmount !== undefined ? r.toAmount : Math.abs(r.amount * (r.exchangeRate || 1)));
      }
    });
    return sum;
  }, [records, account.id, accounts]);

  const currentTotal = (editedAcc.initialBalance || 0) + otherRecordsSum;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const prevParentId = useRef(editedAcc.parentId);
  const prevBankKey = useRef<string | null>(null);

  useEffect(() => {
    if (editedAcc.type !== 'credit') return;

    const parentAcc = editedAcc.parentId ? accounts.find(a => a.id === editedAcc.parentId) : undefined;
    const currentBankKey = getBankKeyword(editedAcc.name, parentAcc?.name);

    if (prevBankKey.current === null && currentBankKey) {
      prevBankKey.current = currentBankKey;
    }

    const parentIdChanged = editedAcc.parentId !== prevParentId.current;
    const bankKeyChanged = currentBankKey !== prevBankKey.current;

    if (isNew || parentIdChanged || bankKeyChanged) {
      const sameBankCard = accounts.find(a => {
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
                    points: '點數',
                    deposit: '定存',
                    insurance: '保險',
                    other: '其他'
                  };
                  return (
                    <button 
                      key={t}
                      onClick={() => setEditedAcc({ ...editedAcc, type: t })}
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

                {/* Credit Card Closing Day */}
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
                        const clampedVal = isNaN(val) ? undefined : Math.min(31, Math.max(1, val));
                        setEditedAcc({ ...editedAcc, closingDay: clampedVal });
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

function SearchView({ 
  records, 
  accounts, 
  categories, 
  projects,
  onBack,
  onUpdateRecord,
  onDeleteRecord,
  onReorder
}: { 
  records: Transaction[], 
  accounts: Account[], 
  categories: Category[], 
  projects: Project[],
  onBack: () => void,
  onUpdateRecord: (old: Transaction, updated: Transaction) => void,
  onDeleteRecord: (record: Transaction) => void,
  onReorder: (records: Transaction[]) => void
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRecord, setEditingRecord] = useState<Transaction | null>(null);

  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const raw = records.filter(r => 
      (r.note || '').toLowerCase().includes(query) || 
      r.category.toLowerCase().includes(query) ||
      r.amount.toString().includes(query)
    );
    const merged = getMergedRecords(raw, accounts);
    return merged.sort((a, b) => {
      const dateDiff = b.date.localeCompare(a.date);
      if (dateDiff !== 0) return dateDiff;
      return b.amount - a.amount;
    });
  }, [records, searchQuery, accounts]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full bg-[#FFF9E3]"
      style={getFontFamily()}
    >
      {/* Header */}
      <div className="p-6 pt-2 pb-2">
        <div className="relative">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" />
          <input 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜尋關鍵字、金額或分類..."
            className="w-full pl-12 pr-4 py-4 bg-white border-2 border-white rounded-[25px] shadow-sm text-lg font-bold text-[#5D4037] outline-none focus:border-[#FFD54F] transition-all"
            style={getFontFamily()}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {searchQuery.trim() === '' ? (
          <div className="flex flex-col items-center justify-center h-40 text-stone-300 gap-2 opacity-50">
            <Search size={40} />
            <span className="font-bold">輸入關鍵字開始搜尋</span>
          </div>
        ) : filteredRecords.length > 0 ? (
          <div className="space-y-4">
            <div className="text-xs font-bold text-stone-300 px-1">找到 {filteredRecords.length} 筆符合的紀錄</div>
            {filteredRecords.map((record, idx) => (
              <div 
                key={record.id} 
                className="flex items-center gap-2 py-4 bg-white/60 backdrop-blur-sm rounded-[30px] px-4 shadow-sm border border-white hover:bg-white transition-colors group relative"
              >
                <div 
                  onClick={() => setEditingRecord(record)}
                  className="flex-1 flex items-center gap-4 cursor-pointer"
                >
                  <div className="w-14 h-14 bg-[#FFFDF5] rounded-2xl flex-shrink-0 flex items-center justify-center text-2xl shadow-sm border border-white group-active:scale-95 transition-transform">
                    {getCategoryIcon(record.category, record.type, categories)}
                  </div>
                  
                  <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                  <span className="font-black text-lg text-[#5D4037] whitespace-pre-wrap break-all leading-tight" style={getFontFamily()}>
                    {getTransactionTitle(record)}
                  </span>
                  {record.type === 'transfer' ? (
                    (() => {
                      const isPos = record.amount > 0;
                      const currentAccName = accounts.find(a => a.id === record.accountId)?.name || '未知帳戶';
                      const counterpartAccName = accounts.find(a => a.id === record.toAccountId)?.name || '未知帳戶';
                      const firstAccName = isPos ? counterpartAccName : currentAccName;
                      const secondAccName = isPos ? currentAccName : counterpartAccName;
                      const displayDate = record.postingDate || record.date;
                      return (
                        <div className="flex flex-col gap-0.5">
                          {/* Line 2: Account A ➔ Account B */}
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#5D4037]" style={getFontFamily()}>
                            <span className="opacity-80" style={getFontFamily()}>{firstAccName}</span>
                            <span className="text-amber-600 font-bold" style={getFontFamily()}>➔</span>
                            <span className="opacity-80 font-black text-amber-800" style={getFontFamily()}>{secondAccName}</span>
                          </div>
                          {/* Line 3: Date as subtext YYYY-MM-DD */}
                          <span className="text-[11px] font-medium text-stone-400" style={getFontFamily()}>
                            入帳日期: {displayDate}
                          </span>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-stone-300">
                        {record.date}
                      </span>
                      <span className="text-[10px] font-bold text-stone-300 bg-stone-50 px-2 rounded-full">
                        {accounts.find(a => a.id === record.accountId)?.name}
                      </span>
                    </div>
                  )}
                </div>
                
                <span className={`font-black text-lg ${
                  (record.type === 'transfer' || record._isMergedTransfer) ? (record.amount < 0 ? 'text-[#E91E63]' : 'text-[#03A9F4]') :
                  record.type === 'income' ? 'text-[#03A9F4]' : 
                  record.type === 'expense' ? 'text-[#E91E63]' : 'text-stone-400'
                }`} style={getFontFamily()}>
                  {((record.type === 'transfer' || record._isMergedTransfer) ? (record.amount < 0 ? '-' : '+') : record.type === 'income' ? '+' : record.type === 'expense' ? '-' : '')} $ {Math.abs(record.amount).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-stone-300 gap-2 opacity-50">
            <span className="font-bold">找不到符合「{searchQuery}」的紀錄</span>
          </div>
        )}
      </div>

      <AnimatePresence>
        {editingRecord && (
          <EditRecordModal 
            record={editingRecord}
            accounts={accounts}
            projects={projects}
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

function CalendarView({ records, accounts, categories, onBack }: { records: Transaction[], accounts: Account[], categories: Category[], onBack: () => void }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewDate, setViewDate] = useState(new Date()); // Current month being viewed
  
  const filteredRecords = useMemo(() => records, [records]);
  const dayRecords = useMemo(() => {
    const raw = records.filter(r => r.date === selectedDate);
    return getMergedRecords(raw, accounts);
  }, [records, selectedDate, accounts]);
  
  const dayStats = useMemo(() => {
    return {
      income: dayRecords.filter(r => r.type === 'income').reduce((s, r) => s + Math.abs(r.amount), 0),
      expense: dayRecords.filter(r => r.type === 'expense').reduce((s, r) => s + (Math.abs(r.amount) + (r.fee || 0)), 0)
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
      style={getFontFamily()}
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

      <div className="p-4 space-y-4 flex-1 overflow-y-auto">
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
              {getCategoryIcon(record.category, record.type, categories)}
            </div>
            
            <div className="flex-1 flex flex-col gap-1 min-w-0">
              {/* Line 1: Title */}
              <span className="font-black text-lg text-[#5D4037] whitespace-pre-wrap break-all leading-tight" style={getFontFamily()}>
                {getTransactionTitle(record)}
              </span>
              
              {/* Line 2 & 3: Account Info / Transfer Path */}
              {record.type === 'transfer' ? (
                (() => {
                  const isPos = record.amount > 0;
                  const currentAccName = accounts.find(a => a.id === record.accountId)?.name || '未知帳戶';
                  const counterpartAccName = accounts.find(a => a.id === record.toAccountId)?.name || '未知帳戶';
                  const firstAccName = isPos ? counterpartAccName : currentAccName;
                  const secondAccName = isPos ? currentAccName : counterpartAccName;
                  const displayDate = record.postingDate || record.date;
                  return (
                    <div className="flex flex-col gap-0.5">
                      {/* Line 2: Account A ➔ Account B */}
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#5D4037]" style={getFontFamily()}>
                        <span className="opacity-80" style={getFontFamily()}>{firstAccName}</span>
                        <span className="text-amber-600 font-bold" style={getFontFamily()}>➔</span>
                        <span className="opacity-80 font-black text-amber-800" style={getFontFamily()}>{secondAccName}</span>
                      </div>
                      {/* Line 3: Date as subtext YYYY-MM-DD */}
                      <span className="text-[11px] font-medium text-stone-400" style={getFontFamily()}>
                        入帳日期: {displayDate}
                      </span>
                    </div>
                  );
                })()
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 bg-stone-100 text-stone-400 rounded-full font-bold">
                    {accounts.find(a => a.id === record.accountId)?.name}
                  </span>
                </div>
              )}
              
                <div className="flex items-baseline justify-between mt-1 flex-wrap">
                  <span className={`font-black text-xl ${
                    (record.type === 'transfer' || record._isMergedTransfer) ? (record.amount < 0 ? 'text-[#E91E63]' : 'text-[#03A9F4]') :
                    record.type === 'income' ? 'text-[#03A9F4]' :
                    record.type === 'expense' ? 'text-[#E91E63]' : 'text-stone-400'
                  }`} style={getFontFamily()}>
                    {((record.type === 'transfer' || record._isMergedTransfer) ? (record.amount < 0 ? '-' : '+') : record.type === 'income' ? '+' : record.type === 'expense' ? '-' : '')} $ {Math.abs(record.amount).toLocaleString()}
                  </span>
                  {(() => {
                    const twdText = getTwdEquivalentText(records, accounts, record);
                    return twdText ? (
                      <span className="text-[11px] text-stone-400 font-bold" style={getFontFamily()}>{twdText}</span>
                    ) : null;
                  })()}
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
      style={getFontFamily()}
    >
      <div className="text-stone-300 group-hover:text-[#FFD54F] transition-colors">{icon}</div>
      <span className="font-bold text-sm">{label}</span>
    </button>
  );
}

function FixedRecordsView({ fixedRecords, accounts, categories, records, onBack, onSave, onDelete }: { 
  fixedRecords: FixedRecord[], 
  accounts: Account[], 
  categories: Category[],
  records: Transaction[],
  onBack: () => void,
  onSave: (fr: FixedRecord) => void,
  onDelete: (id: string) => void
}) {
  const [editingRecord, setEditingRecord] = useState<FixedRecord | null>(null);

  useEffect(() => {
    const handleAdd = () => {
      setEditingRecord({
        id: `fixed_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name: '',
        amount: 0,
        type: 'expense',
        period: 'monthly',
        day: 1,
        accountId: accounts[0]?.id || 'cash',
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
      style={getFontFamily()}
    >
      <div className="flex-1 px-4 py-6 overflow-y-auto pb-10">
        <div className="bg-white/80 backdrop-blur-sm rounded-[40px] shadow-sm border-2 border-white p-6 space-y-4">
          {fixedRecords.length > 0 ? fixedRecords.map(record => (
            <div 
              key={record.id} 
              onClick={() => setEditingRecord(record)}
              className="flex items-center gap-4 py-4 border-b border-stone-50 last:border-0 group cursor-pointer hover:bg-stone-50/50 rounded-xl px-2 -mx-2 transition-colors"
            >
              <div className="w-14 h-14 bg-[#FFFDF5] rounded-2xl flex-shrink-0 flex items-center justify-center text-2xl shadow-sm border border-white">
                {getCategoryIcon(record.category, record.type, categories)}
              </div>
              
              <div className="flex-1 flex flex-col gap-1 min-w-0">
                <span className="font-black text-lg text-[#5D4037] whitespace-pre-wrap break-all leading-tight">
                  {record.name.replace(/\[固定收支\] /g, '').replace(/\[固定收支\]/g, '').trim()}
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
                  <span className={`font-black text-xl ${record.type === 'income' ? 'text-blue-400' : 'text-rose-400'}`} style={getFontFamily()}>
                    {record.type === 'income' ? '+' : '-'} $ {Math.abs(record.amount).toLocaleString()}
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
            records={records}
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

function FixedRecordEditModal({ record, accounts, categories, records, onClose, onSave, onDelete }: { 
  record: FixedRecord, 
  accounts: Account[], 
  categories: Category[],
  records: Transaction[],
  onClose: () => void, 
  onSave: (fr: FixedRecord) => void,
  onDelete: () => void
}) {
  const [edited, setEdited] = useState<FixedRecord>({ ...record });
  const [expandedBanks, setExpandedBanks] = useState<Record<string, boolean>>({});
  const [amountStr, setAmountStr] = useState<string>(record.amount === 0 ? '' : record.amount.toString());

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/30 backdrop-blur-md z-[80] flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        className="bg-[#FFFDF5] w-full max-w-md rounded-t-[40px] p-6 flex flex-col gap-4 max-h-[90vh] overflow-hidden"
        style={getFontFamily()}
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

        <div className="flex-1 overflow-y-auto space-y-6 px-1">
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
                  placeholder="0"
                  value={amountStr}
                  onChange={e => {
                    const val = e.target.value;
                    setAmountStr(val);
                    setEdited({ ...edited, amount: val === '' ? 0 : parseFloat(val) || 0 });
                  }}
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
                    onClick={() => setEdited({ ...edited, type: t as any, category: '' })}
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
              <label className="text-[18px] font-bold text-[#000000] uppercase px-8">扣款帳戶</label>
              <AccountSelector 
                accounts={accounts}
                records={records}
                currentSelectedId={edited.accountId}
                onSelect={(id) => setEdited({ ...edited, accountId: id })}
                expandedState={expandedBanks}
                setExpandedState={setExpandedBanks}
                keyPrefix="fixed-record"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[18px] font-bold text-[#000000] uppercase">選擇分類</label>
              <HorizontalScrollArea className="px-8">
                {categories.filter(c => c.type === edited.type).map(cat => (
                  <button 
                    key={cat.id}
                    onClick={() => setEdited({ ...edited, category: cat.name })}
                    className={`flex-shrink-0 w-20 h-24 rounded-[20px] flex flex-col items-center justify-center gap-2 border-2 transition-all ${
                      edited.category.split(' > ')[0] === cat.name ? 'bg-[#5D4037] text-white border-[#5D4037] shadow-md' : 'bg-white text-stone-400 border-white shadow-sm'
                    }`}
                  >
                    <div className={`w-10 h-10 ${edited.category.split(' > ')[0] === cat.name ? 'bg-white/20' : 'bg-stone-50'} rounded-full flex items-center justify-center text-xl overflow-hidden`}>
                      <AccountIcon icon={cat.icon} sizeClassName="w-6 h-6" />
                    </div>
                    <span className="text-[18px] font-bold text-[#000000] text-center px-1 leading-tight">{cat.name}</span>
                  </button>
                ))}
              </HorizontalScrollArea>
              
              {/* Sub Category Selection */}
              {categories.find(c => c.name === edited.category.split(' > ')[0] && c.type === edited.type) && (
                <div className="mt-2">
                  <HorizontalScrollArea className="px-8">
                    {categories.find(c => c.name === edited.category.split(' > ')[0] && c.type === edited.type)?.sub.map(sub => (
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

            <div className="space-y-4">
              <label className="text-[10px] font-bold text-stone-300 uppercase">備註</label>
              <textarea 
                value={edited.note || ''}
                onChange={e => setEdited({ ...edited, note: e.target.value })}
                className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] min-h-[100px] resize-none whitespace-pre-wrap break-all"
                placeholder="輸入備註..."
                style={getFontFamily()}
              />
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

const defaultTypeOrder: Account['type'][] = ['cash', 'bank', 'credit', 'e-payment', 'e-ticket', 'investment', 'deposit', 'insurance', 'points', 'other'];

const getGroupOrder = (type: Account['type'], accountsList: Account[]): number => {
  const catAccs = accountsList.filter(a => a.type === type);
  if (catAccs.length > 0) {
    return Math.min(...catAccs.map(a => a.order ?? 9999));
  }
  return 10000 + defaultTypeOrder.indexOf(type);
};

function AccountSortModal({ accounts, onClose, onSave }: { 
  accounts: Account[], 
  onClose: () => void, 
  onSave: (newOrder: Account[]) => void 
}) {
  const [categoryOrder, setCategoryOrder] = useState<Account['type'][]>(() => {
    const uniqueTypes: Account['type'][] = ['cash', 'bank', 'credit', 'e-payment', 'e-ticket', 'investment', 'deposit', 'insurance', 'points', 'other'];
    return [...uniqueTypes].sort((a, b) => getGroupOrder(a, accounts) - getGroupOrder(b, accounts));
  });

  // Grouping parents and children within their respective categories
  const [orderedAccounts, setOrderedAccounts] = useState<Account[]>(() => {
    const result: Account[] = [];
    const uniqueTypes: Account['type'][] = ['cash', 'bank', 'credit', 'e-payment', 'e-ticket', 'investment', 'deposit', 'insurance', 'points', 'other'];
    
    uniqueTypes.forEach(cat => {
      const catAccs = accounts.filter(a => a.type === cat);
      // Group parents and children
      const parents = catAccs.filter(a => !a.parentId);
      const catResult: Account[] = [];
      parents.sort((a, b) => (a.order || 0) - (b.order || 0)).forEach(p => {
        catResult.push(p);
        const children = catAccs.filter(c => c.parentId === p.id).sort((a, b) => (a.order || 0) - (b.order || 0));
        catResult.push(...children);
      });
      // Add any orphans just in case
      catAccs.forEach(a => {
        if (!catResult.find(r => r.id === a.id)) catResult.push(a);
      });
      result.push(...catResult);
    });
    
    return result;
  });

  const [expandedCategories, setExpandedCategories] = useState<Account['type'][]>([]);

  const toggleCategoryExpanded = (cat: Account['type']) => {
    setExpandedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const moveCategory = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...categoryOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    setCategoryOrder(newOrder);
  };

  const moveAccountWithinCategory = (cat: Account['type'], indexInCat: number, direction: 'up' | 'down') => {
    const catAccounts = orderedAccounts.filter(a => a.type === cat);
    const newCatAccounts = [...catAccounts];
    const item = newCatAccounts[indexInCat];

    const getSubtreeRange = (idx: number) => {
      const parent = newCatAccounts[idx];
      let endIdx = idx;
      for (let i = idx + 1; i < newCatAccounts.length; i++) {
        if (newCatAccounts[i].parentId === parent.id) {
          endIdx = i;
        } else {
          break;
        }
      }
      return [idx, endIdx];
    };

    if (item.parentId) {
      // Child account swap: only swap if the neighbor is a child of the SAME parent
      const targetIndex = direction === 'up' ? indexInCat - 1 : indexInCat + 1;
      if (targetIndex < 0 || targetIndex >= newCatAccounts.length) return;
      
      const targetItem = newCatAccounts[targetIndex];
      if (targetItem.parentId === item.parentId) {
        newCatAccounts[indexInCat] = targetItem;
        newCatAccounts[targetIndex] = item;
        
        setOrderedAccounts(prev => {
          const result: Account[] = [];
          let catIndex = 0;
          prev.forEach(acc => {
            if (acc.type === cat) {
              result.push(newCatAccounts[catIndex++]);
            } else {
              result.push(acc);
            }
          });
          return result;
        });
      }
    } else {
      // Parent account swap: move whole subtree (hen with chicks)
      const [start, end] = getSubtreeRange(indexInCat);
      const groupLength = end - start + 1;
      
      if (direction === 'up') {
        let prevParentStart = -1;
        for (let i = start - 1; i >= 0; i--) {
          if (!newCatAccounts[i].parentId) {
            prevParentStart = i;
            break;
          }
        }
        if (prevParentStart === -1) return;
        
        const group = newCatAccounts.splice(start, groupLength);
        newCatAccounts.splice(prevParentStart, 0, ...group);
      } else {
        const nextParentStart = end + 1;
        if (nextParentStart >= newCatAccounts.length) return;
        
        const [targetStart, targetEnd] = getSubtreeRange(nextParentStart);
        const group = newCatAccounts.splice(start, groupLength);
        const insertAt = targetEnd - groupLength + 1;
        newCatAccounts.splice(insertAt, 0, ...group);
      }

      setOrderedAccounts(prev => {
        const result: Account[] = [];
        let catIndex = 0;
        prev.forEach(acc => {
          if (acc.type === cat) {
            result.push(newCatAccounts[catIndex++]);
          } else {
            result.push(acc);
          }
        });
        return result;
      });
    }
  };

  const canMoveAccountUp = (cat: Account['type'], indexInCat: number) => {
    const catAccounts = orderedAccounts.filter(a => a.type === cat);
    const item = catAccounts[indexInCat];
    if (item.parentId) {
      return indexInCat > 0 && catAccounts[indexInCat - 1].parentId === item.parentId;
    }
    for (let i = indexInCat - 1; i >= 0; i--) {
      if (!catAccounts[i].parentId) return true;
    }
    return false;
  };

  const canMoveAccountDown = (cat: Account['type'], indexInCat: number) => {
    const catAccounts = orderedAccounts.filter(a => a.type === cat);
    const item = catAccounts[indexInCat];
    if (item.parentId) {
      return indexInCat < catAccounts.length - 1 && catAccounts[indexInCat + 1].parentId === item.parentId;
    }
    let endIdx = indexInCat;
    for (let i = indexInCat + 1; i < catAccounts.length; i++) {
      if (catAccounts[i].parentId === item.id) endIdx = i;
      else break;
    }
    return endIdx < catAccounts.length - 1;
  };

  const categoryUiConfig: Record<Account['type'], { label: string; bg: string; icon: string }> = {
    cash: { label: '現金', bg: 'bg-[#26A69A]', icon: '💵' },
    bank: { label: '銀行', bg: 'bg-[#42A5F5]', icon: '🏦' },
    credit: { label: '信用卡', bg: 'bg-[#EF5350]', icon: '💳' },
    'e-payment': { label: '電子支付', bg: 'bg-[#26C6DA]', icon: '📱' },
    'e-ticket': { label: '儲值卡', bg: 'bg-[#FFA726]', icon: '🚃' },
    investment: { label: '證券', bg: 'bg-[#78909C]', icon: '📈' },
    deposit: { label: '定存', bg: 'bg-[#9CCC65]', icon: '🏦' },
    insurance: { label: '保險', bg: 'bg-[#FF7043]', icon: '🛡️' },
    points: { label: '點數', bg: 'bg-[#FDD835]', icon: '⭐' },
    other: { label: '其他', bg: 'bg-[#8D6E63]', icon: '💼' }
  };

  const handleSave = () => {
    const finalOrderedAccounts: Account[] = [];
    
    categoryOrder.forEach(cat => {
      const catAccs = orderedAccounts.filter(a => a.type === cat);
      finalOrderedAccounts.push(...catAccs);
    });
    
    const savedAccounts = finalOrderedAccounts.map((acc, index) => ({
      ...acc,
      order: index
    }));
    
    onSave(savedAccounts);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#5D4037]/60 backdrop-blur-md z-[80] flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="bg-[#FFFDF5] w-full max-w-sm rounded-[44px] flex flex-col shadow-2xl border-4 border-white overflow-hidden max-h-[85vh]"
        style={getFontFamily()}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-8 pb-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
              <ChevronLeft className="w-6 h-6 text-[#5D4037]" />
            </button>
            <h3 className="text-2xl font-black text-[#5D4037]">帳戶類型排序</h3>
          </div>
          <div className="w-12 h-12 bg-[#FFD54F] rounded-2xl flex items-center justify-center shadow-md">
            <span className="text-xl font-bold text-[#5D4037]">☰↑</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 no-scrollbar">
          {categoryOrder.map((cat, index) => {
            const config = categoryUiConfig[cat];
            const catAccounts = orderedAccounts.filter(a => a.type === cat);
            const isExpanded = expandedCategories.includes(cat);
            const hasAccounts = catAccounts.length > 0;
            
            return (
              <div key={cat} className="flex flex-col gap-2">
                {/* Category Header Row */}
                <div className="flex items-center gap-3 p-4 bg-white rounded-3xl border-2 border-stone-50 shadow-sm transition-all hover:bg-stone-50/50">
                  {/* Category Icon */}
                  <div className={`w-12 h-12 rounded-full ${config.bg} flex items-center justify-center text-2xl shadow-sm text-white`}>
                    {config.icon}
                  </div>
                  
                  {/* Category Name & Toggle Arrow */}
                  <button 
                    onClick={() => toggleCategoryExpanded(cat)}
                    className="flex-1 flex items-center justify-between min-w-0 text-left font-black text-[#5D4037]"
                  >
                    <span className="text-base truncate">{config.label}</span>
                    <ChevronDown 
                      size={20} 
                      className={`text-[#5D4037]/60 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
                    />
                  </button>
                  
                  {/* Category Sorting Buttons */}
                  <div className="flex items-center gap-1 border-l border-stone-100 pl-2">
                    <button 
                      disabled={index === 0}
                      onClick={() => moveCategory(index, 'up')}
                      className="p-1 hover:bg-stone-100 rounded-lg text-stone-300 hover:text-[#5D4037] disabled:opacity-10 transition-all active:scale-75"
                    >
                      <ChevronUp size={20} />
                    </button>
                    <button 
                      disabled={index === categoryOrder.length - 1}
                      onClick={() => moveCategory(index, 'down')}
                      className="p-1 hover:bg-stone-100 rounded-lg text-stone-300 hover:text-[#5D4037] disabled:opacity-10 transition-all active:scale-75"
                    >
                      <ChevronDown size={20} />
                    </button>
                  </div>
                </div>
                
                {/* Expanded Account List */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden pl-4 pr-2 py-1 space-y-2 border-l-2 border-[#5D4037]/10 ml-6"
                    >
                      {hasAccounts ? (
                        catAccounts.map((acc, idx) => {
                          const isChild = !!acc.parentId;
                          return (
                            <div 
                              key={acc.id}
                              className={`flex items-center gap-3 p-3 bg-white/70 rounded-2xl border border-stone-100 shadow-sm transition-all group ${isChild ? 'ml-6 bg-white/40 scale-95' : ''}`}
                            >
                              <AccountIcon icon={acc.icon} sizeClassName="w-5 h-5" className="text-xl flex items-center justify-center" />
                              <div className="flex-1 min-w-0">
                                <span className="font-bold text-[#5D4037] text-sm truncate block">{acc.name}</span>
                              </div>
                              
                              {/* Account Sorting Buttons */}
                              <div className="flex items-center gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                                <button 
                                  disabled={!canMoveAccountUp(cat, idx)}
                                  onClick={() => moveAccountWithinCategory(cat, idx, 'up')}
                                  className="p-1 hover:bg-stone-50 rounded-lg text-stone-300 hover:text-[#5D4037] disabled:opacity-5 transition-all active:scale-75"
                                >
                                  <ChevronUp size={16} />
                                </button>
                                <button 
                                  disabled={!canMoveAccountDown(cat, idx)}
                                  onClick={() => moveAccountWithinCategory(cat, idx, 'down')}
                                  className="p-1 hover:bg-stone-50 rounded-lg text-stone-300 hover:text-[#5D4037] disabled:opacity-5 transition-all active:scale-75"
                                >
                                  <ChevronDown size={16} />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-stone-300 text-xs py-3 pl-2 italic">此類型暫無帳戶</div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
          <div className="h-6" />
        </div>

        <div className="p-8 pt-4 flex-shrink-0 bg-white/80 backdrop-blur-sm border-t border-stone-100">
          <button 
            onClick={handleSave}
            className="w-full py-5 bg-[#5D4037] text-white rounded-3xl font-black text-xl flex items-center justify-center gap-3 shadow-[0_10px_30px_-10px_rgba(93,64,55,0.4)] active:scale-95 transition-all"
          >
            <Check size={28} /> 完成排序
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function TemplateSortModal({ 
  templates, 
  onClose, 
  onSave 
}: { 
  templates: Template[], 
  onClose: () => void, 
  onSave: (newTemplates: Template[]) => void 
}) {
  const [items, setItems] = useState<Template[]>(() => {
    return [...templates].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  });

  const handleSave = () => {
    const updated = items.map((t, idx) => ({ ...t, order: idx }));
    onSave(updated);
    onClose();
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#5D4037]/40 backdrop-blur-md z-[100] flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="bg-[#FFFDF5] w-full max-w-sm rounded-[30px] shadow-2xl border-2 border-white overflow-hidden max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
        style={getFontFamily()}
      >
        <div className="p-6 pb-2 border-b border-stone-50 flex items-center justify-between shrink-0">
          <h3 className="text-xl font-black text-[#5D4037]">範本排序</h3>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
            <X size={20} className="text-stone-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest leading-none mb-2 px-1">
            按住右側圖示 ☰ 上下拖曳以排序
          </div>
          
          <Reorder.Group axis="y" values={items} onReorder={setItems} className="space-y-3">
            {items.map(t => (
              <Reorder.Item 
                key={t.id} 
                value={t}
                className="bg-white rounded-2xl border-2 border-stone-50 shadow-sm p-4 flex items-center gap-3 relative"
              >
                <div className={`w-10 h-10 ${t.color} rounded-xl flex items-center justify-center text-xl shadow-sm bg-[#FFFDF5]`}>
                  {t.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-base text-[#5D4037] truncate block">{t.name}</span>
                  <span className="text-xs text-stone-400 block">{t.type === 'transfer' ? '轉帳' : t.category}</span>
                </div>
                <div className="cursor-grab active:cursor-grabbing p-2 text-stone-300 hover:text-[#5D4037] transition-colors">
                  <GripVertical size={20} />
                </div>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        </div>

        <div className="p-6 border-t border-stone-50 bg-[#FFFDF5] shrink-0">
          <button 
            onClick={handleSave}
            className="w-full py-4 bg-[#5D4037] hover:bg-[#5D4037]/90 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"
          >
            <Check size={24} /> 完成排序
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ProjectSortModal({ projects, onClose, onSave }: {
  projects: Project[],
  onClose: () => void,
  onSave: (newOrder: Project[]) => void
}) {
  const [rootProjects, setRootProjects] = useState(() => 
    projects.filter(p => !p.parentId)
  );

  const [childProjectsMap, setChildProjectsMap] = useState<Record<string, Project[]>>(() => {
    const map: Record<string, Project[]> = {};
    projects.forEach(p => {
      if (p.parentId) {
        if (!map[p.parentId]) {
          map[p.parentId] = [];
        }
        map[p.parentId].push(p);
      }
    });
    return map;
  });

  const handleReorderChildren = (parentId: string, newChildren: Project[]) => {
    setChildProjectsMap(prev => ({
      ...prev,
      [parentId]: newChildren
    }));
  };

  const handleSave = () => {
    let currentOrder = 1;
    const finalProjects: Project[] = [];

    rootProjects.forEach(rp => {
      finalProjects.push({ ...rp, order: currentOrder++ });
      const children = childProjectsMap[rp.id] || [];
      children.forEach(cp => {
        finalProjects.push({ ...cp, order: currentOrder++ });
      });
    });

    projects.forEach(p => {
      if (!finalProjects.find(fp => fp.id === p.id)) {
        finalProjects.push({ ...p, order: currentOrder++ });
      }
    });

    onSave(finalProjects);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#5D4037]/60 backdrop-blur-md z-[80] flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="bg-[#FFFDF5] w-full max-w-sm rounded-[44px] flex flex-col shadow-2xl border-4 border-white overflow-hidden max-h-[85vh]"
        style={getFontFamily()}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-8 pb-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
              <ChevronLeft className="w-6 h-6 text-[#5D4037]" />
            </button>
            <h3 className="text-2xl font-black text-[#5D4037]">專案排序</h3>
          </div>
          <div className="w-12 h-12 bg-[#FFD54F] rounded-2xl flex items-center justify-center shadow-md">
            <Layers size={24} className="text-[#5D4037]" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest leading-none mb-2 px-1">
            按住右側圖示 ☰ 上下拖曳以排序
          </div>
          
          <Reorder.Group axis="y" values={rootProjects} onReorder={setRootProjects} className="space-y-4">
            {rootProjects.map(project => {
              const children = childProjectsMap[project.id] || [];
              return (
                <Reorder.Item 
                  key={project.id} 
                  value={project}
                  className="bg-white rounded-3xl border-2 border-stone-50 shadow-sm p-4 space-y-3 relative"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl border border-stone-50 shadow-sm bg-[#FFFDF5]">
                      <AccountIcon icon={project.icon || '📂'} sizeClassName="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] font-bold text-stone-300 uppercase tracking-widest leading-none block mb-1">
                        主專案
                      </span>
                      <span className="font-black text-base text-[#5D4037] truncate block">{project.name}</span>
                    </div>
                    <div className="cursor-grab active:cursor-grabbing p-2 text-stone-300 hover:text-[#5D4037] transition-colors">
                      <GripVertical size={20} />
                    </div>
                  </div>

                  {children.length > 0 && (
                    <div className="pl-6 pt-2 border-t border-stone-50 space-y-2">
                      <Reorder.Group 
                        axis="y" 
                        values={children} 
                        onReorder={(newChildren) => handleReorderChildren(project.id, newChildren)}
                        className="space-y-2"
                      >
                        {children.map(child => (
                          <Reorder.Item 
                            key={child.id} 
                            value={child}
                            className="flex items-center gap-3 p-3 bg-stone-50/70 rounded-2xl border border-stone-100/50 relative"
                          >
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base border border-stone-50 shadow-sm bg-white">
                              <AccountIcon icon={child.icon || '📄'} sizeClassName="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[8px] font-bold text-stone-300 uppercase tracking-widest leading-none block mb-0.5">
                                子專案
                              </span>
                              <span className="font-bold text-sm text-[#5D4037] truncate block">{child.name}</span>
                            </div>
                            <div className="cursor-grab active:cursor-grabbing p-1.5 text-stone-300 hover:text-[#5D4037] transition-colors">
                              <GripVertical size={16} />
                            </div>
                          </Reorder.Item>
                        ))}
                      </Reorder.Group>
                    </div>
                  )}
                </Reorder.Item>
              );
            })}
          </Reorder.Group>
          <div className="h-6" />
        </div>

        <div className="p-8 pt-4 flex-shrink-0 bg-white/80 backdrop-blur-sm border-t border-stone-100">
          <button 
            onClick={handleSave}
            className="w-full py-5 bg-[#5D4037] text-white rounded-3xl font-black text-xl flex items-center justify-center gap-3 shadow-[0_10px_30px_-10px_rgba(93,64,55,0.4)] active:scale-95 transition-all"
          >
            <Check size={28} /> 完成排序
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function YearMonthPickerModal({ 
  initialYear, 
  initialMonth, 
  onClose, 
  onSelect 
}: { 
  initialYear: number, 
  initialMonth: number, 
  onClose: () => void, 
  onSelect: (year: number, month: number) => void 
}) {
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#5D4037]/60 backdrop-blur-md z-[90] flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="bg-[#FFFDF5] w-full max-w-xs rounded-[44px] flex flex-col shadow-2xl border-4 border-white overflow-hidden p-6 gap-6"
        style={getFontFamily()}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0 px-2">
          <h3 className="text-xl font-black text-[#5D4037]">選擇年月</h3>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-[#5D4037]" />
          </button>
        </div>

        {/* Year Selector */}
        <div className="flex items-center justify-between bg-white/60 p-2 rounded-2xl border border-stone-100 shadow-inner">
          <button 
            onClick={() => setSelectedYear(prev => prev - 1)}
            className="w-10 h-10 flex items-center justify-center text-[#5D4037] hover:bg-stone-50 rounded-xl transition-colors active:scale-90"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-lg font-black text-[#5D4037] tracking-wider">{selectedYear} 年</span>
          <button 
            onClick={() => setSelectedYear(prev => prev + 1)}
            className="w-10 h-10 flex items-center justify-center text-[#5D4037] hover:bg-stone-50 rounded-xl transition-colors active:scale-90"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Month Selector Grid */}
        <div className="grid grid-cols-3 gap-3">
          {months.map(m => {
            const isSelected = selectedYear === initialYear && m === initialMonth;
            return (
              <button
                key={m}
                onClick={() => {
                  onSelect(selectedYear, m);
                  onClose();
                }}
                className={`py-3.5 rounded-2xl text-sm font-black transition-all active:scale-90 border-2 ${
                  isSelected 
                    ? 'bg-[#FFD54F] text-[#5D4037] border-[#FFD54F] shadow-md' 
                    : 'bg-white text-stone-500 border-stone-50 hover:bg-stone-50 shadow-sm'
                }`}
              >
                {m} 月
              </button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

function ProjectEditModal({ project, projects, onClose, onSave, onDelete }: { 
  project: Project, 
  projects: Project[],
  onClose: () => void, 
  onSave: (p: Project) => void,
  onDelete: (id: string) => void
}) {
  const [edited, setEdited] = useState<Project>({ ...project });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Eligible parents are projects that are not the current project and don't have a parent themselves (to simplify to 2 levels)
  // or just not the current project. The prompt suggests a 2-level structure ("主專案" and "子專案").
  const eligibleParents = projects.filter(p => p.id !== project.id && !p.parentId && p.id !== 'p1');

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
          setEdited(prev => ({ ...prev, icon: dataUrl }));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#5D4037]/60 backdrop-blur-md z-[80] flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="bg-[#FFFDF5] w-full max-w-sm rounded-[44px] flex flex-col shadow-2xl border-4 border-white overflow-hidden"
        style={getFontFamily()}
        onClick={e => e.stopPropagation()}
      >
        <AnimatePresence>
          {showDeleteConfirm && (
            <motion.div 
              initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }}
              className="absolute inset-0 bg-rose-500 z-[90] flex flex-col items-center justify-center p-8 text-white text-center gap-6"
            >
              <Trash2 size={64} className="mb-2" />
              <h4 className="text-2xl font-black">確定要刪除專案嗎？</h4>
              <p className="text-sm font-bold opacity-80 text-rose-100">刪除後將無法復原內容，現有交易紀錄的專案關聯將消失。</p>
              <div className="flex w-full gap-3 mt-4">
                <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-4 bg-white/20 rounded-2xl font-bold">取消</button>
                <button onClick={() => onDelete(project.id)} className="flex-1 py-4 bg-white text-rose-500 rounded-2xl font-black shadow-lg">確定刪除</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-8 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
              <ChevronLeft className="w-6 h-6 text-[#5D4037]" />
            </button>
            <h3 className="text-2xl font-black text-[#5D4037]">編輯專案</h3>
          </div>
          <button onClick={() => setShowDeleteConfirm(true)} className="p-3 text-rose-400 hover:bg-rose-50 rounded-2xl transition-colors">
            <Trash2 size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[60vh] p-8 pt-0 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-[#5D4037]/40 uppercase tracking-widest px-1">專案名稱</label>
            <input 
              value={edited.name}
              onChange={e => setEdited({ ...edited, name: e.target.value })}
              className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
              placeholder="輸入專案名稱..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-[#5D4037]/40 uppercase tracking-widest px-1">所屬主專案</label>
            <select 
              value={edited.parentId || ''}
              onChange={e => setEdited({ ...edited, parentId: e.target.value || undefined })}
              className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all appearance-none cursor-pointer"
            >
              <option value="">(無主專案)</option>
              {eligibleParents.map(p => {
                const displayIcon = p.icon && !(p.icon.startsWith('http') || p.icon.startsWith('data:image/') || p.icon.startsWith('/')) ? p.icon : '📂';
                return (
                  <option key={p.id} value={p.id}>{displayIcon} {p.name}</option>
                );
              })}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-[#5D4037]/40 uppercase tracking-widest px-1">自訂 Emoji</label>
            <input 
              type="text"
              placeholder="輸入 Emoji..."
              value={edited.icon && !(edited.icon.startsWith('http') || edited.icon.startsWith('data:image/') || edited.icon.startsWith('/')) ? edited.icon : ''}
              onChange={e => {
                const val = e.target.value;
                if (val === '') {
                  setEdited({ ...edited, icon: '' });
                } else {
                  // Simple logic to take the last character if it's an emoji-like input
                  setEdited({ ...edited, icon: val.slice(-2).trim() });
                }
              }}
              className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
              maxLength={2}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-[#5D4037]/40 uppercase tracking-widest px-1">專案圖示</label>
            <div className="grid grid-cols-5 gap-2">
              {/* Upload Custom Image Icon */}
              <div className="relative">
                <label className="w-12 h-12 rounded-2xl border-2 border-dashed bg-white border-stone-300 shadow-sm flex flex-col items-center justify-center cursor-pointer hover:bg-stone-50 transition-all active:scale-95">
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
              {edited.icon && (edited.icon.startsWith('data:image/') || edited.icon.startsWith('http') || edited.icon.startsWith('/')) && (
                <div className="relative w-12 h-12 rounded-2xl border-2 border-[#FFD54F] bg-white shadow-md flex items-center justify-center overflow-hidden">
                  <img src={edited.icon} className="w-full h-full object-contain p-1 select-none pointer-events-none" alt="custom-icon" />
                  <button 
                    type="button"
                    onClick={() => setEdited({ ...edited, icon: '📝' })}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center text-[8px] font-black shadow-sm"
                  >
                    ✕
                  </button>
                </div>
              )}

              {['📝', '✈️', '📱', '👗', '🏠', '💼', '🍱', '🍔', '🎨', '🎬', '🚆', '🚲', '🍕', '🍰', '☕', '🎸', '🎮', '💡', '🧼', '💊'].map(icon => (
                <button 
                   key={icon}
                  onClick={() => setEdited({ ...edited, icon })}
                  className={`w-12 h-12 rounded-2xl text-xl flex items-center justify-center transition-all ${edited.icon === icon ? 'bg-[#FFD54F] shadow-md scale-110' : 'bg-white border-2 border-stone-50 hover:bg-stone-50'}`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <button 
            onClick={() => onSave({ ...edited, icon: edited.icon.trim() || '📝' })}
            className="w-full py-5 bg-[#5D4037] text-white rounded-[24px] font-black text-[20px] flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all mt-4 sticky bottom-0"
          >
            <Check size={28} /> 儲存設定
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
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [newCat, setNewCat] = useState<Partial<Category>>({ name: '', icon: '✨', type: 'expense', sub: [] });
  
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [editingSubIndex, setEditingSubIndex] = useState<number | null>(null);
  

  const filtered = useMemo(() => {
    return categories
      .filter(c => c.type === tab)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [categories, tab]);

  const selectedCategory = useMemo(() => 
    categories.find(c => c.id === selectedCategoryId)
  , [categories, selectedCategoryId]);

  const moveCategory = (id: string, direction: 'up' | 'down') => {
    const idx = filtered.findIndex(c => c.id === id);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === filtered.length - 1) return;

    const otherIdx = direction === 'up' ? idx - 1 : idx + 1;
    const catA = filtered[idx];
    const catB = filtered[otherIdx];

    const updatedCategories = categories.map(c => {
      if (c.id === catA.id) return { ...c, order: otherIdx + 1 };
      if (c.id === catB.id) return { ...c, order: idx + 1 };
      // Also ensure others have an order if they don't
      if (c.type === tab && c.order === undefined) {
          const cIdx = filtered.findIndex(fc => fc.id === c.id);
          return { ...c, order: cIdx + 1 };
      }
      return c;
    });

    onSave(updatedCategories);
  };

  const moveSubByIndex = (catId: string, idx: number, direction: 'up' | 'down') => {
    const cat = categories.find(c => c.id === catId);
    if (!cat || !cat.sub) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === cat.sub.length - 1) return;

    const otherIdx = direction === 'up' ? idx - 1 : idx + 1;
    const newSub = [...cat.sub];
    [newSub[idx], newSub[otherIdx]] = [newSub[otherIdx], newSub[idx]];
    
    onSave(categories.map(c => c.id === catId ? { ...c, sub: newSub } : c));
  };

  const moveSubToCategory = (catId: string, subIdx: number, targetCatId: string) => {
    const sourceCat = categories.find(c => c.id === catId);
    if (!sourceCat) return;
    const subName = sourceCat.sub[subIdx];
    
    const updatedCategories = categories.map(c => {
      if (c.id === sourceCat.id) {
        return { ...c, sub: c.sub.filter((_, i) => i !== subIdx) };
      }
      if (c.id === targetCatId) {
        return { ...c, sub: [...c.sub, subName] };
      }
      return c;
    });

    onSave(updatedCategories);
    alert(`已將「${subName}」搬移至目標分類`);
  };

  useEffect(() => {
    const handleAdd = () => {
      if (selectedCategoryId) {
        setNewSubName('');
        setEditingSubIndex(null);
        setIsSubModalOpen(true);
      } else {
        setNewCat({ name: '', icon: '✨', type: tab, sub: [] });
        setEditingCat(null);
        setIsAddModalOpen(true);
      }
    };
    window.addEventListener('trigger-add-category', handleAdd);
    return () => window.removeEventListener('trigger-add-category', handleAdd);
  }, [tab, selectedCategoryId]);

  const handleSaveMainCategory = () => {
    if (!newCat.name) return;
    const catToSave = {
      id: editingCat?.id || `cat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: newCat.name,
      icon: newCat.icon || '✨',
      type: tab,
      sub: newCat.sub || [],
      order: editingCat?.order || (filtered.length + 1)
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

  const handleSaveSubCategory = () => {
    if (!newSubName || !selectedCategoryId) return;
    const cat = categories.find(c => c.id === selectedCategoryId);
    if (!cat) return;

    const currentSub = cat.sub || [];
    let updatedSub = [...currentSub];
    if (editingSubIndex !== null) {
      updatedSub[editingSubIndex] = newSubName;
    } else {
      updatedSub.push(newSubName);
    }
    
    onSave(categories.map(c => c.id === selectedCategoryId ? { ...c, sub: updatedSub } : c));
    setNewSubName('');
    setEditingSubIndex(null);
    setIsSubModalOpen(false);
  };

  const removeSubByIndex = (catId: string, index: number) => {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;
    if (window.confirm(`確定要刪除子分類「${cat.sub[index]}」嗎？`)) {
      onSave(categories.map(c => c.id === catId ? {
        ...c,
        sub: c.sub.filter((_, i) => i !== index)
      } : c));
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full bg-[#FFF9E3]"
      style={getFontFamily()}
    >
      {/* Header */}
      {!selectedCategoryId ? (
        <div className="p-6 pb-0 flex flex-col gap-6">
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
      ) : (
        <div className="p-6 py-4 flex items-center gap-4">
          <button 
            onClick={() => setSelectedCategoryId(null)}
            className="w-10 h-10 flex items-center justify-center bg-white rounded-2xl shadow-sm border border-stone-100 text-[#5D4037]"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex flex-col">
            <h2 className="text-xl font-black text-[#5D4037] flex items-center gap-2">
              <span className="text-2xl w-8 h-8 flex items-center justify-center overflow-hidden shrink-0">
                {selectedCategory && <AccountIcon icon={selectedCategory.icon} sizeClassName="w-7 h-7" />}
              </span>
              {selectedCategory?.name}
            </h2>
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest leading-none mt-0.5">管理子分類</span>
          </div>
        </div>
      )}

      {/* List Content */}
      <div className="flex-1 overflow-y-auto px-6 space-y-3 pb-24 pt-4">
        {!selectedCategoryId ? (
          filtered.map(cat => (
            <div 
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id)}
              className="bg-white p-4 rounded-[25px] border-2 border-white shadow-sm flex flex-col md:flex-row md:items-center md:justify-between group gap-4 md:gap-0 cursor-pointer hover:border-[#FFD54F] transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#FFFDF5] rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-stone-50 shrink-0 overflow-hidden">
                  <AccountIcon icon={cat.icon} sizeClassName="w-8 h-8" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-black text-[#5D4037] text-lg md:text-base truncate break-all leading-tight">{cat.name}</span>
                  <span className="text-xs md:text-[10px] font-bold text-stone-400 md:text-stone-300 uppercase tracking-widest truncate mt-0.5">
                    {cat.sub.length} 個子分類
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          selectedCategory?.sub.map((sub, idx) => (
            <div 
              key={`${selectedCategoryId}-${idx}`}
              className="flex items-center justify-between bg-white p-4 md:p-3 rounded-[25px] border-2 border-white shadow-sm group"
            >
              <div className="flex flex-col min-w-0">
                <span className="font-black text-[#5D4037] text-lg md:text-sm truncate break-all leading-tight">{sub}</span>
                <span className="text-xs md:text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-0.5">歸類於 {selectedCategory.name}</span>
              </div>
            </div>
          ))
        )}
        {(selectedCategoryId && (!selectedCategory?.sub || selectedCategory.sub.length === 0)) && (
          <div className="text-center py-12 bg-white/30 rounded-[30px] border-2 border-dashed border-white">
            <span className="text-stone-400 font-bold">目前無子分類</span>
          </div>
        )}
      </div>

      {/* Floating Add Button for Detail View */}
      {selectedCategoryId && (
        <div className="fixed bottom-24 right-6 left-6 flex justify-center z-40">
          <button 
            onClick={() => { setNewSubName(''); setEditingSubIndex(null); setIsSubModalOpen(true); }}
            className="w-full max-w-sm py-4 bg-[#FFD54F] text-[#5D4037] rounded-[25px] font-black shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Plus size={24} /> 新增子分類
          </button>
        </div>
      )}

      {/* Main Category Modal */}
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
                <h3 className="text-xl font-black text-[#5D4037]">{editingCat ? '編輯主分類' : '新增主分類'}</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                  <X size={20} className="text-stone-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 pt-2 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">主分類名稱</label>
                  <input 
                    value={newCat.name}
                    onChange={e => setNewCat({ ...newCat, name: e.target.value })}
                    className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                    placeholder="輸入主分類名稱"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">主分類圖示</label>
                  
                  {/* 自訂 Emoji 輸入框 */}
                  <div className="mb-4">
                    <input 
                      type="text"
                      placeholder="自訂輸入 Emoji..."
                      value={newCat.icon && !(newCat.icon.startsWith('http') || newCat.icon.startsWith('data:image/') || newCat.icon.startsWith('/')) ? newCat.icon : ''}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '') {
                          setNewCat(prev => ({ ...prev, icon: '' }));
                        } else {
                          setNewCat(prev => ({ ...prev, icon: val.slice(-2).trim() }));
                        }
                      }}
                      className="w-full p-3 bg-white border border-stone-200 rounded-xl font-bold text-sm text-[#5D4037] outline-none focus:border-[#FFD54F]"
                      maxLength={2}
                    />
                  </div>

                  <div className="grid grid-cols-6 gap-2">
                    {/* 上傳圖片按鈕 */}
                    <div className="relative">
                      <label className="w-10 h-10 rounded-xl border border-dashed bg-white border-stone-300 shadow-sm flex flex-col items-center justify-center cursor-pointer hover:bg-stone-50 transition-all active:scale-95">
                        <Upload size={14} className="text-stone-400" />
                        <span className="text-[8px] font-bold text-stone-400 mt-0.5" style={getFontFamily()}>上傳</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 500 * 1024) {
                              alert("上傳圖片大小不能超過 500KB！");
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const base64 = event.target?.result as string;
                              if (base64) {
                                setNewCat(prev => ({ ...prev, icon: base64 }));
                              }
                            };
                            reader.readAsDataURL(file);
                          }} 
                          className="hidden" 
                        />
                      </label>
                    </div>

                    {/* 自訂圖片預覽 */}
                    {newCat.icon && (newCat.icon.startsWith('data:image/') || newCat.icon.startsWith('http') || newCat.icon.startsWith('/')) && (
                      <div className="relative w-10 h-10 rounded-xl border-2 border-[#FFD54F] bg-white shadow-md flex items-center justify-center overflow-hidden">
                        <img src={newCat.icon} className="w-full h-full object-contain p-0.5 select-none pointer-events-none" alt="custom-icon" />
                        <button 
                          type="button"
                          onClick={() => setNewCat(prev => ({ ...prev, icon: '✨' }))}
                          className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[8px] font-black shadow-sm"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    {['🍱', '🚗', '🛍️', '🎮', '🏠', '🏥', '✨', '💼', '📈', '🍔', '☕', '🎬', '💊', '🎁', '💡', '📚', '⚽'].map(icon => (
                      <button 
                        key={icon}
                        onClick={() => setNewCat(prev => ({ ...prev, icon }))}
                        className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center text-xl transition-all ${newCat.icon === icon ? 'bg-[#FFD54F] border-[#FFD54F] shadow-md scale-110' : 'bg-white border-stone-50 shadow-sm'}`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-8 pt-4">
                <button 
                  onClick={handleSaveMainCategory}
                  className="w-full py-5 bg-[#5D4037] text-white rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Check size={20} /> 儲存設定
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sub-category Detail/Name Modal */}
      

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
              <div className="flex items-center justify-between">
                <h4 className="font-black text-[#5D4037]">{editingSubIndex !== null ? '編輯子分類' : '新增子分類'}</h4>
                <button onClick={() => { setIsSubModalOpen(false); setEditingSubIndex(null); }} className="p-1 hover:bg-stone-50 rounded-full transition-colors">
                  <X size={18} className="text-stone-400" />
                </button>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">名稱</label>
                <input 
                  autoFocus
                  value={newSubName}
                  onChange={e => setNewSubName(e.target.value)}
                  className="w-full p-3 bg-stone-50 rounded-xl font-bold text-[#5D4037] outline-none border-2 border-transparent focus:border-[#FFD54F] text-sm"
                  placeholder="輸入名稱..."
                />
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setIsSubModalOpen(false)}
                  className="flex-1 py-3 bg-stone-100 text-stone-400 rounded-xl font-black text-sm"
                >
                  取消
                </button>
                <button 
                  onClick={handleSaveSubCategory}
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


function CategoryManagePage({ categories, onSave, onBack, onMoveSubCategory }: { 
  categories: Category[], 
  onSave: (cats: Category[]) => void,
  onBack: () => void,
  onMoveSubCategory: (subName: string, fromCatName: string, toCatName: string) => Promise<void>
}) {
  const [tab, setTab] = useState<'expense' | 'income'>('expense');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [newCat, setNewCat] = useState<Partial<Category>>({ name: '', icon: '✨', type: 'expense', sub: [] });
  
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [editingSubIndex, setEditingSubIndex] = useState<number | null>(null);
  const [movingSub, setMovingSub] = useState<{ catId: string; subName: string; index: number } | null>(null);

  const filtered = useMemo(() => {
    return categories
      .filter(c => c.type === tab)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [categories, tab]);

  const selectedCategory = useMemo(() => 
    categories.find(c => c.id === selectedCategoryId)
  , [categories, selectedCategoryId]);

  const moveCategory = (id: string, direction: 'up' | 'down') => {
    const idx = filtered.findIndex(c => c.id === id);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === filtered.length - 1) return;

    const otherIdx = direction === 'up' ? idx - 1 : idx + 1;
    const catA = filtered[idx];
    const catB = filtered[otherIdx];

    const updatedCategories = categories.map(c => {
      if (c.id === catA.id) return { ...c, order: otherIdx + 1 };
      if (c.id === catB.id) return { ...c, order: idx + 1 };
      return c;
    });

    onSave(updatedCategories);
  };

  const moveSubByIndex = (catId: string, idx: number, direction: 'up' | 'down') => {
    const cat = categories.find(c => c.id === catId);
    if (!cat || !cat.sub) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === cat.sub.length - 1) return;

    const otherIdx = direction === 'up' ? idx - 1 : idx + 1;
    const newSub = [...cat.sub];
    [newSub[idx], newSub[otherIdx]] = [newSub[otherIdx], newSub[idx]];
    
    onSave(categories.map(c => c.id === catId ? { ...c, sub: newSub } : c));
  };

  const handleSaveMainCategory = () => {
    if (!newCat.name) return;
    const catToSave = {
      id: editingCat?.id || `cat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: newCat.name,
      icon: newCat.icon || '✨',
      type: tab,
      sub: newCat.sub || [],
      order: editingCat?.order || (filtered.length + 1)
    } as Category;

    if (editingCat) {
      onSave(categories.map(c => c.id === editingCat.id ? catToSave : c));
    } else {
      onSave([...categories, catToSave]);
    }
    setIsAddModalOpen(false);
    setEditingCat(null);
  };

  const handleSaveSubCategory = () => {
    if (!newSubName || !selectedCategoryId) return;
    const currentSub = selectedCategory?.sub || [];
    let updatedSub = [...currentSub];
    if (editingSubIndex !== null) {
      updatedSub[editingSubIndex] = newSubName;
    } else {
      updatedSub.push(newSubName);
    }
    
    onSave(categories.map(c => c.id === selectedCategoryId ? { ...c, sub: updatedSub } : c));
    setIsSubModalOpen(false);
  };

  const removeSubByIndex = (catId: string, index: number) => {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;
    if (window.confirm(`確定要刪除子分類「${cat.sub[index]}」嗎？`)) {
      onSave(categories.map(c => c.id === catId ? {
        ...c,
        sub: c.sub.filter((_, i) => i !== index)
      } : c));
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full bg-[#FFF9E3]"
      style={getFontFamily()}
    >
      <div className="p-6 pb-0 flex flex-col gap-6">
        <div className="flex bg-white/50 p-1.5 rounded-2xl border-2 border-white shadow-sm">
          {(['expense', 'income'] as const).map(t => (
            <button 
              key={t}
              onClick={() => { setTab(t); setSelectedCategoryId(null); }}
              className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${tab === t ? 'bg-[#5D4037] text-white shadow-md' : 'text-stone-400'}`}
            >
              {t === 'expense' ? '支出管理' : '收入管理'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 space-y-3 pb-24 pt-4">
        {!selectedCategoryId ? (
          filtered.map(cat => (
            <div 
              key={cat.id}
              className="bg-white p-4 rounded-[25px] border-2 border-white shadow-sm flex flex-col md:flex-row md:items-center md:justify-between group gap-4 md:gap-0"
            >
              <div className="flex items-center gap-4 cursor-pointer" onClick={() => setSelectedCategoryId(cat.id)}>
                <div className="w-12 h-12 bg-[#FFFDF5] rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-stone-50 shrink-0 overflow-hidden">
                  <AccountIcon icon={cat.icon} sizeClassName="w-8 h-8" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-black text-[#5D4037] text-lg md:text-base truncate break-all leading-tight">{cat.name}</span>
                  <span className="text-xs md:text-[10px] font-bold text-stone-400 md:text-stone-300 uppercase tracking-widest truncate mt-0.5">
                    {cat.sub.length} 個子分類 (點擊管理)
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 md:gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-stone-50 justify-between md:justify-end">
                <div className="flex items-center bg-stone-50 rounded-xl p-1">
                  <button 
                    onClick={() => moveCategory(cat.id, 'up')}
                    disabled={filtered.indexOf(cat) === 0}
                    className="p-2 md:p-1 hover:bg-white rounded-md text-stone-300 hover:text-[#5D4037] disabled:opacity-30"
                  >
                    <ChevronUp size={20} className="md:w-3.5 md:h-3.5" />
                  </button>
                  <button 
                    onClick={() => moveCategory(cat.id, 'down')}
                    disabled={filtered.indexOf(cat) === filtered.length - 1}
                    className="p-2 md:p-1 hover:bg-white rounded-md text-stone-300 hover:text-[#5D4037] disabled:opacity-30"
                  >
                    <ChevronDown size={20} className="md:w-3.5 md:h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => { setEditingCat(cat); setNewCat(cat); setIsAddModalOpen(true); }}
                    className="p-3 md:p-2 hover:bg-stone-50 rounded-xl text-stone-300 hover:text-[#5D4037] transition-all"
                  >
                    <Pencil size={20} className="md:w-[18px] md:h-[18px]" />
                  </button>
                  <button 
                    onClick={() => {
                      if (window.confirm(`刪除主分類「${cat.name}」將同時刪除其下的所有子分類，是否確認？`)) {
                        onSave(categories.filter(c => c.id !== cat.id));
                      }
                    }}
                    className="p-3 md:p-2 hover:bg-rose-50 rounded-xl text-stone-200 hover:text-rose-400 transition-all"
                  >
                    <Trash2 size={20} className="md:w-[18px] md:h-[18px]" />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="space-y-3">
             <button onClick={() => setSelectedCategoryId(null)} className="flex items-center gap-2 text-[#5D4037] font-bold text-sm mb-4">
                <ChevronLeft size={16} /> 返回主分類列表
             </button>
             <h3 className="font-black text-xl text-[#5D4037] mb-4 flex items-center gap-2">
                <span>{selectedCategory?.icon}</span>
                {selectedCategory?.name} - 子分類管理
             </h3>
             {selectedCategory?.sub.map((sub, idx) => (
               <div 
                 key={`${selectedCategoryId}-${idx}`}
                 className="flex items-center justify-between bg-white p-4 md:p-3 rounded-[25px] border-2 border-white shadow-sm"
               >
                 <div className="flex flex-col min-w-0">
                   <span className="font-black text-[#5D4037] text-lg md:text-sm truncate break-all leading-tight">{sub}</span>
                 </div>
                 <div className="flex items-center gap-4 md:gap-1">
                   <div className="flex items-center bg-stone-50 rounded-xl p-1">
                     <button 
                       onClick={() => moveSubByIndex(selectedCategoryId, idx, 'up')}
                       disabled={idx === 0}
                       className="p-2 md:p-1 hover:bg-white rounded text-stone-300 hover:text-[#5D4037] disabled:opacity-30"
                     >
                       <ChevronUp size={20} className="md:w-3.5 md:h-3.5" />
                     </button>
                     <button 
                       onClick={() => moveSubByIndex(selectedCategoryId, idx, 'down')}
                       disabled={idx === (selectedCategory.sub?.length || 0) - 1}
                       className="p-2 md:p-1 hover:bg-white rounded text-stone-300 hover:text-[#5D4037] disabled:opacity-30"
                     >
                       <ChevronDown size={20} className="md:w-3.5 md:h-3.5" />
                     </button>
                   </div>
                   <button 
                     onClick={() => setMovingSub({ catId: selectedCategoryId, subName: sub, index: idx })}
                     className="p-3 md:p-2 hover:bg-stone-50 rounded-xl text-stone-300 hover:text-[#5D4037] transition-all"
                     title="搬移子分類"
                   >
                     <ArrowRightLeft size={20} className="md:w-[18px] md:h-[18px]" />
                   </button>
                   <button 
                     onClick={() => { setNewSubName(sub); setEditingSubIndex(idx); setIsSubModalOpen(true); }}
                     className="p-3 md:p-2 hover:bg-stone-50 rounded-xl text-stone-300 hover:text-[#5D4037]"
                   >
                     <Pencil size={20} className="md:w-[18px] md:h-[18px]" />
                   </button>
                   <button 
                     onClick={() => removeSubByIndex(selectedCategoryId, idx)}
                     className="p-3 md:p-2 hover:bg-rose-50 rounded-xl text-stone-200 hover:text-rose-400"
                   >
                     <Trash2 size={20} className="md:w-[18px] md:h-[18px]" />
                   </button>
                 </div>
               </div>
             ))}
             <button 
               onClick={() => { setNewSubName(''); setEditingSubIndex(null); setIsSubModalOpen(true); }}
               className="w-full py-4 border-2 border-dashed border-stone-200 rounded-[25px] text-stone-400 font-bold hover:bg-white transition-all flex items-center justify-center gap-2"
             >
               <Plus size={20} /> 新增子分類
             </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#5D4037]/40 backdrop-blur-md" onClick={() => setIsAddModalOpen(false)} />
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} 
              className="relative bg-[#FFFDF5] w-full max-w-sm rounded-[40px] shadow-2xl border-2 border-white overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-8 pb-4 flex items-center justify-between">
                <h3 className="text-xl font-black text-[#5D4037]">{editingCat ? '編輯主分類' : '新增主分類'}</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                  <X size={20} className="text-stone-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 pt-2 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">名稱</label>
                  <input value={newCat.name} onChange={e => setNewCat({ ...newCat, name: e.target.value })} className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]" placeholder="輸入主分類名稱" />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">主分類圖示</label>
                  
                  {/* 自訂 Emoji 輸入框 */}
                  <div className="mb-4">
                    <input 
                      type="text"
                      placeholder="自訂輸入 Emoji..."
                      value={newCat.icon && !(newCat.icon.startsWith('http') || newCat.icon.startsWith('data:image/') || newCat.icon.startsWith('/')) ? newCat.icon : ''}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '') {
                          setNewCat(prev => ({ ...prev, icon: '' }));
                        } else {
                          setNewCat(prev => ({ ...prev, icon: val.slice(-2).trim() }));
                        }
                      }}
                      className="w-full p-3 bg-white border border-stone-200 rounded-xl font-bold text-sm text-[#5D4037] outline-none focus:border-[#FFD54F]"
                      maxLength={2}
                    />
                  </div>

                  <div className="grid grid-cols-6 gap-2">
                    {/* 上傳圖片按鈕 */}
                    <div className="relative">
                      <label className="w-10 h-10 rounded-xl border border-dashed bg-white border-stone-300 shadow-sm flex flex-col items-center justify-center cursor-pointer hover:bg-stone-50 transition-all active:scale-95">
                        <Upload size={14} className="text-stone-400" />
                        <span className="text-[8px] font-bold text-stone-400 mt-0.5" style={getFontFamily()}>上傳</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 500 * 1024) {
                              alert("上傳圖片大小不能超過 500KB！");
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const base64 = event.target?.result as string;
                              if (base64) {
                                setNewCat(prev => ({ ...prev, icon: base64 }));
                              }
                            };
                            reader.readAsDataURL(file);
                          }} 
                          className="hidden" 
                        />
                      </label>
                    </div>

                    {/* 自訂圖片預覽 */}
                    {newCat.icon && (newCat.icon.startsWith('data:image/') || newCat.icon.startsWith('http') || newCat.icon.startsWith('/')) && (
                      <div className="relative w-10 h-10 rounded-xl border-2 border-[#FFD54F] bg-white shadow-md flex items-center justify-center overflow-hidden">
                        <img src={newCat.icon} className="w-full h-full object-contain p-0.5 select-none pointer-events-none" alt="custom-icon" />
                        <button 
                          type="button"
                          onClick={() => setNewCat(prev => ({ ...prev, icon: '✨' }))}
                          className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[8px] font-black shadow-sm"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    {['🍱', '🚗', '🛍️', '🎮', '🏠', '🏥', '✨', '💼', '📈', '🍔', '☕', '🎬', '💊', '🎁', '💡', '📚', '⚽'].map(icon => (
                      <button 
                        key={icon}
                        onClick={() => setNewCat(prev => ({ ...prev, icon }))}
                        className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center text-xl transition-all ${newCat.icon === icon ? 'bg-[#FFD54F] border-[#FFD54F] shadow-md scale-110' : 'bg-white border-stone-50 shadow-sm'}`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-8 pt-4">
                <button onClick={handleSaveMainCategory} className="w-full py-5 bg-[#5D4037] text-white rounded-2xl font-black shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                  <Check size={20} /> 儲存設定
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

            {/* Move Sub-category Modal */}
      <AnimatePresence>
        {movingSub && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-[#5D4037]/40 backdrop-blur-md" 
              onClick={() => setMovingSub(null)} 
            />
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} 
              className="relative bg-[#FFFDF5] w-full max-w-sm rounded-[40px] shadow-2xl border-2 border-white overflow-hidden flex flex-col max-h-[70vh]"
            >
              <div className="p-6 pb-2 flex items-center justify-between border-b border-stone-100">
                <div className="flex flex-col">
                  <h3 className="text-lg font-black text-[#5D4037]" style={getFontFamily()}>搬移子分類</h3>
                  <span className="text-[11px] font-bold text-stone-400 mt-0.5">移動「{movingSub.subName}」至其他主分類</span>
                </div>
                <button onClick={() => setMovingSub(null)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                  <X size={18} className="text-stone-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-2">
                {categories
                  .filter(c => c.type === tab && c.id !== movingSub.catId)
                  .map(targetCat => (
                    <button
                      key={targetCat.id}
                      onClick={async () => {
                        const targetHasSub = targetCat.sub && targetCat.sub.includes(movingSub.subName);
                        if (targetHasSub) {
                          alert(`主分類「${targetCat.name}」下已存在名為「${movingSub.subName}」的子分類！`);
                          return;
                        }
                        
                        const confirmMove = window.confirm(`確認將「${movingSub.subName}」搬移到「${targetCat.name}」下嗎？這將會自動更新所有相關記帳明細。`);
                        if (!confirmMove) return;
                        
                        try {
                          await onMoveSubCategory(movingSub.subName, selectedCategory!.name, targetCat.name);
                          setMovingSub(null);
                        } catch (err) {
                          alert("子分類搬移失敗，請重試。");
                        }
                      }}
                      className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm hover:border-[#FFD54F] transition-all flex items-center gap-3 active:scale-98 text-left"
                    >
                      <div className="w-8 h-8 bg-stone-50 rounded-lg flex items-center justify-center text-lg overflow-hidden shrink-0">
                        <AccountIcon icon={targetCat.icon} sizeClassName="w-5 h-5" />
                      </div>
                      <span className="font-black text-sm text-[#5D4037]" style={getFontFamily()}>{targetCat.name}</span>
                    </button>
                  ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSubModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#5D4037]/20 backdrop-blur-sm" onClick={() => setIsSubModalOpen(false)} />
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="relative bg-white w-full max-w-[280px] rounded-[30px] shadow-2xl p-6 space-y-6">
              <h4 className="font-black text-[#5D4037]">{editingSubIndex !== null ? '編輯子分類' : '新增子分類'}</h4>
              <input autoFocus value={newSubName} onChange={e => setNewSubName(e.target.value)} className="w-full p-3 bg-stone-50 rounded-xl font-bold text-[#5D4037] outline-none border-2 border-transparent focus:border-[#FFD54F] text-sm" placeholder="輸入名稱..." />
              <div className="flex gap-3">
                <button onClick={() => setIsSubModalOpen(false)} className="flex-1 py-3 bg-stone-100 text-stone-400 rounded-xl font-black text-sm">取消</button>
                <button onClick={handleSaveSubCategory} className="flex-1 py-3 bg-[#5D4037] text-white rounded-xl font-black text-sm shadow-lg">確定</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function InstallmentManagementPage({ records, onDeleteGroup, onEarlySettlement }: { 
  records: Transaction[], 
  onDeleteGroup: (groupId: string) => void,
  onEarlySettlement: (groupId: string, remainingAmount: number, firstRecord: Transaction) => void
}) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSettleConfirmOpen, setIsSettleConfirmOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [settleInfo, setSettleInfo] = useState<{ amount: number, first: Transaction } | null>(null);

  const installmentGroups = useMemo(() => {
    const groups: { [key: string]: Transaction[] } = {};
    records.forEach(r => {
      if (r.isInstallment && r.installmentGroupId) {
        if (!groups[r.installmentGroupId]) groups[r.installmentGroupId] = [];
        groups[r.installmentGroupId].push(r);
      }
    });
    return Object.values(groups).sort((a, b) => b[0].date.localeCompare(a[0].date));
  }, [records]);

  const handleDelete = () => {
    if (selectedGroupId) {
      onDeleteGroup(selectedGroupId);
      setIsConfirmOpen(false);
      setSelectedGroupId(null);
    }
  };

  const handleEarlySettlementAction = () => {
    if (selectedGroupId && settleInfo) {
      onEarlySettlement(selectedGroupId, settleInfo.amount, settleInfo.first);
      setIsSettleConfirmOpen(false);
      setSelectedGroupId(null);
      setSettleInfo(null);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full bg-[#FFF9E3]"
    >
      <div className="flex-1 overflow-y-auto px-6 space-y-4 pb-24 pt-4">
        {installmentGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <div className="w-20 h-20 bg-white rounded-[30px] flex items-center justify-center text-stone-200 shadow-sm">
              <CreditCard size={40} />
            </div>
            <p className="text-stone-300 font-bold">目前沒有進行中的分期項目</p>
          </div>
        ) : (
          installmentGroups.map(group => {
            const first = group[0];
            const isSettled = first.status === 'settled' || group.some(r => r.isCompleted);
            const totalAmount = first.amount * (first.totalInstallments || 1);
            const perAmount = first.amount;
            const total = first.totalInstallments || 1;
            
            const today = new Date().toISOString().split('T')[0];
            const paidCount = isSettled ? total : group.filter(r => (r.postingDate || r.date) <= today).length;
            const progress = (paidCount / total) * 100;

            return (
              <div 
                key={first.installmentGroupId}
                className="bg-white p-6 rounded-[30px] border-2 border-white shadow-sm space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xl font-black text-[#5D4037]">{first.note?.split(' (分期')[0]}</span>
                    <span className="text-[10px] font-bold text-stone-300 uppercase tracking-widest">
                      起始日：{first.date.replace(/-/g, '/')}
                    </span>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedGroupId(first.installmentGroupId!);
                      setIsConfirmOpen(true);
                    }}
                    className="p-2 text-stone-200 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 size={24} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-stone-300">總金額</span>
                    <span className="text-[18px] font-black text-[#E91E63]">
                      ${totalAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-stone-300">每期金額</span>
                    <span className="text-[18px] font-black text-[#E91E63]">
                      ${perAmount.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-300">還款進度</span>
                    <span className="text-sm font-black text-[#5D4037]">
                      {isSettled ? `第 ${total} / ${total} 期 (已結清)` : `第 ${paidCount} / ${total} 期`}
                    </span>
                  </div>
                  <div className="h-3 bg-stone-50 rounded-full overflow-hidden border border-stone-100 shadow-inner">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="h-full rounded-full bg-[#FFD54F]"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  {isSettled ? (
                    <div className="w-full py-3 bg-[#FFD54F]/10 text-[#5D4037] rounded-xl font-bold text-sm text-center border border-[#FFD54F]/20">
                      ✅ 已提前結清
                    </div>
                  ) : (
                    <button 
                      onClick={() => {
                        const today = new Date().toISOString().split('T')[0];
                        const unpaidRecords = group.filter(r => r.date > today);
                        const remainingAmount = unpaidRecords.reduce((sum, r) => sum + r.amount, 0);
                        
                        if (remainingAmount <= 0) {
                          alert('此分期已無剩餘未付金額！');
                          return;
                        }

                        setSelectedGroupId(first.installmentGroupId!);
                        setSettleInfo({ amount: remainingAmount, first: first });
                        setIsSettleConfirmOpen(true);
                      }}
                      className="w-full py-3 bg-stone-50 text-[#5D4037] rounded-xl font-bold text-sm hover:bg-[#FFD54F]/20 transition-colors"
                    >
                      提前結清
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <AnimatePresence>
        {isConfirmOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsConfirmOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#FFF9E3] w-full max-w-sm rounded-[40px] p-8 shadow-2xl relative z-10 border-2 border-white"
            >
              <h3 className="text-xl font-black text-[#5D4037] text-center mb-4">確定要刪除這筆分期付款嗎？</h3>
              <p className="text-stone-400 font-bold text-center mb-8">刪除後將無法恢復所有相關紀錄。</p>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setIsConfirmOpen(false)}
                  className="py-4 bg-white text-stone-400 rounded-2xl font-black shadow-sm"
                >
                  取消
                </button>
                <button 
                  onClick={handleDelete}
                  className="py-4 bg-[#5D4037] text-white rounded-2xl font-black shadow-lg shadow-stone-200"
                >
                  確定
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSettleConfirmOpen && settleInfo && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsSettleConfirmOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#FFF9E3] w-full max-sm rounded-[40px] p-8 shadow-2xl relative z-10 border-2 border-white"
            >
              <h3 className="text-xl font-black text-[#5D4037] text-center mb-4">提前結清確認</h3>
              <p className="text-stone-400 font-bold text-center mb-8">確定要提前結清剩餘的 ${settleInfo.amount.toLocaleString()} 元嗎？這將會一次性入帳並結束此分期計畫。</p>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setIsSettleConfirmOpen(false)}
                  className="py-4 bg-white text-stone-400 rounded-2xl font-black shadow-sm"
                >
                  取消
                </button>
                <button 
                  onClick={handleEarlySettlementAction}
                  className="py-4 bg-[#5D4037] text-white rounded-2xl font-black shadow-lg shadow-stone-200"
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

function ProjectsView({ projects, records, onProjectClick, onEditProject, onBack }: { 
  projects: Project[], 
  records: Transaction[], 
  onProjectClick: (id: string) => void,
  onEditProject: (p: Project) => void,
  onBack: () => void 
}) {
  const getProjectStats = (projectId: string): { expense: number, income: number } => {
    // Support hierarchical summation
    const childProjectIds = projects.filter(p => p.parentId === projectId).map(p => p.id);
    const allIds = [projectId, ...childProjectIds];

    const targetRecords = records.filter(r => {
      const rPid = r.projectId || 'p1';
      if (projectId === 'p1') {
        return !r.projectId || allIds.includes(r.projectId);
      }
      return allIds.includes(r.projectId || '');
    });

    const expense = targetRecords.filter(r => r.type === 'expense').reduce((sum, r) => sum + (r.amount + (r.fee || 0)), 0);
    const income = targetRecords.filter(r => r.type === 'income').reduce((sum, r) => sum + r.amount, 0);
    return { expense, income };
  };

  // Group projects into a tree
  const rootProjects = projects.filter(p => !p.parentId);
  const getChildren = (parentId: string) => projects.filter(p => p.parentId === parentId);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full bg-white shadow-inner"
      style={getFontFamily()}
    >
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-stone-100">
          {rootProjects.map(project => {
            const children = getChildren(project.id);
            return (
              <React.Fragment key={project.id}>
                <ProjectItem 
                  project={project} 
                  stats={getProjectStats(project.id)} 
                  onProjectClick={onProjectClick} 
                  onEditProject={onEditProject}
                />
                {children.map(child => (
                  <ProjectItem 
                    key={child.id}
                    project={child} 
                    stats={getProjectStats(child.id)} 
                    onProjectClick={onProjectClick} 
                    onEditProject={onEditProject}
                    isChild
                  />
                ))}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

function ProjectItem({ project, stats, onProjectClick, onEditProject, isChild }: {
  project: Project,
  stats: { expense: number, income: number },
  onProjectClick: (id: string) => void,
  onEditProject: (p: Project) => void,
  isChild?: boolean,
  key?: React.Key
}) {
  const isDefault = project.id === 'p1';
  return (
    <div 
      onClick={() => onProjectClick(project.id)}
      className={`flex items-center gap-4 py-4 active:bg-stone-50 transition-colors cursor-pointer group ${isChild ? 'pl-12 pr-4' : 'px-4'}`}
    >
      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-sm ${
        isChild ? 'scale-90 opacity-80' : ''
      } ${
        project.name === '追星' ? 'bg-blue-400' : 
        project.name === '買手機的錢' ? 'bg-red-400' :
        project.name === '頭髮' ? 'bg-pink-400' :
        project.name === '弟弟' ? 'bg-orange-400' :
        project.name === '利息' ? 'bg-green-400' : 'bg-blue-400'
      } text-white transition-transform group-active:scale-95`}>
        <AccountIcon icon={project.icon} sizeClassName="w-7 h-7" />
      </div>
      <div className="flex-1 flex flex-col">
        <span className={`font-bold text-[#5D4037] ${isChild ? 'text-[15px]' : 'text-[17px]'}`}>{project.name}</span>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-[15px] font-bold text-rose-400">${stats.expense.toLocaleString()}</div>
          <div className="text-[15px] font-bold text-blue-400">${stats.income.toLocaleString()}</div>
        </div>
        
        {!isDefault && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onEditProject(project);
            }}
            className="p-2 text-stone-300 hover:text-[#5D4037] transition-colors"
          >
            <Settings2 size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

function ProjectDetailView({ project, records, accounts, categories, projects, onBack, onUpdateRecord, onDeleteRecord, onAddRecord }: { 
  project: Project, 
  records: Transaction[], 
  accounts: Account[], 
  categories: Category[],
  projects: Project[],
  onBack: () => void,
  onUpdateRecord: (oldRec: Transaction, newRec: Transaction) => void,
  onDeleteRecord: (rec: Transaction) => void,
  onAddRecord: () => void
}) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [editingRecord, setEditingRecord] = useState<Transaction | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const monthRangeLabel = useMemo(() => {
    const [y, m] = currentMonth.split('/').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    const format = (d: Date) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    return `${format(start)} - ${format(end)}`;
  }, [currentMonth]);

  const filteredRecords = useMemo(() => {
    const [y, m] = currentMonth.split('/').map(Number);
    const raw = records.filter(r => {
      const isProject = project.id === 'p1' ? (!r.projectId || r.projectId === 'p1') : r.projectId === project.id;
      if (!isProject) return false;
      const pDate = r.postingDate || r.date;
      const d = new Date(pDate);
      return d.getFullYear() === y && (d.getMonth() + 1) === m;
    });
    const merged = getMergedRecords(raw, accounts);
    return merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [records, project, currentMonth, accounts]);

  const balance = useMemo(() => {
    const expense = filteredRecords.filter(r => r.type === 'expense' && r.postingDate).reduce((sum, r) => sum + Math.abs(r.amount), 0);
    const income = filteredRecords.filter(r => r.type === 'income' && r.postingDate).reduce((sum, r) => sum + Math.abs(r.amount), 0);
    return income - expense;
  }, [filteredRecords]);

  // Group by date (using consumption date for daily view rhythm)
  const groupedRecords = useMemo(() => {
    const groups: { date: string, weekday: string, records: Transaction[] }[] = [];
    filteredRecords.forEach(r => {
      const d = new Date(r.date);
      const dateLabel = r.date.replace(/-/g, '/');
      const weekday = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][d.getDay()];
      let group = groups.find(g => g.date === dateLabel);
      if (!group) {
        group = { date: dateLabel, weekday, records: [] };
        groups.push(group);
      }
      group.records.push(r);
    });
    return groups;
  }, [filteredRecords]);

  const handlePrevMonth = () => {
    const [y, m] = currentMonth.split('/').map(Number);
    const prev = new Date(y, m - 2, 1);
    setCurrentMonth(`${prev.getFullYear()}/${String(prev.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [y, m] = currentMonth.split('/').map(Number);
    const next = new Date(y, m, 1);
    setCurrentMonth(`${next.getFullYear()}/${String(next.getMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full bg-white"
      style={getFontFamily()}
    >
      {/* Month Switcher */}
      <div className="flex items-center justify-between px-6 py-4 bg-[#FFF9E3]/30">
        <button onClick={handlePrevMonth} className="p-2 text-[#5D4037]"><ChevronLeft size={24} /></button>
        <button 
          onClick={() => setIsDatePickerOpen(true)}
          className="text-lg font-bold text-[#5D4037] px-3 py-1 hover:bg-white/40 active:scale-95 rounded-xl transition-all"
        >
          {monthRangeLabel}
        </button>
        <button onClick={handleNextMonth} className="p-2 text-[#5D4037]"><ChevronRight size={24} /></button>
      </div>

      {/* Stats Summary */}
      <div className="flex justify-between px-6 py-2 border-b border-stone-50 text-sm font-bold text-stone-500">
        <span>項目：{filteredRecords.length} 筆</span>
        <span>結餘：<span className={balance >= 0 ? 'text-blue-600' : 'text-red-500'}>${balance < 0 ? '-' : ''}{Math.abs(balance).toLocaleString()}</span></span>
      </div>

      <div className="flex-1 overflow-y-auto relative">
        {groupedRecords.map(group => (
          <div key={group.date} className="mt-4">
            <div className="px-6 py-2 text-[15px] font-bold text-stone-400 border-b border-stone-50">
              {group.date} {group.weekday}
            </div>
            <div className="divide-y divide-stone-50">
              {group.records.map(record => {
                const recordAccount = accounts.find(a => a.id === record.accountId);
                return (
                <div 
                  key={record.id} 
                  onClick={() => setEditingRecord(record)}
                  className="flex items-center gap-4 px-6 py-3 cursor-pointer active:bg-stone-50 transition-colors" 
                  style={getFontFamily()}
                >
                  <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-xl">
                    {getCategoryIcon(record.category, record.type, categories)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                       <div className="text-[17px] font-bold text-[#5D4037] truncate" style={getFontFamily()}>
                         {getTransactionTitle(record)}
                       </div>
                       {recordAccount?.type === 'credit' && (!record.postingDate || record.isPending) && (
                         <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-500 rounded font-bold">未入帳</span>
                       )}
                       {record.transferredDate && (
                         <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-600 rounded font-bold">已轉帳</span>
                       )}
                    </div>
                    {record.type === 'transfer' ? (
                      (() => {
                        const isPos = record.amount > 0;
                        const currentAccName = accounts.find(a => a.id === record.accountId)?.name || '未知帳戶';
                        const counterpartAccName = accounts.find(a => a.id === record.toAccountId)?.name || '未知帳戶';
                        const firstAccName = isPos ? counterpartAccName : currentAccName;
                        const secondAccName = isPos ? currentAccName : counterpartAccName;
                        const displayDate = record.postingDate || record.date;
                        return (
                          <div className="flex flex-col gap-0.5 mt-0.5">
                            {/* Line 2: Account A ➔ Account B */}
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#5D4037]" style={getFontFamily()}>
                              <span className="opacity-80" style={getFontFamily()}>{firstAccName}</span>
                              <span className="text-amber-600 font-bold" style={getFontFamily()}>➔</span>
                              <span className="opacity-80 font-black text-amber-800" style={getFontFamily()}>{secondAccName}</span>
                              {record.transferredDate && (
                                <span className="text-[10px] px-1 py-0.5 bg-emerald-100 text-emerald-600 rounded font-bold ml-1">已轉帳</span>
                              )}
                            </div>
                            {/* Line 3: Date as subtext YYYY-MM-DD */}
                            <span className="text-[11px] font-medium text-stone-400" style={getFontFamily()}>
                              入帳日期: {displayDate}
                            </span>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="text-[12px] font-medium text-stone-300 truncate font-bold">
                        {(record.note || '詳細資訊...').replace(/\[固定收支\]/g, '').trim()}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end">
                    <div className={`text-[17px] font-bold ${
                      (record.type === 'transfer' || record._isMergedTransfer) ? (record.amount < 0 ? 'text-[#E91E63]' : 'text-[#03A9F4]') :
                      record.type === 'income' ? 'text-[#03A9F4]' : 'text-[#E91E63]'
                    }`} style={getFontFamily()}>
                      {((record.type === 'transfer' || record._isMergedTransfer) ? (record.amount < 0 ? '-' : '+') : record.type === 'income' ? '+' : '-')}${Math.abs(record.amount).toLocaleString()}
                    </div>
                    {(() => {
                      const twdText = getTwdEquivalentText(records, accounts, record);
                      return twdText ? (
                        <span className="text-[11px] text-stone-400 font-bold" style={getFontFamily()}>{twdText}</span>
                      ) : null;
                    })()}
                  </div>
                </div>
              );})}
            </div>
          </div>
        ))}
        
        {/* Floating Add Button for Project */}
        <button 
          onClick={onAddRecord}
          className="fixed bottom-24 right-6 w-14 h-14 bg-[#5D4037] text-white rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-all z-10"
        >
          <Plus size={32} />
        </button>
      </div>

      <AnimatePresence>
        {editingRecord && (
          <EditRecordModal 
            record={editingRecord}
            accounts={accounts}
            projects={projects}
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

      <AnimatePresence>
        {isDatePickerOpen && (
          (() => {
            const [y, m] = currentMonth.split('/').map(Number);
            return (
              <YearMonthPickerModal 
                initialYear={y}
                initialMonth={m}
                onClose={() => setIsDatePickerOpen(false)}
                onSelect={(year, month) => {
                  setCurrentMonth(`${year}/${String(month).padStart(2, '0')}`);
                }}
              />
            );
          })()
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function BudgetManagementPage({
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
        return pDate.startsWith(monthStr) && r.category !== '初始資金' && r.type === 'expense';
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
      if (pDate.startsWith(monthStr) && r.category !== '初始資金' && r.type === 'expense') {
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
        if (r.type !== 'expense') return false;
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
        if (r.type !== 'expense') return false;
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

function PlaceholderView({ title, icon, onBack, content }: { title: string, icon: React.ReactNode, onBack: () => void, content?: React.ReactNode }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
      className="flex flex-col h-full bg-[#FFF9E3]"
      style={getFontFamily()}
    >
      <div className="flex-1 overflow-y-auto px-4 py-10">
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
          
          {content}

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

function HistoryView({ records, accounts, categories, projects, filter, currencyMode, onBack, onUpdateRecord, onDeleteRecord, onReorder }: { 
  records: Transaction[], 
  accounts: Account[], 
  categories: Category[],
  projects: Project[],
  filter: { type: 'day' | 'week' | 'month' | 'year', date: string },
  currencyMode: CurrencyMode,
  onBack: () => void,
  onUpdateRecord: (old: Transaction, updated: Transaction) => void,
  onDeleteRecord: (record: Transaction) => void,
  onReorder: (records: Transaction[]) => void
}) {
  const [editingRecord, setEditingRecord] = useState<Transaction | null>(null);

  const filteredRecords = useMemo(() => {
    const base = parseLocalDate(filter.date);
    const start = new Date(base);
    const end = new Date(base);

    if (filter.type === 'day') {
      // Already set to base
    } else if (filter.type === 'week') {
      // Standardize to Monday-start to match HomeView stats
      const day = base.getDay();
      const diff = base.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
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

    const raw = records.filter(r => {
      const pDate = r.postingDate || r.date;
      const passDate = r.category !== '初始資金' && pDate >= startStr && pDate <= endStr;
      if (!passDate) return false;

      // Currency filtering
      const cur = r.currency || 'TWD';
      if (currencyMode === 'FOREIGN') return cur !== 'TWD';
      // If mode is TWD or null (Taiwan), show only TWD
      return cur === 'TWD';
    });

    const merged = getMergedRecords(raw, accounts);

    return merged.sort((a, b) => {
      const dateDiff = b.date.localeCompare(a.date);
      if (dateDiff !== 0) return dateDiff;
      return b.amount - a.amount;
    });
  }, [records, filter, currencyMode, accounts]);

  const filterLabel = useMemo(() => {
    if (filter.type === 'day') return filter.date.replace(/-/g, '/');
    if (filter.type === 'week') return '本週明細';
    if (filter.type === 'month') return '本月明細';
    if (filter.type === 'year') return '本年明細';
    return '';
  }, [filter]);

  const historyBalance = useMemo(() => {
    return filteredRecords.reduce((acc, r) => {
      if (r.type === 'income' || r.type === 'expense') return acc + r.amount;
      return acc;
    }, 0);
  }, [filteredRecords]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full bg-[#FFF9E3]"
    >
      <div className="flex-1 px-4 overflow-y-auto pb-10 pt-4">
        {/* Period Summary Header */}
        <div className="mx-2 mb-4 p-4 bg-[#FFFDF5] rounded-3xl border border-[#FFD54F]/30 flex items-center justify-between text-[13px] font-black text-[#5D4037] shadow-sm" style={getFontFamily()}>
          <div className="flex items-center gap-2">
            <CalendarIcon size={14} className="text-[#FFD54F]" />
            <span>{filterLabel}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-white/50 px-2 py-0.5 rounded-lg border border-[#FFD54F]/10">{filteredRecords.length} 筆紀錄</span>
            <span>結餘：<span className={historyBalance >= 0 ? 'text-blue-600' : 'text-red-500'}>${Math.abs(historyBalance).toLocaleString()}</span></span>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-[40px] shadow-sm border-2 border-white p-6 space-y-4">
          {filteredRecords.length > 0 ? filteredRecords.map((record, idx) => (
            <div 
              key={record.id} 
              className="flex items-center gap-2 py-4 border-b border-stone-50 last:border-0 group rounded-xl px-2 -mx-2 transition-colors relative"
            >
              <div 
                onClick={() => setEditingRecord(record)}
                className="flex-1 flex items-center gap-4 cursor-pointer"
              >
                <div className="w-14 h-14 bg-[#FFFDF5] rounded-2xl flex-shrink-0 flex items-center justify-center text-2xl shadow-sm border border-white">
                  {getCategoryIcon(record.category, record.type, categories)}
                </div>
                
                <div className="flex-1 flex flex-col gap-1 min-w-0">
                <span className="font-black text-lg text-[#5D4037] whitespace-pre-wrap break-all leading-tight" style={getFontFamily()}>
                  {getTransactionTitle(record)}
                </span>
                {record.type === 'transfer' ? (
                  (() => {
                    const isPos = record.amount > 0;
                    const currentAccName = accounts.find(a => a.id === record.accountId)?.name || '未知帳戶';
                    const counterpartAccName = accounts.find(a => a.id === record.toAccountId)?.name || '未知帳戶';
                    const firstAccName = isPos ? counterpartAccName : currentAccName;
                    const secondAccName = isPos ? currentAccName : counterpartAccName;
                    const displayDate = record.postingDate || record.date;
                    return (
                      <div className="flex flex-col gap-0.5">
                        {/* Line 2: Account A ➔ Account B */}
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#5D4037]" style={getFontFamily()}>
                          <span className="opacity-80" style={getFontFamily()}>{firstAccName}</span>
                          <span className="text-amber-600 font-bold" style={getFontFamily()}>➔</span>
                          <span className="opacity-80 font-black text-amber-800" style={getFontFamily()}>{secondAccName}</span>
                          {record.transferredDate && (
                            <span className="text-[10px] px-1 py-0.5 bg-emerald-100 text-emerald-600 rounded font-bold ml-1">已轉帳</span>
                          )}
                        </div>
                        {/* Line 3: Date as subtext YYYY-MM-DD */}
                        <span className="text-[11px] font-medium text-stone-400" style={getFontFamily()}>
                          入帳日期: {displayDate}
                        </span>
                      </div>
                    );
                  })()
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-300">
                      {record.postingDate ? `入帳: ${record.postingDate}` : `消費: ${record.date}`}
                    </span>
                  {(() => {
                    const acc = accounts.find(a => a.id === record.accountId);
                    return acc?.type === 'credit' && (!record.postingDate || record.isPending);
                  })() && (
                    <span className="text-[10px] px-2 py-0.5 bg-orange-100 text-orange-500 rounded-full font-bold">
                      未入帳
                    </span>
                  )}
                  {record.transferredDate && (
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded-full font-bold">
                      已轉帳
                    </span>
                  )}
                  <span className="text-[10px] px-2 py-0.5 bg-stone-100 text-stone-400 rounded-full font-bold" style={getFontFamily()}>
                    {accounts.find(a => a.id === record.accountId)?.name}
                  </span>
                </div>
                )}
                <div className="flex items-baseline justify-between mt-1 flex-wrap">
                  <span className={`font-black text-xl ${
                    (record.type === 'transfer' || record._isMergedTransfer) ? (record.amount < 0 ? 'text-[#E91E63]' : 'text-[#03A9F4]') :
                    record.type === 'income' ? 'text-[#03A9F4]' :
                    record.type === 'expense' ? 'text-[#E91E63]' : 'text-stone-400'
                  }`} style={getFontFamily()}>
                    {((record.type === 'transfer' || record._isMergedTransfer) ? (record.amount < 0 ? '-' : '+') : record.type === 'income' ? '+' : record.type === 'expense' ? '-' : '')} $ {Math.abs(record.amount).toLocaleString()}
                  </span>
                  {(() => {
                    const twdText = getTwdEquivalentText(records, accounts, record);
                    return twdText ? (
                      <span className="text-[11px] text-stone-400 font-bold" style={getFontFamily()}>{twdText}</span>
                    ) : null;
                  })()}
                </div>
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
            projects={projects}
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

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const categoryColor = payload[0].color || '#FFD54F';
    return (
      <div 
        className="bg-white/95 backdrop-blur-md border-2 p-2.5 rounded-2xl shadow-xl flex items-center gap-2 pointer-events-none"
        style={{
          borderColor: categoryColor,
          boxShadow: '0 10px 25px -5px rgba(93, 64, 55, 0.25)',
          ...getFontFamily()
        }}
      >
        <div 
          className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
          style={{ backgroundColor: categoryColor }}
        />
        <div 
          className="flex items-center gap-1.5 text-xs font-black text-[#5D4037]" 
          style={{ textShadow: '1px 1px 2px rgba(93,64,55,0.15)' }}
        >
          <span>{data.name}</span>
          <span className="text-stone-300 font-normal">:</span>
          <span className="text-sm font-black text-[#5D4037]">${data.value.toLocaleString()}</span>
        </div>
      </div>
    );
  }
  return null;
};

function ReportsView({ records, projects, categories }: { 
  records: Transaction[], 
  projects: Project[], 
  categories: Category[] 
}) {
  const [dateRange, setDateRange] = useState<'thisMonth' | 'last3Months' | 'last6Months' | 'lastYear'>('thisMonth');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [activeSector, setActiveSector] = useState<any>(null);
  
  const COLORS = ['#FFD54F', '#FFAB91', '#81C784', '#90CAF9', '#CE93D8', '#BCAAA4', '#B0BEC5', '#FFCCBC', '#C5E1A5', '#FFF59D'];

  const filteredByProject = useMemo(() => {
    if (selectedProjectId === 'all') return records;
    return records.filter(r => r.projectId === selectedProjectId);
  }, [records, selectedProjectId]);

  const dateInterval = useMemo(() => {
    const now = new Date();
    let start = startOfMonth(now);
    let end = endOfMonth(now);

    if (dateRange === 'last3Months') start = subMonths(startOfMonth(now), 2);
    if (dateRange === 'last6Months') start = subMonths(startOfMonth(now), 5);
    if (dateRange === 'lastYear') start = subMonths(startOfMonth(now), 11);

    return { start, end };
  }, [dateRange]);

  const stats = useMemo(() => {
    const periodRecords = filteredByProject.filter(r => {
      const d = parseISO(r.postingDate || r.date);
      return d >= dateInterval.start && d <= dateInterval.end;
    });

    const income = periodRecords.filter(r => r.type === 'income').reduce((s, r) => s + Math.abs(r.amount), 0);
    const expense = periodRecords.filter(r => r.type === 'expense').reduce((s, r) => s + (Math.abs(r.amount) + (r.fee || 0)), 0);
    
    // Category Pie Data
    const catMap: Record<string, number> = {};
    periodRecords.filter(r => r.type === 'expense').forEach(r => {
      const cat = r.category.split(' > ')[0];
      catMap[cat] = (catMap[cat] || 0) + (Math.abs(r.amount) + (r.fee || 0));
    });
    
    const pieData = Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Trend Data
    const months = eachMonthOfInterval({ start: dateInterval.start, end: dateInterval.end });
    const trendData = months.map(m => {
      const mStr = format(m, 'yyyy-MM');
      const mRecords = periodRecords.filter(r => (r.postingDate || r.date).startsWith(mStr));
      return {
        name: format(m, 'MMM'),
        fullName: format(m, 'yyyy/MM'),
        income: mRecords.filter(r => r.type === 'income').reduce((s, r) => s + Math.abs(r.amount), 0),
        expense: mRecords.filter(r => r.type === 'expense').reduce((s, r) => s + (Math.abs(r.amount) + (r.fee || 0)), 0),
      };
    });

    return { income, expense, balance: income - expense, pieData, trendData };
  }, [filteredByProject, dateInterval]);

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex-1 flex flex-col gap-6 px-4 py-8 bg-[#FFF9E3]/30 min-h-full pb-24 overflow-y-auto"
      style={getFontFamily()}
    >
      {/* Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex bg-white/60 p-1 rounded-2xl border border-stone-100 shadow-sm overflow-x-auto">
          {(['thisMonth', 'last3Months', 'last6Months', 'lastYear'] as const).map(range => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`flex-1 min-w-[80px] py-2 px-3 rounded-xl text-xs font-black transition-all ${dateRange === range ? 'bg-[#FFD54F] text-[#5D4037] shadow-md' : 'text-stone-400 hover:text-stone-600'}`}
            >
              {range === 'thisMonth' ? '本月' : range === 'last3Months' ? '近三月' : range === 'last6Months' ? '近半年' : '近一年'}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-3 overflow-x-auto py-1">
          <button
            onClick={() => setSelectedProjectId('all')}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-black transition-all border ${selectedProjectId === 'all' ? 'bg-[#5D4037] text-[#FFFDF5] border-[#5D4037]' : 'bg-white text-stone-500 border-stone-100'}`}
          >
            全部分類
          </button>
          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedProjectId(p.id)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-black transition-all border flex items-center gap-2 ${selectedProjectId === p.id ? 'bg-[#FFD54F] text-[#5D4037] border-[#FFD54F]' : 'bg-white text-stone-500 border-stone-100'}`}
            >
              <AccountIcon icon={p.icon} sizeClassName="w-4 h-4" />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-stone-50 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-blue-400">
            <div className="w-5 h-5 rounded-lg bg-blue-50 flex items-center justify-center">
              <Plus size={12} strokeWidth={3} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">總收入</span>
          </div>
          <span className="text-xl font-black text-blue-600">${stats.income.toLocaleString()}</span>
        </div>
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-stone-50 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-rose-400">
            <div className="w-5 h-5 rounded-lg bg-rose-50 flex items-center justify-center">
              <div className="w-2.5 h-0.5 bg-rose-400 rounded-full" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">總支出</span>
          </div>
          <span className="text-xl font-black text-rose-600">${stats.expense.toLocaleString()}</span>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-[40px] p-8 shadow-sm border border-stone-50">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-base font-black text-[#5D4037]">支出分析</h3>
            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mt-1">Expense Breakdown</p>
          </div>
        </div>
        
        <div className="h-[300px] w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <RePieChart>
              <Pie
                data={stats.pieData}
                innerRadius={80}
                outerRadius={110}
                paddingAngle={8}
                dataKey="value"
                stroke="none"
                onMouseEnter={(data) => setActiveSector(data)}
                onMouseLeave={() => setActiveSector(null)}
                onClick={(data) => setActiveSector(data)}
              >
                {stats.pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                content={<CustomTooltip />}
                position={(() => {
                  if (!activeSector || typeof activeSector.cx === 'undefined') return undefined;
                  const { cx, cy, midAngle, outerRadius } = activeSector;
                  const radian = -midAngle * (Math.PI / 180);
                  
                  // 圓環外半徑是 110px，所以把貼齊邊緣半徑設為 120px
                  const targetRadius = 120;
                  const tx = cx + Math.cos(radian) * targetRadius;
                  const ty = cy + Math.sin(radian) * targetRadius;
                  
                  // 定義 Tooltip 估算寬高 (此尺寸適用於分類與金額字數長度)
                  const tooltipWidth = 130;
                  const tooltipHeight = 40;
                  
                  // 使用平滑邊界貼齊插值公式，確保在任何角度下，Tooltip 的外邊界都剛好外切於 targetRadius
                  const x = tx - (tooltipWidth * (1 - Math.cos(radian))) / 2;
                  const y = ty - (tooltipHeight * (1 - Math.sin(radian))) / 2;
                  
                  return { x, y };
                })()}
              />
            </RePieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">總支出</span>
            <span className="text-2xl font-black text-[#5D4037]">${stats.expense.toLocaleString()}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-8">
          {stats.pieData.map((entry, index) => (
            <div key={entry.name} className="flex items-center justify-between p-3 bg-stone-50 rounded-2xl">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-xs font-bold text-[#5D4037] truncate">{entry.name}</span>
              </div>
              <span className="text-[10px] font-black text-stone-400">{((entry.value / stats.expense) * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="h-[60px]" />
    </motion.div>
  );
}

function MoreView({ 
  records, 
  accounts, 
  installments, 
  projects,
  categories,
  templates,
  fixedRecords,
  user,
  onForceSync,
  setRecords, 
  setAccounts,
  setInstallments,
  setProjects,
  setTemplates,
  setFixedRecords,
  onUpdateTemplates,
  onUpdateCategories
}: { 
  records: Transaction[], 
  accounts: Account[], 
  installments: Installment[],
  projects: Project[],
  categories: Category[],
  templates: Template[],
  fixedRecords: FixedRecord[],
  user: User | null,
  onForceSync: () => Promise<boolean | undefined>,
  setRecords: (r: Transaction[]) => void,
  setAccounts: React.Dispatch<React.SetStateAction<Account[]>>,
  setInstallments: (i: Installment[]) => void,
  setProjects: (p: Project[]) => void,
  setTemplates: (t: Template[]) => void,
  setFixedRecords: (fr: FixedRecord[]) => void,
  onUpdateTemplates: (t: Template[]) => void,
  onUpdateCategories: (c: Category[]) => void
}) {
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [importPreview, setImportPreview] = useState<{ transactions: Transaction[], total: number } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [cloudBackups, setCloudBackups] = useState<any[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);

  const fetchCloudBackups = async () => {
    if (!user) return;
    setIsLoadingBackups(true);
    try {
      const snapshot = await getDocs(collection(db, 'users', user.uid, 'backups'));
      const list = snapshot.docs.map(doc => doc.data());
      list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      setCloudBackups(list);
    } catch (err) {
      console.error('Failed to fetch backups:', err);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  useEffect(() => {
    if (showSyncModal && user) {
      fetchCloudBackups();
    }
  }, [showSyncModal, user]);

  const handleRestoreSpecificBackup = async (backup: any) => {
    const confirm = window.confirm(`確定要還原此備份版本嗎？\\n(版本時間：${new Date(backup.timestamp).toLocaleString()})\\n這將會取代您目前的本地與雲端主資料庫資料！`);
    if (!confirm) return;

    setIsSyncing(true);
    try {
      // Update local states
      setRecords(backup.records || []);
      setAccounts((backup.accounts || []).sort((a, b) => (a.order || 0) - (b.order || 0)));
      if (backup.categories && backup.categories.length > 0) {
        onUpdateCategories(backup.categories);
      }
      setProjects(backup.projects || []);
      setFixedRecords(backup.fixedRecords || []);
      setInstallments(backup.installments || []);
      setTemplates(backup.templates || []);

      // Clear main Firestore collections and write the backup data
      const collectionsToClear = ['transactions', 'accounts', 'projects', 'categories', 'fixedRecords', 'installments', 'templates'];
      const deleteBatch = writeBatch(db);
      
      for (const colName of collectionsToClear) {
        const snap = await getDocs(collection(db, 'users', user.uid, colName));
        snap.docs.forEach(doc => {
          deleteBatch.delete(doc.ref);
        });
      }
      await deleteBatch.commit();

      const writeBatchObj = writeBatch(db);
      (backup.records || []).forEach((item) => {
        writeBatchObj.set(doc(db, 'users', user.uid, 'transactions', item.id), cleanData(item));
      });
      (backup.accounts || []).forEach((item) => {
        writeBatchObj.set(doc(db, 'users', user.uid, 'accounts', item.id), cleanData(item));
      });
      (backup.categories || []).forEach((item) => {
        writeBatchObj.set(doc(db, 'users', user.uid, 'categories', item.id), cleanData(item));
      });
      (backup.projects || []).forEach((item) => {
        writeBatchObj.set(doc(db, 'users', user.uid, 'projects', item.id), cleanData(item));
      });
      (backup.fixedRecords || []).forEach((item) => {
        writeBatchObj.set(doc(db, 'users', user.uid, 'fixedRecords', item.id), cleanData(item));
      });
      (backup.installments || []).forEach((item) => {
        writeBatchObj.set(doc(db, 'users', user.uid, 'installments', item.id), cleanData(item));
      });
      (backup.templates || []).forEach((item) => {
        writeBatchObj.set(doc(db, 'users', user.uid, 'templates', item.id), cleanData(item));
      });
      
      if (backup.monthlyBudget) {
        writeBatchObj.set(doc(db, 'users', user.uid), { monthlyBudget: backup.monthlyBudget }, { merge: true });
      }

      await writeBatchObj.commit();
      alert('已成功將資料庫恢復至指定備份版本！');
      fetchCloudBackups();
    } catch (err) {
      console.error('Failed to restore cloud backup:', err);
      alert('還原失敗，請檢查網路連線。');
    } finally {
      setIsSyncing(false);
    }
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dangerAction, setDangerAction] = useState<'date' | 'account' | null>(null);
  const [deleteStartDate, setDeleteStartDate] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  });
  const [deleteEndDate, setDeleteEndDate] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [selectedDeleteAccountId, setSelectedDeleteAccountId] = useState<string>('');
  const [deleteAccountMode, setDeleteAccountMode] = useState<'clearOnly' | 'deleteFull'>('clearOnly');

  const [activeImportTab, setActiveImportTab] = useState<'unique' | 'duplicates'>('unique');

  const importClassification = useMemo(() => {
    if (!importPreview) return { unique: [], duplicates: [] };

    const existingAccountNamesMap = new Map<string, string>();
    accounts.forEach(a => {
      existingAccountNamesMap.set(a.name.trim(), a.id);
      existingAccountNamesMap.set(a.name.trim().toLowerCase(), a.id);
    });

    const existingProjectNamesMap = new Map<string, string>();
    projects.forEach(p => {
      existingProjectNamesMap.set(p.name.trim().toLowerCase(), p.id);
    });

    const cleanAccName = (s: string) => {
      return String(s).replace(/\s+/g, '').replace(/[-_@()（）]/g, '').trim().toLowerCase();
    };

    const findExistingAccountId = (nameText: string) => {
      const cleaned = cleanAccName(nameText);
      const acc = accounts.find(a => cleanAccName(a.name) === cleaned);
      return acc?.id;
    };

    const unique: Transaction[] = [];
    const duplicates: Transaction[] = [];
    const currentRecords = [...records];

    importPreview.transactions.forEach(imported => {
      const mainRawName = imported._importMainAccountName?.trim();
      const sourceName = imported._importSourceAccountName?.trim();
      const destName = imported._importDestAccountName?.trim();
      const importProjName = imported._importProjectName?.trim();

      const getMappedAccountId = (nameText: string | undefined, defaultId: string) => {
        if (!nameText || nameText === '-') return defaultId;
        const trimmed = nameText.trim();
        const target = existingAccountNamesMap.get(trimmed) || 
                       existingAccountNamesMap.get(trimmed.toLowerCase()) || 
                       findExistingAccountId(trimmed);
        return target || defaultId;
      };

      let resolvedAccountId = imported.accountId;
      let resolvedToAccountId = imported.toAccountId;

      if (mainRawName && mainRawName !== '-') {
        resolvedAccountId = getMappedAccountId(mainRawName, imported.accountId);
        if (imported.type === 'transfer') {
          let targetName = '';
          if (sourceName && sourceName !== '-' && sourceName !== mainRawName) {
            targetName = sourceName;
          } else if (destName && destName !== '-' && destName !== mainRawName) {
            targetName = destName;
          }
          if (targetName) {
            resolvedToAccountId = getMappedAccountId(targetName, imported.toAccountId || '');
          } else {
            resolvedToAccountId = imported.toAccountId;
          }
        } else {
          resolvedToAccountId = undefined;
        }
      } else {
        if (imported.type === 'income') {
          resolvedAccountId = (destName && destName !== '-') ? getMappedAccountId(destName, imported.accountId) : 
                             ((sourceName && sourceName !== '-') ? getMappedAccountId(sourceName, imported.accountId) : imported.accountId);
          resolvedToAccountId = undefined;
        } else if (imported.type === 'expense') {
          resolvedAccountId = (sourceName && sourceName !== '-') ? getMappedAccountId(sourceName, imported.accountId) : imported.accountId;
          resolvedToAccountId = undefined;
        } else if (imported.type === 'transfer') {
          const isPos = imported.amount > 0;
          const mainName = isPos ? destName : sourceName;
          const targetName = isPos ? sourceName : destName;

          resolvedAccountId = (mainName && mainName !== '-') ? getMappedAccountId(mainName, imported.accountId) : imported.accountId;
          resolvedToAccountId = (targetName && targetName !== '-') ? getMappedAccountId(targetName, imported.toAccountId || '') : imported.toAccountId;
        }
      }

      if (imported.type === 'transfer') {
        if (!resolvedAccountId) {
          resolvedAccountId = accounts[0]?.id || 'cash';
        }
        if (!resolvedToAccountId) {
          const sibling = accounts.find(a => a.id !== resolvedAccountId);
          resolvedToAccountId = sibling?.id || '';
        }
      }

      let resolvedProjectId = imported.projectId;
      if (importProjName) {
         const projNameToFind = importProjName.includes(' > ') ? importProjName.split(' > ').pop() : importProjName;
         if (projNameToFind) {
           resolvedProjectId = existingProjectNamesMap.get(projNameToFind.trim().toLowerCase()) || imported.projectId;
         }
      }

      const recordToProcess = {
        ...imported,
        accountId: resolvedAccountId || accounts[0]?.id || 'cash',
        toAccountId: resolvedToAccountId,
        projectId: resolvedProjectId
      };

      const duplicateIndex = currentRecords.findIndex(existing => 
        existing.date === recordToProcess.date &&
        existing.type === recordToProcess.type &&
        existing.amount === recordToProcess.amount &&
        existing.category === recordToProcess.category &&
        existing.accountId === recordToProcess.accountId &&
        existing.toAccountId === recordToProcess.toAccountId &&
        (existing.note || '') === (recordToProcess.note || '')
      );

      if (duplicateIndex !== -1) {
        duplicates.push(recordToProcess);
      } else {
        unique.push(recordToProcess);
        currentRecords.push(recordToProcess);
      }
    });

    return { unique, duplicates };
  }, [importPreview, records, accounts, projects]);

  useEffect(() => {
    if (importClassification.unique.length === 0 && importClassification.duplicates.length > 0) {
      setActiveImportTab('duplicates');
    } else {
      setActiveImportTab('unique');
    }
  }, [importClassification]);

  const handleManualSync = async () => {
    if (!user) {
      alert('請先登入後再進行同步。');
      return;
    }
    
    setIsSyncing(true);
    try {
      await onForceSync();
      alert('同步完成');
      fetchCloudBackups();
    } catch (err) {
      alert('同步失敗，請檢查網路連線。');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRestoreFromCloud = async () => {
    if (!user) {
      alert('請先登入後再進行雲端還原。');
      return;
    }

    const confirm = window.confirm('確定要從雲端還原資料嗎？\n這將會使用雲端儲存的最新資料覆蓋您目前的本地資料，以確保兩端資料一致。');
    if (!confirm) return;

    setIsSyncing(true);
    try {
      // 1. Fetch transactions
      const txSnapshot = await getDocs(collection(db, 'users', user.uid, 'transactions'));
      const txData = txSnapshot.docs.map(doc => doc.data() as Transaction);
      
      // 2. Fetch accounts
      const accSnapshot = await getDocs(collection(db, 'users', user.uid, 'accounts'));
      const accData = accSnapshot.docs.map(doc => doc.data() as Account);
      
      // 3. Fetch categories
      const catSnapshot = await getDocs(collection(db, 'users', user.uid, 'categories'));
      const catData = catSnapshot.docs.map(doc => doc.data() as Category);
      
      // 4. Fetch projects
      const projSnapshot = await getDocs(collection(db, 'users', user.uid, 'projects'));
      const projData = projSnapshot.docs.map(doc => doc.data() as Project);
      
      // 5. Fetch fixedRecords
      const fixedSnapshot = await getDocs(collection(db, 'users', user.uid, 'fixedRecords'));
      const fixedData = fixedSnapshot.docs.map(doc => doc.data() as FixedRecord);
      
      // 6. Fetch installments
      const instSnapshot = await getDocs(collection(db, 'users', user.uid, 'installments'));
      const instData = instSnapshot.docs.map(doc => doc.data() as Installment);
      
      // 7. Fetch templates
      const tempSnapshot = await getDocs(collection(db, 'users', user.uid, 'templates'));
      const tempData = tempSnapshot.docs.map(doc => doc.data() as Template);
      
      // 8. Fetch monthlyBudget
      const profileSnapshot = await getDoc(doc(db, 'users', user.uid));
      if (profileSnapshot.exists()) {
        const profileData = profileSnapshot.data();
        if (profileData?.monthlyBudget) {
          setMonthlyBudget(profileData.monthlyBudget);
        }
      }

      // Update states
      setRecords(txData);
      setAccounts(accData.sort((a, b) => (a.order || 0) - (b.order || 0)));
      setCategories(catData.length > 0 ? catData : INITIAL_CATEGORIES);
      setProjects(projData.length > 0 ? projData : INITIAL_PROJECTS);
      setFixedRecords(fixedData);
      setInstallments(instData);
      setTemplates(tempData);

      alert('雲端資料還原成功！');
    } catch (err) {
      console.error('Cloud restore failed:', err);
      alert('還原失敗，請檢查網路連線後再試。');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleMergeDuplicateAccounts = async () => {
    const confirm = window.confirm('確定要偵測合併重複帳戶，並自動修正系統中的民國日期交易記錄嗎？\n這將會合併同名帳戶，並將類似「115-06-21」的民國日期修正為西元「2026-06-21」，使其正確顯示於往來明細中。');
    if (!confirm) return;

    setIsSyncing(true);
    try {
      const normalizedGroups: Record<string, Account[]> = {};
      accounts.forEach(acc => {
        const key = acc.name.trim().toLowerCase().replace(/\s+/g, '');
        if (!normalizedGroups[key]) {
          normalizedGroups[key] = [];
        }
        normalizedGroups[key].push(acc);
      });

      const groupsToMerge = Object.values(normalizedGroups).filter(group => group.length > 1);
      
      const updatedAccounts = [...accounts];
      const updatedRecords = [...records];

      const accountsToDelete: string[] = [];
      const accountsToSave: Account[] = [];
      const recordsToSave: Transaction[] = [];

      // 1. Merge duplicate accounts
      for (const group of groupsToMerge) {
        const txCounts = group.map(acc => {
          const count = records.filter(r => r.accountId === acc.id || r.toAccountId === acc.id).length;
          return { acc, count };
        });

        txCounts.sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          const aHasBal = a.acc.initialBalance ? 1 : 0;
          const bHasBal = b.acc.initialBalance ? 1 : 0;
          return bHasBal - aHasBal;
        });

        const master = txCounts[0].acc;
        const duplicates = txCounts.slice(1).map(x => x.acc);

        let mergedInitialBalance = master.initialBalance || 0;

        duplicates.forEach(dup => {
          mergedInitialBalance += dup.initialBalance || 0;
          accountsToDelete.push(dup.id);

          updatedRecords.forEach((r, idx) => {
            let changed = false;
            const updatedTx = { ...r };
            if (updatedTx.accountId === dup.id) {
              updatedTx.accountId = master.id;
              changed = true;
            }
            if (updatedTx.toAccountId === dup.id) {
              updatedTx.toAccountId = master.id;
              changed = true;
            }
            if (changed) {
              updatedRecords[idx] = updatedTx;
              if (!recordsToSave.some(x => x.id === updatedTx.id)) {
                recordsToSave.push(updatedTx);
              }
            }
          });
        });

        const masterIdx = updatedAccounts.findIndex(a => a.id === master.id);
        if (masterIdx !== -1) {
          updatedAccounts[masterIdx] = {
            ...master,
            initialBalance: mergedInitialBalance
          };
          accountsToSave.push(updatedAccounts[masterIdx]);
        }
      }

      // 2. Fix Minguo dates (ROC Calendar Years) in transaction records
      let dateFixCount = 0;
      updatedRecords.forEach((r, idx) => {
        let changed = false;
        const updatedTx = { ...r };

        // Check date
        const dateStr = r.date || '';
        const rocmatch = dateStr.replace(/\//g, '-').replace(/\./g, '-').match(/^(\d{2,3})-(\d{1,2})-(\d{1,2})$/);
        if (rocmatch) {
          const year = parseInt(rocmatch[1], 10);
          if (year < 1000) {
            const adYear = year + 1911;
            const month = rocmatch[2].padStart(2, '0');
            const day = rocmatch[3].padStart(2, '0');
            updatedTx.date = `${adYear}-${month}-${day}`;
            changed = true;
          }
        }

        // Check postingDate
        const pDateStr = r.postingDate || '';
        if (pDateStr) {
          const pRocmatch = pDateStr.replace(/\//g, '-').replace(/\./g, '-').match(/^(\d{2,3})-(\d{1,2})-(\d{1,2})$/);
          if (pRocmatch) {
            const year = parseInt(pRocmatch[1], 10);
            if (year < 1000) {
              const adYear = year + 1911;
              const month = pRocmatch[2].padStart(2, '0');
              const day = pRocmatch[3].padStart(2, '0');
              updatedTx.postingDate = `${adYear}-${month}-${day}`;
              changed = true;
            }
          }
        }

        if (changed) {
          updatedRecords[idx] = updatedTx;
          if (!recordsToSave.some(x => x.id === updatedTx.id)) {
            recordsToSave.push(updatedTx);
          }
          dateFixCount++;
        }
      });

      if (groupsToMerge.length === 0 && dateFixCount === 0) {
        alert('未偵測到任何名稱重複的帳戶或需要修正的民國日期。');
        setIsSyncing(false);
        return;
      }

      const finalAccounts = updatedAccounts.filter(a => !accountsToDelete.includes(a.id));

      if (user) {
        const batch = writeBatch(db);
        
        accountsToDelete.forEach(id => {
          batch.delete(doc(db, 'users', user.uid, 'accounts', id));
        });

        accountsToSave.forEach(acc => {
          batch.set(doc(db, 'users', user.uid, 'accounts', acc.id), cleanData(acc));
        });

        const batchSize = 400;
        for (let i = 0; i < recordsToSave.length; i += batchSize) {
          const currentBatch = recordsToSave.slice(i, i + batchSize);
          const tBatch = writeBatch(db);
          currentBatch.forEach(r => {
            tBatch.set(doc(db, 'users', user.uid, 'transactions', r.id), cleanData(r));
          });
          await tBatch.commit();
        }

        await batch.commit();
      }

      setAccounts(finalAccounts);
      setRecords(updatedRecords);

      alert(`修復與合併成功！\n共合併了 ${groupsToMerge.length} 組重複帳戶，修正了 ${dateFixCount} 筆民國日期，並轉移了 ${recordsToSave.length} 筆交易明細。`);
    } catch (err: any) {
      console.error('Merge/Fix failed:', err);
      alert(`修復與合併失敗：\n${err.message || '未知錯誤'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview) return;
    
    setIsSyncing(true);
    try {
      // 1. Identify all unique account names from the import
      const allAccountNames = new Set<string>();
      importPreview.transactions.forEach(t => {
        if ((t as any)._importMainAccountName) allAccountNames.add((t as any)._importMainAccountName.trim());
        if (t._importSourceAccountName) allAccountNames.add(t._importSourceAccountName.trim());
        if (t._importDestAccountName && t._importDestAccountName !== '-') allAccountNames.add(t._importDestAccountName.trim());
      });

      // 2. Identify missing accounts and create them (Strict Exact String matching)
      const cleanAccName = (s: string) => {
        return String(s).replace(/\s+/g, '').replace(/[-_@()（）]/g, '').trim().toLowerCase();
      };

      const newAccountsToCreate: Account[] = [];

      const findExistingAccountId = (name: string) => {
        if (!name) return undefined;
        const trimmed = name.trim();
        // 1. Precise 100% exact full string match with ===
        let found = accounts.find(a => a.name.trim() === trimmed) || 
                    newAccountsToCreate.find(a => a.name.trim() === trimmed);
        if (found) return found.id;
        // 2. Case-insensitive full string match (no substring) with ===
        found = accounts.find(a => a.name.trim().toLowerCase() === trimmed.toLowerCase()) ||
                newAccountsToCreate.find(a => a.name.trim().toLowerCase() === trimmed.toLowerCase());
        if (found) return found.id;
        return undefined;
      };

      const existingAccountNamesMap = new Map<string, string>();
      // Seed the map with existing accounts (both exact and case-insensitive lowercased names for precise full-string fallback)
      accounts.forEach(a => {
        existingAccountNamesMap.set(a.name.trim(), a.id);
        existingAccountNamesMap.set(a.name.trim().toLowerCase(), a.id);
      });
      
      Array.from(allAccountNames).forEach(name => {
        const trimmedName = name.trim();
        const lowercaseName = trimmedName.toLowerCase();
        const cleanedName = cleanAccName(trimmedName);
        
        // Find if this account can match an existing one securely
        const existingId = findExistingAccountId(trimmedName);
        
        if (existingId) {
          // Point multiple spreadsheet spellings/casing of this account name to its true database ID
          existingAccountNamesMap.set(lowercaseName, existingId);
          existingAccountNamesMap.set(cleanedName, existingId);
        } else {
          // If NOT mapped, we create a new ID
          const targetId = lowercaseName === '現金' ? 'cash' : `acc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
          
          const isETicket = lowercaseName.includes('悠遊卡') || lowercaseName.includes('一卡通') || lowercaseName.includes('icash');
          
          // Enhanced Credit Card Detection with Suffixes
          const hasVisa = lowercaseName.includes('visa');
          const hasJcb = lowercaseName.includes('jcb');
          const hasMaster = lowercaseName.includes('master');
          const isCredit = lowercaseName.includes('信用卡') || lowercaseName.includes('卡') || lowercaseName.includes('cube') || 
                          lowercaseName.includes('ubear') || lowercaseName.includes('unicard') || 
                          hasVisa || hasJcb || hasMaster;

          const isBank = (lowercaseName.includes('銀行') || lowercaseName.includes('存摺') || lowercaseName.includes('數位') || lowercaseName.includes('帳戶') || 
                         lowercaseName.includes('國泰') || lowercaseName.includes('台新') || lowercaseName.includes('中信') || lowercaseName.includes('玉山')) && !isCredit;
          
          const isEPayment = lowercaseName.includes('pay') || lowercaseName.includes('支付') || lowercaseName.includes('街口') || lowercaseName.includes('台灣pay') || lowercaseName.includes('悠遊付') || lowercaseName.includes('全支付');
          const isPoints = lowercaseName.includes('point') || lowercaseName.includes('點數') || lowercaseName.includes('點') || lowercaseName.includes('openpoint');
          const isOther = lowercaseName.includes('其他') || lowercaseName.includes('other');

          let resolvedType: Account['type'] = 'cash';
          let resolvedIcon = '💰';

          if (isETicket) {
            resolvedType = 'e-ticket';
            resolvedIcon = '🚌';
          } else if (isCredit) {
            resolvedType = 'credit';
            resolvedIcon = '💳';
          } else if (isBank) {
            resolvedType = 'bank';
            resolvedIcon = '🏦';
          } else if (isEPayment) {
            resolvedType = 'e-payment';
            resolvedIcon = '📱';
          } else if (isPoints) {
            resolvedType = 'points';
            resolvedIcon = '⭐';
          } else if (isOther) {
            resolvedType = 'other';
            resolvedIcon = '📦';
          }

          const newAccount: Account = {
            id: targetId,
            name: trimmedName,
            type: resolvedType,
            icon: resolvedIcon,
            currency: 'TWD',
            order: accounts.length + newAccountsToCreate.length + 1
          };
          newAccountsToCreate.push(newAccount);
          existingAccountNamesMap.set(lowercaseName, targetId);
          existingAccountNamesMap.set(cleanedName, targetId);
          existingAccountNamesMap.set(trimmedName, targetId);
        }
      });

      // newAccountsToCreate will be written to Firestore and updated locally at the end of the import process to prevent duplicate state updates.

      // 2.5 Identify missing projects and create them
      const existingProjectNamesMap = new Map(projects.map(p => [p.name.trim().toLowerCase(), p.id]));
      const newProjectsToCreate: Project[] = [];
      const allProjectNames = new Set<string>();
      
      importPreview.transactions.forEach(t => {
        if (t._importProjectName) {
          const nameToFind = String(t._importProjectName).includes(' > ') ? String(t._importProjectName).split(' > ').pop() : String(t._importProjectName);
          if (nameToFind) allProjectNames.add(nameToFind.trim());
        }
      });

      Array.from(allProjectNames).forEach(name => {
        const trimmedName = name.trim();
        const lowercaseName = trimmedName.toLowerCase();
        if (trimmedName && !existingProjectNamesMap.has(lowercaseName)) {
          const newId = `p_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
          const newProject: Project = {
            id: newId,
            name: trimmedName,
            icon: '📝',
            color: 'bg-stone-100'
          };
          newProjectsToCreate.push(newProject);
          existingProjectNamesMap.set(lowercaseName, newId);
        }
      });

      if (newProjectsToCreate.length > 0) {
        if (user) {
          const projBatch = writeBatch(db);
          newProjectsToCreate.forEach(p => {
            const pRef = doc(db, 'users', user.uid, 'projects', p.id);
            projBatch.set(pRef, cleanData(p));
          });
          await projBatch.commit();
        }
        setProjects([...projects, ...newProjectsToCreate]);
      }

      // 2.7 Identify missing categories and create/update them
      const updatedCategories: Category[] = [...categories];
      const categoriesToSync = new Set<string>();
      let addedCategoriesCount = 0;

      importPreview.transactions.forEach(t => {
        if (t.type === 'transfer' || !t.category) return;
        
        const parts = t.category.split(' > ').map(s => s.trim());
        const mainName = parts[0];
        const subName = parts[1];
        const type = t.type as 'income' | 'expense';

        if (!mainName) return;

        let mainCat = updatedCategories.find(c => c.name.toLowerCase() === mainName.toLowerCase() && c.type === type);
        
        if (!mainCat) {
          const newId = `cat_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
          mainCat = {
            id: newId,
            name: mainName,
            icon: type === 'income' ? '💹' : '📁',
            type: type,
            sub: subName ? [subName] : [],
            order: updatedCategories.length + 1
          };
          updatedCategories.push(mainCat);
          categoriesToSync.add(mainCat.id);
          addedCategoriesCount++;
        } else if (subName && !mainCat.sub.some(s => s.toLowerCase() === subName.toLowerCase())) {
          mainCat.sub.push(subName);
          categoriesToSync.add(mainCat.id);
          addedCategoriesCount++;
        }
      });

      if (categoriesToSync.size > 0) {
        const syncList = updatedCategories.filter(c => categoriesToSync.has(c.id));
        if (user) {
          const catBatch = writeBatch(db);
          syncList.forEach(cat => {
            const catRef = doc(db, 'users', user.uid, 'categories', cat.id);
            catBatch.set(catRef, cleanData(cat));
          });
          await catBatch.commit();
        }
        onUpdateCategories(updatedCategories);
      }

      // 3. Process Transactions with correctly resolved IDs
      const nextRecords = [...records];
      let addedCount = 0;
      let skippedCount = 0;
      const recordsToSync: Transaction[] = [];
      
      importPreview.transactions.forEach(imported => {
        const mainRawName = (imported as any)._importMainAccountName?.trim();
        const sourceName = imported._importSourceAccountName?.trim();
        const destName = imported._importDestAccountName?.trim();
        const importProjName = imported._importProjectName?.trim();

        const getMappedAccountId = (nameText: string | undefined, defaultId: string) => {
          if (!nameText || nameText === '-') return defaultId;
          const trimmed = nameText.trim();
          const target = existingAccountNamesMap.get(trimmed) || 
                         existingAccountNamesMap.get(trimmed.toLowerCase()) || 
                         findExistingAccountId(trimmed);
          return target || defaultId;
        };

        let resolvedAccountId = imported.accountId;
        let resolvedToAccountId = imported.toAccountId;

        if (mainRawName && mainRawName !== '-') {
          // Rule 1: Strict Primary Account Binding - strictly bind to the "Account / 主帳戶" name written on this row!
          resolvedAccountId = getMappedAccountId(mainRawName, imported.accountId);
          
          if (imported.type === 'transfer') {
            // Determine counterpart account name
            let targetName = '';
            if (sourceName && sourceName !== '-' && sourceName !== mainRawName) {
              targetName = sourceName;
            } else if (destName && destName !== '-' && destName !== mainRawName) {
              targetName = destName;
            }
            if (targetName) {
              resolvedToAccountId = getMappedAccountId(targetName, imported.toAccountId || '');
            } else {
              resolvedToAccountId = imported.toAccountId;
            }
          } else {
            resolvedToAccountId = undefined;
          }
        } else {
          // Fallback if mainRawName is empty/not present (preserving original fallback rules)
          if (imported.type === 'income') {
            resolvedAccountId = (destName && destName !== '-') ? getMappedAccountId(destName, imported.accountId) : 
                               ((sourceName && sourceName !== '-') ? getMappedAccountId(sourceName, imported.accountId) : imported.accountId);
            resolvedToAccountId = undefined;
          } else if (imported.type === 'expense') {
            resolvedAccountId = (sourceName && sourceName !== '-') ? getMappedAccountId(sourceName, imported.accountId) : imported.accountId;
            resolvedToAccountId = undefined;
          } else if (imported.type === 'transfer') {
            const isPos = imported.amount > 0;
            const mainName = isPos ? destName : sourceName;
            const targetName = isPos ? sourceName : destName;

            resolvedAccountId = (mainName && mainName !== '-') ? getMappedAccountId(mainName, imported.accountId) : imported.accountId;
            resolvedToAccountId = (targetName && targetName !== '-') ? getMappedAccountId(targetName, imported.toAccountId || '') : imported.toAccountId;
          }
        }

        // Defensive checks for transfers
        if (imported.type === 'transfer') {
          if (!resolvedAccountId) {
            resolvedAccountId = accounts[0]?.id || 'cash';
          }
          if (!resolvedToAccountId) {
            const sibling = accounts.find(a => a.id !== resolvedAccountId) || newAccountsToCreate.find(a => a.id !== resolvedAccountId);
            resolvedToAccountId = sibling?.id || '';
          }
        }

        let resolvedProjectId = imported.projectId;
        if (importProjName) {
           const projNameToFind = importProjName.includes(' > ') ? importProjName.split(' > ').pop() : importProjName;
           if (projNameToFind) {
             resolvedProjectId = existingProjectNamesMap.get(projNameToFind.trim().toLowerCase()) || imported.projectId;
           }
        }

        const recordToProcess = {
          ...imported,
          accountId: resolvedAccountId || accounts[0]?.id || 'cash',
          toAccountId: resolvedToAccountId,
          projectId: resolvedProjectId
        };
        delete (recordToProcess as any)._importSourceAccountName;
        delete (recordToProcess as any)._importDestAccountName;
        delete (recordToProcess as any)._importProjectName;

        const duplicateIndex = nextRecords.findIndex(existing => 
          existing.date === recordToProcess.date &&
          existing.type === recordToProcess.type &&
          existing.amount === recordToProcess.amount &&
          existing.category === recordToProcess.category &&
          existing.accountId === recordToProcess.accountId &&
          existing.toAccountId === recordToProcess.toAccountId &&
          (existing.note || '') === (recordToProcess.note || '')
        );

        if (duplicateIndex !== -1) {
          skippedCount++;
        } else {
          const newRecord = { ...recordToProcess };
          if (!newRecord.id || String(newRecord.id).startsWith('import_') || String(newRecord.id).includes('[object')) {
            newRecord.id = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${addedCount}`;
          }
          nextRecords.push(newRecord);
          recordsToSync.push(newRecord);
          addedCount++;
        }
      });
      
      const sorted = nextRecords.sort((a, b) => b.date.localeCompare(a.date));
      
      if (user && recordsToSync.length > 0) {
        const batchSize = 400;
        for (let i = 0; i < recordsToSync.length; i += batchSize) {
          const currentBatch = recordsToSync.slice(i, i + batchSize);
          const batch = writeBatch(db);
          currentBatch.forEach(r => {
            const sanitized = cleanData(r);
            const recordRef = doc(db, 'users', user.uid, 'transactions', r.id);
            batch.set(recordRef, sanitized);
          });
          await batch.commit();
        }
        setRecords(sorted);
      } else if (!user) {
        setRecords(sorted);
      }

      // 4. Automatic Baseline Alignment (Align initialBalance with Excel's Latest Balance)
      let finalAccountList = [...accounts, ...newAccountsToCreate];

      if (importPreview.accountLatestBalances && Object.keys(importPreview.accountLatestBalances).length > 0) {
        // Map raw names back to correctly resolved account IDs
        const resolvedLatestBalances: Record<string, number> = {};
        Object.keys(importPreview.accountLatestBalances).forEach(rawNameKey => {
          const bal = importPreview.accountLatestBalances[rawNameKey];
          const resolvedId = existingAccountNamesMap.get(rawNameKey) || 
                             existingAccountNamesMap.get(cleanAccName(rawNameKey));
          if (resolvedId) {
            resolvedLatestBalances[resolvedId] = bal;
          }
        });

        finalAccountList = finalAccountList.map(acc => {
          if (acc.type === 'credit') {
            return { ...acc, initialBalance: acc.initialBalance || 0 };
          }
          const latestBal = resolvedLatestBalances[acc.id];
          if (latestBal === undefined) return acc;

          // Calculate current theoretical sum of all records for this account
          let recordSum = 0;
          sorted.forEach(r => {
            if (r.category === '初始資金') return;
            if (r.accountId === acc.id) {
              recordSum += r.amount;
              if (r.fee) recordSum -= r.fee;
            }
            if (r.type === 'transfer' && r.toAccountId === acc.id) {
              if (r.toAmount !== undefined) {
                recordSum += r.toAmount;
              } else {
                recordSum -= r.amount * (r.exchangeRate || 1);
              }
            }
          });

          // Formula: initialBalance + recordSum = latestBal
          // => initialBalance = latestBal - recordSum
          return { ...acc, initialBalance: latestBal - recordSum };
        });
      }

      if (user && finalAccountList.length > 0) {
        const accSyncBatch = writeBatch(db);
        finalAccountList.forEach(acc => {
          accSyncBatch.set(doc(db, 'users', user.uid, 'accounts', acc.id), cleanData(acc));
        });
        await accSyncBatch.commit();
      }
      setAccounts(finalAccountList);
      
      setImportPreview(null);
      alert(`匯入完成！\n已成功匯入 ${addedCount} 筆明細，並自動新增了 ${addedCategoriesCount} 個新分類。\n成功建立帳戶：${newAccountsToCreate.length} 個\n成功建立專案：${newProjectsToCreate.length} 個\n已跳過重複項：${skippedCount} 筆`);
      setShowSyncModal(false);
    } catch (err: any) {
      console.error('Import failed:', err);
      alert(`匯入失敗：\n${err.message || '請檢查網路連線或稍後再試。'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const [showCsvModal, setShowCsvModal] = useState(false);
  const [exportRange, setExportRange] = useState(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      start: firstDay.toISOString().split('T')[0],
      end: lastDay.toISOString().split('T')[0]
    };
  });

  const handleExportCSV = () => {
    const twdHeaders = ['消費日期', '入帳日期', '類型', '主分類', '子分類', '專案', '金額', '手續費', '來源帳戶', '目的帳戶', '備註', '是否已轉帳', '轉帳日期', 'ID'];
    const foreignHeaders = ['消費日期', '入帳日期', '類型', '主分類', '子分類', '專案', '外幣金額', '外幣幣別', '折合台幣金額', '匯率', '手續費', '來源帳戶', '目的帳戶', '備註', '是否已轉帳', '轉帳日期', 'ID'];
    
    // Filter records by date range
    const filtered = records.filter(r => {
      const date = r.date;
      return date >= exportRange.start && date <= exportRange.end;
    }).sort((a, b) => a.date.localeCompare(b.date));

    const twdRows: any[][] = [];
    const foreignRows: any[][] = [];

    filtered.forEach(r => {
      const acc = accounts.find(a => a.id === r.accountId);
      const toAcc = r.toAccountId ? accounts.find(a => a.id === r.toAccountId) : null;
      
      const isForeign = 
        (acc && acc.currency && acc.currency !== 'TWD') || 
        (toAcc && toAcc.currency && toAcc.currency !== 'TWD');

      const mainAccName = acc?.name || '未知帳戶';
      const toAccName = toAcc?.name || '未知帳戶';

      let sourceAccount = '';
      let destAccount = '';
      
      if (r.type === 'income') {
        sourceAccount = '';
        destAccount = mainAccName;
      } else if (r.type === 'expense') {
        sourceAccount = mainAccName;
        destAccount = '';
      } else if (r.type === 'transfer') {
        sourceAccount = mainAccName;
        destAccount = toAccName;
      }

      const proj = projects.find(p => p.id === r.projectId);
      let catMain = r.category;
      let catSub = '';
      if (r.category && r.category.includes(' > ')) {
        const parts = r.category.split(' > ');
        catMain = parts[0];
        catSub = parts[1];
      } else {
        const catObj = categories.find(c => c.name === r.category || c.sub.includes(r.category));
        if (catObj && catObj.sub.includes(r.category)) {
          catMain = catObj.name;
          catSub = r.category;
        }
      }

      if (isForeign) {
        let foreignAmount = Math.abs(r.amount);
        let foreignCurrency = acc?.currency || 'TWD';
        let twdAmount: number | string = '';
        let rateUsed: number | string = '';

        if (r.type === 'transfer' && toAcc) {
          const srcCur = acc?.currency || 'TWD';
          const dstCur = toAcc?.currency || 'TWD';

          if (srcCur === 'TWD' && dstCur !== 'TWD') {
            twdAmount = Math.abs(r.amount);
            foreignAmount = r.toAmount !== undefined ? r.toAmount : Math.abs(r.amount * (r.exchangeRate || 1));
            foreignCurrency = dstCur;
            rateUsed = r.exchangeRate || (twdAmount > 0 ? (foreignAmount / twdAmount) : '');
          } else if (srcCur !== 'TWD' && dstCur === 'TWD') {
            foreignAmount = Math.abs(r.amount);
            foreignCurrency = srcCur;
            twdAmount = r.toAmount !== undefined ? r.toAmount : Math.abs(r.amount * (r.exchangeRate || 1));
            rateUsed = r.exchangeRate || (foreignAmount > 0 ? (twdAmount / foreignAmount) : '');
          } else {
            foreignAmount = Math.abs(r.amount);
            foreignCurrency = srcCur;
          }
        } else {
          foreignAmount = Math.abs(r.amount);
          foreignCurrency = acc?.currency || 'TWD';
          if (foreignCurrency !== 'TWD') {
            const rate = r.exchangeRate || getLatestExchangeRate(records, accounts, foreignCurrency, r.date);
            rateUsed = rate;
            twdAmount = Math.round(foreignAmount * rate);
          }
        }

        foreignRows.push([
          r.date,
          r.postingDate || (r.isPending ? '未入帳' : r.date),
          r.type === 'income' ? '收入' : (r.type === 'expense' ? '支出' : '轉帳'),
          catMain,
          catSub,
          proj?.name || '',
          foreignAmount,
          foreignCurrency,
          twdAmount,
          rateUsed,
          r.fee || 0,
          sourceAccount,
          destAccount,
          r.note || '',
          r.transferredDate ? '是' : '否',
          r.transferredDate || '',
          r.id
        ]);
      } else {
        twdRows.push([
          r.date,
          r.postingDate || (r.isPending ? '未入帳' : r.date),
          r.type === 'income' ? '收入' : (r.type === 'expense' ? '支出' : '轉帳'),
          catMain,
          catSub,
          proj?.name || '',
          Math.abs(r.amount),
          r.fee || 0,
          sourceAccount,
          destAccount,
          r.note || '',
          r.transferredDate ? '是' : '否',
          r.transferredDate || '',
          r.id
        ]);
      }
    });

    try {
      const wb = XLSX.utils.book_new();
      
      const twdSheet = XLSX.utils.aoa_to_sheet([twdHeaders, ...twdRows]);
      const foreignSheet = XLSX.utils.aoa_to_sheet([foreignHeaders, ...foreignRows]);
      
      XLSX.utils.book_append_sheet(wb, twdSheet, '台幣帳戶明細');
      XLSX.utils.book_append_sheet(wb, foreignSheet, '外幣帳戶明細');
      
      XLSX.writeFile(wb, `KK記帳_匯出_${exportRange.start}_${exportRange.end}.xlsx`);
    } catch (err) {
      console.error('Failed to export Excel:', err);
      alert('匯出 Excel 失敗，請重試。');
    }

    setShowCsvModal(false);
  };

  const handleBackup = () => {
    const backupData = {
      records,
      installments,
      projects,
      version: '2.4.0',
      timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    link.setAttribute('href', url);
    link.setAttribute('download', `KK_Account_Backup_${dateStr}.json`);
    link.click();
    URL.revokeObjectURL(url);
    setShowSyncModal(false);
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension === 'json') {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const data = JSON.parse(content);
          if (!Array.isArray(data.records)) throw new Error('無效的備份檔案格式 (缺少 records)');
          setImportPreview({ transactions: data.records, total: data.records.length });
        } catch (err) {
          alert('讀取失敗：' + (err instanceof Error ? err.message : '檔案格式不正確'));
        }
      };
      reader.readAsText(file);
    } else if (extension === 'xlsx' || extension === 'xls' || extension === 'csv') {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          let jsonData: any[] = [];
          workbook.SheetNames.forEach(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            const sheetData = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as any[];
            jsonData = jsonData.concat(sheetData);
          });
          
          if (jsonData.length === 0) throw new Error('檔案中沒有資料');

          // Helper to get value from row using case-insensitive trimmed alias matching
          const getVal = (row: any, aliases: string[]) => {
            const keys = Object.keys(row);
            const normalizedAliases = aliases.map(a => a.trim().toLowerCase());
            const targetKey = keys.find(k => normalizedAliases.includes(k.trim().toLowerCase()));
            return targetKey ? row[targetKey] : undefined;
          };

          const importedTransactions: Transaction[] = jsonData.map((row: any, idx) => {
            // 1. Resolve Basic Fields with Aliases
            const parseDate = (raw: any) => {
              if (!raw) return undefined;
              if (raw instanceof Date) return formatLocalDate(raw);
              if (typeof raw === 'number') {
                const dateObj = new Date(Math.round((raw - 25569) * 86400 * 1000));
                return formatLocalDate(dateObj);
              }
              const dateStr = String(raw).trim().replace(/\//g, '-').replace(/\./g, '-');
              
              // ROC (Minguo) calendar year match (e.g. 115-06-21)
              const rocmatch = dateStr.match(/^(\d{2,3})-(\d{1,2})-(\d{1,2})$/);
              if (rocmatch) {
                const year = parseInt(rocmatch[1], 10);
                if (year < 1000) {
                  const adYear = year + 1911;
                  const month = rocmatch[2].padStart(2, '0');
                  const day = rocmatch[3].padStart(2, '0');
                  return `${adYear}-${month}-${day}`;
                }
              }

              if (dateStr.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
                const parts = dateStr.split('-');
                return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
              }
              if (dateStr.match(/^\d{1,2}-\d{1,2}$/)) {
                const parts = dateStr.split('-');
                return `${new Date().getFullYear()}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
              }
              const d = new Date(dateStr);
              return !isNaN(d.getTime()) ? formatLocalDate(d) : undefined;
            };

            const consumeDateRaw = getVal(row, ['消費日期', '日期', '日期(yyyy/MM/dd)', 'date']);
            const postingDateRaw = getVal(row, ['入帳日期', 'posting date']);
            
            const date = parseDate(consumeDateRaw) || formatLocalDate(new Date());
            const postingDateVal = parseDate(postingDateRaw);
            const isPendingValue = getVal(row, ['入帳日期', 'posting date status']) === '未入帳';
            
            // Ensure BOTH date and postingDate are stored (use date as fallback for postingDate if not pending)
            const finalPostingDate = postingDateVal || (isPendingValue ? undefined : date);
            
            const mainCat = String(getVal(row, ['主分類', '類別', 'category']) || '').trim();
            const subCat = String(getVal(row, ['子分類']) || '').trim();
            const category = (mainCat && subCat) ? `${mainCat} > ${subCat}` : (mainCat || subCat || '其他');
            
            // 2. Resolve Accounts
            let expAcc = String(getVal(row, ['支出帳戶', '來源帳戶', '轉出帳戶', '轉出', '從帳戶', 'Source Account']) || '').trim();
            let incAcc = String(getVal(row, ['收入帳戶', '目的帳戶', '目標帳戶', '目標', '轉入帳戶', '轉帳帳戶', '轉入', '轉至', '到帳戶', 'Dest Account', 'Destination Account']) || '').trim();
            let genAcc = String(getVal(row, ['帳戶', '帳戶名稱', 'Account']) || '').trim();

            if (expAcc === '-') expAcc = '';
            if (incAcc === '-') incAcc = '';
            if (genAcc === '-') genAcc = '';

            const findAccByName = (name: string) => {
              if (!name) return undefined;
              const trimmed = name.trim();
              // 1. Precise 100% exact full string match with ===
              let found = accounts.find(a => a.name.trim() === trimmed);
              if (found) return found;
              // 2. Case-insensitive full string match (no substring) with ===
              found = accounts.find(a => a.name.trim().toLowerCase() === trimmed.toLowerCase());
              return found;
            };
            
            const parseSignedVal = (val: any) => {
              if (val === undefined || val === null) return 0;
              if (typeof val === 'number') return val;
              const s = String(val).replace(/[^\d.-]/g, '').trim();
              const num = parseFloat(s);
              return isNaN(num) ? 0 : num;
            };

            let rawAmount = parseSignedVal(getVal(row, ['金額', '小計', 'amount']));
            let importedToAmount: number | undefined = undefined;
            let importedExchangeRate: number | undefined = undefined;

            const foreignAmt = parseSignedVal(getVal(row, ['外幣金額']));
            const twdAmt = parseSignedVal(getVal(row, ['折合台幣金額']));
            const rateVal = parseSignedVal(getVal(row, ['匯率']));

            if (rawAmount === 0 && (foreignAmt !== 0 || twdAmt !== 0)) {
              // Determine currency based on account lookup
              const sAcc = findAccByName(expAcc || genAcc);
              const dAcc = findAccByName(incAcc);

              if (sAcc && sAcc.currency && sAcc.currency !== 'TWD') {
                rawAmount = foreignAmt || twdAmt;
                if (dAcc && dAcc.currency === 'TWD') {
                  importedToAmount = twdAmt || foreignAmt;
                  importedExchangeRate = rateVal || (rawAmount > 0 ? (importedToAmount / rawAmount) : undefined);
                }
              } else {
                rawAmount = twdAmt || foreignAmt;
                if (dAcc && dAcc.currency && dAcc.currency !== 'TWD') {
                  importedToAmount = foreignAmt || twdAmt;
                  importedExchangeRate = rateVal || (rawAmount > 0 ? (importedToAmount / rawAmount) : undefined);
                }
              }
            } else if (rawAmount !== 0) {
              // Check if rate is present
              if (rateVal !== 0) {
                importedExchangeRate = rateVal;
                // If it is a transfer, we can compute toAmount
                const sAcc = findAccByName(expAcc || genAcc);
                const dAcc = findAccByName(incAcc);
                if (sAcc && dAcc) {
                  importedToAmount = Math.abs(rawAmount) * rateVal;
                }
              }
            }

            const feeVal = Math.abs(parseSignedVal(getVal(row, ['手續費', 'fee'])));
            const rawBalanceText = getVal(row, ['餘額', '交易後餘額', '結餘', 'Balance']);
            const isBalanceEmpty = rawBalanceText === undefined || rawBalanceText === null || String(rawBalanceText).trim() === '';
            const balanceVal = isBalanceEmpty ? 0 : parseSignedVal(rawBalanceText);

            const rawTypeText = String(getVal(row, ['類型', '交易類型', 'Type']) || '').trim();
            const rawCategoryText = String(getVal(row, ['主分類', '類別', 'category']) || '').trim();
            const rawNoteText = String(getVal(row, ['明細', '項目', '品項', '名稱', '內容', '消費項目', '備註', '說明']) || '').trim();
            
            let type: Transaction['type'] = 'expense';
            
            const isDoubleAccount = (expAcc && incAcc && expAcc !== '-' && incAcc !== '-');
            const isAutoReloadText = rawNoteText.includes('自動加值') || rawCategoryText.includes('自動加值') || rawTypeText.includes('自動加值') || rawCategoryText.includes('加值');

            // 1. Double account signature forces "transfer" regardless of positive or negative amount
            if (isDoubleAccount) {
              type = 'transfer';
            } else if (rawAmount < 0) {
              const isTransfer = rawTypeText.includes('轉帳') || isAutoReloadText;
              type = isTransfer ? 'transfer' : 'expense';
            } else {
              if (rawTypeText.includes('收入')) type = 'income';
              else if (rawTypeText.includes('支出')) type = 'expense';
              else if (rawTypeText.includes('轉帳') || isAutoReloadText) type = 'transfer';
              else {
                if (incAcc) type = 'income';
                else type = 'expense';
              }
            }

            let sourceAccName = expAcc;
            let destAccName = incAcc;

            if (!sourceAccName && !destAccName && genAcc) {
              if (type === 'income') destAccName = genAcc;
              else sourceAccName = genAcc;
            }

            const cleanAccName = (s: string) => {
              return String(s).replace(/\s+/g, '').replace(/[-_@()（）]/g, '').trim().toLowerCase();
            };

            const sourceAcc = findAccByName(sourceAccName);
            const destAcc = findAccByName(destAccName);
            const mainAcc = findAccByName(genAcc);
            
            let finalAccountId = mainAcc?.id || sourceAcc?.id || '';
            let finalToAccountId = destAcc?.id || '';
            let amountVal = rawAmount;

            if (type === 'income') {
              finalAccountId = mainAcc?.id || destAcc?.id || sourceAcc?.id || '';
              finalToAccountId = '';
              if (amountVal < 0) amountVal = -amountVal;
            } else if (type === 'expense') {
              finalAccountId = mainAcc?.id || sourceAcc?.id || '';
              finalToAccountId = '';
              if (amountVal > 0) amountVal = -amountVal;
            } else if (type === 'transfer') {
              if (mainAcc) {
                // If "主帳戶（Account）" is written on this row, strictly bind finalAccountId to it!
                finalAccountId = mainAcc.id;
                // Determine counterpart (the other account name specified on the same row)
                let otherAcc = undefined;
                if (sourceAcc && sourceAcc.id !== mainAcc.id) {
                  otherAcc = sourceAcc;
                } else if (destAcc && destAcc.id !== mainAcc.id) {
                  otherAcc = destAcc;
                }
                finalToAccountId = otherAcc?.id || '';
                // Since this row is treated strictly under its own main account,
                // we preserve the exact rawAmount sign (be it transfer in / out)
                // because the sign on this row reflects whether it increased or decreased this main account.
                amountVal = rawAmount;
              } else {
                // Fallback if genAcc is not found on the row
                const srcId = sourceAcc?.id || '';
                const dstId = destAcc?.id || '';
                if (srcId && dstId) {
                  finalAccountId = srcId;
                  finalToAccountId = dstId;
                  amountVal = -Math.abs(rawAmount);
                } else if (dstId) {
                  finalAccountId = dstId;
                  finalToAccountId = '';
                  amountVal = Math.abs(rawAmount);
                } else {
                  finalAccountId = srcId;
                  finalToAccountId = '';
                  amountVal = -Math.abs(rawAmount);
                }
              }
            }

            // 3. Resolve Project
            const projectName = String(getVal(row, ['專案', 'Project']) || '').trim();
            let projectId = undefined;
            if (projectName) {
               const nameToFind = projectName.includes(' > ') 
                                  ? projectName.split(' > ').map(s => s.trim()).pop() || ''
                                  : projectName;
               
               const foundProject = projects.find(p => 
                 p.name.toLowerCase() === projectName.toLowerCase() || 
                 p.name.toLowerCase() === nameToFind.toLowerCase()
               );
               projectId = foundProject?.id;
            }

            // 5. Resolve ID and Note / Remark
            const rawId = String(getVal(row, ['ID', 'id']) || '');
            let cleanId = rawId;
            if (rawId.startsWith("'")) cleanId = rawId.substring(1);
            else if (rawId.startsWith("ID_")) cleanId = rawId.substring(3);

            const remarkRaw = getVal(row, ['備註', '說明']);
            const remarkVal = remarkRaw ? String(remarkRaw).trim() : '';
            const itemNameRaw = getVal(row, ['明細', '項目', '品項', '名稱', '內容', '消費項目']);
            const itemNameVal = itemNameRaw ? String(itemNameRaw).trim() : '';

            const noteText = itemNameVal || remarkVal || '未命名明細';

            return {
              id: cleanId || `import_${Date.now()}_${idx}`,
              date: String(date),
              postingDate: finalPostingDate ? String(finalPostingDate) : undefined,
              isPending: isPendingValue,
              type: type as any,
              category: String(category),
              amount: amountVal,
              fee: feeVal,
              accountId: finalAccountId,
              toAccountId: finalToAccountId,
              note: noteText,
              remark: remarkVal || undefined,
              projectId: projectId as string | undefined,
              _importBalance: isBalanceEmpty ? undefined : balanceVal, // Store for logic sync
              _importMainAccountName: genAcc,
              _importSourceAccountName: sourceAccName,
              _importDestAccountName: destAccName,
              _importProjectName: projectName ? String(projectName) : undefined,
              toAmount: type === 'transfer' ? importedToAmount : undefined,
              exchangeRate: type === 'transfer' ? importedExchangeRate : undefined
            };
          }).filter(r => r.amount !== 0 || r.category === '初始資金');

          if (importedTransactions.length === 0) throw new Error('檔案中沒有可匯入的有效金額資料');
          
          // Identify latest balance per account from the imported data
          const accountLatestBalances: Record<string, number> = {};
          
          // Group transactions that have an import balance by their normalized explicit main account name (or fallback if empty)
          const txsByAccountName: Record<string, { rawName: string, transactions: Transaction[] }> = {};
          importedTransactions.forEach(t => {
            if (t._importBalance !== undefined) {
              let rawName = '';
              if (t.amount > 0) {
                // Positive amount (transfer-in / income): bind balance strictly to the destination (income) account
                rawName = t._importDestAccountName || (t as any)._importMainAccountName || '';
              } else if (t.amount < 0) {
                // Negative amount (transfer-out / expense): bind balance strictly to the source (expense) account
                rawName = t._importSourceAccountName || (t as any)._importMainAccountName || '';
              } else {
                // Fallback for zero amounts
                rawName = (t as any)._importMainAccountName || t._importSourceAccountName || t._importDestAccountName || '';
              }
              const cleanedName = rawName.trim().toLowerCase();
              if (cleanedName) {
                if (!txsByAccountName[cleanedName]) {
                  txsByAccountName[cleanedName] = { rawName: rawName.trim(), transactions: [] };
                }
                txsByAccountName[cleanedName].transactions.push(t);
              }
            }
          });

          // Determine if the Excel file is newest on top or oldest on top
          let isNewestOnTop = false;
          if (importedTransactions.length >= 2) {
            const firstDate = importedTransactions[0].date;
            const lastDate = importedTransactions[importedTransactions.length - 1].date;
            if (firstDate > lastDate) {
              isNewestOnTop = true;
            }
          }

          Object.keys(txsByAccountName).forEach(cleanedNameKey => {
            const { rawName, transactions: list } = txsByAccountName[cleanedNameKey];
            
            list.sort((a, b) => {
              const dateComp = a.date.localeCompare(b.date);
              if (dateComp !== 0) return dateComp;
              const indexA = importedTransactions.indexOf(a);
              const indexB = importedTransactions.indexOf(b);
              return isNewestOnTop ? (indexB - indexA) : (indexA - indexB);
            });

            // The last item in sorted list is the chronologically latest one
            const latestTx = list[list.length - 1];
            accountLatestBalances[cleanedNameKey] = latestTx._importBalance!;
          });

          setImportPreview({ 
            transactions: importedTransactions, 
            total: importedTransactions.length,
            accountLatestBalances // Store these for handleConfirmImport
          });
        } catch (err) {
          alert('讀取 Excel 失敗：' + (err instanceof Error ? err.message : '檔案格式不正確'));
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      alert('不支援的檔案格式（僅支援 .json, .xlsx, .csv）');
    }
    e.target.value = '';
  };

  const handleDeleteByDateRange = async () => {
    if (!deleteStartDate || !deleteEndDate) {
      alert("請選擇起迄日期！");
      return;
    }
    if (deleteStartDate > deleteEndDate) {
      alert("開始日期不能晚於結束日期！");
      return;
    }

    const confirm1 = window.confirm(`⚠️ 警告：確定要刪除自 ${deleteStartDate} 至 ${deleteEndDate} 期間的所有明細嗎？`);
    if (!confirm1) return;
    
    const confirm2 = window.confirm('此操作將永久移除該期間的交易明細，且無法還原。您真的確定嗎？');
    if (!confirm2) return;

    setIsSyncing(true);
    try {
      const toDelete = records.filter(r => {
        const d = r.postingDate || r.date;
        return d >= deleteStartDate && d <= deleteEndDate;
      });

      if (toDelete.length === 0) {
        alert("該期間內沒有任何明細交易。");
        setIsSyncing(false);
        return;
      }

      if (user) {
        const chunks: Transaction[][] = [];
        for (let i = 0; i < toDelete.length; i += 400) {
          chunks.push(toDelete.slice(i, i + 400));
        }

        for (const chunk of chunks) {
          const batch = writeBatch(db);
          chunk.forEach(r => {
            batch.delete(doc(db, 'users', user.uid, 'transactions', r.id));
          });
          await batch.commit();
        }
      }

      const toDeleteIds = new Set(toDelete.map(r => r.id));
      setRecords(records.filter(r => !toDeleteIds.has(r.id)));
      alert(`已成功刪除該期間共 ${toDelete.length} 筆明細交易！`);
      setDangerAction(null);
    } catch (err: any) {
      console.error('Delete range failed:', err);
      alert('刪除失敗：' + (err.message || '請稍後再試。'));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteAccountData = async () => {
    if (!selectedDeleteAccountId) {
      alert("請選取要處理的帳戶！");
      return;
    }

    const targetAccount = accounts.find(a => a.id === selectedDeleteAccountId);
    if (!targetAccount) return;

    const getAccountAndDescendants = (accId: string): string[] => {
      const ids = [accId];
      const findChildren = (parentId: string) => {
        accounts.filter(a => a.parentId === parentId).forEach(child => {
          ids.push(child.id);
          findChildren(child.id);
        });
      };
      findChildren(accId);
      return ids;
    };

    const targetAccountIds = getAccountAndDescendants(selectedDeleteAccountId);
    const targetAccountNames = accounts
      .filter(a => targetAccountIds.includes(a.id))
      .map(a => `『${a.name}』`)
      .join('、');

    const isDeleteFull = deleteAccountMode === 'deleteFull';
    let promptMsg = '';
    if (isDeleteFull) {
      promptMsg = `⚠️ 警告：確定要完全刪除帳戶 ${targetAccountNames} 及其所有關聯的交易明細嗎？\n(包含轉入/轉出該帳戶的紀錄都會被刪除，且帳戶將會被永久移除)`;
    } else {
      promptMsg = `確定要清空帳戶 ${targetAccountNames} 的所有交易明細嗎？\n(帳戶本身將會保留，但所有關聯的明細將被清空)`;
    }

    const confirm1 = window.confirm(promptMsg);
    if (!confirm1) return;

    const confirm2 = window.confirm('此操作將永久移除相關資料，且無法還原。確定要繼續嗎？');
    if (!confirm2) return;

    setIsSyncing(true);
    try {
      const toDelete = records.filter(r => 
        targetAccountIds.includes(r.accountId) || 
        (r.toAccountId && targetAccountIds.includes(r.toAccountId))
      );

      if (user) {
        const chunks: Transaction[][] = [];
        for (let i = 0; i < toDelete.length; i += 400) {
          chunks.push(toDelete.slice(i, i + 400));
        }

        for (const chunk of chunks) {
          const batch = writeBatch(db);
          chunk.forEach(r => {
            batch.delete(doc(db, 'users', user.uid, 'transactions', r.id));
          });
          await batch.commit();
        }

        if (isDeleteFull) {
          const batch = writeBatch(db);
          targetAccountIds.forEach(aid => {
            batch.delete(doc(db, 'users', user.uid, 'accounts', aid));
          });
          await batch.commit();
        }
      }

      const toDeleteIds = new Set(toDelete.map(r => r.id));
      setRecords(records.filter(r => !toDeleteIds.has(r.id)));
      
      if (isDeleteFull) {
        setAccounts(prev => prev.filter(a => !targetAccountIds.includes(a.id)));
      }

      alert(`已成功處理！共刪除了 ${toDelete.length} 筆明細交易${isDeleteFull ? `並移除了 ${targetAccountIds.length} 個帳戶` : ''}。`);
      setDangerAction(null);
      setSelectedDeleteAccountId('');
    } catch (err: any) {
      console.error('Delete account data failed:', err);
      alert('刪除失敗：' + (err.message || '請稍後再試。'));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleResetAllData = async () => {
    // Triple confirmation for extreme safety
    const confirm1 = window.confirm('⚠️ 警告：確定要刪除所有明細、帳戶與計畫資料嗎？');
    if (!confirm1) return;
    
    const confirm2 = window.confirm('此操作將徹底清空您的所有帳務紀錄，且無法還原。您確定要繼續嗎？');
    if (!confirm2) return;

    setIsSyncing(true);
    try {
      if (user) {
        const batch = writeBatch(db);
        
        // We'll reset everything related to this user
        records.forEach(r => {
          batch.delete(doc(db, 'users', user.uid, 'transactions', r.id));
        });
        
        accounts.forEach(acc => {
          batch.delete(doc(db, 'users', user.uid, 'accounts', acc.id));
        });

        fixedRecords.forEach(f => {
          batch.delete(doc(db, 'users', user.uid, 'fixedRecords', f.id));
        });

        installments.forEach(i => {
          batch.delete(doc(db, 'users', user.uid, 'installments', i.id));
        });

        templates.forEach(t => {
          batch.delete(doc(db, 'users', user.uid, 'templates', t.id));
        });

        // Clear projects but keep a default one
        projects.forEach(p => {
          if (p.id !== 'p1') {
            batch.delete(doc(db, 'users', user.uid, 'projects', p.id));
          }
        });

        await batch.commit();
      }
      
      // Update local states directly to ensure immediate feedback
      setRecords([]);
      setAccounts([]);
      setFixedRecords([]);
      setInstallments([]);
      setTemplates([]);
      setProjects([{ id: 'p1', name: '預設專案', icon: '📂', color: 'bg-stone-100', description: '系統預設專案' }]);
      
      // Clear import preview state / cache
      setImportPreview(null);
      // Clear localStorage and sessionStorage
      localStorage.clear();
      sessionStorage.clear();

      // Deep clear IndexedDB
      if (window.indexedDB && window.indexedDB.databases) {
        try {
          const dbs = await window.indexedDB.databases();
          dbs.forEach(dbInfo => {
            if (dbInfo.name) {
              window.indexedDB.deleteDatabase(dbInfo.name);
            }
          });
        } catch (e) {
          console.error("Failed to list indexedDB dbs:", e);
        }
      }
      // Explicit fallback common database names
      const commonDbs = [
        'firestoreOfflineDatabase', 
        'firebaseLocalStorageDb', 
        '_pouch_localforage', 
        'localforage',
        'firestore'
      ];
      commonDbs.forEach(dbname => {
        try {
          window.indexedDB.deleteDatabase(dbname);
        } catch (e) {}
      });
      
      alert('所有資料及快取已成功重設！');
    } catch (err: any) {
      console.error('Reset failed:', err);
      alert('重設失敗：' + (err.message || '請稍後再試。'));
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex flex-col gap-4 px-4 py-6"
    >
      <div className="bg-white rounded-[30px] p-6 shadow-sm border-2 border-white flex flex-col gap-2">
        <span className="font-black text-lg mb-2 text-[#5D4037]">系統設定</span>
        <button 
          onClick={() => setShowCsvModal(true)}
          className="flex items-center justify-between py-3 border-b border-stone-50 text-left w-full active:opacity-60"
        >
          <span className="font-bold text-[#5D4037]">匯出資料 (Excel)</span>
          <ChevronRight size={20} className="text-stone-300" />
        </button>
        <button 
          onClick={() => setShowSyncModal(true)}
          className="flex items-center justify-between py-3 border-b border-stone-50 text-left w-full active:opacity-60"
        >
          <span className="font-bold text-[#5D4037]">備份與還原</span>
          <ChevronRight size={20} className="text-stone-300" />
        </button>
        <button 
          onClick={handleManualSync}
          disabled={isSyncing}
          className="flex items-center justify-between py-3 border-b border-stone-50 text-left w-full active:opacity-60"
        >
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#5D4037]">立即同步至雲端</span>
            {isSyncing && <Loader2 size={16} className="text-[#FBC02D] animate-spin" />}
          </div>
          <CloudUpload size={20} className={isSyncing ? 'text-[#FBC02D]' : 'text-stone-300'} />
        </button>
        <div className="flex items-center justify-between py-3">
          <span className="font-bold text-[#5D4037]">關於 KK 記帳</span>
          <span className="text-xs text-stone-300">v2.4.0</span>
        </div>
      </div>

      <AnimatePresence>
        {showSyncModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#FFF9E3] rounded-[40px] w-full max-w-sm shadow-2xl relative flex flex-col max-h-[80vh] overflow-hidden"
            >
              <button 
                onClick={() => setShowSyncModal(false)}
                className="absolute top-6 right-6 p-2 text-[#5D4037] hover:bg-black/5 rounded-full z-20"
              >
                <X size={24} />
              </button>

              {/* Fixed Header */}
              <div className="px-6 py-8 pb-4 flex items-center justify-center gap-2.5">
                <div className="w-9 h-9 bg-white rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0">
                  <Database size={18} className="text-[#FBC02D]" />
                </div>
                <h3 className="text-[19px] font-black text-[#5D4037] whitespace-nowrap leading-none tracking-tight" style={getFontFamily()}>備份與還原</h3>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto px-8 pb-4 space-y-5 custom-scrollbar">
                <p className="text-center text-[13px] text-[#5D4037]/60 leading-relaxed font-medium">保護您的財務紀錄，隨時輕鬆同步與復原。</p>
                
                <div className="flex flex-col gap-4">
                  <button 
                    onClick={handleBackup}
                    className="bg-[#5D4037] text-white py-3.5 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg"
                  >
                    <Download size={18} />
                    立即備份資料 (JSON)
                  </button>
                  <button 
                    onClick={handleRestoreClick}
                    className="bg-white border-2 border-[#5D4037]/10 text-[#5D4037] py-3.5 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-3 active:scale-95 transition-all"
                  >
                    <Upload size={18} />
                    選取備份檔還原 (.json / .xlsx)
                  </button>
                  <button 
                    onClick={handleRestoreFromCloud}
                    className="bg-[#E0F2FE] hover:bg-[#BAE6FD] text-[#0369A1] py-3.5 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-3 active:scale-95 transition-all shadow-sm"
                  >
                    <CloudDownload size={18} />
                    從雲端資料庫還原資料
                  </button>
                  <button 
                    onClick={handleMergeDuplicateAccounts}
                    className="bg-amber-600 hover:bg-amber-700 text-white py-3.5 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-3 active:scale-95 transition-all shadow-md"
                  >
                    <RefreshCw size={18} />
                    偵測合併帳戶與修正民國日期
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept=".json,.xlsx,.xls,.csv" 
                    className="hidden" 
                  />

                  {user && (
                    <div className="bg-[#5D4037]/5 p-5 rounded-3xl space-y-3 text-[#5D4037]">
                      <div className="flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest opacity-40">
                        <History size={12} />
                        <span>雲端歷史備份 (保留最近 5 次)</span>
                      </div>
                      
                      {isLoadingBackups ? (
                        <div className="flex items-center justify-center py-2 text-stone-400 text-xs gap-2 font-bold">
                          <Loader2 size={14} className="animate-spin" />載入備份中...
                        </div>
                      ) : cloudBackups.length === 0 ? (
                        <div className="text-center py-2 text-stone-400 text-xs font-bold">
                          無歷史備份紀錄 (手動同步後自動建立)
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
                          {cloudBackups.map((backup) => {
                            const date = new Date(backup.timestamp);
                            const formattedTime = `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
                            return (
                              <div key={backup.id} className="bg-white/70 p-2.5 rounded-2xl border border-[#5D4037]/5 flex justify-between items-center gap-3 shadow-sm">
                                <div className="flex flex-col gap-0.5 min-w-0">
                                  <span className="text-[11px] font-black text-[#5D4037] truncate">${formattedTime}</span>
                                  <span className="text-[9px] text-stone-400 font-bold">
                                    明細: ${backup.records?.length || 0} 筆 | 帳戶: ${backup.accounts?.length || 0} 個
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleRestoreSpecificBackup(backup)}
                                  className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl text-[10px] font-black transition-all active:scale-95 border border-sky-100 shrink-0 shadow-sm"
                                >
                                  還原此版本
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="bg-[#5D4037]/5 p-5 rounded-3xl space-y-2">
                    <div className="flex items-center gap-2 text-[#5D4037] font-bold text-[10px] uppercase tracking-widest opacity-40">
                      <ShieldCheck size={12} />
                      <span>注意事項</span>
                    </div>
                    <p className="text-[12px] text-[#5D4037]/70 leading-relaxed font-medium">
                      備份包含所有交易紀錄與分期計畫。還原功能將匯入檔案並<span className="text-orange-600 font-bold">取代</span>現有資料，建議先匯出目前的備份。
                    </p>
                  </div>

                  <div className="bg-[#5D4037]/5 p-5 rounded-3xl space-y-3 mt-4 text-[#5D4037]">
                    <div className="flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest opacity-40">
                      <ShieldCheck size={12} />
                      <span>資料庫診斷資訊</span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="font-bold border-b border-[#5D4037]/10 pb-1">帳戶列表 ({accounts.length} 個):</div>
                      <div className="max-h-24 overflow-y-auto space-y-1 font-mono text-[10px] leading-tight">
                        {accounts.map(a => (
                          <div key={a.id} className="bg-white/40 p-1 rounded">
                            ID: {a.id} | 名稱: {a.name} | 餘額: {calculateAccountBalance(a, accounts, records)} | 初始: {a.initialBalance || 0}
                          </div>
                        ))}
                      </div>
                      
                      <div className="font-bold border-b border-[#5D4037]/10 pb-1 pt-2">最新 10 筆明細 (共 {records.length} 筆):</div>
                      <div className="max-h-36 overflow-y-auto space-y-1 font-mono text-[10px] leading-tight">
                        {records.slice(0, 10).map(r => (
                          <div key={r.id} className="bg-white/40 p-1 rounded">
                            ID: {r.id} | 日期: {r.date} | 帳戶: {r.accountId} | 金額: {r.amount} | 備註: {r.note || '-'}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-white/20 text-center border-t border-[#5D4037]/5">
                <p className="text-[10px] font-bold text-[#5D4037]/30 tracking-widest uppercase">Secure Backup & Restore</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      <div className="bg-white rounded-[30px] p-6 shadow-sm border-2 border-white flex flex-col gap-2">
        <span className="font-black text-lg mb-2 text-[#5D4037]">顯示設定</span>
        <div className="flex items-center justify-between py-3 border-b border-stone-50">
          <span className="font-bold text-[#5D4037]">深色模式</span>
          <div className="w-12 h-6 bg-stone-100 rounded-full relative overflow-hidden">
            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
          </div>
        </div>
        <div className="flex items-center justify-between py-3">
          <span className="font-bold text-[#5D4037]">隱藏金額</span>
          <div className="w-12 h-6 bg-[#5D4037] rounded-full relative overflow-hidden">
            <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[30px] p-6 shadow-sm border-2 border-white flex flex-col gap-4 mt-2">
        <span className="font-black text-lg text-rose-500">危險區域</span>
        <p className="text-[10px] font-bold text-stone-300 leading-relaxed">
          以下操作將永久移除您的資料，請務必確認已備份重要資訊。
        </p>

        <div className="flex flex-col gap-3">
          <button 
            onClick={() => setDangerAction(dangerAction === 'date' ? null : 'date')}
            className={`flex items-center justify-between p-4 rounded-2xl border transition-all active:scale-[0.98] ${
              dangerAction === 'date' ? 'bg-rose-500 border-rose-500 text-white shadow-md' : 'bg-rose-50/30 border-rose-100/50 text-rose-600 hover:bg-rose-50'
            }`}
            style={getFontFamily()}
          >
            <div className="flex items-center gap-3">
              <CalendarIcon size={20} />
              <span className="font-black text-sm">刪除特定期間明細</span>
            </div>
            <ChevronDown size={18} className={`transition-transform duration-200 ${dangerAction === 'date' ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {dangerAction === 'date' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border border-rose-100 bg-rose-50/10 rounded-2xl p-4 flex flex-col gap-4 mt-1"
                style={getFontFamily()}
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#5D4037]/60">開始日期</label>
                    <input 
                      type="date"
                      value={deleteStartDate}
                      onChange={e => setDeleteStartDate(e.target.value)}
                      className="bg-white border border-rose-100 rounded-xl px-3 py-2 text-xs font-bold text-[#5D4037] outline-none shadow-sm focus:border-rose-300"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#5D4037]/60">結束日期</label>
                    <input 
                      type="date"
                      value={deleteEndDate}
                      onChange={e => setDeleteEndDate(e.target.value)}
                      className="bg-white border border-rose-100 rounded-xl px-3 py-2 text-xs font-bold text-[#5D4037] outline-none shadow-sm focus:border-rose-300"
                    />
                  </div>
                </div>

                <button
                  onClick={handleDeleteByDateRange}
                  disabled={isSyncing}
                  className="bg-rose-500 hover:bg-rose-600 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md"
                >
                  <Trash2 size={14} />
                  <span>確認刪除此期間明細</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <button 
            onClick={() => setDangerAction(dangerAction === 'account' ? null : 'account')}
            className={`flex items-center justify-between p-4 rounded-2xl border transition-all active:scale-[0.98] ${
              dangerAction === 'account' ? 'bg-rose-500 border-rose-500 text-white shadow-md' : 'bg-rose-50/30 border-rose-100/50 text-rose-600 hover:bg-rose-50'
            }`}
            style={getFontFamily()}
          >
            <div className="flex items-center gap-3">
              <Database size={20} />
              <span className="font-black text-sm">清空特定帳戶資料</span>
            </div>
            <ChevronDown size={18} className={`transition-transform duration-200 ${dangerAction === 'account' ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {dangerAction === 'account' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border border-rose-100 bg-rose-50/10 rounded-2xl p-4 flex flex-col gap-4 mt-1"
                style={getFontFamily()}
              >
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[#5D4037]/60">選擇要清除的帳戶</label>
                  <select
                    value={selectedDeleteAccountId}
                    onChange={e => setSelectedDeleteAccountId(e.target.value)}
                    className="bg-white border border-rose-100 rounded-xl px-3 py-2 text-xs font-bold text-[#5D4037] outline-none shadow-sm focus:border-rose-300 w-full"
                  >
                    <option value="">-- 請選擇帳戶 --</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.icon && !(acc.icon.startsWith('http') || acc.icon.startsWith('data:image/') || acc.icon.startsWith('/')) ? acc.icon : '💳'} {acc.name} ({acc.currency || 'TWD'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2 bg-white/50 p-3 rounded-xl border border-rose-50">
                  <span className="text-[10px] font-bold text-[#5D4037]/60">刪除範圍選項</span>
                  <div className="flex items-center gap-4 mt-1">
                    <button
                      onClick={() => setDeleteAccountMode('clearOnly')}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                        deleteAccountMode === 'clearOnly'
                          ? 'bg-[#5D4037] text-white border-[#5D4037]'
                          : 'bg-white text-stone-500 border-stone-200'
                      }`}
                    >
                      僅清空交易明細
                    </button>
                    <button
                      onClick={() => setDeleteAccountMode('deleteFull')}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                        deleteAccountMode === 'deleteFull'
                          ? 'bg-rose-500 text-white border-rose-500'
                          : 'bg-white text-stone-500 border-stone-200'
                      }`}
                    >
                      完全刪除帳戶及其明細
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleDeleteAccountData}
                  disabled={isSyncing}
                  className="bg-rose-500 hover:bg-rose-600 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md"
                >
                  <Trash2 size={14} />
                  <span>確認執行清除帳戶資料</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <hr className="border-rose-50 my-1" />

          <button 
            onClick={handleResetAllData}
            disabled={isSyncing}
            className="flex items-center justify-center gap-3 p-4 bg-rose-50 hover:bg-rose-100 rounded-2xl border border-rose-100 shadow-sm transition-all active:scale-[0.98] w-full"
          >
            <Trash2 size={18} className="text-rose-500" />
            <span className="text-sm font-black text-rose-500">重設所有資料</span>
          </button>
        </div>
      </div>
      
      <div className="h-[40px]" />

      <AnimatePresence>
        {showCsvModal && (
          <div 
            className="fixed inset-0 bg-[#5D4037]/60 backdrop-blur-md z-[110] flex items-center justify-center p-6"
            onClick={() => setShowCsvModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              className="bg-[#FFF9E3] rounded-[44px] w-full max-w-sm shadow-2xl relative flex flex-col p-8 border-4 border-white"
              style={getFontFamily()}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                  <Download size={24} className="text-[#5D4037]" />
                </div>
                <h3 className="text-2xl font-black text-[#5D4037]">匯出明細區間</h3>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#5D4037]/40 uppercase tracking-widest px-1">開始日期</label>
                  <input 
                    type="date"
                    value={exportRange.start}
                    onChange={e => setExportRange({ ...exportRange, start: e.target.value })}
                    className="w-full p-4 bg-white border-2 border-stone-100 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#5D4037]/40 uppercase tracking-widest px-1">結束日期</label>
                  <input 
                    type="date"
                    value={exportRange.end}
                    onChange={e => setExportRange({ ...exportRange, end: e.target.value })}
                    className="w-full p-4 bg-white border-2 border-stone-100 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setShowCsvModal(false)}
                    className="flex-1 py-4 bg-stone-100 text-[#5D4037]/60 rounded-2xl font-bold active:scale-95 transition-all text-[15px]"
                  >
                    取消
                  </button>
                  <button 
                    onClick={handleExportCSV}
                    className="flex-1 py-4 bg-[#5D4037] text-white rounded-2xl font-black shadow-lg active:scale-95 transition-all text-[15px]"
                  >
                    確認匯出
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {importPreview && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-[#FFF9E3] rounded-[40px] w-[90%] max-w-2xl shadow-2xl relative flex flex-col max-h-[85vh] overflow-y-auto border-4 border-white"
            style={getFontFamily()}
          >
            {/* Header */}
            <div className="px-8 pt-8 pb-6 bg-white/30 backdrop-blur-md flex-shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-md">
                  <Check size={24} className="text-[#FBC02D]" />
                </div>
                <div>
                  <h3 className="text-[22px] font-black text-[#5D4037] leading-tight">匯入預覽視窗</h3>
                  <p className="text-stone-400 text-sm font-bold mt-0.5">請核對匯入明細是否正確</p>
                </div>
              </div>
            </div>

            {/* Tabs (if there are duplicates) */}
            {importClassification.duplicates.length > 0 && (
              <div className="px-8 pb-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveImportTab('unique')}
                  className={`flex-1 py-3 px-4 rounded-2xl font-black text-xs transition-all shadow-sm border-2 ${
                    activeImportTab === 'unique'
                      ? 'bg-[#5D4037] text-white border-[#5D4037]'
                      : 'bg-white/40 text-stone-400 border-transparent hover:bg-white/60'
                  }`}
                >
                  欲匯入項目 ({importClassification.unique.length} 筆)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveImportTab('duplicates')}
                  className={`flex-1 py-3 px-4 rounded-2xl font-black text-xs transition-all shadow-sm border-2 ${
                    activeImportTab === 'duplicates'
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white/40 text-orange-600/70 border-transparent hover:bg-white/60'
                  }`}
                >
                  重複已跳過 ({importClassification.duplicates.length} 筆)
                </button>
              </div>
            )}

            {/* List */}
            <div className="h-[400px] overflow-y-auto px-6 py-4 space-y-3 flex-shrink-0">
              <div className="flex items-center justify-between px-2 text-[13px] font-black text-[#5D4037]/60 uppercase tracking-widest sticky top-0 bg-[#FFF9E3] py-2 z-10">
                <span>
                  {activeImportTab === 'unique' 
                    ? `欲匯入項目 (${importClassification.unique.length} 筆)` 
                    : `已篩選重複項目 (${importClassification.duplicates.length} 筆)`}
                </span>
                <span>金額</span>
              </div>
              
              <div className="space-y-2">
                {((activeImportTab === 'unique' || importClassification.duplicates.length === 0) 
                  ? importClassification.unique 
                  : importClassification.duplicates
                ).map((r, idx) => (
                  <div key={idx} className="bg-white/60 rounded-2xl p-4 flex items-center gap-3 border border-white shadow-sm relative overflow-hidden">
                    {activeImportTab === 'duplicates' && (
                      <div className="absolute right-0 top-0 bg-orange-100 text-orange-600 font-black text-[9px] px-2.5 py-0.5 rounded-bl-xl border-l border-b border-orange-200">
                        重複已跳過
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black text-[#FBC02D] bg-[#FBC02D]/10 px-2 py-0.5 rounded-full" style={getFontFamily()}>
                          {(() => {
                            const d = r.date || formatLocalDate(new Date());
                            const pd = r.postingDate;
                            if (d.includes('-')) {
                              const parts = d.split('-');
                              const mString = parts.length >= 3 ? `${parts[1]}/${parts[2]}` : d;
                              return pd ? `${mString} (入:${pd.split('-').slice(1).join('/')})` : mString;
                            }
                            return d || '00/00';
                          })()}
                        </span>
                        <span className="text-xs font-bold text-stone-400 truncate">{r.category}</span>
                      </div>
                      <div className="text-[15px] font-black text-[#5D4037] whitespace-pre-wrap break-all leading-relaxed">
                        {r.note || r.category}
                      </div>
                    </div>
                    <div className="text-right">
                      <div 
                        className={`text-[17px] font-black ${
                          r.type === 'transfer' ? 'text-[#5D4037]' : 
                          (r.type === 'income' ? 'text-blue-500' : 'text-rose-500')
                        }`}
                        style={getFontFamily()}
                      >
                        {r.type === 'transfer' ? '' : (r.type === 'income' ? '+' : '-')}
                        ${Math.abs(r.amount).toLocaleString()}
                      </div>
                      <div className="text-base font-black text-[#5D4037]/60 mt-1" style={getFontFamily()}>
                        {r.type === 'transfer' ? (
                          (() => {
                            const sName = r._importSourceAccountName || accounts.find(a => a.id === r.accountId)?.name;
                            const dName = r._importDestAccountName || accounts.find(a => a.id === r.toAccountId)?.name;
                            return (sName && dName && dName !== '-') ? (
                              <div className="flex items-center gap-1" style={getFontFamily()}>
                                <span style={getFontFamily()}>{sName}</span>
                                <span className="text-stone-300" style={getFontFamily()}>→</span>
                                <span style={getFontFamily()}>{dName}</span>
                              </div>
                            ) : (sName || dName || '未知帳戶');
                          })()
                        ) : (
                          r.type === 'income' 
                            ? (r._importDestAccountName || r._importSourceAccountName || accounts.find(a => a.id === r.accountId)?.name)
                            : (r._importSourceAccountName || accounts.find(a => a.id === r.accountId)?.name)
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {((activeImportTab === 'unique' || importClassification.duplicates.length === 0) 
                  ? importClassification.unique 
                  : importClassification.duplicates
                ).length === 0 && (
                  <div className="text-center py-12 text-stone-400 font-bold text-sm bg-white/40 rounded-3xl border border-dashed border-stone-200">
                    {activeImportTab === 'unique' ? '沒有新明細需要匯入' : '無重複明細'}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-8 py-8 pt-4 space-y-3 bg-white/30 backdrop-blur-md flex-shrink-0">
              <div className="bg-[#5D4037]/5 rounded-2xl p-4 mb-2">
                <p className="text-[13px] text-[#5D4037]/80 leading-relaxed font-bold">
                  💡 智慧比對：若資料內容 (日期、分類、金額、帳戶、備註) 完全相同，系統將視為同一筆資料更新；否則會視為新明細匯入。
                </p>
              </div>

              <button 
                onClick={handleConfirmImport}
                disabled={isSyncing || importClassification.unique.length === 0}
                className="w-full bg-[#5D4037] text-white py-5 rounded-[25px] font-black text-[18px] active:scale-95 transition-all shadow-xl hover:bg-[#3E2723] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSyncing ? (
                  <>
                    <Loader2 size={24} className="animate-spin text-[#FFD54F]" />
                    <span>正努力同步明細中...</span>
                  </>
                ) : (
                  importClassification.unique.length === 0 ? '無新明細可匯入' : '確認匯入'
                )}
              </button>
              <button 
                onClick={() => setImportPreview(null)}
                className="w-full text-stone-400 font-bold text-sm py-2 hover:text-[#5D4037] transition-colors"
              >
                取消
              </button>
            </div>
          </motion.div>
        </div>
      )}
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
        className="flex gap-3 overflow-x-auto py-1 scroll-smooth"
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

function RecordModal({ accounts, categories, templates, projects, initialProjectId, onUpdateTemplates, onUpdateCategories, onClose, onSave, selectedDate, records }: { 
  accounts: Account[], 
  categories: Category[],
  templates: Template[], 
  projects: Project[],
  initialProjectId?: string,
  onUpdateTemplates: (t: Template[]) => void,
  onUpdateCategories: (c: Category[]) => void,
  onClose: () => void, 
  onSave: (r: any, keepOpen?: boolean) => void,
  selectedDate: string,
  records: Transaction[]
}) {
  const [tab, setTab] = useState<'template' | 'expense' | 'income' | 'transfer'>('template');
  const [amount, setAmount] = useState('0');
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '');
  const [toAccountId, setToAccountId] = useState(accounts.length > 1 ? accounts[1].id : accounts[0]?.id || '');
  const [mainCategory, setMainCategory] = useState<string | null>(null);
  const [subCategory, setSubCategory] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [fee, setFee] = useState('0');
  const [exchangeRate, setExchangeRate] = useState('1');
  const [toAmount, setToAmount] = useState('0');
  const [isInstallment, setIsInstallment] = useState(false);
  const [totalInstallments, setTotalInstallments] = useState(1);
  const [showCalculator, setShowCalculator] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [isTemplateSortOpen, setIsTemplateSortOpen] = useState(false);

  const sortedTemplates = useMemo(() => {
    return [...templates].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }, [templates]);

  const [consumptionDate, setConsumptionDate] = useState(selectedDate);
  const [postingDate, setPostingDate] = useState(selectedDate);
  const [isPending, setIsPending] = useState(false);
  const [isDateExpanded, setIsDateExpanded] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || 'p1');
  // Ensure currency mode affects new records too
  const [currency, setCurrency] = useState(accounts.find(a => a.id === (tab === 'transfer' ? 'acc1' : 'acc1'))?.currency || 'TWD');

  // For Project Picker Search
  const [isProjectPickerOpen, setIsProjectPickerOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');

  // For Receipt Image Scanning (OCR)
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);

  const parseTaiwanEInvoiceQR = (qrText: string) => {
    try {
      // Taiwan E-invoice QR code format:
      // CW18757179115072112340000002a0000002a0000000056801904XXXXXXXX...**品名:數量:金額
      const match = qrText.match(/^([A-Z]{2}[0-9]{8})([0-9]{7})([0-9]{4})([0-9a-fA-F]{8})([0-9a-fA-F]{8})([0-9]{8})([0-9]{8})/);
      if (!match) return null;

      const invNum = match[1];
      const rocDateStr = match[2];
      const rocYear = parseInt(rocDateStr.substring(0, 3));
      const month = rocDateStr.substring(3, 5);
      const day = rocDateStr.substring(5, 7);
      const year = rocYear + 1911;
      const date = `${year}-${month}-${day}`;

      const totalHex = match[5];
      const amount = parseInt(totalHex, 16);

      let note = '';
      const parts = qrText.split('**');
      if (parts.length > 1) {
        const prodPart = parts[1].trim();
        const tokens = prodPart.split(':');
        const items: { name: string; qty: number; price: number }[] = [];
        
        for (let i = 0; i < tokens.length; i += 3) {
          if (tokens[i] && tokens[i+1] && tokens[i+2]) {
            items.push({
              name: tokens[i].trim(),
              qty: parseInt(tokens[i+1]) || 1,
              price: parseFloat(tokens[i+2]) || 0
            });
          }
        }

        if (items.length > 0) {
          if (items.length === 1) {
            note = items[0].name;
          } else {
            note = `${items[0].name} 等 ${items.length} 項商品`;
          }
        }
      }

      if (!note) {
        note = `電子發票 ${invNum}`;
      }

      return { date, amount, note };
    } catch (err) {
      console.error("QR Parse error", err);
      return null;
    }
  };



  // States for bank groups expanded status
  const [expandedBanks, setExpandedBanks] = useState<{ [key: string]: boolean }>({});
  const [expandedSourceBanks, setExpandedSourceBanks] = useState<{ [key: string]: boolean }>({});
  const [expandedDestBanks, setExpandedDestBanks] = useState<{ [key: string]: boolean }>({});
  const [expandedTemplateFromBanks, setExpandedTemplateFromBanks] = useState<{ [key: string]: boolean }>({});
  const [expandedTemplateToBanks, setExpandedTemplateToBanks] = useState<{ [key: string]: boolean }>({});


  // Helper to render grouped/expandable account selector
  const renderAccountSelector = (
    currentSelectedId: string, 
    onSelect: (id: string) => void, 
    expandedState: { [key: string]: boolean }, 
    setExpandedState: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>,
    keyPrefix: string
  ) => {
    return (
      <AccountSelector 
        accounts={accounts}
        records={records}
        currentSelectedId={currentSelectedId}
        onSelect={onSelect}
        expandedState={expandedState}
        setExpandedState={setExpandedState}
        keyPrefix={keyPrefix}
      />
    );
  };



  const handleScanReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningReceipt(true);

    try {
      // 1. Load jsQR dynamically if not present
      if (!(window as any).jsQR) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      // 2. Preprocess image: detect QR code first, then fallback to OCR preprocessing
      const scanResult = await new Promise<{ qrParsed: any; preprocessedSrc: string }>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const img = new Image();
          img.onload = () => {
            // First attempt to detect QR Code from raw/original image dimensions
            const qrCanvas = document.createElement('canvas');
            qrCanvas.width = img.width;
            qrCanvas.height = img.height;
            const qrCtx = qrCanvas.getContext('2d');
            let qrParsed = null;

            if (qrCtx) {
              qrCtx.drawImage(img, 0, 0);
              const qrImgData = qrCtx.getImageData(0, 0, img.width, img.height);
              try {
                const code = (window as any).jsQR(qrImgData.data, qrImgData.width, qrImgData.height, {
                  inversionAttempts: "dontInvert"
                });
                if (code && code.data) {
                  console.log("QR Code detected:", code.data);
                  qrParsed = parseTaiwanEInvoiceQR(code.data) || { note: code.data };
                }
              } catch (err) {
                console.error("jsQR error:", err);
              }
            }

            // Next, prepare preprocessed source for Tesseract OCR
            const ocrCanvas = document.createElement('canvas');
            const scale = 2.5; // 2.5x upscale for high-definition text
            ocrCanvas.width = img.width * scale;
            ocrCanvas.height = img.height * scale;
            const ocrCtx = ocrCanvas.getContext('2d');
            if (!ocrCtx) {
              resolve({ qrParsed, preprocessedSrc: ev.target?.result as string });
              return;
            }
            ocrCtx.imageSmoothingEnabled = true;
            ocrCtx.imageSmoothingQuality = 'high';
            ocrCtx.drawImage(img, 0, 0, ocrCanvas.width, ocrCanvas.height);

            const imgData = ocrCtx.getImageData(0, 0, ocrCanvas.width, ocrCanvas.height);
            const d = imgData.data;
            for (let i = 0; i < d.length; i += 4) {
              const r = d[i], g = d[i + 1], b = d[i + 2];
              const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
              if (luminance < 190) {
                const factor = 0.7; // Darken text strokes for crisp character boundaries
                d[i] = Math.max(0, r * factor);
                d[i + 1] = Math.max(0, g * factor);
                d[i + 2] = Math.max(0, b * factor);
              }
            }
            ocrCtx.putImageData(imgData, 0, 0);
            resolve({ qrParsed, preprocessedSrc: ocrCanvas.toDataURL('image/png') });
          };
          img.onerror = () => resolve({ qrParsed: null, preprocessedSrc: ev.target?.result as string });
          img.src = ev.target?.result as string;
        };
        reader.readAsDataURL(file);
      });

      let foundAmount = 0;
      let foundDate = '';
      let foundNote = '';
      let foundAccountName = '';
      let isQRCodeScan = false;

      if (scanResult.qrParsed) {
        isQRCodeScan = true;
        const qp = scanResult.qrParsed;
        if (qp.amount) foundAmount = qp.amount;
        if (qp.date) foundDate = qp.date;
        if (qp.note) foundNote = qp.note;
      } else {
        // Fall back to Tesseract OCR
        if (!(window as any).Tesseract) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }

        const result = await (window as any).Tesseract.recognize(scanResult.preprocessedSrc, 'chi_tra+eng');
        const rawText = result.data.text || '';
        console.log('Raw OCR Output:\n', rawText);

        // Clean lines and filter out mobile status bar / system UI garbage
        const lines = rawText
          .split('\n')
          .map((l: string) => l.trim())
          .filter((l: string) => {
            if (!l || l.length < 2) return false;
            if (/^(?:[0-2]?[0-9]:[0-5][0-9]|5G|4G|LTE|WiFi|100%|[0-9]{1,2}%|付款詳細資訊|交易資訊|交易來源|商店資訊)$/i.test(l)) return false;
            if (/^[0-2]?[0-9]:[0-5][0-9]\s*[@\u4e00-\u9fa5]/i.test(l)) return false; // e.g. "20:45 @ 三"
            return true;
          });

        // 1. Amount Extraction (Prioritize total labels: 實際支付金額, 總金額, 合計 across line breaks)
        const priorityAmountMatch = rawText.match(/(?:實際支付金額|總金額|合計|小計)[\s\S]{0,35}?\$?\s*([0-9,]{2,7}(?:\.[0-9]{1,2})?)/i);
        if (priorityAmountMatch) {
          const val = parseFloat(priorityAmountMatch[1].replace(/,/g, ''));
          if (val > 0 && val < 1000000) {
            foundAmount = val;
          }
        }

        if (!foundAmount) {
          const amountRegexes = [
            /(?:NT\$|NTS|NT\s*\$|\$|金額|實付|價格|小計)[\s:]*([0-9,]+(?:\.[0-9]{1,2})?)/gi,
            /([0-9,]+)\s*(?:元|TWD|NTD)/gi
          ];

          for (const rx of amountRegexes) {
            let match;
            while ((match = rx.exec(rawText)) !== null) {
              const numStr = match[1].replace(/,/g, '');
              const val = parseFloat(numStr);
              if (val > 0 && val < 1000000) {
                foundAmount = val;
                break;
              }
            }
            if (foundAmount > 0) break;
          }
        }

        if (!foundAmount) {
          for (const line of lines) {
            const m = line.match(/(?:NT\$|NTS|\$)?\s*([0-9]{1,6})/i);
            if (m && (line.includes('NT') || line.includes('$') || line.includes('元'))) {
              const val = parseFloat(m[1]);
              if (val > 0 && val < 500000) {
                foundAmount = val;
                break;
              }
            }
          }
        }

        // 2. Date Extraction (Prioritize "付款日期" for Line Pay or full timestamp 202X/M/D)
        const payDateMatch = rawText.match(/付款日期[\s\S]{0,25}?([0-9]{4})[/\-.年\s]+(0?[1-9]|1[0-2])[/\-.月\s]+([1-3][0-9]|0[1-9]|[1-9])/i);
        if (payDateMatch) {
          const y = payDateMatch[1];
          const m = payDateMatch[2].padStart(2, '0');
          const d = payDateMatch[3].padStart(2, '0');
          foundDate = `${y}-${m}-${d}`;
        }

        if (!foundDate) {
          const timestampMatch = rawText.match(/(202[0-9])[/\-.年\s]+(0?[1-9]|1[0-2])[/\-.月\s]+([1-3][0-9]|0[1-9]|[1-9])/);
          if (timestampMatch) {
            const y = timestampMatch[1];
            const m = timestampMatch[2].padStart(2, '0');
            const d = timestampMatch[3].padStart(2, '0');
            foundDate = `${y}-${m}-${d}`;
          } else {
            const minguoMatch = rawText.match(/(1[0-2][0-9])[/\-.年\s]+(0?[1-9]|1[0-2])[/\-.月\s]+([1-3][0-9]|0[1-9]|[1-9])/);
            if (minguoMatch) {
              const y = String(parseInt(minguoMatch[1]) + 1911);
              const m = minguoMatch[2].padStart(2, '0');
              const d = minguoMatch[3].padStart(2, '0');
              foundDate = `${y}-${m}-${d}`;
            }
          }
        }

        // Helper to identify and reject company header / tax ID lines
        const isCompanyHeader = (l: string) => {
          return /蝦皮|電商|新加坡|公司|公句|統編|條碼|分公司|地址|代表人|營業人|娛樂/i.test(l);
        };

        // Helper to identify and reject advertisement & footer garbage lines
        const isAdOrGarbage = (l: string) => {
          return /亞培|安素|HMB|體力|免費試用|年過|鎖住|GEL|Clinical|STUDY|Shield|試用包|贊助|廣告|優惠/i.test(l);
        };

        // 3. Product / Note Extraction (Target Shopee 購買品項, E-Invoice 品名, or Line Pay Item)
        // Strategy 0: Product Line with brackets (【...】, [...], (...)) or product spec keywords (cm, ml, kg, 鋼, 樂)
        for (const line of lines) {
          if (isCompanyHeader(line) || isAdOrGarbage(line)) continue;

          // Bracket check (matches 【...】, [...], (...))
          if (/[【\[\(\{].+?[】\]\)\}]/.test(line) && line.length > 5) {
            foundNote = line;
            break;
          }

          // Product spec keywords
          if (/(?:cm|mm|ml|g|kg|不鏽鋼|鋼|雙層|隔熱|雷刻|理想牌|台灣製|優酪乳|客製|無加糖)/i.test(line) && line.length > 5) {
            foundNote = line;
            break;
          }
        }

        // Strategy A: Shopee Invoice ("購買品項")
        if (!foundNote) {
          const shopeeIdx = lines.findIndex(l => l.includes('購買品項') || l.includes('品項'));
          if (shopeeIdx !== -1) {
            for (let k = shopeeIdx + 1; k < Math.min(shopeeIdx + 4, lines.length); k++) {
              const l = lines[k];
              if (!isCompanyHeader(l) && !isAdOrGarbage(l) && !l.includes('總金額') && l.length > 3) {
                foundNote = l;
                break;
              }
            }
          }
        }

        // Strategy B: E-Invoice ("品名")
        if (!foundNote) {
          const itemHeaderIdx = lines.findIndex(l => l.includes('品名') || l.includes('數量') || l.includes('小計'));
          if (itemHeaderIdx !== -1) {
            for (let j = itemHeaderIdx + 1; j < Math.min(itemHeaderIdx + 4, lines.length); j++) {
              const l = lines[j];
              if (!l.includes('共') && !l.includes('合計') && !isCompanyHeader(l) && !isAdOrGarbage(l) && l.length > 2) {
                foundNote = l;
                break;
              }
            }
          }
        }

        // Strategy C: Line Pay Store / Product Name
        if (!foundNote) {
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('(product)') || line.includes('市集') || line.includes('冰淇淋') || line.includes('商店') || line.includes('咔啾') || line.includes('Kaju') || line.includes('味啾') || line.includes('噴啾')) {
              if (!isCompanyHeader(line) && !isAdOrGarbage(line)) {
                foundNote = line;
                break;
              }
            }
          }
        }

        if (!foundNote) {
          const merchantKeywords = ['LINE Pay', '7-ELEVEN', '7-11', '全家', '萊爾富', 'OK超商', '麥當勞', '摩斯', '肯德基', '星巴克', '蝦皮', 'Uber', 'Foodpanda', '中油', '家樂福', '全聯', '寶雅', '屈臣氏', '康是美', '大潤發', '美廉社'];
          for (const line of lines) {
            for (const kw of merchantKeywords) {
              if (line.toLowerCase().includes(kw.toLowerCase()) && !isCompanyHeader(line) && !isAdOrGarbage(line)) {
                foundNote = line;
                break;
              }
            }
            if (foundNote) break;
          }
        }

        // Fallback: exclude company headers, tax IDs, invoice numbers, ad garbage
        if (!foundNote) {
          for (const line of lines) {
            if (/^(?:付款詳細資訊|交易資訊|付款日期|請款日期|交易號碼|商品|付款方式|交易經由|商品價格|實際支付金額|未開獎|發票明細|捐贈發票|購買品項|總金額|備註)$/.test(line)) continue;
            if (isCompanyHeader(line) || isAdOrGarbage(line) || line.includes('CW18') || line.includes('DN-') || line.includes('5680')) continue;
            if (!/^[0-9\s:$/.\-]+$/.test(line) && line.length > 2 && line.length < 60 && !line.includes('202') && !line.includes('NT$')) {
              foundNote = line;
              break;
            }
          }
        }

        // Clean up note text: strip prices ($449x1, $449), quantities, UI icon artifacts, collapse Chinese spaces, fix OCR typos
        if (foundNote) {
          foundNote = foundNote
            .replace(/\$[0-9]+x[0-9]+/gi, '')
            .replace(/\$[0-9]+/gi, '')
            .replace(/x[0-9]+/gi, '')
            .replace(/^[加圖商店 Icon\s]+/g, '')
            .replace(/\[(?:即加|即眾|3270|即眾不回|即加不合|即)/g, '【妤眾不同')
            .replace(/【(?:即加|即眾|3270|即眾不回|即加不合)/g, '【妤眾不同')
            .replace(/代富刻/g, '雷刻')
            .replace(/靈刻/g, '雷刻')
            .replace(/不欠[鋼鍋碗]/g, '不鏽鋼')
            .replace(/不鍛鋼/g, '不鏽鋼')
            .replace(/雙[府飛]/g, '雙層')
            .replace(/隔[替府]/g, '隔熱')
            .replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2')
            .replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2')
            .replace(/\(product\)/gi, '')
            .replace(/(?:噴|嘖|味|咖|口卡)\s*啾/g, '咔啾')
            .trim();
        }

        // 4. Auto-detect Account (e.g. 中國信託 / JCB / 3457 / line pay)
        if (accounts && accounts.length > 0) {
          for (const acc of accounts) {
            const accName = acc.name.toLowerCase();
            if (rawText.includes(acc.name) || (accName.includes('中信') && (rawText.includes('中國信託') || rawText.includes('中信') || rawText.includes('JCB') || rawText.includes('3457'))) || (accName.includes('台新') && rawText.includes('台新')) || (accName.includes('玉山') && rawText.includes('玉山')) || (accName.includes('國泰') && rawText.includes('國泰'))) {
              setSelectedAccountId(acc.id);
              foundAccountName = acc.name;
              break;
            }
          }
        }
      }

      const summaryStr: string[] = [];
      if (foundAmount > 0) {
        setAmount(String(foundAmount));
        summaryStr.push(`金額: $${foundAmount}`);
      }
      if (foundDate) {
        setConsumptionDate(foundDate);
        setPostingDate(foundDate);
        summaryStr.push(`日期: ${foundDate}`);
      }
      if (foundNote) {
        setNote(foundNote);
        summaryStr.push(`備註: ${foundNote}`);
      }
      if (foundAccountName) {
        summaryStr.push(`帳戶: ${foundAccountName}`);
      }

      if (summaryStr.length > 0) {
        alert(isQRCodeScan ? `✨ 成功讀取發票 QR Code！\n\n${summaryStr.join('\n')}` : `✨ 成功辨識交易明細！\n\n${summaryStr.join('\n')}`);
      } else {
        alert("📷 已讀取發票/截圖，未能自動解析出清楚的數字或日期，請手動輸入。");
      }

    } catch (err) {
      console.error("Scan Error:", err);
      alert("辨識圖片時發生錯誤，請重試一次。");
    } finally {
      setIsScanningReceipt(false);
      e.target.value = '';
    }
  };

  // Check if current account is credit card
  const isCreditCard = useMemo(() => {
    const acc = accounts.find(a => a.id === selectedAccountId);
    return acc?.type === 'credit';
  }, [selectedAccountId, accounts]);

  // Reset expansion state when switching to non-credit card accounts
  useEffect(() => {
    if (!isCreditCard) {
      setIsDateExpanded(true);
    }
  }, [isCreditCard]);

  const currentAccount = accounts.find(a => a.id === selectedAccountId);
  const currentToAccount = accounts.find(a => a.id === toAccountId);

  // Synchronize transaction currency with the selected account's currency
  useEffect(() => {
    if (currentAccount) {
      setCurrency(currentAccount.currency || 'TWD');
    }
  }, [selectedAccountId, currentAccount]);

  const rateLabel = useMemo(() => {
    const srcCur = currentAccount?.currency || 'TWD';
    const dstCur = currentToAccount?.currency || 'TWD';
    if (srcCur === 'TWD' && dstCur !== 'TWD') {
      return `匯率 (1 ${dstCur} = ? TWD)`;
    } else if (srcCur !== 'TWD' && dstCur === 'TWD') {
      return `匯率 (1 ${srcCur} = ? TWD)`;
    }
    return `匯率 (1 ${srcCur} = ? ${dstCur})`;
  }, [currentAccount, currentToAccount]);

  // 聯動計算：當金額或匯率改變時，自動更新實收金額 toAmount
  useEffect(() => {
    const hasOperator = /[+\-*/×÷]/.test(amount);
    if (hasOperator) return;

    const amt = parseFloat(amount) || 0;
    const rate = parseFloat(exchangeRate) || 0;
    if (amt > 0 && rate > 0) {
      const srcCur = currentAccount?.currency || 'TWD';
      const dstCur = currentToAccount?.currency || 'TWD';
      
      let calculated = 0;
      if (srcCur === 'TWD' && dstCur !== 'TWD') {
        calculated = amt / rate;
      } else if (srcCur !== 'TWD' && dstCur === 'TWD') {
        calculated = amt * rate;
      } else {
        calculated = amt * rate;
      }

      if (dstCur === 'JPY') {
        setToAmount(Math.round(calculated).toString());
      } else {
        setToAmount(parseFloat(calculated.toFixed(4)).toString());
      }
    } else {
      setToAmount('0');
    }
  }, [amount, exchangeRate, toAccountId, selectedAccountId, accounts, currentAccount, currentToAccount]);

  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showAddSubCategoryModal, setShowAddSubCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('⭐');
  const [newSubCategoryName, setNewSubCategoryName] = useState('');

  const icons = ['⭐', '🍴', '💊', '🚗', '🔌', '🏠', '🎁', '🎓', '🎭', '🎨', '🎬', '🎤', '🎧', '🔭', '🔬', '🧺', '🧼', '🧸', '🧶', '🧵'];

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    const newCat: Category = {
      id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: newCategoryName.trim(),
      icon: newCategoryIcon,
      type: tab === 'income' ? 'income' : 'expense',
      sub: []
    };
    onUpdateCategories([...categories, newCat]);
    setMainCategory(newCat.name);
    setNewCategoryName('');
    setShowAddCategoryModal(false);
  };

  const handleAddSubCategory = () => {
    if (!newSubCategoryName.trim() || !currentMainCat) return;
    const updatedCategories = categories.map(c => {
      if (c.id === currentMainCat.id) {
        return { ...c, sub: [...c.sub, newSubCategoryName.trim()] };
      }
      return c;
    });
    onUpdateCategories(updatedCategories);
    setSubCategory(newSubCategoryName.trim());
    setNewSubCategoryName('');
    setShowAddSubCategoryModal(false);
    setShowCalculator(true);
  };

  const currentMainCat = categories.find(c => c.name === mainCategory);

  const filteredCategories = categories.filter(c => {
    if (tab === 'expense') return c.type === 'expense';
    if (tab === 'income') return c.type === 'income';
    return false;
  });

  const evaluateExpression = (expr: string): string => {
    // 將 × 替換為 *, ÷ 替換為 /
    let cleanExpr = expr.replace(/×/g, '*').replace(/÷/g, '/');
    
    // 只允許數字、小數點和 + - * / 運算子，防止安全與執行期錯誤
    cleanExpr = cleanExpr.replace(/[^0-9.+\-*/()]/g, '');
    
    try {
      // 遞迴移除尾部多餘的運算子，例如 "123+" -> "123"
      while (['+', '-', '*', '/'].includes(cleanExpr.slice(-1))) {
        cleanExpr = cleanExpr.slice(0, -1);
      }
      
      if (!cleanExpr) return '0';
      
      // 使用 Function 進行安全計算
      const result = new Function(`return (${cleanExpr})`)();
      if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
        return '0';
      }
      
      // 限制浮點數精度（十位數），避免例如 0.1 + 0.2 = 0.30000000000000004
      return parseFloat(result.toFixed(10)).toString();
    } catch (e) {
      console.error("Evaluation failed", e);
      return expr;
    }
  };

  const handleSaveAsTemplate = () => {
    const calculatedAmtStr = evaluateExpression(amount);
    const rawAmt = parseFloat(calculatedAmtStr) || 0;
    if (rawAmt === 0) {
      alert("請輸入金額！");
      return;
    }

    const defaultSuggestName = note.trim() || subCategory || mainCategory || "";
    const templateName = window.prompt("請輸入此範本的名稱：", defaultSuggestName);
    if (!templateName || !templateName.trim()) {
      return;
    }

    const catName = subCategory || mainCategory || "其他";
    const cat = categories.find(c => c.name === catName || c.sub.includes(catName));
    const resolvedType = (tab === 'template' ? 'expense' : tab);

    const newTemplate = {
      id: `template_${Date.now()}`,
      name: templateName.trim(),
      amount: Math.abs(rawAmt),
      category: catName,
      type: resolvedType,
      fromAccountId: selectedAccountId,
      toAccountId: resolvedType === 'transfer' ? toAccountId : undefined,
      icon: cat?.icon || (resolvedType === 'transfer' ? '🔄' : '📝'),
      color: 'bg-amber-100',
      note: note.trim() || undefined
    };

    onUpdateTemplates([...templates, newTemplate]);
    alert(`已成功將「${templateName.trim()}」儲存至範本頁！`);
  };

  const handleSaveAndAnother = () => {
    const calculatedAmtStr = evaluateExpression(amount);
    setAmount(calculatedAmtStr);
    
    const rawAmt = parseFloat(calculatedAmtStr) || 0;
    if (rawAmt === 0) {
      alert("請輸入金額！");
      return;
    }
    
    const finalFee = parseFloat(fee) || 0;
    const rate = parseFloat(exchangeRate) || 1;
    
    let resolvedType: 'income' | 'expense' | 'transfer' = tab === 'template' ? 'expense' : tab;
    if (rawAmt < 0) {
      resolvedType = tab === 'transfer' ? 'transfer' : 'expense';
    } else {
      if (tab === 'expense') resolvedType = 'expense';
      else if (tab === 'income') resolvedType = 'income';
      else if (tab === 'transfer') resolvedType = 'transfer';
    }

    const finalAmount = (resolvedType === 'expense' || resolvedType === 'transfer') ? -Math.abs(rawAmt) : Math.abs(rawAmt);
    
    onSave({ 
      amount: finalAmount, 
      fee: finalFee,
      category: subCategory || mainCategory || (resolvedType === 'transfer' ? '轉帳' : '其他'), 
      note: note.trim() || undefined,
      type: resolvedType, 
      accountId: selectedAccountId, 
      toAccountId: resolvedType === 'transfer' ? toAccountId : undefined, 
      toAmount: resolvedType === 'transfer' ? (parseFloat(toAmount) || Math.abs(finalAmount) * rate) : undefined,
      exchangeRate: resolvedType === 'transfer' ? rate : undefined,
      date: consumptionDate,
      postingDate: isPending ? undefined : postingDate,
      isPending: isPending,
      isInstallment,
      totalInstallments: isInstallment ? totalInstallments : undefined,
      projectId: selectedProjectId !== 'p1' ? selectedProjectId : undefined,
      currency
    }, true);

    setAmount('0');
    setToAmount('0');
    setNote('');
    setFee('0');
    setMainCategory(null);
    setSubCategory(null);
    setIsInstallment(false);
    setTotalInstallments(1);
    setConsumptionDate(selectedDate);
    setPostingDate(selectedDate);
    setIsPending(false);
    setSelectedProjectId(initialProjectId || 'p1');
  };

  const handleKey = (key: string) => {
    if (key === 'AC') { setAmount('0'); return; }
    if (key === 'BACKSPACE') {
      if (amount.length > 1) {
        setAmount(amount.slice(0, -1));
      } else {
        setAmount('0');
      }
      return;
    }
    
    if (key === '=') {
      // 鍵盤上的 '=' 鍵點擊時：只計算表達式，更新欄位，不儲存
      setAmount(evaluateExpression(amount));
      return;
    }
    
    if (key === 'SAVE') {
      // 點擊「儲存紀錄」按鈕時：計算並儲存
      const calculatedAmtStr = evaluateExpression(amount);
      setAmount(calculatedAmtStr);
      
      const rawAmt = parseFloat(calculatedAmtStr) || 0;
      if (rawAmt === 0) {
        alert("請輸入金額！");
        return;
      }
      
      const finalFee = parseFloat(fee) || 0;
      const rate = parseFloat(exchangeRate) || 1;
      
      // Smart Sign Parsing:
      let resolvedType: 'income' | 'expense' | 'transfer' = tab === 'template' ? 'expense' : tab;
      if (rawAmt < 0) {
        resolvedType = tab === 'transfer' ? 'transfer' : 'expense';
      } else {
        if (tab === 'expense') resolvedType = 'expense';
        else if (tab === 'income') resolvedType = 'income';
        else if (tab === 'transfer') resolvedType = 'transfer';
      }

      const finalAmount = (resolvedType === 'expense' || resolvedType === 'transfer') ? -Math.abs(rawAmt) : Math.abs(rawAmt);
      
      onSave({ 
        amount: finalAmount, 
        fee: finalFee,
        category: subCategory || mainCategory || (resolvedType === 'transfer' ? '轉帳' : '其他'), 
        note: note.trim() || undefined,
        type: resolvedType, 
        accountId: selectedAccountId, 
        toAccountId: resolvedType === 'transfer' ? toAccountId : undefined, 
        toAmount: resolvedType === 'transfer' ? (parseFloat(toAmount) || Math.abs(finalAmount) * rate) : undefined,
        exchangeRate: resolvedType === 'transfer' ? rate : undefined,
        date: consumptionDate,
        postingDate: isPending ? undefined : postingDate,
        isPending: isPending,
        isInstallment,
        totalInstallments: isInstallment ? totalInstallments : undefined,
        projectId: selectedProjectId !== 'p1' ? selectedProjectId : undefined,
        currency
      }, false);
      return;
    }
    
    // 一般輸入處理
    if (key === '.') {
      if (amount === '0') {
        setAmount('0.');
      } else {
        const lastChar = amount.slice(-1);
        if (['+', '-', '×', '÷'].includes(lastChar)) {
          setAmount(amount + '0.');
        } else {
          const segments = amount.split(/[+\-×÷]/);
          const lastSegment = segments[segments.length - 1];
          if (!lastSegment.includes('.')) {
            setAmount(amount + '.');
          }
        }
      }
      return;
    }

    if (amount === '0') {
      if (['+', '-', '×', '÷'].includes(key)) {
        setAmount('0' + key);
      } else {
        setAmount(key);
      }
    } else {
      const lastChar = amount.slice(-1);
      // 避免連續兩個運算子
      if (['+', '-', '×', '÷'].includes(lastChar) && ['+', '-', '×', '÷'].includes(key)) {
        setAmount(amount.slice(0, -1) + key);
      } else {
        setAmount(amount + key);
      }
    }
  };

  const handleApplyTemplate = (t: Template) => {
    // 1. 自動帶入類型與基本資料
    setTab(t.type);
    setAmount(t.amount.toString());
    setNote(t.note || '');
    
    // 2. 處理分類邏輯
    // 嘗試在現有分類列表中尋找匹配項
    const catName = t.category;
    const catObj = categories.find(c => c.name === catName || (c.sub && c.sub.includes(catName)));
    
    if (catObj) {
      if (catObj.name === catName) {
        setMainCategory(catName);
        setSubCategory(null);
      } else {
        setMainCategory(catObj.name);
        setSubCategory(catName);
      }
    } else {
      // 若分類不存在，則設為 null，由使用者手動補齊
      setMainCategory(null);
      setSubCategory(null);
    }

    // 3. 處理帳戶綁定 (核心 Bug 修正)
    // 優先使用範本記錄的帳戶，若不存在則使用第一個可用帳戶
    if (accounts.some(a => a.id === t.fromAccountId)) {
      setSelectedAccountId(t.fromAccountId);
    } else if (accounts.length > 0) {
      setSelectedAccountId(accounts[0].id);
    }
    
    if (t.toAccountId && accounts.some(a => a.id === t.toAccountId)) {
      setToAccountId(t.toAccountId);
    }

    // 4. 開啟計算機確認介面，不直接關閉 Modal
    setShowCalculator(true);
  };

  const handleSaveTemplateEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate) return;
    
    const finalTemplate = {
      ...editingTemplate,
      amount: parseFloat(editingTemplate.amount as any) || 0
    };

    const exists = templates.find(t => t.id === finalTemplate.id);
    if (exists) {
      onUpdateTemplates(templates.map(t => t.id === finalTemplate.id ? finalTemplate : t));
    } else {
      onUpdateTemplates([...templates, finalTemplate]);
    }
    setEditingTemplate(null);
  };

  const renderTabs = () => (
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
  );

  const renderDateProjectCamera = () => (
    <>
      <label className="flex-shrink-0 w-[68px] h-[68px] sm:w-[76px] sm:h-[76px] bg-[#FFFDF5] hover:bg-[#FFD54F]/20 active:scale-95 transition-all rounded-[24px] border-2 border-[#FFD54F]/60 shadow-sm flex flex-col items-center justify-center cursor-pointer relative overflow-hidden group">
        <input 
          type="file" 
          accept="image/*" 
          capture="environment"
          className="hidden" 
          onChange={handleScanReceipt} 
          disabled={isScanningReceipt}
        />
        {isScanningReceipt ? (
          <div className="flex flex-col items-center gap-1">
            <Loader2 className="w-6 h-6 text-[#5D4037] animate-spin" />
            <span className="text-[9px] font-black text-[#5D4037]">辨識中</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <Camera size={26} className="text-[#5D4037] group-hover:scale-110 transition-transform" />
            <span className="text-[9px] font-black text-[#5D4037]/70">發票掃描</span>
          </div>
        )}
      </label>

      <div className="flex-1 flex flex-col gap-2 min-w-0">
        <AnimatePresence mode="wait">
          {!isCreditCard || (tab !== 'expense' && tab !== 'income') ? (
            <motion.div 
              key="single-date"
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: "auto", marginBottom: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="w-full flex items-center justify-center gap-2 py-2 bg-[#FFFDF5] rounded-2xl border border-[#5D4037]/5 shadow-sm"
              style={getFontFamily()}
            >
              <div className="flex items-center gap-2 text-[13px] font-bold text-[#5D4037]">
                <CalendarIcon size={14} className="text-[#FFD54F]" />
                <span>日期：</span>
                <input 
                  type="date"
                  value={consumptionDate}
                  onChange={e => {
                    setConsumptionDate(e.target.value);
                    setPostingDate(e.target.value);
                  }}
                  className="bg-transparent outline-none cursor-pointer text-[13px] text-[#5D4037]"
                  style={getFontFamily()}
                />
              </div>
            </motion.div>
          ) : isDateExpanded ? (
            <motion.div 
              key="expanded"
              initial={{ opacity: 0, scale: 0.98, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, scale: 1, height: "auto", marginBottom: 0 }}
              exit={{ opacity: 0, scale: 0.98, height: 0, marginBottom: 0 }}
              className="bg-[#FFFDF5] p-3 pb-4 rounded-[22px] border border-stone-100 shadow-sm flex flex-col gap-3 w-full" 
              style={getFontFamily()}
            >
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black text-stone-300 uppercase tracking-widest flex items-center gap-1 px-1">
                    <CalendarIcon size={10} /> 消費日
                  </label>
                  <input 
                    type="date"
                    value={consumptionDate}
                    onChange={e => setConsumptionDate(e.target.value)}
                    className="bg-white border-2 border-stone-50 rounded-xl px-2 py-1 text-xs font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
                  />
                </div>
                <div className={`flex flex-col gap-1 transition-opacity duration-300 ${isPending ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                  <label className="text-[9px] font-black text-stone-300 uppercase tracking-widest flex items-center gap-1 px-1">
                    <Banknote size={10} /> 入帳日
                  </label>
                  <input 
                    type="date"
                    value={postingDate}
                    onChange={e => setPostingDate(e.target.value)}
                    className="bg-white border-2 border-stone-50 rounded-xl px-2 py-1 text-xs font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pl-1">
                <button 
                  onClick={() => setIsDateExpanded(false)}
                  className="text-[#5D4037] text-[10px] font-bold bg-[#FFD54F] px-3 py-1 rounded-full shadow-sm active:scale-95 transition-all"
                >
                  完成
                </button>
                <div className="flex items-center gap-2 pr-1">
                  <span className="text-[10px] font-bold text-stone-400">待入帳</span>
                  <button 
                    onClick={() => setIsPending(!isPending)}
                    className={`w-8 h-4 rounded-full transition-all relative ${isPending ? 'bg-orange-400' : 'bg-stone-200'}`}
                  >
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all ${isPending ? 'left-4.5' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="collapsed"
              initial={{ opacity: 0, y: -5, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto", marginBottom: 0 }}
              exit={{ opacity: 0, y: -5, height: 0, marginBottom: 0 }}
              onClick={() => setIsDateExpanded(true)}
              className="w-full flex items-center justify-center gap-2 py-2 bg-[#FFFDF5] rounded-2xl border border-[#5D4037]/5 cursor-pointer hover:bg-stone-50 transition-colors shadow-sm"
              style={getFontFamily()}
            >
              <div className="flex items-center gap-2 text-[12px] font-bold text-[#5D4037] truncate px-2">
                <CalendarIcon size={13} className="text-[#FFD54F]" />
                <span>消費：{consumptionDate.replace(/-/g, '/')}</span>
                <span className="text-stone-300">|</span>
                <span>入帳：{isPending ? '待入帳' : postingDate.replace(/-/g, '/')}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div 
          onClick={() => setIsProjectPickerOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-2 bg-[#FFFDF5] rounded-2xl border-2 border-[#FFD54F]/30 cursor-pointer hover:bg-[#FFD54F]/5 transition-all shadow-sm animate-fade-in"
          style={getFontFamily()}
        >
          <Layers size={13} className="text-[#FFD54F]" />
          <span className="text-[12px] font-bold text-[#5D4037]">所屬專案：</span>
          <span className="text-[12px] font-black text-[#5D4037] truncate flex items-center gap-1.5">
            <AccountIcon icon={projects.find(p => p.id === selectedProjectId)?.icon || ''} sizeClassName="w-4 h-4" />
            <span>{projects.find(p => p.id === selectedProjectId)?.name || '無特別專案'}</span>
          </span>
        </div>
      </div>
    </>
  );

  const renderCalculator = () => (
    <>
      {/* Confirmation Status Bar */}
      <div 
        onClick={() => {
          if (window.innerWidth < 768) {
            setShowCalculator(false);
          }
        }}
        className="bg-stone-100 px-4 py-2 rounded-xl flex items-center justify-between cursor-pointer md:cursor-default"
      >
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
        <span className="text-[12px] font-bold text-stone-400 md:hidden">編輯 ✎</span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', '.', '0', '=', '+'].map(k => (
          <button 
            key={k}
            onClick={() => handleKey(k)}
            className={`h-14 rounded-xl flex items-center justify-center text-xl font-bold shadow-sm active:scale-95 transition-all ${['÷', '×', '-', '+', '='].includes(k) ? 'bg-[#FFD54F] text-[#5D4037] active:bg-[#FBC02D]' : 'bg-white text-[#5D4037] active:bg-[#FFF9E3]'}`}
          >
            {k}
          </button>
        ))}
      </div>
      
      <div className="grid grid-cols-3 gap-2 mt-2 pb-4">
        <button 
          onClick={handleSaveAsTemplate}
          className="w-full py-4 bg-white border-2 border-stone-200 text-stone-600 rounded-[20px] font-black text-[15px] shadow-sm active:scale-95 hover:bg-stone-50 transition-all flex items-center justify-center gap-1"
        >
          <span>💾</span>
          <span>存為範本</span>
        </button>
        <button 
          onClick={handleSaveAndAnother}
          className="w-full py-4 bg-white border-2 border-[#5D4037] text-[#5D4037] rounded-[20px] font-black text-[15px] shadow-md active:scale-95 hover:bg-stone-50 transition-all"
        >
          再記一筆
        </button>
        <button 
          onClick={() => handleKey('SAVE')}
          className="w-full py-4 bg-[#5D4037] text-white rounded-[20px] font-black text-[15px] shadow-xl active:scale-95 active:bg-[#4E342E] transition-all"
        >
          儲存紀錄
        </button>
      </div>
    </>
  );

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/30 backdrop-blur-md z-50 flex items-end justify-center md:items-center md:p-6"
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        className="bg-[#FFFDF5] w-full max-w-md md:max-w-4xl lg:max-w-5xl rounded-t-[40px] md:rounded-[40px] p-6 flex flex-col gap-4 h-[95vh] md:h-auto max-h-[95vh] md:max-h-[92vh] overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
        style={getFontFamily()}
      >
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6 text-[#5D4037]" />
          </button>
          <span className="text-lg font-bold text-[#5D4037]">記一筆</span>
          <div className="flex items-center gap-1 bg-white px-3 py-1 rounded-full border border-stone-100 shadow-sm opacity-0">
             <CalendarIcon className="w-3 h-3 text-[#5D4037]" />
             <span className="text-[10px] font-bold text-[#5D4037]">{selectedDate.replace(/-/g, '/')}</span>
          </div>
        </div>

        {/* Tabs (Always visible at the top, full width, centered) */}
        <div className={`flex justify-center shrink-0 ${showCalculator ? 'hidden md:flex' : 'flex'}`}>
          {renderTabs()}
        </div>

        {/* Date & Project & Camera Selection Area (Mobile only) */}
        {tab !== 'template' && !showCalculator && (
          <div className="mx-6 flex items-center gap-3 md:hidden shrink-0">
            {renderDateProjectCamera()}
          </div>
        )}

        {/* Scrollable / Grid Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {tab === 'template' ? (
            <div className="flex-1 overflow-y-auto space-y-4 py-2">
              <div className="flex justify-between items-center px-2">
                <span className="text-[20px] font-bold text-[#000000] uppercase">常用範本</span>
                <button 
                  onClick={() => setIsTemplateSortOpen(true)}
                  type="button"
                  className="px-3.5 py-1.5 bg-[#FFFDF5] border border-[#5D4037]/25 rounded-2xl font-black text-xs text-[#5D4037]/80 hover:bg-stone-50 hover:text-[#5D4037] active:scale-95 transition-all flex items-center gap-1.5 shrink-0 shadow-sm animate-fade-in"
                  style={getFontFamily()}
                >
                  <ArrowUpDown size={12} className="text-[#5D4037]/50" />
                  <span>調整順序</span>
                </button>
              </div>
              <HorizontalScrollArea>
                {sortedTemplates.map((t) => (
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
                      id: `tmpl_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                      name: '新範本',
                      amount: 0,
                      category: '食物',
                      type: 'expense',
                      fromAccountId: accounts[0]?.id || '',
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
            <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
              {/* Left Column */}
              <div className={`flex-col gap-5 overflow-y-auto pr-1 md:pr-2 min-h-0 ${showCalculator ? 'hidden md:flex' : 'flex'}`}>


                {/* Date & Project & Camera Selection Area (Desktop only) */}
                <div className="hidden md:flex items-center gap-3 shrink-0">
                  {renderDateProjectCamera()}
                </div>

                {/* Step 1: Account Selection */}
                {tab === 'transfer' ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-2">
                        <span className="text-[18px] font-bold text-[#000000] uppercase">1. 來源帳戶 (錢從哪裡出)</span>
                        <span className="text-[16px] font-bold text-[#000000] bg-[#FFD54F]/20 px-2 py-0.5 rounded-full">
                          {currentAccount?.currency}
                        </span>
                      </div>
                      {renderAccountSelector(selectedAccountId, setSelectedAccountId, expandedSourceBanks, setExpandedSourceBanks, 'source')}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-2">
                        <span className="text-[18px] font-bold text-[#000000] uppercase">2. 目的帳戶 (錢往哪裡去)</span>
                        <span className="text-[16px] font-bold text-[#000000] bg-[#FFD54F]/20 px-2 py-0.5 rounded-full">
                          {currentToAccount?.currency}
                        </span>
                      </div>
                      {renderAccountSelector(toAccountId, setToAccountId, expandedDestBanks, setExpandedDestBanks, 'dest')}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <span className="text-[18px] font-bold text-[#000000] uppercase px-2">1. 選擇帳戶</span>
                    {renderAccountSelector(selectedAccountId, setSelectedAccountId, expandedBanks, setExpandedBanks, 'main')}
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
                          <div className={`w-10 h-10 ${mainCategory === cat.name ? 'bg-white/20' : 'bg-stone-50'} rounded-full flex items-center justify-center text-xl overflow-hidden`}>
                            <AccountIcon icon={cat.icon} sizeClassName="w-6 h-6" />
                          </div>
                          <span className="text-[18px] font-bold text-[#000000] text-center px-1 leading-tight">{cat.name}</span>
                        </button>
                      ))}
                      <button 
                        onClick={() => setShowAddCategoryModal(true)}
                        className="flex-shrink-0 w-20 h-24 rounded-[20px] flex flex-col items-center justify-center gap-2 border-2 border-dashed border-stone-200 bg-[#FDF5E6] text-stone-400 hover:bg-stone-50 transition-all active:scale-95"
                      >
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-xl shadow-sm">
                          <Plus size={20} className="text-[#5D4037]" />
                        </div>
                        <span className="text-[12px] font-bold text-[#5D4037] text-center px-1 leading-tight">新增分類</span>
                      </button>
                    </HorizontalScrollArea>
                  </div>
                )}

                {/* Step 3: Sub Category Selection */}
                {tab !== 'transfer' && mainCategory && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                    <span className="text-[18px] font-bold text-[#000000] uppercase px-2">3. 選擇子分類</span>
                    <HorizontalScrollArea className="px-8">
                      {currentMainCat?.sub.map((sub, i) => (
                        <button 
                          key={`${currentMainCat.id}-sub-${i}`}
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
                      <button 
                        onClick={() => setShowAddSubCategoryModal(true)}
                        className="flex-shrink-0 px-6 h-12 rounded-full font-bold border-2 border-dashed border-stone-200 bg-[#FDF5E6] text-[#5D4037] text-[16px] transition-all hover:bg-stone-50 active:scale-95"
                      >
                        + 新增
                      </button>
                    </HorizontalScrollArea>
                  </motion.div>
                )}
                
                {/* Transfer Mode Auto Trigger (Mobile only) */}
                {tab === 'transfer' && selectedAccountId && toAccountId && !showCalculator && (
                  <div className="flex justify-center py-4 md:hidden">
                    <button 
                      onClick={() => setShowCalculator(true)}
                      className="px-8 py-3 bg-[#5D4037] text-white rounded-full font-bold shadow-lg"
                    >
                      輸入轉帳金額
                    </button>
                  </div>
                )}
              </div>

              {/* Right Column */}
              <div className="flex flex-col gap-5 overflow-y-auto pl-1 md:pl-2 min-h-0">
                {/* Note Input */}
                <div className="space-y-2">
                  <span className="text-[18px] font-bold text-[#000000] uppercase px-2">備註 (買了什麼？)</span>
                  <input 
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#000000] text-[16px] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
                    placeholder="例如：開源社雞排、演唱會周邊"
                  />
                </div>

                {/* Installment Section */}
                {tab === 'expense' && (
                  <div className="space-y-4 bg-white/50 p-4 rounded-2xl border-2 border-white shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[18px] font-bold text-[#000000]">分期付款</span>
                      <button 
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
                              className="w-full p-3 bg-white border-2 border-stone-50 rounded-xl font-bold text-[18px] text-[#000000] outline-none shadow-sm focus:border-[#FFD54F]"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-stone-300 uppercase">每期金額</label>
                            <div className="w-full p-3 bg-stone-50 border-2 border-transparent rounded-xl font-bold text-[18px] text-[#000000]">
                              {Math.round(parseFloat(amount) / totalInstallments)}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* Exchange Rate & Fee Logic */}
                {tab === 'transfer' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 px-2">
                    <div className="grid grid-cols-2 gap-4">
                      {currentAccount?.currency !== currentToAccount?.currency && (
                        <>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-stone-300 uppercase">{rateLabel}</label>
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
                        </>
                      )}
                      
                      {/* Fee Input */}
                      <div className="col-span-2 space-y-2">
                        <label className="text-[12px] font-bold text-stone-300 uppercase px-1">手續費 ({currentAccount?.currency})</label>
                        <input 
                          type="number"
                          value={fee}
                          onChange={e => setFee(e.target.value)}
                          className="w-full p-4 bg-[#FFF9E3] border-2 border-[#FBC02D]/10 rounded-2xl font-black text-[#5D4037] text-[18px] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
                          placeholder="0"
                          style={getFontFamily()}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Amount Box */}
                <div 
                  onClick={() => setShowCalculator(true)}
                  className="bg-white border-2 border-[#FFD54F] rounded-[20px] p-4 flex items-center justify-between shadow-inner cursor-pointer shrink-0"
                >
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">幣別</label>
                    <select 
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-stone-50 border-none outline-none text-xs font-bold text-[#5D4037] px-2 py-1 rounded-lg cursor-pointer"
                      style={getFontFamily()}
                    >
                      <option value="TWD">台幣 (TWD)</option>
                      <option value="USD">美金 (USD)</option>
                      <option value="JPY">日圓 (JPY)</option>
                      <option value="KRW">韓元 (KRW)</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-3xl font-black ${tab === 'income' ? 'text-[#03A9F4]' : tab === 'expense' ? 'text-[#E91E63]' : 'text-[#5D4037]'}`}>{amount}</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleKey('BACKSPACE'); }} 
                      className="w-10 h-10 bg-stone-100 text-stone-500 active:scale-95 active:bg-stone-200 transition-all rounded-full flex items-center justify-center"
                    >
                      <Delete size={18} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleKey('AC'); }} 
                      className="w-10 h-10 bg-rose-50 text-rose-400 active:scale-95 active:bg-rose-100 transition-all rounded-full flex items-center justify-center font-bold text-xs"
                    >
                      AC
                    </button>
                  </div>
                </div>

                {/* Desktop Calculator (Always Visible) */}
                <div className="hidden md:flex flex-col gap-4">
                  {renderCalculator()}
                </div>

                {/* Mobile Calculator (Toggled with animation) */}
                <div className="md:hidden">
                  <AnimatePresence>
                    {showCalculator && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden flex flex-col gap-4"
                      >
                        {renderCalculator()}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Project Selection Modal */}
      <AnimatePresence>
        {isProjectPickerOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#5D4037]/40 backdrop-blur-md"
              onClick={() => setIsProjectPickerOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="relative bg-[#FFFDF5] w-full max-w-sm rounded-[40px] shadow-2xl border-2 border-white overflow-hidden flex flex-col max-h-[80vh]"
              style={getFontFamily()}
            >
              <div className="p-6 pb-2 border-b border-stone-50 flex items-center justify-between">
                <h3 className="text-xl font-black text-[#5D4037]">選取專案</h3>
                <button onClick={() => setIsProjectPickerOpen(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                  <X size={20} className="text-stone-400" />
                </button>
              </div>
              
              <div className="p-4 border-b border-stone-50">
                <div className="relative" onClick={e => e.stopPropagation()} onFocus={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" />
                  <input 
                    value={projectSearch}
                    onChange={e => setProjectSearch(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    onFocus={e => e.stopPropagation()}
                    onTouchStart={e => e.stopPropagation()}
                    placeholder="搜尋專案..."
                    className="w-full pl-10 pr-4 py-3 bg-white border-2 border-stone-50 rounded-2xl text-sm font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                    style={getFontFamily()}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                {projects.filter(p => !p.parentId && (p.name.includes(projectSearch) || projects.some(c => c.parentId === p.id && c.name.includes(projectSearch)))).map(p => {
                  const children = projects.filter(c => c.parentId === p.id && (c.name.includes(projectSearch) || p.name.includes(projectSearch)));
                  return (
                    <div key={p.id} className="space-y-1">
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation();
                          setSelectedProjectId(p.id); 
                          setIsProjectPickerOpen(false); 
                        }}
                        className={`w-full p-4 rounded-3xl flex items-center gap-3 transition-all ${selectedProjectId === p.id ? 'bg-[#FFD54F] shadow-md scale-[1.02]' : 'bg-white hover:bg-[#FFFDF5] shadow-sm border border-stone-50'}`}
                      >
                        <AccountIcon icon={p.icon} sizeClassName="w-5 h-5" className="text-xl flex items-center justify-center" />
                        <span className="font-black text-[#5D4037]">{p.name}</span>
                        {selectedProjectId === p.id && <Check size={18} className="ml-auto text-[#5D4037]" />}
                      </button>
                      {children.map(c => (
                        <button 
                          key={c.id}
                          onClick={(e) => { 
                            e.stopPropagation();
                            setSelectedProjectId(c.id); 
                            setIsProjectPickerOpen(false); 
                          }}
                          className={`w-[90%] ml-auto p-3 rounded-2xl flex items-center gap-3 transition-all ${selectedProjectId === c.id ? 'bg-[#FFEDAE] shadow-md scale-[1.02]' : 'bg-stone-50/50 hover:bg-stone-100 shadow-sm border border-stone-50/50'}`}
                        >
                          <AccountIcon icon={c.icon} sizeClassName="w-4 h-4" className="text-lg flex items-center justify-center" />
                          <span className="font-bold text-[#5D4037] text-sm">{c.name}</span>
                          {selectedProjectId === c.id && <Check size={16} className="ml-auto text-[#5D4037]" />}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                {templates.some(t => t.id === editingTemplate.id) && (
                  <button 
                    onClick={() => {
                      if (window.confirm('確定要刪除此記帳範本嗎？')) {
                        onUpdateTemplates(templates.filter(t => t.id !== editingTemplate.id));
                        setEditingTemplate(null);
                      }
                    }}
                    type="button"
                    className="p-2 text-rose-400 hover:bg-rose-50 rounded-full transition-all active:scale-90"
                    title="刪除範本"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto space-y-5 pr-1">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[14px] font-bold text-stone-600 uppercase px-1">範本名稱</label>
                    <input 
                      value={editingTemplate.name} 
                      onChange={e => setEditingTemplate({...editingTemplate, name: e.target.value})}
                      className="w-full p-3 bg-white border border-stone-100 rounded-xl outline-none font-bold text-sm shadow-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[14px] font-bold text-stone-600 uppercase px-1">預設金額</label>
                    <input 
                      type="number"
                      value={editingTemplate.amount} 
                      onChange={e => setEditingTemplate({...editingTemplate, amount: e.target.value === '' ? '' : (parseFloat(e.target.value) || 0) as any})}
                      className="w-full p-3 bg-white border border-stone-100 rounded-xl outline-none font-bold text-sm shadow-sm"
                    />
                  </div>
                </div>

                {/* Note Info */}
                <div className="flex flex-col gap-1">
                  <label className="text-[14px] font-bold text-stone-600 uppercase px-1">預設備註 (買了什麼？)</label>
                  <input 
                    value={editingTemplate.note || ''} 
                    onChange={e => setEditingTemplate({...editingTemplate, note: e.target.value})}
                    placeholder="例如：開源社雞排"
                    className="w-full p-3 bg-white border border-stone-100 rounded-xl outline-none font-bold text-sm shadow-sm"
                  />
                </div>

                {/* Type Selection */}
                <div className="space-y-2">
                  <label className="text-[14px] font-bold text-stone-600 uppercase px-1">收支類型</label>
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
                  <label className="text-[14px] font-bold text-stone-600 uppercase px-2">
                    {editingTemplate.type === 'transfer' ? '來源帳戶' : '預設帳戶'}
                  </label>
                  {renderAccountSelector(
                    editingTemplate.fromAccountId,
                    (id) => setEditingTemplate({ ...editingTemplate, fromAccountId: id }),
                    expandedTemplateFromBanks,
                    setExpandedTemplateFromBanks,
                    'template-from'
                  )}
                </div>

                {/* Destination Account (Transfer Only) */}
                {editingTemplate.type === 'transfer' && (
                  <div className="space-y-2">
                    <label className="text-[14px] font-bold text-stone-600 uppercase px-2">目的帳戶</label>
                    {renderAccountSelector(
                      editingTemplate.toAccountId || '',
                      (id) => setEditingTemplate({ ...editingTemplate, toAccountId: id }),
                      expandedTemplateToBanks,
                      setExpandedTemplateToBanks,
                      'template-to'
                    )}
                  </div>
                )}

                {/* Category Selection (Non-Transfer) */}
                {editingTemplate.type !== 'transfer' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[14px] font-bold text-stone-600 uppercase px-1">主分類</label>
                      <HorizontalScrollArea>
                        {categories.map(cat => (
                          <button 
                            key={cat.id}
                            onClick={() => setEditingTemplate({...editingTemplate, category: cat.name})}
                            className={`flex-shrink-0 w-20 h-24 rounded-[20px] flex flex-col items-center justify-center gap-2 border-2 transition-all ${
                              editingTemplate.category.split(' > ')[0] === cat.name 
                                ? 'bg-[#5D4037] text-white border-[#5D4037] shadow-md' 
                                : 'bg-white text-stone-400 border-white shadow-sm'
                            }`}
                          >
                            <div className={`w-10 h-10 ${editingTemplate.category.split(' > ')[0] === cat.name ? 'bg-white/20' : 'bg-stone-50'} rounded-full flex items-center justify-center text-xl overflow-hidden`}>
                              <AccountIcon icon={cat.icon} sizeClassName="w-6 h-6" />
                            </div>
                            <span className={`text-[14px] font-bold text-center px-1 leading-tight ${editingTemplate.category.split(' > ')[0] === cat.name ? 'text-white' : 'text-[#000000]'}`}>{cat.name}</span>
                          </button>
                        ))}
                      </HorizontalScrollArea>
                    </div>

                    {/* Sub Category */}
                    <div className="space-y-2">
                      <label className="text-[14px] font-bold text-stone-600 uppercase px-1">子分類</label>
                      <div className="grid grid-cols-3 gap-2">
                        {categories.find(c => c.name === editingTemplate.category.split(' > ')[0])?.sub.map(sub => (
                          <button 
                            key={sub}
                            onClick={() => setEditingTemplate({...editingTemplate, category: `${editingTemplate.category.split(' > ')[0]} > ${sub}`})}
                            className={`py-3.5 px-3 rounded-xl border-2 transition-all text-[15px] font-bold ${
                              editingTemplate.category.includes(sub) 
                                ? 'bg-[#FFD54F] text-[#5D4037] border-[#FFD54F] font-black shadow-sm' 
                                : 'bg-white border-stone-100 text-[#5D4037] active:bg-stone-50 hover:bg-stone-50/50'
                            }`}
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

      {/* Template Sort Modal */}
      <AnimatePresence>
        {isTemplateSortOpen && (
          <TemplateSortModal 
            templates={templates}
            onClose={() => setIsTemplateSortOpen(false)}
            onSave={(newTemplates) => {
              onUpdateTemplates(newTemplates);
            }}
          />
        )}
      </AnimatePresence>

      {/* Add Category Modal */}
      <AnimatePresence>
        {showAddCategoryModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4"
            onClick={() => setShowAddCategoryModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-[#FFF9E3] w-full max-w-sm rounded-[30px] p-6 flex flex-col gap-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-[#5D4037]">新增分類</h3>
                <button onClick={() => setShowAddCategoryModal(false)} className="p-2 hover:bg-black/5 rounded-full">
                  <X size={24} className="text-[#5D4037]" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[12px] font-bold text-[#5D4037]/60 uppercase ml-1">分類名稱</label>
                  <input 
                    autoFocus
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    className="w-full p-4 bg-white border-2 border-[#5D4037]/10 rounded-2xl font-bold text-[#5D4037] text-lg outline-none focus:border-[#FFD54F] transition-all"
                    placeholder="例如：追星、烘焙"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[12px] font-bold text-[#5D4037]/60 uppercase ml-1">選擇圖示</label>
                  <div className="bg-white p-4 rounded-2xl border-2 border-[#5D4037]/10">
                    <div className="grid grid-cols-5 gap-3 max-h-[200px] overflow-y-auto">
                      {icons.map(icon => (
                        <button
                          key={icon}
                          onClick={() => setNewCategoryIcon(icon)}
                          className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-all ${newCategoryIcon === icon ? 'bg-[#FFD54F] scale-110 shadow-md' : 'bg-stone-50 hover:bg-stone-100'}`}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <button 
                onClick={handleAddCategory}
                disabled={!newCategoryName.trim()}
                className="w-full py-5 bg-[#5D4037] text-white rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
              >
                <Check size={20} /> 儲存分類
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Sub Category Modal */}
      <AnimatePresence>
        {showAddSubCategoryModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[90] flex items-center justify-center p-4"
            onClick={() => setShowAddSubCategoryModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-[#FFF9E3] w-full max-w-sm rounded-[30px] p-6 flex flex-col gap-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-[#5D4037]">新增子分類</h3>
                <button onClick={() => setShowAddSubCategoryModal(false)} className="p-2 hover:bg-black/5 rounded-full">
                  <X size={24} className="text-[#5D4037]" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[12px] font-bold text-[#5D4037]/60 uppercase ml-1">子分類名稱 (歸類於 {mainCategory})</label>
                  <input 
                    autoFocus
                    value={newSubCategoryName}
                    onChange={e => setNewSubCategoryName(e.target.value)}
                    className="w-full p-4 bg-white border-2 border-[#5D4037]/10 rounded-2xl font-bold text-[#5D4037] text-lg outline-none focus:border-[#FFD54F] transition-all"
                    placeholder="例如：午餐、追星"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddSubCategory();
                    }}
                  />
                </div>
              </div>

              <button 
                onClick={handleAddSubCategory}
                disabled={!newSubCategoryName.trim()}
                className="w-full py-5 bg-[#5D4037] text-white rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
              >
                <Check size={20} /> 儲存子分類
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

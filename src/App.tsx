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
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  serverTimestamp
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
}

interface Transaction {
  id: string;
  amount: number;      // 原始金額 (來源帳戶幣別)
  category: string;
  note?: string;
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
  isCompleted?: boolean;
  status?: 'active' | 'settled';
  paidCount?: number;
  paidTerms?: number;
  totalTerms?: number;
}

interface Account {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'investment' | 'credit' | 'e-ticket';
  icon: string;
  parentId?: string;
  currency: string;    // 幣別 (如 "TWD", "USD", "JPY")
  closingDay?: number; // 信用卡結帳日 (1-31)
  order?: number;      // 排序權重
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
}

// --- Initial Data ---

const INITIAL_CATEGORIES: Category[] = [
  { id: 'c1', name: '食物', icon: '🍱', type: 'expense', sub: ['早餐', '午餐', '晚餐', '飲料', '零食'] },
  { id: 'c2', name: '交通', icon: '🚗', type: 'expense', sub: ['捷運', '公車', '火車', '加油', '停車'] },
  { id: 'c3', name: '購物', icon: '🛍️', type: 'expense', sub: ['服飾', '日用品', '電子產品', '美妝'] },
  { id: 'c4', name: '娛樂', icon: '🍿', type: 'expense', sub: ['電影', '遊戲', 'KTV', '旅遊'] },
  { id: 'c10', name: '電影', icon: '🎬', type: 'expense', sub: ['威秀電影', '國賓影城', 'Netflix'] },
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
  { id: 'init_cash', amount: 3500, category: '初始資金', date: '2026-04-01', postingDate: '2026-04-01', type: 'income', accountId: 'cash' },
  { id: 'init_bank_1', amount: 150000, category: '初始資金', date: '2026-04-01', postingDate: '2026-04-01', type: 'income', accountId: 'bank_ts_1' },
  { id: 'init_bank_2', amount: 25800, category: '初始資金', date: '2026-04-01', postingDate: '2026-04-01', type: 'income', accountId: 'bank_ts_2' },
  { id: 'init_inv', amount: 450000, category: '初始資金', date: '2026-04-01', postingDate: '2026-04-01', type: 'income', accountId: 'inv_cathay' },
  { id: 'init_credit', amount: 8240, category: '初始資金', date: '2026-04-01', postingDate: '2026-04-01', type: 'expense', accountId: 'credit_ts' },
  { id: 'init_easy', amount: 500, category: '初始資金', date: '2026-04-01', postingDate: '2026-04-01', type: 'income', accountId: 'easycard' },
  { id: 'p_rec_1', amount: 110, category: '日常用品', note: '絲花潤澤化妝棉40片*1.0=$59,絲花潤澤化妝...', date: '2026-05-02', postingDate: '2026-05-02', type: 'expense', accountId: 'cash', projectId: 'p1' },
  { id: 'p_rec_2', amount: 149, category: '美妝保養', note: '醫幸福物語兒童醫用口罩3*1.0=$149', date: '2026-05-02', postingDate: '2026-05-02', type: 'expense', accountId: 'cash', projectId: 'p1' },
  { id: 'p_rec_3', amount: 130, category: '數位服務', note: 'Google Play 應用程式*1.0=$124', date: '2026-05-01', postingDate: '2026-05-01', type: 'expense', accountId: 'bank_ts_1', projectId: 'p1' },
  { id: 'p_rec_4', amount: 130, category: '數位服務', note: 'Google Play 應用程式*1.0=$123', date: '2026-05-01', postingDate: '2026-05-01', type: 'expense', accountId: 'bank_ts_1', projectId: 'p1' },
  { id: 'p_rec_5', amount: 199, category: '數位服務', note: 'YouTube*1.0=$190', date: '2026-05-01', postingDate: '2026-05-01', type: 'expense', accountId: 'bank_ts_1', projectId: 'p1' },
  { id: 'p_rec_6', amount: 5510, category: '演唱會', note: '偶像見面會', date: '2026-05-01', postingDate: '2026-05-01', type: 'income', accountId: 'bank_ts_1', projectId: 'p3' },
  { id: 'p_rec_7', amount: 94322, category: '演唱會', note: '總體花費', date: '2026-05-01', postingDate: '2026-05-01', type: 'expense', accountId: 'bank_ts_1', projectId: 'p3' },
];

const INITIAL_TEMPLATES: Template[] = [
  { id: 't1', name: '火車通勤', amount: 41, category: '交通', type: 'expense', fromAccountId: 'cash', icon: '🚂', color: 'bg-blue-50' },
  { id: 't2', name: '自動加值', amount: 500, category: '交通', type: 'transfer', fromAccountId: 'credit_ts', toAccountId: 'easycard', icon: '⚡', color: 'bg-emerald-50' },
  { id: 't3', name: '薪資收入', amount: 29500, category: '薪資', type: 'income', fromAccountId: 'bank_ts_1', icon: '💼', color: 'bg-amber-50' },
];

const INITIAL_PROJECTS: Project[] = [
  { id: 'p1', name: '無特別專案', icon: '📝' },
  { id: 'p2', name: '骨科', icon: '📝' },
  { id: 'p3', name: '追星', icon: '✈️' },
  { id: 'p4', name: '買手機的錢', icon: '📱' },
  { id: 'p5', name: '旅遊基金', icon: '📝' },
  { id: 'p6', name: '頭髮', icon: '👗' },
  { id: 'p7', name: '飲食(要扣伙食費的錢)', icon: '📝' },
  { id: 'p8', name: '弟弟', icon: '👨‍👩‍👧‍👦' },
  { id: 'p9', name: '股票', icon: '📝' },
  { id: 'p10', name: '利息', icon: '🏠' },
  { id: 'p11', name: '幫家裡的機車加油', icon: '📝' },
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

const getCategoryIcon = (categoryName: string, type: 'income' | 'expense' | 'transfer', categories: Category[]) => {
  if (categoryName === '初始資金') return '💎';
  if (categoryName === '餘額校正') return '🔧';
  
  // Custom mappings for common names that might be subcategories or manual strings
  if (categoryName.includes('電影') || categoryName === '影城' || categoryName === '娛樂') return '🎬';
  if (categoryName === '交通' || categoryName === '公車' || categoryName === '捷運' || categoryName === '火車') return '🚌';
  if (categoryName === '食物' || categoryName.includes('飲食') || categoryName === '晚餐' || categoryName === '午餐' || categoryName === '早餐') return '🍱';
  if (categoryName === '薪資' || categoryName === '月薪' || categoryName === '獎金') return '💼';

  const category = categories.find(c => c.name === categoryName || (c.sub && c.sub.includes(categoryName)));
  if (category) return category.icon;
  
  return type === 'income' ? '💰' : (type === 'expense' ? '🍱' : '🔄');
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'home' | 'reports' | 'more' | 'accounts' | 'calendar' | 'accountDetail' | 'history' | 'fixedRecords' | 'projects' | 'budget' | 'categories' | 'installments'>('home');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
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
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // --- Auth & Firebase Logic ---

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      if (!u) {
        // Reset state to initial local data on logout
        setRecords(INITIAL_RECORDS);
        setAccounts(INITIAL_ACCOUNTS);
        setCategories(INITIAL_CATEGORIES);
        setProjects(INITIAL_PROJECTS);
        setTemplates(INITIAL_TEMPLATES);
        setFixedRecords([]);
        setInstallments([]);
        setMonthlyBudget(30000);
      }
    });
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  // Real-time synchronization
  useEffect(() => {
    if (!user) return;

    const unsubRecords = onSnapshot(collection(db, 'users', user.uid, 'records'), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Transaction);
      // Removed Length check to allow clearing records locally when DB is empty
      setRecords(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/records`));

    const unsubAccounts = onSnapshot(collection(db, 'users', user.uid, 'accounts'), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Account);
      if (snapshot.docs.length > 0) setAccounts(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/accounts`));

    const unsubCategories = onSnapshot(collection(db, 'users', user.uid, 'categories'), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Category);
      if (snapshot.docs.length > 0) setCategories(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/categories`));

    const unsubProjects = onSnapshot(collection(db, 'users', user.uid, 'projects'), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Project);
      if (snapshot.docs.length > 0) setProjects(data);
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
      if (snapshot.docs.length > 0) setTemplates(data);
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
      const batch = writeBatch(db);
      
      categories.forEach(item => {
        batch.set(doc(db, 'users', user.uid, 'categories', item.id), cleanData(item));
      });
      accounts.forEach(item => {
        batch.set(doc(db, 'users', user.uid, 'accounts', item.id), cleanData(item));
      });
      records.forEach(item => {
        batch.set(doc(db, 'users', user.uid, 'records', item.id), cleanData(item));
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

  const handleUpdateCategories = async (newCats: Category[]) => {
    if (user) {
      // Find what changed
      const batch = writeBatch(db);
      newCats.forEach(cat => {
        batch.set(doc(db, 'users', user.uid, 'categories', cat.id), cleanData(cat));
      });
      await batch.commit().catch(e => handleFirestoreError(e, OperationType.WRITE, 'batch/categories'));
    } else {
      setCategories(newCats);
    }
  };

  const handleUpdateTemplates = async (newTemplates: Template[]) => {
    if (user) {
      const batch = writeBatch(db);
      newTemplates.forEach(t => {
        batch.set(doc(db, 'users', user.uid, 'templates', t.id), cleanData(t));
      });
      await batch.commit().catch(e => handleFirestoreError(e, OperationType.WRITE, 'batch/templates'));
    } else {
      setTemplates(newTemplates);
    }
  };

  const handleUpdateProjects = async (newProjects: Project[]) => {
    if (user) {
      const batch = writeBatch(db);
      newProjects.forEach(p => {
        batch.set(doc(db, 'users', user.uid, 'projects', p.id), cleanData(p));
      });
      await batch.commit().catch(e => handleFirestoreError(e, OperationType.WRITE, 'batch/projects'));
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
        if (now.getDate() === fr.day && now.getMonth() === 0) { 
          if (!lastProcessed || lastProcessed.getFullYear() !== now.getFullYear()) {
            shouldProcess = true;
          }
        }
      }

      if (shouldProcess) {
        const id = `fixed_${fr.id}_${todayStr}`;
        const newTransaction: Transaction = {
          id,
          amount: fr.amount,
          category: fr.category,
          note: `[固定收支] ${fr.name}`,
          date: todayStr,
          type: fr.type,
          accountId: fr.accountId
        };
        recordsToSync.push(newTransaction);
        changed = true;
        return { ...fr, lastProcessedDate: todayStr };
      }
      return fr;
    });

    if (changed) {
      if (user) {
        const batch = writeBatch(db);
        recordsToSync.forEach(r => batch.set(doc(db, 'users', user.uid, 'records', r.id), cleanData(r)));
        updatedFixed.forEach(f => batch.set(doc(db, 'users', user.uid, 'fixedRecords', f.id), cleanData(f)));
        await batch.commit().catch(e => handleFirestoreError(e, OperationType.WRITE, 'batch/fixed_sync'));
      } else {
        setRecords(prev => [...prev, ...recordsToSync]);
        setFixedRecords(updatedFixed);
      }
    }
  };

  useEffect(() => {
    checkFixedRecords();
  }, [selectedDate]);

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
    // Recursive Balance Calculation
    const getBaseBalance = (id: string) => {
      let bal = 0;
      records.forEach(r => {
        if (!r.postingDate) return;
        if (r.type === 'income' && r.accountId === id) bal += r.amount;
        if (r.type === 'expense' && r.accountId === id) bal -= r.amount;
        if (r.type === 'transfer') {
          if (r.accountId === id) bal -= r.amount;
          if (r.toAccountId === id) bal += (r.toAmount ?? (r.amount * (r.exchangeRate || 1)));
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
    const balances: Record<string, number> = {};
    accounts.forEach(acc => {
      let bal = 0;
      records.forEach(r => {
        if (!r.postingDate) return;
        if (r.type === 'income' && r.accountId === acc.id) bal += r.amount;
        if (r.type === 'expense' && r.accountId === acc.id) bal -= r.amount;
        if (r.type === 'transfer') {
          if (r.accountId === acc.id) bal -= r.amount;
          if (r.toAccountId === acc.id) bal += (r.toAmount ?? (r.amount * (r.exchangeRate || 1)));
        }
      });
      balances[acc.id] = bal;
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
    const yearStr = selectedDate.substring(0, 4);
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Calculate week range (Monday to Sunday)
    const base = parseLocalDate(selectedDate);
    const day = base.getDay();
    const diff = base.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    const startOfWeek = new Date(base);
    startOfWeek.setDate(diff);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const startOfWeekStr = formatLocalDate(startOfWeek);
    const endOfWeekStr = formatLocalDate(endOfWeek);

    // Filter out initial balance records from statistics
    const filteredRecords = records;
    
    // Monthly/Weekly/Daily stats now use postingDate
    const daily = filteredRecords.filter(r => (r.postingDate || r.date) === selectedDate);
    const weekly = filteredRecords.filter(r => {
      const pDate = r.postingDate || r.date;
      return pDate >= startOfWeekStr && pDate <= endOfWeekStr;
    });
    const monthly = filteredRecords.filter(r => (r.postingDate || r.date).startsWith(monthStr));
    const yearly = filteredRecords.filter(r => (r.postingDate || r.date).startsWith(yearStr));
    
    return {
      daily: {
        expense: daily.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0),
        income: daily.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0),
      },
      weekly: {
        expense: weekly.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0),
        income: weekly.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0),
      },
      monthly: {
        expense: monthly.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0),
        income: monthly.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0),
      },
      yearly: {
        expense: yearly.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0),
        income: yearly.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0),
      }
    };
  }, [records, selectedDate]);

  const handleSaveRecord = async (record: Omit<Transaction, 'id'>) => {
    if (record.isInstallment && record.totalInstallments && record.totalInstallments > 1) {
      const installmentGroupId = Date.now().toString();
      const perAmount = Math.round(record.amount / record.totalInstallments);
      const startDate = new Date(record.date);
      
      const batch = user ? writeBatch(db) : null;

      for (let i = 1; i <= record.totalInstallments; i++) {
        const currentDate = new Date(startDate.getFullYear(), startDate.getMonth() + (i - 1), startDate.getDate());
        const dateStr = formatLocalDate(currentDate);
        
        const id = `${installmentGroupId}-${i}`;
        const newPart: Transaction = {
          ...record,
          id,
          amount: perAmount,
          note: `${record.note || ''} (分期 ${i}/${record.totalInstallments})`.trim(),
          date: record.date,
          postingDate: dateStr,
          currentInstallment: i,
          installmentGroupId
        };

        if (batch && user) {
          batch.set(doc(db, 'users', user.uid, 'records', id), cleanData(newPart));
        } else {
          setRecords(prev => [...prev, newPart]);
        }
      }
      if (batch) await batch.commit().catch(e => handleFirestoreError(e, OperationType.WRITE, 'batch/records'));
    } else {
      const id = Date.now().toString();
      const newRecord = { ...record, id };
      if (user) {
        await syncToCloud('records', newRecord, id);
      } else {
        setRecords(prev => [...prev, newRecord]);
      }
    }
    setIsRecordModalOpen(false);
  };

  const handleUpdateRecord = async (oldRecord: Transaction, newRecord: Transaction) => {
    if (user) {
      await syncToCloud('records', newRecord, newRecord.id);
    } else {
      setRecords(prev => prev.map(r => r.id === newRecord.id ? newRecord : r));
    }
  };

  const [recordToDelete, setRecordToDelete] = useState<Transaction | null>(null);

  const handleDeleteRecord = (record: Transaction) => {
    setRecordToDelete(record);
  };

  const confirmDeleteRecord = async () => {
    if (!recordToDelete) return;
    const targetId = recordToDelete.id;
    
    // 1. 樂觀 UI (Optimistic UI): 立即從本地介面移除
    setRecords(prev => prev.filter(r => r.id !== targetId));
    
    // 2. 執行背景異步刪除
    if (user) {
      try {
        await deleteFromCloud('records', targetId);
      } catch (error) {
        console.error('Delete failed:', error);
        alert('同步刪除失敗，請檢查網路連線或稍後再試。');
        // 註：由於有 onSnapshot 即時同步，若雲端未成功刪除，該筆資料隨後會被 Snapshot 帶回
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
      currency: 'TWD'
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
    if (user) {
      await syncToCloud('accounts', updatedAcc, updatedAcc.id);
    } else {
      setAccounts(prev => {
        const exists = prev.find(a => a.id === updatedAcc.id);
        if (exists) {
          return prev.map(a => a.id === updatedAcc.id ? updatedAcc : a);
        } else {
          return [...prev, updatedAcc];
        }
      });
    }
    
    if (initialAmount !== undefined) {
      const existingInit = records.find(r => r.accountId === updatedAcc.id && r.category === '初始資金');
      const id = existingInit ? existingInit.id : `init_${updatedAcc.id}_${Date.now()}`;
      const initRecord: Transaction = {
        id,
        amount: Math.abs(initialAmount),
        category: '初始資金',
        date: formatLocalDate(new Date()),
        type: initialAmount >= 0 ? 'income' : 'expense',
        accountId: updatedAcc.id
      };

      if (user) {
        await syncToCloud('records', initRecord, id);
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

    if (selectedAccountForDetail?.id === updatedAcc.id) {
      setSelectedAccountForDetail(updatedAcc);
    }
    setIsAccountEditModalOpen(false);
    setEditingAccount(null);
  };

  const handleSaveProject = async (p: Project) => {
    if (user) {
      await syncToCloud('projects', p, p.id);
    } else {
      setProjects(prev => {
        if (prev.find(x => x.id === p.id)) {
          return prev.map(x => x.id === p.id ? p : x);
        } else {
          return [...prev, p];
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
                else if (currentView === 'projects' && selectedProjectId) setSelectedProjectId(null);
                else setCurrentView('home');
              }}
              className="p-1 -ml-1 hover:bg-white/50 rounded-full transition-colors"
            >
              <ChevronLeft className="w-7 h-7 text-[#5D4037]" />
            </button>
          )}
          <div className="text-[24px] font-bold text-[#5D4037]" style={{ fontFamily: '"王漢宗中隸書", "王漢宗", sans-serif' }}>{headerTitle}</div>
          
          <div className="flex items-center gap-2">
            {currentView === 'projects' && (
              <div className="flex items-center gap-1">
                {selectedProjectId ? (
                  <>
                    <button className="p-2 hover:bg-white/50 rounded-full transition-colors"><Settings2 size={24} className="text-[#5D4037]" /></button>
                  </>
                ) : (
                  <>
                    <button className="p-2 hover:bg-white/50 rounded-full transition-colors"><Layers size={24} className="text-[#5D4037]" /></button>
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
            ) : (
              !['projects'].includes(currentView) && (
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
                            <span className="font-bold text-sm" style={{ fontFamily: '"王漢宗中隸書", "王漢宗", sans-serif' }}>日曆模式</span>
                          </button>
                          <button 
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-stone-50 transition-colors text-[#5D4037]"
                            onClick={() => { setIsAccountSortModalOpen(true); setIsMoreMenuOpen(false); }}
                          >
                            <span className="text-lg font-bold text-stone-400 w-[18px] flex justify-center">☰↑</span>
                            <span className="font-bold text-sm" style={{ fontFamily: '"王漢宗中隸書", "王漢宗", sans-serif' }}>帳戶排序</span>
                          </button>
                          <button 
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-stone-50 transition-colors text-[#5D4037]"
                            onClick={() => { 
                              handleAddAccount();
                              setIsMoreMenuOpen(false);
                            }}
                          >
                            <Plus size={18} className="text-stone-400" />
                            <span className="font-bold text-sm" style={{ fontFamily: '"王漢宗中隸書", "王漢宗", sans-serif' }}>新增帳戶</span>
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
                      <span className="text-xl font-black text-[#5D4037] leading-tight" style={{ fontFamily: '"王漢宗中隸書", "王漢宗", sans-serif' }}>
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
                      style={{ fontFamily: '"王漢宗中隸書", "王漢宗", sans-serif' }}
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
                monthlyBudget={monthlyBudget}
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
                onAddAccount={handleAddAccount}
                balances={accountBalances}
              />
            )}
            {currentView === 'accountDetail' && selectedAccountForDetail && (
              <AccountDetailView 
                account={selectedAccountForDetail}
                records={records}
                selectedDate={selectedDate}
                onBack={() => {
                  setSelectedAccountForDetail(null);
                  setCurrentView('accounts');
                }}
                onEdit={() => {
                  setEditingAccount(selectedAccountForDetail);
                  setIsAccountEditModalOpen(true);
                }}
                onUpdateRecord={handleUpdateRecord}
                onDeleteRecord={handleDeleteRecord}
                accounts={accounts}
                projects={projects}
                balance={accountBalances[selectedAccountForDetail.id] || 0}
                categories={categories}
              />
            )}
            {currentView === 'history' && (
              <HistoryView 
                records={records} 
                accounts={accounts} 
                categories={categories}
                projects={projects}
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
              <PlaceholderView 
                title="預算管理" 
                icon={<PieChart size={48} />} 
                onBack={() => setCurrentView('home')} 
                content={
                  <div className="flex flex-col gap-4 mt-8">
                    <span className="text-[#5D4037] font-bold">目前每月預算：$ {monthlyBudget.toLocaleString()}</span>
                    <input 
                      type="range" min="5000" max="100000" step="5000"
                      value={monthlyBudget}
                      onChange={(e) => {
                        const b = parseInt(e.target.value);
                        setMonthlyBudget(b);
                        syncBudgetToCloud(b);
                      }}
                      className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-[#5D4037]"
                    />
                    <p className="text-xs text-stone-400">變更後將自動同步到雲端</p>
                  </div>
                }
              />
            )}
            {currentView === 'categories' && <CategoryManagementPage categories={categories} onSave={handleUpdateCategories} onBack={() => setCurrentView('home')} />}
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
                    const filtered = updatedRecords.filter(r => r.installmentGroupId !== groupId || r.date <= today);
                    
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
            {currentView === 'calendar' && (
              <CalendarView 
                records={records} 
                accounts={accounts}
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
                setInstallments={setInstallments}
                setProjects={setProjects}
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
                style={{ fontFamily: '"王漢宗中隸書", "王漢宗", sans-serif' }}
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

      <div className="bg-white rounded-[30px] p-6 shadow-sm border-2 border-white grid grid-cols-3 text-center items-center">
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
    // Sort all accounts by order first
    const sortedRawAccounts = [...accounts].sort((a, b) => (a.order || 0) - (b.order || 0));
    const topLevelAccounts = sortedRawAccounts.filter(a => !a.parentId);
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
      style={{ fontFamily: '"王漢宗中隸書", "王漢宗", sans-serif' }}
    >
      {/* Top Dashboard (CW Money Style) */}
      <div className="px-6 py-8 bg-[#FFF9E3]">
        <div className="flex justify-between items-start mb-2" style={{ fontFamily: '"王漢宗中隸書", "王漢宗", sans-serif' }}>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-[#5D4037]">淨資產</span>
              <button onClick={() => setShowAmounts(!showAmounts)} className="text-[#5D4037]/60 hover:text-[#5D4037]">
                {showAmounts ? <Eye size={20} /> : <EyeOff size={20} />}
              </button>
            </div>
            <div className="text-4xl font-black text-[#5D4037] tracking-tight mt-2">
              <span className="text-2xl mr-2">$</span>{formatAmount(netAssets)}
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
      <div className="flex flex-col gap-8 px-4 pb-24">
        {(Object.entries(groupedAccounts) as [Account['type'], any[]][]).map(([type, typeAccounts]) => {
          const typeTotal = typeAccounts.reduce((sum, acc) => {
            if (acc.isBrandGroup) {
              return sum + acc.childAccounts.reduce((cSum: number, c: Account) => cSum + (balances[c.id] || 0), 0);
            }
            return sum + (balances[acc.id] || 0);
          }, 0);

          return (
            <div key={type} className="flex flex-col gap-4">
              {/* Group Header */}
              <div className="px-2 flex justify-between items-end border-b border-[#5D4037]/10 pb-2">
                <span className="text-lg font-black text-[#5D4037]">{accountTypeLabels[type]}</span>
                <span className={`text-sm font-bold text-stone-400`}>
                  合計 $ {formatAmount(typeTotal)}
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
                  const displayAmount = isBrandGroup 
                    ? acc.childAccounts.reduce((sum: number, c: Account) => sum + (balances[c.id] || 0), 0)
                    : (balances[acc.id] || 0);

                  return (
                    <div key={acc.id} className="flex flex-col gap-3">
                      {/* Level 1 Card: Group Total */}
                      <div 
                        onClick={() => !isBrandGroup && onAccountClick(acc as Account)}
                        className={`bg-white p-4 sm:p-5 rounded-[32px] shadow-sm border-2 border-stone-50 flex flex-row items-center gap-3 sm:gap-4 group transition-all relative overflow-hidden ${!isBrandGroup ? 'cursor-pointer active:scale-[0.98]' : ''}`}
                      >
                        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-[#FFFDF5] rounded-2xl flex-shrink-0 flex items-center justify-center text-2xl sm:text-3xl shadow-sm border border-white">
                          {acc.icon}
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="text-[10px] sm:text-xs font-bold text-stone-300 uppercase tracking-widest mb-1 leading-none truncate">
                            {isBrandGroup ? `${acc.name}總額` : (acc.type === 'bank' ? `${acc.name}總額` : accountTypeLabels[acc.type as Account['type']])}
                          </span>
                          <span className="text-lg sm:text-xl font-black text-[#5D4037] leading-tight truncate">{acc.name}</span>
                          <span className={`text-xl sm:text-[26px] font-black mt-1 ${displayAmount < 0 ? 'text-rose-400' : 'text-[#5D4037]'}`}>
                            <span className="text-base sm:text-lg mr-1">$</span>{formatAmount(displayAmount)}
                          </span>
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
                                      className="flex-1 bg-white/80 p-3 sm:p-4 rounded-[24px] border border-white flex flex-row items-center gap-2 sm:gap-3 cursor-pointer active:scale-95 transition-all shadow-sm overflow-hidden"
                                    >
                                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-xl flex-shrink-0 flex items-center justify-center text-lg sm:text-xl shadow-inner">
                                        {l2acc.icon}
                                      </div>
                                      <div className="flex flex-col flex-1 min-w-0 justify-center">
                                        {l2acc.type !== 'credit' && l2acc.type !== 'e-ticket' && (
                                          <span className="text-[9px] sm:text-[10px] font-bold text-stone-300 uppercase tracking-widest leading-none mb-0.5 truncate">
                                            主帳號
                                          </span>
                                        )}
                                        <span className="text-sm sm:text-base font-black text-[#5D4037] leading-tight truncate">{l2acc.name}</span>
                                        <div className={`text-base sm:text-lg font-black mt-0.5 ${balances[l2acc.id] < 0 ? 'text-rose-400' : 'text-[#5D4037]'}`}>
                                          <span className="text-xs mr-1">$</span>{formatAmount(balances[l2acc.id] || 0)}
                                        </div>
                                      </div>
                                      {hasLevel3 && (
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleGroup(l2acc.id, e);
                                          }}
                                          className={`w-6 h-6 rounded-full flex items-center justify-center text-stone-400 transition-colors ${isL2Expanded ? 'bg-stone-100' : ''}`}
                                        >
                                          <motion.div animate={{ rotate: isL2Expanded ? 180 : 0 }}>
                                            <ChevronDown size={14} />
                                          </motion.div>
                                        </button>
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
                                              className="flex-1 bg-white/40 p-2 sm:p-3 rounded-[20px] border border-white/50 flex flex-row items-center gap-2 sm:gap-3 cursor-pointer active:scale-95 transition-all overflow-hidden"
                                            >
                                              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-white/80 rounded-lg flex-shrink-0 flex items-center justify-center text-base sm:text-lg shadow-sm">
                                                {l3acc.icon}
                                              </div>
                                              <div className="flex flex-col flex-1 min-w-0 justify-center">
                                                {l3acc.type !== 'credit' && l3acc.type !== 'e-ticket' && (
                                                  <span className="text-[8px] sm:text-[9px] font-bold text-stone-300 uppercase tracking-widest leading-none mb-0.5 truncate">子帳戶</span>
                                                )}
                                                <span className="text-xs sm:text-sm font-bold text-[#5D4037] leading-tight truncate">{l3acc.name}</span>
                                                <div className={`text-sm sm:text-base font-black ${balances[l3acc.id] < 0 ? 'text-rose-400' : 'text-[#5D4037]'}`}>
                                                  <span className="text-xs mr-1">$</span>{formatAmount(balances[l3acc.id] || 0)}
                                                </div>
                                              </div>
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

function AccountDetailView({ account, records, selectedDate, onBack, onEdit, onUpdateRecord, onDeleteRecord, accounts, projects, balance, categories }: { 
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
  categories: Category[]
}) {
  const [editingRecord, setEditingRecord] = useState<Transaction | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date(selectedDate);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

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
  
  const accountRecords = useMemo(() => {
    const childrenIds = accounts.filter(c => c.parentId === account.id).map(c => c.id);
    const targetIds = [account.id, ...childrenIds];
    const targetYearMonth = dateRangeStrings.filter;
    
    return records.filter(r => 
      (targetIds.includes(r.accountId) || (r.toAccountId && targetIds.includes(r.toAccountId))) && 
      r.category !== '初始資金' &&
      (
        (r.postingDate && r.postingDate.startsWith(targetYearMonth)) ||
        (!r.postingDate && r.isPending && r.date.startsWith(targetYearMonth))
      )
    )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [records, account.id, accounts, dateRangeStrings.filter]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full bg-[#FFF9E3]"
      style={{ fontFamily: '"王漢宗中隸書", "王漢宗", sans-serif' }}
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
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#5D4037] rounded-lg flex items-center justify-center">
                <History size={14} className="text-white" />
              </div>
              <span className="font-black text-base text-[#5D4037]">往來明細</span>
            </div>
            <span className="text-[13px] font-black text-stone-400 bg-white px-5 py-2 rounded-full border border-stone-100 flex items-center gap-2 shadow-sm" style={{ fontFamily: '"王漢宗中隸書", "王漢宗", sans-serif' }}>
              <span>{accountRecords.length} 筆紀錄</span>
              <span className="text-stone-200 font-normal">|</span>
              <span>結餘：<span className={`font-black ${accountRecords.reduce((sum, r) => r.type === 'income' ? sum + r.amount : r.type === 'expense' ? sum - r.amount : sum, 0) >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                ${Math.abs(accountRecords.reduce((sum, r) => r.type === 'income' ? sum + r.amount : r.type === 'expense' ? sum - r.amount : sum, 0)).toLocaleString()}
              </span></span>
            </span>
          </div>
          
          {/* Month Switcher Row */}
          <div className="flex items-center justify-center gap-4 bg-white/40 py-2 rounded-2xl mx-1">
            <button 
              onClick={() => changeMonth(-1)}
              className="w-8 h-8 flex items-center justify-center text-[#5D4037] hover:bg-white/60 rounded-full transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-stone-500 font-bold text-sm tracking-tighter">
              {dateRangeStrings.range}
            </span>
            <button 
              onClick={() => changeMonth(1)}
              className="w-8 h-8 flex items-center justify-center text-[#5D4037] hover:bg-white/60 rounded-full transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
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
                    {/* Line 1: Title */}
                    <span className="font-black text-lg text-[#5D4037] truncate leading-tight">
                      {record.note || record.category}
                    </span>
                    
                    {/* Line 2: Date & Account Info */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-stone-300">
                        {record.postingDate ? `入帳: ${record.postingDate}` : `消費: ${record.date}`}
                      </span>
                      {account.type === 'credit' && (!record.postingDate || record.isPending) && (
                        <span className="text-[10px] px-2 py-0.5 bg-orange-100 text-orange-500 rounded-full font-bold">
                          未入帳
                        </span>
                      )}
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

function EditRecordModal({ record, accounts, projects, onClose, onSave, onDelete }: {
  record: Transaction,
  accounts: Account[],
  projects: Project[],
  onClose: () => void,
  onSave: (updated: Transaction) => void,
  onDelete: () => void
}) {
  const [edited, setEdited] = useState<Transaction>({ ...record });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isProjectPickerOpen, setIsProjectPickerOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');

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
        style={{ fontFamily: '"王漢宗中隸書", "王漢宗", sans-serif' }}
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
                style={{ fontFamily: '"王漢宗中隸書", "王漢宗", sans-serif' }}
              >
                <div className="p-6 pb-2 border-b border-stone-50 flex items-center justify-between">
                  <h3 className="text-xl font-black text-[#5D4037]">選取專案</h3>
                  <button onClick={() => setIsProjectPickerOpen(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                    <X size={20} className="text-stone-400" />
                  </button>
                </div>
                
                <div className="p-4 border-b border-stone-50">
                  <div className="relative">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" />
                    <input 
                      value={projectSearch}
                      onChange={e => setProjectSearch(e.target.value)}
                      placeholder="搜尋專案..."
                      className="w-full pl-10 pr-4 py-3 bg-white border-2 border-stone-50 rounded-2xl text-sm font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
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
                          <span className="text-xl">{p.icon}</span>
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
                            <span className="text-lg">{c.icon}</span>
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
              <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">備註 (買了什麼？)</label>
              <input 
                value={edited.note || ''}
                onChange={e => setEdited({ ...edited, note: e.target.value })}
                className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#000000] text-[18px] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
                placeholder="買了什麼？"
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
                  <span className="text-[15px] font-black text-[#5D4037]">
                    {projects.find(p => p.id === (edited.projectId || 'p1'))?.icon} {projects.find(p => p.id === (edited.projectId || 'p1'))?.name || '無特別專案'}
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

            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">帳戶</label>
              <select 
                value={edited.accountId}
                onChange={e => setEdited({ ...edited, accountId: e.target.value })}
                className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm appearance-none focus:border-[#FFD54F] transition-all"
              >
                {[...accounts].sort((a, b) => (a.order || 0) - (b.order || 0)).map(a => (
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
                    {[...accounts].sort((a, b) => (a.order || 0) - (b.order || 0)).map(a => (
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

  const otherRecordsSum = useMemo(() => {
    let sum = 0;
    records.forEach(r => {
      if (r.category === '初始資金') return;
      if (r.accountId === account.id) {
        if (r.type === 'income') sum += r.amount;
        if (r.type === 'expense') sum -= r.amount;
        if (r.type === 'transfer') sum -= r.amount;
      }
      if (r.type === 'transfer' && r.toAccountId === account.id) {
        sum += (r.toAmount ?? (r.amount * (r.exchangeRate || 1)));
      }
    });
    return sum;
  }, [records, account.id]);

  const currentTotal = initialAmount + otherRecordsSum;
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
        className="bg-[#FFF9E3] w-full max-w-sm rounded-[44px] flex flex-col shadow-2xl border-4 border-white overflow-hidden max-h-[90vh]"
        style={{ fontFamily: '"王漢宗中隸書", "王漢宗", sans-serif' }}
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
                  value={initialAmount}
                  onChange={e => setInitialAmount(parseFloat(e.target.value) || 0)}
                  className="w-full p-4 pl-10 bg-white border-2 border-stone-50 rounded-2xl font-black text-xl text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
                  style={{ fontFamily: '"王漢宗中隸書", "王漢宗", sans-serif' }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between px-1 bg-stone-50/50 p-3 rounded-xl border border-stone-100">
                <span className="text-[10px] font-bold text-stone-400">目前餘額 (連動計算)</span>
                <span className={`text-base font-black ${currentTotal < 0 ? 'text-rose-400' : 'text-[#5D4037]'}`}>
                  $ {currentTotal.toLocaleString()}
                </span>
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
              <HorizontalScrollArea className="px-1">
                <div className="flex gap-2">
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

                  {['💰', '🏦', '💳', '📔', '💵', '🪙', '📱', '🐷', '📈', '🏠', '🚗', '💼', '💎', '🛒', '🍱', '✈️', '🎮', '🎁'].map(icon => (
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

            {/* Credit Card Closing Day */}
            {editedAcc.type === 'credit' && (
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
                    style={{ fontFamily: '"王漢宗中隸書", "王漢宗", sans-serif' }}
                  />
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg border-2 border-stone-100 flex items-center justify-center text-stone-300">
                    <span className="text-sm font-black">日</span>
                  </div>
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
  
  const filteredRecords = useMemo(() => records, [records]);
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
        id: `fixed_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
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
  // Initialize by grouping children with parents to ensure subtree movement logic works
  const [sortedAccounts, setSortedAccounts] = useState(() => {
    const parents = accounts.filter(a => !a.parentId);
    const result: Account[] = [];
    parents.forEach(p => {
      result.push(p);
      const children = accounts.filter(c => c.parentId === p.id);
      result.push(...children);
    });
    // Add any orphans just in case
    accounts.forEach(a => {
      if (!result.find(r => r.id === a.id)) result.push(a);
    });
    return result;
  });

  const moveAccount = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...sortedAccounts];
    const item = newOrder[index];
    
    const getSubtreeRange = (idx: number) => {
      const parent = newOrder[idx];
      let endIdx = idx;
      for (let i = idx + 1; i < newOrder.length; i++) {
        if (newOrder[i].parentId === parent.id) {
          endIdx = i;
        } else {
          break;
        }
      }
      return [idx, endIdx];
    };

    if (item.parentId) {
      // 子帳號排序：僅在同主帳號內移動
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newOrder.length) return;
      
      const targetItem = newOrder[targetIndex];
      // Only swap if the target is also a child of the SAME parent
      if (targetItem.parentId === item.parentId) {
        newOrder[index] = targetItem;
        newOrder[targetIndex] = item;
        setSortedAccounts(newOrder);
      }
    } else {
      // 主帳號排序：整組移動 (母雞帶小雞)
      const [start, end] = getSubtreeRange(index);
      const groupLength = end - start + 1;
      
      if (direction === 'up') {
        let prevParentStart = -1;
        for (let i = start - 1; i >= 0; i--) {
          if (!newOrder[i].parentId) {
            prevParentStart = i;
            break;
          }
        }
        if (prevParentStart === -1) return;
        
        const group = newOrder.splice(start, groupLength);
        newOrder.splice(prevParentStart, 0, ...group);
      } else {
        const nextParentStart = end + 1;
        if (nextParentStart >= newOrder.length) return;
        
        const [targetStart, targetEnd] = getSubtreeRange(nextParentStart);
        const group = newOrder.splice(start, groupLength);
        // Position it after the next group
        const insertAt = targetEnd - groupLength + 1;
        newOrder.splice(insertAt, 0, ...group);
      }
      setSortedAccounts(newOrder);
    }
  };

  const canMoveUp = (index: number) => {
    const item = sortedAccounts[index];
    if (item.parentId) {
      return index > 0 && sortedAccounts[index - 1].parentId === item.parentId;
    }
    for (let i = index - 1; i >= 0; i--) {
      if (!sortedAccounts[i].parentId) return true;
    }
    return false;
  };

  const canMoveDown = (index: number) => {
    const item = sortedAccounts[index];
    if (item.parentId) {
      return index < sortedAccounts.length - 1 && sortedAccounts[index + 1].parentId === item.parentId;
    }
    // Find end of current group
    let endIdx = index;
    for (let i = index + 1; i < sortedAccounts.length; i++) {
      if (sortedAccounts[i].parentId === item.id) endIdx = i;
      else break;
    }
    return endIdx < sortedAccounts.length - 1;
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
        style={{ fontFamily: '"王漢宗中隸書", "王漢宗", sans-serif' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-8 pb-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
              <ChevronLeft className="w-6 h-6 text-[#5D4037]" />
            </button>
            <h3 className="text-2xl font-black text-[#5D4037]">帳戶排序</h3>
          </div>
          <div className="w-12 h-12 bg-[#FFD54F] rounded-2xl flex items-center justify-center shadow-md">
            <span className="text-xl font-bold text-[#5D4037]">☰↑</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-4 space-y-4">
          {sortedAccounts.map((acc, index) => {
            const isChild = !!acc.parentId;
            return (
              <div 
                key={acc.id}
                className={`flex items-center gap-3 p-4 bg-white rounded-3xl border-2 border-stone-50 shadow-sm transition-all group ${isChild ? 'ml-10 border-l-8 border-[#5D4037]/5 bg-white/70 scale-95' : 'relative'}`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border border-stone-50 shadow-sm ${isChild ? 'bg-white' : 'bg-[#FFFDF5]'}`}>
                  {acc.icon}
                </div>
                <div className="flex-1 flex flex-col min-w-0">
                  <span className="text-[10px] font-bold text-stone-300 uppercase tracking-widest leading-none mb-1">
                    {isChild ? '子帳戶' : '主帳戶'}
                  </span>
                  <span className={`font-black text-[#5D4037] truncate ${isChild ? 'text-sm' : 'text-base'}`}>{acc.name}</span>
                </div>
                <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                  <button 
                    disabled={!canMoveUp(index)}
                    onClick={() => moveAccount(index, 'up')}
                    className="p-2 hover:bg-stone-50 rounded-xl text-stone-300 hover:text-[#5D4037] disabled:opacity-5 transition-all active:scale-75"
                  >
                    <ChevronUp size={24} />
                  </button>
                  <button 
                    disabled={!canMoveDown(index)}
                    onClick={() => moveAccount(index, 'down')}
                    className="p-2 hover:bg-stone-50 rounded-xl text-stone-300 hover:text-[#5D4037] disabled:opacity-5 transition-all active:scale-75"
                  >
                    <ChevronDown size={24} />
                  </button>
                </div>
              </div>
            );
          })}
          <div className="h-6" />
        </div>

        <div className="p-8 pt-4 flex-shrink-0 bg-white/80 backdrop-blur-sm border-t border-stone-100">
          <button 
            onClick={() => onSave(sortedAccounts)}
            className="w-full py-5 bg-[#5D4037] text-white rounded-3xl font-black text-xl flex items-center justify-center gap-3 shadow-[0_10px_30px_-10px_rgba(93,64,55,0.4)] active:scale-95 transition-all"
          >
            <Check size={28} /> 完成排序
          </button>
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

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#5D4037]/60 backdrop-blur-md z-[80] flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="bg-[#FFFDF5] w-full max-w-sm rounded-[44px] flex flex-col shadow-2xl border-4 border-white overflow-hidden"
        style={{ fontFamily: '"王漢宗中隸書", "王漢宗", sans-serif' }}
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
              {eligibleParents.map(p => (
                <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-[#5D4037]/40 uppercase tracking-widest px-1">自訂 Emoji</label>
            <input 
              type="text"
              placeholder="輸入 Emoji..."
              value={edited.icon}
              onChange={e => {
                const val = e.target.value;
                // Simple logic to take the last character if it's an emoji-like input
                setEdited({ ...edited, icon: val.slice(-2).trim() || edited.icon });
              }}
              className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
              maxLength={2}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-[#5D4037]/40 uppercase tracking-widest px-1">專案圖示</label>
            <div className="grid grid-cols-5 gap-2">
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
            onClick={() => onSave(edited)}
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
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [newCat, setNewCat] = useState<Partial<Category>>({ name: '', icon: '✨', type: 'expense', sub: [] });
  
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [newSubName, setNewSubName] = useState('');

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
      id: editingCat?.id || `cat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
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

  const [editingSubIndex, setEditingSubIndex] = useState<number | null>(null);

  const handleAddSub = () => {
    if (!newSubName) return;
    const subStr = newSubName;
    setNewCat(prev => {
      const currentSub = prev.sub || [];
      if (editingSubIndex !== null) {
        const updatedSub = [...currentSub];
        updatedSub[editingSubIndex] = subStr;
        return { ...prev, sub: updatedSub };
      }
      return { ...prev, sub: [...currentSub, subStr] };
    });
    setNewSubName('');
    setEditingSubIndex(null);
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
                    {newCat.sub?.map((sub, idx) => {
                      return (
                        <div 
                          key={idx} 
                          onClick={() => {
                            setNewSubName(sub);
                            setEditingSubIndex(idx);
                            setIsSubModalOpen(true);
                          }}
                          className="flex items-center justify-between bg-white p-3 rounded-xl border-2 border-stone-50 shadow-sm group cursor-pointer hover:border-[#FFD54F] transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-[#5D4037] text-sm">{sub}</span>
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); removeSub(idx); }}
                            className="p-1 text-stone-200 hover:text-rose-400 transition-colors"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      );
                    })}
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
                  placeholder="例如：💎 SEVENTEEN 或 ⭐ NCT"
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
      <div className="flex-1 overflow-y-auto no-scrollbar px-6 space-y-4 pb-24 pt-4">
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
            const paidCount = isSettled ? total : group.filter(r => r.date <= today).length;
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

    const expense = targetRecords.filter(r => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0);
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
      style={{ fontFamily: '"王漢宗中隸書", "王漢宗", sans-serif' }}
    >
      <div className="flex-1 overflow-y-auto no-scrollbar">
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
        {project.icon}
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

  const monthRangeLabel = useMemo(() => {
    const [y, m] = currentMonth.split('/').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    const format = (d: Date) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    return `${format(start)} - ${format(end)}`;
  }, [currentMonth]);

  const filteredRecords = useMemo(() => {
    const [y, m] = currentMonth.split('/').map(Number);
    return records.filter(r => {
      const isProject = project.id === 'p1' ? (!r.projectId || r.projectId === 'p1') : r.projectId === project.id;
      if (!isProject) return false;
      const pDate = r.postingDate || r.date;
      const d = new Date(pDate);
      return d.getFullYear() === y && (d.getMonth() + 1) === m;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [records, project, currentMonth]);

  const balance = useMemo(() => {
    const expense = filteredRecords.filter(r => r.type === 'expense' && r.postingDate).reduce((sum, r) => sum + r.amount, 0);
    const income = filteredRecords.filter(r => r.type === 'income' && r.postingDate).reduce((sum, r) => sum + r.amount, 0);
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
      style={{ fontFamily: '"王漢宗中隸書", "王漢宗", sans-serif' }}
    >
      {/* Month Switcher */}
      <div className="flex items-center justify-between px-6 py-4 bg-[#FFF9E3]/30">
        <button onClick={handlePrevMonth} className="p-2 text-[#5D4037]"><ChevronLeft size={24} /></button>
        <span className="text-lg font-bold text-[#5D4037]">{monthRangeLabel}</span>
        <button onClick={handleNextMonth} className="p-2 text-[#5D4037]"><ChevronRight size={24} /></button>
      </div>

      {/* Stats Summary */}
      <div className="flex justify-between px-6 py-2 border-b border-stone-50 text-sm font-bold text-stone-500">
        <span>項目：{filteredRecords.length} 筆</span>
        <span>結餘：<span className={balance >= 0 ? 'text-blue-600' : 'text-red-500'}>${balance < 0 ? '-' : ''}{Math.abs(balance).toLocaleString()}</span></span>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar relative">
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
                  style={{ fontFamily: '"王漢宗中隸書", "王漢宗", sans-serif' }}
                >
                  <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-xl">
                    {getCategoryIcon(record.category, record.type, categories)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                       <div className="text-[17px] font-bold text-[#5D4037] truncate">{record.category}</div>
                       {recordAccount?.type === 'credit' && (!record.postingDate || record.isPending) && (
                         <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-500 rounded font-bold">未入帳</span>
                       )}
                    </div>
                    <div className="text-[12px] font-medium text-stone-300 truncate">發票 - {record.note || '詳細資訊...'}</div>
                  </div>
                  <div className={`text-[17px] font-bold ${record.type === 'income' ? 'text-[#03A9F4]' : 'text-[#E91E63]'}`}>
                    {record.type === 'income' ? '+' : '-'}${record.amount.toLocaleString()}
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
    </motion.div>
  );
}

function PlaceholderView({ title, icon, onBack, content }: { title: string, icon: React.ReactNode, onBack: () => void, content?: React.ReactNode }) {
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

function HistoryView({ records, accounts, categories, projects, filter, onBack, onUpdateRecord, onDeleteRecord }: { 
  records: Transaction[], 
  accounts: Account[], 
  categories: Category[],
  projects: Project[],
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
    const todayStr = new Date().toISOString().split('T')[0];

    return records.filter(r => r.category !== '初始資金' && (r.postingDate || r.date) >= startStr && (r.postingDate || r.date) <= endStr)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [records, filter]);

  const filterLabel = useMemo(() => {
    if (filter.type === 'day') return filter.date.replace(/-/g, '/');
    if (filter.type === 'week') return '本週明細';
    if (filter.type === 'month') return '本月明細';
    if (filter.type === 'year') return '本年明細';
    return '';
  }, [filter]);

  const historyBalance = useMemo(() => {
    return filteredRecords.reduce((acc, r) => {
      if (r.type === 'income') return acc + r.amount;
      if (r.type === 'expense') return acc - r.amount;
      return acc;
    }, 0);
  }, [filteredRecords]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full bg-[#FFF9E3]"
    >
      <div className="flex-1 px-4 overflow-y-auto no-scrollbar pb-10 pt-4">
        {/* Period Summary Header */}
        <div className="mx-2 mb-4 p-4 bg-[#FFFDF5] rounded-3xl border border-[#FFD54F]/30 flex items-center justify-between text-[13px] font-black text-[#5D4037] shadow-sm" style={{ fontFamily: '"王漢宗中隸書", "王漢宗", sans-serif' }}>
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
          {filteredRecords.length > 0 ? filteredRecords.map(record => (
            <div 
              key={record.id} 
              onClick={() => setEditingRecord(record)}
              className="flex items-center gap-4 py-4 border-b border-stone-50 last:border-0 group cursor-pointer hover:bg-stone-50/50 rounded-xl px-2 -mx-2 transition-colors"
            >
              <div className="w-14 h-14 bg-[#FFFDF5] rounded-2xl flex-shrink-0 flex items-center justify-center text-2xl shadow-sm border border-white">
                {getCategoryIcon(record.category, record.type, categories)}
              </div>
              
              <div className="flex-1 flex flex-col gap-1 min-w-0">
                <span className="font-black text-lg text-[#5D4037] truncate leading-tight">
                  {record.note || record.category}
                </span>
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
                  <span className="text-[10px] px-2 py-0.5 bg-stone-100 text-stone-400 rounded-full font-bold">
                    {accounts.find(a => a.id === record.accountId)?.name}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className={`font-black text-xl ${record.type === 'income' ? 'text-[#03A9F4]' : record.type === 'expense' ? 'text-[#E91E63]' : 'text-stone-400'}`}>
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

function ReportsView({ records, projects, categories }: { 
  records: Transaction[], 
  projects: Project[], 
  categories: Category[] 
}) {
  const [dateRange, setDateRange] = useState<'thisMonth' | 'last3Months' | 'last6Months' | 'lastYear'>('thisMonth');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  
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

    const income = periodRecords.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
    const expense = periodRecords.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
    
    // Category Pie Data
    const catMap: Record<string, number> = {};
    periodRecords.filter(r => r.type === 'expense').forEach(r => {
      const cat = r.category.split(' > ')[0];
      catMap[cat] = (catMap[cat] || 0) + r.amount;
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
        income: mRecords.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0),
        expense: mRecords.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0),
      };
    });

    return { income, expense, balance: income - expense, pieData, trendData };
  }, [filteredByProject, dateInterval]);

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex-1 flex flex-col gap-6 px-4 py-8 bg-[#FFF9E3]/30 min-h-full pb-24 overflow-y-auto"
      style={{ fontFamily: '"王漢宗中隸書", "王漢宗", sans-serif' }}
    >
      {/* Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex bg-white/60 p-1 rounded-2xl border border-stone-100 shadow-sm overflow-x-auto no-scrollbar">
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
        
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
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
              <span>{p.icon}</span>
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
        <div className="col-span-2 bg-[#FFD54F] rounded-3xl p-5 shadow-md flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-[#5D4037]/50 uppercase tracking-widest">目前結餘</span>
            <span className="text-2xl font-black text-[#5D4037]">${stats.balance.toLocaleString()}</span>
          </div>
          <div className="w-12 h-12 bg-white/30 rounded-2xl flex items-center justify-center">
            <Wallet className="text-[#5D4037]" />
          </div>
        </div>
      </div>

      {/* Trend Chart */}
      <div className="bg-white rounded-[40px] p-6 shadow-sm border-2 border-white flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-[#FFD54F]" />
          <span className="font-black text-[#5D4037]">收支趨勢圖</span>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} tick={{ fill: '#A8A29E' }} />
              <YAxis fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} tick={{ fill: '#A8A29E' }} />
              <Tooltip 
                contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontFamily: '"王漢宗中隸書", sans-serif' }}
                cursor={{ fill: '#FFFDF5', opacity: 0.5 }}
              />
              <Bar dataKey="income" name="收入" fill="#93C5FD" radius={[6, 6, 0, 0]} barSize={12} />
              <Bar dataKey="expense" name="支出" fill="#FCA5A5" radius={[6, 6, 0, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Pie Chart */}
      <div className="bg-white rounded-[40px] p-6 shadow-sm border-2 border-white flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <PieChart size={18} className="text-[#FFD54F]" />
          <span className="font-black text-[#5D4037]">支出分類佔比</span>
        </div>
        <div className="h-64 w-full relative">
          {stats.pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={stats.pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => `$${value.toLocaleString()}`}
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontFamily: '"王漢宗中隸書", sans-serif' }}
                />
              </RePieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-stone-300 font-bold italic">該區間尚無支出紀錄</div>
          )}
          {stats.pieData.length > 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] font-black text-stone-400">總計支出</span>
              <span className="text-lg font-black text-[#5D4037]">${stats.expense.toLocaleString()}</span>
            </div>
          )}
        </div>
        
        {/* Legend Custom */}
        <div className="grid grid-cols-2 gap-3 mt-2">
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
  setInstallments,
  setProjects,
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
  setInstallments: (i: Installment[]) => void,
  setProjects: (p: Project[]) => void,
  onUpdateTemplates: (t: Template[]) => void,
  onUpdateCategories: (c: Category[]) => void
}) {
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleManualSync = async () => {
    if (!user) {
      alert('請先登入後再進行同步。');
      return;
    }
    
    setIsSyncing(true);
    try {
      await onForceSync();
      alert('同步完成');
    } catch (err) {
      alert('同步失敗，請檢查網路連線。');
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
    const headers = ['消費日期', '入帳日期', '類型', '類別', '金額', '帳戶', '備註'];
    
    // Filter records by date range
    const filtered = records.filter(r => {
      const date = r.date;
      return date >= exportRange.start && date <= exportRange.end;
    }).sort((a, b) => a.date.localeCompare(b.date));

    const rows = filtered.map(r => {
      const account = accounts.find(a => a.id === r.accountId)?.name || '未知帳戶';
      const type = r.type === 'income' ? '收入' : (r.type === 'expense' ? '支出' : '轉帳');
      return [
        r.date,
        r.postingDate || (r.isPending ? '未入帳' : r.date),
        type,
        r.category,
        r.amount,
        account,
        r.note || ''
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const startStr = exportRange.start.replace(/-/g, '');
    const endStr = exportRange.end.replace(/-/g, '');
    link.setAttribute('href', url);
    link.setAttribute('download', `KK記帳_${startStr}-${endStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);
        
        if (!Array.isArray(data.records)) {
          throw new Error('無效的備份檔案格式 (缺少 records)');
        }

        if (window.confirm('確定要還原嗎？這將覆蓋目前的所有資料且無法復原。')) {
          setRecords(data.records);
          if (Array.isArray(data.installments)) setInstallments(data.installments);
          if (Array.isArray(data.projects)) setProjects(data.projects);
          
          alert('資料還原成功！');
          setShowSyncModal(false);
        }
      } catch (err) {
        alert('還原失敗：' + (err instanceof Error ? err.message : '檔案格式不正確'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
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
          <span className="font-bold text-[#5D4037]">匯出資料 (CSV)</span>
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
                <h3 className="text-[19px] font-black text-[#5D4037] whitespace-nowrap leading-none tracking-tight" style={{ fontFamily: '"王漢宗中隸書", "王漢宗", sans-serif' }}>備份與還原</h3>
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
                    選取備份檔還原
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept=".json" 
                    className="hidden" 
                  />

                  <div className="bg-[#5D4037]/5 p-5 rounded-3xl space-y-2">
                    <div className="flex items-center gap-2 text-[#5D4037] font-bold text-[10px] uppercase tracking-widest opacity-40">
                      <ShieldCheck size={12} />
                      <span>注意事項</span>
                    </div>
                    <p className="text-[12px] text-[#5D4037]/70 leading-relaxed font-medium">
                      備份包含所有交易紀錄與分期計畫。還原功能將匯入檔案並<span className="text-orange-600 font-bold">取代</span>現有資料，建議先匯出目前的備份。
                    </p>
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
              style={{ fontFamily: '"王漢宗中隸書", "王漢宗", sans-serif' }}
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

function RecordModal({ accounts, categories, templates, projects, initialProjectId, onUpdateTemplates, onUpdateCategories, onClose, onSave, selectedDate }: { 
  accounts: Account[], 
  categories: Category[],
  templates: Template[], 
  projects: Project[],
  initialProjectId?: string,
  onUpdateTemplates: (t: Template[]) => void,
  onUpdateCategories: (c: Category[]) => void,
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
  const [isInstallment, setIsInstallment] = useState(false);
  const [totalInstallments, setTotalInstallments] = useState(1);
  const [showCalculator, setShowCalculator] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  const [consumptionDate, setConsumptionDate] = useState(selectedDate);
  const [postingDate, setPostingDate] = useState(selectedDate);
  const [isPending, setIsPending] = useState(false);
  const [isDateExpanded, setIsDateExpanded] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || 'p1');

  // For Project Picker Search
  const [isProjectPickerOpen, setIsProjectPickerOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');

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
        date: consumptionDate,
        postingDate: isPending ? undefined : postingDate,
        isPending: isPending,
        isInstallment,
        totalInstallments: isInstallment ? totalInstallments : undefined,
        projectId: selectedProjectId !== 'p1' ? selectedProjectId : undefined
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
        style={{ fontFamily: '"王漢宗中隸書", "王漢宗", sans-serif' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6 text-[#5D4037]" />
          </button>
          <span className="text-lg font-bold text-[#5D4037]">記一筆</span>
          <div className="flex items-center gap-1 bg-white px-3 py-1 rounded-full border border-stone-100 shadow-sm opacity-0">
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

        {/* Date & Project Selection Area */}
        {tab !== 'template' && (
          <div className="flex flex-col gap-2">
            <AnimatePresence mode="wait">
              {!isCreditCard || (tab !== 'expense' && tab !== 'income') ? (
                <motion.div 
                  key="single-date"
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className="mx-6 flex items-center justify-center gap-2 py-2.5 bg-[#FFFDF5] rounded-2xl border border-[#5D4037]/5 shadow-sm"
                  style={{ fontFamily: '"王漢宗中隸書", "王漢宗", sans-serif' }}
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
                      className="bg-transparent outline-none cursor-pointer"
                    />
                  </div>
                </motion.div>
              ) : isDateExpanded ? (
                <motion.div 
                  key="expanded"
                  initial={{ opacity: 0, scale: 0.98, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, scale: 1, height: "auto", marginBottom: 0 }}
                  exit={{ opacity: 0, scale: 0.98, height: 0, marginBottom: 0 }}
                  className="bg-[#FFFDF5] p-5 pb-8 rounded-[30px] border border-stone-100 shadow-sm flex flex-col gap-5 mx-2" 
                  style={{ fontFamily: '"王漢宗中隸書", "王漢宗", sans-serif' }}
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest flex items-center gap-1.5 px-1">
                        <CalendarIcon size={12} /> 消費日 (實際購買)
                      </label>
                      <input 
                        type="date"
                        value={consumptionDate}
                        onChange={e => setConsumptionDate(e.target.value)}
                        className="bg-white border-2 border-stone-50 rounded-xl px-4 py-2 text-sm font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
                      />
                    </div>
                    <div className={`flex flex-col gap-1.5 transition-opacity duration-300 ${isPending ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                      <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest flex items-center gap-1.5 px-1">
                        <Banknote size={12} /> 入帳日 (信用卡帳單)
                      </label>
                      <input 
                        type="date"
                        value={postingDate}
                        onChange={e => setPostingDate(e.target.value)}
                        className="bg-white border-2 border-stone-50 rounded-xl px-4 py-2 text-sm font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pl-1">
                    <button 
                      onClick={() => setIsDateExpanded(false)}
                      className="text-[#5D4037] text-[11px] font-bold bg-[#FFD54F] px-4 py-1.5 rounded-full shadow-sm active:scale-95 transition-all"
                    >
                      完成日期選擇
                    </button>
                    <div className="flex items-center gap-3 pr-1">
                      <span className="text-[11px] font-bold text-stone-400">待入帳 (暫不計入本月平衡)</span>
                      <button 
                        onClick={() => setIsPending(!isPending)}
                        className={`w-9 h-4.5 rounded-full transition-all relative ${isPending ? 'bg-orange-400' : 'bg-stone-200'}`}
                      >
                        <div className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-all ${isPending ? 'left-5' : 'left-0.5'}`} />
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
                  className="mx-6 flex items-center justify-center gap-2 py-2.5 bg-[#FFFDF5] rounded-2xl border border-[#5D4037]/5 cursor-pointer hover:bg-stone-50 transition-colors shadow-sm"
                  style={{ fontFamily: '"王漢宗中隸書", "王漢宗", sans-serif' }}
                >
                  <div className="flex items-center gap-2 text-[13px] font-bold text-[#5D4037]">
                    <CalendarIcon size={14} className="text-[#FFD54F]" />
                    <span>消費：{consumptionDate.replace(/-/g, '/')}</span>
                    <span className="text-stone-300">|</span>
                    <span>入帳：{isPending ? '待入帳' : postingDate.replace(/-/g, '/')}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Project Picker Trigger */}
            <div 
              onClick={() => setIsProjectPickerOpen(true)}
              className="mx-6 flex items-center justify-center gap-2 py-2.5 bg-[#FFFDF5] rounded-2xl border-2 border-[#FFD54F]/30 cursor-pointer hover:bg-[#FFD54F]/5 transition-all shadow-sm"
              style={{ fontFamily: '"王漢宗中隸書", "王漢宗", sans-serif' }}
            >
              <Layers size={14} className="text-[#FFD54F]" />
              <span className="text-[13px] font-bold text-[#5D4037]">所屬專案：</span>
              <span className="text-[13px] font-black text-[#5D4037]">
                {projects.find(p => p.id === selectedProjectId)?.icon} {projects.find(p => p.id === selectedProjectId)?.name || '無特別專案'}
              </span>
            </div>
          </div>
        )}

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
                      id: `tmpl_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
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

              {/* Note Input */}
              {tab !== 'template' && (
                <div className="space-y-4">
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
                      <span className={`text-3xl font-black ${tab === 'income' ? 'text-[#03A9F4]' : tab === 'expense' ? 'text-[#E91E63]' : 'text-[#5D4037]'}`}>{amount}</span>
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
              style={{ fontFamily: '"王漢宗中隸書", "王漢宗", sans-serif' }}
            >
              <div className="p-6 pb-2 border-b border-stone-50 flex items-center justify-between">
                <h3 className="text-xl font-black text-[#5D4037]">選取專案</h3>
                <button onClick={() => setIsProjectPickerOpen(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                  <X size={20} className="text-stone-400" />
                </button>
              </div>
              
              <div className="p-4 border-b border-stone-50">
                <div className="relative">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" />
                  <input 
                    value={projectSearch}
                    onChange={e => setProjectSearch(e.target.value)}
                    placeholder="搜尋專案..."
                    className="w-full pl-10 pr-4 py-3 bg-white border-2 border-stone-50 rounded-2xl text-sm font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
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
                        <span className="text-xl">{p.icon}</span>
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
                          <span className="text-lg">{c.icon}</span>
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
                    <div className="grid grid-cols-5 gap-3 max-h-[200px] overflow-y-auto no-scrollbar">
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

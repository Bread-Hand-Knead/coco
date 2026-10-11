import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Briefcase,
  Calendar as CalendarIcon,
  ChevronLeft,
  Cloud,
  Coins,
  CreditCard,
  Download,
  Home,
  Layers,
  LogOut,
  Menu,
  MoreHorizontal,
  MoreVertical,
  PieChart,
  Plus,
  Repeat,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, googleProvider } from './lib/firebase';
import { CustomInstallmentItem, getCorrectInstallmentDate, getFontFamily } from './lib/financeUtils';
import type { Account, Category, CurrencyMode, FixedRecord, Installment, Project, Stock, Template, Transaction } from './types';
import { OperationType, cleanData, enqueueSyncTask, handleFirestoreError, processSyncQueue } from './lib/firestoreSync';
import { DEFAULT_TRANSFER_CATEGORIES, INITIAL_ACCOUNTS, INITIAL_CATEGORIES, INITIAL_PROJECTS, INITIAL_RECORDS, INITIAL_TEMPLATES, ensureProjectHierarchy, ensureTransferCategories } from './lib/defaults';
import { formatLocalDate, parseLocalDate } from './lib/dateUtils';
import { convertCurrency, getLatestExchangeRate, getMergedRecords, getTransferInAmountForAccount } from './lib/recordUtils';
import { checkAreAccountsSameBank, isAccountExcludedFromNetWorth } from './lib/accountUtils';
import { DrawerItem, NavButton } from './components/Common';
import { HomeView } from './views/HomeView';
import { AccountsView } from './views/AccountsView';
import { ExchangeRateModal } from './views/ExchangeRateModal';
import { AccountDetailView } from './views/AccountDetailView';
import { AccountEditModal } from './views/AccountEditModal';
import { SearchView } from './views/SearchView';
import { CalendarView } from './views/CalendarView';
import { FixedRecordsView } from './views/FixedRecordsView';
import { AccountSortModal, ProjectSortModal } from './views/SortModals';
import { ProjectEditModal } from './views/ProjectEditModal';
import { CategoryManagePage, CategoryManagementPage } from './views/CategoryPages';
import { InstallmentManagementPage } from './views/InstallmentManagementPage';
import { ProjectsView } from './views/ProjectsView';
import { ProjectDetailView } from './views/ProjectDetailView';
import { BudgetManagementPage } from './views/BudgetManagementPage';
import { HistoryView } from './views/HistoryView';
import { ReportsView } from './views/ReportsView';
import { RecycleBinView } from './views/RecycleBinView';
import { MoreView } from './views/MoreView';
import { RecordModal } from './views/RecordModal';
import { PrepaymentsView } from './views/PrepaymentsView';
import { AiSplitModal } from './views/AiSplitModal';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [aiParseCount, setAiParseCount] = useState<number>(() => {
    try {
      const val = localStorage.getItem('coco_ai_parse_count');
      return val ? parseInt(val, 10) || 0 : 0;
    } catch (_) {
      return 0;
    }
  });

  const incrementAiParseCount = useCallback(() => {
    setAiParseCount(prev => {
      const next = prev + 1;
      try {
        localStorage.setItem('coco_ai_parse_count', String(next));
        if (user && db) {
          setDoc(doc(db, 'users', user.uid), { aiParseCount: next }, { merge: true }).catch(console.error);
        }
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  }, [user]);
  const [currentView, setCurrentView] = useState<'home' | 'reports' | 'more' | 'accounts' | 'calendar' | 'accountDetail' | 'history' | 'fixedRecords' | 'projects' | 'budget' | 'categories' | 'installments' | 'search' | 'prepayments' | 'recycleBin'>('home');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isCategoryActionMenuOpen, setIsCategoryActionMenuOpen] = useState(false);
  const [isAccountEditModalOpen, setIsAccountEditModalOpen] = useState(false);
  const [isAccountSortModalOpen, setIsAccountSortModalOpen] = useState(false);
  const [isProjectEditModalOpen, setIsProjectEditModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => formatLocalDate(new Date()));
  const [records, setRecords] = useState<Transaction[]>(() => {
    try {
      const cached = localStorage.getItem('coco_records_cache');
      return cached ? JSON.parse(cached) : INITIAL_RECORDS;
    } catch (e) {
      return INITIAL_RECORDS;
    }
  });
  const [accounts, setAccounts] = useState<Account[]>(() => {
    try {
      const cached = localStorage.getItem('coco_accounts_cache');
      return cached ? JSON.parse(cached) : INITIAL_ACCOUNTS;
    } catch (e) {
      return INITIAL_ACCOUNTS;
    }
  });
  const [categories, setCategories] = useState<Category[]>(() => {
    try {
      const cached = localStorage.getItem('coco_categories_cache');
      return cached ? ensureTransferCategories(JSON.parse(cached)) : INITIAL_CATEGORIES;
    } catch (e) {
      return INITIAL_CATEGORIES;
    }
  });
  const [monthlyBudget, setMonthlyBudget] = useState<number>(() => {
    try {
      const cached = localStorage.getItem('coco_budget_cache');
      return cached ? JSON.parse(cached) : 30000;
    } catch (e) {
      return 30000;
    }
  });
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [duplicatingRecord, setDuplicatingRecord] = useState<Transaction | null>(null);

  const handleDuplicateTransaction = (record: Transaction) => {
    if (!record) return;
    setDuplicatingRecord(record);
    setIsRecordModalOpen(true);
  };
  const [isAiSplitModalOpen, setIsAiSplitModalOpen] = useState(false);
  const [aiSplitInitialTab, setAiSplitInitialTab] = useState<'expense' | 'income'>('expense');
  const [aiSplitPresetData, setAiSplitPresetData] = useState<{ items?: any[]; date?: string; time?: string; note?: string } | null>(null);
  const [selectedAccountForDetail, setSelectedAccountForDetail] = useState<Account | null>(null);
  const [rateModalAccount, setRateModalAccount] = useState<Account | null>(null);
  const [historyFilter, setHistoryFilter] = useState<{ type: 'day' | 'week' | 'month' | 'year', date: string }>({ type: 'day', date: selectedDate });
  const [templates, setTemplates] = useState<Template[]>(INITIAL_TEMPLATES);
  const [fixedRecords, setFixedRecords] = useState<FixedRecord[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [rawProjects, setProjects] = useState<Project[]>(() => {
    try {
      const cached = localStorage.getItem('coco_projects_cache');
      return cached ? ensureProjectHierarchy(JSON.parse(cached)) : ensureProjectHierarchy(INITIAL_PROJECTS);
    } catch (e) {
      return ensureProjectHierarchy(INITIAL_PROJECTS);
    }
  });
  const projects = useMemo(() => {
    return [...rawProjects].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }, [rawProjects]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isProjectSortModalOpen, setIsProjectSortModalOpen] = useState(false);
  const [currencyMode, setCurrencyMode] = useState<CurrencyMode>('TWD');
  const [stocks, setStocks] = useState<Stock[]>(() => {
    const local = localStorage.getItem('coco_stocks');
    return local ? JSON.parse(local) : [];
  });

  const activeRecords = useMemo(() => (Array.isArray(records) ? records : []).filter(r => !r.isDeleted), [records]);

  const [undoToast, setUndoToast] = useState<{ message: string; onUndo: () => void } | null>(null);
  const undoToastTimerRef = useRef<any>(null);

  const showUndoToast = (message: string, onUndo: () => void) => {
    if (undoToastTimerRef.current) {
      clearTimeout(undoToastTimerRef.current);
    }
    setUndoToast({ message, onUndo });
    undoToastTimerRef.current = setTimeout(() => {
      setUndoToast(null);
    }, 5500);
  };

  const [selectedCategoryForSub, setSelectedCategoryForSub] = useState<string | null>(null);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // 1. Close open modal or drawer if active
      if (isRecordModalOpen) {
        setIsRecordModalOpen(false);
        return;
      }
      if (isDrawerOpen) {
        setIsDrawerOpen(false);
        return;
      }
      if (selectedCategoryForSub) {
        setSelectedCategoryForSub(null);
        return;
      }

      // 2. Otherwise pop back to home view or state view
      if (event.state && event.state.view) {
        setCurrentView(event.state.view);
        setSelectedProjectId(event.state.projectId || null);
        setSelectedCategoryForSub(event.state.selectedCategoryId || null);
      } else if (currentView !== 'home') {
        setCurrentView('home');
        setSelectedProjectId(null);
        setSelectedCategoryForSub(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [currentView, isRecordModalOpen, isDrawerOpen, selectedCategoryForSub]);

  useEffect(() => {
    if (currentView !== 'home') {
      const currentState = window.history.state;
      if (!currentState || currentState.view !== currentView || currentState.selectedCategoryId !== selectedCategoryForSub) {
        window.history.pushState({ 
          view: currentView, 
          projectId: selectedProjectId, 
          selectedCategoryId: selectedCategoryForSub,
          isRecordModalOpen: isRecordModalOpen
        }, '');
      }
    }
  }, [currentView, selectedProjectId, selectedCategoryForSub, isRecordModalOpen]);

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
      // Reset all finance states manually on explicit logout
      setRecords([]);
      setAccounts([]);
      setProjects([]);
      setMonthlyBudget(0);
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  // Real-time synchronization with Cache-First Stale-While-Revalidate
  useEffect(() => {
    if (!user) return;

    const unsubRecords = onSnapshot(collection(db, 'users', user.uid, 'transactions'), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Transaction);
      setRecords(data);
      try { localStorage.setItem('coco_records_cache', JSON.stringify(data)); } catch (e) {}
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/transactions`));

    const unsubAccounts = onSnapshot(collection(db, 'users', user.uid, 'accounts'), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Account);
      const sortedData = data.sort((a, b) => (a.order || 0) - (b.order || 0));
      setAccounts(sortedData);
      try { localStorage.setItem('coco_accounts_cache', JSON.stringify(sortedData)); } catch (e) {}
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/accounts`));

    const unsubCategories = onSnapshot(collection(db, 'users', user.uid, 'categories'), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Category);
      let res = snapshot.docs.length > 0 ? data : INITIAL_CATEGORIES;
      if (!res.some(c => c.type === 'transfer')) {
        res = [...res, ...DEFAULT_TRANSFER_CATEGORIES];
        if (user) {
          const batch = writeBatch(db);
          DEFAULT_TRANSFER_CATEGORIES.forEach(cat => {
            batch.set(doc(db, 'users', user.uid, 'categories', cat.id), cleanData(cat));
          });
          batch.commit().catch(err => console.warn('Sync transfer categories error:', err));
        }
      }
      setCategories(res);
      try { localStorage.setItem('coco_categories_cache', JSON.stringify(res)); } catch (e) {}
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/categories`));

    const unsubProjects = onSnapshot(collection(db, 'users', user.uid, 'projects'), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Project);
      const res = snapshot.docs.length > 0 ? data : INITIAL_PROJECTS;
      const hierarchized = ensureProjectHierarchy(res);
      setProjects(hierarchized);
      try { localStorage.setItem('coco_projects_cache', JSON.stringify(hierarchized)); } catch (e) {}
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

    const unsubStocks = onSnapshot(collection(db, 'users', user.uid, 'stocks'), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Stock);
      setStocks(data);
      try { localStorage.setItem('coco_stocks', JSON.stringify(data)); } catch (e) {}
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/stocks`));

    const unsubProfile = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      const data = snapshot.data();
      if (data?.monthlyBudget !== undefined) {
        setMonthlyBudget(data.monthlyBudget);
        try { localStorage.setItem('coco_budget_cache', JSON.stringify(data.monthlyBudget)); } catch (e) {}
      }
      if (data?.aiParseCount !== undefined && typeof data.aiParseCount === 'number') {
        setAiParseCount(data.aiParseCount);
        try { localStorage.setItem('coco_ai_parse_count', String(data.aiParseCount)); } catch (e) {}
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}`));

    return () => {
      unsubRecords();
      unsubAccounts();
      unsubCategories();
      unsubProjects();
      unsubFixed();
      unsubInstallments();
      unsubTemplates();
      unsubStocks();
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
  // 注意：useRef 每次重新整理頁面都會重設，必須搭配 localStorage 旗標才是真正的「一次性」
  const INSTALLMENT_MIGRATION_KEY = 'coco_migrated_installment_dates_v1';
  const hasMigratedRef = useRef(false);
  useEffect(() => {
    if (hasMigratedRef.current || records.length === 0 || authLoading) return;
    hasMigratedRef.current = true;
    if (localStorage.getItem(INSTALLMENT_MIGRATION_KEY) === 'done') return;

    // 收集含自訂明細的分期群組，整組跳過，嚴禁覆蓋使用者手動設定的日期
    const customGroupIds = new Set(
      records
        .filter(r => r.installmentGroupId && (r.isCustomInstallment || (r.customSchedule && r.customSchedule.length > 0)))
        .map(r => r.installmentGroupId as string)
    );

    let changed = false;
    const updated = records.map(r => {
      if (!r.isInstallment || !r.installmentGroupId || !r.currentInstallment) return r;
      if (customGroupIds.has(r.installmentGroupId)) return r;
      const correctDate = getCorrectInstallmentDate(r.date, r.currentInstallment);
      if (correctDate && r.postingDate !== correctDate) {
        changed = true;
        const updatedRec = { ...r, postingDate: correctDate };
        if (user) {
          setDoc(doc(db, 'users', user.uid, 'transactions', r.id), cleanData(updatedRec)).catch(console.error);
        }
        return updatedRec;
      }
      return r;
    });

    if (changed) {
      setRecords(updated);
      console.log('Successfully migrated credit card installment dates.');
    }
    localStorage.setItem(INSTALLMENT_MIGRATION_KEY, 'done');
  }, [records, user, authLoading]);

  // --- Offline-First Sync Queue Architecture ---
  useEffect(() => {
    const handleOnline = () => {
      if (user?.uid) {
        processSyncQueue(user.uid);
      }
    };
    window.addEventListener('online', handleOnline);
    if (user?.uid && navigator.onLine) {
      processSyncQueue(user.uid);
    }
    return () => window.removeEventListener('online', handleOnline);
  }, [user]);

  const syncToCloud = async (path: string, data: any, id: string) => {
    if (!user) return;
    enqueueSyncTask({ type: 'setDoc', path, idDoc: id, data });
    if (navigator.onLine) {
      await processSyncQueue(user.uid);
    }
  };

  const deleteFromCloud = async (path: string, id: string) => {
    if (!user) return;
    enqueueSyncTask({ type: 'deleteDoc', path, idDoc: id });
    if (navigator.onLine) {
      await processSyncQueue(user.uid);
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

  const checkFixedRecords = async () => {
    const today = new Date();
    
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
        const isTransfer = fr.type === 'transfer';
        const newTransaction: Transaction = {
          id,
          amount: (fr.type === 'expense' || fr.type === 'transfer') ? -Math.abs(fr.amount) : Math.abs(fr.amount),
          category: isTransfer ? (fr.category || '轉帳') : fr.category,
          note: fr.name || (isTransfer ? '固定轉帳' : ''),
          date: processDateStr,
          type: fr.type,
          accountId: fr.accountId,
          toAccountId: isTransfer ? fr.toAccountId : undefined,
          fee: isTransfer ? (fr.fee || 0) : undefined,
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
        return (Array.isArray(projects) ? projects : []).find(p => p.id === selectedProjectId)?.name || '專案明細';
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
      const acc = (Array.isArray(accounts) ? accounts : []).find(a => a.id === id);
      if (!acc) return 0;
      let bal = acc.initialBalance || 0;
      if (acc.type === 'credit' && !acc.initialBalance) {
        bal = 0;
      }
      mergedRecords.forEach(r => {
        // Skip '初始資金' records if we are using account.initialBalance for the total
        if (r.category === '初始資金') return;
        // 信用卡餘額只累計已入帳項目 (具有 postingDate 且非待入帳)
        if (acc.type === 'credit' && (!r.postingDate || r.isPending)) return;

        // Dynamic Update Logic: directly add the signed transaction amount to the account balance
        if (r.accountId === id) {
          if (r.type === 'transfer') {
            bal -= Math.abs(r.amount);
          } else {
            bal += r.amount;
          }
          if (r.fee) bal -= r.fee;
        }
        
        // Symmetrical Transfer Logic: Balance updates based on exact transfer receiver amounts
        if (r.type === 'transfer') {
          bal += getTransferInAmountForAccount(r, id);
        }
      });
      return bal;
    };

    const getRecursiveBalance = (id: string): number => {
      let total = getBaseBalance(id);
      const children = accounts.filter(a => a.parentId === id && !isAccountExcludedFromNetWorth(a, accounts));
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

  const { netAssets, totalAssets, totalLiabilities } = useMemo(() => {
    let assets = 0;
    let liabilities = 0;
    
    const filteredAccounts = accounts.filter(a => {
      if (isAccountExcludedFromNetWorth(a, accounts)) return false;
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
      if (r.isDeleted || r.isMergedChild || r.parentId || r.parentTransactionId || r.isChildTransaction) return false;
      const cur = r.currency || 'TWD';
      // If currencyMode is null or TWD, show TWD. If FOREIGN, show non-TWD
      if (currencyMode === 'FOREIGN') return cur !== 'TWD';
      return cur === 'TWD';
    });

    // Monthly/Weekly/Daily stats now use postingDate and exclude initial balance records and prepayments
    const daily = filteredByCurrency.filter(r => (r.postingDate || r.date) === selectedDate && r.category !== '初始資金' && !r.isPrepay);
    const weekly = filteredByCurrency.filter(r => {
      const pDate = r.postingDate || r.date;
      return pDate >= startOfWeekStr && pDate <= endOfWeekStr && r.category !== '初始資金' && !r.isPrepay;
    });
    const monthly = filteredByCurrency.filter(r => (r.postingDate || r.date).startsWith(monthStr) && r.category !== '初始資金' && !r.isPrepay);
    const yearly = filteredByCurrency.filter(r => (r.postingDate || r.date).startsWith(yearStr) && r.category !== '初始資金' && !r.isPrepay);
    
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

  useEffect(() => {
    if (!user) {
      localStorage.setItem('coco_stocks', JSON.stringify(stocks));
    }
  }, [stocks, user]);

  const handleSaveStock = async (stock: Stock) => {
    // 立即進行本地樂觀更新，確保 UI 即時重新計算
    setStocks(prev => {
      const idx = prev.findIndex(s => s.id === stock.id);
      let next: Stock[];
      if (idx >= 0) {
        next = [...prev];
        next[idx] = stock;
      } else {
        next = [...prev, stock];
      }
      try {
        localStorage.setItem('coco_stocks', JSON.stringify(next));
      } catch (e) {
        console.error('Failed to save stocks to localStorage:', e);
      }
      return next;
    });

    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'stocks', stock.id), cleanData(stock));
      } catch (error) {
        console.error('Failed to save stock in Firestore:', error);
      }
    }
  };

  const handleDeleteStock = async (stockId: string) => {
    const stockToDel = stocks.find(s => s.id === stockId);
    if (!stockToDel) return;

    const updatedStock: Stock = {
      ...stockToDel,
      isDeleted: true,
      deletedAt: new Date().toISOString()
    };

    setStocks(prev => {
      const next = prev.map(s => s.id === stockId ? updatedStock : s);
      try {
        localStorage.setItem('coco_stocks', JSON.stringify(next));
      } catch (e) {
        console.error('Failed to save stocks to localStorage:', e);
      }
      return next;
    });

    if (user) {
      try {
        await syncToCloud('stocks', cleanData(updatedStock), stockId);
      } catch (error) {
        console.error('Failed to soft delete stock in Firestore:', error);
      }
    }

    showUndoToast('股票投資紀錄已移至垃圾桶', () => handleRestoreStock(stockId));
  };

  const handleSaveRecord = async (record: Omit<Transaction, 'id'> & { customSchedule?: CustomInstallmentItem[] }, keepOpen?: boolean) => {
    if (record.isInstallment && record.totalInstallments && record.totalInstallments > 1) {
      const installmentGroupId = Date.now().toString();
      const totalAmtAbs = Math.abs(record.amount);
      const totalTerms = record.totalInstallments;
      const baseAmt = Math.floor(totalAmtAbs / totalTerms);
      const remainderAmt = totalAmtAbs - (baseAmt * totalTerms);
      
      const schedule = record.customSchedule || record.installmentList;
      const isCustom = Boolean(record.isCustomInstallment || record.isCustomSchedule || (schedule && schedule.length > 0));

      const batch = user ? writeBatch(db) : null;

      for (let i = 1; i <= totalTerms; i++) {
        let dateStr: string;
        let currentAmtAbs: number;

        if (isCustom && schedule && schedule.length >= i) {
          dateStr = schedule[i - 1].date;
          currentAmtAbs = Math.abs(schedule[i - 1].amount);
        } else {
          dateStr = getCorrectInstallmentDate(record.date, i);
          currentAmtAbs = i <= remainderAmt ? (baseAmt + 1) : baseAmt;
        }

        const finalAmt = record.amount < 0 ? -currentAmtAbs : currentAmtAbs;

        const id = `${installmentGroupId}-${i}`;
        const newPart: Transaction = {
          ...record,
          id,
          amount: finalAmt,
          note: record.note?.trim(),
          date: record.date,
          postingDate: dateStr,
          currentInstallment: i,
          totalInstallments: totalTerms,
          installmentGroupId,
          isInstallment: true,
          isCustomInstallment: isCustom,
          isCustomSchedule: isCustom,
          customSchedule: isCustom ? schedule : undefined,
          installmentList: isCustom ? schedule : undefined
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

  const handleSaveBatchRecords = async (newTransactions: Omit<Transaction, 'id'>[]) => {
    const timestamp = Date.now();
    const finalTransactions = newTransactions.map((tx, index) => ({
      ...tx,
      id: `rec_${timestamp}_${Math.random().toString(36).substr(2, 9)}_${index}`
    }));

    if (user) {
      const batch = writeBatch(db);
      finalTransactions.forEach(tx => {
        batch.set(doc(db, 'users', user.uid, 'transactions', tx.id), cleanData(tx));
      });
      await batch.commit().catch(e => handleFirestoreError(e, OperationType.WRITE, 'batch/ai-split-transactions'));
    } else {
      setRecords(prev => [...prev, ...finalTransactions]);
    }
  };

  const handleUpdateRecord = async (
    oldRecord: Transaction, 
    newRecord: Transaction, 
    mergedRecordIdsToDelete?: (string | Transaction)[], 
    restoredRecordIds?: string[]
  ) => {
    if (mergedRecordIdsToDelete && mergedRecordIdsToDelete.length > 0) {
      if (typeof mergedRecordIdsToDelete[0] === 'string') {
        const idsToDelete = mergedRecordIdsToDelete as string[];
        setRecords(prev => prev.filter(r => !idsToDelete.includes(r.id)));
        if (user) {
          for (const id of idsToDelete) {
            try {
              await deleteFromCloud('transactions', id);
            } catch (e) {
              console.error('刪除被合併紀錄失敗:', e);
            }
          }
        }
      } else {
        const childTxs = mergedRecordIdsToDelete as Transaction[];
        const updateMap = new Map(childTxs.map(t => [t.id, t]));
        setRecords(prev => prev.map(r => updateMap.get(r.id) || r));
        if (user) {
          for (const t of childTxs) {
            try {
              await syncToCloud('transactions', cleanData(t), t.id);
            } catch (e) {
              console.error('更新子紀錄失敗:', e);
            }
          }
        }
      }
    }

    if (restoredRecordIds && restoredRecordIds.length > 0) {
      setRecords(prev => prev.map(r => {
        if (restoredRecordIds.includes(r.id)) {
          const copy = { ...r };
          delete (copy as any).parentTransactionId;
          delete (copy as any).isChildTransaction;
          return copy;
        }
        return r;
      }));
      if (user) {
        for (const id of restoredRecordIds) {
          try {
            const recToRestore = (Array.isArray(records) ? records : []).find(r => r.id === id);
            if (recToRestore) {
              const restored = { ...recToRestore };
              delete (restored as any).parentTransactionId;
              delete (restored as any).isChildTransaction;
              await syncToCloud('transactions', restored, id);
            }
          } catch (e) {
            console.error('還原解拆紀錄失敗:', e);
          }
        }
      }
    }
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
      const wasInstallment = !!oldRecord.isInstallment || !!oldRecord.installmentGroupId || !!oldRecord.installmentId;
      const isInstallment = !!newRecord.isInstallment;
      const oldGroupId = oldRecord.installmentGroupId || (oldRecord.id.includes('-') && !oldRecord.id.startsWith('rec_') ? oldRecord.id.split('-')[0] : null);
      const oldInstallmentId = oldRecord.installmentId;

      if (isInstallment && !wasInstallment) {
        // Converting a normal transaction to a new installment group
        if (user) {
          await deleteFromCloud('transactions', oldRecord.id);
        }

        const installmentGroupId = oldGroupId || Date.now().toString();
        const total = newRecord.totalInstallments || 12;
        const totalAmtAbs = Math.abs(newRecord.amount);
        const baseAmt = Math.floor(totalAmtAbs / total);
        const remainderAmt = totalAmtAbs - (baseAmt * total);
        const startDateStr = newRecord.date;
        
        const schedule = newRecord.customSchedule || newRecord.installmentList;
        const isCustom = Boolean(newRecord.isCustomInstallment || newRecord.isCustomSchedule || (schedule && schedule.length > 0));

        const batch = user ? writeBatch(db) : null;
        const newParts: Transaction[] = [];

        for (let i = 1; i <= total; i++) {
          let dateStr: string;
          let currentAmtAbs: number;

          if (isCustom && schedule && schedule.length >= i) {
            dateStr = schedule[i - 1].date;
            currentAmtAbs = Math.abs(schedule[i - 1].amount);
          } else {
            dateStr = getCorrectInstallmentDate(startDateStr, i);
            currentAmtAbs = i <= remainderAmt ? (baseAmt + 1) : baseAmt;
          }

          const finalAmt = (newRecord.type === 'expense' || newRecord.type === 'transfer') ? -currentAmtAbs : currentAmtAbs;

          const id = `${installmentGroupId}-${i}`;
          const newPart: Transaction = {
            ...newRecord,
            id,
            amount: finalAmt,
            note: newRecord.note?.trim(),
            date: startDateStr,
            postingDate: dateStr,
            currentInstallment: i,
            totalInstallments: total,
            installmentGroupId,
            isInstallment: true,
            isCustomInstallment: isCustom,
            isCustomSchedule: isCustom,
            customSchedule: isCustom ? schedule : undefined,
            installmentList: isCustom ? schedule : undefined
          } as any;

          if (batch && user) {
            batch.set(doc(db, 'users', user.uid, 'transactions', id), cleanData(newPart));
          } else {
            newParts.push(newPart);
          }
        }

        if (batch && user) {
          await batch.commit().catch(e => handleFirestoreError(e, OperationType.WRITE, 'batch/transactions'));
        } else {
          setRecords(prev => {
            const filtered = prev.filter(r => r.id !== oldRecord.id);
            return [...filtered, ...newParts];
          });
        }
      } else if (!isInstallment && wasInstallment) {
        // Converting an installment back to a normal single transaction
        const targetGroupId = oldGroupId;
        if (user) {
          if (targetGroupId) {
            const groupRecords = records.filter(r => r.installmentGroupId === targetGroupId || r.id.startsWith(`${targetGroupId}-`));
            for (const r of groupRecords) {
              await deleteFromCloud('transactions', r.id);
            }
          } else {
            await deleteFromCloud('transactions', oldRecord.id);
          }
          await syncToCloud('transactions', cleanData(newRecord), newRecord.id);
        }

        setRecords(prev => {
          let filtered = prev;
          if (targetGroupId) {
            filtered = prev.filter(r => r.installmentGroupId !== targetGroupId && !r.id.startsWith(`${targetGroupId}-`));
          } else {
            filtered = prev.filter(r => r.id !== oldRecord.id);
          }
          return [...filtered, newRecord];
        });

        if (oldInstallmentId) {
          setInstallments(prev => prev.filter(inst => inst.id !== oldInstallmentId));
        }
      } else if (wasInstallment && isInstallment) {
        // Updating an existing installment transaction / group
        const targetGroupId = oldGroupId || newRecord.installmentGroupId;
        if (targetGroupId) {
          const groupRecords = (Array.isArray(records) ? records : []).filter(r => r.installmentGroupId === targetGroupId || r.id.startsWith(`${targetGroupId}-`));
          const first = groupRecords[0] || oldRecord;
          const totalTerms = newRecord.totalInstallments || groupRecords.length || 12;
          const totalAmtAbs = Math.abs(newRecord.amount || 0);
          const baseAmt = Math.floor(totalAmtAbs / totalTerms);
          const remainderAmt = totalAmtAbs - (baseAmt * totalTerms);
          const startDateStr = newRecord.date || first.date;

          const schedule = newRecord.customSchedule || newRecord.installmentList;
          const isCustom = Boolean(newRecord.isCustomInstallment || newRecord.isCustomSchedule || (schedule && schedule.length > 0));

          const batch = user ? writeBatch(db) : null;
          if (batch && user && groupRecords.length > 0) {
            groupRecords.forEach(r => {
              batch.delete(doc(db, 'users', user.uid, 'transactions', r.id));
            });
          }

          const newParts: Transaction[] = [];

          for (let i = 1; i <= totalTerms; i++) {
            let dateStr: string;
            let currentAmtAbs: number;

            if (isCustom && schedule && schedule.length >= i) {
              dateStr = schedule[i - 1].date;
              currentAmtAbs = Math.abs(schedule[i - 1].amount);
            } else {
              dateStr = getCorrectInstallmentDate(startDateStr, i);
              currentAmtAbs = i <= remainderAmt ? (baseAmt + 1) : baseAmt;
            }

            const finalAmt = (newRecord.type === 'expense' || newRecord.type === 'transfer') ? -currentAmtAbs : currentAmtAbs;
            const id = `${targetGroupId}-${i}`;

            const newPart: Transaction = {
              ...first,
              ...newRecord,
              id,
              amount: finalAmt,
              note: newRecord.note?.trim(),
              date: startDateStr,
              postingDate: dateStr,
              currentInstallment: i,
              totalInstallments: totalTerms,
              installmentGroupId: targetGroupId,
              isInstallment: true,
              isCustomInstallment: isCustom,
              isCustomSchedule: isCustom,
              customSchedule: isCustom ? schedule : undefined,
              installmentList: isCustom ? schedule : undefined
            } as any;

            if (batch && user) {
              batch.set(doc(db, 'users', user.uid, 'transactions', id), cleanData(newPart));
            } else {
              newParts.push(newPart);
            }
          }

          if (batch && user) {
            await batch.commit().catch(e => handleFirestoreError(e, OperationType.WRITE, 'batch/transactions'));
          } else {
            setRecords(prev => {
              const filtered = prev.filter(r => r.installmentGroupId !== targetGroupId && !r.id.startsWith(`${targetGroupId}-`));
              return [...filtered, ...newParts];
            });
          }
        } else {
          if (user) {
            await syncToCloud('transactions', cleanData(newRecord), newRecord.id);
          } else {
            setRecords(prev => prev.map(r => r.id === newRecord.id ? newRecord : r));
          }
        }
      } else {
        // Just update this single transaction (includes non-installment records)
        if (user) {
          await syncToCloud('transactions', cleanData(newRecord), newRecord.id);
        } else {
          setRecords(prev => prev.map(r => r.id === newRecord.id ? newRecord : r));
        }
      }
    }
  };

  const handleUpdateInstallmentGroup = async (
    groupId: string, 
    newNote: string, 
    newTotalAmount: number, 
    newTotalInstallments: number,
    customSchedule?: CustomInstallmentItem[]
  ) => {
    const groupRecords = records.filter(r => r.installmentGroupId === groupId);
    if (groupRecords.length === 0) return;
    
    const first = (Array.isArray(groupRecords) ? groupRecords : []).find(r => r.currentInstallment === 1) || groupRecords[0];
    const totalAmtAbs = Math.abs(newTotalAmount);
    const baseAmt = Math.floor(totalAmtAbs / newTotalInstallments);
    const remainderAmt = totalAmtAbs - (baseAmt * newTotalInstallments);
    const isCustom = Boolean(customSchedule && customSchedule.length > 0);

    if (user) {
      try {
        const batch = writeBatch(db);
        
        groupRecords.forEach(r => {
          batch.delete(doc(db, 'users', user.uid, 'transactions', r.id));
        });

        for (let i = 1; i <= newTotalInstallments; i++) {
          let dateStr: string;
          let currentAmtAbs: number;

          if (isCustom && customSchedule && customSchedule.length >= i) {
            dateStr = customSchedule[i - 1].date;
            currentAmtAbs = Math.abs(customSchedule[i - 1].amount);
          } else {
            dateStr = getCorrectInstallmentDate(first.date, i);
            currentAmtAbs = i <= remainderAmt ? (baseAmt + 1) : baseAmt;
          }

          const finalAmt = first.amount < 0 ? -currentAmtAbs : currentAmtAbs;

          const id = `${groupId}-${i}`;
          const newPart: Transaction = {
            ...first,
            id,
            amount: finalAmt,
            note: newNote.trim(),
            date: first.date,
            postingDate: dateStr,
            currentInstallment: i,
            totalInstallments: newTotalInstallments,
            installmentGroupId: groupId,
            isInstallment: true,
            isCustomInstallment: isCustom,
            isCustomSchedule: isCustom,
            customSchedule: isCustom ? customSchedule : undefined,
            installmentList: isCustom ? customSchedule : undefined
          } as any;
          
          batch.set(doc(db, 'users', user.uid, 'transactions', id), cleanData(newPart));
        }

        await batch.commit();
      } catch (error) {
        console.error('Update installment group sync failed:', error);
        alert('更新分期付款群組失敗，請稍後重試。');
        return;
      }
    }

    const newParts: Transaction[] = [];
    for (let i = 1; i <= newTotalInstallments; i++) {
      let dateStr: string;
      let currentAmtAbs: number;

      if (isCustom && customSchedule && customSchedule.length >= i) {
        dateStr = customSchedule[i - 1].date;
        currentAmtAbs = Math.abs(customSchedule[i - 1].amount);
      } else {
        dateStr = getCorrectInstallmentDate(first.date, i);
        currentAmtAbs = i <= remainderAmt ? (baseAmt + 1) : baseAmt;
      }

      const finalAmt = first.amount < 0 ? -currentAmtAbs : currentAmtAbs;

      const id = `${groupId}-${i}`;
      const newPart: Transaction = {
        ...first,
        id,
        amount: finalAmt,
        note: newNote.trim(),
        date: first.date,
        postingDate: dateStr,
        currentInstallment: i,
        totalInstallments: newTotalInstallments,
        installmentGroupId: groupId,
        isInstallment: true,
        isCustomInstallment: isCustom,
        isCustomSchedule: isCustom,
        customSchedule: isCustom ? customSchedule : undefined,
        installmentList: isCustom ? customSchedule : undefined
      } as any;
      newParts.push(newPart);
    }

    setRecords(prev => {
      const filtered = prev.filter(r => r.installmentGroupId !== groupId);
      return [...filtered, ...newParts];
    });
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
    
    const nowIso = new Date().toISOString();
    const targetIds = recordToDelete._isMergedTransfer && recordToDelete._mergedRecordIds 
      ? recordToDelete._mergedRecordIds 
      : [recordToDelete.id];
    
    const childIdsToRestore = records
      .filter(r => r.parentId === recordToDelete.id || r.parentTransactionId === recordToDelete.id || (recordToDelete.subItemIds && recordToDelete.subItemIds.includes(r.id)))
      .map(r => r.id);

    // 1. 樂觀 UI (Optimistic UI): 標記為 isDeleted: true，並還原被合併的子紀錄
    setRecords(prev => prev.map(r => {
      if (targetIds.includes(r.id)) {
        return {
          ...r,
          isDeleted: true,
          deletedAt: nowIso
        };
      }
      if (childIdsToRestore.includes(r.id)) {
        return {
          ...r,
          isMergedChild: false,
          parentId: null,
          parentTransactionId: undefined,
          isChildTransaction: false
        };
      }
      return r;
    }));
    
    // 2. 執行背景異步軟刪除與子交易還原同步
    if (user) {
      try {
        for (const tid of targetIds) {
          const rec = records.find(r => r.id === tid) || (tid === recordToDelete.id ? recordToDelete : null);
          if (rec) {
            await syncToCloud('transactions', cleanData({ ...rec, isDeleted: true, deletedAt: nowIso }), tid);
          }
        }
        for (const cid of childIdsToRestore) {
          const cr = (Array.isArray(records) ? records : []).find(r => r.id === cid);
          if (cr) {
            await syncToCloud('transactions', cleanData({
              ...cr,
              isMergedChild: false,
              parentId: null,
              parentTransactionId: undefined,
              isChildTransaction: false
            }), cid);
          }
        }
      } catch (error) {
        console.error('Soft delete failed:', error);
      }
    }
    
    const primaryId = recordToDelete.id;
    const deletedTargetIds = targetIds;
    setRecordToDelete(null);

    showUndoToast('交易明細已移至垃圾桶', () => handleRestoreRecord(primaryId, deletedTargetIds));
  };

  const handleRestoreRecord = async (primaryId: string, targetIds?: string[]) => {
    const idsToRestore = targetIds || [primaryId];
    setRecords(prev => prev.map(r => {
      if (idsToRestore.includes(r.id)) {
        const copy = { ...r };
        delete copy.isDeleted;
        delete copy.deletedAt;
        return copy;
      }
      return r;
    }));

    if (user) {
      try {
        for (const tid of idsToRestore) {
          const rec = records.find(r => r.id === tid);
          if (rec) {
            const restored = { ...rec };
            delete restored.isDeleted;
            delete restored.deletedAt;
            await syncToCloud('transactions', cleanData(restored), tid);
          }
        }
      } catch (error) {
        console.error('Restore failed:', error);
      }
    }
  };

  const handleRestoreStock = async (stockId: string) => {
    setStocks(prev => {
      const next = prev.map(s => {
        if (s.id === stockId) {
          const copy = { ...s };
          delete copy.isDeleted;
          delete copy.deletedAt;
          return copy;
        }
        return s;
      });
      try {
        localStorage.setItem('coco_stocks', JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    if (user) {
      try {
        const stockToRestore = stocks.find(s => s.id === stockId);
        if (stockToRestore) {
          const copy = { ...stockToRestore };
          delete copy.isDeleted;
          delete copy.deletedAt;
          await syncToCloud('stocks', cleanData(copy), stockId);
        }
      } catch (error) {
        console.error('Restore stock failed:', error);
      }
    }
  };

  const handleHardDeleteRecord = async (recordId: string) => {
    setRecords(prev => prev.filter(r => r.id !== recordId));
    if (user) {
      try {
        await deleteFromCloud('transactions', recordId);
      } catch (e) {
        console.error('Hard delete record failed:', e);
      }
    }
  };

  const handleHardDeleteStock = async (stockId: string) => {
    setStocks(prev => {
      const next = prev.filter(s => s.id !== stockId);
      try {
        localStorage.setItem('coco_stocks', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
    if (user) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'stocks', stockId));
      } catch (e) {
        console.error('Hard delete stock failed:', e);
      }
    }
  };

  const handleClearTrash = async (tab: 'all' | 'records' | 'stocks') => {
    const deletedRecs = records.filter(r => r.isDeleted);
    const deletedStks = stocks.filter(s => s.isDeleted);

    if (tab === 'all' || tab === 'records') {
      const recIds = deletedRecs.map(r => r.id);
      setRecords(prev => prev.filter(r => !recIds.includes(r.id)));
      if (user) {
        for (const id of recIds) {
          await deleteFromCloud('transactions', id);
        }
      }
    }

    if (tab === 'all' || tab === 'stocks') {
      const stkIds = deletedStks.map(s => s.id);
      setStocks(prev => {
        const next = prev.filter(s => !stkIds.includes(s.id));
        try {
          localStorage.setItem('coco_stocks', JSON.stringify(next));
        } catch (e) {}
        return next;
      });
      if (user) {
        for (const id of stkIds) {
          await deleteDoc(doc(db, 'users', user.uid, 'stocks', id));
        }
      }
    }
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
    if (!(Array.isArray(accounts) ? accounts : []).find(a => a.id === updatedAcc.id)) {
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
        const exists = (Array.isArray(prev) ? prev : []).find(a => a.id === finalAccount.id);
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
      const existingInit = (Array.isArray(records) ? records : []).find(r => r.accountId === finalAccount.id && r.category === '初始資金');
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
    const parentVal = p.parentProjectId ?? p.parentId ?? null;
    let finalProject: Project = {
      ...p,
      parentId: parentVal || undefined,
      parentProjectId: parentVal,
      isStandalone: parentVal === null ? true : false,
    };
    if (!(Array.isArray(projects) ? projects : []).find(x => x.id === p.id)) {
      const maxOrder = projects.reduce((max, x) => Math.max(max, x.order || 0), 0);
      finalProject.order = maxOrder + 1;
    }

    if (user) {
      await syncToCloud('projects', finalProject, finalProject.id);
    } else {
      setProjects(prev => {
        const next = (Array.isArray(prev) ? prev : []).find(x => x.id === finalProject.id)
          ? prev.map(x => x.id === finalProject.id ? finalProject : x)
          : [...prev, finalProject];
        return ensureProjectHierarchy(next);
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
      <div className={`w-full h-full flex flex-col bg-[#FFF9E3] relative shadow-2xl md:border-x border-stone-100 transition-all ${
        currentView === 'projects' ? 'max-w-md md:max-w-5xl lg:max-w-6xl xl:max-w-7xl' : 'max-w-md md:max-w-4xl'
      }`}>
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
                    <button 
                      onClick={() => {
                        const cur = (Array.isArray(projects) ? projects : []).find(p => p.id === selectedProjectId);
                        if (cur) {
                          setEditingProject(cur);
                          setIsProjectEditModalOpen(true);
                        }
                      }}
                      className="p-2 hover:bg-white/50 rounded-full transition-colors"
                      title="編輯專案"
                    >
                      <Settings2 size={24} className="text-[#5D4037]" />
                    </button>
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
                      <div 
                        onClick={() => alert('✨ 累計透過 AI 智慧拆分與發票辨識處理的記帳次數')}
                        className="mt-1 flex items-center gap-1.5 px-2.5 py-0.5 bg-[#E0F2FE] hover:bg-[#BAE6FD] text-[#0369A1] rounded-full border border-[#0284C7]/30 text-[11px] font-black cursor-pointer shadow-xs active:scale-95 transition-all w-fit"
                        title="點擊查看說明"
                      >
                        <Sparkles size={12} className="text-[#0284C7] shrink-0" />
                        <span>AI 解析使用：{aiParseCount} 次</span>
                      </div>
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
                  <DrawerItem 
                    icon={<Coins size={20} />} 
                    label="代墊/待收款清單" 
                    onClick={() => { setCurrentView('prepayments'); setIsDrawerOpen(false); }} 
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
                accounts={accounts} 
                netAssets={netAssets}
                totalAssets={totalAssets}
                totalLiabilities={totalLiabilities}
                onAccountClick={(acc) => {
                  setSelectedAccountForDetail(acc);
                  setCurrentView('accountDetail');
                }}
                onAddAccount={handleAddAccount}
                onDuplicateRecord={handleDuplicateTransaction}
                balances={accountBalances}
                currencyMode={currencyMode}
                onCurrencyModeChange={setCurrencyMode}
                records={records}
                stocks={stocks}
                onSaveStock={handleSaveStock}
                onDeleteStock={handleDeleteStock}
                onAddRecord={handleSaveRecord}
                categories={categories}
                projects={projects}
                onUpdateRecord={handleUpdateRecord}
                onDeleteRecord={handleDeleteRecord}
                onOpenRateModal={(acc) => setRateModalAccount(acc)}
              />
            )}
            {currentView === 'accountDetail' && selectedAccountForDetail && (
              <AccountDetailView 
                account={(Array.isArray(accounts) ? accounts : []).find(a => a.id === selectedAccountForDetail.id) || selectedAccountForDetail}
                records={records}
                selectedDate={selectedDate}
                onBack={() => {
                  setSelectedAccountForDetail(null);
                  setCurrentView('accounts');
                }}
                onEdit={() => {
                  setEditingAccount((Array.isArray(accounts) ? accounts : []).find(a => a.id === selectedAccountForDetail.id) || selectedAccountForDetail);
                  setIsAccountEditModalOpen(true);
                }}
                onUpdateRecord={handleUpdateRecord}
                onDeleteRecord={handleDeleteRecord}
                onDuplicateRecord={handleDuplicateTransaction}
                accounts={accounts}
                projects={projects}
                balance={accountBalances[selectedAccountForDetail.id] || 0}
                categories={categories}
                onUpdateAccountsList={setAccounts}
                onOpenRateModal={(acc) => setRateModalAccount(acc)}
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
                onDuplicateRecord={handleDuplicateTransaction}
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
                    if ((Array.isArray(fixedRecords) ? fixedRecords : []).find(r => r.id === fr.id)) {
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
                  project={(Array.isArray(projects) ? projects : []).find(p => p.id === selectedProjectId)!}
                  records={records}
                  accounts={accounts}
                  categories={categories}
                  projects={projects}
                  onBack={() => setSelectedProjectId(null)}
                  onUpdateRecord={handleUpdateRecord}
                  onDeleteRecord={handleDeleteRecord}
                  onDuplicateRecord={handleDuplicateTransaction}
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
            {currentView === 'prepayments' && (
              <PrepaymentsView 
                records={activeRecords}
                accounts={accounts}
                projects={projects}
                categories={categories}
                onBack={() => setCurrentView('more')}
                onUpdateRecord={handleUpdateRecord}
                onDeleteRecord={handleDeleteRecord}
                onDuplicateRecord={handleDuplicateTransaction}
              />
            )}
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
                onUpdateGroup={handleUpdateInstallmentGroup}
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
                onDuplicateRecord={handleDuplicateTransaction}
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
                accounts={accounts}
                onUpdateRecord={handleUpdateRecord}
                onDeleteRecord={confirmDeleteRecord}
                onDuplicateRecord={handleDuplicateTransaction}
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
                aiParseCount={aiParseCount}
                onForceSync={handleForceSync}
                setRecords={setRecords}
                setAccounts={setAccounts}
                setInstallments={setInstallments}
                setProjects={setProjects}
                setTemplates={setTemplates}
                setFixedRecords={setFixedRecords}
                onUpdateTemplates={handleUpdateTemplates}
                onUpdateCategories={handleUpdateCategories}
                onOpenAiSplit={() => { setAiSplitInitialTab('expense'); setIsAiSplitModalOpen(true); }}
                onOpenRecycleBin={() => setCurrentView('recycleBin')}
                deletedCount={records.filter(r => r.isDeleted).length + stocks.filter(s => s.isDeleted).length}
              />
            )}
            {currentView === 'recycleBin' && (
              <RecycleBinView
                records={records}
                stocks={stocks}
                accounts={accounts}
                onBack={() => setCurrentView('more')}
                onRestoreRecord={handleRestoreRecord}
                onRestoreStock={handleRestoreStock}
                onHardDeleteRecord={handleHardDeleteRecord}
                onHardDeleteStock={handleHardDeleteStock}
                onClearTrash={handleClearTrash}
              />
            )}
          </AnimatePresence>
        </main>

        {/* Undo Toast */}
        <AnimatePresence>
          {undoToast && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#2D2321] text-white px-5 py-3.5 rounded-full shadow-2xl border border-stone-700/50 flex items-center gap-4 min-w-[280px] justify-between"
            >
              <div className="flex items-center gap-2">
                <Trash2 size={18} className="text-amber-400 shrink-0" />
                <span className="text-sm font-bold">{undoToast.message}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  undoToast.onUndo();
                  setUndoToast(null);
                }}
                className="px-3 py-1 bg-[#FBC02D] text-[#5D4037] hover:bg-[#FDD835] rounded-full text-xs font-black transition-transform active:scale-95 flex items-center gap-1 shrink-0"
              >
                <span>↩️ 復原</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

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
              initialRecord={duplicatingRecord}
              onUpdateTemplates={handleUpdateTemplates}
              onUpdateCategories={handleUpdateCategories}
              onClose={() => {
                setIsRecordModalOpen(false);
                setDuplicatingRecord(null);
              }}
              onSave={(r, keepOpen) => {
                handleSaveRecord(r, keepOpen);
                if (!keepOpen) setDuplicatingRecord(null);
              }}
              selectedDate={selectedDate}
              records={records}
              onOpenAiSplit={(modeTab, items, date, time, note) => { 
                setAiSplitInitialTab(modeTab); 
                setAiSplitPresetData(items && items.length > 0 ? { items, date, time, note } : null);
                setIsRecordModalOpen(false); 
                setDuplicatingRecord(null);
                setIsAiSplitModalOpen(true); 
              }}
            />
          )}
        </AnimatePresence>

        {/* AI Split Modal */}
        <AnimatePresence>
          {isAiSplitModalOpen && (
            <AiSplitModal 
              isOpen={isAiSplitModalOpen}
              initialTab={aiSplitInitialTab}
              presetData={aiSplitPresetData}
              onClose={() => {
                setIsAiSplitModalOpen(false);
                setAiSplitPresetData(null);
              }}
              accounts={accounts}
              categories={categories}
              projects={projects}
              user={user}
              onSaveBatch={handleSaveBatchRecords}
              onIncrementAiCount={incrementAiParseCount}
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
        {/* Exchange Rate Modal */}
        <AnimatePresence>
          {rateModalAccount && (
            <ExchangeRateModal
              account={rateModalAccount}
              isOpen={!!rateModalAccount}
              onClose={() => setRateModalAccount(null)}
              onSaveAccount={handleSaveAccount}
              records={records}
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

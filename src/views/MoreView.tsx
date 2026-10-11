import { db } from '../lib/firebase';
import { getFontFamily } from '../lib/financeUtils';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  ChevronRight,
  CloudDownload,
  CloudUpload,
  Database,
  Download,
  History,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { User } from 'firebase/auth';
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import type { Account, Category, FixedRecord, Installment, Project, Template, Transaction } from '../types';
import { cleanData } from '../lib/firestoreSync';
import { INITIAL_CATEGORIES, INITIAL_PROJECTS } from '../lib/defaults';
import { formatLocalDate } from '../lib/dateUtils';
import { getLatestExchangeRate } from '../lib/recordUtils';
import { calculateAccountBalance } from '../lib/accountUtils';

export function MoreView({ 
  records, 
  accounts, 
  installments, 
  projects,
  categories,
  templates,
  fixedRecords,
  user,
  aiParseCount = 0,
  onForceSync,
  setRecords, 
  setAccounts,
  setInstallments,
  setProjects,
  setTemplates,
  setFixedRecords,
  onUpdateTemplates,
  onUpdateCategories,
  onOpenAiSplit,
  onOpenRecycleBin,
  deletedCount = 0
}: { 
  records: Transaction[], 
  accounts: Account[], 
  installments: Installment[],
  projects: Project[],
  categories: Category[],
  templates: Template[],
  fixedRecords: FixedRecord[],
  user: User | null,
  aiParseCount?: number,
  onForceSync: () => Promise<boolean | undefined>,
  setRecords: (r: Transaction[]) => void,
  setAccounts: React.Dispatch<React.SetStateAction<Account[]>>,
  setInstallments: (i: Installment[]) => void,
  setProjects: (p: Project[]) => void,
  setTemplates: (t: Template[]) => void,
  setFixedRecords: (fr: FixedRecord[]) => void,
  onUpdateTemplates: (t: Template[]) => void,
  onUpdateCategories: (c: Category[]) => void,
  onOpenAiSplit: () => void,
  onOpenRecycleBin?: () => void,
  deletedCount?: number
}) {
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [importPreview, setImportPreview] = useState<{ transactions: Transaction[], total: number } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [cloudBackups, setCloudBackups] = useState<any[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [exportAccountId, setExportAccountId] = useState<string>('all');

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
      alert('還原失敗：' + (err.message || err));
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
      const acc = (Array.isArray(accounts) ? accounts : []).find(a => cleanAccName(a.name) === cleaned);
      return acc?.id;
    };

    // Virtual mapping for new accounts detected in importPreview
    const pendingAccountMap = new Map<string, string>();
    importPreview.transactions.forEach(t => {
      const candidates = [(t as any)._importMainAccountName, t._importSourceAccountName, t._importDestAccountName];
      candidates.forEach(raw => {
        if (!raw || raw === '-') return;
        const trimmed = raw.trim();
        if (!trimmed) return;
        const cleaned = cleanAccName(trimmed);
        const lower = trimmed.toLowerCase();
        if (!existingAccountNamesMap.has(lower) && !findExistingAccountId(trimmed)) {
          if (!pendingAccountMap.has(lower)) {
            const tempId = `pending_acc_${cleaned}`;
            pendingAccountMap.set(lower, tempId);
            pendingAccountMap.set(cleaned, tempId);
            pendingAccountMap.set(trimmed, tempId);
          }
        }
      });
    });

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
                       findExistingAccountId(trimmed) ||
                       pendingAccountMap.get(trimmed) ||
                       pendingAccountMap.get(trimmed.toLowerCase()) ||
                       pendingAccountMap.get(cleanAccName(trimmed));
        return target || defaultId;
      };

      let resolvedAccountId = imported.accountId;
      let resolvedToAccountId = imported.toAccountId;

      if (imported.type === 'transfer') {
        resolvedAccountId = sourceName ? getMappedAccountId(sourceName, imported.accountId) : (mainRawName ? getMappedAccountId(mainRawName, imported.accountId) : imported.accountId);
        resolvedToAccountId = destName ? getMappedAccountId(destName, imported.toAccountId || '') : (imported.toAccountId || '');
      } else if (imported.type === 'income') {
        resolvedAccountId = (destName && destName !== '-') ? getMappedAccountId(destName, imported.accountId) : 
                           (mainRawName ? getMappedAccountId(mainRawName, imported.accountId) : 
                           ((sourceName && sourceName !== '-') ? getMappedAccountId(sourceName, imported.accountId) : imported.accountId));
        resolvedToAccountId = undefined;
      } else { // expense
        resolvedAccountId = (sourceName && sourceName !== '-') ? getMappedAccountId(sourceName, imported.accountId) : 
                           (mainRawName ? getMappedAccountId(mainRawName, imported.accountId) : imported.accountId);
        resolvedToAccountId = undefined;
      }

      if (imported.type === 'transfer') {
        if (!resolvedAccountId) {
          resolvedAccountId = accounts[0]?.id || 'cash';
        }
        if (!resolvedToAccountId) {
          const sibling = (Array.isArray(accounts) ? accounts : []).find(a => a.id !== resolvedAccountId);
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

    const getAccountSortingInfo = (r: Transaction) => {
      const acc = (Array.isArray(accounts) ? accounts : []).find(x => x.id === r.accountId);
      const parentAcc = acc?.parentId ? (Array.isArray(accounts) ? accounts : []).find(x => x.id === acc.parentId) : null;
      const parentName = parentAcc ? parentAcc.name : (acc?.name || '未知帳戶');
      const childName = parentAcc ? (acc?.name || '') : '';
      return { parentName, childName };
    };

    const sortFunc = (a: Transaction, b: Transaction) => {
      const infoA = getAccountSortingInfo(a);
      const infoB = getAccountSortingInfo(b);
      const parentCompare = infoA.parentName.localeCompare(infoB.parentName);
      if (parentCompare !== 0) return parentCompare;
      if (infoA.childName && !infoB.childName) return 1;
      if (!infoA.childName && infoB.childName) return -1;
      const childCompare = infoA.childName.localeCompare(infoB.childName);
      if (childCompare !== 0) return childCompare;
      return a.date.localeCompare(b.date);
    };

    unique.sort(sortFunc);
    duplicates.sort(sortFunc);

    return { unique, duplicates };
  }, [importPreview, records, accounts, projects]);

  const pendingNewAccountNames = useMemo(() => {
    if (!importPreview) return [];
    const cleanAccName = (s: string) => String(s).replace(/\s+/g, '').replace(/[-_@()（）]/g, '').trim().toLowerCase();
    const existingCleaned = new Set(accounts.map(a => cleanAccName(a.name)));
    const existingRaw = new Set(accounts.map(a => a.name.trim().toLowerCase()));

    const newNames = new Set<string>();
    importPreview.transactions.forEach(t => {
      const candidates = [
        (t as any)._importMainAccountName,
        t._importSourceAccountName,
        t._importDestAccountName
      ];
      candidates.forEach(raw => {
        if (!raw || raw === '-') return;
        const trimmed = raw.trim();
        if (!trimmed) return;
        const cleaned = cleanAccName(trimmed);
        const lower = trimmed.toLowerCase();
        if (!existingRaw.has(lower) && !existingCleaned.has(cleaned)) {
          newNames.add(trimmed);
        }
      });
    });
    return Array.from(newNames);
  }, [importPreview, accounts]);

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
      
      // Update states (monthlyBudget is synced in real-time via onSnapshot unsubProfile in App)
      setRecords(txData);
      setAccounts(accData.sort((a, b) => (a.order || 0) - (b.order || 0)));
      onUpdateCategories(catData.length > 0 ? catData : INITIAL_CATEGORIES);
      setProjects(projData.length > 0 ? projData : INITIAL_PROJECTS);
      setFixedRecords(fixedData);
      setInstallments(instData);
      setTemplates(tempData);

      alert('雲端資料還原成功！');
    } catch (err) {
      console.error('Cloud restore failed:', err);
      alert('還原失敗：' + (err.message || err));
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
        let found = (Array.isArray(accounts) ? accounts : []).find(a => a.name.trim() === trimmed) || 
                    newAccountsToCreate.find(a => a.name.trim() === trimmed);
        if (found) return found.id;
        // 2. Case-insensitive full string match (no substring) with ===
        found = (Array.isArray(accounts) ? accounts : []).find(a => a.name.trim().toLowerCase() === trimmed.toLowerCase()) ||
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
            order: accounts.length + newAccountsToCreate.length + 1,
            ...(resolvedType === 'points' ? { excludeFromNetWorth: true } : {})
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

        let mainCat = (Array.isArray(updatedCategories) ? updatedCategories : []).find(c => c.name.toLowerCase() === mainName.toLowerCase() && c.type === type);
        
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

        if (imported.type === 'transfer') {
          resolvedAccountId = sourceName ? getMappedAccountId(sourceName, imported.accountId) : (mainRawName ? getMappedAccountId(mainRawName, imported.accountId) : imported.accountId);
          resolvedToAccountId = destName ? getMappedAccountId(destName, imported.toAccountId || '') : (imported.toAccountId || '');
        } else if (imported.type === 'income') {
          resolvedAccountId = (destName && destName !== '-') ? getMappedAccountId(destName, imported.accountId) : 
                             (mainRawName ? getMappedAccountId(mainRawName, imported.accountId) : 
                             ((sourceName && sourceName !== '-') ? getMappedAccountId(sourceName, imported.accountId) : imported.accountId));
          resolvedToAccountId = undefined;
        } else { // expense
          resolvedAccountId = (sourceName && sourceName !== '-') ? getMappedAccountId(sourceName, imported.accountId) : 
                             (mainRawName ? getMappedAccountId(mainRawName, imported.accountId) : imported.accountId);
          resolvedToAccountId = undefined;
        }

        // Defensive checks for transfers
        if (imported.type === 'transfer') {
          if (!resolvedAccountId) {
            resolvedAccountId = accounts[0]?.id || 'cash';
          }
          if (!resolvedToAccountId) {
            const sibling = (Array.isArray(accounts) ? accounts : []).find(a => a.id !== resolvedAccountId) || newAccountsToCreate.find(a => a.id !== resolvedAccountId);
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
    
    const getAccountSortingInfo = (r: Transaction) => {
      const acc = (Array.isArray(accounts) ? accounts : []).find(x => x.id === r.accountId);
      const parentAcc = acc?.parentId ? (Array.isArray(accounts) ? accounts : []).find(x => x.id === acc.parentId) : null;
      const parentName = parentAcc ? parentAcc.name : (acc?.name || '未知帳戶');
      const childName = parentAcc ? (acc?.name || '') : '';
      return { parentName, childName };
    };

    // Filter records by date range and selected account, then sort by Parent Account, then Child Account, then Date
    const filtered = records.filter(r => {
      const date = r.date;
      const matchesDate = date >= exportRange.start && date <= exportRange.end;
      if (!matchesDate) return false;
      if (exportAccountId === 'all') return true;
      return r.accountId === exportAccountId || r.toAccountId === exportAccountId;
    }).sort((a, b) => {
      const infoA = getAccountSortingInfo(a);
      const infoB = getAccountSortingInfo(b);
      const parentCompare = infoA.parentName.localeCompare(infoB.parentName);
      if (parentCompare !== 0) return parentCompare;
      if (infoA.childName && !infoB.childName) return 1;
      if (!infoA.childName && infoB.childName) return -1;
      const childCompare = infoA.childName.localeCompare(infoB.childName);
      if (childCompare !== 0) return childCompare;
      return a.date.localeCompare(b.date);
    });

    const twdRows: any[][] = [];
    const foreignRows: any[][] = [];

    filtered.forEach(r => {
      const acc = (Array.isArray(accounts) ? accounts : []).find(a => a.id === r.accountId);
      const toAcc = r.toAccountId ? (Array.isArray(accounts) ? accounts : []).find(a => a.id === r.toAccountId) : null;
      
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

      const proj = (Array.isArray(projects) ? projects : []).find(p => p.id === r.projectId);
      let catMain = r.category;
      let catSub = '';
      if (r.category && r.category.includes(' > ')) {
        const parts = r.category.split(' > ');
        catMain = parts[0];
        catSub = parts[1];
      } else {
        const catObj = (Array.isArray(categories) ? categories : []).find(c => c.name === r.category || c?.sub?.includes(r.category));
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
          r.time ? `${r.date} ${r.time}` : r.date,
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
          r.time ? `${r.date} ${r.time}` : r.date,
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
      
      const accName = exportAccountId === 'all' ? '' : `_${(Array.isArray(accounts) ? accounts : []).find(a => a.id === exportAccountId)?.name || ''}`;
      XLSX.writeFile(wb, `KK記帳_匯出${accName}_${exportRange.start}_${exportRange.end}.xlsx`);
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
            sheetData.forEach((row: any) => {
              row._sheetName = sheetName;
            });
            jsonData = jsonData.concat(sheetData);
          });
          
          if (jsonData.length === 0) throw new Error('檔案中沒有資料');

          // Try to deduce an account name from sheetName or file.name
          let deducedAccountName = '';
          for (const sName of workbook.SheetNames) {
            const cleanS = sName.trim();
            const matched = (Array.isArray(accounts) ? accounts : []).find(a => cleanS.toLowerCase() === a.name.trim().toLowerCase() || cleanS.includes(a.name));
            if (matched) {
              deducedAccountName = matched.name;
              break;
            }
          }
          if (!deducedAccountName && file.name) {
            const baseFileName = file.name.replace(/\.[^.]+$/, '');
            const matched = (Array.isArray(accounts) ? accounts : []).find(a => baseFileName.includes(a.name) || (a.name.length >= 2 && baseFileName.toLowerCase().includes(a.name.toLowerCase())));
            if (matched) {
              deducedAccountName = matched.name;
            }
          }

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
              if (raw instanceof Date) {
                const y = raw.getFullYear();
                const m = String(raw.getMonth() + 1).padStart(2, '0');
                const day = String(raw.getDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
              }
              if (typeof raw === 'number') {
                const dateObj = new Date(Math.round((raw - 25569) * 86400 * 1000));
                const y = dateObj.getFullYear();
                const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                const day = String(dateObj.getDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
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

            const parseTime = (raw: any) => {
              if (!raw) return undefined;
              if (raw instanceof Date) {
                const hh = String(raw.getHours()).padStart(2, '0');
                const mm = String(raw.getMinutes()).padStart(2, '0');
                if (raw.getHours() === 0 && raw.getMinutes() === 0) return undefined;
                return `${hh}:${mm}`;
              }
              if (typeof raw === 'number') {
                const dateObj = new Date(Math.round((raw - 25569) * 86400 * 1000));
                const hh = String(dateObj.getHours()).padStart(2, '0');
                const mm = String(dateObj.getMinutes()).padStart(2, '0');
                if (dateObj.getHours() === 0 && dateObj.getMinutes() === 0) return undefined;
                return `${hh}:${mm}`;
              }
              if (typeof raw === 'string') {
                const str = raw.trim();
                // Match hh:mm or hh:mm:ss with optional am/pm/meridian prefix/suffix
                const match = str.match(/(?:^|\s|下午|上午|pm|am)(\d{1,2}):(\d{2})(?::(\d{2}))?/i);
                if (match) {
                  let hh = parseInt(match[1], 10);
                  const mm = match[2];
                  const isPM = str.includes('PM') || str.includes('pm') || str.includes('下午');
                  const isAM = str.includes('AM') || str.includes('am') || str.includes('上午');
                  if (isPM && hh < 12) {
                    hh += 12;
                  } else if (isAM && hh === 12) {
                    hh = 0;
                  }
                  return `${String(hh).padStart(2, '0')}:${mm}`;
                }
              }
              return undefined;
            };

            const consumeDateRaw = getVal(row, ['消費日期', '日期', '日期(yyyy/MM/dd)', 'date']);
            const excelTimeRaw = getVal(row, ['時間', 'time', '交易時間']);
            let time = parseTime(excelTimeRaw);
            if (!time) {
              time = parseTime(consumeDateRaw);
            }
            const postingDateRaw = getVal(row, ['入帳日期', 'posting date']);
            
            const date = parseDate(consumeDateRaw) || formatLocalDate(new Date());
            const postingDateVal = parseDate(postingDateRaw);
            const isPendingValue = getVal(row, ['入帳日期', 'posting date status']) === '未入帳';
            
            // Ensure BOTH date and postingDate are stored (use date as fallback for postingDate if not pending)
            const finalPostingDate = postingDateVal || (isPendingValue ? undefined : date);
            
            const mainCat = String(getVal(row, ['主分類', '類別', 'category', '分類', '主類別']) || '').trim();
            const subCat = String(getVal(row, ['子分類', '次分類', 'subCategory', '子類別', '次類別']) || '').trim();
            const category = (mainCat && subCat) ? `${mainCat} > ${subCat}` : (mainCat || subCat || '其他');
            
            // 2. Resolve Accounts
            let expAcc = String(getVal(row, ['支出帳戶', '來源帳戶', '轉出帳戶', '轉出', '從帳戶', 'Source Account', '轉出帳號']) || '').trim();
            let incAcc = String(getVal(row, ['收入帳戶', '目的帳戶', '目標帳戶', '目標', '轉入帳戶', '轉帳帳戶', '轉入', '轉至', '到帳戶', 'Dest Account', 'Destination Account', '轉入帳號']) || '').trim();
            let genAcc = String(getVal(row, ['帳戶', '帳戶名稱', 'Account', '主要帳戶', '本戶帳戶', '本戶', '帳號', '帳戶/卡號']) || '').trim();

            if (!genAcc && (row as any)._sheetName) {
              const sheetMatched = (Array.isArray(accounts) ? accounts : []).find(a => (row as any)._sheetName.trim().toLowerCase() === a.name.trim().toLowerCase() || (row as any)._sheetName.includes(a.name));
              if (sheetMatched) {
                genAcc = sheetMatched.name;
              }
            }

            if (expAcc === '-') expAcc = '';
            if (incAcc === '-') incAcc = '';
            if (genAcc === '-') genAcc = '';

            const currentAccName = genAcc || deducedAccountName || accounts[0]?.name || '主要帳戶';

            const findAccByName = (name: string) => {
              if (!name) return undefined;
              const trimmed = name.trim();
              // 1. Precise 100% exact full string match with ===
              let found = (Array.isArray(accounts) ? accounts : []).find(a => a.name.trim() === trimmed);
              if (found) return found;
              // 2. Case-insensitive full string match (no substring) with ===
              found = (Array.isArray(accounts) ? accounts : []).find(a => a.name.trim().toLowerCase() === trimmed.toLowerCase());
              return found;
            };
            
            const parseSignedVal = (val: any) => {
              if (val === undefined || val === null) return 0;
              if (typeof val === 'number') return val;
              const s = String(val).replace(/[^\d.-]/g, '').trim();
              const num = parseFloat(s);
              return isNaN(num) ? 0 : num;
            };

            const expenseColAmt = parseSignedVal(getVal(row, ['支出金額', '提款金額', '轉出金額', '提款', '提出金額', '借方金額', '借方', '支出']));
            const incomeColAmt = parseSignedVal(getVal(row, ['存入金額', '存款金額', '轉入金額', '存入', '貸方金額', '貸方', '收入金額', '收入']));
            let rawAmount = parseSignedVal(getVal(row, ['金額', '小計', 'amount']));

            if (rawAmount === 0) {
              if (expenseColAmt !== 0) {
                rawAmount = -Math.abs(expenseColAmt);
              } else if (incomeColAmt !== 0) {
                rawAmount = Math.abs(incomeColAmt);
              }
            }

            let importedToAmount: number | undefined = undefined;
            let importedExchangeRate: number | undefined = undefined;

            const foreignAmt = parseSignedVal(getVal(row, ['外幣金額']));
            const twdAmt = parseSignedVal(getVal(row, ['折合台幣金額']));
            const rateVal = parseSignedVal(getVal(row, ['匯率']));

            if (rawAmount === 0 && (foreignAmt !== 0 || twdAmt !== 0)) {
              // Determine currency based on account lookup
              const sAcc = findAccByName(expAcc || currentAccName);
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
                const sAcc = findAccByName(expAcc || currentAccName);
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

            const rawTypeText = String(getVal(row, ['類型', '交易類型', 'Type', '收支類型']) || '').trim();
            const rawCategoryText = String(mainCat || '').trim();
            const rawSubCategoryText = String(subCat || '').trim();
            const rawNoteText = String(getVal(row, ['明細', '項目', '品項', '名稱', '內容', '消費項目', '備註', '說明']) || '').trim();
            const rawProjectText = String(getVal(row, ['專案', 'Project', '專案名稱']) || '').trim();

            const isDoubleAccount = Boolean(expAcc && incAcc && expAcc !== '-' && incAcc !== '-');
            const isAutoReloadText = rawNoteText.includes('自動加值') || rawCategoryText.includes('自動加值') || rawTypeText.includes('自動加值') || rawCategoryText.includes('加值');

            const isTransferSignal = 
              rawTypeText.includes('轉帳') || 
              rawTypeText.includes('轉出') || 
              rawTypeText.includes('轉入') ||
              rawCategoryText.includes('轉帳') || 
              rawCategoryText === '轉出' || 
              rawCategoryText === '轉入' ||
              rawCategoryText.includes('轉出') || 
              rawCategoryText.includes('轉入') ||
              isAutoReloadText ||
              isDoubleAccount;

            let type: Transaction['type'] = 'expense';
            if (isTransferSignal) {
              type = 'transfer';
            } else if (rawTypeText.includes('收入') || rawCategoryText.includes('收入') || (incomeColAmt !== 0 && expenseColAmt === 0)) {
              type = 'income';
            } else if (rawTypeText.includes('支出') || rawCategoryText.includes('支出') || (expenseColAmt !== 0 && incomeColAmt === 0)) {
              type = 'expense';
            } else if (rawAmount < 0) {
              type = 'expense';
            } else if (rawAmount > 0) {
              type = 'income';
            } else {
              type = incAcc ? 'income' : 'expense';
            }

            // 清理子分類或專案作為對應帳戶候選名稱
            const cleanCounterpartCandidate = (s: string) => {
              if (!s) return '';
              const trimmed = s.trim();
              if (trimmed === '-' || trimmed.toLowerCase() === 'null' || trimmed === '其他' || trimmed === '一般' || trimmed === '未分類' || trimmed === '轉帳') return '';
              if (trimmed.includes('>')) {
                const parts = trimmed.split('>').map(p => p.trim()).filter(Boolean);
                return parts[parts.length - 1] || '';
              }
              return trimmed;
            };

            const subCatTarget = cleanCounterpartCandidate(rawSubCategoryText);
            const projectTarget = cleanCounterpartCandidate(rawProjectText);
            const counterpartCandidate = subCatTarget || projectTarget || '';

            // 轉帳方向判斷規則：
            // 1. 若【主分類】為「轉出」（或類型為轉出、或金額為負數/支出欄位有值）:
            //    - 來源帳戶 (From Account)：自動指定為「當前匯入的帳戶」（例如：中國信託）
            //    - 目的帳戶 (To Account)：自動對應【子分類】或【專案】所標記的目標帳戶（例如：LINE Pay、元大銀行）
            //    - 判定為資產由本戶轉出
            // 2. 若【主分類】為「轉入」（或類型為轉入、或金額為正數/存入欄位有值）:
            //    - 來源帳戶 (From Account)：自動對應【子分類】或【專案】所標記的來源帳戶（例如：京城銀行）
            //    - 目的帳戶 (To Account)：自動指定為「當前匯入的帳戶」（例如：中國信託）
            //    - 判定為外部資金轉入本戶
            let isTransferOut = false;
            if (rawCategoryText.includes('轉出') || rawTypeText.includes('轉出')) {
              isTransferOut = true;
            } else if (rawCategoryText.includes('轉入') || rawTypeText.includes('轉入')) {
              isTransferOut = false;
            } else if (expenseColAmt !== 0 && incomeColAmt === 0) {
              isTransferOut = true;
            } else if (incomeColAmt !== 0 && expenseColAmt === 0) {
              isTransferOut = false;
            } else if (rawAmount < 0) {
              isTransferOut = true;
            } else if (rawAmount > 0) {
              isTransferOut = false;
            } else {
              isTransferOut = true;
            }

            let sourceAccName = '';
            let destAccName = '';

            if (type === 'transfer') {
              if (isDoubleAccount) {
                sourceAccName = expAcc;
                destAccName = incAcc;
              } else if (isTransferOut) {
                sourceAccName = currentAccName;
                destAccName = counterpartCandidate || incAcc || '';
                // 若目的帳戶尚未找到，嘗試自備註尋找提及之其他既有帳戶
                if (!destAccName) {
                  const matchedAcc = (Array.isArray(accounts) ? accounts : []).find(a => a.name !== currentAccName && rawNoteText.includes(a.name));
                  if (matchedAcc) destAccName = matchedAcc.name;
                }
              } else {
                sourceAccName = counterpartCandidate || expAcc || '';
                destAccName = currentAccName;
                // 若來源帳戶尚未找到，嘗試自備註尋找提及之其他既有帳戶
                if (!sourceAccName) {
                  const matchedAcc = (Array.isArray(accounts) ? accounts : []).find(a => a.name !== currentAccName && rawNoteText.includes(a.name));
                  if (matchedAcc) sourceAccName = matchedAcc.name;
                }
              }
            } else if (type === 'income') {
              destAccName = incAcc || currentAccName;
              sourceAccName = '';
            } else {
              sourceAccName = expAcc || currentAccName;
              destAccName = '';
            }

            const sourceAcc = findAccByName(sourceAccName);
            const destAcc = findAccByName(destAccName);
            const mainAcc = findAccByName(currentAccName);
            
            let finalAccountId = '';
            let finalToAccountId = '';
            let amountVal = rawAmount;

            if (type === 'income') {
              finalAccountId = destAcc?.id || mainAcc?.id || sourceAcc?.id || '';
              finalToAccountId = '';
              amountVal = Math.abs(rawAmount || incomeColAmt || 0);
            } else if (type === 'expense') {
              finalAccountId = sourceAcc?.id || mainAcc?.id || '';
              finalToAccountId = '';
              amountVal = -Math.abs(rawAmount || expenseColAmt || 0);
            } else if (type === 'transfer') {
              finalAccountId = sourceAcc?.id || '';
              finalToAccountId = destAcc?.id || '';
              amountVal = -Math.abs(rawAmount || expenseColAmt || incomeColAmt || 0);
            }

            // 3. Resolve Project
            const projectName = String(getVal(row, ['專案', 'Project']) || '').trim();
            let projectId = undefined;
            if (projectName) {
               const nameToFind = projectName.includes(' > ') 
                                  ? projectName.split(' > ').map(s => s.trim()).pop() || ''
                                  : projectName;
               
               const foundProject = (Array.isArray(projects) ? projects : []).find(p => 
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

            const isTransferredText = String(getVal(row, ['是否已轉帳', '已轉帳']) || '').trim();
            const rawTransferredDate = getVal(row, ['轉帳日期', 'transferredDate']);
            let resolvedTransferredDate = parseDate(rawTransferredDate);
            if (isTransferredText === '否') {
              resolvedTransferredDate = undefined;
            }

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
              _importMainAccountName: currentAccName,
              _importSourceAccountName: sourceAccName,
              _importDestAccountName: destAccName,
              _importProjectName: projectName ? String(projectName) : undefined,
              toAmount: type === 'transfer' ? importedToAmount : undefined,
              exchangeRate: type === 'transfer' ? importedExchangeRate : undefined,
              transferredDate: resolvedTransferredDate,
              time: time
            };
          }).filter(r => r.amount !== 0 || r.category === '初始資金');

          if (importedTransactions.length === 0) throw new Error('檔案中沒有可匯入的有效金額資料');
          
          // Identify latest balance per account from the imported data
          const accountLatestBalances: Record<string, number> = {};
          
          // Group transactions that have an import balance by their normalized explicit main account name (or fallback if empty)
          const txsByAccountName: Record<string, { rawName: string, transactions: Transaction[] }> = {};
          importedTransactions.forEach(t => {
            if (t._importBalance !== undefined) {
              const rawName = (t as any)._importMainAccountName || (t.amount > 0 ? t._importDestAccountName : t._importSourceAccountName) || '';
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
            const { transactions: list } = txsByAccountName[cleanedNameKey];
            
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

    const targetAccount = (Array.isArray(accounts) ? accounts : []).find(a => a.id === selectedDeleteAccountId);
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
      {/* 個人資訊區塊 (Profile Info Section) */}
      <div className="bg-white rounded-[30px] p-5 shadow-sm border-2 border-white flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 bg-[#FFF9E3] rounded-2xl flex items-center justify-center text-2xl overflow-hidden border border-[#FFD54F]/40 shadow-xs">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
            ) : '🦊'}
          </div>
          <div className="flex flex-col">
            <span className="text-base font-black text-[#5D4037]">{user ? user.displayName : '訪客模式'}</span>
            <div 
              onClick={() => alert('✨ 累計透過 AI 智慧拆分與發票辨識處理的記帳次數')}
              className="mt-1 flex items-center gap-1.5 px-2.5 py-0.5 bg-[#E0F2FE] hover:bg-[#BAE6FD] text-[#0369A1] rounded-full border border-[#0284C7]/30 text-[12px] font-black cursor-pointer shadow-xs active:scale-95 transition-all w-fit"
              title="點擊查看說明"
            >
              <Sparkles size={12} className="text-[#0284C7] shrink-0" />
              <span>AI 解析使用：{aiParseCount} 次</span>
            </div>
          </div>
        </div>
        {user ? (
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/60">
            雲端同步中
          </span>
        ) : (
          <span className="text-xs font-bold text-stone-400 bg-stone-100 px-3 py-1 rounded-full">
            未登入
          </span>
        )}
      </div>

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
          onClick={onOpenRecycleBin}
          className="flex items-center justify-between py-3 border-b border-stone-50 text-left w-full active:opacity-60"
        >
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#5D4037]">🗑️ 垃圾桶 (回收筒)</span>
            {deletedCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 bg-rose-500 text-white rounded-full font-black shadow-xs">
                {deletedCount}
              </span>
            )}
          </div>
          <ChevronRight size={20} className="text-stone-300" />
        </button>
        <button 
          onClick={onOpenAiSplit}
          className="flex items-center justify-between py-3 border-b border-stone-50 text-left w-full active:opacity-60"
        >
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#5D4037]">AI 智慧明細拆分工具</span>
            <span className="text-[9px] px-2 py-0.5 bg-sky-100 text-sky-600 rounded-full font-black">AI</span>
          </div>
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

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#5D4037]/40 uppercase tracking-widest px-1">選擇匯出帳戶</label>
                  <div className="relative">
                    <select
                      value={exportAccountId}
                      onChange={e => setExportAccountId(e.target.value)}
                      className="w-full p-4 bg-white border-2 border-stone-100 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all appearance-none cursor-pointer"
                    >
                      <option value="all">📁 全部帳戶</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.type === 'credit' ? '💳' : '🏦'} {acc.name}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[#5D4037]/50">
                      ▼
                    </div>
                  </div>
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

            {/* Pending New Accounts Banner */}
            {pendingNewAccountNames.length > 0 && (
              <div className="mx-6 mt-2 mb-2 bg-amber-50/90 border border-amber-200/80 rounded-2xl p-3.5 flex items-start gap-3 shadow-sm">
                <div className="w-7 h-7 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5 text-amber-700 text-sm font-black">
                  ✨
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-amber-900">
                      偵測到未建立之帳戶 ({pendingNewAccountNames.length})
                    </span>
                    <span className="text-[10px] font-bold text-amber-700/80 bg-amber-100/60 px-2 py-0.5 rounded-full">
                      確認匯入時將自動建立
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {pendingNewAccountNames.map((name, i) => (
                      <span key={i} className="inline-flex items-center gap-1 bg-white border border-amber-200/80 px-2.5 py-0.5 rounded-lg font-black text-amber-900 text-xs shadow-xs">
                        {name}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] font-bold text-amber-800/60 mt-1.5 leading-normal">
                    系統已自動對應轉帳或收支對象，確認匯入後將自動為您新增上述帳戶，確保資產流水完整不遺漏。
                  </p>
                </div>
              </div>
            )}

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
                            const sName = r._importSourceAccountName || (Array.isArray(accounts) ? accounts : []).find(a => a.id === r.accountId)?.name;
                            const dName = r._importDestAccountName || (Array.isArray(accounts) ? accounts : []).find(a => a.id === r.toAccountId)?.name;
                            const isNewSource = Boolean(sName && pendingNewAccountNames.includes(sName));
                            const isNewDest = Boolean(dName && pendingNewAccountNames.includes(dName));
                            return (sName && dName && dName !== '-') ? (
                              <div className="flex items-center gap-1" style={getFontFamily()}>
                                <span className={isNewSource ? "text-amber-700 font-black" : ""} style={getFontFamily()}>
                                  {sName}
                                  {isNewSource && <span className="text-[10px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded-md ml-0.5 font-bold">新</span>}
                                </span>
                                <span className="text-stone-300" style={getFontFamily()}>→</span>
                                <span className={isNewDest ? "text-amber-700 font-black" : ""} style={getFontFamily()}>
                                  {dName}
                                  {isNewDest && <span className="text-[10px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded-md ml-0.5 font-bold">新</span>}
                                </span>
                              </div>
                            ) : (
                              <span>
                                {sName || dName || '未知帳戶'}
                                {((sName && isNewSource) || (dName && isNewDest)) && (
                                  <span className="text-[10px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded-md ml-0.5 font-bold">新</span>
                                )}
                              </span>
                            );
                          })()
                        ) : (
                          (() => {
                            const accName = r.type === 'income' 
                              ? (r._importDestAccountName || r._importSourceAccountName || (Array.isArray(accounts) ? accounts : []).find(a => a.id === r.accountId)?.name)
                              : (r._importSourceAccountName || (Array.isArray(accounts) ? accounts : []).find(a => a.id === r.accountId)?.name);
                            const isNew = Boolean(accName && pendingNewAccountNames.includes(accName));
                            return (
                              <span className={isNew ? "text-amber-700 font-black" : ""}>
                                {accName}
                                {isNew && <span className="text-[10px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded-md ml-0.5 font-bold">新</span>}
                              </span>
                            );
                          })()
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

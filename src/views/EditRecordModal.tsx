import { CustomInstallmentItem, generateDefaultCustomSchedule, getCategoryIcon, getCorrectInstallmentDate, getFontFamily } from '../lib/financeUtils';
import { useMemo, useRef, useState } from 'react';
import { NumberInput } from '../components/NumberInput';
import {
  Banknote,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Copy,
  Layers,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Account, Category, Project, SubItem, Transaction } from '../types';
import { INITIAL_CATEGORIES, ensureTransferCategories, findMatchingProjectId } from '../lib/defaults';
import { formatLocalDate, formatTime24, formatTimeDisplay } from '../lib/dateUtils';
import { AccountIcon } from '../components/AccountWidgets';

export function EditRecordModal({ record, records = [], accounts, projects, categories = [], onClose, onSave, onDelete, onDuplicate }: {
  record: Transaction,
  records?: Transaction[],
  accounts: Account[],
  projects: Project[],
  categories?: Category[],
  onClose: () => void,
  onSave: (updated: Transaction, mergedIdsToDelete?: any, restoredIds?: any) => void,
  onDelete: () => void,
  onDuplicate?: (record: Transaction) => void
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
      const otherAcc = (Array.isArray(accounts) ? accounts : []).find(a => a.id !== initial.accountId);
      initial.toAccountId = otherAcc?.id || '';
    }
    if (initial.time) {
      initial.time = formatTime24(initial.time);
    }
    return initial;
  });
  const editTimeInputRef = useRef<HTMLInputElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isProjectPickerOpen, setIsProjectPickerOpen] = useState(false);
  const [subItemProjectPickerIdx, setSubItemProjectPickerIdx] = useState<number | null>(null);
  const [subItemProjectSearch, setSubItemProjectSearch] = useState('');
  const [subItemExpandedParents, setSubItemExpandedParents] = useState<Record<string, boolean>>({});
  const [projectSearch, setProjectSearch] = useState('');
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const [selectedMainCat, setSelectedMainCat] = useState<string | null>(null);

  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [selectedMergeIds, setSelectedMergeIds] = useState<string[]>([]);
  const [mergeSearch, setMergeSearch] = useState('');
  const [childUpdatesMap, setChildUpdatesMap] = useState<Record<string, Transaction>>({});

  const baseOriginalAmount = useMemo<number>(() => {
    if (record.baseAmount !== undefined) return Math.abs(record.baseAmount);
    if (record.subItems && record.subItems.length > 0) {
      const nonMergedSubs = record.subItems.filter(s => !s.originalRecordId);
      if (nonMergedSubs.length > 0) {
        return nonMergedSubs.reduce((sum, s) => sum + (s.amount || 0), 0);
      }
    }
    return Math.abs(record.amount);
  }, [record]);

  const handleRemoveSubItem = (idx: number) => {
    if (!edited.subItems) return;
    const itemToRemove = edited.subItems[idx];
    const updatedSubs = edited.subItems.filter((_, i) => i !== idx);

    if (itemToRemove && itemToRemove.originalRecordId) {
      const origId = itemToRemove.originalRecordId;
      const targetRecord = (Array.isArray(records) ? records : []).find(r => r.id === origId) || childUpdatesMap[origId];
      if (targetRecord) {
        setChildUpdatesMap(prev => ({
          ...prev,
          [origId]: {
            ...targetRecord,
            isMergedChild: false,
            parentId: null,
            parentTransactionId: undefined,
            isChildTransaction: false
          }
        }));
      }
    }

    const isTransfer = edited.type === 'transfer';
    const defaultTitle = isTransfer ? '信用卡扣款' : '主消費項目';
    const baseTitle = (edited.note || edited.merchant || defaultTitle).replace(/ 等 \d+ (類明細|筆)$/, '');

    if (updatedSubs.length === 0) {
      setEdited(prev => ({
        ...prev,
        isParent: false,
        note: baseTitle,
        subItems: undefined,
        subTransactions: undefined,
        subItemIds: [],
        baseAmount: baseOriginalAmount,
        amount: prev.type === 'expense' || prev.type === 'transfer' ? -baseOriginalAmount : baseOriginalAmount
      }));
      setAmountStr(baseOriginalAmount.toString());
    } else {
      const subTotal = updatedSubs.reduce((sum, item) => sum + (item.amount || 0), 0);
      const unit = isTransfer ? '筆' : '類明細';
      const updatedNote = updatedSubs.length > 1 ? `${baseTitle} 等 ${updatedSubs.length} ${unit}` : baseTitle;
      
      setEdited(prev => ({
        ...prev,
        isParent: updatedSubs.length > 1,
        note: updatedNote,
        subItems: updatedSubs,
        subTransactions: prev.subTransactions?.filter(st => st.id !== itemToRemove?.originalRecordId),
        subItemIds: updatedSubs.map(s => s.originalRecordId).filter(Boolean) as string[],
        baseAmount: baseOriginalAmount,
        amount: prev.type === 'expense' || prev.type === 'transfer' ? -subTotal : subTotal
      }));
      setAmountStr(subTotal.toString());
    }
  };

  const handleClearSubItems = () => {
    if (edited.subItems) {
      edited.subItems.forEach(item => {
        if (item.originalRecordId) {
          const origId = item.originalRecordId;
          const targetRecord = (Array.isArray(records) ? records : []).find(r => r.id === origId) || childUpdatesMap[origId];
          if (targetRecord) {
            setChildUpdatesMap(prev => ({
              ...prev,
              [origId]: {
                ...targetRecord,
                isMergedChild: false,
                parentId: null,
                parentTransactionId: undefined,
                isChildTransaction: false
              }
            }));
          }
        }
      });
    }

    if (edited.subTransactions) {
      edited.subTransactions.forEach(st => {
        const origId = st.id;
        const targetRecord = (Array.isArray(records) ? records : []).find(r => r.id === origId) || childUpdatesMap[origId] || st;
        if (targetRecord) {
          setChildUpdatesMap(prev => ({
            ...prev,
            [origId]: {
              ...targetRecord,
              isMergedChild: false,
              parentId: null,
              parentTransactionId: undefined,
              isChildTransaction: false
            }
          }));
        }
      });
    }

    const isTransfer = edited.type === 'transfer';
    const defaultTitle = isTransfer ? '信用卡扣款' : '主消費項目';
    const baseTitle = (edited.note || edited.merchant || defaultTitle).replace(/ 等 \d+ (類明細|筆)$/, '');

    setEdited(prev => ({
      ...prev,
      isParent: false,
      note: baseTitle,
      subItems: undefined,
      subTransactions: undefined,
      subItemIds: [],
      baseAmount: baseOriginalAmount,
      amount: prev.type === 'expense' || prev.type === 'transfer' ? -baseOriginalAmount : baseOriginalAmount
    }));
    setAmountStr(baseOriginalAmount.toString());
  };

  const handleUpdateSubItemAmount = (idx: number, amtVal: number) => {
    if (!edited.subItems) return;
    const updatedSubs = edited.subItems.map((s, i) => i === idx ? { ...s, amount: amtVal } : s);
    const newSum = updatedSubs.reduce((sum, item) => sum + (item.amount || 0), 0);
    setEdited(prev => ({
      ...prev,
      subItems: updatedSubs,
      amount: prev.type === 'expense' || prev.type === 'transfer' ? -newSum : newSum
    }));
    setAmountStr(newSum.toString());
  };

  const mergeCandidates = useMemo(() => {
    if (!records || records.length === 0) return [];
    const currentDateMs = new Date(edited.date).getTime();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    const targetType = edited.type || 'expense';

    return records.filter(r => {
      if (r.id === edited.id) return false;
      if (r.isMergedChild || r.parentId || r.parentTransactionId || r.isChildTransaction) return false;
      if (r.type !== targetType) return false;
      if (r.accountId !== edited.accountId) return false;
      const rDateMs = new Date(r.date).getTime();
      const hasSearch = mergeSearch.trim().length > 0;
      const maxDiffMs = hasSearch ? 30 * 24 * 60 * 60 * 1000 : threeDaysMs;
      if (isNaN(rDateMs) || Math.abs(rDateMs - currentDateMs) > maxDiffMs) return false;
      if (hasSearch) {
        const query = mergeSearch.trim().toLowerCase();
        const noteMatch = (r.note || '').toLowerCase().includes(query);
        const merchantMatch = (r.merchant || '').toLowerCase().includes(query);
        const catMatch = (r.category || '').toLowerCase().includes(query);
        const toAccName = (Array.isArray(accounts) ? accounts : []).find(a => a.id === r.toAccountId)?.name || '';
        const toMatch = toAccName.toLowerCase().includes(query);
        const amtMatch = Math.abs(r.amount).toString().includes(query);
        if (!noteMatch && !merchantMatch && !catMatch && !toMatch && !amtMatch) return false;
      }
      return true;
    });
  }, [records, accounts, edited.id, edited.accountId, edited.date, edited.type, mergeSearch]);

  const selectedMergeTotal = useMemo(() => {
    if (!records || records.length === 0 || selectedMergeIds.length === 0) return 0;
    return records
      .filter(r => selectedMergeIds.includes(r.id))
      .reduce((sum, r) => sum + Math.abs(r.amount), 0);
  }, [records, selectedMergeIds]);

  const handleMergeTransactions = () => {
    const selectedRecords = records.filter(r => selectedMergeIds.includes(r.id));
    if (selectedRecords.length === 0) {
      setIsMergeModalOpen(false);
      return;
    }

    const newChildUpdates: Record<string, Transaction> = { ...childUpdatesMap };
    selectedRecords.forEach(r => {
      newChildUpdates[r.id] = {
        ...r,
        isMergedChild: true,
        parentId: edited.id,
        parentTransactionId: edited.id,
        isChildTransaction: true
      };
    });
    setChildUpdatesMap(newChildUpdates);

    const existingSubTxs: Transaction[] = edited.subTransactions || [];
    const combinedSubTxs = [
      ...existingSubTxs, 
      ...selectedRecords.map(r => ({ 
        ...r, 
        isMergedChild: true, 
        parentId: edited.id,
        parentTransactionId: edited.id,
        isChildTransaction: true
      }))
    ];

    const isTransfer = edited.type === 'transfer';
    const mainToAccName = (Array.isArray(accounts) ? accounts : []).find(a => a.id === edited.toAccountId)?.name || '信用卡';

    const existingSubs: SubItem[] = (edited.subItems && edited.subItems.length > 0)
      ? [...edited.subItems]
      : [
          {
            id: `sub_${Date.now()}_main`,
            originalRecordId: edited.id,
            name: isTransfer
              ? `繳 ${mainToAccName}${edited.note ? ` - ${edited.note}` : ''}`
              : (edited.note || edited.merchant || '主消費項目').replace(/ 等 \d+ (類明細|筆)$/, ''),
            amount: baseOriginalAmount,
            category: edited.category,
            isPrepay: !!edited.isPrepay,
            toAccountId: edited.toAccountId
          }
        ];

    const newSubs: SubItem[] = selectedRecords.map((r, idx) => {
      const cardName = (Array.isArray(accounts) ? accounts : []).find(a => a.id === r.toAccountId)?.name || '信用卡';
      return {
        id: `sub_${Date.now()}_merge_${idx}`,
        originalRecordId: r.id,
        name: isTransfer
          ? `繳 ${cardName}${r.note ? ` - ${r.note}` : ''}`
          : (r.note || r.merchant || `合併明細 ${idx + 1}`),
        amount: Math.abs(r.amount),
        category: r.category || edited.category,
        isPrepay: !!r.isPrepay,
        toAccountId: r.toAccountId
      };
    });

    const combinedSubs = [...existingSubs, ...newSubs];
    const totalSum = combinedSubs.reduce((sum, item) => sum + (item.amount || 0), 0);

    const defaultTitle = isTransfer ? '信用卡扣款' : '主消費項目';
    const baseTitle = (edited.note || edited.merchant || defaultTitle).replace(/ 等 \d+ (類明細|筆)$/, '');
    const unit = isTransfer ? '筆' : '類明細';
    const updatedNote = `${baseTitle} 等 ${combinedSubs.length} ${unit}`;

    const subItemIds = combinedSubs.map(s => s.originalRecordId).filter(Boolean) as string[];

    setEdited(prev => ({
      ...prev,
      isParent: true,
      note: updatedNote,
      subItems: combinedSubs,
      subTransactions: combinedSubTxs,
      subItemIds: subItemIds,
      baseAmount: baseOriginalAmount,
      amount: prev.type === 'expense' || prev.type === 'transfer' ? -totalSum : totalSum
    }));
    setAmountStr(totalSum.toString());
    setIsMergeModalOpen(false);
  };

  const availableCategories = useMemo(() => {
    const rawCats = categories && categories.length > 0 ? categories : INITIAL_CATEGORIES;
    const cats = ensureTransferCategories(rawCats);
    const targetType = edited.type || 'expense';
    return cats.filter(c => c.type === targetType);
  }, [categories, edited.type]);
  const groupRecords = useMemo(() => {
    if (!record.installmentGroupId) return [];
    return (Array.isArray(records) ? records : [])
      .filter(r => r.installmentGroupId === record.installmentGroupId)
      .sort((a, b) => (a.currentInstallment || 0) - (b.currentInstallment || 0));
  }, [records, record.installmentGroupId]);

  const [isInstallment, setIsInstallment] = useState(() => !!record.isInstallment || !!record.installmentGroupId || !!record.installmentId);
  const [totalInstallments, setTotalInstallments] = useState(() => record.totalInstallments || groupRecords.length || 12);
  const [isCustomInstallment, setIsCustomInstallment] = useState(() => {
    if (record.isCustomSchedule !== undefined) return record.isCustomSchedule;
    if (record.isCustomInstallment !== undefined) return record.isCustomInstallment;
    if (record.customSchedule && record.customSchedule.length > 0) return true;
    if (record.installmentList && record.installmentList.length > 0) return true;
    if (groupRecords.some(r => r.isCustomSchedule || r.isCustomInstallment || (r.customSchedule && r.customSchedule.length > 0) || (r.installmentList && r.installmentList.length > 0))) return true;
    return false;
  });
  const [customSchedules, setCustomSchedules] = useState<CustomInstallmentItem[]>(() => {
    if (record.customSchedule && record.customSchedule.length > 0) {
      return record.customSchedule;
    }
    if (record.installmentList && record.installmentList.length > 0) {
      return record.installmentList;
    }
    const siblingWithSchedule = groupRecords.find(r => (r.customSchedule && r.customSchedule.length > 0) || (r.installmentList && r.installmentList.length > 0));
    if (siblingWithSchedule?.customSchedule && siblingWithSchedule.customSchedule.length > 0) {
      return siblingWithSchedule.customSchedule;
    }
    if (siblingWithSchedule?.installmentList && siblingWithSchedule.installmentList.length > 0) {
      return siblingWithSchedule.installmentList;
    }
    if (groupRecords.length > 0) {
      return groupRecords.map((r, idx) => ({
        installment: r.currentInstallment || (idx + 1),
        date: r.postingDate || r.date,
        amount: Math.abs(r.amount)
      }));
    }
    const totalAmt = record.totalAmount && record.totalAmount > 0 
      ? record.totalAmount 
      : Math.abs(record.amount || 0) * (record.totalInstallments || 12);
    return generateDefaultCustomSchedule(
      totalAmt,
      record.totalInstallments || 12,
      record.date || formatLocalDate(new Date())
    );
  });
  const [amountStr, setAmountStr] = useState<string>(() => {
    const numPeriods = record.totalInstallments || 12;
    if ((record.isInstallment || record.installmentGroupId || record.installmentId) && numPeriods > 1) {
      const total = record.totalAmount && record.totalAmount > 0 ? record.totalAmount : Math.abs(record.amount) * numPeriods;
      return total.toString();
    }
    const amt = Math.abs(record.amount);
    return amt === 0 ? '' : amt.toString();
  });

  const handleToggleInstallment = (nextVal: boolean) => {
    setIsInstallment(nextVal);
    if (!nextVal) {
      // Revert to total original amount when toggling OFF installment
      let revertedTotal = Math.abs(edited.amount);
      const numPeriods = record.totalInstallments || totalInstallments || 1;

      if (record.totalAmount && record.totalAmount > 0) {
        revertedTotal = record.totalAmount;
      } else if ((record.isInstallment || record.installmentGroupId || record.installmentId) && numPeriods > 1) {
        revertedTotal = Math.abs(record.amount) * numPeriods;
      } else if (amountStr && !isNaN(parseFloat(amountStr)) && parseFloat(amountStr) > 0) {
        revertedTotal = parseFloat(amountStr);
      }

      setAmountStr(revertedTotal.toString());
      const finalAmt = (edited.type === 'expense' || edited.type === 'transfer') ? -revertedTotal : revertedTotal;

      setEdited(prev => ({
        ...prev,
        amount: finalAmt,
        isInstallment: false,
        installmentGroupId: undefined,
        installmentId: undefined,
        installmentPeriod: undefined,
        totalInstallments: undefined
      }));
    } else {
      setEdited(prev => ({
        ...prev,
        isInstallment: true,
        totalInstallments: totalInstallments
      }));
    }
  };

  const fromAcc = (Array.isArray(accounts) ? accounts : []).find(a => a.id === edited.accountId);
  const toAcc = (Array.isArray(accounts) ? accounts : []).find(a => a.id === edited.toAccountId);

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
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[300] flex items-center justify-center p-6"
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
            <div className="fixed inset-0 z-[350] flex items-center justify-center p-6" onClick={(e) => e.stopPropagation()}>
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-[#5D4037]/40 backdrop-blur-md"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsProjectPickerOpen(false);
                }}
              />
              <motion.div 
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                className="relative bg-[#FFFDF5] w-full max-w-sm rounded-[40px] shadow-2xl border-2 border-white overflow-hidden flex flex-col max-h-[80vh] z-10"
                style={getFontFamily()}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 pb-2 border-b border-stone-50 flex items-center justify-between">
                  <h3 className="text-xl font-black text-[#5D4037]">選取專案</h3>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsProjectPickerOpen(false);
                    }} 
                    className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                  >
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
                  {projects.filter(p => !(p.parentProjectId || p.parentId) && (p.name.includes(projectSearch) || projects.some(c => (c.parentProjectId || c.parentId) === p.id && c.name.includes(projectSearch)))).map(p => {
                    const children = projects.filter(c => (c.parentProjectId || c.parentId) === p.id && (c.name.includes(projectSearch) || p.name.includes(projectSearch)));
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

          {isCategoryPickerOpen && (
            <div className="fixed inset-0 z-[350] flex items-center justify-center p-6" onClick={e => e.stopPropagation()}>
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-[#5D4037]/40 backdrop-blur-md"
                onClick={() => setIsCategoryPickerOpen(false)}
              />
              <motion.div 
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                className="relative bg-[#FFFDF5] w-full max-w-sm rounded-[40px] shadow-2xl border-2 border-white overflow-hidden flex flex-col max-h-[80vh] z-10"
                style={getFontFamily()}
                onClick={e => e.stopPropagation()}
              >
                <div className="p-6 pb-4 border-b border-stone-50 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    {selectedMainCat && (
                      <button 
                        onClick={() => setSelectedMainCat(null)} 
                        className="p-1 hover:bg-stone-100 rounded-full transition-colors text-[#5D4037]"
                      >
                        <ChevronLeft size={20} />
                      </button>
                    )}
                    <h3 className="text-xl font-black text-[#5D4037]">
                      {selectedMainCat ? `${selectedMainCat} ＞ 子分類` : '選取分類'}
                    </h3>
                  </div>
                  <button 
                    onClick={() => setIsCategoryPickerOpen(false)} 
                    className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                  >
                    <X size={20} className="text-stone-400" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-3">
                  {!selectedMainCat ? (
                    <div className="grid grid-cols-2 gap-3">
                      {availableCategories.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => {
                            if (cat.sub && cat.sub.length > 0) {
                              setSelectedMainCat(cat.name);
                            } else {
                              const matchPid = findMatchingProjectId(cat.name, projects);
                              setEdited(prev => ({
                                ...prev,
                                category: cat.name,
                                ...(matchPid ? { projectId: matchPid } : {})
                              }));
                              setIsCategoryPickerOpen(false);
                            }
                          }}
                          className={`p-3.5 rounded-3xl flex items-center gap-3 transition-all text-left ${
                            edited.category === cat.name || edited.category.startsWith(`${cat.name} ＞`) || edited.category.startsWith(`${cat.name} >`)
                              ? 'bg-[#FFD54F] shadow-md scale-[1.02]' 
                              : 'bg-white hover:bg-[#FFFDF5] shadow-sm border border-stone-100'
                          }`}
                        >
                          <div className="w-10 h-10 rounded-2xl bg-white/60 flex items-center justify-center text-xl shrink-0 shadow-sm">
                            <AccountIcon icon={cat.icon} sizeClassName="w-5 h-5" className="text-xl" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-black text-[#5D4037] text-sm truncate">{cat.name}</div>
                            {cat.sub && cat.sub.length > 0 && (
                              <div className="text-[11px] font-bold text-stone-400 truncate">
                                {cat.sub.length} 個子分類
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          const matchPid = findMatchingProjectId(selectedMainCat, projects);
                          setEdited(prev => ({
                            ...prev,
                            category: selectedMainCat,
                            ...(matchPid ? { projectId: matchPid } : {})
                          }));
                          setIsCategoryPickerOpen(false);
                        }}
                        className={`w-full p-4 rounded-3xl flex items-center justify-between transition-all ${
                          edited.category === selectedMainCat
                            ? 'bg-[#FFD54F] shadow-md scale-[1.01]'
                            : 'bg-white hover:bg-stone-50 shadow-sm border border-stone-100'
                        }`}
                      >
                        <span className="font-black text-[#5D4037]">（僅使用主分類：{selectedMainCat}）</span>
                        {edited.category === selectedMainCat && <Check size={18} className="text-[#5D4037]" />}
                      </button>

                      {availableCategories
                        .find(c => c.name === selectedMainCat)
                        ?.sub?.map((sub, idx) => {
                          const fullCatName = `${selectedMainCat} ＞ ${sub}`;
                          const isSelected = edited.category === fullCatName || edited.category === `${selectedMainCat} > ${sub}`;
                          return (
                            <button
                              key={`${selectedMainCat}-sub-${idx}`}
                              onClick={() => {
                                const matchPid = findMatchingProjectId(fullCatName, projects);
                                setEdited(prev => ({
                                  ...prev,
                                  category: fullCatName,
                                  ...(matchPid ? { projectId: matchPid } : {})
                                }));
                                setIsCategoryPickerOpen(false);
                              }}
                              className={`w-full p-4 rounded-3xl flex items-center justify-between transition-all ${
                                isSelected
                                  ? 'bg-[#FFD54F] shadow-md scale-[1.01]'
                                  : 'bg-white hover:bg-stone-50 shadow-sm border border-stone-100'
                              }`}
                            >
                              <span className="font-bold text-[#5D4037] text-sm">{sub}</span>
                              {isSelected && <Check size={18} className="text-[#5D4037]" />}
                            </button>
                          );
                        })}
                    </div>
                  )}
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
              className="absolute inset-0 bg-rose-500 z-[320] flex flex-col items-center justify-center p-8 text-white text-center gap-6"
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
          <div className="flex items-center gap-2">
            {typeof onDuplicate === 'function' && (
              <button 
                type="button"
                onClick={() => {
                  onClose();
                  if (typeof onDuplicate === 'function') {
                    onDuplicate(record);
                  }
                }}
                className="px-3.5 py-1.5 bg-[#FFD54F] hover:bg-[#ffe082] text-[#5D4037] rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm active:scale-95 border border-[#FFD54F]"
                title="以此紀錄再記一筆"
              >
                <Copy size={15} className="text-[#5D4037]" />
                <span>再記一筆</span>
              </button>
            )}
            <button 
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 text-rose-400 hover:bg-rose-50 rounded-2xl transition-colors active:scale-90"
              title="刪除此紀錄"
            >
              <Trash2 size={22} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-stone-500 uppercase tracking-widest px-1">金額</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-stone-300 text-lg">$</span>
                <input 
                  type="number"
                  placeholder="0"
                  value={amountStr}
                  disabled={isInstallment}
                  onChange={e => {
                    const val = e.target.value;
                    setAmountStr(val);
                    const rawAmt = val === '' ? 0 : parseFloat(val) || 0;
                    setEdited({ 
                      ...edited, 
                      amount: edited.type === 'expense' || edited.type === 'transfer' ? -rawAmt : rawAmt 
                    });
                  }}
                  className={`w-full p-4 pl-10 bg-white border-2 border-stone-50 rounded-2xl font-black text-2xl text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all ${isInstallment ? 'opacity-60 cursor-not-allowed bg-stone-50' : ''}`}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-stone-500 uppercase tracking-widest px-1">分類</label>
              <button
                type="button"
                onClick={() => {
                  setSelectedMainCat(null);
                  setIsCategoryPickerOpen(true);
                }}
                className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm hover:border-[#FFD54F] transition-all flex items-center justify-between group text-left"
                style={getFontFamily()}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-8 h-8 rounded-full bg-[#FFFDF5] border border-stone-100 flex items-center justify-center text-lg shrink-0">
                    {getCategoryIcon(edited.category, edited.type, availableCategories)}
                  </div>
                  <span className="truncate text-base font-black text-[#5D4037]">
                    {edited.category || '選擇分類'}
                  </span>
                </div>
                <ChevronDown size={20} className="text-stone-400 group-hover:text-[#5D4037] transition-colors shrink-0" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-stone-500 uppercase tracking-widest px-1">備註 (買了什麼？)</label>
              <textarea 
                rows={2}
                value={edited.note || ''}
                disabled={isInstallment}
                onChange={e => {
                  const val = e.target.value;
                  setEdited({ ...edited, note: val, remark: val });
                }}
                className={`w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#000000] text-[18px] outline-none shadow-sm focus:border-[#FFD54F] transition-all min-h-[80px] resize-none whitespace-pre-wrap break-all ${isInstallment ? 'opacity-60 cursor-not-allowed bg-stone-50' : ''}`}
                placeholder="買了什麼？"
                style={getFontFamily()}
              />
            </div>

            {/* Project Picker */}
            <div className="space-y-2">
              <label className="text-xs font-black text-stone-500 uppercase tracking-widest px-1">所屬專案</label>
              <div 
                onClick={() => setIsProjectPickerOpen(true)}
                className="w-full p-4 bg-white border-2 border-[#FFD54F]/30 rounded-2xl flex items-center gap-3 cursor-pointer hover:bg-stone-50 transition-all shadow-sm"
              >
                <div className="w-8 h-8 bg-[#FFFDF5] rounded-lg flex items-center justify-center shadow-inner border border-[#FFD54F]/20">
                  <Layers size={14} className="text-[#FFD54F]" />
                </div>
                <div className="flex-1">
                  <span className="text-[15px] font-black text-[#5D4037] flex items-center gap-1.5">
                    <AccountIcon icon={(Array.isArray(projects) ? projects : []).find(p => p.id === (edited.projectId || 'p1'))?.icon || ''} sizeClassName="w-5 h-5" />
                    <span>{(Array.isArray(projects) ? projects : []).find(p => p.id === (edited.projectId || 'p1'))?.name || '無特別專案'}</span>
                  </span>
                </div>
                <ChevronRight size={18} className="text-stone-300" />
              </div>
            </div>

            {/* Sub-items Ownership & Split (拆分子項目與歸屬) Section */}
            {(edited.type === 'expense' || edited.type === 'transfer') && (
              <div className="space-y-3 bg-amber-50/40 p-4 rounded-2xl border border-amber-200/60 shadow-sm" style={getFontFamily()}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-start gap-1.5">
                    <span className="mt-0.5">{edited.type === 'transfer' ? '💸' : '🛍️'}</span>
                    <div className="flex flex-col">
                      <span className="text-[15px] font-black text-[#5D4037] leading-snug">
                        {edited.type === 'transfer' ? '合併多卡繳款 / 轉帳明細' : '拆分子項目與歸屬'}
                      </span>
                      {edited.type !== 'transfer' && (
                        <span className="text-xs font-bold text-stone-500/90 leading-tight whitespace-nowrap">
                          (個人 vs 家裡代墊)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMergeIds([]);
                        setMergeSearch('');
                        setIsMergeModalOpen(true);
                      }}
                      className="px-3 py-1 bg-[#5D4037] hover:bg-[#4A332C] text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all flex items-center gap-1"
                      style={getFontFamily()}
                    >
                      <span>＋</span> {edited.type === 'transfer' ? '合併其他繳款 / 轉帳' : '合併其他消費'}
                    </button>
                    {!edited.subItems || edited.subItems.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          const isTransfer = edited.type === 'transfer';
                          const mainCardName = (Array.isArray(accounts) ? accounts : []).find(a => a.id === edited.toAccountId)?.name || '信用卡';
                          const initSub: SubItem[] = [
                            { 
                              id: `sub_${Date.now()}_1`, 
                              originalRecordId: edited.id,
                              name: isTransfer ? `繳 ${mainCardName}` : (edited.note || '項目 1'), 
                              amount: Math.abs(edited.amount) || 0, 
                              category: edited.category, 
                              isPrepay: false,
                              toAccountId: edited.toAccountId
                            }
                          ];
                          setEdited({ ...edited, subItems: initSub });
                        }}
                        className="px-3 py-1 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-[#5D4037] shadow-xs active:scale-95 transition-all"
                        style={getFontFamily()}
                      >
                        ＋ {edited.type === 'transfer' ? '開始拆分繳款' : '開始拆分'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleClearSubItems}
                        className="text-xs font-bold text-rose-500 hover:underline"
                        style={getFontFamily()}
                      >
                        {edited.subTransactions && edited.subTransactions.length > 0 ? '解除合併還原' : '清除拆分'}
                      </button>
                    )}
                  </div>
                </div>

                {edited.subItems && edited.subItems.length > 0 && (
                  <div className="space-y-3 pt-1">
                    <div className="space-y-2">
                      {edited.subItems.map((subItem, idx) => (
                        <div key={subItem.id || idx} className="bg-white p-3 rounded-xl border border-stone-200/80 space-y-2 relative shadow-xs">
                          <button
                            type="button"
                            onClick={() => handleRemoveSubItem(idx)}
                            className="absolute top-2 right-2 p-1 text-stone-300 hover:text-rose-500 transition-colors"
                            title={subItem.originalRecordId ? "解除合併此筆紀錄 (還原為獨立交易)" : "刪除子項目"}
                          >
                            <X size={14} />
                          </button>

                          {edited.type === 'transfer' ? (
                            <div className="space-y-2 pr-5">
                              <div className="grid grid-cols-5 gap-2">
                                <div className="col-span-3 flex flex-col gap-1">
                                  <label className="text-[11px] font-bold text-stone-500">轉入卡別 / 帳戶</label>
                                  <select
                                    value={subItem.toAccountId || edited.toAccountId || ''}
                                    onChange={e => {
                                      const newTo = e.target.value;
                                      const cardName = (Array.isArray(accounts) ? accounts : []).find(a => a.id === newTo)?.name || '信用卡';
                                      const updatedSubs = edited.subItems?.map((s, i) => i === idx ? { 
                                        ...s, 
                                        toAccountId: newTo,
                                        name: s.name.startsWith('繳 ') ? `繳 ${cardName}` : s.name
                                      } : s);
                                      setEdited({ ...edited, subItems: updatedSubs });
                                    }}
                                    className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-bold text-[#5D4037] outline-none focus:bg-white"
                                  >
                                    {accounts.filter(a => a.id !== edited.accountId).map(a => (
                                      <option key={a.id} value={a.id}>
                                        {a.name} ({a.type === 'credit' ? '信用卡' : a.type === 'bank' ? '銀行' : '帳戶'})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="col-span-2 flex flex-col gap-1">
                                  <label className="text-[11px] font-bold text-stone-500">金額 ($)</label>
                                  <NumberInput value={subItem.amount}
                                    onValueChange={amtVal => {
                                      handleUpdateSubItemAmount(idx, amtVal);
                                    }}
                                    className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-black text-[#5D4037] outline-none focus:bg-white"
                                  />
                                </div>
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-[11px] font-bold text-stone-500">備註說明</label>
                                <input
                                  type="text"
                                  value={subItem.name}
                                  onChange={e => {
                                    const nameVal = e.target.value;
                                    const updatedSubs = edited.subItems?.map((s, i) => i === idx ? { ...s, name: nameVal } : s);
                                    setEdited({ ...edited, subItems: updatedSubs });
                                  }}
                                  placeholder="如：中信uniopen聯名卡"
                                  className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-bold text-[#5D4037] outline-none focus:bg-white"
                                />
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="grid grid-cols-5 gap-2 pr-5">
                                <div className="col-span-3 flex flex-col gap-1">
                                  <label className="text-[11px] font-bold text-stone-500">品項名稱</label>
                                  <input
                                    type="text"
                                    value={subItem.name}
                                    onChange={e => {
                                      const nameVal = e.target.value;
                                      const updatedSubs = edited.subItems?.map((s, i) => i === idx ? { ...s, name: nameVal } : s);
                                      setEdited({ ...edited, subItems: updatedSubs });
                                    }}
                                    className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-bold text-[#5D4037] outline-none focus:bg-white"
                                  />
                                </div>
                                <div className="col-span-2 flex flex-col gap-1">
                                  <label className="text-[11px] font-bold text-stone-500">金額 ($)</label>
                                  <NumberInput value={subItem.amount}
                                    onValueChange={amtVal => {
                                      handleUpdateSubItemAmount(idx, amtVal);
                                    }}
                                    className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-black text-[#5D4037] outline-none focus:bg-white"
                                  />
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-2 pt-1 border-t border-stone-100 flex-wrap">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[10px] font-bold text-stone-400">歸屬標籤：</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updatedSubs = edited.subItems?.map((s, i) => i === idx ? { ...s, isPrepay: !s.isPrepay } : s);
                                      setEdited({ ...edited, subItems: updatedSubs });
                                    }}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all border flex items-center gap-1 active:scale-95 ${
                                      subItem.isPrepay
                                        ? 'bg-amber-100/90 border-amber-300 text-amber-900 shadow-xs'
                                        : 'bg-stone-100 border-stone-200 text-stone-700 hover:bg-stone-200'
                                    }`}
                                  >
                                    <span>{subItem.isPrepay ? '🏠 家裡代墊 (家裡的)' : '🛒 個人支出 (我的)'}</span>
                                  </button>
                                </div>

                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] font-bold text-stone-400">專案：</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      setSubItemProjectPickerIdx(idx);
                                    }}
                                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 rounded-lg text-[10px] font-black flex items-center gap-1 active:scale-95 transition-all shadow-2xs"
                                    title="變更子項目所屬專案"
                                  >
                                    <span>📁</span>
                                    <span>
                                      {(() => {
                                        const effectivePid = subItem.projectId || edited.projectId || 'p1';
                                        const foundProj = (Array.isArray(projects) ? projects : []).find(p => p.id === effectivePid);
                                        return subItem.projectName || foundProj?.name || (effectivePid === 'p1' ? '預設專案' : '專案');
                                      })()}
                                    </span>
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const isTransfer = edited.type === 'transfer';
                          const otherAcc = (Array.isArray(accounts) ? accounts : []).find(a => a.id !== edited.accountId);
                          const mainProj = (Array.isArray(projects) ? projects : []).find(p => p.id === (edited.projectId || 'p1'));
                          const newSub: SubItem = {
                            id: `sub_${Date.now()}_${(edited.subItems?.length || 0) + 1}`,
                            name: isTransfer ? `繳 ${otherAcc?.name || '信用卡'}` : `項目 ${(edited.subItems?.length || 0) + 1}`,
                            amount: 0,
                            category: edited.category,
                            isPrepay: false,
                            toAccountId: isTransfer ? otherAcc?.id : undefined,
                            projectId: edited.projectId || 'p1',
                            projectName: mainProj?.name || '預設專案'
                          };
                          setEdited({ ...edited, subItems: [...(edited.subItems || []), newSub] });
                        }}
                        className="px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-bold text-[#5D4037] hover:bg-stone-50 active:scale-95 transition-all shadow-xs"
                      >
                        ＋ {edited.type === 'transfer' ? '新增繳款卡別項目' : '新增子項目'}
                      </button>
                      <div className="text-right text-[11px] font-bold text-[#5D4037]">
                        <span>{edited.type === 'transfer' ? '繳款小計: ' : '子項目小計: '}</span>
                        <span className="font-black text-amber-900">$ {edited.subItems.reduce((s, i) => s + (i.amount || 0), 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sub-Item Project Selection Modal */}
            <AnimatePresence>
              {subItemProjectPickerIdx !== null && (
                <div 
                  className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-[120] p-4"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setSubItemProjectPickerIdx(null);
                    setSubItemProjectSearch('');
                  }}
                >
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-3 shadow-xl border border-stone-100 max-h-[85vh] flex flex-col"
                    style={getFontFamily()}
                  >
                    <div className="flex items-center justify-between border-b border-stone-100 pb-3 shrink-0">
                      <span className="text-sm font-black text-[#5D4037]">選擇子項目專案歸屬</span>
                      <button 
                        type="button" 
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setSubItemProjectPickerIdx(null);
                          setSubItemProjectSearch('');
                        }} 
                        className="p-1 text-stone-400 hover:text-stone-600 rounded-full transition-colors"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* 專案即時搜尋欄 (Project Search Bar) */}
                    <div className="relative shrink-0">
                      <input 
                        type="text"
                        value={subItemProjectSearch}
                        onChange={(e) => {
                          e.stopPropagation();
                          setSubItemProjectSearch(e.target.value);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="🔍 搜尋專案名稱..."
                        className="w-full pl-3 pr-8 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs font-bold text-[#5D4037] outline-none shadow-2xs focus:border-[#FFD54F] focus:bg-white transition-all"
                      />
                      {subItemProjectSearch && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setSubItemProjectSearch('');
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1 text-xs font-bold"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <div className="space-y-2 overflow-y-auto pr-1 flex-1 custom-scrollbar">
                      {/* Inherit from main transaction option */}
                      {(() => {
                        const safeProjList = Array.isArray(projects) ? projects : [];
                        const mainProj = safeProjList.find(p => p.id === (edited.projectId || 'p1'));
                        const currentSubProjId = edited.subItems?.[subItemProjectPickerIdx]?.projectId;
                        const isInherited = !currentSubProjId || currentSubProjId === (edited.projectId || 'p1');
                        const searchLower = subItemProjectSearch.trim().toLowerCase();
                        const matchesSearch = !searchLower || (mainProj?.name || '預設專案').toLowerCase().includes(searchLower) || '主交易專案'.includes(searchLower);

                        if (!matchesSearch) return null;

                        return (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              const targetIdx = subItemProjectPickerIdx;
                              const updatedSubs = edited.subItems?.map((s, i) => i === targetIdx ? {
                                ...s,
                                projectId: edited.projectId || 'p1',
                                projectName: mainProj?.name || '預設專案'
                              } : s);
                              setEdited({ ...edited, subItems: updatedSubs });
                              setSubItemProjectPickerIdx(null);
                              setSubItemProjectSearch('');
                            }}
                            className={`w-full p-3 rounded-2xl flex items-center justify-between text-xs font-black transition-all border ${
                              isInherited
                                ? 'bg-[#FFEDAE] border-[#FFD54F] text-[#5D4037]'
                                : 'bg-stone-50 border-stone-100 text-stone-700 hover:bg-stone-100'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <AccountIcon icon={mainProj?.icon || '📁'} sizeClassName="w-4 h-4" />
                              <span>主交易專案 ({ mainProj?.name || '預設專案' })</span>
                            </span>
                            {isInherited && <Check size={16} className="text-[#5D4037]" />}
                          </button>
                        );
                      })()}

                      {/* Parent / Child Accordion Projects */}
                      {(() => {
                        const safeProjList = Array.isArray(projects) ? projects : [];
                        const searchLower = subItemProjectSearch.trim().toLowerCase();
                        const isSearching = searchLower.length > 0;
                        const currentSubProjId = edited.subItems?.[subItemProjectPickerIdx]?.projectId;

                        const topParents = safeProjList.filter(p => !(p.parentProjectId || p.parentId));

                        let totalMatchedCount = 0;

                        const renderedList = topParents.map(p => {
                          const children = safeProjList.filter(c => (c.parentProjectId || c.parentId) === p.id);
                          const pMatch = !isSearching || p.name.toLowerCase().includes(searchLower);
                          const matchingChildren = children.filter(c => !isSearching || c.name.toLowerCase().includes(searchLower));
                          const shouldShowParent = pMatch || matchingChildren.length > 0;

                          if (!shouldShowParent) return null;

                          totalMatchedCount++;

                          const isParentSelected = currentSubProjId === p.id;
                          const hasChildren = children.length > 0;
                          const isExpanded = isSearching ? true : !!subItemExpandedParents[p.id];

                          return (
                            <div key={p.id} className="space-y-1 bg-stone-50/60 p-1.5 rounded-2xl border border-stone-100/80">
                              {/* Parent Card Header */}
                              <div className={`w-full p-2.5 rounded-xl flex items-center justify-between text-xs transition-all border ${
                                isParentSelected
                                  ? 'bg-[#FFEDAE] border-[#FFD54F] text-[#5D4037] font-black shadow-2xs'
                                  : 'bg-white border-stone-100 text-stone-800 hover:bg-stone-100/70 font-bold'
                              }`}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    const targetIdx = subItemProjectPickerIdx;
                                    const updatedSubs = edited.subItems?.map((s, i) => i === targetIdx ? {
                                      ...s,
                                      projectId: p.id,
                                      projectName: p.name
                                    } : s);
                                    setEdited({ ...edited, subItems: updatedSubs });
                                    setSubItemProjectPickerIdx(null);
                                    setSubItemProjectSearch('');
                                  }}
                                  className="flex items-center gap-2 flex-1 text-left min-w-0"
                                >
                                  <AccountIcon icon={p.icon || '📁'} sizeClassName="w-4 h-4" />
                                  <span className="truncate">{p.name}</span>
                                  {isParentSelected && <Check size={16} className="text-[#5D4037] shrink-0" />}
                                </button>

                                {hasChildren && (
                                  <div className="flex items-center gap-1 shrink-0 ml-2">
                                    <span className="text-[10px] font-bold text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded-full">
                                      {children.length}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        setSubItemExpandedParents(prev => ({ ...prev, [p.id]: !prev[p.id] }));
                                      }}
                                      className="p-1 hover:bg-stone-200/60 rounded-lg text-stone-400 hover:text-[#5D4037] transition-all"
                                      title={isExpanded ? '收合子專案' : '展開子專案'}
                                    >
                                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Child Projects List */}
                              {hasChildren && isExpanded && (
                                <div className="space-y-1 pl-3 pr-1 pt-0.5">
                                  {matchingChildren.map(c => {
                                    const isChildSelected = currentSubProjId === c.id;
                                    return (
                                      <button
                                        key={c.id}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          const targetIdx = subItemProjectPickerIdx;
                                          const updatedSubs = edited.subItems?.map((s, i) => i === targetIdx ? {
                                            ...s,
                                            projectId: c.id,
                                            projectName: c.name
                                          } : s);
                                          setEdited({ ...edited, subItems: updatedSubs });
                                          setSubItemProjectPickerIdx(null);
                                          setSubItemProjectSearch('');
                                        }}
                                        className={`w-full p-2 rounded-xl flex items-center justify-between text-xs transition-all border ${
                                          isChildSelected
                                            ? 'bg-[#FFEDAE] border-[#FFD54F] text-[#5D4037] font-black shadow-2xs'
                                            : 'bg-white/80 border-stone-100 text-stone-700 hover:bg-stone-100/90 font-bold'
                                        }`}
                                      >
                                        <span className="flex items-center gap-2 min-w-0">
                                          <AccountIcon icon={c.icon || '📄'} sizeClassName="w-3.5 h-3.5" />
                                          <span className="truncate">{c.name}</span>
                                        </span>
                                        {isChildSelected && <Check size={14} className="text-[#5D4037] shrink-0" />}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        });

                        const mainProj = safeProjList.find(p => p.id === (edited.projectId || 'p1'));
                        const mainMatches = !searchLower || (mainProj?.name || '預設專案').toLowerCase().includes(searchLower) || '主交易專案'.includes(searchLower);

                        if (totalMatchedCount === 0 && !mainMatches) {
                          return (
                            <div className="py-8 text-center text-xs font-bold text-stone-400">
                              找不到相符的專案
                            </div>
                          );
                        }

                        return renderedList;
                      })()}
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Prepayment / Receivable (代墊 / 代收款) Section */}
            {(edited.type === 'expense' || edited.type === 'income') && (
              <div className="space-y-4 bg-white/50 p-4 rounded-2xl border border-stone-200/50 shadow-sm" style={getFontFamily()}>
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-bold text-[#5D4037] flex items-center gap-1">
                    {edited.type === 'expense' ? '🔹 代墊 / 不計入個人支出' : '🔹 代收款 / 代墊款收回 (不計入個人收入)'}
                  </span>
                  <button 
                    type="button"
                    onClick={() => setEdited({ ...edited, isPrepay: !edited.isPrepay })}
                    className={`w-12 h-6 rounded-full transition-all relative ${edited.isPrepay ? (edited.type === 'expense' ? 'bg-sky-500' : 'bg-teal-500') : 'bg-stone-200'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${edited.isPrepay ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
                <div className="text-[10px] font-bold text-stone-400 leading-snug">
                  {edited.type === 'expense' 
                    ? '開啟後，此款項將標記為「家裡代墊」，會扣除帳戶餘額但不計入個人消費與預算扣額。' 
                    : '開啟後，此款項將標記為「代收款收回」，會增加帳戶餘額但不計入個人總收入。'}
                </div>
              </div>
            )}

            {/* Installment Section */}
            {edited.type === 'expense' && (
              <div className="space-y-4 bg-white/50 p-4 rounded-2xl border border-stone-200/50 shadow-sm" style={getFontFamily()}>
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-bold text-[#5D4037]">分期付款</span>
                  <button 
                    type="button"
                    onClick={() => handleToggleInstallment(!isInstallment)}
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
                          onChange={e => {
                            const val = parseInt(e.target.value) || 1;
                            setTotalInstallments(val);
                            setEdited(prev => ({ ...prev, totalInstallments: val }));
                            if (isCustomInstallment) {
                              setCustomSchedules(prev => {
                                if (prev.length === val) return prev;
                                if (prev.length < val) {
                                  const startDate = edited.date || formatLocalDate(new Date());
                                  const totalAmt = parseFloat(amountStr) || Math.abs(edited.amount || 0) * val;
                                  const defaultFull = generateDefaultCustomSchedule(totalAmt, val, startDate);
                                  const extra: CustomInstallmentItem[] = [];
                                  for (let i = prev.length + 1; i <= val; i++) {
                                    extra.push(defaultFull[i - 1] || { installment: i, date: getCorrectInstallmentDate(startDate, i), amount: 0 });
                                  }
                                  return [...prev, ...extra];
                                } else {
                                  return prev.slice(0, val);
                                }
                              });
                            }
                          }}
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

                    {/* 自訂每期明細 (金額與日期) 開關 */}
                    <div className="pt-3 border-t border-stone-200/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#5D4037]">自訂每期明細 (金額與日期)</span>
                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = !isCustomInstallment;
                            setIsCustomInstallment(nextVal);
                            if (nextVal && (!customSchedules || customSchedules.length === 0)) {
                              const totalAmt = parseFloat(amountStr) || Math.abs(edited.amount || 0) * totalInstallments;
                              setCustomSchedules(generateDefaultCustomSchedule(totalAmt, totalInstallments, edited.date));
                            }
                          }}
                          className={`w-12 h-6 rounded-full transition-all relative ${isCustomInstallment ? 'bg-[#5D4037]' : 'bg-stone-200'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isCustomInstallment ? 'left-7' : 'left-1'}`} />
                        </button>
                      </div>

                      {isCustomInstallment && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3 pt-1">
                          <div className="text-[11px] font-bold text-stone-400">
                            分期明細清單 (第 1 期 ～ 第 {totalInstallments} 期)
                          </div>
                          <div className="space-y-2 max-h-56 overflow-y-auto pr-1 no-scrollbar">
                            {customSchedules.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-2 bg-white/90 p-2.5 rounded-xl border border-stone-200/80 shadow-2xs">
                                <span className="text-xs font-black text-[#5D4037] w-14 shrink-0">第 {item.installment} 期</span>
                                <div className="flex-1 space-y-1">
                                  <label className="text-[11px] font-bold text-stone-500 block">扣款/入帳日期</label>
                                  <input
                                    type="date"
                                    value={item.date}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setCustomSchedules(prev => prev.map((it, i) => i === idx ? { ...it, date: val } : it));
                                      setIsCustomInstallment(true);
                                    }}
                                    className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-bold text-[#5D4037] outline-none focus:border-[#FFD54F]"
                                    style={getFontFamily()}
                                  />
                                </div>
                                <div className="w-28 shrink-0 space-y-1">
                                  <label className="text-[11px] font-bold text-stone-500 block">本期金額</label>
                                  <NumberInput
                                    min="0"
                                    value={item.amount}
                                    onValueChange={val => {
                                      setCustomSchedules(prev => prev.map((it, i) => i === idx ? { ...it, amount: val } : it));
                                      setIsCustomInstallment(true);
                                    }}
                                    className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-bold text-[#5D4037] outline-none focus:border-[#FFD54F]"
                                    style={getFontFamily()}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* 試算加總與相差提示 */}
                          {(() => {
                            const customSum = customSchedules.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
                            const originalTotal = Math.abs(edited.amount || 0);
                            const diff = Math.abs(customSum - originalTotal);
                            return (
                              <div className="p-3 bg-stone-100/90 rounded-xl space-y-1 text-xs font-bold">
                                <div className="flex items-center justify-between text-[#5D4037]">
                                  <span>自訂加總：${customSum.toLocaleString()}</span>
                                  <span>原總金額：${originalTotal.toLocaleString()}</span>
                                </div>
                                {diff !== 0 && (
                                  <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200/80 rounded-lg text-[11px] text-amber-800 font-bold leading-snug">
                                    💡 目前自訂加總與原總金額相差 ${diff.toLocaleString()} 元
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </motion.div>
                      )}
                    </div>
                    <div className="p-3 bg-amber-50/80 border border-amber-200/50 rounded-xl text-[11px] font-bold text-amber-800 leading-snug">
                      {isInstallment 
                        ? '💡 此項目目前標記為分期付款。關閉開關可將此消費還原為原始總金額並轉為一般單筆支出。'
                        : '💡 切換為分期付款將自動依期數試算每期應付金額。'}
                    </div>
                  </motion.div>
                )}
              </div>
            )}

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
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-stone-300 uppercase flex items-center gap-1">
                    <Clock size={10} /> 交易時間 (24小時制)
                  </label>
                  <div 
                    onClick={() => {
                      try {
                        editTimeInputRef.current?.showPicker?.();
                      } catch (_) {}
                    }}
                    className="relative w-full p-3 bg-white border-2 border-stone-50 rounded-xl font-bold text-[#5D4037] outline-none shadow-sm focus-within:border-[#FFD54F] transition-all flex items-center justify-between cursor-pointer min-h-[48px]"
                    style={getFontFamily()}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Clock size={15} className="text-[#FFD54F] shrink-0" />
                      <span className="text-xs sm:text-sm font-black text-[#5D4037] truncate whitespace-nowrap">
                        {formatTimeDisplay(edited.time) || '未設定時間 (點擊設定)'}
                      </span>
                    </div>
                    <span className="text-[10px] font-black text-amber-800 bg-[#FFF9E3] border border-[#FFD54F]/40 px-2 py-0.5 rounded-lg flex-shrink-0 ml-1">
                      24H
                    </span>
                    <input 
                      ref={editTimeInputRef}
                      type="time"
                      value={formatTime24(edited.time) || ''}
                      onChange={e => {
                        const val = formatTime24(e.target.value);
                        setEdited({ ...edited, time: val || undefined });
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
              <div className={`flex flex-col gap-1 transition-opacity ${edited.isPending ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-stone-300 uppercase flex items-center gap-1">
                    <Banknote size={10} /> 入帳日 (信用卡結算)
                  </label>
                  <label className="text-[10px] font-bold text-stone-300 uppercase">
                    帳單序號
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="date"
                    value={edited.postingDate || edited.date}
                    onChange={e => setEdited({ ...edited, postingDate: e.target.value, isPending: false })}
                    className="w-[70%] p-3 bg-white border-2 border-stone-50 rounded-xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
                    style={getFontFamily()}
                  />
                  <input 
                    type="number"
                    min="1"
                    placeholder="序號"
                    value={edited.postingOrder ?? ''}
                    onChange={e => {
                      const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
                      setEdited({ ...edited, postingOrder: (val !== null && !isNaN(val)) ? val : null });
                    }}
                    className="w-[30%] p-3 bg-white border-2 border-stone-50 rounded-xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all text-center"
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
              <label className="text-xs font-black text-stone-500 uppercase tracking-widest px-1">幣別</label>
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

            {edited.type === 'transfer' && edited.accountId && edited.toAccountId && edited.accountId === edited.toAccountId && (
              <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-center gap-2 text-amber-900 text-xs font-black shadow-sm">
                <span className="text-base shrink-0">⚠️</span>
                <span>轉出與轉入不可為同一個帳戶，請選擇不同帳戶</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-black text-stone-500 uppercase tracking-widest px-1" style={getFontFamily()}>
                {edited.type === 'transfer' ? '轉出帳戶' : '帳戶'}
              </label>
              <select 
                value={edited.accountId}
                onChange={e => {
                  const newAccountId = e.target.value;
                  let newToAccountId = edited.toAccountId;
                  if (edited.type === 'transfer' && newAccountId === newToAccountId) {
                    const other = (Array.isArray(accounts) ? accounts : []).find(a => a.id !== newAccountId);
                    newToAccountId = other?.id || '';
                  }
                  setEdited({ ...edited, accountId: newAccountId, toAccountId: newToAccountId });
                }}
                className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm appearance-none focus:border-[#FFD54F] transition-all"
                style={getFontFamily()}
              >
                {[...accounts].sort((a, b) => (a.order || 0) - (b.order || 0)).map(a => {
                  const isDisabled = edited.type === 'transfer' && a.id === edited.toAccountId;
                  return (
                    <option key={a.id} value={a.id} disabled={isDisabled} style={getFontFamily()}>
                      {a.name} {isDisabled ? '(已選為轉入帳戶)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {edited.type === 'transfer' && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-black text-stone-500 uppercase tracking-widest px-1" style={getFontFamily()}>轉入帳戶</label>
                  <select 
                    value={edited.toAccountId || ''}
                    onChange={e => {
                      const newToAccountId = e.target.value;
                      let newAccountId = edited.accountId;
                      if (newToAccountId === newAccountId) {
                        const other = (Array.isArray(accounts) ? accounts : []).find(a => a.id !== newToAccountId);
                        newAccountId = other?.id || '';
                      }
                      setEdited({ ...edited, toAccountId: newToAccountId, accountId: newAccountId });
                    }}
                    className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm appearance-none focus:border-[#FFD54F] transition-all"
                    style={getFontFamily()}
                  >
                    {[...accounts].sort((a, b) => (a.order || 0) - (b.order || 0)).map(a => {
                      const isDisabled = a.id === edited.accountId;
                      return (
                        <option key={a.id} value={a.id} disabled={isDisabled} style={getFontFamily()}>
                          {a.name} {isDisabled ? '(已選為轉出帳戶)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-stone-500 uppercase tracking-widest px-1">{editRateLabel}</label>
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
                    <label className="text-xs font-black text-stone-500 uppercase tracking-widest px-1">實收金額 ({toAcc?.currency})</label>
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
                  const other = (Array.isArray(accounts) ? accounts : []).find(a => a.id !== edited.accountId);
                  finalToAccountId = other?.id || '';
                }

                if (resolvedType === 'transfer' && edited.accountId && finalToAccountId && edited.accountId === finalToAccountId) {
                  alert('⚠️ 轉出與轉入不可為同一個帳戶，請選擇不同帳戶！');
                  return;
                }

                const finalNote = (edited.note || '').trim();
                const finalRemark = finalNote || (edited.remark || '').trim();
                onSave({
                  ...edited,
                  note: finalNote,
                  remark: finalRemark,
                  type: resolvedType,
                  amount: finalAmt,
                  toAccountId: resolvedType === 'transfer' ? finalToAccountId : undefined,
                  isInstallment,
                  totalInstallments: isInstallment ? totalInstallments : undefined,
                  isCustomInstallment: (isInstallment && isCustomInstallment),
                  isCustomSchedule: (isInstallment && isCustomInstallment),
                  customSchedule: (isInstallment && isCustomInstallment) ? customSchedules : undefined,
                  installmentList: (isInstallment && isCustomInstallment) ? customSchedules : undefined,
                  baseAmount: baseOriginalAmount
                }, Object.values(childUpdatesMap));
              }}
              className="w-full py-5 bg-[#5D4037] text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"
            >
              <Check size={24} /> 儲存變更
            </button>
          </div>
          
          {/* Bottom Spacing */}
          <div className="h-[40px]" />
        </div>

        {/* Merge Transactions Selector Modal */}
        <AnimatePresence>
          {isMergeModalOpen && (
            <div className="fixed inset-0 z-[350] bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
              <motion.div
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                style={getFontFamily()}
              >
                <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
                  <div>
                    <h3 className="font-black text-[#5D4037] text-base">
                      {edited.type === 'transfer' ? '選擇要合併的轉帳 / 繳款紀錄' : '選擇要合併的消費紀錄'}
                    </h3>
                    <p className="text-[11px] font-bold text-stone-400">
                      {edited.type === 'transfer' ? '同轉出帳戶且相近 3 天內的轉帳（多卡繳款彙整）' : '同帳戶且日期前後 3 天內的交易'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMergeModalOpen(false)}
                    className="p-2 text-stone-400 hover:text-stone-600 rounded-full"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="p-3 border-b border-stone-100 bg-white">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                    <input
                      type="text"
                      value={mergeSearch}
                      onChange={e => setMergeSearch(e.target.value)}
                      placeholder={edited.type === 'transfer' ? "搜尋轉入卡別、備註或金額..." : "搜尋備註、店家或分類..."}
                      className="w-full pl-9 pr-4 py-2 bg-stone-100 rounded-xl text-xs font-bold text-[#5D4037] outline-none"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {mergeCandidates.length === 0 ? (
                    <div className="py-12 text-center text-stone-400 text-xs font-bold">
                      {edited.type === 'transfer' ? '無符合「同轉出帳戶且相近 3 天內」的其他轉帳紀錄' : '無符合「同帳戶且相近 3 天內」的其他消費紀錄'}
                    </div>
                  ) : (
                    mergeCandidates.map(c => {
                      const isSelected = selectedMergeIds.includes(c.id);
                      const destCard = (Array.isArray(accounts) ? accounts : []).find(a => a.id === c.toAccountId);
                      return (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedMergeIds(prev =>
                              isSelected ? prev.filter(id => id !== c.id) : [...prev, c.id]
                            );
                          }}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-amber-50/80 border-amber-300 shadow-xs'
                              : 'bg-stone-50 border-stone-200/60 hover:bg-stone-100/60'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-4 h-4 accent-[#5D4037] rounded"
                            />
                            <div>
                              <div className="text-xs font-black text-[#5D4037]">
                                {c.type === 'transfer'
                                  ? `轉入: ${destCard?.name || '信用卡/帳戶'}${c.note ? ` (${c.note})` : ''}`
                                  : (c.note || c.merchant || c.category || '消費紀錄')}
                              </div>
                              <div className="text-[10px] font-bold text-stone-400">
                                {c.date} ｜ {c.type === 'transfer' ? '轉帳 / 繳款' : c.category}
                              </div>
                            </div>
                          </div>
                          <div className="text-xs font-black text-rose-500">
                            - $ {Math.abs(c.amount).toLocaleString()}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="p-4 bg-stone-50 border-t border-stone-100 flex items-center justify-between gap-3">
                  <div className="text-xs font-bold text-[#5D4037]">
                    <span>已選取 <span className="font-black text-amber-800">{selectedMergeIds.length}</span> 筆</span>
                    <span className="block text-[11px] text-stone-500 font-bold">
                      {edited.type === 'transfer' ? '合併後扣款總金額: ' : '合併後對帳總金額: '}
                      <span className="font-black text-amber-900">${(Math.abs(edited.amount) + selectedMergeTotal).toLocaleString()}</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleMergeTransactions}
                    disabled={selectedMergeIds.length === 0}
                    className="px-5 py-2.5 bg-[#5D4037] text-white rounded-xl text-xs font-black shadow-md active:scale-95 disabled:opacity-40 disabled:active:scale-100 transition-all"
                  >
                    確認合併 ({selectedMergeIds.length})
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

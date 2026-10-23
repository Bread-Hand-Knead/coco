import { getCategoryIcon, getFontFamily } from '../lib/financeUtils';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  BarChart3,
  Briefcase,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit3,
  FileSpreadsheet,
  FileText,
  Layers,
  PieChart,
  Plus,
  Save,
  Tag,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart as RePieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Account, Category, Project, Transaction } from '../types';
import { getTimestamp } from '../lib/dateUtils';
import { getMergedRecords, getTransactionTitle, getTransferCounterpartName, getTwdEquivalentText } from '../lib/recordUtils';
import { YearMonthPickerModal } from '../components/Common';
import { EditRecordModal } from './EditRecordModal';

export function ProjectDetailView({ project, records, accounts, categories, projects, onBack, onUpdateRecord, onDeleteRecord, onAddRecord, onDuplicateRecord }: { 
  project: Project, 
  records: Transaction[], 
  accounts: Account[], 
  categories: Category[],
  projects: Project[],
  onBack: () => void,
  onUpdateRecord: (oldRec: Transaction, newRec: Transaction, ...args: any[]) => void,
  onDeleteRecord: (rec: Transaction) => void,
  onAddRecord: () => void,
  onDuplicateRecord?: (record: Transaction) => void
}) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [editingRecord, setEditingRecord] = useState<Transaction | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedSubFilter, setSelectedSubFilter] = useState<string>('all');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const detailCardRef = useRef<HTMLDivElement>(null);
  // 電腦版點左邊明細時，右邊自動捲到明細卡片（不然它在儀表板下面，要往下滑才看得到）
  useEffect(() => {
    if (selectedRecordId) detailCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selectedRecordId]);
  const [chartType, setChartType] = useState<'pie' | 'bar' | 'trend'>('pie');
  const [inlineNote, setInlineNote] = useState<string>('');
  const [isEditingInlineNote, setIsEditingInlineNote] = useState<boolean>(false);

  const childProjects = useMemo(() => {
    return projects.filter(p => (p.parentProjectId || p.parentId) === project.id);
  }, [projects, project.id]);

  const hasChildren = childProjects.length > 0;

  const targetProjectIds = useMemo(() => {
    if (!hasChildren) return [project.id];
    if (selectedSubFilter === 'all') return [project.id, ...childProjects.map(c => c.id)];
    return [selectedSubFilter];
  }, [hasChildren, selectedSubFilter, project.id, childProjects]);

  const monthRangeLabel = useMemo(() => {
    const [y, m] = currentMonth.split('/').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    const format = (d: Date) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    return `${format(start)} - ${format(end)}`;
  }, [currentMonth]);

  // 某筆紀錄（或其中某個拆分品項）是否屬於這個專案
  const matchesProjectId = (itemPid: string | undefined, recordPid: string | undefined) => {
    const pid = itemPid || recordPid || 'p1';
    return project.id === 'p1' ? (!itemPid && !recordPid) || targetProjectIds.includes(pid) : targetProjectIds.includes(pid);
  };
  const recordInProject = (r: Transaction) => {
    if (r.subItems && r.subItems.length > 0) return r.subItems.some(s => matchesProjectId(s.projectId, r.projectId));
    const rPid = r.projectId || 'p1';
    return project.id === 'p1' ? (!r.projectId || targetProjectIds.includes(r.projectId)) : targetProjectIds.includes(rPid);
  };
  const sortByTime = (list: Transaction[]) => list.sort((a, b) => {
    const tsA = getTimestamp(a.date, a.time);
    const tsB = getTimestamp(b.date, b.time);
    if (tsB !== tsA) return tsB - tsA;
    return b.id.localeCompare(a.id);
  });

  // 這個專案所有期間的明細（匯出「整個專案」用）
  const allProjectRecords = useMemo(() => {
    return sortByTime(getMergedRecords(records.filter(recordInProject), accounts));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, project, accounts, targetProjectIds]);

  const filteredRecords = useMemo(() => {
    const [y, m] = currentMonth.split('/').map(Number);
    const raw = records.filter(r => {
      if (!recordInProject(r)) return false;
      // 專案依「消費日」分月（信用卡 1/31 刷、2/2 入帳，算在 1 月）
      const [ry, rm] = (r.date || '').split('-').map(Number);
      return ry === y && rm === m;
    });
    return sortByTime(getMergedRecords(raw, accounts));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, project, currentMonth, accounts, targetProjectIds]);

  const balance = useMemo(() => {
    let expense = 0;
    let income = 0;
    filteredRecords.forEach(r => {
      if (r.isPrepay) return;
      if (r.subItems && r.subItems.length > 0) {
        r.subItems.forEach(s => {
          if (s.isPrepay) return;
          const sPid = s.projectId || r.projectId || 'p1';
          const matches = project.id === 'p1' ? (!s.projectId && !r.projectId) || targetProjectIds.includes(sPid) : targetProjectIds.includes(sPid);
          if (matches) {
            if (r.type === 'expense') expense += Math.abs(s.amount);
            else if (r.type === 'income') income += Math.abs(s.amount);
          }
        });
        if (r.fee && r.fee > 0) {
          const rPid = r.projectId || 'p1';
          const matches = project.id === 'p1' ? (!r.projectId || targetProjectIds.includes(r.projectId)) : targetProjectIds.includes(rPid);
          if (matches && r.type === 'expense') expense += r.fee;
        }
      } else {
        const rPid = r.projectId || 'p1';
        const matches = project.id === 'p1' ? (!r.projectId || targetProjectIds.includes(r.projectId)) : targetProjectIds.includes(rPid);
        if (matches) {
          if (r.type === 'expense') expense += Math.abs(r.amount) + (r.fee || 0);
          else if (r.type === 'income') income += Math.abs(r.amount);
        }
      }
    });
    return income - expense;
  }, [filteredRecords, project.id, targetProjectIds]);

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

  // Selected Record Object for Desktop Detail View
  const selectedRecord = useMemo(() => {
    if (!selectedRecordId) return null;
    return filteredRecords.find(r => r.id === selectedRecordId) || null;
  }, [selectedRecordId, filteredRecords]);

  // Overall Statistics & Analytics for Right Column
  const categoryStats = useMemo(() => {
    const catMap: Record<string, number> = {};
    filteredRecords.forEach(r => {
      if (r.type !== 'expense') return;
      if (r.subItems && r.subItems.length > 0) {
        r.subItems.forEach(s => {
          if (s.isPrepay) return;
          const sPid = s.projectId || r.projectId || 'p1';
          const matches = project.id === 'p1' ? (!s.projectId && !r.projectId) || targetProjectIds.includes(sPid) : targetProjectIds.includes(sPid);
          if (matches) {
            const cat = s.category || r.category || '一般支出';
            catMap[cat] = (catMap[cat] || 0) + Math.abs(s.amount);
          }
        });
        if (r.fee && r.fee > 0) {
          const rPid = r.projectId || 'p1';
          const matches = project.id === 'p1' ? (!r.projectId || targetProjectIds.includes(r.projectId)) : targetProjectIds.includes(rPid);
          if (matches) {
            catMap['手續費'] = (catMap['手續費'] || 0) + r.fee;
          }
        }
      } else {
        const rPid = r.projectId || 'p1';
        const matches = project.id === 'p1' ? (!r.projectId || targetProjectIds.includes(r.projectId)) : targetProjectIds.includes(rPid);
        if (matches) {
          const cat = r.category || '一般支出';
          catMap[cat] = (catMap[cat] || 0) + Math.abs(r.amount) + (r.fee || 0);
        }
      }
    });
    const total = Object.values(catMap).reduce((a, b) => a + b, 0);
    return Object.entries(catMap)
      .map(([name, value]) => ({
        name,
        value,
        percent: total > 0 ? (value / total) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredRecords, project.id, targetProjectIds]);

  const monthlyTotals = useMemo(() => {
    let totalExpense = 0;
    let totalIncome = 0;
    filteredRecords.forEach(r => {
      if (r.isPrepay) return;
      if (r.subItems && r.subItems.length > 0) {
        r.subItems.forEach(s => {
          if (s.isPrepay) return;
          const sPid = s.projectId || r.projectId || 'p1';
          const matches = project.id === 'p1' ? (!s.projectId && !r.projectId) || targetProjectIds.includes(sPid) : targetProjectIds.includes(sPid);
          if (matches) {
            if (r.type === 'expense') totalExpense += Math.abs(s.amount);
            else if (r.type === 'income') totalIncome += Math.abs(s.amount);
          }
        });
        if (r.fee && r.fee > 0 && r.type === 'expense') {
          const rPid = r.projectId || 'p1';
          const matches = project.id === 'p1' ? (!r.projectId || targetProjectIds.includes(r.projectId)) : targetProjectIds.includes(rPid);
          if (matches) totalExpense += r.fee;
        }
      } else {
        const rPid = r.projectId || 'p1';
        const matches = project.id === 'p1' ? (!r.projectId || targetProjectIds.includes(r.projectId)) : targetProjectIds.includes(rPid);
        if (matches) {
          if (r.type === 'expense') totalExpense += Math.abs(r.amount) + (r.fee || 0);
          else if (r.type === 'income') totalIncome += Math.abs(r.amount);
        }
      }
    });
    return { totalExpense, totalIncome, net: totalIncome - totalExpense };
  }, [filteredRecords, project.id, targetProjectIds]);

  const barChartData = useMemo(() => [
    { name: '本月支出', 金額: monthlyTotals.totalExpense, fill: '#E91E63' },
    { name: '本月收入', 金額: monthlyTotals.totalIncome, fill: '#03A9F4' }
  ], [monthlyTotals]);

  // 日支出與日收入趨勢折線圖數據 (Daily Expense & Income Trend)
  const dailyTrendData = useMemo(() => {
    const dayMap: Record<string, { day: string; 支出: number; 收入: number }> = {};
    const [y, m] = currentMonth.split('/').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();

    for (let d = 1; d <= daysInMonth; d++) {
      const dayKey = `${String(d).padStart(2, '0')}`;
      dayMap[dayKey] = { day: `${d}日`, 支出: 0, 收入: 0 };
    }

    filteredRecords.forEach(r => {
      const parts = r.date.split('-');
      if (parts.length >= 3) {
        const dKey = parts[2];
        if (dayMap[dKey]) {
          if (r.type === 'expense') {
            dayMap[dKey].支出 += Math.abs(r.amount) + (r.fee || 0);
          } else if (r.type === 'income') {
            dayMap[dKey].收入 += Math.abs(r.amount);
          }
        }
      }
    });

    return Object.values(dayMap);
  }, [filteredRecords, currentMonth]);

  // 匯出專案明細成 Excel：可以選「本月」或「整個專案（全部期間）」
  // 有拆分品項的紀錄，只匯出屬於這個專案的品項，每個品項一列，金額才會和專案統計一致
  const [showExportMenu, setShowExportMenu] = useState(false);
  const handleExportProject = (scope: 'month' | 'all') => {
    setShowExportMenu(false);
    const list = scope === 'month' ? filteredRecords : allProjectRecords;
    if (list.length === 0) {
      alert(scope === 'month' ? '這個月沒有可以匯出的明細' : '這個專案還沒有任何明細');
      return;
    }
    const accName = (id?: string) => (Array.isArray(accounts) ? accounts : []).find(a => a.id === id)?.name || '';
    const prjName = (id?: string) => (Array.isArray(projects) ? projects : []).find(p => p.id === id)?.name || project.name;
    const typeStr = (t: Transaction['type']) => (t === 'income' ? '收入' : t === 'transfer' ? '轉帳' : '支出');

    const headers = ['日期', '時間', '類型', '分類', '子專案', '品項／備註', '金額', '手續費', '帳戶', '轉入帳戶', '代墊', '結清'];
    const rows: (string | number)[][] = [];
    let expense = 0, income = 0, prepay = 0;
    const tally = (type: Transaction['type'], amt: number, isPrepay: boolean) => {
      if (isPrepay) { prepay += amt; return; }
      if (type === 'expense') expense += amt;
      else if (type === 'income') income += amt;
    };

    [...list].reverse().forEach(r => { // 由舊到新
      const note = (r.note || r.remark || '').replace(/\[固定收支\]/g, '').trim();
      const base = { date: r.date, time: r.time || '', type: typeStr(r.type), acc: accName(r.accountId), to: r.type === 'transfer' ? accName(r.toAccountId) : '' };
      if (r.subItems && r.subItems.length > 0) {
        r.subItems.filter(si => matchesProjectId(si.projectId, r.projectId)).forEach((si, i) => {
          const amt = Math.abs(si.amount || 0);
          const isPrepay = !!(r.isPrepay || si.isPrepay);
          tally(r.type, amt, isPrepay);
          rows.push([base.date, base.time, base.type, si.category || r.category || '', prjName(si.projectId || r.projectId),
            si.name || note, amt, i === 0 ? (r.fee || 0) : 0, base.acc, base.to, isPrepay ? '是' : '', r.isSettled ? '已結清' : '']);
        });
      } else {
        const amt = Math.abs(r.amount || 0);
        tally(r.type, amt, !!r.isPrepay);
        rows.push([base.date, base.time, base.type, r.category || '', prjName(r.projectId),
          note, amt, r.fee || 0, base.acc, base.to, r.isPrepay ? '是' : '', r.isSettled ? '已結清' : '']);
      }
    });

    const summary: (string | number)[][] = [
      [],
      ['', '', '', '', '', '支出合計（不含代墊）', expense],
      ['', '', '', '', '', '收入合計', income],
      ['', '', '', '', '', '代墊合計', prepay],
      ['', '', '', '', '', '結餘', income - expense],
    ];
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows, ...summary]);
    sheet['!cols'] = [{ wch: 11 }, { wch: 6 }, { wch: 6 }, { wch: 14 }, { wch: 12 }, { wch: 28 }, { wch: 10 }, { wch: 7 }, { wch: 14 }, { wch: 14 }, { wch: 5 }, { wch: 7 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, '專案明細');
    const safeName = project.name.replace(/[\\/:*?"<>|]/g, '_');
    const suffix = scope === 'month' ? currentMonth.replace('/', '-') : '全部';
    try {
      XLSX.writeFile(wb, `${safeName}_專案明細_${suffix}.xlsx`);
    } catch (err) {
      console.error('Failed to export project Excel:', err);
      alert('匯出失敗，請再試一次。');
    }
  };

  const exportMenu = (
    <AnimatePresence>
      {showExportMenu && (
        <motion.div
          className="fixed inset-0 z-[150] bg-black/40 flex items-end md:items-center justify-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setShowExportMenu(false)}
        >
          <motion.div
            className="w-full max-w-md bg-[#FFF9E3] rounded-t-[32px] md:rounded-[32px] p-6 pb-8 space-y-3 shadow-2xl"
            initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }}
            onClick={e => e.stopPropagation()}
            style={getFontFamily()}
          >
            <h3 className="text-lg font-black text-[#5D4037]">匯出「{project.name}」明細</h3>
            <p className="text-xs font-bold text-stone-500">會下載一個 Excel 檔（.xlsx），最後幾列有支出、收入、代墊合計。</p>
            <button
              onClick={() => handleExportProject('month')}
              className="w-full p-4 bg-white rounded-2xl shadow-sm flex items-center justify-between font-black text-[#5D4037] active:scale-95 transition-transform"
            >
              <span>只匯出 {currentMonth}</span>
              <span className="text-xs text-stone-500">{filteredRecords.length} 筆</span>
            </button>
            <button
              onClick={() => handleExportProject('all')}
              className="w-full p-4 bg-white rounded-2xl shadow-sm flex items-center justify-between font-black text-[#5D4037] active:scale-95 transition-transform"
            >
              <span>匯出整個專案（全部期間）</span>
              <span className="text-xs text-stone-500">{allProjectRecords.length} 筆</span>
            </button>
            <button onClick={() => setShowExportMenu(false)} className="w-full py-3 text-stone-500 font-bold">取消</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Prepayment Statistics
  const prepayStats = useMemo(() => {
    let totalPrepay = 0;
    let settledPrepay = 0;
    filteredRecords.forEach(r => {
      if (r.subItems && r.subItems.length > 0) {
        r.subItems.forEach(s => {
          const sPid = s.projectId || r.projectId || 'p1';
          const matches = project.id === 'p1' ? (!s.projectId && !r.projectId) || targetProjectIds.includes(sPid) : targetProjectIds.includes(sPid);
          if (matches && s.isPrepay) {
            totalPrepay += Math.abs(s.amount);
            if (r.isSettled) settledPrepay += Math.abs(s.amount);
          }
        });
      } else {
        const rPid = r.projectId || 'p1';
        const matches = project.id === 'p1' ? (!r.projectId || targetProjectIds.includes(r.projectId)) : targetProjectIds.includes(rPid);
        if (matches && r.isPrepay) {
          totalPrepay += Math.abs(r.amount);
          if (r.isSettled) settledPrepay += Math.abs(r.amount);
        }
      }
    });
    const pendingPrepay = totalPrepay - settledPrepay;
    const rate = totalPrepay > 0 ? Math.min(100, Math.round((settledPrepay / totalPrepay) * 100)) : 0;
    return { totalPrepay, settledPrepay, pendingPrepay, rate, hasPrepay: totalPrepay > 0 };
  }, [filteredRecords, project.id, targetProjectIds]);

  // Budget Statistics
  const budgetStats = useMemo(() => {
    const budget = project.budget || 0;
    if (budget <= 0) return null;
    const spent = monthlyTotals.totalExpense;
    const remaining = budget - spent;
    const percent = Math.round((spent / budget) * 100);
    return { budget, spent, remaining, percent };
  }, [project.budget, monthlyTotals.totalExpense]);

  // Overall Statistics when no record is selected
  const overallSummary = useMemo(() => {
    const expenseRecords = filteredRecords.filter(r => r.type === 'expense');
    const avgExpense = expenseRecords.length > 0 ? Math.round(monthlyTotals.totalExpense / expenseRecords.length) : 0;
    let maxExpenseRecord: Transaction | null = null;
    let maxAmount = 0;
    expenseRecords.forEach(r => {
      const val = Math.abs(r.amount);
      if (val > maxAmount) {
        maxAmount = val;
        maxExpenseRecord = r;
      }
    });
    const activeDays = new Set(filteredRecords.map(r => r.date)).size;
    return {
      totalCount: filteredRecords.length,
      expenseCount: expenseRecords.length,
      avgExpense,
      maxExpenseRecord,
      activeDays
    };
  }, [filteredRecords, monthlyTotals]);

  // Subproject breakdown
  const subprojectDistribution = useMemo(() => {
    if (!hasChildren) return [];
    const map: Record<string, { id: string, name: string, icon?: string, amount: number }> = {};
    map[project.id] = { id: project.id, name: `母專案 (${project.name})`, icon: project.icon, amount: 0 };
    childProjects.forEach(c => {
      map[c.id] = { id: c.id, name: c.name, icon: c.icon, amount: 0 };
    });
    filteredRecords.forEach(r => {
      if (r.type !== 'expense' || r.isPrepay) return;
      if (r.subItems && r.subItems.length > 0) {
        r.subItems.forEach(s => {
          if (s.isPrepay) return;
          const pid = s.projectId || r.projectId || project.id;
          if (map[pid]) map[pid].amount += Math.abs(s.amount);
        });
      } else {
        const pid = r.projectId || project.id;
        if (map[pid]) map[pid].amount += Math.abs(r.amount);
      }
    });
    const total = Object.values(map).reduce((sum, item) => sum + item.amount, 0);
    return Object.values(map)
      .map(item => ({
        ...item,
        percent: total > 0 ? Math.round((item.amount / total) * 100) : 0
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [hasChildren, childProjects, project, filteredRecords]);

  const PIE_COLORS = [
    '#8D6E63', '#A1887F', '#5D4037', '#FFA726', '#66BB6A', 
    '#42A5F5', '#AB47BC', '#26A69A', '#FF7043', '#78909C'
  ];

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

  const handleRecordItemClick = (record: Transaction) => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      // 手機版：直接彈出既有編輯視窗
      setEditingRecord(record);
    } else {
      // 電腦版：在右側面板切換高亮展示
      setSelectedRecordId(prev => (prev === record.id ? null : record.id));
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="flex flex-col md:flex-row h-full w-full bg-white overflow-hidden"
      style={getFontFamily()}
    >
      {/* ===== 左側欄位：清單與篩選總覽 (手機版 100%，電腦版 45% ~ 48%) ===== */}
      <div className="w-full md:w-[46%] lg:w-[44%] xl:w-[42%] h-full flex flex-col bg-white border-r border-stone-200/70 shadow-xs relative flex-shrink-0 overflow-hidden">
        {/* 月份切換列 */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#FFF9E3]/40 border-b border-stone-100/80 flex-shrink-0">
          <button onClick={handlePrevMonth} className="p-2 text-[#5D4037] hover:bg-white/60 rounded-xl transition-all"><ChevronLeft size={24} /></button>
          <button 
            onClick={() => setIsDatePickerOpen(true)}
            className="text-lg font-bold text-[#5D4037] px-3 py-1 hover:bg-white/60 active:scale-95 rounded-xl transition-all"
          >
            {monthRangeLabel}
          </button>
          <button onClick={handleNextMonth} className="p-2 text-[#5D4037] hover:bg-white/60 rounded-xl transition-all"><ChevronRight size={24} /></button>
        </div>

        {/* 子專案篩選標籤列 (若為母專案且有子專案) */}
        {hasChildren && (
          <div className="px-4 py-2.5 bg-[#FFFDF5] border-b border-stone-100 flex items-center gap-2 overflow-x-auto no-scrollbar flex-shrink-0">
            <span className="text-xs font-bold text-stone-400 whitespace-nowrap">子專案：</span>
            <button
              onClick={() => setSelectedSubFilter('all')}
              className={`px-3 py-1 rounded-full text-xs font-black whitespace-nowrap transition-all ${
                selectedSubFilter === 'all'
                  ? 'bg-[#5D4037] text-white shadow-xs'
                  : 'bg-white text-[#5D4037] hover:bg-stone-100 border border-stone-200/80'
              }`}
            >
              全部彙總 ({childProjects.length + 1})
            </button>
            <button
              onClick={() => setSelectedSubFilter(project.id)}
              className={`px-3 py-1 rounded-full text-xs font-black whitespace-nowrap transition-all ${
                selectedSubFilter === project.id
                  ? 'bg-[#5D4037] text-white shadow-xs'
                  : 'bg-white text-[#5D4037] hover:bg-stone-100 border border-stone-200/80'
              }`}
            >
              僅母專案 ({project.name})
            </button>
            {childProjects.map(cp => (
              <button
                key={cp.id}
                onClick={() => setSelectedSubFilter(cp.id)}
                className={`px-3 py-1 rounded-full text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  selectedSubFilter === cp.id
                    ? 'bg-[#5D4037] text-white shadow-xs'
                    : 'bg-white text-[#5D4037] hover:bg-stone-100 border border-stone-200/80'
                }`}
              >
                <span>{cp.icon || '📁'}</span>
                <span>{cp.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* 項目筆數與結餘統計 */}
        <div className="flex justify-between px-6 py-2.5 border-b border-stone-100 text-sm font-bold text-stone-500 bg-[#FFFDF8] flex-shrink-0">
          <span className="flex items-center gap-2">
            <span>項目：<strong className="text-[#5D4037]">{filteredRecords.length}</strong> 筆</span>
            <button
              onClick={() => setShowExportMenu(true)}
              className="md:hidden flex items-center gap-1 px-2 py-0.5 bg-white border border-stone-200 rounded-lg text-xs font-black text-[#5D4037] active:scale-95 transition-transform"
            >
              <FileSpreadsheet size={13} className="text-emerald-600" /> 匯出
            </button>
          </span>
          <span>結餘：<span className={balance >= 0 ? 'text-blue-600 font-black' : 'text-rose-500 font-black'}>${balance < 0 ? '-' : ''}{Math.abs(balance).toLocaleString()}</span></span>
        </div>

        {/* 專案明細流水清單 (支援獨立垂直滾動) */}
        <div className="flex-1 overflow-y-auto relative no-scrollbar pb-24 md:pb-20">
          {filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-stone-300 gap-2 opacity-70">
              <CalendarIcon size={40} className="text-stone-300" />
              <span className="text-sm font-bold text-stone-400" style={getFontFamily()}>
                本月份尚無此專案的收支明細
              </span>
            </div>
          ) : (
            groupedRecords.map(group => (
              <div key={group.date} className="mt-3">
                <div className="px-6 py-2 text-[14px] font-bold text-stone-400 border-b border-stone-50 bg-stone-50/40">
                  {group.date} {group.weekday}
                </div>
                <div className="divide-y divide-stone-50">
                  {group.records.map(record => {
                    const recordAccount = (Array.isArray(accounts) ? accounts : []).find(a => a.id === record.accountId);
                    const recSubProject = hasChildren && record.projectId && record.projectId !== project.id
                      ? (Array.isArray(projects) ? projects : []).find(p => p.id === record.projectId)
                      : null;
                    const isSelected = selectedRecordId === record.id;

                    return (
                      <div 
                        key={record.id} 
                        onClick={() => handleRecordItemClick(record)}
                        className={`flex items-center gap-4 px-6 py-3.5 cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-[#FFF9E3] border-l-4 border-[#5D4037] shadow-2xs' 
                            : 'hover:bg-stone-50 active:bg-stone-100/70'
                        }`} 
                        style={getFontFamily()}
                      >
                        <div className="w-10 h-10 rounded-2xl bg-stone-100 flex items-center justify-center text-xl flex-shrink-0 shadow-2xs">
                          {getCategoryIcon(record.category, record.type, categories)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="text-[16px] font-bold text-[#5D4037] truncate" style={getFontFamily()}>
                              {getTransactionTitle(record)}
                            </div>
                            {recSubProject && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-[#FFF4C7] text-[#8D6E63] border border-[#FFE082]/70 rounded-md font-black">
                                {recSubProject.icon} {recSubProject.name}
                              </span>
                            )}
                            {recordAccount?.type === 'credit' && (!record.postingDate || record.isPending) && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded font-bold">未入帳</span>
                            )}
                            {record.transferredDate && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-600 rounded font-bold">已轉帳</span>
                            )}
                            {record.subItems && record.subItems.length > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded font-bold">
                                {record.subItems.length} 項拆分
                              </span>
                            )}
                          </div>
                          {record.type === 'transfer' ? (
                            (() => {
                              const isPos = record.amount > 0;
                              const currentAccName = (Array.isArray(accounts) ? accounts : []).find(a => a.id === record.accountId)?.name || '未知帳戶';
                              const counterpartAccName = getTransferCounterpartName(record, accounts);
                              const firstAccName = isPos ? counterpartAccName : currentAccName;
                              const secondAccName = isPos ? currentAccName : counterpartAccName;
                              const displayDate = record.postingDate || record.date;
                              return (
                                <div className="flex flex-col gap-0.5 mt-0.5">
                                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#5D4037]" style={getFontFamily()}>
                                    <span className="opacity-80">{firstAccName}</span>
                                    <span className="text-amber-600 font-bold">➔</span>
                                    <span className="opacity-80 font-black text-amber-800">{secondAccName}</span>
                                  </div>
                                  <span className="text-[11px] font-medium text-stone-400">
                                    入帳日期: {displayDate}{record.time && ` ${record.time}`}
                                  </span>
                                </div>
                              );
                            })()
                          ) : (
                            <div className="text-[12px] font-medium text-stone-400 truncate font-bold flex items-center gap-1.5 mt-0.5">
                              <span>{(record.note || '詳細資訊...').replace(/\[固定收支\]/g, '').trim()}</span>
                              {record.time && <span className="text-stone-400">({record.time})</span>}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0">
                          <div className={`text-[16px] font-black ${
                            (record.type === 'transfer' || record._isMergedTransfer) ? (record.amount < 0 ? 'text-[#E91E63]' : 'text-[#03A9F4]') :
                            record.type === 'income' ? 'text-[#03A9F4]' : 'text-[#E91E63]'
                          }`} style={getFontFamily()}>
                            {((record.type === 'transfer' || record._isMergedTransfer) ? (record.amount < 0 ? '-' : '+') : record.type === 'income' ? '+' : '-')}${Math.abs(record.amount).toLocaleString()}
                          </div>
                          {(() => {
                            const twdText = getTwdEquivalentText(records, accounts, record);
                            return twdText ? (
                              <span className="text-[11px] text-stone-400 font-bold">{twdText}</span>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}

        </div>

        {/* 浮動記帳按鈕：放在捲動區外面，電腦版固定在左側清單右下角，不會跟著明細一起捲動 */}
        <button 
          onClick={onAddRecord}
          className="fixed bottom-24 right-6 md:absolute md:bottom-6 md:right-6 w-14 h-14 bg-[#5D4037] text-white rounded-full flex items-center justify-center shadow-2xl hover:bg-[#4E342E] active:scale-95 transition-all z-20 group"
          title="新增明細"
        >
          <Plus size={32} className="transition-transform group-hover:rotate-90 duration-200" />
        </button>
      </div>

      {/* ===== 右側欄位：詳情檢視 / 專案分析儀表板 (電腦版 52% ~ 55%，手機版隱藏) ===== */}
      <div className="hidden md:flex md:w-[54%] lg:w-[56%] xl:w-[58%] h-full flex-col overflow-y-auto bg-[#FFFDF8] p-5 lg:p-6 gap-5 no-scrollbar">
        
        {/* 上半部：專案分析儀表板 (Analytics Dashboard) */}
        <div className="bg-white rounded-3xl p-5 border border-stone-200/70 shadow-xs flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#FFF9E3] text-[#5D4037] flex items-center justify-center">
                <Briefcase size={18} />
              </div>
              <div>
                <h3 className="text-base font-black text-[#5D4037]">專案收支儀表板</h3>
                <span className="text-xs text-stone-400 font-bold">{monthRangeLabel}</span>
              </div>
            </div>

            {/* 圖表模式切換與匯出按鈕 */}
            <div className="flex items-center gap-2">
              <div className="flex items-center p-1 bg-stone-100 rounded-xl text-xs font-black">
                <button
                  onClick={() => setChartType('pie')}
                  className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                    chartType === 'pie' ? 'bg-white text-[#5D4037] shadow-xs' : 'text-stone-400 hover:text-stone-600'
                  }`}
                >
                  <PieChart size={14} />
                  <span>類別圓餅圖</span>
                </button>
                <button
                  onClick={() => setChartType('bar')}
                  className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                    chartType === 'bar' ? 'bg-white text-[#5D4037] shadow-xs' : 'text-stone-400 hover:text-stone-600'
                  }`}
                >
                  <BarChart3 size={14} />
                  <span>收支長條圖</span>
                </button>
                <button
                  onClick={() => setChartType('trend')}
                  className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                    chartType === 'trend' ? 'bg-white text-[#5D4037] shadow-xs' : 'text-stone-400 hover:text-stone-600'
                  }`}
                >
                  <TrendingUp size={14} />
                  <span>日收支趨勢</span>
                </button>
              </div>

              {/* 匯出專案 CSV 按鈕 */}
              <button
                onClick={() => setShowExportMenu(true)}
                className="p-1.5 bg-stone-100 hover:bg-stone-200 text-[#5D4037] rounded-xl text-xs font-black transition-all flex items-center gap-1 px-2.5 active:scale-95"
                title="匯出專案明細 Excel"
              >
                <FileSpreadsheet size={15} className="text-emerald-600" />
                <span className="hidden lg:inline">匯出報表</span>
              </button>
            </div>
          </div>

          {/* 圖表展示區 */}
          <div className="py-2">
            {chartType === 'pie' ? (
              categoryStats.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center text-stone-300 gap-2">
                  <PieChart size={32} />
                  <span className="text-xs font-bold text-stone-400">本月份尚無支出統計資料</span>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  {/* 圓餅圖 */}
                  <div className="w-48 h-44 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <RePieChart>
                        <Pie
                          data={categoryStats}
                          cx="50%"
                          cy="50%"
                          innerRadius={36}
                          outerRadius={68}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {categoryStats.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: any) => [`$${Number(value).toLocaleString()}`, '金額']}
                          contentStyle={{ borderRadius: '12px', border: '1px solid #E7E5E4', fontSize: '12px', fontWeight: 'bold' }}
                        />
                      </RePieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* 類別排行榜前 4 項 */}
                  <div className="flex-1 flex flex-col gap-2 min-w-0 pr-2">
                    <span className="text-xs font-black text-stone-400">支出佔比排行：</span>
                    {categoryStats.slice(0, 4).map((cat, idx) => (
                      <div key={cat.name} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-xs font-bold text-[#5D4037]">
                          <span className="flex items-center gap-1.5 truncate">
                            <span 
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                              style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} 
                            />
                            <span className="truncate">{cat.name}</span>
                          </span>
                          <span className="font-black">${cat.value.toLocaleString()} ({Math.round(cat.percent)}%)</span>
                        </div>
                        <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-300"
                            style={{ 
                              width: `${Math.min(100, Math.round(cat.percent))}%`,
                              backgroundColor: PIE_COLORS[idx % PIE_COLORS.length]
                            }} 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ) : chartType === 'bar' ? (
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#8D6E63', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#A8A29E' }} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val.toLocaleString()}`} />
                    <Tooltip 
                      formatter={(val: any) => [`$${Number(val).toLocaleString()}`, '金額']}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #E7E5E4', fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="金額" radius={[8, 8, 0, 0]}>
                      {barChartData.map((entry, index) => (
                        <Cell key={`bar-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyTrendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#8D6E63' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: '#A8A29E' }} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val.toLocaleString()}`} />
                    <Tooltip 
                      formatter={(val: any, name: any) => [`$${Number(val).toLocaleString()}`, name]}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #E7E5E4', fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <Line type="monotone" dataKey="支出" stroke="#E91E63" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="收入" stroke="#03A9F4" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* 指標與達成率卡片 (預算達成率 / 代墊還款進度 / 收支指標) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-stone-100">
            {/* 預算達成率 (若專案有設定預算) */}
            {budgetStats ? (
              <div className="bg-[#FFFDF5] p-3 rounded-2xl border border-stone-200/60 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-stone-400">
                  <span>預算達成率</span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                    budgetStats.percent > 100 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                  }`}>
                    {budgetStats.percent > 100 ? '已超支' : `${budgetStats.percent}%`}
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-[#5D4037]">
                  <span className="text-sm font-black">${budgetStats.spent.toLocaleString()}</span>
                  <span className="text-xs text-stone-400 font-bold">預算 ${budgetStats.budget.toLocaleString()}</span>
                </div>
                <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden mt-0.5">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${
                      budgetStats.percent > 100 ? 'bg-rose-500' : budgetStats.percent > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, budgetStats.percent)}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="bg-[#FFFDF5] p-3 rounded-2xl border border-stone-200/60 flex flex-col justify-center">
                <span className="text-xs font-bold text-stone-400">本月累計支出</span>
                <span className="text-lg font-black text-[#E91E63] mt-0.5">${monthlyTotals.totalExpense.toLocaleString()}</span>
                <span className="text-[11px] text-stone-400 font-medium">共 {overallSummary.expenseCount} 筆支出紀錄</span>
              </div>
            )}

            {/* 代墊還款進度 (若有代墊紀錄) 或 收支結餘 */}
            {prepayStats.hasPrepay ? (
              <div className="bg-[#FFFDF5] p-3 rounded-2xl border border-stone-200/60 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-stone-400">
                  <span>代墊還款進度</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-100 text-blue-600">
                    {prepayStats.rate}%
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-[#5D4037]">
                  <span className="text-xs text-stone-400 font-bold">待收回 ${prepayStats.pendingPrepay.toLocaleString()}</span>
                  <span className="text-xs text-emerald-600 font-black">已結 ${prepayStats.settledPrepay.toLocaleString()}</span>
                </div>
                <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden mt-0.5">
                  <div 
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${prepayStats.rate}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="bg-[#FFFDF5] p-3 rounded-2xl border border-stone-200/60 flex flex-col justify-center">
                <span className="text-xs font-bold text-stone-400">本月專案淨結餘</span>
                <span className={`text-lg font-black mt-0.5 ${balance >= 0 ? 'text-blue-600' : 'text-rose-500'}`}>
                  ${balance < 0 ? '-' : ''}{Math.abs(balance).toLocaleString()}
                </span>
                <span className="text-[11px] text-stone-400 font-medium">總收入 ${monthlyTotals.totalIncome.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* 下半部：明細拆分卡片 或 專案整體統計摘要 */}
        {selectedRecord ? (
          /* 選取單筆明細時：展開商品拆分項目、扣款帳戶、發票備註與快捷操作 */
          <div ref={detailCardRef} className="scroll-mt-4 bg-white rounded-3xl p-5 border border-stone-200/70 shadow-xs flex flex-col gap-4 relative">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
                  selectedRecord.type === 'expense' ? 'bg-rose-100 text-rose-600' :
                  selectedRecord.type === 'income' ? 'bg-blue-100 text-blue-600' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {selectedRecord.type === 'expense' ? '支出項目' : selectedRecord.type === 'income' ? '收入項目' : '帳戶轉帳'}
                </span>
                {selectedRecord.projectId && (
                  <span className="text-xs font-black text-stone-400">
                    專案：{(Array.isArray(projects) ? projects : []).find(p => p.id === selectedRecord.projectId)?.name || '預設專案'}
                  </span>
                )}
              </div>

              {/* 取消選取按鈕 */}
              <button 
                onClick={() => setSelectedRecordId(null)}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 text-xs font-black transition-all"
                title="返回專案整體摘要"
              >
                <X size={14} />
                <span>返回總覽</span>
              </button>
            </div>

            {/* 交易標題與主金額 */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h4 className="text-xl font-black text-[#5D4037] leading-snug">
                  {getTransactionTitle(selectedRecord)}
                </h4>
                <div className="flex items-center gap-2 text-xs font-bold text-stone-400 mt-1">
                  <span>{selectedRecord.date}</span>
                  {selectedRecord.time && <span>{selectedRecord.time}</span>}
                  <span>•</span>
                  <span>{(() => {
                    const acc = (Array.isArray(accounts) ? accounts : []).find(a => a.id === selectedRecord.accountId);
                    return acc ? `${acc.name} 扣款` : '一般帳戶';
                  })()}</span>
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <div className={`text-2xl font-black ${
                  selectedRecord.type === 'income' ? 'text-[#03A9F4]' : 'text-[#E91E63]'
                }`}>
                  {selectedRecord.type === 'income' ? '+' : '-'}${Math.abs(selectedRecord.amount).toLocaleString()}
                </div>
                {!!selectedRecord.fee && selectedRecord.fee > 0 && (
                  <span className="text-[11px] text-stone-400 font-bold block mt-0.5">
                    含手續費 ${selectedRecord.fee}
                  </span>
                )}
              </div>
            </div>

            {/* 商品拆分項目 (Sub-items Breakdown) */}
            {selectedRecord.subItems && selectedRecord.subItems.length > 0 ? (
              <div className="flex flex-col gap-2.5 pt-2 border-t border-stone-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-stone-500 flex items-center gap-1.5">
                    <Layers size={14} className="text-stone-400" />
                    <span>商品拆分明細 (共 {selectedRecord.subItems.length} 項)</span>
                  </span>
                  <span className="text-xs font-bold text-stone-400">
                    拆分合計: ${selectedRecord.subItems.reduce((acc, curr) => acc + Math.abs(curr.amount), 0).toLocaleString()}
                  </span>
                </div>

                <div className="divide-y divide-stone-100 bg-[#FFFDF5] rounded-2xl border border-stone-200/70 overflow-hidden">
                  {selectedRecord.subItems.map((sub, idx) => {
                    const subProject = (Array.isArray(projects) ? projects : []).find(p => p.id === (sub.projectId || selectedRecord.projectId));
                    const totalRecordAmount = Math.abs(selectedRecord.amount) || 1;
                    const subPercent = Math.round((Math.abs(sub.amount) / totalRecordAmount) * 100);

                    return (
                      <div key={sub.id || idx} className="p-3.5 flex items-center justify-between gap-3 hover:bg-stone-50/50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-sm text-[#5D4037] truncate">
                              {sub.name || '未命名商品'}
                            </span>
                            {sub.category && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-stone-100 text-stone-500 font-bold">
                                {sub.category}
                              </span>
                            )}
                            {subProject && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#FFF4C7] text-[#8D6E63] font-bold">
                                {subProject.icon} {subProject.name}
                              </span>
                            )}
                            {sub.isPrepay && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 font-bold">
                                代墊
                              </span>
                            )}
                          </div>
                          {/* 佔比進度條 */}
                          <div className="w-36 bg-stone-200/70 h-1.5 rounded-full overflow-hidden mt-1.5">
                            <div className="bg-[#5D4037] h-full rounded-full" style={{ width: `${subPercent}%` }} />
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <span className="text-sm font-black text-[#5D4037]">
                            ${Math.abs(sub.amount).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-stone-400 block font-bold">
                            {subPercent}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-[#FFFDF5] rounded-2xl border border-stone-200/60 flex items-center justify-between text-xs font-bold text-stone-500">
                <span className="flex items-center gap-1.5">
                  <Tag size={14} className="text-stone-400" />
                  <span>分類：{selectedRecord.category || '一般支出'}</span>
                </span>
                <span>單筆完整記錄 (無商品拆分)</span>
              </div>
            )}

            {/* 備註與發票卡片 (支援直接快捷修改備註) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-stone-100 text-xs">
              <div className="p-3 bg-stone-50 rounded-2xl flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-400">備註說明：</span>
                  {!isEditingInlineNote ? (
                    <button
                      onClick={() => {
                        setInlineNote(selectedRecord.note ? selectedRecord.note.replace(/\[固定收支\]/g, '').trim() : '');
                        setIsEditingInlineNote(true);
                      }}
                      className="text-[11px] font-bold text-amber-700 hover:text-amber-800 flex items-center gap-0.5"
                    >
                      <Edit3 size={11} />
                      <span>快速修改</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          const isFixed = selectedRecord.note?.includes('[固定收支]');
                          const updatedNote = isFixed ? `[固定收支] ${inlineNote.trim()}`.trim() : inlineNote.trim();
                          onUpdateRecord(selectedRecord, { ...selectedRecord, note: updatedNote });
                          setIsEditingInlineNote(false);
                        }}
                        className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold flex items-center gap-1 hover:bg-emerald-700"
                      >
                        <Save size={10} />
                        <span>儲存</span>
                      </button>
                      <button
                        onClick={() => setIsEditingInlineNote(false)}
                        className="px-2 py-0.5 bg-stone-200 text-stone-600 rounded text-[10px] font-bold hover:bg-stone-300"
                      >
                        取消
                      </button>
                    </div>
                  )}
                </div>
                {!isEditingInlineNote ? (
                  <span className="font-black text-[#5D4037] break-words">
                    {selectedRecord.note ? selectedRecord.note.replace(/\[固定收支\]/g, '').trim() || '無' : '無備註'}
                  </span>
                ) : (
                  <input
                    type="text"
                    value={inlineNote}
                    onChange={(e) => setInlineNote(e.target.value)}
                    placeholder="輸入新備註..."
                    className="w-full px-2.5 py-1 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-[#5D4037] bg-white font-bold text-[#5D4037]"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const isFixed = selectedRecord.note?.includes('[固定收支]');
                        const updatedNote = isFixed ? `[固定收支] ${inlineNote.trim()}`.trim() : inlineNote.trim();
                        onUpdateRecord(selectedRecord, { ...selectedRecord, note: updatedNote });
                        setIsEditingInlineNote(false);
                      } else if (e.key === 'Escape') {
                        setIsEditingInlineNote(false);
                      }
                    }}
                  />
                )}
              </div>
              <div className="p-3 bg-stone-50 rounded-2xl flex flex-col gap-1">
                <span className="font-bold text-stone-400">支付方式 / 扣款帳戶：</span>
                <span className="font-black text-[#5D4037]">
                  {(() => {
                    const acc = (Array.isArray(accounts) ? accounts : []).find(a => a.id === selectedRecord.accountId);
                    return acc ? acc.name : '預設帳戶';
                  })()}
                </span>
              </div>
            </div>

            {/* 快捷操作按鈕組 */}
            <div className="flex items-center gap-2.5 pt-3 border-t border-stone-100">
              <button
                onClick={() => setEditingRecord(selectedRecord)}
                className="flex-1 py-2.5 px-4 bg-[#5D4037] hover:bg-[#4E342E] text-white rounded-2xl text-xs font-black shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <Edit3 size={15} />
                <span>編輯此筆明細</span>
              </button>

              {onDuplicateRecord && (
                <button
                  onClick={() => onDuplicateRecord(selectedRecord)}
                  className="py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-[#5D4037] rounded-2xl text-xs font-black active:scale-95 transition-all flex items-center justify-center gap-1.5"
                  title="複製此筆明細"
                >
                  <Copy size={15} />
                  <span>複製</span>
                </button>
              )}

              <button
                onClick={() => {
                  if (confirm('確定要刪除這筆專案明細紀錄嗎？')) {
                    onDeleteRecord(selectedRecord);
                    setSelectedRecordId(null);
                  }
                }}
                className="py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-2xl text-xs font-black active:scale-95 transition-all flex items-center justify-center gap-1.5"
                title="刪除此筆明細"
              >
                <Trash2 size={15} />
                <span>刪除</span>
              </button>
            </div>
          </div>
        ) : (
          /* 未選取明細時：顯示專案整體統計摘要 */
          <div className="bg-white rounded-3xl p-5 border border-stone-200/70 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-[#5D4037]" />
                <h4 className="text-base font-black text-[#5D4037]">專案整體統計摘要</h4>
              </div>
              <span className="text-xs font-bold text-stone-400">
                本月共 {overallSummary.totalCount} 筆項目
              </span>
            </div>

            {/* 統計網格 (Quick Stats Grid) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 bg-[#FFFDF5] rounded-2xl border border-stone-200/60">
                <span className="text-xs font-bold text-stone-400">平均單筆支出</span>
                <div className="text-lg font-black text-[#5D4037] mt-0.5">
                  ${overallSummary.avgExpense.toLocaleString()}
                </div>
              </div>

              <div className="p-3.5 bg-[#FFFDF5] rounded-2xl border border-stone-200/60">
                <span className="text-xs font-bold text-stone-400">活躍消費天數</span>
                <div className="text-lg font-black text-[#5D4037] mt-0.5">
                  {overallSummary.activeDays} 天
                </div>
              </div>

              <div className="p-3.5 bg-[#FFFDF5] rounded-2xl border border-stone-200/60 col-span-2">
                <span className="text-xs font-bold text-stone-400">單筆最高支出</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm font-black text-[#5D4037] truncate pr-2">
                    {overallSummary.maxExpenseRecord ? getTransactionTitle(overallSummary.maxExpenseRecord) : '暫無紀錄'}
                  </span>
                  <span className="text-base font-black text-[#E91E63] flex-shrink-0">
                    {overallSummary.maxExpenseRecord ? `$${Math.abs(overallSummary.maxExpenseRecord.amount).toLocaleString()}` : '$0'}
                  </span>
                </div>
              </div>
            </div>

            {/* 子專案分佈摘要 (若有子專案) */}
            {hasChildren && subprojectDistribution.length > 0 && (
              <div className="flex flex-col gap-2.5 pt-2 border-t border-stone-100">
                <span className="text-xs font-black text-stone-500">子專案消費分佈：</span>
                <div className="flex flex-col gap-2">
                  {subprojectDistribution.map(sp => (
                    <div key={sp.id} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs font-bold text-[#5D4037]">
                        <span className="flex items-center gap-1.5 truncate">
                          <span>{sp.icon || '📁'}</span>
                          <span className="truncate">{sp.name}</span>
                        </span>
                        <span className="font-black">${sp.amount.toLocaleString()} ({sp.percent}%)</span>
                      </div>
                      <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#5D4037] rounded-full transition-all duration-300"
                          style={{ width: `${sp.percent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 友善點擊指引提示 */}
            <div className="p-4 bg-[#FFF9E3]/50 rounded-2xl border border-[#FFE082]/60 flex items-start gap-3 mt-1">
              <span className="text-lg">💡</span>
              <div className="text-xs font-bold text-[#5D4037] leading-relaxed">
                點選左側流水清單中的任一筆明細，即可在此處即時展開完整商品拆分項目、扣款帳戶、發票備註與快捷操作！
              </div>
            </div>
          </div>
        )}

      </div>

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
              setSelectedRecordId(null);
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
      {exportMenu}
    </motion.div>
  );
}

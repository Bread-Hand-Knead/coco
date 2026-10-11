import { getFontFamily } from '../lib/financeUtils';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  Clock,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { User } from 'firebase/auth';
import type { Account, Category, Project, SubItem } from '../types';
import { findMatchingProjectId } from '../lib/defaults';
import { groupAccountsByInstitution } from '../lib/accountUtils';
import { callGeminiApiWithFallback, filterTaiwanTerms } from '../lib/gemini';
import { SafeAccountIcon } from '../components/AccountWidgets';

export interface AiSplitModalProps {
  isOpen: boolean;
  initialTab?: 'expense' | 'income';
  presetData?: { items?: any[]; date?: string; time?: string; note?: string } | null;
  onClose: () => void;
  accounts: Account[];
  categories: Category[];
  projects: Project[];
  user: User | null;
  onSaveBatch: (records: any[]) => Promise<void>;
  onIncrementAiCount?: () => void;
}

export function AiAccountDropdown({
  accounts,
  value,
  onChange,
  compact = false
}: {
  accounts: Account[];
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredAccounts = useMemo(() => {
    return Array.isArray(accounts) ? accounts : [];
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
    <div ref={containerRef} className={`relative ${compact ? 'min-w-[130px] max-w-[190px]' : 'w-full'}`} style={getFontFamily()}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={
          compact
            ? "bg-stone-50 hover:bg-stone-100 border border-stone-200/80 rounded-xl px-2.5 py-1 text-xs font-bold text-[#5D4037] outline-none cursor-pointer w-full flex items-center justify-between gap-1 shadow-sm transition-all hover:border-[#FFD54F]"
            : "w-full p-3 bg-white border-2 border-[#5D4037]/10 rounded-2xl font-bold text-[#5D4037] text-sm outline-none flex items-center justify-between shadow-sm hover:border-[#FFD54F] transition-all cursor-pointer"
        }
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
          {selectedAccount ? (
            <>
              <SafeAccountIcon icon={selectedAccount.icon || '🏦'} name={selectedAccount.name} className="w-4 h-4 object-contain rounded shrink-0 inline-block mr-1" />
              <span className="truncate font-bold text-[#5D4037]">{selectedAccount.name}</span>
            </>
          ) : (
            <span className="text-stone-400 font-medium truncate">選擇扣款帳戶</span>
          )}
        </div>
        <ChevronDown size={14} className={`text-stone-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-[350] top-full left-0 right-0 w-full min-w-[200px] mt-1 bg-white border-2 border-[#5D4037]/10 rounded-2xl shadow-xl max-h-60 overflow-y-auto overflow-x-hidden p-2 space-y-2 box-border custom-scrollbar"
          >
            {groupedAccounts.length === 0 ? (
              <div className="p-3 text-center text-xs text-stone-400 font-medium">無可用帳戶</div>
            ) : (
              groupedAccounts.map(group => (
                <div key={group.groupName} className="space-y-1">
                  <div className="text-[11px] font-black text-[#5D4037]/60 bg-stone-100/90 px-2.5 py-1 rounded-lg border border-stone-200/40 sticky top-0 z-10 backdrop-blur-xs truncate">
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
                          <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
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

export function AiSplitModal({ isOpen, initialTab = 'expense', presetData, onClose, accounts, categories, projects, user, onSaveBatch, onIncrementAiCount }: AiSplitModalProps) {
  const [step, setStep] = useState<1 | 2>(() => (presetData?.items && presetData.items.length > 0) ? 2 : 1);
  const [rawText, setRawText] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '');
  const [transactionDate, setTransactionDate] = useState(() => presetData?.date || new Date().toISOString().split('T')[0]);
  const [transactionTime, setTransactionTime] = useState(() => {
    if (presetData?.time) return presetData.time;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  });
  const dateInputRef = useRef<HTMLInputElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);
  const [invoiceNote, setInvoiceNote] = useState(() => presetData?.note || '');
  const dateInputRef2 = useRef<HTMLInputElement>(null);
  const timeInputRef2 = useRef<HTMLInputElement>(null);
  const [apiKeyInput, setApiKeyInput] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const targetType = initialTab === 'income' ? 'income' : 'expense';

  // Get categories according to initialTab (income or expense)
  const targetCategories = useMemo(() => {
    const list: string[] = [];
    categories
      .filter(c => c.type === targetType)
      .forEach(cat => {
        list.push(cat.name);
        if (cat.sub && cat.sub.length > 0) {
          cat.sub.forEach(sub => {
            list.push(`${cat.name} > ${sub}`);
          });
        }
      });
    return list.length > 0 ? list : ['其他'];
  }, [categories, targetType]);

  const [parsedItems, setParsedItems] = useState<{ name: string; amount: number; category: string; projectId?: string; isPrepay: boolean }[]>(() => {
    if (presetData?.items && presetData.items.length > 0) {
      return presetData.items.map((item: any) => {
        const cat = targetCategories.includes(item.category) ? item.category : (targetCategories[0] || '其他');
        const matchPid = findMatchingProjectId(cat, projects);
        return {
          name: filterTaiwanTerms(item.name || '未命名項目'),
          amount: typeof item.amount === 'number' ? item.amount : parseInt(item.amount, 10) || 0,
          category: cat,
          projectId: item.projectId || matchPid || undefined,
          isPrepay: !!item.isPrepay
        };
      });
    }
    return [];
  });

  useEffect(() => {
    if (presetData?.items && presetData.items.length > 0) {
      const formatted = presetData.items.map((item: any) => {
        const cat = targetCategories.includes(item.category) ? item.category : (targetCategories[0] || '其他');
        const matchPid = findMatchingProjectId(cat, projects);
        return {
          name: filterTaiwanTerms(item.name || '未命名項目'),
          amount: typeof item.amount === 'number' ? item.amount : parseInt(item.amount, 10) || 0,
          category: cat,
          projectId: item.projectId || matchPid || undefined,
          isPrepay: !!item.isPrepay
        };
      });
      setParsedItems(formatted);
      if (presetData.date) setTransactionDate(presetData.date);
      if (presetData.time) setTransactionTime(presetData.time);
      if (presetData.note) setInvoiceNote(presetData.note);
      setStep(2);
    }
  }, [presetData, targetCategories, projects]);

  const handleSaveApiKey = () => {
    localStorage.setItem('gemini_api_key', apiKeyInput.trim());
    alert('API 金鑰已儲存！');
  };

  const getApiKey = () => {
    return (import.meta as any).env.VITE_GEMINI_API_KEY || localStorage.getItem('gemini_api_key') || '';
  };

  const handleParseText = async () => {
    const key = getApiKey().trim();
    if (!key) {
      alert('請先設定 Gemini API 金鑰！');
      return;
    }
    if (!rawText.trim()) {
      alert('請輸入明細文字！');
      return;
    }

    setIsParsing(true);
    try {
      const typeText = targetType === 'income' ? '收入' : '支出';
      const categoriesString = targetCategories.join('\n');
      const prompt = `你是一個專業的記帳助理。請幫我將這段發票、收據、明細或款項文字，拆分成多個獨立的${typeText}品項，並同時自動提取該筆交易發生的日期與時間。

這段明細的文字是：
"""
${rawText}
"""

可用${typeText}分類清單（請務必只從以下清單中選擇最符合的「主分類 > 子分類」或「主分類」填入，若都不符合請填「其他」）：
${categoriesString}

【核心拆分規則】
1. 嚴格 1:1 逐行完整擷取（Strict Line-by-Line Extraction）：
   - 發票/收據上出現的所有購買品項與所有折抵扣減項目，必須逐行完整擷取，絕對禁止自行合併、忽略、攤提或過濾任何品項！
   - 包含促銷折扣、買一送一折抵、折價券、折扣碼、點數折抵、禮券折抵等負數金額項目，皆必須獨立作為一筆品項行。
2. 負數折抵金額處理：
   - 折扣/折抵/促銷/買一送一/折價券等扣減金額品項，其 "amount" 欄位必須為負數金額（例如 -59、-5）。
   - 正數商品品項金額為正數（例如 30、118）。
   - 負數金額項目金額直接帶負值，參與該筆交易的總金額加總。
3. 品項名稱請統一修飾為台灣繁體中文慣用語（如：將「視頻」改為「影片」，「屏幕」改為「螢幕」，「反饋」改為「回饋」等）。

請輸出一個標準的 JSON 物件，不可以包含任何解釋、Markdown格式（如 \`\`\`json）或前導後導文字。格式如下：
{
  "date": "2026-09-09", // 若明細文字中有出現交易日期，請提取為 YYYY-MM-DD 格式；若文字中未提及日期，請填 null
  "time": "17:35", // 若明細文字中有出現交易時間（例如 17:35、17:35:12、下午5點35分 等），請提取並轉換為 24 小時制 HH:mm 格式；若文字中未提及時間，請填 null
  "items": [
    {
      "name": "四維雙面膠帶",
      "amount": 30, // 正數金額
      "category": "選擇的分類", // 必須是可用${typeText}分類清單中的一項
      "isPrepay": false // 如果明細中提到是「幫別人買、家裡代墊、代付、代購、代墊、代收、代收款」等，請設為 true，否則為 false
    },
    {
      "name": "買1送1折抵",
      "amount": -59, // 負數折抵金額 (帶負號)
      "category": "選擇的分類",
      "isPrepay": false
    }
  ]
}

請注意：
1. 輸出必須為標準的 JSON 物件，可以直接被 JSON.parse 解析。
2. 若文字中有時間（例如 "2026/09/09 17:35"、"17:35:12"、"下午 05:35" 等），務必提取時間至 "time" 欄位（格式為 HH:mm）。
3. 切記：所有折抵、買一送一與促銷扣減項目必須獨立列出且金額為負數，絕對不能遺漏或合併！`;

      const requestBody = {
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      };

      const resJson = await callGeminiApiWithFallback(key, requestBody);
      const responseText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!responseText) {
        throw new Error('Gemini API 未回傳任何文字結果，請確認金鑰是否正確。');
      }

      let parsedResult: any;
      try {
        const cleanText = responseText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
        parsedResult = JSON.parse(cleanText);
      } catch (_) {
        throw new Error('回傳結果不是合法的 JSON 結構。');
      }

      let rawItems: any[] = [];
      let extractedTime: string | null = null;
      let extractedDate: string | null = null;

      if (Array.isArray(parsedResult)) {
        rawItems = parsedResult;
      } else if (parsedResult && typeof parsedResult === 'object') {
        if (Array.isArray(parsedResult.items)) {
          rawItems = parsedResult.items;
        }
        if (typeof parsedResult.time === 'string' && parsedResult.time.trim() && parsedResult.time !== 'null') {
          extractedTime = parsedResult.time.trim();
        }
        if (typeof parsedResult.date === 'string' && parsedResult.date.trim() && parsedResult.date !== 'null') {
          extractedDate = parsedResult.date.trim();
        }
      }

      // 備援正規式擷取時間 (若 AI 未提取到)
      if (!extractedTime) {
        const timeMatch = rawText.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?\b/);
        if (timeMatch) {
          extractedTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
        } else {
          const chMatch = rawText.match(/(上午|下午|早上|中午|晚上)?\s*(\d{1,2})[點:時](\d{1,2})分?/);
          if (chMatch) {
            let h = parseInt(chMatch[2], 10);
            const m = parseInt(chMatch[3], 10);
            if ((chMatch[1] === '下午' || chMatch[1] === '晚上') && h < 12) h += 12;
            if (chMatch[1] === '上午' && h === 12) h = 0;
            if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
              extractedTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            }
          }
        }
      }

      // 備援正規式擷取日期 (若 AI 未提取到)
      if (!extractedDate) {
        const dateMatch = rawText.match(/\b(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})\b/);
        if (dateMatch) {
          const yyyy = dateMatch[1];
          const mm = dateMatch[2].padStart(2, '0');
          const dd = dateMatch[3].padStart(2, '0');
          extractedDate = `${yyyy}-${mm}-${dd}`;
        }
      }

      // 套用擷取到之時間
      if (extractedTime) {
        const tm = extractedTime.match(/([01]?\d|2[0-3]):([0-5]\d)/);
        if (tm) {
          setTransactionTime(`${tm[1].padStart(2, '0')}:${tm[2]}`);
        }
      }

      // 套用擷取到之日期
      if (extractedDate) {
        const dm = extractedDate.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
        if (dm) {
          setTransactionDate(`${dm[1]}-${dm[2].padStart(2, '0')}-${dm[3].padStart(2, '0')}`);
        }
      }

      // Filter and clean items with auto category-to-project matching, preserving negative amounts for discounts
      const items = rawItems.map((item: any) => {
        const cat = targetCategories.includes(item.category) ? item.category : (targetCategories[0] || '其他');
        const matchPid = findMatchingProjectId(cat, projects);
        const parsedAmt = parseInt(item.amount, 10);
        const amt = isNaN(parsedAmt) ? 0 : parsedAmt;
        return {
          name: filterTaiwanTerms(item.name || '未命名項目'),
          amount: amt,
          category: cat,
          projectId: matchPid || undefined,
          isPrepay: !!item.isPrepay
        };
      });

      setParsedItems(items);
      setStep(2);
      onIncrementAiCount?.();
    } catch (err: any) {
      console.error('AI split failed:', err);
      const rawMsg = err?.message || '';
      let displayMsg = rawMsg;
      if (rawMsg.includes('503') || rawMsg.includes('429') || rawMsg.toLowerCase().includes('high demand') || rawMsg.toLowerCase().includes('unavailable') || rawMsg.includes('伺服器忙碌')) {
        displayMsg = '目前伺服器忙碌中，請稍候片刻再試';
      } else if (rawMsg.includes('API 請求失敗') || rawMsg.includes('{') || rawMsg.includes('}')) {
        displayMsg = '請求服務失敗，請稍後再試。';
      }
      alert('解析失敗：' + displayMsg);
    } finally {
      setIsParsing(false);
    }
  };

  const handleUpdateItem = (index: number, key: string, value: any) => {
    setParsedItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [key]: value };
      if (key === 'category') {
        const matchPid = findMatchingProjectId(value, projects);
        if (matchPid) {
          updated.projectId = matchPid;
        }
      }
      return updated;
    }));
  };

  const handleDeleteItem = (index: number) => {
    setParsedItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddItem = () => {
    const defaultCat = targetCategories[0] || '其他';
    const matchPid = findMatchingProjectId(defaultCat, projects);
    setParsedItems(prev => [
      ...prev,
      {
        name: '新項目',
        amount: 0,
        category: defaultCat,
        projectId: matchPid || undefined,
        isPrepay: false
      }
    ]);
  };

  const { prepayTotal, totalDeduction } = useMemo(() => {
    let prepay = 0;
    const personalMap: Record<string, number> = {};
    
    parsedItems.forEach(item => {
      if (item.isPrepay) {
        prepay += item.amount;
      } else {
        const cat = item.category.split(' > ')[0] || '其他';
        personalMap[cat] = (personalMap[cat] || 0) + item.amount;
      }
    });

    const total = parsedItems.reduce((sum, item) => sum + item.amount, 0);
    const personalSummary = Object.entries(personalMap)
      .map(([cat, amt]) => `${cat}: $${amt.toLocaleString()}`)
      .join(' | ');

    return {
      personalExpenses: personalSummary,
      prepayTotal: prepay,
      totalDeduction: total
    };
  }, [parsedItems]);

  const handleConfirmSave = async () => {
    if (parsedItems.length === 0) {
      alert('無可儲存的明細品項！');
      return;
    }

    const isIncome = targetType === 'income';
    const personalSum = totalDeduction - prepayTotal;
    const confirm = window.confirm(`確認要將這 ${parsedItems.length} 筆項目劃分歸屬，並合併為 1 筆母交易入帳嗎？\n刷卡總額：NT$ ${totalDeduction.toLocaleString()}\n(個人支出: NT$ ${personalSum.toLocaleString()} | 家裡代墊: NT$ ${prepayTotal.toLocaleString()})`);
    if (!confirm) return;

    setIsSaving(true);
    try {
      const subItemsList: SubItem[] = parsedItems.map((item, idx) => ({
        id: `sub_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
        name: filterTaiwanTerms(item.name),
        amount: item.amount,
        category: filterTaiwanTerms(item.category),
        projectId: item.projectId,
        isPrepay: item.isPrepay
      }));

      const allPrepay = parsedItems.every(i => i.isPrepay);
      const firstItemName = filterTaiwanTerms(parsedItems[0]?.name || '採買');
      const mainTitle = parsedItems.length === 1 
        ? firstItemName 
        : `${firstItemName} 等 ${parsedItems.length} 項明細`;

      const recordToSave = {
        amount: isIncome ? Math.abs(totalDeduction) : -Math.abs(totalDeduction),
        category: filterTaiwanTerms(parsedItems[0]?.category || '其他'),
        note: invoiceNote ? `${invoiceNote} ${mainTitle}` : mainTitle,
        remark: invoiceNote ? `${invoiceNote} ${mainTitle}` : mainTitle,
        date: transactionDate,
        time: transactionTime,
        postingDate: transactionDate,
        type: targetType as 'income' | 'expense',
        accountId: selectedAccountId,
        projectId: parsedItems[0]?.projectId || undefined,
        isPrepay: allPrepay,
        subItems: subItemsList
      };

      await onSaveBatch([recordToSave]);
      onClose();
    } catch (err: any) {
      console.error('Batch save failed:', err);
      alert('儲存失敗：' + (err.message || '未知錯誤'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-[#FFF9E3] rounded-[40px] w-full max-w-lg shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden"
        style={getFontFamily()}
      >
        {/* Header */}
        <div className="px-6 py-6 pb-4 flex items-center justify-between border-b border-[#5D4037]/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-white rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0">
              <Sparkles size={18} className="text-[#0369A1]" />
            </div>
            <h3 className="text-lg font-black text-[#5D4037]" style={getFontFamily()}>AI 智慧明細拆分工具</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#5D4037] hover:bg-black/5 rounded-full"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 custom-scrollbar">
          {step === 1 ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-bold text-[#5D4037]/70 uppercase ml-1">1. 貼上發票或明細文字</label>
                <textarea
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  placeholder="請在此貼上整筆發票品項、LINE 或網購明細文字。&#10;例如：&#10;2026/09/09 17:35 7-11 購買清單：&#10;- 美式咖啡 45 元&#10;- 雞肉沙拉 65 元 (代墊)&#10;- 面紙 30 元"
                  className="w-full h-36 p-4 bg-white border-2 border-[#5D4037]/10 rounded-2xl font-bold text-[#5D4037] text-sm outline-none focus:border-[#FFD54F] transition-all resize-none"
                  style={getFontFamily()}
                />
              </div>

              {/* 中繼資料設定區：扣款帳戶、交易日期、交易時間 */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-bold text-[#5D4037]/70 uppercase ml-1">2. 扣款帳戶</label>
                  <AiAccountDropdown
                    accounts={accounts}
                    value={selectedAccountId}
                    onChange={setSelectedAccountId}
                  />
                </div>

                {/* 交易日期與交易時間並列在同一排 */}
                <div className="grid grid-cols-2 gap-3">
                  {/* 交易日期 */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] font-bold text-[#5D4037]/70 uppercase ml-1 flex items-center gap-1">
                      <CalendarIcon size={13} className="text-[#FFD54F]" />
                      <span>交易日期</span>
                    </label>
                    <div 
                      onClick={() => {
                        try {
                          dateInputRef.current?.showPicker?.();
                        } catch (_) {}
                      }}
                      className="relative w-full p-3 bg-white border-2 border-[#5D4037]/10 rounded-2xl flex items-center justify-between cursor-pointer hover:border-[#FFD54F] transition-all"
                      style={getFontFamily()}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <CalendarIcon size={15} className="text-[#5D4037]/70 shrink-0" />
                        <span className="font-bold text-[#5D4037] text-sm truncate">
                          {transactionDate.replace(/-/g, '/')}
                        </span>
                      </div>
                      <input
                        ref={dateInputRef}
                        type="date"
                        value={transactionDate}
                        onChange={e => e.target.value && setTransactionDate(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* 交易時間 */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] font-bold text-[#5D4037]/70 uppercase ml-1 flex items-center gap-1">
                      <Clock size={13} className="text-[#FFD54F]" />
                      <span>交易時間</span>
                    </label>
                    <div 
                      onClick={() => {
                        try {
                          timeInputRef.current?.showPicker?.();
                        } catch (_) {}
                      }}
                      className="relative w-full p-3 bg-white border-2 border-[#5D4037]/10 rounded-2xl flex items-center justify-between cursor-pointer hover:border-[#FFD54F] transition-all"
                      style={getFontFamily()}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Clock size={15} className="text-[#5D4037]/70 shrink-0" />
                        <span className="font-bold text-[#5D4037] text-sm truncate">
                          {transactionTime || '00:00'}
                        </span>
                      </div>
                      <input
                        ref={timeInputRef}
                        type="time"
                        value={transactionTime}
                        onChange={e => e.target.value && setTransactionTime(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* API Key Setup */}
              {!(import.meta as any).env.VITE_GEMINI_API_KEY && (
                <div className="bg-[#5D4037]/5 p-4 rounded-3xl space-y-2 border border-[#5D4037]/10">
                  <label className="text-[11px] font-bold text-[#5D4037]/70 uppercase tracking-wide block ml-1">Gemini API 金鑰設定</label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={e => setApiKeyInput(e.target.value)}
                      placeholder="輸入 AI 金鑰 (API Key)"
                      className="flex-1 px-3 py-2 bg-white border border-[#5D4037]/10 rounded-xl text-xs font-bold text-[#5D4037] outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSaveApiKey}
                      className="px-4 py-2 bg-[#5D4037] text-white rounded-xl text-xs font-bold active:scale-95 transition-all"
                    >
                      儲存
                    </button>
                  </div>
                  <p className="text-[9px] text-stone-400 font-bold ml-1">金鑰僅會儲存在您的本機瀏覽器，不會外流。</p>
                </div>
              )}

              <button
                type="button"
                onClick={handleParseText}
                disabled={isParsing || !rawText.trim()}
                className="w-full py-4 bg-[#5D4037] text-white rounded-2xl font-black text-base shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isParsing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    AI 智慧解析中...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    開始 AI 智慧拆分
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Step 2 Meta Bar: 扣款帳戶與交易時間微調列 */}
              <div 
                className="bg-white/80 p-3 rounded-2xl border border-[#5D4037]/10 shadow-sm flex items-center justify-between gap-2 text-xs text-[#5D4037]"
                style={getFontFamily()}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-stone-400 shrink-0 font-bold">帳戶：</span>
                  <AiAccountDropdown
                    accounts={accounts}
                    value={selectedAccountId}
                    onChange={setSelectedAccountId}
                    compact={true}
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div 
                    onClick={() => { try { dateInputRef2.current?.showPicker?.(); } catch (_) {} }}
                    className="relative flex items-center gap-1.5 cursor-pointer hover:bg-stone-100 transition-colors bg-stone-50 px-2.5 py-1 rounded-xl border border-stone-200/60 font-bold text-[#5D4037]"
                    title="點擊微調交易日期"
                  >
                    <CalendarIcon size={12} className="text-[#FFD54F]" />
                    <span>{transactionDate.replace(/-/g, '/')}</span>
                    <input 
                      ref={dateInputRef2}
                      type="date"
                      value={transactionDate}
                      onChange={e => e.target.value && setTransactionDate(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </div>
                  <div 
                    onClick={() => { try { timeInputRef2.current?.showPicker?.(); } catch (_) {} }}
                    className="relative flex items-center gap-1.5 cursor-pointer hover:bg-stone-100 transition-colors bg-stone-50 px-2.5 py-1 rounded-xl border border-stone-200/60 font-bold text-[#5D4037]"
                    title="點擊微調交易時間"
                  >
                    <Clock size={12} className="text-[#FFD54F]" />
                    <span>{transactionTime || '00:00'}</span>
                    <input 
                      ref={timeInputRef2}
                      type="time"
                      value={transactionTime}
                      onChange={e => e.target.value && setTransactionTime(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center px-1">
                <span className="text-[12px] font-bold text-[#5D4037]/70">4. 逐筆核對與分類</span>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-3 py-1 bg-white hover:bg-stone-50 border border-[#5D4037]/20 rounded-xl text-xs font-bold text-[#5D4037] active:scale-95 transition-all"
                >
                  ＋ 新增項目
                </button>
              </div>

              {/* Items List */}
              <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1 custom-scrollbar">
                {parsedItems.map((item, index) => (
                  <div
                    key={index}
                    className="bg-white/70 p-3.5 rounded-2xl border border-[#5D4037]/10 flex flex-col gap-3 shadow-sm relative group animate-fade-in"
                  >
                    {/* Delete item button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(index)}
                      className="absolute top-2.5 right-2.5 p-1 text-stone-300 hover:text-rose-500 rounded-full transition-colors"
                    >
                      <X size={16} />
                    </button>

                    <div className="grid grid-cols-5 gap-2 pr-6">
                      {/* Name */}
                      <div className="col-span-3 flex flex-col gap-1">
                        <label className="text-[9px] font-bold text-stone-400">品項名稱</label>
                        <input
                          type="text"
                          value={item.name}
                          onChange={e => handleUpdateItem(index, 'name', e.target.value)}
                          className="w-full px-2 py-1.5 border border-stone-200 rounded-xl text-xs font-bold text-[#5D4037] outline-none"
                        />
                      </div>
                      {/* Amount */}
                      <div className="col-span-2 flex flex-col gap-1">
                        <label className="text-[9px] font-bold text-stone-400">金額</label>
                        <input
                          type="number"
                          value={item.amount}
                          onChange={e => handleUpdateItem(index, 'amount', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 border border-stone-200 rounded-xl text-xs font-bold text-[#5D4037] outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-2.5">
                      {/* Category select */}
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="text-[9px] font-bold text-stone-400 shrink-0">分類：</span>
                        <select
                          value={item.category}
                          onChange={e => handleUpdateItem(index, 'category', e.target.value)}
                          className="bg-white border border-stone-200 rounded-xl px-2 py-1 text-xs font-bold text-[#5D4037] outline-none max-w-[120px] truncate cursor-pointer"
                          style={getFontFamily()}
                        >
                          {targetCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>

                      {/* Project select */}
                      <div className="flex items-center gap-1 min-w-0 z-10 relative">
                        <span className="text-[9px] font-bold text-stone-400 shrink-0">專案：</span>
                        <select
                          value={item.projectId || 'p1'}
                          onChange={e => {
                            e.stopPropagation();
                            handleUpdateItem(index, 'projectId', e.target.value);
                          }}
                          onClick={e => e.stopPropagation()}
                          className="bg-white border border-stone-200 rounded-xl px-2 py-1 text-xs font-bold text-[#5D4037] outline-none cursor-pointer pointer-events-auto max-w-[110px] truncate shadow-sm hover:border-[#FFD54F] transition-all"
                          style={{ ...getFontFamily(), pointerEvents: 'auto' }}
                        >
                          {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Attributable Prepay Switch */}
                      <button
                        type="button"
                        onClick={() => handleUpdateItem(index, 'isPrepay', !item.isPrepay)}
                        className={`px-2.5 py-1 rounded-xl font-black text-xs transition-all border flex items-center gap-1 active:scale-95 shrink-0 ${
                          item.isPrepay
                            ? 'bg-amber-100/80 border-amber-300 text-amber-900 shadow-sm'
                            : 'bg-stone-100 border-stone-200 text-stone-700 hover:bg-stone-200'
                        }`}
                      >
                        <span>{item.isPrepay ? '🏠 代墊' : '🛒 個人'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Live Summary Card */}
              <div className="bg-[#5D4037]/5 p-4 rounded-3xl space-y-2 border border-[#5D4037]/10 text-xs text-[#5D4037]" style={getFontFamily()}>
                <div className="flex justify-between items-center">
                  <span className="font-bold opacity-70">🛒 個人實質支出:</span>
                  <span className="font-black text-[#5D4037] text-sm">NT$ ${(totalDeduction - prepayTotal).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold opacity-70">🏠 家裡代墊金額:</span>
                  <span className="font-black text-amber-800 text-sm">NT$ ${prepayTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center border-t border-[#5D4037]/10 pt-2 font-bold">
                  <span className="opacity-80">💳 信用卡刷卡總額:</span>
                  <span className="text-base font-black text-rose-700">NT$ ${totalDeduction.toLocaleString()}</span>
                </div>
              </div>

              {/* Step 2 Actions */}
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="py-3 bg-white border border-[#5D4037]/20 text-[#5D4037] rounded-2xl font-bold text-xs active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  重新解析
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSave}
                  disabled={isSaving || parsedItems.length === 0}
                  className="col-span-2 py-3 bg-[#5D4037] text-white rounded-2xl font-black text-sm active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      儲存入帳中...
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      確認入帳
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-white/20 text-center border-t border-[#5D4037]/5 flex-shrink-0">
          <p className="text-[9px] font-bold text-[#5D4037]/30 tracking-widest uppercase">AI Smart Split Tool</p>
        </div>
      </motion.div>
    </div>
  );
}

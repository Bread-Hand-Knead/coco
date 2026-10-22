import { getFontFamily } from '../lib/financeUtils';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NumberInput } from '../components/NumberInput';
import {
  ArrowUpDown,
  Banknote,
  Calendar as CalendarIcon,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Clock,
  Delete,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Account, Category, Project, Stock, StockBuyInfo, Template, Transaction } from '../types';
import { findMatchingProjectId } from '../lib/defaults';
import { callGeminiApiWithFallback, filterTaiwanTerms } from '../lib/gemini';
import { HorizontalScrollArea } from '../components/Common';
import { AccountIcon, AccountSelector } from '../components/AccountWidgets';
import { TemplateSortModal } from './SortModals';

export function RecordModal({ accounts, categories, templates, projects, initialProjectId, initialRecord, onUpdateTemplates, onUpdateCategories, onClose, onSave, selectedDate, records, onOpenAiSplit, stocks = [] }: { 
  accounts: Account[], 
  stocks?: Stock[],
  categories: Category[],
  templates: Template[], 
  projects: Project[],
  initialProjectId?: string,
  initialRecord?: Transaction | null,
  onUpdateTemplates: (t: Template[]) => void,
  onUpdateCategories: (c: Category[]) => void,
  onClose: () => void, 
  onSave: (r: any, keepOpen?: boolean) => void,
  selectedDate: string,
  records: Transaction[],
  onOpenAiSplit: (tab: 'expense' | 'income', initialItems?: any[], initialDate?: string, initialTime?: string, initialNote?: string) => void
}) {
  const parseCategoryString = (rawCat?: string) => {
    if (!rawCat) return { main: null, sub: null };
    if (rawCat.includes(' ＞ ')) {
      const parts = rawCat.split(' ＞ ');
      return { main: parts[0].trim(), sub: parts[1]?.trim() || null };
    }
    if (rawCat.includes(' > ')) {
      const parts = rawCat.split(' > ');
      return { main: parts[0].trim(), sub: parts[1]?.trim() || null };
    }
    const catObj = (Array.isArray(categories) ? categories : []).find(c => c.name === rawCat || (c.sub && c?.sub?.includes(rawCat)));
    if (catObj) {
      if (catObj.name === rawCat) {
        return { main: rawCat, sub: null };
      } else {
        return { main: catObj.name, sub: rawCat };
      }
    }
    return { main: rawCat, sub: null };
  };

  const initialCatParsed = useMemo(() => parseCategoryString(initialRecord?.category), [initialRecord, categories]);

  const [tab, setTab] = useState<'template' | 'expense' | 'income' | 'transfer'>(() => {
    if (initialRecord) return initialRecord.type;
    return 'template';
  });
  const [amount, setAmount] = useState(() => {
    if (initialRecord) return Math.abs(initialRecord.amount).toString();
    return '0';
  });
  const [selectedAccountId, setSelectedAccountId] = useState(() => {
    if (initialRecord?.accountId) return initialRecord.accountId;
    return accounts[0]?.id || '';
  });
  const [toAccountId, setToAccountId] = useState(() => {
    if (initialRecord?.toAccountId) return initialRecord.toAccountId;
    return accounts.length > 1 ? accounts[1].id : accounts[0]?.id || '';
  });
  const [mainCategory, setMainCategory] = useState<string | null>(() => initialCatParsed.main);
  const [subCategory, setSubCategory] = useState<string | null>(() => initialCatParsed.sub);
  const [note, setNote] = useState(() => initialRecord?.note || '');
  // 買股票扣款：選哪一檔（'' = 不同步到投資頁；'__new__' = 自己輸入代號）。股數之後在投資頁照對帳單補
  const [stockPick, setStockPick] = useState<string>(() => {
    const sb = initialRecord?.stockBuy;
    if (!sb) return '';
    return sb.stockId && stocks.some(st => st.id === sb.stockId && !st.isDeleted) ? sb.stockId : '__new__';
  });
  const [newStockCode, setNewStockCode] = useState(() => initialRecord?.stockBuy?.code || '');
  const [newStockName, setNewStockName] = useState(() => initialRecord?.stockBuy?.name || '');
  const [fee, setFee] = useState(() => initialRecord?.fee ? initialRecord.fee.toString() : '0');
  const [exchangeRate, setExchangeRate] = useState(() => initialRecord?.exchangeRate ? initialRecord.exchangeRate.toString() : '1');
  const [toAmount, setToAmount] = useState(() => initialRecord?.toAmount ? initialRecord.toAmount.toString() : '0');
  const [isInstallment, setIsInstallment] = useState(false);
  const [isPrepay, setIsPrepay] = useState(() => !!initialRecord?.isPrepay);
  const [totalInstallments, setTotalInstallments] = useState(1);
  const [showCalculator, setShowCalculator] = useState(() => !!initialRecord);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [isTemplateSortOpen, setIsTemplateSortOpen] = useState(false);

  const sortedTemplates = useMemo(() => {
    return [...templates].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }, [templates]);

  // Date and Time: 當前時間點 (今天的日期與現在的時間)
  const [consumptionDate, setConsumptionDate] = useState(() => {
    if (initialRecord) {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
    return selectedDate;
  });
  const [postingDate, setPostingDate] = useState(() => {
    if (initialRecord) {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
    return selectedDate;
  });
  const [postingOrder, setPostingOrder] = useState<number | undefined | null>(initialRecord?.postingOrder);
  // 時間可以不填（例如照銀行明細記帳時，明細上沒有時間）。
  // 上次選了「不填時間」的話，下一筆也預設不填，直到再選一個時間為止。
  const readNoTimePref = () => { try { return localStorage.getItem('coco_record_no_time') === '1'; } catch { return false; } };
  const writeNoTimePref = (on: boolean) => { try { localStorage.setItem('coco_record_no_time', on ? '1' : '0'); } catch { /* 忽略 */ } };
  const nowHHMM = () => { const n = new Date(); return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`; };
  const [consumptionTime, setConsumptionTime] = useState(() => (readNoTimePref() ? '' : nowHHMM()));
  const [isPending, setIsPending] = useState(false);
  const [, setIsDateExpanded] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialRecord?.projectId || initialProjectId || 'p1'
  );
  const dateInputRef = useRef<HTMLInputElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);
  const postingDateInputRef = useRef<HTMLInputElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);

  const handleEditAccountCategory = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setShowCalculator(false);
    if (leftPanelRef.current) {
      leftPanelRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const selectedProject = useMemo(() => {
    return (Array.isArray(projects) ? projects : []).find(p => p.id === selectedProjectId);
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (initialRecord) {
      setTab(initialRecord.type);
      setAmount(Math.abs(initialRecord.amount).toString());
      setSelectedAccountId(initialRecord.accountId || accounts[0]?.id || '');
      if (initialRecord.toAccountId) {
        setToAccountId(initialRecord.toAccountId);
      }
      const parsed = parseCategoryString(initialRecord.category);
      setMainCategory(parsed.main);
      setSubCategory(parsed.sub);
      setNote(initialRecord.note || '');
      setSelectedProjectId(initialRecord.projectId || initialProjectId || 'p1');
      setFee(initialRecord.fee ? initialRecord.fee.toString() : '0');
      setExchangeRate(initialRecord.exchangeRate ? initialRecord.exchangeRate.toString() : '1');
      setToAmount(initialRecord.toAmount ? initialRecord.toAmount.toString() : '0');
      setIsPrepay(!!initialRecord.isPrepay);

      const now = new Date();
      const yyyy = now.getFullYear();
      const MM = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const todayStr = `${yyyy}-${MM}-${dd}`;
      setConsumptionDate(todayStr);
      setPostingDate(todayStr);
      setPostingOrder(initialRecord.postingOrder);
      setConsumptionTime(readNoTimePref() ? '' : `${hh}:${mm}`);
      setShowCalculator(true);
    }
  }, [initialRecord]);

  // 自動同步同名分類與專案 (Auto sync matching category to project)
  useEffect(() => {
    if (!mainCategory) return;
    const fullCatName = subCategory ? `${mainCategory} ＞ ${subCategory}` : mainCategory;
    const matchPid = findMatchingProjectId(fullCatName, projects);
    if (matchPid) {
      setSelectedProjectId(matchPid);
    }
  }, [mainCategory, subCategory, projects]);

  // Ensure currency mode affects new records too
  const [currency, setCurrency] = useState((Array.isArray(accounts) ? accounts : []).find(a => a.id === (tab === 'transfer' ? 'acc1' : 'acc1'))?.currency || 'TWD');

  // For Project Picker Search
  const [isProjectPickerOpen, setIsProjectPickerOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');

  // For Receipt Image Scanning (OCR)
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);

  // For Header Collapsible Bar (Narrow / Split-screen mode)
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);



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
    keyPrefix: string,
    currentTabMode?: string,
    disabledAccountIds?: string[],
    disabledBadgeText?: string
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
        currentTab={currentTabMode || tab}
        disabledAccountIds={disabledAccountIds}
        disabledBadgeText={disabledBadgeText}
      />
    );
  };


  // ─── 台灣電子發票 QR Code 解碼工具 ───────────────────────────────────────

  /** 用 Canvas 從 File 解析出所有 QR Code 原始字串（可能有 1 或 2 個 QR Code） */
  const decodeQRCodesFromImage = async (file: File): Promise<string[]> => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = async () => {
        const MAX_SIZE = 1600;
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > MAX_SIZE || h > MAX_SIZE) {
          const ratio = Math.min(MAX_SIZE / w, MAX_SIZE / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);

        const results: string[] = [];
        const addQr = (data: string | null | undefined) => {
          if (data && !results.includes(data)) {
            results.push(data);
          }
        };

        try {
          const { default: jsQR } = await import('jsqr');

          const scanRegion = (x: number, y: number, rw: number, rh: number) => {
            if (rw <= 0 || rh <= 0) return;
            const imgData = ctx.getImageData(x, y, rw, rh);
            const qr = jsQR(imgData.data, rw, rh);
            if (qr?.data) addQr(qr.data);
          };

          // 先掃描整圖
          scanRegion(0, 0, w, h);

          // 切左右與下半區域加強辨識
          if (results.length < 2) {
            const halfW = Math.floor(w / 2);
            const halfH = Math.floor(h / 2);

            scanRegion(0, 0, halfW, h);
            scanRegion(halfW, 0, w - halfW, h);
            scanRegion(0, halfH, w, h - halfH);
            scanRegion(0, halfH, halfW, h - halfH);
            scanRegion(halfW, halfH, w - halfW, h - halfH);
          }

          // 對比度強化/二值化掃描備援
          if (results.length < 2) {
            const imgData = ctx.getImageData(0, 0, w, h);
            const d = imgData.data;
            for (let i = 0; i < d.length; i += 4) {
              const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
              const val = avg > 128 ? 255 : 0;
              d[i] = val;
              d[i + 1] = val;
              d[i + 2] = val;
            }
            const binarizedQr = jsQR(d, w, h);
            if (binarizedQr?.data) addQr(binarizedQr.data);
          }
        } catch (_e) {
          // jsQR 載入失敗或掃描失敗，回傳已辨識到的結果
        }
        resolve(results);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve([]); };
      img.src = url;
    });
  };

  /** 判斷是否為台灣電子發票左側 QR Code（開頭為發票字軌 2 碼大寫英文 + 8 碼數字） */
  const isLeftInvoiceQR = (raw: string): boolean =>
    /^[A-Z]{2}\d{8}/.test(raw) && raw.length >= 40;

  /** 判斷是否為台灣電子發票右側 QR Code（** 開頭） */
  const isRightInvoiceQR = (raw: string): boolean => raw.startsWith('**');

  /**
   * 解析台灣電子發票 QR Code
   * 左側格式（前 77 碼固定欄位）：
   *   [0:10]  發票號碼
   *   [10:17] 民國年月日 YYYMMDD
   *   [17:21] 隨機碼
   *   [21:29] 未稅銷售額 hex
   *   [29:37] 含稅總計 hex
   *   [37:45] 買方統編
   *   [45:53] 賣方統編
   *   [53:77] AES 驗證碼 Base64
   *   [77+]   :********** (可選備註分隔符) :品項件數:總品項數:編碼格式 :品名:數量:單價...
   * 右側格式：**品名:數量:單價...
   */
  interface EInvoiceParseResult {
    invoiceNo: string;      // 發票號碼（帶格式，如 AB-12345678）
    date: string;           // 西元日期 YYYY-MM-DD
    taxExcluded: number;    // 未稅金額
    total: number;          // 含稅總計
    sellerTaxId: string;    // 賣方統編
    buyerTaxId: string;     // 買方統編
    items: Array<{ name: string; qty: number; unitPrice: number; amount: number }>;
  }

  const parseEInvoiceQRCodes = (qrStrings: string[]): EInvoiceParseResult | null => {
    const leftRaw = qrStrings.find(isLeftInvoiceQR);
    const rightRaw = qrStrings.find(isRightInvoiceQR);
    if (!leftRaw) return null;

    try {
      const invoiceNo = leftRaw.slice(0, 10); // e.g. AB12345678
      const rocDate = leftRaw.slice(10, 17);  // YYYMMDD（民國年 3 碼）
      const taxExHex = leftRaw.slice(21, 29);
      const totalHex = leftRaw.slice(29, 37);
      const buyerTaxId = leftRaw.slice(37, 45).trim();
      const sellerTaxId = leftRaw.slice(45, 53).trim();

      // 民國年轉西元
      const rocYear = parseInt(rocDate.slice(0, 3), 10);
      const month = rocDate.slice(3, 5);
      const day = rocDate.slice(5, 7);
      const adYear = rocYear + 1911;
      const date = `${adYear}-${month}-${day}`;

      // hex 轉 10 進位金額
      const taxExcluded = parseInt(taxExHex, 16) || 0;
      const total = parseInt(totalHex, 16) || 0;

      const items: EInvoiceParseResult['items'] = [];

      // ── 解析左側 QR Code 商品明細 ──
      if (leftRaw.length > 77) {
        const after77 = leftRaw.slice(77);
        const tokens = after77.split(':').map(s => s.trim());
        while (tokens.length > 0 && tokens[0] === '') {
          tokens.shift();
        }

        // 跳過 '**********' 備註區段分隔符
        if (tokens.length > 0 && /^\*+$/.test(tokens[0])) {
          tokens.shift();
        }

        // 檢查前 3 個欄位是否為二維條碼元資料 [itemCount, totalCount, encoding]
        if (tokens.length >= 3) {
          const t0Num = parseInt(tokens[0], 10);
          const t1Num = parseInt(tokens[1], 10);
          const t2Num = parseInt(tokens[2], 10);
          if (!isNaN(t0Num) && !isNaN(t1Num) && !isNaN(t2Num) && t2Num >= 1 && t2Num <= 3 && t0Num < 100 && t1Num < 100) {
            tokens.splice(0, 3); // 跳過元資料標頭
          }
        }

        // 依序解析 [品名, 數量, 單價]
        for (let i = 0; i + 2 < tokens.length; i += 3) {
          const name = tokens[i];
          const qty = parseFloat(tokens[i + 1]);
          const unitPrice = parseFloat(tokens[i + 2]);
          if (name && !/^\*+$/.test(name) && !isNaN(qty) && !isNaN(unitPrice)) {
            items.push({
              name,
              qty: qty || 1,
              unitPrice: unitPrice || 0,
              amount: Math.round((qty || 1) * (unitPrice || 0))
            });
          }
        }
      }

      // ── 解析右側 QR Code 商品明細 ──
      if (rightRaw) {
        let rightText = rightRaw.startsWith('**') ? rightRaw.slice(2) : rightRaw;
        if (rightText.startsWith(':')) rightText = rightText.slice(1);
        const tokens = rightText.split(':').map(s => s.trim()).filter(Boolean);

        for (let i = 0; i + 2 < tokens.length; i += 3) {
          const name = tokens[i];
          const qty = parseFloat(tokens[i + 1]);
          const unitPrice = parseFloat(tokens[i + 2]);
          if (name && !/^\*+$/.test(name) && !isNaN(qty) && !isNaN(unitPrice)) {
            items.push({
              name,
              qty: qty || 1,
              unitPrice: unitPrice || 0,
              amount: Math.round((qty || 1) * (unitPrice || 0))
            });
          }
        }
      }

      return {
        invoiceNo: `${invoiceNo.slice(0, 2)}-${invoiceNo.slice(2)}`, // AB-12345678
        date,
        taxExcluded,
        total,
        sellerTaxId,
        buyerTaxId,
        items,
      };
    } catch (_e) {
      return null;
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  const handleScanReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningReceipt(true);

    try {
      // ── 第一步：優先嘗試台灣電子發票 QR Code 解碼 ──────────────────────────
      const qrStrings = await decodeQRCodesFromImage(file);
      const invoiceData = parseEInvoiceQRCodes(qrStrings);

      const targetCats = categories.filter(c => c.type === (tab === 'income' ? 'income' : 'expense'));
      const catList: string[] = [];
      targetCats.forEach(cat => {
        catList.push(cat.name);
        if (cat.sub && cat.sub.length > 0) {
          cat.sub.forEach(sub => catList.push(`${cat.name} > ${sub}`));
        }
      });
      const defaultCat = catList[0] || '其他';

      if (invoiceData && invoiceData.items.length > 0) {
        // ✅ QR Code 解析包含完整的商品明細 → 直接帶入，無須呼叫 Gemini
        const items = invoiceData.items.map(it => {
          const matchPid = findMatchingProjectId(defaultCat, projects);
          return {
            name: filterTaiwanTerms(it.name),
            amount: it.amount,
            category: defaultCat,
            projectId: matchPid || undefined,
            isPrepay: false,
          };
        });

        if (items.length > 0) {
          onOpenAiSplit(
            tab === 'income' ? 'income' : 'expense',
            items,
            invoiceData.date,
            undefined,
            `電子發票 ${invoiceData.invoiceNo}`,
          );
          return;
        }
      }

      // ── 第二步：若 QR Code 無明細（例如 7-11 紙本發票）或未掃到 QR Code → 使用 Gemini AI 視覺辨識 ──
      const key = (import.meta as any).env.VITE_GEMINI_API_KEY || localStorage.getItem('gemini_api_key') || '';
      if (!key.trim()) {
        if (invoiceData) {
          // 沒有 API Key 但有 QR Code 總額資料
          const matchPid = findMatchingProjectId(defaultCat, projects);
          onOpenAiSplit(
            tab === 'income' ? 'income' : 'expense',
            [{
              name: `電子發票 ${invoiceData.invoiceNo}`,
              amount: invoiceData.total,
              category: defaultCat,
              projectId: matchPid || undefined,
              isPrepay: false,
            }],
            invoiceData.date,
            undefined,
            `電子發票 ${invoiceData.invoiceNo}`
          );
          return;
        }
        alert('請先設定 Gemini API 金鑰！');
        onOpenAiSplit(tab === 'income' ? 'income' : 'expense');
        return;
      }

      // Convert File to Base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const res = ev.target?.result as string;
          const b64 = res.split(',')[1] || res;
          resolve(b64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const typeText = tab === 'income' ? '收入' : '支出';
      const categoriesString = catList.length > 0 ? catList.join('\n') : '其他';

      const prompt = `你是一個專業的記帳與發票解析助理。請幫我解析這張發票、收據或交易明細圖片，將圖片中的所有購買品項與折抵項目拆分為多個獨立品項，並同時自動提取發票上的交易日期與時間。

可用${typeText}分類清單（請務必從以下清單中選擇最符合的填入，若不符合填「其他」）：
${categoriesString}

【核心拆分規則】
1. 嚴格 1:1 逐行完整擷取（Strict Line-by-Line Extraction）：
   - 發票/收據/明細畫面上出現的所有購買品項與所有折抵扣減項目，務必逐行完整擷取，絕對禁止自行合併（例如絕對不要寫成「7-ELEVEN消費總計」或「消費總計」）！
   - 包含促銷折扣、買一送一折抵、折價券、折扣碼、點數折抵、禮券折抵等負數金額項目，皆必須獨立作為一筆品項行。
2. 負數折抵金額處理：
   - 折扣/折抵/促銷/買一送一/折價券等扣減金額品項，其 "amount" 欄位必須為負數金額（例如 -59、-5）。
   - 正數商品品項金額為正數（例如 30、118）。
3. 品項名稱請統一使用台灣繁體中文慣用語。

請輸出一個標準 JSON 物件，不可以包含任何 Markdown 標籤或前導後導文字：
{
  "date": "2026-09-09", // 發票/交易日期，若未提及填 null
  "time": "17:35", // 24小時制 HH:mm，若未提及填 null
  "items": [
    {
      "name": "薯泥鮮蔬蛋沙拉",
      "amount": 60,
      "category": "選擇的分類",
      "isPrepay": false
    },
    {
      "name": "(區)現蒸地瓜40元",
      "amount": 40,
      "category": "選擇的分類",
      "isPrepay": false
    }
  ]
}`;

      const requestBody = {
        contents: [{
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: file.type || "image/jpeg",
                data: base64Data
              }
            }
          ]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      };

      try {
        const resJson = await callGeminiApiWithFallback(key, requestBody);
        const responseText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
        if (responseText) {
          const cleanText = responseText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
          const parsedResult = JSON.parse(cleanText);

          let rawItems: any[] = [];
          let extractedTime: string | undefined = undefined;
          let extractedDate: string | undefined = undefined;

          if (Array.isArray(parsedResult)) {
            rawItems = parsedResult;
          } else if (parsedResult && typeof parsedResult === 'object') {
            if (Array.isArray(parsedResult.items)) rawItems = parsedResult.items;
            if (typeof parsedResult.time === 'string' && parsedResult.time.trim() && parsedResult.time !== 'null') extractedTime = parsedResult.time.trim();
            if (typeof parsedResult.date === 'string' && parsedResult.date.trim() && parsedResult.date !== 'null') extractedDate = parsedResult.date.trim();
          }

          const items = rawItems.map((item: any) => {
            const cat = catList.includes(item.category) ? item.category : (catList[0] || '其他');
            const matchPid = findMatchingProjectId(cat, projects);
            const parsedAmt = parseInt(item.amount, 10);
            return {
              name: filterTaiwanTerms(item.name || '未命名項目'),
              amount: isNaN(parsedAmt) ? 0 : parsedAmt,
              category: cat,
              projectId: matchPid || undefined,
              isPrepay: !!item.isPrepay
            };
          }).filter((item: any) => item.name && item.amount !== 0);

          if (items.length > 0) {
            onOpenAiSplit(
              tab === 'income' ? 'income' : 'expense',
              items,
              extractedDate || invoiceData?.date,
              extractedTime,
              invoiceData ? `電子發票 ${invoiceData.invoiceNo}` : undefined
            );
            return;
          }
        }
      } catch (geminiErr) {
        console.warn("Gemini API call failed during receipt scan:", geminiErr);
      }

      // ── 第三步：若 Gemini 辨識無品項且有 QR Code 總額 metadata，保底帶入發票號碼與總金額 ──
      if (invoiceData) {
        const matchPid = findMatchingProjectId(defaultCat, projects);
        onOpenAiSplit(
          tab === 'income' ? 'income' : 'expense',
          [{
            name: `電子發票 ${invoiceData.invoiceNo}`,
            amount: invoiceData.total,
            category: defaultCat,
            projectId: matchPid || undefined,
            isPrepay: false,
          }],
          invoiceData.date,
          undefined,
          `電子發票 ${invoiceData.invoiceNo}`
        );
      } else {
        alert('無法解析此發票圖片中的品項，請確認照片是否清晰。');
      }

    } catch (err: any) {
      console.error("Scan Error:", err);
      const rawMsg = err?.message || '';
      let displayMsg = rawMsg;
      if (rawMsg.includes('503') || rawMsg.includes('429') || rawMsg.toLowerCase().includes('high demand') || rawMsg.toLowerCase().includes('unavailable') || rawMsg.includes('伺服器忙碌')) {
        displayMsg = '目前伺服器忙碌中，請稍候片刻再試';
      } else if (rawMsg.includes('API 請求失敗') || rawMsg.includes('{') || rawMsg.includes('}')) {
        displayMsg = '請求服務失敗，請稍後再試。';
      }
      alert("發票辨識失敗：" + displayMsg);
    } finally {
      setIsScanningReceipt(false);
      e.target.value = '';
    }
  };


  // Check if current account is credit card
  const isCreditCard = useMemo(() => {
    const acc = (Array.isArray(accounts) ? accounts : []).find(a => a.id === selectedAccountId);
    return acc?.type === 'credit';
  }, [selectedAccountId, accounts]);

  // Reset expansion state when switching to non-credit card accounts
  useEffect(() => {
    if (!isCreditCard) {
      setIsDateExpanded(true);
    }
  }, [isCreditCard]);

  const currentAccount = (Array.isArray(accounts) ? accounts : []).find(a => a.id === selectedAccountId);
  const currentToAccount = (Array.isArray(accounts) ? accounts : []).find(a => a.id === toAccountId);

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
      type: tab === 'transfer' ? 'transfer' : (tab === 'income' ? 'income' : 'expense'),
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

  const currentMainCat = (Array.isArray(categories) ? categories : []).find(c => c.name === mainCategory);

  const filteredCategories = categories.filter(c => {
    if (tab === 'expense') return c.type === 'expense';
    if (tab === 'income') return c.type === 'income';
    if (tab === 'transfer') return c.type === 'transfer';
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

    const resolvedType = (tab === 'template' ? 'expense' : tab);
    if (resolvedType === 'transfer' && selectedAccountId && toAccountId && selectedAccountId === toAccountId) {
      alert('⚠️ 轉出與轉入不可為同一個帳戶，請選擇不同帳戶！');
      return;
    }

    const catName = subCategory ? (mainCategory ? `${mainCategory} ＞ ${subCategory}` : subCategory) : (mainCategory || (resolvedType === 'transfer' ? '轉帳' : '其他'));
    const cat = (Array.isArray(categories) ? categories : []).find(c => c.name === catName || c?.sub?.includes(catName));

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

    if (resolvedType === 'transfer' && selectedAccountId && toAccountId && selectedAccountId === toAccountId) {
      alert('⚠️ 轉出與轉入不可為同一個帳戶，請選擇不同帳戶！');
      return;
    }

    const finalAmount = (resolvedType === 'expense' || resolvedType === 'transfer') ? -Math.abs(rawAmt) : Math.abs(rawAmt);
    
    onSave({ 
      amount: finalAmount, 
      fee: finalFee,
      category: subCategory ? (mainCategory ? `${mainCategory} ＞ ${subCategory}` : subCategory) : (mainCategory || (resolvedType === 'transfer' ? '轉帳' : '其他')), 
      note: note.trim() || undefined,
      type: resolvedType, 
      accountId: selectedAccountId, 
      toAccountId: resolvedType === 'transfer' ? toAccountId : undefined, 
      toAmount: resolvedType === 'transfer' ? (parseFloat(toAmount) || Math.abs(finalAmount) * rate) : undefined,
      exchangeRate: resolvedType === 'transfer' ? rate : undefined,
      date: consumptionDate,
      time: consumptionTime || undefined,
      postingDate: isPending ? undefined : postingDate,
      isPending: isPending,
      isInstallment,
      isPrepay: (tab === 'expense' || tab === 'income') ? isPrepay : undefined,
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
    setIsPrepay(false);
    setTotalInstallments(1);
    setConsumptionDate(selectedDate);
    setPostingDate(selectedDate);
    setPostingOrder(undefined);
    setIsPending(false);
    setSelectedProjectId(initialProjectId || 'p1');
  };

  // 分類是投資相關（或錢轉進證券戶）時，顯示「買了哪一檔」
  const showStockPicker = (tab === 'expense' || tab === 'transfer') && (
    /投資|定期定額|股票|基金|ETF/i.test(`${mainCategory || ''} ${subCategory || ''}`) ||
    accounts.find(a => a.id === (tab === 'transfer' ? toAccountId : selectedAccountId))?.type === 'investment'
  );
  const stockOptions = useMemo(() => {
    const seen = new Set<string>();
    return (Array.isArray(stocks) ? stocks : [])
      .filter(st => !st.isDeleted)
      .map(st => ({ id: st.id, code: st.code, broker: accounts.find(a => a.id === st.linkedAccount)?.name || '' }))
      .filter(st => { const k = st.code + '|' + st.broker; if (seen.has(k)) return false; seen.add(k); return true; });
  }, [stocks, accounts]);

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

      if (resolvedType === 'transfer' && selectedAccountId && toAccountId && selectedAccountId === toAccountId) {
        alert('⚠️ 轉出與轉入不可為同一個帳戶，請選擇不同帳戶！');
        return;
      }

      const finalAmount = (resolvedType === 'expense' || resolvedType === 'transfer') ? -Math.abs(rawAmt) : Math.abs(rawAmt);
      
      // 買股票扣款（選了股票才帶）：證券帳戶 = 支出的扣款帳戶，或轉帳的轉入帳戶
      let stockBuy: StockBuyInfo | undefined;
      if (showStockPicker && stockPick) {
        const picked = stocks.find(st => st.id === stockPick);
        const [pCode, ...pName] = (picked?.code || '').trim().split(/\s+/);
        const code = picked ? pCode : newStockCode.trim().toUpperCase();
        if (code) {
          stockBuy = {
            code,
            name: picked ? (pName.join(' ') || undefined) : (newStockName.trim() || undefined),
            stockId: picked?.id,
            brokerAccountId: resolvedType === 'transfer' ? toAccountId : selectedAccountId,
          };
        }
      }

      onSave({ 
        stockBuy,
        amount: finalAmount, 
        fee: finalFee,
        category: subCategory ? (mainCategory ? `${mainCategory} ＞ ${subCategory}` : subCategory) : (mainCategory || (resolvedType === 'transfer' ? '轉帳' : '其他')), 
        note: note.trim() || (stockBuy ? `投資 ${stockBuy.code}${stockBuy.name ? ' ' + stockBuy.name : ''}` : undefined),
        type: resolvedType, 
        accountId: selectedAccountId, 
        toAccountId: resolvedType === 'transfer' ? toAccountId : undefined, 
        toAmount: resolvedType === 'transfer' ? (parseFloat(toAmount) || Math.abs(finalAmount) * rate) : undefined,
        exchangeRate: resolvedType === 'transfer' ? rate : undefined,
        date: consumptionDate,
        time: consumptionTime || undefined,
        postingDate: isPending ? undefined : postingDate,
        postingOrder: isPending ? undefined : postingOrder,
        isPending: isPending,
        isInstallment,
        isPrepay: (tab === 'expense' || tab === 'income') ? isPrepay : undefined,
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

  // 實體鍵盤也能操作計算機（電腦版）：
  // 數字、小數點、+ - * /、Enter 或 = 計算、Backspace 退一格、Delete 清除、Ctrl/⌘+Enter 直接儲存。
  // 正在備註、搜尋等輸入框裡打字時不攔截，避免打字被當成金額。
  const handleKeyRef = useRef(handleKey);
  handleKeyRef.current = handleKey;
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      if (e.altKey || e.isComposing) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleKeyRef.current('SAVE'); return; }
      if (e.ctrlKey || e.metaKey) return;
      const map: Record<string, string> = {
        '+': '+', '-': '-', '*': '×', 'x': '×', 'X': '×', '/': '÷',
        '.': '.', ',': '.', '=': '=', 'Enter': '=',
        'Backspace': 'BACKSPACE', 'Delete': 'AC',
      };
      const key = /^[0-9]$/.test(e.key) ? e.key : map[e.key];
      if (!key) return;
      e.preventDefault();
      handleKeyRef.current(key);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleApplyTemplate = (t: Template) => {
    // 1. 自動帶入類型與基本資料
    setTab(t.type);
    setAmount(t.amount.toString());
    setNote(t.note || '');
    
    // 2. 處理分類邏輯
    // 嘗試在現有分類列表中尋找匹配項
    const catName = t.category;
    const catObj = (Array.isArray(categories) ? categories : []).find(c => c.name === catName || (c.sub && c?.sub?.includes(catName)));
    
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

    if (editingTemplate.type === 'transfer' && editingTemplate.fromAccountId && editingTemplate.toAccountId && editingTemplate.fromAccountId === editingTemplate.toAccountId) {
      alert('⚠️ 轉出與轉入不可為同一個帳戶，請選擇不同帳戶！');
      return;
    }
    
    const finalTemplate = {
      ...editingTemplate,
      amount: parseFloat(editingTemplate.amount as any) || 0
    };

    const exists = (Array.isArray(templates) ? templates : []).find(t => t.id === finalTemplate.id);
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

  const renderCompactBar = () => (
    <div 
      className="w-full h-11 bg-[#FFFDF5] rounded-2xl border-2 border-[#5D4037]/10 shadow-sm flex items-center divide-x divide-stone-200/80 overflow-hidden text-[#5D4037] select-none shrink-0"
      style={{ ...getFontFamily(), whiteSpace: 'nowrap' }}
    >
      {/* 1. 日期選擇區塊 */}
      <div 
        onClick={() => {
          try {
            dateInputRef.current?.showPicker?.();
          } catch (_) {}
        }}
        className="relative flex-1 h-full flex items-center justify-center gap-1.5 px-2 hover:bg-stone-50/80 active:bg-stone-100 transition-colors cursor-pointer min-w-0"
        title="點擊選擇消費日期"
      >
        <CalendarIcon size={14} className="text-[#FFD54F] shrink-0" />
        <span className="text-xs sm:text-sm font-bold text-[#5D4037] truncate whitespace-nowrap">
          {consumptionDate.replace(/-/g, '/')}
        </span>
        <input 
          ref={dateInputRef}
          type="date"
          value={consumptionDate}
          onChange={e => {
            if (e.target.value) {
              setConsumptionDate(e.target.value);
              setPostingDate(e.target.value);
            }
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>

      {/* 2. 時間選擇區塊 */}
      <div 
        onClick={() => {
          try {
            timeInputRef.current?.showPicker?.();
          } catch (_) {}
        }}
        className="relative flex-1 h-full flex items-center justify-center gap-1.5 px-2 hover:bg-stone-50/80 active:bg-stone-100 transition-colors cursor-pointer min-w-0"
        title="點擊選擇消費時間"
      >
        <Clock size={14} className="text-[#FFD54F] shrink-0" />
        <span className={`text-xs sm:text-sm font-bold truncate whitespace-nowrap ${consumptionTime ? 'text-[#5D4037]' : 'text-stone-500'}`}>
          {consumptionTime || '不填時間'}
        </span>
        <input 
          ref={timeInputRef}
          type="time"
          value={consumptionTime}
          onChange={e => {
            if (e.target.value) {
              setConsumptionTime(e.target.value);
              writeNoTimePref(false);
            }
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        {consumptionTime && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setConsumptionTime(''); writeNoTimePref(true); }}
            className="relative z-10 w-5 h-5 shrink-0 rounded-full bg-stone-100 text-stone-500 text-[11px] font-black flex items-center justify-center active:scale-90"
            aria-label="不填時間"
            title="不填時間"
          >
            ✕
          </button>
        )}
      </div>

      {/* 3. 專案選擇區塊 */}
      <button 
        type="button"
        onClick={() => setIsProjectPickerOpen(true)}
        className="flex-1 h-full flex items-center justify-center gap-1.5 px-2 hover:bg-[#FFD54F]/10 active:bg-[#FFD54F]/20 transition-colors cursor-pointer min-w-0 text-left outline-none"
        title="點擊選擇所屬專案"
      >
        <div className="shrink-0 flex items-center justify-center text-sm">
          {selectedProject?.icon ? (
            <AccountIcon icon={selectedProject.icon} sizeClassName="w-3.5 h-3.5" />
          ) : (
            <Layers size={13} className="text-[#FFD54F]" />
          )}
        </div>
        <span className="text-xs sm:text-sm font-bold text-[#5D4037] truncate whitespace-nowrap">
          {selectedProject?.name || '無特別專案'}
        </span>
      </button>
    </div>
  );

  const renderCreditCardSubBar = () => {
    if (!isCreditCard || (tab !== 'expense' && tab !== 'income')) return null;
    return (
      <div 
        className="w-full flex items-center justify-between px-3 py-1 bg-amber-50/70 rounded-xl border border-amber-200/50 text-[11px] font-bold text-[#5D4037] shrink-0"
        style={getFontFamily()}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Banknote size={12} className="text-[#FFD54F] shrink-0" />
          <span className="shrink-0">入帳日：</span>
          <span className={isPending ? 'text-orange-500 font-black' : 'font-bold truncate'}>
            {isPending ? '待入帳' : postingDate.replace(/-/g, '/')}
          </span>
          {!isPending && (
            <label 
              onClick={() => {
                try {
                  postingDateInputRef.current?.showPicker?.();
                } catch (_) {}
              }}
              className="relative cursor-pointer text-stone-400 hover:text-[#5D4037] underline text-[10px] ml-1 shrink-0"
            >
              <span>修改</span>
              <input 
                ref={postingDateInputRef}
                type="date" 
                value={postingDate}
                onChange={e => e.target.value && setPostingDate(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </label>
          )}
          {!isPending && (
            <div className="flex items-center gap-1 ml-2 shrink-0">
              <span className="text-[10px] text-stone-400">序號:</span>
              <input 
                type="number"
                min="1"
                placeholder="序號"
                value={postingOrder ?? ''}
                onChange={e => {
                  const val = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                  setPostingOrder((val !== undefined && !isNaN(val)) ? val : undefined);
                }}
                className="w-12 px-1 py-0.5 bg-white border border-stone-200 rounded text-center text-xs font-bold text-[#5D4037] outline-none focus:border-[#FFD54F]"
                style={getFontFamily()}
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <span className="text-[10px] text-stone-500">待入帳</span>
          <button 
            type="button"
            onClick={() => setIsPending(!isPending)}
            className={`w-7 h-3.5 rounded-full transition-all relative ${isPending ? 'bg-orange-400' : 'bg-stone-300'}`}
          >
            <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full shadow-sm transition-all ${isPending ? 'left-3.5' : 'left-0.5'}`} />
          </button>
        </div>
      </div>
    );
  };

  const renderCollapsibleHeaderSummary = () => (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="w-full bg-[#FFFDF5] hover:bg-[#FFF9E6] transition-all rounded-2xl border-2 border-[#5D4037]/15 shadow-sm p-2 flex items-center justify-between text-[#5D4037] cursor-pointer select-none"
      style={getFontFamily()}
    >
      <div 
        onClick={() => setIsHeaderCollapsed(false)}
        className="flex items-center gap-2 flex-1 min-w-0 pr-2"
        title="點擊展開修改日期、時間與專案"
      >
        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold truncate">
          <span className="flex items-center gap-1 shrink-0 text-[#5D4037]">
            <CalendarIcon size={14} className="text-[#FFD54F]" />
            {consumptionDate.replace(/-/g, '/')}
          </span>
          <span className="text-stone-300 font-normal">｜</span>
          <span className="flex items-center gap-1 shrink-0 text-[#5D4037]">
            <Clock size={14} className="text-[#FFD54F]" />
            {consumptionTime || '不填時間'}
          </span>
          <span className="text-stone-300 font-normal">｜</span>
          <span className="flex items-center gap-1 truncate text-[#5D4037]">
            {selectedProject?.icon ? (
              <AccountIcon icon={selectedProject.icon} sizeClassName="w-3.5 h-3.5" />
            ) : (
              <Layers size={13} className="text-[#FFD54F]" />
            )}
            <span className="truncate">{selectedProject?.name || '預設專案'}</span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {tab !== 'transfer' && (
          <>
            {/* 按鈕一：📷 發票掃描（相機/圖片） */}
            <label 
              onClick={(e) => e.stopPropagation()} 
              className="px-2.5 py-1.5 bg-[#E0F2FE] hover:bg-[#BAE6FD] active:scale-95 transition-all rounded-xl border border-[#0284C7]/40 shadow-sm flex items-center justify-center cursor-pointer text-[#0369A1] gap-1"
              title="📷 發票掃描（拍照/圖片上傳）"
            >
              <input 
                type="file" 
                accept="image/*" 
                capture="environment"
                className="hidden" 
                onChange={handleScanReceipt} 
                disabled={isScanningReceipt}
              />
              {isScanningReceipt ? (
                <Loader2 className="w-3.5 h-3.5 text-[#0369A1] animate-spin" />
              ) : (
                <Camera size={14} className="text-[#0369A1]" />
              )}
              <span className="text-xs font-black">📷 掃描</span>
            </label>

            {/* 按鈕二：✨ AI 智慧解析（純文字貼上） */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenAiSplit(tab === 'income' ? 'income' : 'expense');
              }}
              className="px-2.5 py-1.5 bg-[#FFF3C4] hover:bg-[#FFE082] active:scale-95 transition-all rounded-xl border border-[#FFB300]/40 shadow-sm flex items-center justify-center cursor-pointer text-[#8D6E63] gap-1"
              title="✨ AI 智慧解析（貼上明細文字）"
            >
              <Sparkles size={14} className="text-[#D97706]" />
              <span className="text-xs font-black">✨ 文字解析</span>
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => setIsHeaderCollapsed(false)}
          className="p-1.5 bg-stone-100 hover:bg-stone-200 active:scale-95 rounded-xl transition-all text-stone-600 flex items-center justify-center"
          title="點擊展開完整選項"
        >
          <ChevronDown size={16} />
        </button>
      </div>
    </motion.div>
  );

  const renderDateProjectCamera = () => {
    if (isHeaderCollapsed) {
      return renderCollapsibleHeaderSummary();
    }

    return (
      <motion.div 
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2 }}
        className="w-full flex flex-col gap-2"
      >
        <div className="flex items-center justify-between gap-2 w-full">
          {tab !== 'transfer' ? (
            <div className="flex items-center gap-2 flex-1">
              {/* 按鈕一：📷 發票掃描（相機拍攝/圖片上傳） */}
              <label className="flex-1 h-10 px-2.5 bg-[#E0F2FE] hover:bg-[#BAE6FD] active:scale-95 transition-all rounded-2xl border-2 border-[#0284C7]/40 shadow-sm flex items-center justify-center gap-1.5 cursor-pointer relative overflow-hidden text-[#0369A1]">
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment"
                  className="hidden" 
                  onChange={handleScanReceipt} 
                  disabled={isScanningReceipt}
                />
                {isScanningReceipt ? (
                  <>
                    <Loader2 className="w-4 h-4 text-[#0369A1] animate-spin" />
                    <span className="text-xs font-black" style={getFontFamily()}>辨識中...</span>
                  </>
                ) : (
                  <>
                    <Camera size={16} className="text-[#0369A1]" />
                    <span className="text-xs font-black" style={getFontFamily()}>📷 發票掃描</span>
                  </>
                )}
              </label>

              {/* 按鈕二：✨ AI 智慧解析（純文字貼上解析） */}
              <button
                type="button"
                onClick={() => onOpenAiSplit(tab === 'income' ? 'income' : 'expense')}
                className="flex-1 h-10 px-2.5 bg-[#FFF3C4] hover:bg-[#FFE082] active:scale-95 transition-all rounded-2xl border-2 border-[#FFB300]/40 shadow-sm flex items-center justify-center gap-1.5 cursor-pointer text-[#8D6E63]"
                title="點擊貼上載具或電子發票明細文字進行 AI 拆分"
              >
                <Sparkles size={16} className="text-[#D97706]" />
                <span className="text-xs font-black" style={getFontFamily()}>✨ AI 智慧解析</span>
              </button>
            </div>
          ) : <div className="flex-1" />}

          <button
            type="button"
            onClick={() => setIsHeaderCollapsed(true)}
            className="h-10 px-2.5 bg-stone-100 hover:bg-stone-200 active:scale-95 transition-all rounded-2xl border border-stone-200 text-stone-600 flex items-center gap-1 text-xs font-bold shrink-0"
            title="縮回精簡摘要模式"
          >
            <ChevronUp size={16} />
            <span className="hidden sm:inline">收合</span>
          </button>
        </div>
        <div className="w-full">
          {renderCompactBar()}
        </div>
        {renderCreditCardSubBar()}
      </motion.div>
    );
  };

  const renderCalculator = () => (
    <>
      {/* Confirmation Status Bar */}
      <div 
        onClick={handleEditAccountCategory}
        className="bg-stone-100 hover:bg-stone-200/80 active:bg-stone-200 px-4 py-2.5 rounded-xl flex items-center justify-between cursor-pointer transition-colors shadow-xs group"
        title="點擊編輯重新選擇帳戶與分類"
        style={getFontFamily()}
      >
        <div className="flex items-center gap-1.5 text-[18px] sm:text-[20px] font-bold text-[#5D4037] overflow-hidden whitespace-nowrap">
          <span className="text-[#5D4037] font-black">{currentAccount?.name}</span>
          <span className="text-stone-400 font-bold">&gt;</span>
          {tab === 'transfer' ? (
            <>
              <span className="text-[#5D4037] font-black">{currentToAccount?.name}</span>
              {(mainCategory || subCategory) && (
                <span className="text-xs text-stone-600 ml-1 bg-stone-200/80 px-2 py-0.5 rounded-full font-bold">
                  {subCategory ? (mainCategory ? `${mainCategory} ＞ ${subCategory}` : subCategory) : mainCategory}
                </span>
              )}
            </>
          ) : (
            <>
              <span className="text-[#5D4037] font-black">{mainCategory}</span>
              <span className="text-stone-400 font-bold">&gt;</span>
              <span className="text-[#5D4037] font-black">{subCategory}</span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={handleEditAccountCategory}
          className="px-2.5 py-1 bg-white hover:bg-amber-50 active:scale-95 border border-stone-200/80 rounded-lg text-xs font-bold text-[#5D4037] flex items-center gap-1 shrink-0 shadow-xs cursor-pointer group-hover:border-[#FFD54F] transition-all"
          title="點擊修改帳戶、分類或專案"
          style={getFontFamily()}
        >
          <span>編輯</span>
          <Pencil size={12} className="text-[#5D4037]" />
        </button>
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
          <div className="mx-6 flex flex-col gap-2 md:hidden shrink-0">
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
              <div ref={leftPanelRef} className={`flex-col gap-5 overflow-y-auto pr-1 md:pr-2 min-h-0 ${showCalculator ? 'hidden md:flex' : 'flex'}`}>


                {/* Date & Project & Camera Selection Area (Desktop only) */}
                <div className="hidden md:flex flex-col gap-2 shrink-0 w-full">
                  {renderDateProjectCamera()}
                </div>

                {/* Step 1: Account Selection */}
                {tab === 'transfer' ? (
                  <div className="space-y-4">
                    {selectedAccountId && toAccountId && selectedAccountId === toAccountId && (
                      <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-center gap-2 text-amber-900 text-xs font-black shadow-sm mx-1">
                        <span className="text-base shrink-0">⚠️</span>
                        <span>轉出與轉入不可為同一個帳戶，請選擇不同帳戶</span>
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-2">
                        <span className="text-[18px] font-bold text-[#000000] uppercase">1. 來源帳戶 (錢從哪裡出)</span>
                        <span className="text-[16px] font-bold text-[#000000] bg-[#FFD54F]/20 px-2 py-0.5 rounded-full">
                          {currentAccount?.currency}
                        </span>
                      </div>
                      {renderAccountSelector(
                        selectedAccountId, 
                        setSelectedAccountId, 
                        expandedSourceBanks, 
                        setExpandedSourceBanks, 
                        'source', 
                        undefined, 
                        toAccountId ? [toAccountId] : [], 
                        '(已選為轉入帳戶)'
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-2">
                        <span className="text-[18px] font-bold text-[#000000] uppercase">2. 目的帳戶 (錢往哪裡去)</span>
                        <span className="text-[16px] font-bold text-[#000000] bg-[#FFD54F]/20 px-2 py-0.5 rounded-full">
                          {currentToAccount?.currency}
                        </span>
                      </div>
                      {renderAccountSelector(
                        toAccountId, 
                        setToAccountId, 
                        expandedDestBanks, 
                        setExpandedDestBanks, 
                        'dest', 
                        undefined, 
                        selectedAccountId ? [selectedAccountId] : [], 
                        '(已選為轉出帳戶)'
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <span className="text-[18px] font-bold text-[#000000] uppercase px-2">1. 選擇帳戶</span>
                    {renderAccountSelector(selectedAccountId, setSelectedAccountId, expandedBanks, setExpandedBanks, 'main')}
                  </div>
                )}

                {/* Step 2 (or Step 3 for transfer): Main Category Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-2">
                    <span className="text-[18px] font-bold text-[#000000] uppercase">
                      {tab === 'transfer' ? '3. 選擇轉帳分類 (可選)' : '2. 選擇主分類'}
                    </span>
                    {tab === 'transfer' && mainCategory && (
                      <button
                        type="button"
                        onClick={() => { setMainCategory(null); setSubCategory(null); }}
                        className="text-xs font-bold text-stone-400 hover:text-stone-600 underline"
                      >
                        清除分類
                      </button>
                    )}
                  </div>
                  <HorizontalScrollArea className="px-8">
                    {filteredCategories.map(cat => (
                      <button 
                        key={cat.id}
                        onClick={() => {
                          if (tab === 'transfer' && mainCategory === cat.name) {
                            setMainCategory(null);
                            setSubCategory(null);
                            return;
                          }
                          setMainCategory(cat.name);
                          setSubCategory(null);
                          if (tab === 'transfer' && (!cat.sub || cat.sub.length === 0)) {
                            setShowCalculator(true);
                          } else {
                            setShowCalculator(false);
                          }
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

                {/* Step 3 (or Step 4 for transfer): Sub Category Selection */}
                {mainCategory && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                    <span className="text-[18px] font-bold text-[#000000] uppercase px-2">
                      {tab === 'transfer' ? '4. 選擇子分類' : '3. 選擇子分類'}
                    </span>
                    <HorizontalScrollArea className="px-8">
                      {currentMainCat?.sub?.map((sub, i) => (
                        <button 
                          key={`${currentMainCat.id}-sub-${i}`}
                          onClick={() => {
                            if (tab === 'transfer' && subCategory === sub) {
                              setSubCategory(null);
                              return;
                            }
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
                      {mainCategory ? '確認並輸入轉帳金額' : '略過分類，直接輸入金額'}
                    </button>
                  </div>
                )}
              </div>

              {/* Right Column */}
              <div className="flex flex-col gap-5 overflow-y-auto pl-1 md:pl-2 min-h-0">
                {/* 買股票扣款：同步到投資頁 */}
                {showStockPicker && (
                  <div className="space-y-2 bg-white rounded-2xl p-4 shadow-sm border-2 border-[#FFD54F]/40">
                    <span className="text-[16px] font-bold text-[#5D4037] px-1">📈 買了哪一檔？（同步到投資頁）</span>
                    <select
                      value={stockPick}
                      onChange={e => setStockPick(e.target.value)}
                      className="w-full p-3 bg-[#FFFDF5] border border-stone-200 rounded-xl font-bold text-[#5D4037] outline-none focus:border-[#FFD54F]"
                    >
                      <option value="">不同步（不是買股票）</option>
                      {stockOptions.map(st => (
                        <option key={st.id} value={st.id}>{st.code}{st.broker ? `（${st.broker}）` : ''}</option>
                      ))}
                      <option value="__new__">＋ 其他股票（自己輸入代號）</option>
                    </select>
                    {stockPick === '__new__' && (
                      <div className="grid grid-cols-2 gap-2">
                        <input value={newStockCode} onChange={e => setNewStockCode(e.target.value)} placeholder="代號，例如 00878"
                          className="p-3 bg-[#FFFDF5] border border-stone-200 rounded-xl font-bold text-[#5D4037] outline-none focus:border-[#FFD54F]" />
                        <input value={newStockName} onChange={e => setNewStockName(e.target.value)} placeholder="名稱（選填）"
                          className="p-3 bg-[#FFFDF5] border border-stone-200 rounded-xl font-bold text-[#5D4037] outline-none focus:border-[#FFD54F]" />
                      </div>
                    )}
                    {stockPick && (
                      <p className="text-xs font-bold text-stone-500 px-1 leading-relaxed">
                        股數先不用填。收到證券對帳單或扣款通知後，到「投資」頁的「待補股數」補上股數和成交價，持股就會更新。
                      </p>
                    )}
                  </div>
                )}

                {/* Note Input */}
                <div className="space-y-2">
                  <span className="text-[18px] font-bold text-[#000000] uppercase px-2">備註 (買了什麼？)</span>
                  <textarea 
                    rows={2}
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#000000] text-[16px] outline-none shadow-sm focus:border-[#FFD54F] transition-all resize-none whitespace-pre-wrap break-all"
                    placeholder="例如：開源社雞排、演唱會周邊"
                    style={getFontFamily()}
                  />
                </div>

                {/* Prepayment / Receivable (代墊 / 代收款) Section */}
                {(tab === 'expense' || tab === 'income') && (
                  <div className="space-y-4 bg-white/50 p-4 rounded-2xl border-2 border-white shadow-sm" style={getFontFamily()}>
                    <div className="flex items-center justify-between">
                      <span className="text-[15px] font-bold text-[#5D4037] flex items-center gap-1">
                        {tab === 'expense' ? '🔹 代墊 / 不計入個人支出' : '🔹 代收款 / 代墊款收回 (不計入個人收入)'}
                      </span>
                      <button 
                        type="button"
                        onClick={() => setIsPrepay(!isPrepay)}
                        className={`w-12 h-6 rounded-full transition-all relative ${isPrepay ? (tab === 'expense' ? 'bg-sky-500' : 'bg-teal-500') : 'bg-stone-200'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isPrepay ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                    <div className="text-[10px] font-bold text-stone-400 leading-snug">
                      {tab === 'expense' 
                        ? '開啟後，此款項將標記為「家裡代墊」，會扣除帳戶餘額但不計入個人消費與預算扣額。' 
                        : '開啟後，此款項將標記為「代收款收回」，會增加帳戶餘額但不計入個人總收入。'}
                    </div>
                  </div>
                )}

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
                            <label className="text-xs font-bold text-stone-500 uppercase">分期期數 (1-36)</label>
                            <NumberInput
                              integer
                              minValue={1}
                              maxValue={36}
                              value={totalInstallments}
                              onValueChange={setTotalInstallments}
                              className="w-full p-3 bg-white border-2 border-stone-50 rounded-xl font-bold text-[18px] text-[#000000] outline-none shadow-sm focus:border-[#FFD54F]"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-stone-500 uppercase">每期金額</label>
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
                            <label className="text-xs font-bold text-stone-500 uppercase">{rateLabel}</label>
                            <input 
                              type="number"
                              value={exchangeRate}
                              onChange={e => setExchangeRate(e.target.value)}
                              className="w-full p-3 bg-white border-2 border-stone-50 rounded-xl font-bold text-sm outline-none shadow-sm focus:border-[#FFD54F]"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-stone-500 uppercase">實收金額 ({currentToAccount?.currency})</label>
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
                        <label className="text-xs font-bold text-stone-500 uppercase px-1">手續費 ({currentAccount?.currency})</label>
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
                    <label className="text-xs font-black text-stone-500 uppercase tracking-widest px-1">幣別</label>
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6" onClick={(e) => e.stopPropagation()}>
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
                    {(Array.isArray(templates) ? templates : []).find(t => t.id === editingTemplate.id) ? '編輯範本' : '新增範本'}
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
                  <textarea 
                    rows={2}
                    value={editingTemplate.note || ''} 
                    onChange={e => setEditingTemplate({...editingTemplate, note: e.target.value})}
                    placeholder="例如：開源社雞排"
                    className="w-full p-3 bg-white border border-stone-100 rounded-xl outline-none font-bold text-sm shadow-sm resize-none whitespace-pre-wrap break-all"
                    style={getFontFamily()}
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
                {editingTemplate.type === 'transfer' && editingTemplate.fromAccountId && editingTemplate.toAccountId && editingTemplate.fromAccountId === editingTemplate.toAccountId && (
                  <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-center gap-2 text-amber-900 text-xs font-black shadow-sm mx-1">
                    <span className="text-base shrink-0">⚠️</span>
                    <span>轉出與轉入不可為同一個帳戶，請選擇不同帳戶</span>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-[14px] font-bold text-stone-600 uppercase px-2">
                    {editingTemplate.type === 'transfer' ? '來源帳戶' : '預設帳戶'}
                  </label>
                  {renderAccountSelector(
                    editingTemplate.fromAccountId,
                    (id) => setEditingTemplate({ ...editingTemplate, fromAccountId: id }),
                    expandedTemplateFromBanks,
                    setExpandedTemplateFromBanks,
                    'template-from',
                    editingTemplate.type,
                    editingTemplate.type === 'transfer' && editingTemplate.toAccountId ? [editingTemplate.toAccountId] : [],
                    '(已選為轉入帳戶)'
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
                      'template-to',
                      editingTemplate.type,
                      editingTemplate.fromAccountId ? [editingTemplate.fromAccountId] : [],
                      '(已選為轉出帳戶)'
                    )}
                  </div>
                )}

                {/* Category Selection */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[14px] font-bold text-stone-600 uppercase px-1">
                      {editingTemplate.type === 'transfer' ? '轉帳分類 (可選)' : '主分類'}
                    </label>
                    <HorizontalScrollArea>
                      {categories
                        .filter(c => c.type === (editingTemplate.type || 'expense'))
                        .map(cat => (
                          <button 
                            key={cat.id}
                            onClick={() => {
                              const isSelected = editingTemplate.category.split(' > ')[0] === cat.name;
                              setEditingTemplate({
                                ...editingTemplate, 
                                category: isSelected && editingTemplate.type === 'transfer' ? '' : cat.name
                              });
                            }}
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
                  {Boolean((Array.isArray(categories) ? categories : []).find(c => c.name === editingTemplate.category.split(' > ')[0])?.sub?.length) && (
                    <div className="space-y-2">
                      <label className="text-[14px] font-bold text-stone-600 uppercase px-1">子分類</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(Array.isArray(categories) ? categories : []).find(c => c.name === editingTemplate.category.split(' > ')[0])?.sub?.map(sub => (
                          <button 
                            key={sub}
                            onClick={() => setEditingTemplate({...editingTemplate, category: `${editingTemplate.category.split(' > ')[0]} > ${sub}`})}
                            className={`py-3.5 px-3 rounded-xl border-2 transition-all text-[15px] font-bold ${
                              editingTemplate.category.split(' > ')[1] === sub || editingTemplate.category === sub
                                ? 'bg-[#FFD54F] text-[#5D4037] border-[#FFD54F] font-black shadow-sm' 
                                : 'bg-white border-stone-100 text-[#5D4037] active:bg-stone-50 hover:bg-stone-50/50'
                            }`}
                          >
                            {sub}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

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
                <h3 className="text-xl font-black text-[#5D4037]">新增{tab === 'transfer' ? '轉帳' : (tab === 'income' ? '收入' : '支出')}分類</h3>
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
                    placeholder={tab === 'transfer' ? '例如：信用卡繳款、投資理財' : '例如：追星、烘焙'}
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

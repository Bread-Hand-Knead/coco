import { calculateEstimatedSellingDeduction, getFontFamily } from '../lib/financeUtils';
import { useMemo, useState } from 'react';
import {
  Briefcase,
  ChevronDown,
  ChevronUp,
  Coins,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Account, AggregatedStockGroup, Category, PriceHistoryItem, Project, Stock, Transaction } from '../types';
import { formatTime24 } from '../lib/dateUtils';
import { getStockMatchKeywords, resolveBrokerAccount } from '../lib/accountUtils';
import { GroupedAccountDropdown } from '../components/AccountWidgets';
import { EditRecordModal } from './EditRecordModal';
import { PriceHistoryChart } from '../components/PriceHistoryChart';
import { PendingStockBuys, StockBuyFillModal } from '../components/StockBuyFill';

export function InvestmentSection({
  records,
  accounts,
  stocks,
  onSaveStock,
  onDeleteStock,
  onAddRecord,
  categories,
  projects,
  onUpdateRecord,
  onDeleteRecord,
  onDuplicateRecord
}: {
  records: Transaction[],
  accounts: Account[],
  stocks: Stock[],
  onSaveStock: (stock: Stock) => void,
  onDeleteStock: (stockId: string) => void,
  onAddRecord: (record: Omit<Transaction, 'id'>, keepOpen?: boolean) => void,
  categories: Category[],
  projects: Project[],
  onUpdateRecord: (old: Transaction, updated: Transaction, ...args: any[]) => void,
  onDeleteRecord: (record: Transaction) => void,
  onDuplicateRecord?: (record: Transaction) => void
}) {
  // Helper to calculate T+2 trading days for stock settlement date
  const calculateSettlementDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
    let d = new Date(parts[0], parts[1] - 1, parts[2]);

    let addedTradingDays = 0;
    while (addedTradingDays < 2) {
      d.setDate(d.getDate() + 1);
      const dayOfWeek = d.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip Sunday (0) and Saturday (6)
        addedTradingDays++;
      }
    }

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // states for stock add/edit
  const [editingStock, setEditingStock] = useState<Stock | null>(null);
  const [selectedStockForDetail, setSelectedStockForDetail] = useState<Stock | null>(null);
  const [editingRecord, setEditingRecord] = useState<Transaction | null>(null);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [stockCategory, setStockCategory] = useState<'stock' | 'fund'>('stock');
  const [stockCode, setStockCode] = useState('');
  const [stockShares, setStockShares] = useState('');
  const [stockAvgPrice, setStockAvgPrice] = useState('');
  const [stockCurrentPrice, setStockCurrentPrice] = useState('');
  const [stockCurrentMarketValue, setStockCurrentMarketValue] = useState('');
  const [stockTotalCost, setStockTotalCost] = useState('');
  const [stockFee, setStockFee] = useState('0');
  const [isStockCostManualOverride, setIsStockCostManualOverride] = useState(false);
  const [stockLinkedAccount, setStockLinkedAccount] = useState('');
  const [stockNotes, setStockNotes] = useState('');
  const [stockPurchaseDate, setStockPurchaseDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [stockSettlementDate, setStockSettlementDate] = useState(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return calculateSettlementDate(todayStr);
  });
  const [isStockSettlementManual, setIsStockSettlementManual] = useState(false);
  const [stockEvaluationDate, setStockEvaluationDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [stockPriceHistory, setStockPriceHistory] = useState<PriceHistoryItem[]>([]);
  const [isPriceHistoryOpen, setIsPriceHistoryOpen] = useState(false);
  // 帳戶記的買股票扣款，照對帳單補股數
  const [fillingRecord, setFillingRecord] = useState<Transaction | null>(null);
  const [selectedBrokerFilter, setSelectedBrokerFilter] = useState<string>('all');
  const [expandedStockCodes, setExpandedStockCodes] = useState<Record<string, boolean>>({});
  const [isOverviewCollapsed, setIsOverviewCollapsed] = useState(false);

  // states for buy operation
  const [buyingStock, setBuyingStock] = useState<Stock | null>(null);
  const [editingBuyRecord, setEditingBuyRecord] = useState<Transaction | null>(null);
  const [buyShares, setBuyShares] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [buyTotalCost, setBuyTotalCost] = useState('');
  const [buyFee, setBuyFee] = useState('0');
  const [isBuyCostManualOverride, setIsBuyCostManualOverride] = useState(false);
  const [buyDate, setBuyDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [buySettlementDate, setBuySettlementDate] = useState(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return calculateSettlementDate(todayStr);
  });
  const [isBuySettlementManual, setIsBuySettlementManual] = useState(false);
  const [buyAccount, setBuyAccount] = useState('');
  const [buyNotes, setBuyNotes] = useState('');

  // Helper to parse buy transaction details from record note
  const parseBuyRecordDetails = (r: Transaction, stock: Stock) => {
    if (r.stockBuy) {
      // 從帳戶記的買股票扣款：資料存在 stockBuy，不用從備註解析
      const sb = r.stockBuy;
      return {
        shares: sb.shares ? String(sb.shares) : '',
        price: sb.price ? String(sb.price) : '',
        fee: String(sb.fee || 0),
        totalCost: String(sb.netCost || Math.abs(r.amount)),
        tradeDate: sb.tradeDate || r.date,
        settlementDate: r.postingDate || r.date,
        extraNotes: '',
        accountId: r.accountId || stock.linkedAccount
      };
    }
    const note = r.note || '';
    
    // Parse shares
    const sharesMatch = note.match(/(\d+(?:\.\d+)?)\s*(?:股|單位)/);
    const shares = sharesMatch ? sharesMatch[1] : (stock.shares ? stock.shares.toString() : '');

    // Parse price
    const priceMatch = note.match(/@\s*\$?(\d+(?:\.\d+)?)/);
    const price = priceMatch ? priceMatch[1] : (stock.avgPrice ? stock.avgPrice.toString() : '');

    // Parse fee
    const feeMatch = note.match(/含手續費\s*\$?(\d+(?:\.\d+)?)/);
    const fee = feeMatch ? feeMatch[1] : '0';

    // Parse trade date if in note
    const dateMatch = note.match(/\[(?:買入|加購)\s*(\d{4}-\d{2}-\d{2})\]/);
    const tradeDate = dateMatch ? dateMatch[1] : (r.date || new Date().toISOString().split('T')[0]);

    const settlementDate = r.postingDate || r.date || calculateSettlementDate(tradeDate);

    // Parse extra notes outside tag
    let extraNotes = '';
    const noteParenMatch = note.match(/\)\s*\(([^)]+)\)$/);
    if (noteParenMatch) {
      extraNotes = noteParenMatch[1];
    }

    const totalCost = Math.abs(r.amount).toString();

    return {
      shares,
      price,
      fee,
      totalCost,
      tradeDate,
      settlementDate,
      extraNotes,
      accountId: r.accountId || stock.linkedAccount
    };
  };

  const handleStockPurchaseDateChange = (val: string) => {
    setStockPurchaseDate(val);
    if (!isStockSettlementManual) {
      setStockSettlementDate(calculateSettlementDate(val));
    }
  };

  const handleBuyDateChange = (val: string) => {
    setBuyDate(val);
    if (!isBuySettlementManual) {
      setBuySettlementDate(calculateSettlementDate(val));
    }
  };

  // Change handlers for stock modal (cost decoupling)
  const handleStockSharesChange = (val: string) => {
    setStockShares(val);
    const sh = parseFloat(val) || 0;
    const price = parseFloat(stockAvgPrice) || 0;
    const fee = parseFloat(stockFee) || 0;

    if (!isStockCostManualOverride) {
      if (sh > 0 && price > 0) {
        setStockTotalCost((Math.round(sh * price) + fee).toString());
      } else {
        setStockTotalCost(fee > 0 ? fee.toString() : '');
      }
    }

    const cp = parseFloat(stockCurrentPrice) || 0;
    if (sh > 0 && cp > 0) {
      setStockCurrentMarketValue(Math.round(sh * cp).toString());
    } else {
      setStockCurrentMarketValue('');
    }
  };

  const handleStockAvgPriceChange = (val: string) => {
    setStockAvgPrice(val);
    setIsStockCostManualOverride(false);
    const price = parseFloat(val) || 0;
    const sh = parseFloat(stockShares) || 0;
    const fee = parseFloat(stockFee) || 0;
    if (sh > 0 && price > 0) {
      setStockTotalCost((Math.round(sh * price) + fee).toString());
    } else {
      setStockTotalCost(fee > 0 ? fee.toString() : '');
    }
  };

  const handleStockFeeChange = (val: string) => {
    setStockFee(val);
    const fee = parseFloat(val) || 0;
    const sh = parseFloat(stockShares) || 0;
    const price = parseFloat(stockAvgPrice) || 0;

    if (!isStockCostManualOverride) {
      if (sh > 0 && price > 0) {
        setStockTotalCost((Math.round(sh * price) + fee).toString());
      } else {
        setStockTotalCost(fee > 0 ? fee.toString() : '');
      }
    }
  };

  const handleStockTotalCostChange = (val: string) => {
    setStockTotalCost(val);
    setIsStockCostManualOverride(true);
  };

  const handleStockCurrentPriceChange = (val: string) => {
    setStockCurrentPrice(val);
    const cp = parseFloat(val) || 0;
    const sh = parseFloat(stockShares) || 0;
    if (sh > 0 && cp > 0) {
      setStockCurrentMarketValue(Math.round(sh * cp).toString());
    } else {
      setStockCurrentMarketValue('');
    }
  };

  const handleStockCurrentMarketValueChange = (val: string) => {
    setStockCurrentMarketValue(val);
    const mv = parseFloat(val) || 0;
    const sh = parseFloat(stockShares) || 0;
    if (sh > 0 && mv > 0) {
      setStockCurrentPrice(parseFloat((mv / sh).toFixed(4)).toString());
    }
  };

  // Change handlers for buy modal (cost decoupling)
  const handleBuySharesChange = (val: string) => {
    setBuyShares(val);
    const sh = parseFloat(val) || 0;
    const price = parseFloat(buyPrice) || 0;
    const fee = parseFloat(buyFee) || 0;

    if (!isBuyCostManualOverride) {
      if (sh > 0 && price > 0) {
        setBuyTotalCost((Math.round(sh * price) + fee).toString());
      } else {
        setBuyTotalCost(fee > 0 ? fee.toString() : '');
      }
    }
  };

  const handleBuyPriceChange = (val: string) => {
    setBuyPrice(val);
    setIsBuyCostManualOverride(false);
    const price = parseFloat(val) || 0;
    const sh = parseFloat(buyShares) || 0;
    const fee = parseFloat(buyFee) || 0;
    if (sh > 0 && price > 0) {
      setBuyTotalCost((Math.round(sh * price) + fee).toString());
    } else {
      setBuyTotalCost(fee > 0 ? fee.toString() : '');
    }
  };

  const handleBuyFeeChange = (val: string) => {
    setBuyFee(val);
    const fee = parseFloat(val) || 0;
    const sh = parseFloat(buyShares) || 0;
    const price = parseFloat(buyPrice) || 0;

    if (!isBuyCostManualOverride) {
      if (sh > 0 && price > 0) {
        setBuyTotalCost((Math.round(sh * price) + fee).toString());
      } else {
        setBuyTotalCost(fee > 0 ? fee.toString() : '');
      }
    }
  };

  const handleBuyTotalCostChange = (val: string) => {
    setBuyTotalCost(val);
    setIsBuyCostManualOverride(true);
  };

  // states for dividend operation
  const [dividendingStock, setDividendingStock] = useState<Stock | null>(null);
  const [dividendAmount, setDividendAmount] = useState('');
  const [dividendDate, setDividendDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [dividendTime, setDividendTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [dividendAccount, setDividendAccount] = useState('');
  const [dividendNotes, setDividendNotes] = useState('');

  // 自動校正歷史持股與現有資料之 linkedAccount 歸屬證券戶 (確保點數戶/銀行戶買入皆合併對齊同機構之證券戶)
  const calibratedStocks = useMemo(() => {
    if (!Array.isArray(stocks)) return [];
    return stocks.map(s => {
      const resolvedLinkedAccount = resolveBrokerAccount(s.linkedAccount, accounts);
      if (resolvedLinkedAccount && resolvedLinkedAccount !== s.linkedAccount) {
        return { ...s, linkedAccount: resolvedLinkedAccount };
      }
      return s;
    });
  }, [stocks, accounts]);

  // aggregated / filtered stock groups by broker filter
  const displayStockGroups = useMemo<AggregatedStockGroup[]>(() => {
    if (selectedBrokerFilter !== 'all') {
      const singleBrokerStocks = calibratedStocks.filter(s => s.linkedAccount === selectedBrokerFilter);
      return singleBrokerStocks.map(s => {
        const cost = s.totalCost !== undefined && s.totalCost > 0 ? s.totalCost : Math.round(s.shares * s.avgPrice);
        const fee = s.fee || 0;
        return {
          isAggregated: false,
          code: s.code,
          category: s.category,
          totalShares: s.shares,
          totalCost: cost,
          totalFee: fee,
          avgPrice: s.avgPrice,
          currentPrice: s.currentPrice,
          evaluationDate: s.evaluationDate,
          priceHistory: s.priceHistory,
          subStocks: [s],
          brokerAccountIds: s.linkedAccount ? [s.linkedAccount] : []
        };
      });
    }

    // "全部券商" mode: aggregate by stock code
    const groupsMap: Record<string, Stock[]> = {};
    const orderList: string[] = [];

    calibratedStocks.forEach(s => {
      const key = (s.code || '').trim().toUpperCase();
      if (!groupsMap[key]) {
        groupsMap[key] = [];
        orderList.push(key);
      }
      groupsMap[key].push(s);
    });

    return orderList.map(key => {
      const groupStocks = groupsMap[key];
      const first = groupStocks[0];
      const isAggregated = groupStocks.length > 1;

      let totalShares = 0;
      let totalCost = 0;
      let totalFee = 0;
      let latestCurrentPrice: number | undefined = undefined;
      let latestEvalDate: string | undefined = undefined;

      const brokerAccountIds = Array.from(new Set(groupStocks.map(s => s.linkedAccount).filter(Boolean)));
      const combinedHistoryMap = new Map<string, PriceHistoryItem>();

      groupStocks.forEach(s => {
        totalShares += s.shares;
        const cost = s.totalCost !== undefined && s.totalCost > 0 ? s.totalCost : Math.round(s.shares * s.avgPrice);
        totalCost += cost;
        totalFee += (s.fee || 0);
        if (s.currentPrice !== undefined && s.currentPrice > 0) {
          latestCurrentPrice = s.currentPrice;
        }
        if (s.evaluationDate && (!latestEvalDate || s.evaluationDate > latestEvalDate)) {
          latestEvalDate = s.evaluationDate;
        }
        if (Array.isArray(s.priceHistory)) {
          s.priceHistory.forEach(h => {
            combinedHistoryMap.set(h.date.replace(/-/g, '/'), h);
          });
        }
      });

      const avgPrice = totalShares > 0 ? parseFloat((totalCost / totalShares).toFixed(2)) : 0;
      const groupPriceHistory = Array.from(combinedHistoryMap.values()).sort((a, b) => {
        const dateA = a.date.replace(/\//g, '-');
        const dateB = b.date.replace(/\//g, '-');
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });

      return {
        isAggregated,
        code: first.code,
        category: first.category,
        totalShares,
        totalCost,
        totalFee,
        avgPrice,
        currentPrice: latestCurrentPrice,
        evaluationDate: latestEvalDate,
        priceHistory: groupPriceHistory.length > 0 ? groupPriceHistory : undefined,
        subStocks: groupStocks,
        brokerAccountIds
      };
    });
  }, [calibratedStocks, selectedBrokerFilter]);

  // overview stats
  const totalPrincipal = useMemo(() => {
    return displayStockGroups.reduce((sum, g) => sum + g.totalCost, 0);
  }, [displayStockGroups]);

  const totalMarketValue = useMemo(() => {
    return displayStockGroups.reduce((sum, g) => {
      const price = (g.currentPrice !== undefined && g.currentPrice > 0) ? g.currentPrice : g.avgPrice;
      return sum + (g.totalShares * price);
    }, 0);
  }, [displayStockGroups]);

  const totalUnrealizedPL = useMemo(() => {
    return displayStockGroups.reduce((sum, g) => {
      if (g.currentPrice !== undefined && g.currentPrice > 0) {
        const mv = g.totalShares * g.currentPrice;
        const deduction = calculateEstimatedSellingDeduction(g.code, g.category, mv).totalDeduction;
        return sum + (mv - g.totalCost - deduction);
      }
      return sum;
    }, 0);
  }, [displayStockGroups]);

  const totalROI = useMemo(() => {
    return totalPrincipal > 0 ? (totalUnrealizedPL / totalPrincipal) * 100 : 0;
  }, [totalUnrealizedPL, totalPrincipal]);

  const totalDividends = useMemo(() => {
    return records
      .filter(r => r.type === 'income' && r.note && r.note.startsWith('[股利]'))
      .reduce((sum, r) => sum + Math.abs(r.amount), 0);
  }, [records]);

  const [showDividendAnalysis, setShowDividendAnalysis] = useState(false);
  const [dividendDetailTarget, setDividendDetailTarget] = useState<{ type: 'stock' | 'bank'; name: string } | null>(null);
  const [selectedDividendYear, setSelectedDividendYear] = useState<string>('all');
  const [stockDetailFilter, setStockDetailFilter] = useState<'all' | 'buy' | 'dividend'>('all');

  const dividendYears = useMemo(() => {
    const yearsSet = new Set<string>();
    records.forEach(r => {
      if (r.type === 'income' && r.note && r.note.startsWith('[股利]')) {
        const year = r.date.split('-')[0];
        if (year) yearsSet.add(year);
      }
    });
    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  }, [records]);

  const filteredYearTotal = useMemo(() => {
    return records
      .filter(r => {
        const isDiv = r.type === 'income' && r.note && r.note.startsWith('[股利]');
        if (!isDiv) return false;
        if (selectedDividendYear === 'all') return true;
        return r.date.startsWith(selectedDividendYear);
      })
      .reduce((sum, r) => sum + Math.abs(r.amount), 0);
  }, [records, selectedDividendYear]);

  const dividendStats = useMemo(() => {
    const stockMap: Record<string, number> = {};
    const bankMap: Record<string, number> = {};

    records.forEach(r => {
      if (r.type === 'income' && r.note && r.note.startsWith('[股利]')) {
        if (selectedDividendYear !== 'all' && !r.date.startsWith(selectedDividendYear)) {
          return;
        }
        const amt = Math.abs(r.amount);
        
        // 比對股票代號或名稱
        const matchedStock = (Array.isArray(stocks) ? stocks : []).find(s => {
          const keyword = s.code.split(' (')[0].trim();
          return r.note.includes(keyword);
        });
        const stockName = matchedStock ? matchedStock.code : '其他股票';
        stockMap[stockName] = (stockMap[stockName] || 0) + amt;

        // 比對入帳銀行帳戶
        const acc = (Array.isArray(accounts) ? accounts : []).find(a => a.id === r.accountId);
        const bankName = acc ? `${acc.icon} ${acc.name}` : '未知帳戶';
        bankMap[bankName] = (bankMap[bankName] || 0) + amt;
      }
    });

    const stockList = Object.entries(stockMap)
      .map(([name, val]) => ({ name, val }))
      .sort((a, b) => b.val - a.val);

    const bankList = Object.entries(bankMap)
      .map(([name, val]) => ({ name, val }))
      .sort((a, b) => b.val - a.val);

    return { stockList, bankList };
  }, [records, stocks, accounts, selectedDividendYear]);

  // helpers
  const handleOpenStockAdd = () => {
    setEditingStock(null);
    setStockCategory('stock');
    setStockCode('');
    setStockShares('');
    setStockAvgPrice('');
    setStockCurrentPrice('');
    setStockCurrentMarketValue('');
    setStockTotalCost('');
    setStockFee('0');
    setIsStockCostManualOverride(false);
    const bankAcc = (Array.isArray(accounts) ? accounts : []).find(a => a.type === 'bank' || a.type === 'investment') || accounts[0];
    setStockLinkedAccount(bankAcc ? bankAcc.id : '');
    const todayStr = new Date().toISOString().split('T')[0];
    setStockPurchaseDate(todayStr);
    setStockSettlementDate(calculateSettlementDate(todayStr));
    setIsStockSettlementManual(false);
    setStockEvaluationDate(todayStr);
    setStockPriceHistory([]);
    setStockNotes('');
    setIsStockModalOpen(true);
  };

  const handleOpenStockEdit = (stock: Stock) => {
    setEditingStock(stock);
    setStockCategory(stock.category || 'stock');
    setStockCode(stock.code);
    setStockShares(stock.shares.toString());
    setStockAvgPrice(stock.avgPrice.toString());
    setStockCurrentPrice(stock.currentPrice !== undefined ? stock.currentPrice.toString() : '');
    setStockCurrentMarketValue((stock.currentPrice !== undefined && stock.shares > 0) ? Math.round(stock.shares * stock.currentPrice).toString() : '');
    setStockFee(stock.fee !== undefined ? stock.fee.toString() : '0');
    setIsStockCostManualOverride(stock.totalCost !== undefined);
    const calculatedTotal = stock.totalCost !== undefined 
      ? stock.totalCost 
      : (Math.round(stock.shares * stock.avgPrice) + (stock.fee || 0));
    setStockTotalCost(calculatedTotal.toString());
    setStockLinkedAccount(stock.linkedAccount);
    const pDate = stock.purchaseDate || new Date().toISOString().split('T')[0];
    setStockPurchaseDate(pDate);
    if (stock.settlementDate) {
      setStockSettlementDate(stock.settlementDate);
      setIsStockSettlementManual(true);
    } else {
      setStockSettlementDate(calculateSettlementDate(pDate));
      setIsStockSettlementManual(false);
    }
    setStockEvaluationDate(stock.evaluationDate || new Date().toISOString().split('T')[0]);
    setStockPriceHistory(stock.priceHistory ? [...stock.priceHistory] : []);
    setStockNotes(stock.notes || '');
    setIsStockModalOpen(true);
  };

  const handleSaveStockSubmit = () => {
    if (!stockCode.trim()) {
      alert(stockCategory === 'fund' ? '請輸入基金名稱或代碼！' : '請輸入股票代號或名稱！');
      return;
    }
    const sharesNum = parseFloat(stockShares) || 0;
    const priceNum = parseFloat(stockAvgPrice) || 0;
    const feeNum = parseFloat(stockFee) || 0;
    const currentPriceNum = stockCurrentPrice.trim() !== '' ? (parseFloat(stockCurrentPrice) || undefined) : undefined;

    if (sharesNum < 0 || priceNum < 0) {
      alert('數量與單價/淨值不能小於零！');
      return;
    }
    if (!stockLinkedAccount) {
      alert('請選擇交割銀行帳戶！');
      return;
    }

    const resolvedBrokerAccount = resolveBrokerAccount(stockLinkedAccount, accounts);
    const isNew = !editingStock;
    const calculatedDefaultCost = Math.round(sharesNum * priceNum) + feeNum;
    const inputCost = parseFloat(stockTotalCost) || calculatedDefaultCost;
    const cleanCode = stockCode.trim();
    const finalSettlementDate = (stockSettlementDate && stockSettlementDate.trim()) 
      ? stockSettlementDate.trim() 
      : calculateSettlementDate(stockPurchaseDate || new Date().toISOString().split('T')[0]);

    // 自動更新/追加市價歷史紀錄 (Price Evaluation History)
    let finalPriceHistory: PriceHistoryItem[] = [...stockPriceHistory];

    if (currentPriceNum !== undefined && currentPriceNum > 0) {
      const rawEvalDate = (stockEvaluationDate && stockEvaluationDate.trim()) 
        ? stockEvaluationDate.trim() 
        : new Date().toISOString().split('T')[0];
      const formattedEvalDate = rawEvalDate.replace(/-/g, '/');

      const inputMarketValue = stockCurrentMarketValue.trim() !== '' 
        ? parseFloat(stockCurrentMarketValue) 
        : undefined;
      const calculatedMV = (inputMarketValue !== undefined && !isNaN(inputMarketValue) && inputMarketValue > 0)
        ? inputMarketValue
        : Math.round(sharesNum * currentPriceNum);

      // 檢查該日期是否已有記錄
      const existingHistoryIdx = finalPriceHistory.findIndex(
        h => h.date.replace(/-/g, '/') === formattedEvalDate
      );

      if (existingHistoryIdx !== -1) {
        // 若該日期已有記錄，則更新當日記錄，避免重複洗版
        finalPriceHistory[existingHistoryIdx] = {
          ...finalPriceHistory[existingHistoryIdx],
          date: formattedEvalDate,
          price: currentPriceNum,
          marketValue: Math.round(calculatedMV),
          createdAt: new Date().toISOString()
        };
      } else {
        // 追加一筆記錄
        const newHistoryItem: PriceHistoryItem = {
          id: `eval_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          date: formattedEvalDate,
          price: currentPriceNum,
          marketValue: Math.round(calculatedMV),
          createdAt: new Date().toISOString()
        };
        finalPriceHistory = [newHistoryItem, ...finalPriceHistory];
      }

      // 依日期由新到舊降冪排列 (最新的在最上方)
      finalPriceHistory.sort((a, b) => {
        const dateA = a.date.replace(/\//g, '-');
        const dateB = b.date.replace(/\//g, '-');
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
    }

    // 檢查同證券交割帳戶下是否已存在相同股票/基金代碼（同標的自動加權平均合併）
    const existingIndex = isNew ? stocks.findIndex(s => 
      s.code.trim().toLowerCase() === cleanCode.toLowerCase() && 
      resolveBrokerAccount(s.linkedAccount, accounts) === resolvedBrokerAccount
    ) : -1;

    if (isNew && existingIndex !== -1) {
      // 執行同標的加權平均合併
      const existing = stocks[existingIndex];
      const oldShares = existing.shares;
      const oldTotalCost = existing.totalCost !== undefined ? existing.totalCost : (oldShares * existing.avgPrice);

      const newTotalShares = parseFloat((oldShares + sharesNum).toFixed(4));
      const newTotalCost = oldTotalCost + inputCost;
      const netNewTotalCost = Math.max(0, newTotalCost - ((existing.fee || 0) + feeNum));
      const newAvgPrice = newTotalShares > 0 ? parseFloat((netNewTotalCost / newTotalShares).toFixed(4)) : 0;

      const dateStr = stockPurchaseDate || new Date().toISOString().split('T')[0];
      const buyLog = `[加購 ${dateStr}] +${sharesNum} @ $${priceNum}`;
      const mergedNotes = existing.notes ? `${existing.notes} | ${buyLog}` : buyLog;

      const combinedMap = new Map<string, PriceHistoryItem>();
      (existing.priceHistory || []).forEach(h => {
        combinedMap.set(h.date.replace(/-/g, '/'), h);
      });
      finalPriceHistory.forEach(h => {
        combinedMap.set(h.date.replace(/-/g, '/'), h);
      });
      const mergedPriceHistoryList = Array.from(combinedMap.values()).sort((a, b) => {
        const dateA = a.date.replace(/\//g, '-');
        const dateB = b.date.replace(/\//g, '-');
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });

      const mergedStock: Stock = {
        ...existing,
        category: stockCategory,
        shares: newTotalShares,
        avgPrice: newAvgPrice,
        currentPrice: currentPriceNum !== undefined ? currentPriceNum : existing.currentPrice,
        evaluationDate: currentPriceNum !== undefined ? stockEvaluationDate : existing.evaluationDate,
        priceHistory: mergedPriceHistoryList.length > 0 ? mergedPriceHistoryList : undefined,
        fee: (existing.fee || 0) + feeNum,
        totalCost: newTotalCost,
        linkedAccount: resolvedBrokerAccount,
        purchaseDate: stockPurchaseDate,
        settlementDate: finalSettlementDate,
        notes: stockNotes.trim() ? stockNotes.trim() : mergedNotes
      };

      onSaveStock(mergedStock);

      if (sharesNum > 0) {
        onAddRecord({
          amount: -inputCost,
          category: '投資',
          note: `[買入] ${cleanCode} ${sharesNum}${stockCategory === 'fund' ? '單位' : '股'} @ $${priceNum}${feeNum > 0 ? ` (含手續費 $${feeNum})` : ''}`,
          date: finalSettlementDate,
          postingDate: finalSettlementDate,
          type: 'expense',
          accountId: stockLinkedAccount
        });
      }
    } else {
      const targetStock: Stock = {
        id: editingStock ? editingStock.id : Date.now().toString(),
        code: cleanCode,
        category: stockCategory,
        shares: sharesNum,
        avgPrice: priceNum,
        currentPrice: currentPriceNum,
        evaluationDate: currentPriceNum !== undefined ? stockEvaluationDate : undefined,
        priceHistory: finalPriceHistory.length > 0 ? finalPriceHistory : undefined,
        linkedAccount: resolvedBrokerAccount,
        purchaseDate: stockPurchaseDate,
        settlementDate: finalSettlementDate,
        fee: feeNum,
        totalCost: inputCost,
        notes: stockNotes.trim() || undefined
      };

      onSaveStock(targetStock);

      if (isNew && sharesNum > 0) {
        onAddRecord({
          amount: -inputCost,
          category: '投資',
          note: `[買入] ${cleanCode} ${sharesNum}${stockCategory === 'fund' ? '單位' : '股'} @ $${priceNum}${feeNum > 0 ? ` (含手續費 $${feeNum})` : ''}`,
          date: finalSettlementDate,
          postingDate: finalSettlementDate,
          type: 'expense',
          accountId: stockLinkedAccount
        });
      }
    }

    setIsStockModalOpen(false);
  };

  const handleOpenBuy = (stock: Stock) => {
    setEditingBuyRecord(null);
    setBuyingStock(stock);
    setBuyShares('');
    setBuyPrice(stock.avgPrice.toString());
    setBuyTotalCost('');
    setBuyFee('0');
    setIsBuyCostManualOverride(false);
    const todayStr = new Date().toISOString().split('T')[0];
    setBuyDate(todayStr);
    if (stock.settlementDate) {
      setBuySettlementDate(stock.settlementDate);
      setIsBuySettlementManual(true);
    } else {
      setBuySettlementDate(calculateSettlementDate(todayStr));
      setIsBuySettlementManual(false);
    }
    setBuyAccount(stock.linkedAccount);
    setBuyNotes('');
  };

  const handleOpenEditBuyRecord = (r: Transaction, stock: Stock) => {
    if (r.stockBuy) { setFillingRecord(r); return; } // 帳戶記的扣款：用補股數視窗修改
    const details = parseBuyRecordDetails(r, stock);
    setEditingBuyRecord(r);
    setBuyingStock(stock);
    setBuyShares(details.shares);
    setBuyPrice(details.price);
    setBuyTotalCost(details.totalCost);
    setBuyFee(details.fee);
    setIsBuyCostManualOverride(true);
    setBuyDate(details.tradeDate);
    setBuySettlementDate(details.settlementDate);
    setIsBuySettlementManual(true);
    setBuyAccount(details.accountId);
    setBuyNotes(details.extraNotes);
  };

  const handleBuySubmit = () => {
    if (!buyingStock) return;
    const bShares = parseFloat(buyShares) || 0;
    const bPrice = parseFloat(buyPrice) || 0;
    const bFee = parseFloat(buyFee) || 0;
    if (bShares <= 0 || bPrice <= 0) {
      alert('請輸入有效的股數與單價！');
      return;
    }
    if (!buyAccount) {
      alert('請選擇交割帳戶！');
      return;
    }

    const calculatedDefaultCost = Math.round(bShares * bPrice) + bFee;
    const totalCost = parseFloat(buyTotalCost) || calculatedDefaultCost;
    const finalBuySettlementDate = (buySettlementDate && buySettlementDate.trim()) 
      ? buySettlementDate.trim() 
      : calculateSettlementDate(buyDate || new Date().toISOString().split('T')[0]);
    const unitLabel = buyingStock.category === 'fund' ? '單位' : '股';
    const noteText = `[買入] ${buyingStock.code} ${bShares}${unitLabel} @ $${bPrice}${bFee > 0 ? ` (含手續費 $${bFee})` : ''}${buyNotes.trim() ? ' (' + buyNotes.trim() + ')' : ''}`;

    const resolvedBrokerAccount = resolveBrokerAccount(buyAccount, accounts);

    if (editingBuyRecord) {
      const updatedRecord: Transaction = {
        ...editingBuyRecord,
        amount: -totalCost,
        category: '投資',
        note: noteText,
        date: finalBuySettlementDate,
        postingDate: finalBuySettlementDate,
        type: 'expense',
        accountId: buyAccount
      };

      onUpdateRecord(editingBuyRecord, updatedRecord);

      // 重新加總試算該持股明細
      const keyword = buyingStock.code.split(' (')[0].trim();
      const nextRecords = records.map(r => r.id === editingBuyRecord.id ? updatedRecord : r);
      const buyRecordsForStock = nextRecords.filter(r => 
        r.type === 'expense' && 
        r.accountId === buyAccount && 
        r.note && (r.note.includes(buyingStock.code) || r.note.includes(keyword))
      );

      let totalStockShares = 0;
      let totalStockCost = 0;
      let totalStockFee = 0;

      buyRecordsForStock.forEach(r => {
        const details = parseBuyRecordDetails(r, buyingStock);
        const sh = parseFloat(details.shares) || 0;
        const feeNum = parseFloat(details.fee) || 0;
        const costNum = Math.abs(r.amount) || 0;
        totalStockShares += sh;
        totalStockCost += costNum;
        totalStockFee += feeNum;
      });

      if (totalStockShares === 0) {
        totalStockShares = bShares;
        totalStockCost = totalCost;
        totalStockFee = bFee;
      }

      const netCost = Math.max(0, totalStockCost - totalStockFee);
      const newAvgPrice = totalStockShares > 0 ? parseFloat((netCost / totalStockShares).toFixed(4)) : bPrice;

      const updatedStock: Stock = {
        ...buyingStock,
        shares: parseFloat(totalStockShares.toFixed(4)),
        avgPrice: newAvgPrice,
        fee: totalStockFee,
        totalCost: totalStockCost,
        linkedAccount: resolvedBrokerAccount,
        settlementDate: finalBuySettlementDate
      };

      onSaveStock(updatedStock);
      if (selectedStockForDetail && (selectedStockForDetail.id === updatedStock.id || selectedStockForDetail.code === updatedStock.code)) {
        setSelectedStockForDetail(updatedStock);
      }

      setEditingBuyRecord(null);
      setBuyingStock(null);
      return;
    }

    // Add transaction (expense) strictly recorded on settlement date
    onAddRecord({
      amount: -totalCost,
      category: '投資',
      note: noteText,
      date: finalBuySettlementDate,
      postingDate: finalBuySettlementDate,
      type: 'expense',
      accountId: buyAccount
    });

    // Find existing stock under resolved broker account, or fallback to buyingStock
    const targetStock = stocks.find(s => 
      s.code === buyingStock.code && 
      resolveBrokerAccount(s.linkedAccount, accounts) === resolvedBrokerAccount
    ) || buyingStock;

    // Update stock details
    const oldShares = targetStock.shares;
    const oldAvgPrice = targetStock.avgPrice;
    const newShares = parseFloat((oldShares + bShares).toFixed(4));
    const oldTotalCost = targetStock.totalCost !== undefined ? targetStock.totalCost : (oldShares * oldAvgPrice);
    const newTotalCost = oldTotalCost + totalCost;
    const netNewTotalCost = Math.max(0, newTotalCost - ((targetStock.fee || 0) + bFee));
    const newAvgPrice = newShares > 0 ? parseFloat((netNewTotalCost / newShares).toFixed(4)) : 0;

    const updatedStock: Stock = {
      ...targetStock,
      shares: newShares,
      avgPrice: newAvgPrice,
      fee: (targetStock.fee || 0) + bFee,
      totalCost: newTotalCost,
      linkedAccount: resolvedBrokerAccount,
      settlementDate: finalBuySettlementDate
    };

    onSaveStock(updatedStock);
    if (selectedStockForDetail && (selectedStockForDetail.id === updatedStock.id || selectedStockForDetail.code === updatedStock.code)) {
      setSelectedStockForDetail(updatedStock);
    }

    setBuyingStock(null);
  };

  const handleOpenDividend = (stock: Stock) => {
    setDividendingStock(stock);
    setDividendAmount('');
    setDividendDate(new Date().toISOString().split('T')[0]);
    const now = new Date();
    setDividendTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    setDividendAccount(stock.linkedAccount);
    setDividendNotes('');
  };

  const handleDividendSubmit = () => {
    if (!dividendingStock) return;
    const divAmt = parseFloat(dividendAmount) || 0;
    if (divAmt <= 0) {
      alert('請輸入有效的股利金額！');
      return;
    }
    if (!dividendAccount) {
      alert('請選擇匯入銀行帳戶！');
      return;
    }

    const cleanTime = formatTime24(dividendTime) || `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;

    // Add transaction (income)
    onAddRecord({
      amount: divAmt,
      category: '投資收入',
      note: `[股利] ${dividendingStock.code} 股利入帳${dividendNotes.trim() ? ' (' + dividendNotes.trim() + ')' : ''}`,
      date: dividendDate,
      time: cleanTime,
      postingDate: dividendDate,
      type: 'income',
      accountId: dividendAccount
    });

    setDividendingStock(null);
  };

  return (
    <div className="flex-1 px-6 py-6 space-y-6 animate-fadeIn" style={getFontFamily()}>
      {/* Overview Card */}
      <div className="bg-gradient-to-br from-[#5D4037] to-[#4E342E] text-white p-6 rounded-[35px] shadow-lg flex flex-col gap-4 relative overflow-hidden">
        {/* Soft background circles */}
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full" />
        <div className="absolute -left-10 -top-10 w-24 h-24 bg-white/5 rounded-full" />

        <div className="flex justify-between items-center z-10">
          <div className="flex-1 flex flex-col justify-between gap-1">
            <span className="text-stone-500 font-bold text-xs uppercase tracking-wider">投資總本金</span>
            <span className="text-3xl font-black text-[#FFD54F]">${totalPrincipal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="w-[1px] bg-white/10 mx-4 self-stretch" />
          <div className="flex-1 flex flex-col justify-between gap-1 text-right">
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-stone-500 font-bold text-xs uppercase tracking-wider">預估總市值</span>
            </div>
            <span className="text-3xl font-black text-white">${totalMarketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
        </div>

        {/* Real-Time Total P/L & ROI Stats */}
        <div className="border-t border-white/10 pt-3 flex items-center justify-between z-10 text-xs font-bold">
          <div className="flex items-center gap-1.5">
            <span className="text-stone-300">未實現損益：</span>
            <span className={`font-black ${totalUnrealizedPL > 0 ? 'text-rose-400' : totalUnrealizedPL < 0 ? 'text-emerald-400' : 'text-stone-300'}`}>
              {totalUnrealizedPL > 0 ? `+` : ''}${Math.round(totalUnrealizedPL).toLocaleString()} ({totalROI > 0 ? `+` : ''}${totalROI.toFixed(2)}%)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-stone-300">已領股利：</span>
            <span className="font-black text-emerald-400">${totalDividends.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            {totalDividends > 0 && (
              <button 
                onClick={() => setShowDividendAnalysis(!showDividendAnalysis)}
                className="bg-white/15 hover:bg-white/25 active:scale-95 text-[10px] font-black px-2 py-0.5 rounded-full transition-all text-white flex items-center gap-0.5 ml-1"
              >
                {showDividendAnalysis ? '收起' : '分析'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Collapsible Dividend Analysis Dashboard */}
      <AnimatePresence>
        {showDividendAnalysis && totalDividends > 0 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: 'auto' }} 
            exit={{ opacity: 0, height: 0 }}
            className="bg-[#FFFDF5]/80 border border-stone-200/50 p-5 rounded-[30px] shadow-inner space-y-4 overflow-hidden"
          >
            {/* Year Selector */}
            <div className="flex items-center gap-2 border-b border-stone-200/40 pb-3 flex-wrap">
              <span className="text-xs font-black text-stone-500">篩選年份：</span>
              <button 
                onClick={() => setSelectedDividendYear('all')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all active:scale-95 ${selectedDividendYear === 'all' ? 'bg-[#5D4037] text-white shadow-sm' : 'bg-white border border-stone-200/60 text-stone-500 hover:text-[#5D4037]'}`}
              >
                全部
              </button>
              {dividendYears.map(yr => (
                <button 
                  key={yr}
                  onClick={() => setSelectedDividendYear(yr)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all active:scale-95 ${selectedDividendYear === yr ? 'bg-[#5D4037] text-white shadow-sm' : 'bg-white border border-stone-200/60 text-stone-500 hover:text-[#5D4037]'}`}
                >
                  {yr}年
                </button>
              ))}
              <div className="ml-auto text-xs font-bold text-stone-500">
                {selectedDividendYear === 'all' ? '歷年累計' : `${selectedDividendYear} 年`}股利：
                <span className="font-black text-emerald-600 ml-1 text-sm">${filteredYearTotal.toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-4">
              {/* Stocks Breakdown */}
              <div className="space-y-2">
                <span className="text-xs font-black text-[#5D4037] flex items-center gap-1">
                  📈 股票/基金股利佔比
                </span>
                <div className="space-y-1.5 max-h-44 overflow-y-auto no-scrollbar animate-fadeIn">
                  {dividendStats.stockList.length === 0 ? (
                    <p className="text-stone-400 text-[10px] font-bold">暫無統計資料</p>
                  ) : (
                    dividendStats.stockList.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => setDividendDetailTarget({ type: 'stock', name: item.name })}
                        className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-stone-100/50 text-xs shadow-sm cursor-pointer hover:border-[#FFD54F]/50 hover:shadow-md transition-all active:scale-[0.99]"
                      >
                        <span className="font-bold text-stone-600 min-w-0 flex-1 leading-tight">{item.name}</span>
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                          <span className="font-black text-emerald-600">${item.val.toLocaleString()}</span>
                          <span className="text-stone-500 text-[11px]">›</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Banks Breakdown */}
              <div className="space-y-2">
                <span className="text-xs font-black text-[#5D4037] flex items-center gap-1">
                  💳 匯入銀行分佈
                </span>
                <div className="space-y-1.5 max-h-44 overflow-y-auto no-scrollbar animate-fadeIn">
                  {dividendStats.bankList.length === 0 ? (
                    <p className="text-stone-400 text-[10px] font-bold">暫無統計資料</p>
                  ) : (
                    dividendStats.bankList.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => setDividendDetailTarget({ type: 'bank', name: item.name })}
                        className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-stone-100/50 text-xs shadow-sm cursor-pointer hover:border-[#FFD54F]/50 hover:shadow-md transition-all active:scale-[0.99]"
                      >
                        <span className="font-bold text-stone-600 min-w-0 flex-1 leading-tight">{item.name}</span>
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                          <span className="font-black text-[#5D4037]">${item.val.toLocaleString()}</span>
                          <span className="text-stone-500 text-[11px]">›</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 待補股數：帳戶記了買股票扣款、還沒照對帳單補股數 */}
      <PendingStockBuys records={records} accounts={accounts} onFill={setFillingRecord} />
      <StockBuyFillModal
        record={fillingRecord}
        records={records}
        onClose={() => setFillingRecord(null)}
        onSave={(oldRec, newRec) => onUpdateRecord(oldRec, newRec)}
      />

      {/* Holdings Section Header */}
      <div className="flex flex-col gap-3 border-b border-[#5D4037]/10 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase size={20} className="text-[#5D4037]" />
            <h3 className="text-lg font-black text-[#5D4037]">持有投資組合</h3>
          </div>
          <button 
            onClick={handleOpenStockAdd}
            className="bg-[#5D4037] text-[#FFD54F] hover:bg-[#4E342E] transition-all px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1 active:scale-95 shadow-sm"
          >
            <Plus size={14} /> 新增持股/基金
          </button>
        </div>

        {/* 券商篩選標籤頁 (Broker Filter Tabs) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => setSelectedBrokerFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
              selectedBrokerFilter === 'all'
                ? 'bg-[#5D4037] text-white shadow-sm'
                : 'bg-white/80 text-stone-500 border border-stone-200/60 hover:bg-stone-100'
            }`}
          >
            全部券商 ({selectedBrokerFilter === 'all' && displayStockGroups.length !== calibratedStocks.length ? `${displayStockGroups.length} 檔 / ` : ''}${calibratedStocks.length} 筆)
          </button>
          {accounts
            .filter(a => a.type !== 'points' && (a.type === 'investment' || calibratedStocks.some(s => s.linkedAccount === a.id)))
            .map(acc => {
              const count = calibratedStocks.filter(s => s.linkedAccount === acc.id).length;
              return (
                <button
                  key={acc.id}
                  onClick={() => setSelectedBrokerFilter(acc.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                    selectedBrokerFilter === acc.id
                      ? 'bg-[#5D4037] text-[#FFD54F] shadow-sm'
                      : 'bg-white/80 text-stone-500 border border-stone-200/60 hover:bg-stone-100'
                  }`}
                >
                  <span>{acc.icon || '🏦'}</span>
                  <span>{acc.name}</span>
                  <span className="text-[10px] opacity-75">({count})</span>
                </button>
              );
            })}
        </div>
      </div>

      {/* Holdings List */}
      <div className="space-y-4">
        {displayStockGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4 bg-white/30 rounded-[30px] border-2 border-dashed border-stone-200/55 p-6">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-stone-300 shadow-sm">
              <Coins size={30} />
            </div>
            <p className="text-stone-400 font-bold text-sm">
              {stocks.length === 0 ? '目前沒有持有任何股票或基金，點擊上方按鈕新增！' : '此券商帳戶下目前無持股標的'}
            </p>
          </div>
        ) : (
          displayStockGroups.map(group => {
            const hasCurrentPrice = group.currentPrice !== undefined && group.currentPrice > 0;
            const currentPrice = hasCurrentPrice ? group.currentPrice! : group.avgPrice;
            const marketValue = group.totalShares * currentPrice;
            const sellingDeduction = hasCurrentPrice 
              ? calculateEstimatedSellingDeduction(group.code, group.category, marketValue)
              : { estimatedTax: 0, estimatedFee: 0, totalDeduction: 0 };
            const unrealizedPL = hasCurrentPrice ? (marketValue - group.totalCost - sellingDeduction.totalDeduction) : 0;
            const roi = (hasCurrentPrice && group.totalCost > 0) ? (unrealizedPL / group.totalCost) * 100 : 0;
            const isFund = group.category === 'fund';
            const unitLabel = isFund ? '單位' : '股';
            const isExpanded = !!expandedStockCodes[group.code];
            const firstSub = group.subStocks[0];
            const linkedAcc = (Array.isArray(accounts) ? accounts : []).find(a => a.id === firstSub?.linkedAccount);

            // 抓取最新一筆屬於本券商標的的「買入交易紀錄」 (Latest Buy Trade for this specific broker stock) 及其備註
            const latestTradeInfo = (() => {
              if (!firstSub) return null;
              const keywords = getStockMatchKeywords(firstSub.code);
              const targetBrokerId = firstSub.linkedAccount;
              
              // 嚴格過濾「買入交易」，且限制必須歸屬於本持股所繫結之券商帳戶 (避免元大證券卡片顯示國泰證券或一般銀行筆記)
              const buyRecords = (Array.isArray(records) ? records : [])
                .filter(r => {
                  if (r.isDeleted || !r.note) return false;

                  const isBuyTag = Boolean(r.note && (r.note.includes('[買入]') || r.note.includes('[加購]')));
                  const hasStockId = Boolean((r as any).stockId);

                  // 只認 app 記的買入：有 [買入]/[加購] 標記或選了股票（stockId）。
                  // 備註剛好提到代號的（如「要投資006208的」「買00878剩的錢」）不算，就算記在證券帳戶也一樣。
                  if (!isBuyTag && !hasStockId) return false;

                  // 1. 標的比對 (比對純數字代碼 006208、中文名稱與原字串)
                  const matchesStock = 
                    (hasStockId && (r as any).stockId === firstSub.id) ||
                    ((r as any).symbol && keywords.some(k => (r as any).symbol.includes(k))) ||
                    keywords.some(k => r.note.includes(k));
                  
                  if (!matchesStock) return false;

                  // 2. 券商帳戶歸屬比對 (獨立隔離各券商之買入紀錄)
                  if (targetBrokerId) {
                    const tradeBrokerId = (r as any).brokerAccountId || r.accountId || (r as any).brokerId;
                    const recordResolvedBroker = resolveBrokerAccount(r.accountId, accounts);
                    const isIdMatch = tradeBrokerId === targetBrokerId || recordResolvedBroker === targetBrokerId;
                    
                    if (!isIdMatch) return false;
                  }

                  // 3. 類型比對 (排除股利/配息紀錄)
                  const isDividend = r.type === 'income' || r.note.includes('[股利]') || r.note.includes('股利') || r.note.includes('配息');
                  const isBuy = isBuyTag || r.type === 'expense' || !isDividend;
                  return isBuy && !isDividend;
                })
                .sort((a, b) => {
                  const dateDiff = (b.date || '').localeCompare(a.date || '');
                  if (dateDiff !== 0) return dateDiff;
                  return (b.time || '').localeCompare(a.time || '');
                });

              const totalBuyCount = buyRecords.length;
              const latestBuyRecord = buyRecords[0];

              let latestDate = latestBuyRecord ? latestBuyRecord.date : firstSub.purchaseDate;
              if (latestDate) {
                latestDate = latestDate.replace(/-/g, '/');
              }

              const dateLabel = totalBuyCount > 1 ? '🗓️ 最後買入：' : '🗓️ 購買日期：';

              let latestNote = '';
              if (latestBuyRecord && latestBuyRecord.note) {
                const bracketMatch = latestBuyRecord.note.match(/\(([^)]+)\)$/);
                if (bracketMatch && bracketMatch[1] && !bracketMatch[1].startsWith('含手續費')) {
                  latestNote = bracketMatch[1];
                } else if (!latestBuyRecord.note.startsWith('[買入]')) {
                  latestNote = latestBuyRecord.note;
                }
              }

              if (!latestNote && firstSub.notes) {
                latestNote = firstSub.notes;
              }

              return {
                latestDate,
                dateLabel,
                latestNote
              };
            })();

            return (
              <div 
                key={group.code + (group.isAggregated ? '-aggregated' : `-${firstSub?.id}`)} 
                onClick={() => {
                  setStockDetailFilter('all');
                  if (group.isAggregated) {
                    setSelectedStockForDetail({
                      id: `aggregated-${group.code}`,
                      code: group.code,
                      shares: group.totalShares,
                      avgPrice: group.avgPrice,
                      totalCost: group.totalCost,
                      fee: group.totalFee,
                      currentPrice: group.currentPrice,
                      category: group.subStocks[0]?.category || 'stock',
                      notes: '',
                      linkedAccount: ''
                    });
                  } else if (firstSub) {
                    setSelectedStockForDetail(firstSub);
                  }
                }}
                className="bg-white p-5 rounded-[30px] border-2 border-white shadow-sm flex flex-col gap-4 relative transition-all cursor-pointer hover:border-[#FFD54F]/40 hover:shadow-md active:scale-[0.99]"
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-black text-[#5D4037] tracking-tight">{group.code}</span>
                    <span className="bg-[#FFF9E3] text-[#8D6E63] border border-[#FFD54F]/30 text-[10px] font-black px-2 py-0.5 rounded-full">
                      {isFund ? '📊 基金' : '📈 股票/ETF'}
                    </span>
                    {group.isAggregated && (
                      <span className="bg-[#FFD54F]/20 text-[#5D4037] text-[10px] font-black px-2.5 py-0.5 rounded-full border border-[#FFD54F]/40 flex items-center gap-1">
                        <span>跨券商彙總</span>
                        <span className="bg-[#5D4037] text-white px-1.5 py-0.2 rounded-full text-[9px]">
                          {group.subStocks.length} 家券商
                        </span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {group.isAggregated ? (
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedStockCodes(prev => ({
                            ...prev,
                            [group.code]: !prev[group.code]
                          }));
                        }}
                        className="px-3 py-1.5 bg-[#FFF9E3] hover:bg-[#FFD54F]/20 text-[#5D4037] border border-[#FFD54F]/40 rounded-xl text-xs font-black transition-all flex items-center gap-1 active:scale-95 shadow-2xs"
                      >
                        <span>券商細項</span>
                        <ChevronDown size={14} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    ) : (
                      <>
                        <button 
                          onClick={(e) => { e.stopPropagation(); if (firstSub) handleOpenStockEdit(firstSub); }}
                          className="p-2 text-stone-300 hover:text-[#FFD54F] transition-colors"
                          title="編輯持股"
                        >
                          <Pencil size={18} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (firstSub && window.confirm(`確定要刪除 ${group.code} 嗎？此操作僅刪除項目記錄，已建立的交易明細將被保留。`)) {
                              onDeleteStock(firstSub.id);
                            }
                          }}
                          className="p-2 text-stone-300 hover:text-rose-500 transition-colors"
                          title="刪除持股"
                        >
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Broker Badges Row (If aggregated) */}
                {group.isAggregated && (
                  <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-stone-600 bg-stone-50/80 p-2.5 rounded-2xl border border-stone-200/40">
                    <span className="text-sm font-medium text-stone-600">🏛️ 分屬券商：</span>
                    {group.brokerAccountIds.map(accId => {
                      const acc = (Array.isArray(accounts) ? accounts : []).find(a => a.id === accId);
                      const subCount = group.subStocks.filter(s => s.linkedAccount === accId).length;
                      return (
                        <span key={accId} className="bg-white text-[#5D4037] px-2.5 py-1 rounded-xl text-xs font-bold border border-stone-200 shadow-2xs flex items-center gap-1">
                          <span>{acc?.icon || '🏦'}</span>
                          <span>{acc?.name || '未知帳戶'}</span>
                          {subCount > 1 && <span className="text-xs text-stone-400">({subCount}筆)</span>}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Details Grid */}
                <div className="grid grid-cols-3 gap-2 bg-[#FFFDF5]/60 p-3.5 rounded-2xl border border-stone-100/50">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-stone-600 mb-0.5">
                      {group.isAggregated ? '總持股數量' : '持有數量'}
                    </span>
                    <span className="text-sm font-black text-[#5D4037]">
                      {group.totalShares.toLocaleString()} {unitLabel}
                      {!isFund && group.totalShares >= 1000 && (
                        <span className="text-xs text-stone-500 font-medium block mt-0.5">({(group.totalShares / 1000).toFixed(2)} 張)</span>
                      )}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-stone-600 mb-0.5">
                      {group.isAggregated ? '綜合平均買價' : (isFund ? '申購淨值' : '平均買價')}
                    </span>
                    <span className="text-sm font-black text-[#5D4037]">
                      ${group.avgPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex flex-col justify-between">
                    <span className="text-sm font-medium text-stone-600 mb-0.5">
                      {group.isAggregated ? '總投入成本' : '投入成本'}
                    </span>
                    <div>
                      <span className="text-sm font-black text-[#E91E63]">${Math.round(group.totalCost).toLocaleString()}</span>
                      <span className="text-xs font-medium text-stone-500 block leading-tight mt-0.5">
                        (含手續費 ${Math.round(group.totalFee || 0).toLocaleString()})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Real-Time P/L Stats Row (If current market price is set) */}
                {hasCurrentPrice ? (
                  <div className="grid grid-cols-3 gap-2 bg-stone-50/80 p-3 rounded-2xl border border-stone-200/40">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-stone-600 mb-0.5">{isFund ? '最新淨值' : '目前市價'}</span>
                      <span className="text-sm font-black text-[#5D4037]">${group.currentPrice!.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-stone-600 mb-0.5 flex flex-wrap items-center gap-0.5">
                        <span>{group.isAggregated ? '當前總市值' : '目前市值'}</span>
                        {group.evaluationDate && (
                          <span className="text-xs text-stone-400 font-normal">({group.evaluationDate.replace(/-/g, '/')})</span>
                        )}
                      </span>
                      <span className="text-sm font-black text-[#5D4037]">${Math.round(marketValue).toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col">
                      {/* 手機版：兩行 */}
                      <span className="block md:hidden text-xs font-medium text-stone-600 mb-0.5 leading-tight">
                        <div>未實現損益</div>
                        <div>報酬率</div>
                      </span>
                      {/* 電腦版：單行 */}
                      <span className="hidden md:block text-sm font-medium text-stone-600 mb-0.5 whitespace-nowrap">
                        未實現損益 / 報酬率
                      </span>
                      <span className={`text-sm font-black ${unrealizedPL > 0 ? 'text-rose-500' : unrealizedPL < 0 ? 'text-emerald-600' : 'text-stone-600'}`}>
                        {unrealizedPL > 0 ? '+' : ''}${Math.round(unrealizedPL).toLocaleString()}
                        <span className="block text-xs font-bold">({roi > 0 ? '+' : ''}{roi.toFixed(2)}%)</span>
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm font-medium text-stone-500 px-1 italic leading-relaxed my-1">
                    💡 點擊「編輯」填入目前市價/淨值，系統將自動計算未實現損益與報酬率
                  </div>
                )}

                {/* Expanded Broker Sub-List Drawer */}
                {group.isAggregated && isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-[#FFFDF5] p-4 rounded-2xl border-2 border-[#FFD54F]/40 space-y-3 shadow-inner"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between text-xs font-black text-[#5D4037] border-b border-stone-200/60 pb-2">
                      <span>🏛️ 各券商獨立持股明細 ({group.subStocks.length} 筆)</span>
                      <span className="text-xs text-stone-500 font-medium">可獨立編輯與管理交易</span>
                    </div>

                    <div className="space-y-2.5">
                      {group.subStocks.map(sub => {
                        const subCost = sub.totalCost !== undefined && sub.totalCost > 0 ? sub.totalCost : Math.round(sub.shares * sub.avgPrice);
                        const acc = (Array.isArray(accounts) ? accounts : []).find(a => a.id === sub.linkedAccount);
                        return (
                          <div 
                            key={sub.id}
                            onClick={() => {
                              setStockDetailFilter('all');
                              setSelectedStockForDetail(sub);
                            }}
                            className="bg-white p-3.5 rounded-xl border border-stone-200/60 flex flex-col gap-2 shadow-2xs hover:border-[#FFD54F] cursor-pointer transition-all active:scale-[0.99]"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="text-base">{acc?.icon || '🏦'}</span>
                                <span className="text-xs font-black text-[#5D4037]">{acc?.name || '未知券商'}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button 
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleOpenStockEdit(sub); }}
                                  className="p-1.5 text-stone-400 hover:text-[#5D4037] hover:bg-stone-100 rounded-lg transition-colors text-xs font-bold flex items-center gap-0.5"
                                  title="編輯此券商持股"
                                >
                                  <Pencil size={13} />
                                  <span>編輯</span>
                                </button>
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm(`確定要刪除 ${acc?.name || ''} 的 ${sub.code} 持股紀錄嗎？`)) {
                                      onDeleteStock(sub.id);
                                    }
                                  }}
                                  className="p-1.5 text-stone-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors text-xs font-bold flex items-center gap-0.5"
                                  title="刪除此券商持股"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-xs font-bold text-stone-600 bg-stone-50/70 p-2.5 rounded-lg border border-stone-100">
                              <div>
                                <span className="text-sm font-medium text-stone-600 block mb-0.5">持股數量</span>
                                <span className="text-sm font-black text-[#5D4037]">{sub.shares.toLocaleString()} {unitLabel}</span>
                              </div>
                              <div>
                                <span className="text-sm font-medium text-stone-600 block mb-0.5">平均買價</span>
                                <span className="text-sm font-black text-[#5D4037]">${sub.avgPrice.toLocaleString()}</span>
                              </div>
                              <div>
                                <span className="text-sm font-medium text-stone-600 block mb-0.5">投入成本</span>
                                <span className="text-sm font-black text-[#E91E63]">${Math.round(subCost).toLocaleString()}</span>
                                <span className="text-xs font-medium text-stone-500 block mt-0.5">
                                  (手續費 ${Math.round(sub.fee || 0).toLocaleString()})
                                </span>
                              </div>
                            </div>

                            <div className="flex gap-2 pt-1">
                              <button 
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleOpenBuy(sub); }}
                                className="flex-1 py-1.5 bg-stone-50 hover:bg-[#FFD54F]/10 text-[#5D4037] rounded-lg font-bold text-[11px] border border-stone-200/50 flex items-center justify-center gap-1 active:scale-95"
                              >
                                <Plus size={12} /> 新增買入
                              </button>
                              <button 
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleOpenDividend(sub); }}
                                className="flex-1 py-1.5 bg-stone-50 hover:bg-emerald-50 text-[#5D4037] rounded-lg font-bold text-[11px] border border-stone-200/50 flex items-center justify-center gap-1 active:scale-95"
                              >
                                <Coins size={12} className="text-emerald-500" /> 股利/配息
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* Bottom Row (For non-aggregated single stock) */}
                {!group.isAggregated && (
                  <>
                    <div className="flex flex-col gap-2 px-1 py-1">
                      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-sm font-medium leading-relaxed">
                        <div className="flex items-center gap-1">
                          <span className="text-stone-500 font-medium">💳 交割帳戶：</span>
                          <span className="text-[#5D4037] font-semibold">{linkedAcc ? `${linkedAcc.icon} ${linkedAcc.name}` : '未指定'}</span>
                        </div>
                        {latestTradeInfo?.latestDate && (
                          <div className="flex items-center gap-1">
                            <span className="text-stone-500 font-medium">{latestTradeInfo.dateLabel}</span>
                            <span className="text-[#5D4037] font-semibold">{latestTradeInfo.latestDate}</span>
                          </div>
                        )}
                      </div>
                      {latestTradeInfo?.latestNote && (
                        <div className="text-sm font-medium text-stone-600 italic leading-relaxed pt-1.5 border-t border-stone-100">
                          💡 {latestTradeInfo.latestNote}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 border-t border-stone-100/60 pt-3">
                      <button 
                        onClick={(e) => { e.stopPropagation(); if (firstSub) handleOpenBuy(firstSub); }}
                        className="flex-1 py-2.5 bg-stone-50 hover:bg-[#FFD54F]/10 active:scale-97 text-[#5D4037] rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1 border border-stone-200/30"
                      >
                        <Plus size={12} /> 新增買入
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); if (firstSub) handleOpenDividend(firstSub); }}
                        className="flex-1 py-2.5 bg-stone-50 hover:bg-emerald-50 active:scale-97 text-[#5D4037] rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1 border border-stone-200/30"
                      >
                        <Coins size={12} className="text-emerald-500" /> 股利/配息入帳
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 1. Modal: Add/Edit Stock */}
      <AnimatePresence>
        {isStockModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsStockModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#FFF9E3] w-full max-w-sm rounded-[40px] p-8 shadow-2xl relative z-10 border-2 border-white flex flex-col gap-4 max-h-[85vh] overflow-y-auto no-scrollbar"
              style={getFontFamily()}
            >
              <h3 className="text-xl font-black text-[#5D4037] text-center">
                {editingStock ? '編輯投資項目' : '新增投資項目'}
              </h3>

              {/* 投資類別切換 */}
              <div className="space-y-1">
                <label className="text-xs font-black text-stone-500 px-1">投資類別</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-stone-100/60 rounded-2xl border border-stone-200/40">
                  <button
                    type="button"
                    onClick={() => setStockCategory('stock')}
                    className={`py-2.5 rounded-xl text-xs font-black transition-all ${stockCategory === 'stock' ? 'bg-white text-[#5D4037] shadow-sm border border-stone-200/60' : 'text-stone-500 hover:text-[#5D4037]'}`}
                  >
                    📈 股票 / ETF
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockCategory('fund')}
                    className={`py-2.5 rounded-xl text-xs font-black transition-all ${stockCategory === 'fund' ? 'bg-white text-[#5D4037] shadow-sm border border-stone-200/60' : 'text-stone-500 hover:text-[#5D4037]'}`}
                  >
                    📊 基金 (Funds)
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-stone-500 px-1">
                  {stockCategory === 'fund' ? '基金名稱 / 代碼' : '股票名稱 / 代碼'}
                </label>
                <input 
                  type="text"
                  value={stockCode}
                  onChange={e => setStockCode(e.target.value)}
                  className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-black text-sm text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                  placeholder={stockCategory === 'fund' ? "例如: 安聯收益成長基金 或 0050" : "例如: 006208 富邦台50"}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-black text-stone-500 px-1">
                    {stockCategory === 'fund' ? '持有單位數' : '持股數量 (股)'}
                  </label>
                  <input 
                    type="number"
                    step="any"
                    value={stockShares}
                    onChange={e => handleStockSharesChange(e.target.value)}
                    className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-black text-sm text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                    placeholder={stockCategory === 'fund' ? "例如: 125.4567" : "例如: 2000"}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-stone-500 px-1">
                    {stockCategory === 'fund' ? '申購淨值 (元)' : '平均買價 (元)'}
                  </label>
                  <input 
                    type="number"
                    step="any"
                    value={stockAvgPrice}
                    onChange={e => handleStockAvgPriceChange(e.target.value)}
                    className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-black text-sm text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                    placeholder={stockCategory === 'fund' ? "例如: 15.42" : "例如: 85.5"}
                  />
                </div>
              </div>

              {/* 投入總成本 (含手續費) 與手續費選填 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-xs font-black text-stone-500">投入總成本 (元)</label>
                    {isStockCostManualOverride ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsStockCostManualOverride(false);
                          const sh = parseFloat(stockShares) || 0;
                          const price = parseFloat(stockAvgPrice) || 0;
                          const fee = parseFloat(stockFee) || 0;
                          if (sh > 0 && price > 0) {
                            setStockTotalCost((Math.round(sh * price) + fee).toString());
                          }
                        }}
                        className="text-[10px] font-black text-amber-800 bg-amber-100 hover:bg-amber-200 px-1.5 py-0.5 rounded transition-all"
                        title="點擊重置為自動計算"
                      >
                        自訂總價 ✕
                      </button>
                    ) : (
                      <span className="text-[10px] font-black text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">
                        自動試算
                      </span>
                    )}
                  </div>
                  <input 
                    type="number"
                    step="any"
                    value={stockTotalCost}
                    onChange={e => handleStockTotalCostChange(e.target.value)}
                    className={`w-full p-4 bg-white border-2 rounded-2xl font-black text-sm outline-none shadow-sm focus:border-[#FFD54F] ${
                      isStockCostManualOverride ? 'border-amber-400 text-amber-900 bg-amber-50/30' : 'border-stone-50 text-[#E91E63]'
                    }`}
                    placeholder="可直接填對帳單交割總額"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-stone-500 px-1">手續費 (元)</label>
                  <input 
                    type="number"
                    step="any"
                    value={stockFee}
                    onChange={e => handleStockFeeChange(e.target.value)}
                    className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-black text-sm text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                    placeholder="預設 0"
                  />
                </div>
              </div>

              {/* 目前市價 / 目前市值 防呆雙向連動 (用於損益與報酬率試算) */}
              <div className="space-y-2 bg-[#FFFDF5] p-3.5 rounded-2xl border border-stone-200/50">
                <div className="flex items-center justify-between px-1 gap-2 flex-wrap">
                  <span className="text-xs font-black text-[#5D4037]">💡 現值/損益試算 (選填，可雙向換算)</span>
                  <button
                    type="button"
                    onClick={() => setIsPriceHistoryOpen(true)}
                    className="text-[11px] font-black text-[#8D6E63] hover:text-[#5D4037] bg-[#FFF9E3] hover:bg-[#FFD54F]/30 border border-[#FFD54F]/50 px-2.5 py-1 rounded-xl transition-all flex items-center gap-1 shadow-2xs active:scale-95 cursor-pointer"
                    title="查看歷史市價評估記錄"
                  >
                    <span>🕒 查看市價歷史</span>
                    {stockPriceHistory.length > 0 && (
                      <span className="bg-[#5D4037] text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                        {stockPriceHistory.length}
                      </span>
                    )}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-stone-500 px-1">
                      {stockCategory === 'fund' ? '最新淨值 (元)' : '目前市價 (元)'}
                    </label>
                    <input 
                      type="number"
                      step="any"
                      value={stockCurrentPrice}
                      onChange={e => handleStockCurrentPriceChange(e.target.value)}
                      className="w-full p-3 bg-white border border-stone-200 rounded-xl font-black text-xs text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                      placeholder={stockCategory === 'fund' ? "如: 16.85" : "如: 107.9"}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-stone-500 px-1">
                      {stockCategory === 'fund' ? '目前總現值 (元)' : '目前總市值 (元)'}
                    </label>
                    <input 
                      type="number"
                      step="any"
                      value={stockCurrentMarketValue}
                      onChange={e => handleStockCurrentMarketValueChange(e.target.value)}
                      className="w-full p-3 bg-white border border-stone-200 rounded-xl font-black text-xs text-emerald-700 outline-none shadow-sm focus:border-[#FFD54F]"
                      placeholder="填總市值反推市價"
                    />
                  </div>
                </div>
                <div className="space-y-1 pt-1">
                  <label className="text-[11px] font-black text-stone-500 px-1">
                    {stockCategory === 'fund' ? '淨值評估日期' : '市值評估日期'}
                  </label>
                  <input 
                    type="date"
                    value={stockEvaluationDate}
                    onChange={e => setStockEvaluationDate(e.target.value)}
                    className="w-full p-3 bg-white border border-stone-200 rounded-xl font-bold text-xs text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-stone-500 px-1">證券交割帳戶 / 扣款帳戶</label>
                <GroupedAccountDropdown
                  accounts={accounts}
                  value={stockLinkedAccount}
                  onChange={setStockLinkedAccount}
                  placeholder="選擇交割帳戶 / 點數戶"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-1 min-h-[1.5rem]">
                    <label className="text-xs font-black text-stone-500 truncate">買入日期 (成交日)</label>
                  </div>
                  <input 
                    type="date"
                    value={stockPurchaseDate}
                    onChange={e => handleStockPurchaseDateChange(e.target.value)}
                    className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-sm text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-1 min-h-[1.5rem]">
                    <label className="text-xs font-black text-stone-500 truncate">
                      交割日期 <span className="text-[10px] text-stone-400 font-bold">(扣款日)</span>
                    </label>
                    <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">
                      T+2 扣款
                    </span>
                  </div>
                  <input 
                    type="date"
                    value={stockSettlementDate}
                    onChange={e => {
                      setStockSettlementDate(e.target.value);
                      setIsStockSettlementManual(true);
                    }}
                    className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-sm text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-stone-500 px-1">備註說明</label>
                <textarea 
                  value={stockNotes}
                  onChange={e => setStockNotes(e.target.value)}
                  className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-sm text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] resize-none h-20"
                  placeholder="可在此填寫您的投資備忘說明"
                />
              </div>

              <div className="flex w-full gap-3 mt-4">
                <button 
                  onClick={() => setIsStockModalOpen(false)}
                  className="flex-1 py-4 bg-stone-100 hover:bg-stone-200 text-[#5D4037] rounded-2xl font-bold transition-all text-sm"
                >
                  取消
                </button>
                <button 
                  onClick={handleSaveStockSubmit}
                  className="flex-1 py-4 bg-[#5D4037] text-white rounded-2xl font-black shadow-lg hover:bg-[#4E342E] transition-all text-sm"
                >
                  儲存持股
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Price Evaluation History List (市價歷史記錄) */}
      <AnimatePresence>
        {isPriceHistoryOpen && (
          <div className="fixed inset-0 z-[230] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsPriceHistoryOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#FFF9E3] w-full max-w-sm rounded-[35px] p-6 shadow-2xl relative z-10 border-2 border-white flex flex-col gap-4 max-h-[80vh] overflow-hidden"
              style={getFontFamily()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#5D4037]/10 pb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🕒</span>
                  <div>
                    <h4 className="text-base font-black text-[#5D4037]">市價歷史記錄</h4>
                    <p className="text-[11px] text-stone-500 font-bold">
                      {stockCode ? stockCode : (selectedStockForDetail?.code || '持股')} 歷史評估軌跡
                    </p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsPriceHistoryOpen(false)}
                  className="p-1.5 text-stone-400 hover:text-[#5D4037] hover:bg-stone-100 rounded-full transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* 折線圖：至少 2 筆記錄才顯示 */}
              <PriceHistoryChart history={stockPriceHistory} />

              {/* History Items List */}
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2.5 pr-0.5 min-h-[150px]">
                {stockPriceHistory.length === 0 ? (
                  <div className="text-center py-10 space-y-2">
                    <span className="text-3xl block">📊</span>
                    <p className="text-xs font-bold text-stone-400 leading-relaxed">
                      尚無歷史市價記錄<br/>
                      修改「目前市價」與「評估日期」並儲存時<br/>
                      系統將自動記錄歷史軌跡
                    </p>
                  </div>
                ) : (
                  stockPriceHistory
                    .slice()
                    .sort((a, b) => {
                      const dateA = a.date.replace(/\//g, '-');
                      const dateB = b.date.replace(/\//g, '-');
                      if (dateA !== dateB) return dateB.localeCompare(dateA);
                      return (b.createdAt || '').localeCompare(a.createdAt || '');
                    })
                    .map((item) => (
                      <div 
                        key={item.id}
                        className="bg-white p-3.5 rounded-2xl border border-stone-200/60 shadow-2xs flex items-center justify-between gap-3 hover:border-[#FFD54F] transition-all"
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-[#5D4037] bg-[#FFF9E3] border border-[#FFD54F]/40 px-2 py-0.5 rounded-lg">
                              📅 {item.date.replace(/-/g, '/')}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs pt-1">
                            <span className="font-medium text-stone-600">
                              市價: <span className="font-black text-[#5D4037]">${item.price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                            </span>
                            <span className="font-medium text-stone-600">
                              總市值: <span className="font-black text-emerald-700">${Math.round(item.marketValue).toLocaleString()}</span>
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`確定要刪除 ${item.date.replace(/-/g, '/')} 的市價記錄嗎？`)) {
                              const nextHistory = stockPriceHistory.filter(h => h.id !== item.id);
                              setStockPriceHistory(nextHistory);
                              if (selectedStockForDetail && !isStockModalOpen) {
                                const updated = {
                                  ...selectedStockForDetail,
                                  priceHistory: nextHistory.length > 0 ? nextHistory : undefined
                                };
                                onSaveStock(updated);
                                setSelectedStockForDetail(updated);
                              }
                            }
                          }}
                          className="p-2 text-stone-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors shrink-0 cursor-pointer"
                          title="刪除此筆歷史"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                )}
              </div>

              {/* Footer */}
              <div className="pt-2 border-t border-stone-200/60 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsPriceHistoryOpen(false)}
                  className="w-full py-3 bg-[#5D4037] text-white text-xs font-black rounded-xl hover:bg-[#4E342E] transition-all shadow-sm cursor-pointer"
                >
                  完成
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Modal: Buy Stock / Edit Buy Transaction */}
      <AnimatePresence>
        {buyingStock && (
          <div className="fixed inset-0 z-[220] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => { setBuyingStock(null); setEditingBuyRecord(null); }}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#FFF9E3] w-full max-w-sm rounded-[40px] p-8 shadow-2xl relative z-10 border-2 border-white flex flex-col gap-4 max-h-[85vh] overflow-y-auto no-scrollbar"
              style={getFontFamily()}
            >
              <h3 className="text-xl font-black text-[#5D4037] text-center">
                {editingBuyRecord ? '編輯買入交易' : (buyingStock.category === 'fund' ? '買入 / 申購基金' : '買入股票')}
              </h3>
              <p className="text-[#5D4037] text-sm font-bold text-center bg-stone-100/50 p-2.5 rounded-xl border border-stone-200/30">
                投資標的：<span className="font-black text-[#E91E63]">{buyingStock.code}</span>
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-black text-stone-500 px-1">
                    {buyingStock.category === 'fund' ? '申購單位數' : '買入股數 (股)'}
                  </label>
                  <input 
                    type="number"
                    step="any"
                    value={buyShares}
                    onChange={e => handleBuySharesChange(e.target.value)}
                    className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-black text-sm text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                    placeholder={buyingStock.category === 'fund' ? "例如: 125.4567" : "例如: 1000"}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-stone-500 px-1">
                    {buyingStock.category === 'fund' ? '申購淨值 (元)' : '買入單價 (元)'}
                  </label>
                  <input 
                    type="number"
                    step="any"
                    value={buyPrice}
                    onChange={e => handleBuyPriceChange(e.target.value)}
                    className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-black text-sm text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                    placeholder={buyingStock.category === 'fund' ? "例如: 15.42" : "例如: 86.2"}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-stone-500 px-1">交割扣款帳戶</label>
                <GroupedAccountDropdown
                  accounts={accounts}
                  value={buyAccount}
                  onChange={setBuyAccount}
                  placeholder="選擇交割帳戶 / 點數戶"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-1 min-h-[1.5rem]">
                    <label className="text-xs font-black text-stone-500 truncate">買入日期 (成交日)</label>
                  </div>
                  <input 
                    type="date"
                    value={buyDate}
                    onChange={e => handleBuyDateChange(e.target.value)}
                    className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-sm text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-1 min-h-[1.5rem]">
                    <label className="text-xs font-black text-stone-500 truncate">
                      交割日期 <span className="text-[10px] text-stone-400 font-bold">(扣款日)</span>
                    </label>
                    <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">
                      T+2 扣款
                    </span>
                  </div>
                  <input 
                    type="date"
                    value={buySettlementDate}
                    onChange={e => {
                      setBuySettlementDate(e.target.value);
                      setIsBuySettlementManual(true);
                    }}
                    className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-sm text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-1 min-h-[1.5rem]">
                    <label className="text-xs font-black text-stone-500 truncate">買入總金額 (元)</label>
                    {isBuyCostManualOverride ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsBuyCostManualOverride(false);
                          const sh = parseFloat(buyShares) || 0;
                          const price = parseFloat(buyPrice) || 0;
                          const fee = parseFloat(buyFee) || 0;
                          if (sh > 0 && price > 0) {
                            setBuyTotalCost((Math.round(sh * price) + fee).toString());
                          }
                        }}
                        className="text-[10px] font-black text-amber-800 bg-amber-100 hover:bg-amber-200 px-1.5 py-0.5 rounded transition-all shrink-0"
                        title="點擊重置為自動計算"
                      >
                        自訂總價 ✕
                      </button>
                    ) : (
                      <span className="text-[10px] font-black text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded shrink-0">
                        自動試算
                      </span>
                    )}
                  </div>
                  <input 
                    type="number"
                    step="any"
                    value={buyTotalCost}
                    onChange={e => handleBuyTotalCostChange(e.target.value)}
                    className={`w-full p-4 bg-white border-2 rounded-2xl font-black text-sm outline-none shadow-sm focus:border-[#FFD54F] ${
                      isBuyCostManualOverride ? 'border-amber-400 text-amber-900 bg-amber-50/30' : 'border-stone-50 text-[#E91E63]'
                    }`}
                    placeholder="可直接填對帳單交割總額"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-1 min-h-[1.5rem]">
                    <label className="text-xs font-black text-stone-500 truncate">手續費 (元)</label>
                  </div>
                  <input 
                    type="number"
                    step="any"
                    value={buyFee}
                    onChange={e => handleBuyFeeChange(e.target.value)}
                    className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-black text-sm text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                    placeholder="預設 0"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-stone-500 px-1">補充說明</label>
                <input 
                  type="text"
                  value={buyNotes}
                  onChange={e => setBuyNotes(e.target.value)}
                  className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-sm text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                  placeholder="選填備註說明"
                />
              </div>

              <div className="flex w-full gap-3 mt-4">
                <button 
                  onClick={() => { setBuyingStock(null); setEditingBuyRecord(null); }}
                  className="flex-1 py-4 bg-stone-100 hover:bg-stone-200 text-[#5D4037] rounded-2xl font-bold transition-all text-sm"
                >
                  取消
                </button>
                <button 
                  onClick={handleBuySubmit}
                  className="flex-1 py-4 bg-[#5D4037] text-white rounded-2xl font-black shadow-lg hover:bg-[#4E342E] transition-all text-sm"
                >
                  {editingBuyRecord ? '確認修改' : '確認買入'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. Modal: Add Dividend */}
      <AnimatePresence>
        {dividendingStock && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setDividendingStock(null)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#FFF9E3] w-full max-w-sm rounded-[40px] p-8 shadow-2xl relative z-10 border-2 border-white flex flex-col gap-4 max-h-[85vh] overflow-y-auto no-scrollbar"
              style={getFontFamily()}
            >
              <h3 className="text-xl font-black text-[#5D4037] text-center">股利入帳</h3>
              <p className="text-[#5D4037] text-sm font-bold text-center bg-stone-100/50 p-2.5 rounded-xl border border-stone-200/30">
                持股對象：<span className="font-black text-[#E91E63]">{dividendingStock.code}</span>
              </p>

              <div className="space-y-1">
                <label className="text-xs font-black text-stone-500 px-1">實收股利金額 (元)</label>
                <input 
                  type="number"
                  value={dividendAmount}
                  onChange={e => setDividendAmount(e.target.value)}
                  className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-black text-sm text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                  placeholder="例如: 5000"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-stone-500 px-1">匯入銀行帳戶 / 點數戶</label>
                <GroupedAccountDropdown
                  accounts={accounts}
                  value={dividendAccount}
                  onChange={setDividendAccount}
                  placeholder="選擇匯入帳戶 / 點數戶"
                />
              </div>

              <div className="grid grid-cols-[3fr_2fr] gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-black text-stone-500 px-1">入帳日期</label>
                  <input 
                    type="date"
                    value={dividendDate}
                    onChange={e => setDividendDate(e.target.value)}
                    className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-sm text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                    style={getFontFamily()}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-stone-500 px-1">入帳時間</label>
                  <input 
                    type="time"
                    value={dividendTime}
                    onChange={e => setDividendTime(e.target.value)}
                    className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-sm text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                    style={getFontFamily()}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-stone-500 px-1">備註說明</label>
                <input 
                  type="text"
                  value={dividendNotes}
                  onChange={e => setDividendNotes(e.target.value)}
                  className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-sm text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                  placeholder="選填備註說明"
                />
              </div>

              <div className="flex w-full gap-3 mt-4">
                <button 
                  onClick={() => setDividendingStock(null)}
                  className="flex-1 py-4 bg-stone-100 hover:bg-stone-200 text-[#5D4037] rounded-2xl font-bold transition-all text-sm"
                >
                  取消
                </button>
                <button 
                  onClick={handleDividendSubmit}
                  className="flex-1 py-4 bg-[#5D4037] text-white rounded-2xl font-black shadow-lg hover:bg-[#4E342E] transition-all text-sm"
                >
                  確認入帳
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. Modal: Stock Transaction Details */}
      <AnimatePresence>
        {selectedStockForDetail && (
          <div className={`fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 ${editingRecord ? 'pointer-events-none' : ''}`}>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setSelectedStockForDetail(null)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#FFF9E3] w-[90%] max-w-md md:max-w-[880px] rounded-[40px] p-6 sm:p-8 shadow-2xl relative z-10 border-2 border-white flex flex-col gap-5 max-h-[85vh] overflow-hidden"
              style={getFontFamily()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#5D4037]/10 pb-3 shrink-0">
                <h3 className="text-xl font-black text-[#5D4037]">
                  {selectedStockForDetail.code} 明細
                </h3>
                <button 
                  onClick={() => setSelectedStockForDetail(null)} 
                  className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <X size={18} className="text-stone-400" />
                </button>
              </div>

              {/* Body: Mobile single-column, Desktop 2-column split (Left 250px fixed, Right 1fr) */}
              <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-5 flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 custom-scrollbar">
                {/* Left Column: Overview Stats (Locked 250px width on desktop) */}
                <div className="flex flex-col gap-2 w-full md:w-[250px] md:min-w-[250px] shrink-0">
                  {/* Collapsible Overview Header */}
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOverviewCollapsed(!isOverviewCollapsed);
                    }}
                    className="flex items-center justify-between cursor-pointer py-1.5 px-2 group select-none hover:bg-stone-100/50 rounded-xl transition-colors"
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-black text-stone-500 uppercase tracking-widest block">
                        持股數據總覽
                      </span>
                      {isOverviewCollapsed ? (
                        <div className="text-[13px] font-medium text-[#5D4037] truncate bg-[#FFFDF5] border border-stone-200/60 px-3 py-1 rounded-xl shadow-2xs flex items-center gap-1.5 shrink-1 min-w-0 mt-1">
                          <span className="font-bold">{selectedStockForDetail.shares.toLocaleString()}</span>
                          <span>{selectedStockForDetail.category === 'fund' ? '單位' : '股'}</span>
                          <span className="text-stone-300">｜</span>
                          <span>均價</span>
                          <span className="font-bold">${selectedStockForDetail.avgPrice.toLocaleString()}</span>
                          <span className="text-stone-300">｜</span>
                          <span>成本</span>
                          <span className="font-bold">${Math.round(selectedStockForDetail.totalCost !== undefined ? selectedStockForDetail.totalCost : selectedStockForDetail.shares * selectedStockForDetail.avgPrice).toLocaleString()}</span>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-stone-400 group-hover:text-stone-600 transition-colors block mt-0.5">
                          (點擊收合)
                        </span>
                      )}
                    </div>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsOverviewCollapsed(!isOverviewCollapsed);
                      }}
                      className="p-1 hover:bg-stone-200/60 rounded-lg text-stone-500 transition-colors shrink-0 ml-1.5"
                      title={isOverviewCollapsed ? "展開數據總覽" : "收合數據總覽"}
                    >
                      {isOverviewCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                    </button>
                  </div>
                  
                  <AnimatePresence initial={false}>
                    {!isOverviewCollapsed && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-3 md:grid-cols-1 gap-3 bg-[#FFFDF5]/80 p-4 rounded-3xl border border-stone-100/50 text-center md:text-left">
                          <div className="md:p-2 md:border-b md:border-stone-100/60">
                            <span className="text-sm font-medium text-stone-600 block mb-0.5">持股數量</span>
                            <span className="text-base font-black text-[#5D4037]">{selectedStockForDetail.shares.toLocaleString()} {selectedStockForDetail.category === 'fund' ? '單位' : '股'}</span>
                          </div>
                          <div className="md:p-2 md:border-b md:border-stone-100/60">
                            <span className="text-sm font-medium text-stone-600 block mb-0.5">平均買價</span>
                            <span className="text-base font-black text-[#5D4037]">${selectedStockForDetail.avgPrice.toLocaleString()}</span>
                          </div>
                          <div className="md:p-2">
                            <span className="text-sm font-medium text-stone-600 block mb-0.5">投入成本</span>
                            <span className="text-base font-black text-[#E91E63]">
                              ${Math.round(selectedStockForDetail.totalCost !== undefined ? selectedStockForDetail.totalCost : selectedStockForDetail.shares * selectedStockForDetail.avgPrice).toLocaleString()}
                            </span>
                            <span className="text-xs font-medium text-stone-500 block mt-0.5">
                              (含手續費 ${Math.round(selectedStockForDetail.fee || 0).toLocaleString()})
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    type="button"
                    onClick={() => {
                      setStockPriceHistory(selectedStockForDetail.priceHistory || []);
                      setIsPriceHistoryOpen(true);
                    }}
                    className="w-full py-2 bg-[#FFF9E3] hover:bg-[#FFD54F]/20 text-[#5D4037] border border-[#FFD54F]/40 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-2xs mt-1 cursor-pointer"
                    title="查看該持股的歷史市價評估軌跡"
                  >
                    <span>🕒 查看市價歷史</span>
                    {selectedStockForDetail.priceHistory && selectedStockForDetail.priceHistory.length > 0 && (
                      <span className="bg-[#5D4037] text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                        {selectedStockForDetail.priceHistory.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* Right Column: Transaction History */}
                <div className="flex flex-col gap-2 flex-1 min-w-0 overflow-x-hidden">
                  <div className="flex items-center justify-between gap-2 shrink-0 px-1">
                    <span className="text-xs font-black text-stone-500 uppercase tracking-widest block">交易歷史紀錄</span>
                    
                    {/* Transaction Type Filter Pills */}
                    <div className="flex items-center gap-1 bg-[#FFFDF5] p-1 rounded-xl border border-stone-200/60 shadow-xs">
                      {(['all', 'buy', 'dividend'] as const).map((filterKey) => {
                        const labelMap = { all: '全部', buy: '買入', dividend: '股利' };
                        const isActive = stockDetailFilter === filterKey;
                        return (
                          <button
                            key={filterKey}
                            type="button"
                            onClick={() => setStockDetailFilter(filterKey)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                              isActive
                                ? 'bg-[#5D4037] text-white shadow-xs'
                                : 'text-stone-500 hover:text-[#5D4037] hover:bg-stone-100/80'
                            }`}
                            style={getFontFamily()}
                          >
                            {labelMap[filterKey]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className={`flex-1 overflow-y-auto overflow-x-hidden space-y-3 pr-1 min-h-[200px] transition-all custom-scrollbar ${isOverviewCollapsed ? 'max-h-[560px]' : 'max-h-[380px]'}`}>
                    {(() => {
                      const keywords = getStockMatchKeywords(selectedStockForDetail.code);
                      const stockTrades = (selectedStockForDetail as any).trades;
                      const stockHistory = (selectedStockForDetail as any).history;
                      
                      // 決定目標券商帳戶 ID (頁面選取之券商分頁或卡片指定之券商)
                      const targetBrokerId = selectedBrokerFilter !== 'all' 
                        ? selectedBrokerFilter 
                        : (selectedStockForDetail.linkedAccount ? resolveBrokerAccount(selectedStockForDetail.linkedAccount, accounts) : null);

                      const currentBrokerAcc = targetBrokerId 
                        ? (Array.isArray(accounts) ? accounts : []).find(a => a.id === targetBrokerId) 
                        : null;

                      let rawTradeList: Transaction[] = [];

                      if (Array.isArray(stockTrades) && stockTrades.length > 0) {
                        rawTradeList = stockTrades;
                      } else if (Array.isArray(stockHistory) && stockHistory.length > 0) {
                        rawTradeList = stockHistory;
                      } else {
                        // 1. 找出與該股票相關的真實投資交易紀錄 (排除一般銀行隨手記帳無關備註，如「要投資006208的」)
                        const allSymbolMatches = records.filter(r => {
                          if (r.isDeleted) return false;

                          const isBuyTag = Boolean(r.note && (r.note.includes('[買入]') || r.note.includes('[加購]')));
                          const isDividendTag = Boolean(r.type === 'income' && r.note && (r.note.includes('[股利]') || r.note.includes('股利') || r.note.includes('配息')));
                          const hasStockId = Boolean((r as any).stockId);

                          // 只認 app 記的交易：有 [買入]/[加購]/股利 標記或選了股票（stockId）。
                          // 備註剛好提到代號的（如「要投資006208的」「買00878剩的錢」）不算，就算記在證券帳戶也一樣。
                          if (!isBuyTag && !isDividendTag && !hasStockId) {
                            return false;
                          }

                          const isSameSymbol = Boolean(
                            (hasStockId && (r as any).stockId === selectedStockForDetail.id) ||
                            ((r as any).symbol && keywords.some(k => (r as any).symbol.includes(k))) ||
                            (r.note && keywords.some(k => r.note.includes(k)))
                          );
                          return isSameSymbol;
                        });

                        // 2. 依指定券商進行嚴格隔離過濾 (元大證券僅看元大，國泰證券僅看國泰)
                        if (targetBrokerId) {
                          rawTradeList = allSymbolMatches.filter(r => {
                            const tradeBrokerId = (r as any).brokerAccountId || r.accountId || (r as any).brokerId;
                            const recordResolvedBroker = resolveBrokerAccount(r.accountId, accounts);

                            const isIdMatch = tradeBrokerId === targetBrokerId || recordResolvedBroker === targetBrokerId;
                            const isNoteMatch = Boolean(r.note && currentBrokerAcc && r.note.includes(currentBrokerAcc.name));

                            return isIdMatch || isNoteMatch;
                          });
                        } else {
                          rawTradeList = allSymbolMatches;
                        }
                      }

                      // 依日期降冪排序 (最新的排在最上方)
                      const allSortedList = [...rawTradeList].sort((a, b) => {
                        const dateDiff = (b.date || '').localeCompare(a.date || '');
                        if (dateDiff !== 0) return dateDiff;
                        return (b.time || '').localeCompare(a.time || '');
                      });

                      const sortedList = allSortedList.filter(r => {
                        if (stockDetailFilter === 'buy') {
                          return r.type === 'expense' || (r.note && (r.note.includes('[買入]') || r.note.includes('買入')));
                        }
                        if (stockDetailFilter === 'dividend') {
                          // 股利頁籤：必須為收入紀錄 (type === 'income' 且 >0)，排除支出/轉帳紀錄
                          const isIncome = (r.type as string) === 'income' || r.amount > 0;
                          const isDividendNote = Boolean(r.note && (r.note.includes('[股利]') || r.note.includes('股利') || r.note.includes('配息')));
                          return isIncome && isDividendNote;
                        }
                        return true;
                      });

                      if (sortedList.length === 0) {
                        return (
                          <div className="flex flex-col items-center justify-center py-10 bg-white/50 rounded-2xl border border-dashed border-stone-200">
                            <p className="text-stone-400 text-xs font-bold">尚無相關紀錄</p>
                          </div>
                        );
                      }

                      return sortedList.map(r => {
                        const acc = (Array.isArray(accounts) ? accounts : []).find(a => a.id === r.accountId);
                        const isIncome = r.type === 'income';
                        const isBuyTransaction = r.type === 'expense' || (r.note && (r.note.includes('[買入]') || r.note.includes('買入')));
                        
                        return (
                          <div 
                            key={r.id}
                            onClick={() => {
                              if (isBuyTransaction) {
                                handleOpenEditBuyRecord(r, selectedStockForDetail);
                              } else {
                                setEditingRecord(r);
                              }
                            }}
                            className="bg-white p-3.5 md:p-4 rounded-2xl border border-stone-100 flex items-center justify-between shadow-xs cursor-pointer hover:border-[#FFD54F]/50 hover:shadow-md transition-all active:scale-[0.99] gap-3 min-w-0 group"
                          >
                            <div className="flex flex-col gap-1 min-w-0 flex-1">
                              <span className="text-sm font-black text-[#5D4037] leading-snug break-words whitespace-normal">{r.note}</span>
                              <div className="flex items-center gap-2 text-xs text-stone-600 font-bold flex-wrap sm:flex-nowrap min-w-0">
                                <span className="shrink-0">{r.date.replace(/-/g, '/')}</span>
                                {r.time && (
                                  <span className="shrink-0 text-stone-400 font-bold">{formatTime24(r.time)}</span>
                                )}
                                {acc && (
                                  <>
                                    <span className="text-stone-300 shrink-0">•</span>
                                    <span className="flex items-center gap-1 text-[#5D4037]/80 whitespace-nowrap shrink-0">{acc.icon} {acc.name}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className={`text-base font-black flex-shrink-0 ${isIncome ? 'text-emerald-500' : 'text-[#E91E63]'}`}>
                                {isIncome ? '+' : '-'}${Math.abs(r.amount).toLocaleString()}
                              </span>
                              <button 
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isBuyTransaction) {
                                    handleOpenEditBuyRecord(r, selectedStockForDetail);
                                  } else {
                                    setEditingRecord(r);
                                  }
                                }}
                                className="p-1.5 text-stone-400 hover:text-[#5D4037] hover:bg-stone-100 rounded-lg transition-colors text-xs font-bold flex items-center gap-0.5"
                                title="編輯此筆交易"
                              >
                                <Pencil size={13} />
                                <span className="hidden sm:inline">編輯</span>
                              </button>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>

              {/* Bottom Action Bar */}
              <div className="pt-3 border-t border-[#5D4037]/10 shrink-0 flex items-center gap-2">
                <button 
                  type="button"
                  onClick={() => handleOpenBuy(selectedStockForDetail)}
                  className="flex-1 py-3 bg-[#FFFDF5] hover:bg-[#FFD54F]/20 text-[#5D4037] border border-[#FFD54F]/50 rounded-2xl font-black shadow-xs transition-all text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
                >
                  <Plus size={15} /> 新增買入
                </button>
                <button 
                  type="button"
                  onClick={() => handleOpenDividend(selectedStockForDetail)}
                  className="flex-1 py-3 bg-[#FFFDF5] hover:bg-emerald-100/50 text-[#5D4037] border border-emerald-300/50 rounded-2xl font-black shadow-xs transition-all text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
                >
                  <Coins size={15} className="text-emerald-600" /> 股利/配息入帳
                </button>
                <button 
                  type="button"
                  onClick={() => setSelectedStockForDetail(null)} 
                  className="px-5 py-3 bg-[#5D4037] text-white rounded-2xl font-black shadow-md hover:bg-[#4E342E] transition-all text-xs sm:text-sm cursor-pointer active:scale-[0.98] shrink-0"
                >
                  關閉
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Modal: Edit Record details */}
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
              if (editingRecord) onUpdateRecord(editingRecord, updated, mergedIdsToDelete, restoredIds);
              setEditingRecord(null);
            }}
            onDelete={() => {
              onDeleteRecord(editingRecord);
              setEditingRecord(null);
            }}
            onDuplicate={(rec) => {
              setEditingRecord(null);
              if (typeof onDuplicateRecord === 'function') {
                onDuplicateRecord(rec);
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* 6. Modal: 股利明細彈窗（按股票或銀行篩選） */}
      <AnimatePresence>
        {dividendDetailTarget && (() => {
          const isBank = dividendDetailTarget.type === 'bank';
          const targetLabel = dividendDetailTarget.name;

          const matchedRecords = records
            .filter(r => {
              const isDiv = r.type === 'income' && r.note && r.note.startsWith('[股利]');
              if (!isDiv) return false;
              if (selectedDividendYear !== 'all' && !r.date.startsWith(selectedDividendYear)) return false;
              if (isBank) {
                const acc = (Array.isArray(accounts) ? accounts : []).find(a => a.id === r.accountId);
                const bankName = acc ? `${acc.icon} ${acc.name}` : '未知帳戶';
                return bankName === targetLabel;
              } else {
                const keyword = targetLabel.split(' (')[0].split('(')[0].trim();
                return r.note.includes(targetLabel) || r.note.includes(keyword);
              }
            })
            .sort((a, b) => {
              const dateDiff = b.date.localeCompare(a.date);
              if (dateDiff !== 0) return dateDiff;
              return (b.time || '').localeCompare(a.time || '');
            });

          const total = matchedRecords.reduce((s, r) => s + Math.abs(r.amount), 0);
          const yearLabel = selectedDividendYear === 'all' ? '歷年累計' : `${selectedDividendYear} 年`;

          return (
            <motion.div
              key="dividend-detail-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center"
              onClick={() => setDividendDetailTarget(null)}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                onClick={e => e.stopPropagation()}
                className="bg-[#FFF9E3] rounded-t-[35px] w-full max-w-lg shadow-2xl flex flex-col max-h-[75vh]"
                style={getFontFamily()}
              >
                <div className="px-6 pt-6 pb-4 border-b border-stone-200/40">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-stone-400 mb-0.5">
                        {isBank ? '💳 銀行入帳明細' : '📈 股利配息明細'} · {yearLabel}
                      </p>
                      <h3 className="text-base font-black text-[#5D4037] leading-snug">{targetLabel}</h3>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] font-bold text-stone-400">實收股利</p>
                      <p className="text-xl font-black text-emerald-600">${total.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5 no-scrollbar">
                  {matchedRecords.length === 0 ? (
                    <p className="text-center text-stone-400 text-xs font-bold py-10">此期間暫無股利紀錄</p>
                  ) : (
                    matchedRecords.map(r => {
                      const acc = (Array.isArray(accounts) ? accounts : []).find(a => a.id === r.accountId);
                      return (
                        <div key={r.id} className="bg-white rounded-2xl border border-stone-100 p-4 shadow-sm flex items-center justify-between gap-4">
                          <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                            <p className="text-sm font-black text-[#5D4037] leading-snug">{r.note}</p>
                            <div className="flex items-center gap-2 text-xs sm:text-sm text-stone-600 font-bold">
                              <span>{r.date.replace(/-/g, '/')}</span>
                              {r.time && (
                                <span className="text-stone-400 font-bold">{formatTime24(r.time)}</span>
                              )}
                              {acc && (
                                <>
                                  <span className="text-stone-300">•</span>
                                  <span className="flex items-center gap-1 text-[#5D4037]/80">{acc.icon} {acc.name}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <span className="font-black text-emerald-600 text-base sm:text-lg flex-shrink-0">
                            +${Math.abs(r.amount).toLocaleString()}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="px-6 pb-6 pt-2">
                  <button
                    onClick={() => setDividendDetailTarget(null)}
                    className="w-full py-4 bg-[#5D4037] text-white rounded-2xl font-black shadow-lg hover:bg-[#4E342E] transition-all text-sm"
                  >
                    關閉明細
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}

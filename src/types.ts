import type { CustomInstallmentItem } from './lib/financeUtils';

// --- Types ---

export interface Category {
  id: string;
  name: string;
  icon: string;
  type: 'income' | 'expense' | 'transfer';
  sub: string[];
  order?: number;
  budget?: number;
  subBudgets?: Record<string, number>;
}

export interface RateHistoryItem {
  id: string;
  date: string;
  time?: string;
  rate: number;
  note?: string;
}

export interface SubItem {
  id: string;
  name: string;
  amount: number;
  category?: string;
  projectId?: string;
  projectName?: string;
  isPrepay?: boolean; // false: 個人支出 (我的), true: 家裡代墊 (家裡的)
  toAccountId?: string;
  originalRecordId?: string;
}

/** 帳戶扣款紀錄上的「買股票」資料（記一筆時選股票；股數之後照對帳單補） */
export interface StockBuyInfo {
  code: string;              // 股票代號，例如 00878
  name?: string;             // 名稱，例如 國泰永續高股息
  stockId?: string;          // 記帳時選的持股
  brokerAccountId: string;   // 證券交割帳戶（支出＝扣款帳戶；轉帳＝轉入帳戶）
  shares?: number;           // 買進股數（還沒補 = 待補股數）
  price?: number;            // 成交單價
  fee?: number;              // 手續費
  netCost?: number;          // 客戶淨付（成交金額無條件捨去 + 手續費）
  tradeDate?: string;        // 成交日期 YYYY-MM-DD
  appliedStockId?: string;   // 已經加到哪一檔持股（系統自動記錄，用來修改／刪除時扣回）
}

export interface Transaction {
  id: string;
  amount: number;      // 原始金額 (來源帳戶幣別)
  category: string;
  note?: string;
  remark?: string;
  date: string;        // 消費日 YYYY-MM-DD
  time?: string;       // 交易時間 HH:MM
  postingDate?: string; // 入帳日 YYYY-MM-DD
  postingOrder?: number | null; // 入帳序號 / 帳單排序
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
  installmentId?: string;
  totalAmount?: number;
  projectId?: string;
  projectName?: string;
  fee?: number;
  transferredDate?: string;
  isPrepay?: boolean;
  isCompleted?: boolean;
  isSettled?: boolean;
  status?: 'active' | 'settled';
  paidCount?: number;
  paidTerms?: number;
  totalTerms?: number;
  currency?: string;   // 幣別 (如 "TWD", "USD", "JPY", "KRW")
  order?: number;
  subItems?: SubItem[];
  isParent?: boolean;
  baseAmount?: number;
  subTransactions?: Transaction[];
  isMergedChild?: boolean;
  parentId?: string | null;
  subItemIds?: string[];
  parentTransactionId?: string;
  isChildTransaction?: boolean;
  merchant?: string;
  _importSourceAccountName?: string;
  _importDestAccountName?: string;
  _importProjectName?: string;
  _importBalance?: number;
  _importMainAccountName?: string;
  _isMergedTransfer?: boolean;
  _mergedRecordIds?: string[];
  _mergedDisplayName?: string;
  isCustomInstallment?: boolean;
  customSchedule?: CustomInstallmentItem[];
  stockBuy?: StockBuyInfo; // 買股票扣款（同步到投資頁）
  stockId?: string;          // 連結的持股（投資頁交易紀錄用）
  isDeleted?: boolean;
  deletedAt?: string;
}

export type CurrencyMode = 'TWD' | 'FOREIGN' | 'INVESTMENT' | null;

export interface PriceHistoryItem {
  id: string;
  date: string;           // 評估日期 (例如: 2026/09/23)
  price: number;          // 目前市價 / 最新淨值
  marketValue: number;    // 目前總市值 / 總現值
  createdAt: string;      // 建立時間戳記 (ISO 格式)
}

export interface Stock {
  id: string;
  code: string;           // 股票代號/名稱 (例如: 006208 富邦台50)
  category?: 'stock' | 'fund'; // 投資類別：'stock' (股票/ETF) 或 'fund' (基金)
  shares: number;         // 持有數量 (股數 / 單位數，支援小數點後 4 位)
  avgPrice: number;       // 平均買入單價 / 申購淨值 (元)
  currentPrice?: number;  // 目前市價 / 最新淨值 (元)
  evaluationDate?: string; // 市值評估日期 (YYYY-MM-DD 或 YYYY/MM/DD)
  priceHistory?: PriceHistoryItem[]; // 市價評估歷史紀錄
  linkedAccount: string;  // 綁定之證券/基金交割銀行帳戶 ID
  purchaseDate?: string;  // 購買日期 (成交日)
  settlementDate?: string; // 交割日期 (扣款日)
  notes?: string;         // 備註說明
  fee?: number;           // 手續費 (元)
  totalCost?: number;     // 投入總成本 (元)
  isDeleted?: boolean;    // 是否已被標記為軟刪除
  deletedAt?: string;     // 刪除時間
}

export interface AggregatedStockGroup {
  isAggregated: boolean;
  code: string;
  category?: 'stock' | 'fund';
  totalShares: number;
  totalCost: number;
  totalFee: number;
  avgPrice: number;
  currentPrice?: number;
  evaluationDate?: string;
  priceHistory?: PriceHistoryItem[];
  subStocks: Stock[];
  brokerAccountIds: string[];
}

export interface Account {
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
  statementDate?: number;
  dueDate?: number;
  interestRate?: number;
  interestLimit?: number;
  benefits?: string;
  excludeFromNetWorth?: boolean; // 是否不計入個人總資產與淨資產
  hideInPicker?: boolean; // 記帳時不顯示在帳戶選單（只當資料夾用、或已不再使用的帳戶）
  isBrandGroup?: boolean;
  childAccounts?: Account[];
  rateHistory?: RateHistoryItem[];
}

export interface Template {
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
  order?: number;
}

export interface FixedRecord {
  id: string;
  name: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  period: 'weekly' | 'monthly' | 'yearly';
  day: number; // 1-31 for monthly/yearly, 0-6 for weekly
  accountId: string;
  toAccountId?: string;
  fee?: number;
  category: string;
  autoEntry: boolean;
  lastProcessedDate?: string; // YYYY-MM-DD
  note?: string;
}

export interface Installment {
  id: string;
  name: string;
  totalAmount: number;
  accountId: string;
  category: string;
  startDate: string;
  totalTerms: number;
  period: 'monthly';
}

export interface Project {
  id: string;
  name: string;
  budget?: number;
  icon?: string;
  color?: string;
  description?: string;
  parentId?: string | null;
  parentProjectId?: string | null;
  order?: number;
  isStandalone?: boolean;
}

export interface AccountGroup {
  groupName: string;
  accounts: Account[];
}

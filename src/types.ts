import React from 'react';

export interface Category {
  id: string;
  name: string;
  icon: string;
  type: 'income' | 'expense' | 'transfer';
  sub: string[];
}

export interface SubItem {
  id: string;
  name: string;
  amount: number;
  category?: string;
  isPrepay?: boolean; // false: 個人支出 (我的), true: 家裡代墊 (家裡的)
  toAccountId?: string; // 轉入帳戶/卡別 (用於合併轉帳/信用卡繳款)
  originalRecordId?: string; // 原始紀錄 ID
  projectId?: string; // 所屬專案 ID (未設定時繼承主交易專案)
  projectName?: string; // 所屬專案名稱
}

export interface Transaction {
  id: string;
  amount: number;
  category: string;
  note?: string;
  date: string;
  time?: string;
  postingDate?: string;
  isPending?: boolean;
  type: 'income' | 'expense' | 'transfer';
  accountId: string;
  toAccountId?: string;
  toAmount?: number;
  exchangeRate?: number;
  fee?: number;
  transferredDate?: string;
  isPrepay?: boolean;
  isSettled?: boolean;
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
  installmentId?: string;
  isInstallment?: boolean;
  totalInstallments?: number;
  totalAmount?: number;
  projectId?: string;
  projectName?: string;
}

export interface RateHistoryItem {
  id: string;
  date: string;
  time?: string;
  rate: number;
  note?: string;
}

export interface Account {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'investment' | 'credit' | 'e-ticket' | 'e-payment' | 'points' | 'deposit' | 'insurance' | 'other';
  icon: string;
  parentId?: string;
  currency: string;
  closingDay?: number;
  billMonthOffset?: number; // 信用卡帳單月份偏移量 (如 -1 代表前一個月)
  customStatementLabels?: Record<string, string>; // 自訂帳單名稱對照表 (Key為 YYYY-MM)
  order?: number;
  benefits?: string; // 信用卡專屬回饋與通路
  statementDate?: number; // 每月結帳日 (1-31)
  dueDate?: number; // 每月繳款日 (1-31)
  interestRate?: number; // 銀行存款帳戶/定存年利率 %
  interestLimit?: number; // 銀行高利活存計息上限金額
  excludeFromNetWorth?: boolean; // 是否不計入個人總資產與淨資產
  rateHistory?: RateHistoryItem[]; // 每日匯率歷史與自訂匯率紀錄
  isBrandGroup?: boolean; // 是否為品牌帳戶群組
  childAccounts?: Account[]; // 子帳戶列表
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
  day: number;
  accountId: string;
  toAccountId?: string;
  fee?: number;
  category: string;
  autoEntry: boolean;
  lastProcessedDate?: string;
  note?: string;
}

export interface Stock {
  id: string;
  code: string;           // 股票代號/名稱 (例如: 006208 富邦台50)
  shares: number;         // 持有股數
  avgPrice: number;       // 平均買入單價
  linkedAccount: string;  // 綁定之證券交割銀行帳戶 ID
  purchaseDate?: string;  // 購買日期
  notes?: string;         // 備註說明
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

import React from 'react';

export interface Category {
  id: string;
  name: string;
  icon: string;
  type: 'income' | 'expense';
  sub: string[];
}

export interface Transaction {
  id: string;
  amount: number;
  category: string;
  note?: string;
  date: string;
  postingDate?: string;
  isPending?: boolean;
  type: 'income' | 'expense' | 'transfer';
  accountId: string;
  toAccountId?: string;
  toAmount?: number;
  exchangeRate?: number;
  fee?: number;
  transferredDate?: string;
}

export interface Account {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'investment' | 'credit' | 'e-ticket';
  icon: string;
  parentId?: string;
  currency: string;
  closingDay?: number;
  billMonthOffset?: number; // 信用卡帳單月份偏移量 (如 -1 代表前一個月)
  customStatementLabels?: Record<string, string>; // 自訂帳單名稱對照表 (Key為 YYYY-MM)
  order?: number;
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
}

export interface FixedRecord {
  id: string;
  name: string;
  amount: number;
  type: 'income' | 'expense';
  period: 'weekly' | 'monthly' | 'yearly';
  day: number;
  accountId: string;
  category: string;
  autoEntry: boolean;
  lastProcessedDate?: string;
}

import React from 'react';

export interface Category {
  id: string;
  name: string;
  icon: string;
  type: 'income' | 'expense';
  sub: string[];
  order?: number;
  budget?: number;
  subBudgets?: Record<string, number>;
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
}

export interface Account {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'investment' | 'credit' | 'e-ticket' | 'e-payment' | 'insurance' | 'points' | 'other';
  icon: string;
  parentId?: string;
  currency: string;
  closingDay?: number;
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

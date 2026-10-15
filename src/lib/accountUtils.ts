import type { Account, AccountGroup, Transaction } from '../types';
import { formatLocalDate } from './dateUtils';
import { getMergedRecords, getTransferInAmountForAccount, isTransferInForAccount } from './recordUtils';

export const getBankKeyword = (name: string, parentName?: string): string | null => {
  // [比對用關鍵字, 分組名稱]。英文名稱不分大小寫、忽略空格（LINE BANK、Line Bank、LINEBANK 都算）
  const banks: [string, string][] = [
    ['中國信託', '中信'], ['中信', '中信'], ['國泰世華', '國泰'], ['國泰', '國泰'], ['玉山', '玉山'],
    ['台北富邦', '富邦'], ['富邦', '富邦'], ['台新', '台新'], ['聯邊', '聯邊'], ['聯邦', '聯邦'],
    ['永豐', '永豐'], ['星展', '星展'], ['DBS', 'DBS'], ['渣打', '渣打'], ['匯豐', '匯豐'], ['HSBC', 'HSBC'],
    ['新光', '新光'], ['元大', '元大'], ['華南', '華南'], ['兆豐', '兆豐'], ['第一', '第一'], ['一銀', '第一'],
    ['合作金庫', '合庫'], ['合庫', '合庫'], ['彰化', '彰銀'], ['彰銀', '彰銀'], ['土地', '土銀'], ['土銀', '土銀'],
    ['臺灣銀行', '台銀'], ['台銀', '台銀'], ['上海', '上海'], ['凱基', '凱基'], ['樂天', '樂天'],
    ['LINEBANK', 'LINE BANK'], ['連線銀行', 'LINE BANK'], ['將來', '將來'], ['王道', '王道'],
    ['京城', '京城'], ['郵局', '郵局'], ['中華郵政', '郵局'],
  ];
  const norm = (s: string) => s.toUpperCase().replace(/\s+/g, '');
  const find = (text: string) => {
    const t = norm(text);
    const hit = banks.find(([k]) => t.includes(norm(k)));
    return hit ? hit[1] : null;
  };
  return find(name) || (parentName ? find(parentName) : null);
};

export const getGroupedAndUngrouped = (accountsList: Account[]) => {
  const groups: { [key: string]: Account[] } = {};
  const ungrouped: Account[] = [];

  accountsList.forEach(acc => {
    const parentName = acc.parentId ? (Array.isArray(accountsList) ? accountsList : []).find(x => x.id === acc.parentId)?.name : undefined;
    const bankKey = getBankKeyword(acc.name, parentName);
    if (bankKey) {
      if (!groups[bankKey]) groups[bankKey] = [];
      groups[bankKey].push(acc);
    } else {
      ungrouped.push(acc);
    }
  });

  const grouped: { bankName: string; accounts: Account[] }[] = [];
  const single: Account[] = [...ungrouped];

  Object.keys(groups).forEach(key => {
    if (groups[key].length > 1) {
      grouped.push({ bankName: key, accounts: groups[key] });
    } else {
      single.push(...groups[key]);
    }
  });

  return { groupedList: grouped, singleList: single };
};

export const resolveBrokerAccount = (paymentAccountId: string, accounts: Account[]): string => {
  if (!paymentAccountId || !Array.isArray(accounts)) return paymentAccountId;

  const paymentAcc = accounts.find(a => a.id === paymentAccountId);
  if (!paymentAcc) return paymentAccountId;

  if (paymentAcc.type === 'investment') {
    return paymentAcc.id;
  }

  const parentAcc = paymentAcc.parentId ? accounts.find(a => a.id === paymentAcc.parentId) : undefined;
  const parentName = parentAcc?.name;
  const paymentBankKey = getBankKeyword(paymentAcc.name, parentName);

  if (paymentBankKey) {
    const matchingInvestmentAcc = accounts.find(a => {
      if (a.type !== 'investment') return false;
      const aParentName = a.parentId ? accounts.find(x => x.id === a.parentId)?.name : undefined;
      const aBankKey = getBankKeyword(a.name, aParentName);
      return aBankKey === paymentBankKey;
    });

    if (matchingInvestmentAcc) {
      return matchingInvestmentAcc.id;
    }
  }

  return paymentAccountId;
};

export const getStockMatchKeywords = (stockCode: string): string[] => {
  if (!stockCode) return [];
  const set = new Set<string>();

  const trimmed = stockCode.trim();
  set.add(trimmed);
  set.add(trimmed.replace(/\s+/g, ''));

  // 1. 提取括號內的代碼或數字，例如 "006208"
  const parenMatch = trimmed.match(/\(([^)]+)\)/);
  if (parenMatch && parenMatch[1]) {
    const inside = parenMatch[1].trim();
    set.add(inside);
    set.add(inside.replace(/\s+/g, ''));
  }

  // 2. 提取括號前的名稱，例如 "富邦台 50" 或 "富邦台50"
  const beforeParen = trimmed.split(' (')[0].split('(')[0].trim();
  if (beforeParen) {
    set.add(beforeParen);
    set.add(beforeParen.replace(/\s+/g, ''));
  }

  // 3. 提取 4~6 位數股票代碼數字
  const digitsMatch = trimmed.match(/\d{4,6}/);
  if (digitsMatch && digitsMatch[0]) {
    set.add(digitsMatch[0]);
  }

  return Array.from(set).filter(k => k.length > 0);
};

export const groupAccountsByInstitution = (accountsList: Account[]): AccountGroup[] => {
  if (!Array.isArray(accountsList)) return [];

  const groupsMap: Map<string, Account[]> = new Map();

  accountsList.forEach(acc => {
    const parentAcc = acc.parentId ? accountsList.find(x => x.id === acc.parentId) : undefined;
    const parentName = parentAcc?.name;

    let groupName = '💵 現金與其他';

    if (acc.type === 'cash') {
      groupName = '💵 現金與其他';
    } else {
      const bankKey = getBankKeyword(acc.name, parentName);
      if (bankKey) {
        if (bankKey.includes('國泰')) groupName = '🏛️ 國泰世華體系';
        else if (bankKey.includes('元大')) groupName = '🏛️ 元大金控體系';
        else if (bankKey.includes('富邦')) groupName = '🏛️ 富邦金控體系';
        else if (bankKey.includes('玉山')) groupName = '🏛️ 玉山金控體系';
        else if (bankKey.includes('台新')) groupName = '🏛️ 台新金控體系';
        else if (bankKey.includes('中信') || bankKey.includes('中國信託')) groupName = '🏛️ 中國信託體系';
        else if (bankKey.includes('永豐')) groupName = '🏛️ 永豐金控體系';
        else if (bankKey.includes('兆豐')) groupName = '🏛️ 兆豐金控體系';
        else if (bankKey.includes('合庫') || bankKey.includes('合作金庫')) groupName = '🏛️ 合作金庫體系';
        else if (bankKey.includes('第一') || bankKey.includes('一銀')) groupName = '🏛️ 第一金控體系';
        else if (bankKey.includes('華南')) groupName = '🏛️ 華南金控體系';
        else if (bankKey.includes('彰化') || bankKey.includes('彰銀')) groupName = '🏛️ 彰化銀行體系';
        else if (bankKey.includes('京城')) groupName = '🏛️ 京城銀行';
        else if (bankKey.includes('郵局')) groupName = '📮 中華郵政';
        else groupName = `🏛️ ${bankKey}體系`;
      } else if (acc.name.includes('京城')) {
        groupName = '🏛️ 京城銀行';
      } else if (acc.type === 'points') {
        groupName = '⭐ 點數與紅利';
      }
    }

    if (!groupsMap.has(groupName)) {
      groupsMap.set(groupName, []);
    }
    groupsMap.get(groupName)!.push(acc);
  });

  const result: AccountGroup[] = [];
  groupsMap.forEach((accounts, groupName) => {
    result.push({ groupName, accounts });
  });

  return result;
};

export function isImageIconString(icon?: string): boolean {
  if (!icon) return false;
  return (
    icon.startsWith('data:image') ||
    icon.startsWith('http://') ||
    icon.startsWith('https://') ||
    icon.startsWith('/') ||
    icon.includes(';base64,') ||
    /\.(png|jpg|jpeg|svg|webp|gif)(\?.*)?$/i.test(icon) ||
    icon.length > 30
  );
}

export const isAccountExcludedFromNetWorth = (acc: Account, allAccounts: Account[]): boolean => {
  if (acc.excludeFromNetWorth) return true;
  if (acc.parentId) {
    const parent = (Array.isArray(allAccounts) ? allAccounts : []).find(p => p.id === acc.parentId);
    if (parent) return isAccountExcludedFromNetWorth(parent, allAccounts);
  }
  return false;
};

export const checkAreAccountsSameBank = (accA: { id: string; name: string; parentId?: string; type: string }, accB: { id: string; name: string; parentId?: string; type: string }, accountsList: Account[]): boolean => {
  if (accA.id === accB.id) return false;
  if (accA.type !== 'credit' || accB.type !== 'credit') return false;
  
  // 1. Same parentId (non-empty)
  if (accA.parentId && accB.parentId && accA.parentId === accB.parentId) return true;
  
  // 2. Same bank keyword in their name or parent name
  const getParentName = (a: { id: string; name: string; parentId?: string }) => a.parentId ? (Array.isArray(accountsList) ? accountsList : []).find(x => x.id === a.parentId)?.name : undefined;
  const keywordA = getBankKeyword(accA.name, getParentName(accA));
  const keywordB = getBankKeyword(accB.name, getParentName(accB));
  
  return !!(keywordA && keywordB && keywordA === keywordB);
};

export function calculateAccountBalance(account: Account, accounts: Account[], records: Transaction[]): number {
  if (account.isBrandGroup && (account as any).childAccounts) {
    return (Array.isArray((account as any)?.childAccounts) ? (account as any).childAccounts : []).reduce((sum: number, c: Account) => {
      return sum + calculateAccountBalance(c, accounts, records);
    }, 0);
  }

  const mergedRecords = getMergedRecords(records, accounts);
  const getBaseBalance = (acc: Account) => {
    let bal = acc.type === 'credit' ? 0 : (acc.initialBalance || 0);
    mergedRecords.forEach(r => {
      if (r.category === '初始資金') return;
      if (r.accountId === acc.id) {
        if (r.type === 'transfer') {
          bal -= Math.abs(r.amount);
        } else {
          bal += r.amount;
        }
        if (r.fee) {
          bal -= r.fee;
        }
      }
      if (r.type === 'transfer') {
        bal += getTransferInAmountForAccount(r, acc.id);
      }
    });
    return bal;
  };

  const getRecursiveBalance = (id: string): number => {
    const acc = (Array.isArray(accounts) ? accounts : []).find(a => a.id === id);
    if (!acc) return 0;
    let total = getBaseBalance(acc);
    const children = accounts.filter(a => a.parentId === id && !isAccountExcludedFromNetWorth(a, accounts));
    children.forEach(child => {
      const childBal = getRecursiveBalance(child.id);
      total += childBal;
      console.log(`  + Adding child account ${child.name} (${child.id}) balance: ${childBal} | new total: ${total}`);
    });
    return total;
  };

  const result = getRecursiveBalance(account.id);
  console.log(`[DEBUG] Final recursive balance for ${account.name}: ${result}`);
  return result;
}

export function calculateCreditCardUntransferred(
  account: Account,
  accounts: Account[],
  records: Transaction[]
): number {
  if (account.isBrandGroup && (account as any).childAccounts) {
    return (Array.isArray((account as any)?.childAccounts) ? (account as any).childAccounts : []).reduce((sum: number, c: Account) => {
      return sum + calculateCreditCardUntransferred(c, accounts, records);
    }, 0);
  }

  const childrenIds = accounts.filter(a => a.parentId === account.id).map(a => a.id);
  const targetIds = [account.id, ...childrenIds];

  const mergedRecords = getMergedRecords(records, accounts);
  
  const accountRecords = mergedRecords.filter(r => 
    (targetIds.includes(r.accountId) || isTransferInForAccount(r, targetIds)) && 
    r.category !== '初始資金'
  );

  let ntSum = 0;

  accountRecords.forEach(r => {
    const noteText = (r.note || '') + (r.remark || '') + (r.category || '');
    const noteLower = noteText.toLowerCase();
    const isFeedback = 
      noteLower.includes('回饋') || 
      noteLower.includes('返現') || 
      noteLower.includes('紅利') || 
      noteLower.includes('折抵') || 
      noteLower.includes('cashback') || 
      noteLower.includes('reward');
    
    if (isFeedback) {
      return;
    }

    const isTransferPayment = r.type === 'transfer';
    let isTransferIn = false;
    let isAutoPay = false;
    
    if (isTransferPayment) {
      isTransferIn = isTransferInForAccount(r, targetIds);
      
      if (isTransferIn) {
        isAutoPay = 
          (noteText.includes('自動') && noteText.includes('扣繳')) || 
          (noteText.includes('自動') && noteText.includes('繳款')) || 
          (noteText.includes('自動') && noteText.includes('扣款')) ||
          noteText.includes('轉帳扣繳') ||
          noteText.includes('扣繳信用卡款') ||
          noteText.includes('自動扣繳');
      }
    }

    if (isAutoPay) {
      return;
    }

    const isTransferred = r.transferredDate || (isTransferPayment && isTransferIn);

    if (!isTransferred) {
      ntSum += r.amount;
    }
  });

  return ntSum;
}

export function getCreditCardBillingCycleRange(account: Account, accounts: Account[], isPrevious: boolean = false) {
  const closingDayVal = account.closingDay || account.statementDate;
  if (!closingDayVal) return null;

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  // 若今日日期已達或超過本月結帳日（例如 9/6 >= 9/5）：
  // 當前活躍帳期（當期帳單）自動進位推進至 (本月結帳日+1) ~ (下月結帳日)
  // 上期帳單正式推進為 (上月結帳日+1) ~ (本月結帳日)
  const isPastClosingThisMonth = d >= closingDayVal;

  let cycleEndMonthOffset = isPastClosingThisMonth ? 1 : 0;
  if (isPrevious) {
    cycleEndMonthOffset -= 1;
  }

  const endYear = y;
  const endMonth = m + cycleEndMonthOffset;
  const maxDaysEnd = new Date(endYear, endMonth + 1, 0).getDate();
  const endDate = new Date(endYear, endMonth, Math.min(closingDayVal, maxDaysEnd));

  const prevEndMonth = endMonth - 1;
  const maxDaysPrev = new Date(endYear, prevEndMonth + 1, 0).getDate();
  const prevEndDate = new Date(endYear, prevEndMonth, Math.min(closingDayVal, maxDaysPrev));
  const startDate = new Date(prevEndDate.getFullYear(), prevEndDate.getMonth(), prevEndDate.getDate() + 1);

  const startStr = formatLocalDate(startDate);
  const endStr = formatLocalDate(endDate);

  return { startStr, endStr };
}

export function hasCreditCardClosingDay(account: Account, accounts: Account[]): boolean {
  if (!account) return false;
  if (account.closingDay || account.statementDate) return true;
  
  if (account.isBrandGroup && account.childAccounts) {
    return (Array.isArray(account?.childAccounts) ? account.childAccounts : []).some(c => Boolean(c.closingDay || c.statementDate));
  }
  
  const children = accounts.filter(a => a.parentId === account.id || accounts.some(p => p.parentId === account.id && a.parentId === p.id));
  if (children.length > 0) {
    return children.some(c => Boolean(c.closingDay || c.statementDate));
  }
  
  return false;
}

export function calculateCreditCardStatementAmount(
  account: Account,
  accounts: Account[],
  records: Transaction[],
  isPrevious: boolean = false
): number {
  if (!account) return 0;

  const isGroup = account.isBrandGroup || (account.childAccounts && account.childAccounts.length > 0) || accounts.some(a => a.parentId === account.id);

  if (isGroup) {
    const childAccountsList: Account[] = [];
    if (account.isBrandGroup && account.childAccounts) {
      childAccountsList.push(...account.childAccounts);
    } else {
      const children = accounts.filter(a => a.parentId === account.id || accounts.some(p => p.parentId === account.id && a.parentId === p.id));
      childAccountsList.push(...children);
    }
    
    if (childAccountsList.length > 0) {
      return childAccountsList.reduce((sum, c) => sum + calculateCreditCardStatementAmount(c, accounts, records, isPrevious), 0);
    }
  }

  const targetAccountIds = new Set<string>([account.id]);
  const cycleRange = getCreditCardBillingCycleRange(account, accounts, isPrevious);
  const now = new Date();
  let targetYear = now.getFullYear();
  let targetMonth = now.getMonth();
  if (isPrevious) {
    targetMonth -= 1;
    if (targetMonth < 0) {
      targetMonth = 11;
      targetYear -= 1;
    }
  }

  let spendingTotal = 0;

  records.forEach(r => {
    const isFromCard = targetAccountIds.has(r.accountId);
    const isToCard = Boolean(r.toAccountId && targetAccountIds.has(r.toAccountId));

    if (!isFromCard && !isToCard) return;
    if (r.category === '初始資金') return;

    // 上期帳單 (isPrevious === true)：僅採計上一期已完結並填有銀行入帳日之交易款項 (!r.isPending && Boolean(r.postingDate))
    // 本期帳單 (isPrevious === false)：即時動態累加當前結帳週期內所有消費 (無論是否已填寫銀行入帳日)
    if (isPrevious && (!r.postingDate || r.isPending)) return;

    const txDate = (isPrevious ? r.postingDate : (r.postingDate || r.date)) || r.date;

    if (cycleRange) {
      if (txDate < cycleRange.startStr || txDate > cycleRange.endStr) return;
    } else {
      const d = new Date(txDate.replace(/\//g, '-'));
      if (isNaN(d.getTime())) return;
      if (d.getFullYear() !== targetYear || d.getMonth() !== targetMonth) return;
    }

    const noteText = (r.note || '') + (r.remark || '') + (r.category || '');
    const noteLower = noteText.toLowerCase();
    const isFeedback = 
      noteLower.includes('回饋') || 
      noteLower.includes('返現') || 
      noteLower.includes('紅利') || 
      noteLower.includes('折抵') || 
      noteLower.includes('cashback') || 
      noteLower.includes('reward') ||
      r.type === 'income' ||
      r.category === '回饋' ||
      r.category === '退款';

    const isTransfer = r.type === 'transfer';

    if (isFromCard && isToCard) {
      return; // 同卡片內部轉帳不重複計算
    }

    if (isTransfer && isToCard && !isFeedback) {
      return; // 銀行還款扣繳不計入刷卡消費應繳總額
    }

    let change = 0;
    if (r.type === 'expense') {
      change = Math.abs(Number(r.amount || 0));
    } else if (isTransfer && isFromCard && !isToCard) {
      // 信用卡加值轉出 (例如 儲值悠遊卡/一卡通/電支) 算入應繳金額
      change = Math.abs(Number(r.amount || 0));
    } else if (r.type === 'income' || isFeedback) {
      // 現金回饋 / 折抵金 / 退款 沖銷扣減應繳金額
      change = -Math.abs(Number(r.amount || 0));
    }

    spendingTotal += change;
    if (r.fee && isFromCard) {
      spendingTotal += Math.abs(Number(r.fee || 0));
    }
  });

  return Math.max(0, spendingTotal);
}

export function calculateCreditCardMonthlySpending(account: Account, accounts: Account[], records: Transaction[]): number {
  return calculateCreditCardStatementAmount(account, accounts, records, false);
}

export function calculateCreditCardPreviousMonthSpending(account: Account, accounts: Account[], records: Transaction[]): number {
  return calculateCreditCardStatementAmount(account, accounts, records, true);
}

import type { Account, RateHistoryItem, Transaction } from '../types';

export const getTransferSourceAndDest = (tx: Transaction) => {
  const isPos = tx.amount > 0;
  const src = isPos ? (tx.toAccountId || '') : tx.accountId;
  let dst = isPos ? tx.accountId : (tx.toAccountId || '');
  if (tx.subItems && tx.subItems.some(s => s.toAccountId)) {
    const dests = Array.from(new Set(tx.subItems.map(s => s.toAccountId).filter(Boolean))) as string[];
    if (dests.length === 1) dst = dests[0];
  }
  return { src, dst };
};

export const getTransferInAmountForAccount = (r: Transaction, targetAccountId: string): number => {
  if (r.type !== 'transfer') return 0;
  if (r.subItems && r.subItems.some(s => s.toAccountId)) {
    return r.subItems
      .filter(s => s.toAccountId === targetAccountId)
      .reduce((sum, s) => sum + Math.abs(s.amount), 0);
  }
  if (r.toAccountId === targetAccountId) {
    return r.toAmount !== undefined ? r.toAmount : Math.abs(r.amount * (r.exchangeRate || 1));
  }
  return 0;
};

export const isTransferInForAccount = (r: Transaction, targetIds: string[]): boolean => {
  if (r.type !== 'transfer') return false;
  if (r.subItems && r.subItems.some(s => s.toAccountId)) {
    return r.subItems.some(s => s.toAccountId && targetIds.includes(s.toAccountId));
  }
  return Boolean(r.toAccountId && targetIds.includes(r.toAccountId));
};

export const getTransferCounterpartName = (r: Transaction, accounts: Account[]): string => {
  if (r.subItems && r.subItems.some(s => s.toAccountId)) {
    const names = (r.subItems || []).map(s => (accounts || []).find(a => a?.id === s?.toAccountId)?.name).filter(Boolean);
    if (names.length > 0) return names.join(', ');
  }
  return (accounts || []).find(a => a?.id === r?.toAccountId)?.name || '未知帳戶';
};

export const getLatestExchangeRate = (records: Transaction[] = [], accounts: Account[] = [], targetCurrency: string, beforeDate?: string): number => {
  if (!targetCurrency || targetCurrency === 'TWD') return 1;
  const safeAccounts = Array.isArray(accounts) ? accounts : [];
  const safeRecords = Array.isArray(records) ? records : [];
  
  // 1. Check custom rateHistory on accounts matching targetCurrency
  const matchedAccounts = safeAccounts.filter(a => a && (a.currency || 'TWD') === targetCurrency);
  if (matchedAccounts.length > 0) {
    let allLogs: RateHistoryItem[] = [];
    matchedAccounts.forEach(a => {
      const logs = Array.isArray(a?.rateHistory) ? a.rateHistory : [];
      if (logs.length > 0) allLogs.push(...logs);
    });
    if (beforeDate) {
      allLogs = allLogs.filter(l => l && l.date <= beforeDate);
    }
    if (allLogs.length > 0) {
      allLogs.sort((a, b) => {
        const dateDiff = (b?.date || '').localeCompare(a?.date || '');
        if (dateDiff !== 0) return dateDiff;
        return (b?.time || '').localeCompare(a?.time || '');
      });
      if (allLogs[0]?.rate && !isNaN(Number(allLogs[0].rate)) && Number(allLogs[0].rate) > 0) {
        return Number(allLogs[0].rate);
      }
    }
    // Fallback to direct account.exchangeRate if present on matched account
    const accWithDirectRate = matchedAccounts.find(a => a && (a as any).exchangeRate && !isNaN(Number((a as any).exchangeRate)) && Number((a as any).exchangeRate) > 0);
    if (accWithDirectRate && (accWithDirectRate as any).exchangeRate) {
      return Number((accWithDirectRate as any).exchangeRate);
    }
  }

  const relevantTransfers = safeRecords.filter(r => {
    if (!r) return false;
    if (r.type !== 'transfer' && !r._isMergedTransfer) return false;
    if (beforeDate && r.date > beforeDate) return false;
    
    const srcAcc = safeAccounts.find(a => a?.id === r.accountId);
    const dstAcc = safeAccounts.find(a => a?.id === r.toAccountId);
    const srcCur = srcAcc?.currency || 'TWD';
    const dstCur = dstAcc?.currency || 'TWD';
    
    return (srcCur === 'TWD' && dstCur === targetCurrency) || (srcCur === targetCurrency && dstCur === 'TWD');
  });
  
  if (relevantTransfers.length > 0) {
    relevantTransfers.sort((a, b) => {
      const dateDiff = (b?.date || '').localeCompare(a?.date || '');
      if (dateDiff !== 0) return dateDiff;
      return (b?.id || '').localeCompare(a?.id || '');
    });
    const latest = relevantTransfers[0];
    if (latest && latest.exchangeRate && !isNaN(Number(latest.exchangeRate)) && Number(latest.exchangeRate) > 0) {
      return Number(latest.exchangeRate);
    }
  }
  
  if (targetCurrency === 'JPY') return 0.22;
  if (targetCurrency === 'USD') return 32.5;
  if (targetCurrency === 'KRW') return 0.024;
  if (targetCurrency === 'EUR') return 35.0;
  return 1;
};

export const convertCurrency = (amount: number = 0, fromCurrency: string = 'TWD', toCurrency: string = 'TWD', records: Transaction[] = [], accounts: Account[] = []): number => {
  const validAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  if (!validAmount) return 0;
  if (fromCurrency === toCurrency) return validAmount;
  
  // Convert to TWD first
  let twdAmount = validAmount;
  if (fromCurrency !== 'TWD') {
    const rate = getLatestExchangeRate(records, accounts, fromCurrency);
    twdAmount = validAmount * rate;
  }
  
  // Convert TWD to target currency
  if (toCurrency === 'TWD') {
    return twdAmount;
  } else {
    const rate = getLatestExchangeRate(records, accounts, toCurrency);
    return rate > 0 ? twdAmount / rate : twdAmount;
  }
};

export const getTwdEquivalentText = (records: Transaction[], accounts: Account[], record: Transaction): string | null => {
  const recordCurrency = record.currency || (Array.isArray(accounts) ? accounts : []).find(a => a.id === record.accountId)?.currency || 'TWD';
  if (recordCurrency === 'TWD') return null;
  
  let twdAmt = 0;
  
  if (record.type === 'transfer' || record._isMergedTransfer) {
    const { src, dst } = getTransferSourceAndDest(record);
    const srcAcc = (Array.isArray(accounts) ? accounts : []).find(a => a.id === src);
    const dstAcc = (Array.isArray(accounts) ? accounts : []).find(a => a.id === dst);
    const srcCur = srcAcc?.currency || 'TWD';
    const dstCur = dstAcc?.currency || 'TWD';
    
    if (srcCur === 'TWD') {
      twdAmt = Math.abs(record.amount);
    } else if (dstCur === 'TWD') {
      twdAmt = record.toAmount !== undefined ? record.toAmount : Math.abs(record.amount * (record.exchangeRate || 1));
    } else {
      const rate = record.exchangeRate || getLatestExchangeRate(records, accounts, srcCur, record.date);
      twdAmt = Math.abs(record.amount) * rate;
    }
  } else {
    const rate = getLatestExchangeRate(records, accounts, recordCurrency, record.date);
    twdAmt = Math.abs(record.amount) * rate;
  }
  
  return `(約 NT$ ${Math.round(twdAmt).toLocaleString()})`;
};

export const getMergedRecords = (txs: Transaction[], accounts: Account[]): Transaction[] => {
  const cleanedTxs = txs.filter(t => !t.isDeleted && !t.isMergedChild && !t.parentId && !t.parentTransactionId && !t.isChildTransaction);

  const result: Transaction[] = [];
  const matchedIds = new Set<string>();

  for (let i = 0; i < cleanedTxs.length; i++) {
    const A = cleanedTxs[i];
    if (matchedIds.has(A.id)) {
      continue;
    }

    if (A.type === 'transfer' && A.amount !== 0) {
      // Look for a matching transfer with opposite sign and same details
      const A_src = A.accountId;
      const A_dst = A.toAccountId || '';

      let foundMatch = false;
      for (let j = i + 1; j < txs.length; j++) {
        const B = txs[j];
        if (matchedIds.has(B.id)) {
          continue;
        }

        if (
          B.type === 'transfer' &&
          B.date === A.date &&
          Math.abs(B.amount) === Math.abs(A.amount) &&
          B.amount * A.amount < 0
        ) {
          const B_src = B.accountId;
          const B_dst = B.toAccountId || '';

          const resolvedSender = A_src || B_src;
          const resolvedDest = A_dst || B_dst;

          // Conflict resolution:
          const hasSenderConflict = A_src && B_src && A_src !== B_src;
          const hasDestConflict = A_dst && B_dst && A_dst !== B_dst;

          if (!hasSenderConflict && !hasDestConflict && resolvedSender && resolvedDest && resolvedSender !== resolvedDest) {
            matchedIds.add(B.id);
            // primary uses the negative amount/transfer out
            const primary = A.amount < 0 ? A : B;
            const secondary = A.amount < 0 ? B : A;
            
            const srcName = (Array.isArray(accounts) ? accounts : []).find(a => a.id === resolvedSender)?.name || '未知帳戶';
            const dstName = (Array.isArray(accounts) ? accounts : []).find(a => a.id === resolvedDest)?.name || '未知帳戶';

            const mergedTx: Transaction = {
              ...primary,
              accountId: resolvedSender,
              toAccountId: resolvedDest,
              _isMergedTransfer: true,
              _mergedRecordIds: [primary.id, secondary.id],
              _mergedDisplayName: `轉帳：${srcName} ➔ ${dstName}`,
            };
            result.push(mergedTx);
            foundMatch = true;
            break;
          }
        }
      }

      if (!foundMatch) {
         result.push(A);
      }
    } else {
      result.push(A);
    }
  }

  // Deduplicate transfer records that represent the same physical transfer
  const finalResult: Transaction[] = [];
  const processedKeys = new Set<string>(); // key format: date_amount_src_dst

  result.forEach(tx => {
    if (tx.type === 'transfer' || tx._isMergedTransfer) {
      const { src, dst } = getTransferSourceAndDest(tx);
      const absAmt = Math.abs(tx.amount);
      const date = tx.date;
      
      let isDuplicate = false;
      for (const processedKey of processedKeys) {
        const [pDate, pAmtStr, pSrc, pDst] = processedKey.split('|');
        const pAmt = parseFloat(pAmtStr);
        if (pDate === date && pAmt === absAmt) {
          // Check for matches or overlaps
          if (
            (src && dst && pSrc === src && pDst === dst) ||
            (!src && dst && pDst === dst) ||
            (src && !dst && pSrc === src)
          ) {
            isDuplicate = true;
            break;
          }
        }
      }
      
      if (isDuplicate) {
        return; // Skip adding duplicate transfers to the active collection
      }
      
      processedKeys.add(`${date}|${absAmt}|${src}|${dst}`);
    }
    finalResult.push(tx);
  });

  return finalResult;
};

export const parseSmartTransactionTitle = (title: string, isExpense: boolean = true): string => {
  if (!title) return '';

  // 首行作為主標題機制：包含換行時，僅擷取第一行文字作為外層標題顯示
  const firstLine = title.split('\n')[0].trim();
  if (!firstLine) return '';

  // 非支出/消費類型 (如轉帳、帳單扣繳、提款、自動加值、收入等) 嚴禁追加「等 X 件商品」字樣
  if (!isExpense) {
    return firstLine;
  }

  const nonItemPattern = /(自扣|扣繳|帳單|謝謝|入帳|轉帳|提款|加值|退款|還款|儲值|繳費|手續費|現金回饋|利息|結清|沖銷)/i;
  if (nonItemPattern.test(firstLine)) {
    return firstLine;
  }

  if (firstLine.includes('等') && firstLine.includes('件商品')) {
    return firstLine;
  }

  // 針對首行內容進行商品項目與分隔符號解析
  const rawSegments = firstLine.split(/[,，;；+＋|\u3001]/).map(s => s.trim()).filter(Boolean);

  if (rawSegments.length <= 1) {
    return firstLine;
  }

  const freebieKeywords = /(^贈|^滿額禮|^滿額贈|^免運|^贈品|^試用品|^樣品|^折價券|^折扣金|免運費|免運優惠|滿額贈|滿額禮|紅利金|0元|\$0)/i;

  const paidItems: string[] = [];

  for (const seg of rawSegments) {
    const hasZeroPrice = /\$[\s]*0(\.0+)?\b|0[\s]*(元|塊)|=\s*\$[\s]*0|1\.0\s*=\s*0/i.test(seg);
    const hasPositivePrice = /\$[\s]*[1-9]\d*|[1-9]\d*[\s]*(元|塊)/i.test(seg);

    if (hasZeroPrice || (freebieKeywords.test(seg) && !hasPositivePrice)) {
      continue;
    }

    let cleanSeg = seg
      .replace(/[\$＄]\s*\d+([.,]\d+)?(\s*\*[\s\d=]+)?/gi, '')
      .replace(/\d+\s*(元|塊)/gi, '')
      .replace(/=\s*[\$＄]?\s*\d+/gi, '')
      .trim();

    if (cleanSeg) {
      paidItems.push(cleanSeg);
    }
  }

  if (paidItems.length === 0) {
    return firstLine;
  }

  if (paidItems.length === 1) {
    return paidItems[0];
  }

  if (paidItems.length === 2) {
    return `${paidItems[0]}、${paidItems[1]} 等 2 件商品`;
  }

  return `${paidItems[0]}、${paidItems[1]} 等 ${paidItems.length} 件商品`;
};

export const getRecordPersonalAmount = (r: Transaction): number => {
  if (r.type !== 'expense') return 0;
  const items = (r.subItems && r.subItems.length > 0) ? r.subItems : (r.subTransactions && r.subTransactions.length > 0) ? r.subTransactions : null;
  if (items && items.length > 0) {
    const personalSum = items
      .filter((i: any) => !i.isPrepay && !(typeof i.tag === 'string' && i.tag.includes('家裡代墊')) && i.reimbursementTag !== 'family')
      .reduce((sum, item) => sum + (item.amount || 0), 0);
    return personalSum + (r.fee || 0);
  }
  if (r.isPrepay) return 0;
  return Math.abs(r.amount) + (r.fee || 0);
};

export const getRecordPrepayAmount = (r: Transaction): number => {
  if (r.type !== 'expense') return 0;
  const items = (r.subItems && r.subItems.length > 0) ? r.subItems : (r.subTransactions && r.subTransactions.length > 0) ? r.subTransactions : null;
  if (items && items.length > 0) {
    return items
      .filter((i: any) => !!i.isPrepay || (typeof i.tag === 'string' && i.tag.includes('家裡代墊')) || i.reimbursementTag === 'family')
      .reduce((sum, item) => sum + (item.amount || 0), 0);
  }
  if (r.isPrepay) return Math.abs(r.amount);
  return 0;
};

export const getTransactionTitle = (record: Transaction): string => {
  if (record.subItems && record.subItems.length > 1) {
    const firstSubName = (record.subItems[0].name || '').replace(/\[固定收支\] /g, '').replace(/\[固定收支\]/g, '').trim() || '明細 1';
    return `【${firstSubName}】等 ${record.subItems.length} 類明細`;
  }
  if (record.subTransactions && record.subTransactions.length > 1) {
    const firstSubName = (record.subTransactions[0].note || record.subTransactions[0].category || '').replace(/\[固定收支\] /g, '').replace(/\[固定收支\]/g, '').trim() || '明細 1';
    return `【${firstSubName}】等 ${record.subTransactions.length} 類明細`;
  }

  const cleanRemark = (record.remark || '').replace(/\[固定收支\] /g, '').replace(/\[固定收支\]/g, '').trim();
  const cleanNote = (record.note || '').replace(/\[固定收支\] /g, '').replace(/\[固定收支\]/g, '').trim();
  
  let baseTitle = '';
  const nonExpenseCategories = ['轉帳', '帳單扣繳', '自動扣繳', '信用卡繳款', '提款', '自動加值', '還款', '儲值', '繳費', '手續費', '回饋', '退款'];
  const isExpense = record.type === 'expense' && !nonExpenseCategories.includes(record.category);

  if (record.type === 'transfer' || record._isMergedTransfer) {
    if (cleanNote && cleanNote !== '轉帳' && cleanNote !== '未命名明細') {
      baseTitle = cleanNote;
    } else if (cleanRemark) {
      baseTitle = cleanRemark;
    } else if (record._isMergedTransfer && record._mergedDisplayName) {
      baseTitle = record._mergedDisplayName;
    } else {
      baseTitle = '轉帳';
    }
  } else {
    baseTitle = (cleanNote || cleanRemark || record.category).replace(/\[固定收支\] /g, '').replace(/\[固定收支\]/g, '').trim();
  }

  const smartTitle = parseSmartTransactionTitle(baseTitle, isExpense);

  if (record.isInstallment && record.currentInstallment && record.totalInstallments) {
    if (!smartTitle.includes('(分期')) {
      return `${smartTitle} (分期 ${record.currentInstallment}/${record.totalInstallments})`;
    }
  }
  return smartTitle;
};

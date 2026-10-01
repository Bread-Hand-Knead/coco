import React from 'react';
import { Category } from '../types';

export const getCategoryIcon = (categoryName: string, type: 'income' | 'expense' | 'transfer', categories: Category[]) => {
  const cleanName = (categoryName || '').replace(/\[固定收支\] /g, '').replace(/\[固定收支\]/g, '').trim();
  const mainCategoryName = cleanName.split(/ > | ＞ /)[0].trim();
  
  const getIconNode = (icon: string) => {
    const isImage = icon.startsWith('http') || icon.startsWith('data:image/') || icon.startsWith('/');
    if (isImage) {
      return (
        <img 
          src={icon} 
          className="w-full h-full object-contain rounded-lg p-0.5 select-none pointer-events-none" 
          alt="cat-icon" 
        />
      );
    }
    return <span className="select-none">{icon}</span>;
  };

  if (mainCategoryName === '初始資金') return getIconNode('💎');
  if (mainCategoryName === '餘額校正') return getIconNode('🔧');
  
  // Custom mappings for common names (check against main category)
  if (mainCategoryName.includes('電影') || mainCategoryName === '影城' || mainCategoryName === '娛樂') return getIconNode('🎬');
  if (mainCategoryName === '交通' || mainCategoryName === '公車' || mainCategoryName === '捷運' || mainCategoryName === '火車') return getIconNode('🚌');
  if (mainCategoryName === '食物' || mainCategoryName.includes('飲食') || mainCategoryName === '晚餐' || mainCategoryName === '午餐' || mainCategoryName === '早餐') return getIconNode('🍱');
  if (mainCategoryName === '薪資' || mainCategoryName === '月薪' || mainCategoryName === '獎金') return getIconNode('💼');

  // Exact match with main category name
  const safeCategories = Array.isArray(categories) ? categories : [];
  const category = safeCategories.find(c => 
    c && (c.name === mainCategoryName || 
    (c.sub && Array.isArray(c.sub) && c.sub.some(s => s && s.trim() === mainCategoryName)))
  );
  if (category) return getIconNode(category.icon);

  // Fallback to searching subcategory if not found in main
  if (cleanName.includes(' > ') || cleanName.includes(' ＞ ')) {
    const subPart = cleanName.split(/ > | ＞ /)[1]?.trim();
    if (subPart) {
      const subCategory = safeCategories.find(c => c && c.sub && Array.isArray(c.sub) && c.sub.some(s => s && s.trim() === subPart));
      if (subCategory) return getIconNode(subCategory.icon);
    }
  }
  
  const defaultIcon = type === 'income' ? '💰' : (type === 'expense' ? '🍱' : '🔄');
  return getIconNode(defaultIcon);
};

export const getFontFamily = () => ({ fontFamily: '"王漢宗中隸書", "王漢宗", sans-serif' });

export interface SellingDeduction {
  estimatedTax: number;
  estimatedFee: number;
  totalDeduction: number;
}

export const calculateEstimatedSellingDeduction = (
  code: string,
  category: 'stock' | 'fund' | undefined,
  marketValue: number,
  discountRate: number = 1.0
): SellingDeduction => {
  if (!marketValue || marketValue <= 0) {
    return { estimatedTax: 0, estimatedFee: 0, totalDeduction: 0 };
  }

  const cleanCode = (code || '').trim();
  const isFund = category === 'fund';
  const isETF = cleanCode.startsWith('00') || cleanCode.toUpperCase().includes('ETF');

  let taxRate = 0.003; // 一般股票 0.3%
  if (isFund) {
    taxRate = 0; // 基金 0%
  } else if (isETF) {
    taxRate = 0.001; // ETF 0.1%
  }

  const estimatedTax = Math.floor(marketValue * taxRate);
  const rawFee = Math.floor(marketValue * 0.001425 * discountRate);
  const estimatedFee = Math.max(20, rawFee > 0 ? rawFee : Math.floor(marketValue * 0.001425));

  return {
    estimatedTax,
    estimatedFee,
    totalDeduction: estimatedTax + estimatedFee
  };
};

export const getCorrectInstallmentDate = (startDateStr: string, currentInstallment: number): string => {
  const startDate = new Date(startDateStr);
  let targetYear: number;
  let targetMonth: number;
  let targetDay: number;

  if (isNaN(startDate.getTime())) {
    const today = new Date();
    targetYear = today.getFullYear();
    targetMonth = today.getMonth() + (currentInstallment - 1);
    targetDay = today.getDate();
  } else {
    targetYear = startDate.getFullYear();
    targetMonth = startDate.getMonth() + (currentInstallment - 1);
    targetDay = startDate.getDate();
  }

  const maxDays = new Date(targetYear, targetMonth + 1, 0).getDate();
  const safeDay = Math.min(targetDay, maxDays);
  const currentDate = new Date(targetYear, targetMonth, safeDay);

  const y = currentDate.getFullYear();
  const m = String(currentDate.getMonth() + 1).padStart(2, '0');
  const d = String(currentDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export interface CustomInstallmentItem {
  installment: number;
  date: string;
  amount: number;
}

export const generateDefaultCustomSchedule = (
  totalAmount: number,
  terms: number,
  startDateStr: string
): CustomInstallmentItem[] => {
  const totalAmtAbs = Math.abs(totalAmount || 0);
  const safeTerms = Math.max(1, Math.min(36, terms || 1));
  const baseAmt = Math.floor(totalAmtAbs / safeTerms);
  const remainderAmt = totalAmtAbs - baseAmt * safeTerms;

  const items: CustomInstallmentItem[] = [];
  for (let i = 1; i <= safeTerms; i++) {
    const date = getCorrectInstallmentDate(startDateStr, i);
    const amount = i <= remainderAmt ? baseAmt + 1 : baseAmt;
    items.push({ installment: i, date, amount });
  }
  return items;
};



import React from 'react';
import { Category } from '../types';

export const getCategoryIcon = (categoryName: string, type: 'income' | 'expense' | 'transfer', categories: Category[]) => {
  const cleanName = (categoryName || '').replace(/\[固定收支\] /g, '').replace(/\[固定收支\]/g, '').trim();
  const mainCategoryName = cleanName.split(' > ')[0].trim();
  
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
  const category = categories.find(c => 
    c.name === mainCategoryName || 
    (c.sub && c.sub.some(s => s.trim() === mainCategoryName))
  );
  if (category) return getIconNode(category.icon);

  // Fallback to searching subcategory if not found in main
  if (cleanName.includes(' > ')) {
    const subPart = cleanName.split(' > ')[1]?.trim();
    if (subPart) {
      const subCategory = categories.find(c => c.sub && c.sub.some(s => s.trim() === subPart));
      if (subCategory) return getIconNode(subCategory.icon);
    }
  }
  
  const defaultIcon = type === 'income' ? '💰' : (type === 'expense' ? '🍱' : '🔄');
  return getIconNode(defaultIcon);
};

export const getFontFamily = () => ({ fontFamily: '"王漢宗中隸書", "王漢宗", sans-serif' });

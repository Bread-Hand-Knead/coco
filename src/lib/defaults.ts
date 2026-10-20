import type { Account, Category, Project, Template, Transaction } from '../types';

// --- Initial Data ---

export const DEFAULT_TRANSFER_CATEGORIES: Category[] = [
  { id: 'cat_tf_credit', name: '信用卡繳款', icon: '💳', type: 'transfer', sub: ['自動扣繳', '自行轉帳繳款'], order: 1 },
  { id: 'cat_tf_invest', name: '投資理財', icon: '📈', type: 'transfer', sub: ['定期定額交割', '買入股票扣款', '基金扣款'], order: 2 },
  { id: 'cat_tf_savings', name: '儲蓄調度', icon: '🏦', type: 'transfer', sub: ['活存互轉', '定存存入', '備用金'], order: 3 },
  { id: 'cat_tf_ticket', name: '電子票證加值', icon: '🚌', type: 'transfer', sub: ['悠遊卡加值', 'icash加值', '一卡通加值'], order: 4 },
];

export const ensureTransferCategories = (cats: Category[]): Category[] => {
  if (!cats || cats.length === 0) return [...INITIAL_CATEGORIES];
  if (!cats.some(c => c.type === 'transfer')) {
    return [...cats, ...DEFAULT_TRANSFER_CATEGORIES];
  }
  return cats;
};

export function findMatchingProjectId(categoryName: string | undefined | null, projects: Project[]): string | null {
  if (!categoryName || !projects || projects.length === 0) return null;
  const clean = categoryName.trim();
  if (!clean) return null;

  const parts = clean.split(/\s*(?:＞|>)\s*/).map(p => p.trim()).filter(Boolean);
  
  const namesToTry: string[] = [];
  if (parts.length > 1) {
    namesToTry.push(parts[1]);
    namesToTry.push(parts.join(' > '));
    namesToTry.push(parts.join(' ＞ '));
    namesToTry.push(parts[0]);
  } else {
    namesToTry.push(clean);
  }

  for (const candidate of namesToTry) {
    if (!candidate) continue;
    const match = (Array.isArray(projects) ? projects : []).find(p => p.name.trim().toLowerCase() === candidate.toLowerCase());
    if (match) return match.id;
  }
  return null;
}

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'c1', name: '食物', icon: '🍱', type: 'expense', sub: ['早餐', '午餐', '晚餐', '飲料', '零食'], order: 1 },
  { id: 'c2', name: '交通', icon: '🚗', type: 'expense', sub: ['捷運', '公車', '火車', '加油', '停車'], order: 2 },
  { id: 'c3', name: '購物', icon: '🛍️', type: 'expense', sub: ['服飾', '日用品', '電子產品', '美妝'], order: 3 },
  { id: 'c4', name: '娛樂', icon: '🍿', type: 'expense', sub: ['電影', '遊戲', 'KTV', '旅遊'], order: 4 },
  { id: 'c10', name: '電影', icon: '🎬', type: 'expense', sub: ['威秀電影', '國賓影城', 'Netflix'], order: 5 },
  { id: 'c5', name: '生活', icon: '🏠', type: 'expense', sub: ['房租', '水電費', '電話費', '保險'], order: 6 },
  { id: 'c6', name: '醫療', icon: '🏥', type: 'expense', sub: ['診所', '藥局', '保健品'], order: 7 },
  { id: 'c7', name: '其他', icon: '✨', type: 'expense', sub: ['雜項', '捐款', '禮物'], order: 8 },
  { id: 'c8', name: '薪資', icon: '💼', type: 'income', sub: ['月薪', '獎金', '兼職'], order: 1 },
  { id: 'c9', name: '投資', icon: '📈', type: 'income', sub: ['股利', '利息', '價差'], order: 2 },
  ...DEFAULT_TRANSFER_CATEGORIES,
];

export const INITIAL_ACCOUNTS: Account[] = [
  { id: 'cash', name: '現金', type: 'cash', icon: '💰', currency: 'TWD', order: 1 },
];

export const INITIAL_RECORDS: Transaction[] = [];

export const INITIAL_TEMPLATES: Template[] = [
  { id: 't1', name: '火車通勤', amount: 41, category: '交通', type: 'expense', fromAccountId: 'cash', icon: '🚂', color: 'bg-blue-50' },
  { id: 't2', name: '自動加值', amount: 500, category: '交通', type: 'transfer', fromAccountId: 'credit_ts', toAccountId: 'easycard', icon: '⚡', color: 'bg-emerald-50' },
  { id: 't3', name: '薪資收入', amount: 29500, category: '薪資', type: 'income', fromAccountId: 'bank_ts_1', icon: '💼', color: 'bg-amber-50' },
];

export const TRAFFIC_KEYWORDS = [
  '捷運', '公車', '火車', '高鐵', '計程車', '停車費', '停車', 'Uber', '客運', '加油', '機票', '過路費', 'ETC', '悠遊卡', 'icash', '一卡通', 'UBike', 'YouBike', '單車', '船票', '客輪', '機車', '汽車'
];

export const ensureProjectHierarchy = (projects: Project[]): Project[] => {
  if (!projects || projects.length === 0) return projects;

  // 1. 同步 parentId 與 parentProjectId
  let updated = projects.map(p => {
    const parent = p.parentProjectId || p.parentId || null;
    return {
      ...p,
      parentId: parent || undefined,
      parentProjectId: parent,
    };
  });

  // 2. 檢查是否有交通相關子項目孤立在頂層（無母專案，且非顯式設為獨立專案）
  const trafficCandidates = updated.filter(p => {
    if (p.isStandalone) return false;
    const hasParent = !!(p.parentProjectId || p.parentId);
    if (hasParent) return false;
    const isTrafficParent = ['交通', '大眾運輸', '交通運輸'].includes(p.name.trim());
    if (isTrafficParent) return false;
    return TRAFFIC_KEYWORDS.some(kw => p.name.includes(kw));
  });

  if (trafficCandidates.length > 0) {
    let trafficParent = (Array.isArray(updated) ? updated : []).find(p => 
      !(p.parentProjectId || p.parentId) && 
      ['交通', '大眾運輸', '交通運輸'].includes(p.name.trim())
    );

    if (!trafficParent) {
      trafficParent = {
        id: 'proj_traffic',
        name: '交通',
        icon: '✈️',
        color: 'bg-blue-400',
        description: '交通出行與通勤',
        order: 1,
        parentId: undefined,
        parentProjectId: null,
      };
      updated = [trafficParent, ...updated];
    }

    const trafficParentId = trafficParent.id;
    updated = updated.map(p => {
      if (trafficCandidates.some(c => c.id === p.id)) {
        return {
          ...p,
          parentId: trafficParentId,
          parentProjectId: trafficParentId,
        };
      }
      return p;
    });
  }

  return updated;
};

export const INITIAL_PROJECTS: Project[] = [
  { id: 'p1', name: '預設專案', icon: '📂', color: 'bg-stone-100', description: '系統預設專案', order: 1 },
  { id: 'proj_traffic', name: '交通', icon: '✈️', color: 'bg-blue-400', description: '交通出行與通勤', order: 2 },
  { id: 'proj_mrt', name: '捷運', icon: '🚇', parentId: 'proj_traffic', parentProjectId: 'proj_traffic', order: 3 },
  { id: 'proj_bus', name: '公車', icon: '🚌', parentId: 'proj_traffic', parentProjectId: 'proj_traffic', order: 4 },
  { id: 'proj_train', name: '火車', icon: '🚂', parentId: 'proj_traffic', parentProjectId: 'proj_traffic', order: 5 },
  { id: 'proj_hsr', name: '高鐵', icon: '🚅', parentId: 'proj_traffic', parentProjectId: 'proj_traffic', order: 6 },
  { id: 'proj_taxi', name: '計程車', icon: '🚕', parentId: 'proj_traffic', parentProjectId: 'proj_traffic', order: 7 },
  { id: 'proj_parking', name: '停車費', icon: '🅿️', parentId: 'proj_traffic', parentProjectId: 'proj_traffic', order: 8 },
];

export const defaultTypeOrder: Account['type'][] = ['cash', 'bank', 'credit', 'e-payment', 'e-ticket', 'investment', 'deposit', 'insurance', 'points', 'other'];

export const getGroupOrder = (type: Account['type'], accountsList: Account[]): number => {
  const catAccs = accountsList.filter(a => a.type === type);
  if (catAccs.length > 0) {
    return Math.min(...catAccs.map(a => a.order ?? 9999));
  }
  return 10000 + defaultTypeOrder.indexOf(type);
};

export const SEMANTIC_CATEGORY_MAP: Record<string, string[]> = {
  '飲食': ['午餐', '晚餐', '早餐', '宵夜', '飲料', '食材', '奶類', '點心', '水果', '咖啡', '外食', '外送', '下午茶', '甜點', '便當'],
  '醫療&健康': ['中醫', '西醫', '診所', '藥局', '保健', '牙醫', '眼科', '體檢', '健保', '復健'],
  '醫療健康': ['中醫', '西醫', '診所', '藥局', '保健', '牙醫', '眼科', '體檢', '健保', '復健'],
  '交通': ['捷運', '公車', '高鐵', '台鐵', '計程車', '加油', '停車', '悠遊卡', '加油費', '車資', '過路費', '定期票', '火車'],
  '居住': ['房租', '水費', '電費', '瓦斯', '管理費', '網路費', '傢俱', '家電', '日常用品', '居家'],
  '家庭': ['房租', '水費', '電費', '瓦斯', '管理費', '網路費', '傢俱', '家電', '日常用品', '居家', '家用'],
  '娛樂': ['電影', '遊戲', '追星', '展覽', 'KTV', '演唱會', '吉伊卡哇', '玩具', '動漫', '訂閱'],
  '購物': ['服飾', '鞋款', '美妝', '3C', '雜貨', '蝦皮', '淘寶']
};

export function parseCategoryHierarchy(
  rawCategory: string | undefined | null,
  categories: Category[]
): { parentName: string; subName: string } {
  if (!rawCategory || !rawCategory.trim()) {
    return { parentName: '其他', subName: '未分類' };
  }

  const cleanCat = rawCategory.trim();
  const parts = cleanCat.split(/\s*(?:＞|>)\s*/).map(p => p.trim());
  const safeCats = Array.isArray(categories) ? categories : [];

  const mainPart = parts[0];
  const subPart = parts.length > 1 ? parts[1] : undefined;

  // 1. Direct parent match
  const directParent = safeCats.find(c => c.name === mainPart);
  if (directParent) {
    return {
      parentName: directParent.name,
      subName: subPart || '主要 / 直屬'
    };
  }

  // 2. Check subcategories in defined categories list
  for (const cat of safeCats) {
    if (cat.sub && Array.isArray(cat.sub) && cat.sub.includes(mainPart)) {
      return {
        parentName: cat.name,
        subName: mainPart
      };
    }
  }

  // 3. Check semantic fallback dictionary
  for (const [parentName, subs] of Object.entries(SEMANTIC_CATEGORY_MAP)) {
    if (subs.includes(mainPart)) {
      const parentInCats = safeCats.find(c => c.name === parentName || (parentName.includes('&') && c.name.includes(parentName.split('&')[0])));
      return {
        parentName: parentInCats ? parentInCats.name : parentName,
        subName: mainPart
      };
    }
  }

  // 4. Fallback if subPart matches a parent or subcategory
  if (subPart) {
    const parentBySub = safeCats.find(c => c.sub && Array.isArray(c.sub) && c.sub.includes(subPart));
    if (parentBySub) {
      return {
        parentName: parentBySub.name,
        subName: subPart
      };
    }
  }

  // 5. Default fallback
  return {
    parentName: parts.length > 1 ? parts[0] : (safeCats.some(c => c.name === cleanCat) ? cleanCat : '其他'),
    subName: parts.length > 1 ? parts[1] : (safeCats.some(c => c.name === cleanCat) ? '主要 / 直屬' : cleanCat)
  };
}

// 帳戶類型的顯示名稱（選單分組用），順序請用 defaultTypeOrder
export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  cash: '💵 現金',
  bank: '🏦 銀行',
  credit: '💳 信用卡',
  'e-payment': '📱 電子支付',
  'e-ticket': '🚌 電子票證',
  investment: '📈 投資',
  deposit: '🔒 定存',
  insurance: '🛡️ 保險',
  points: '⭐ 點數 / 虛擬資產',
  other: '📦 其他',
};

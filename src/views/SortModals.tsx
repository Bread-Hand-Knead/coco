import { getFontFamily } from '../lib/financeUtils';
import { useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  GripVertical,
  Layers,
  X,
} from 'lucide-react';
import { AnimatePresence, Reorder, motion } from 'framer-motion';
import type { Account, Project, Template } from '../types';
import { getGroupOrder } from '../lib/defaults';
import { AccountIcon } from '../components/AccountWidgets';

export function AccountSortModal({ accounts, onClose, onSave }: { 
  accounts: Account[], 
  onClose: () => void, 
  onSave: (newOrder: Account[]) => void 
}) {
  const [categoryOrder, setCategoryOrder] = useState<Account['type'][]>(() => {
    const uniqueTypes: Account['type'][] = ['cash', 'bank', 'credit', 'e-payment', 'e-ticket', 'investment', 'deposit', 'insurance', 'points', 'other'];
    return [...uniqueTypes].sort((a, b) => getGroupOrder(a, accounts) - getGroupOrder(b, accounts));
  });

  // Grouping parents and children within their respective categories
  const [orderedAccounts, setOrderedAccounts] = useState<Account[]>(() => {
    const result: Account[] = [];
    const uniqueTypes: Account['type'][] = ['cash', 'bank', 'credit', 'e-payment', 'e-ticket', 'investment', 'deposit', 'insurance', 'points', 'other'];
    
    uniqueTypes.forEach(cat => {
      const catAccs = accounts.filter(a => a.type === cat);
      // Group parents and children
      const parents = catAccs.filter(a => !a.parentId);
      const catResult: Account[] = [];
      parents.sort((a, b) => (a.order || 0) - (b.order || 0)).forEach(p => {
        catResult.push(p);
        const children = catAccs.filter(c => c.parentId === p.id).sort((a, b) => (a.order || 0) - (b.order || 0));
        catResult.push(...children);
      });
      // Add any orphans just in case
      catAccs.forEach(a => {
        if (!catResult.find(r => r.id === a.id)) catResult.push(a);
      });
      result.push(...catResult);
    });
    
    return result;
  });

  const [expandedCategories, setExpandedCategories] = useState<Account['type'][]>([]);

  const toggleCategoryExpanded = (cat: Account['type']) => {
    setExpandedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const moveCategory = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...categoryOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    setCategoryOrder(newOrder);
  };

  const moveAccountWithinCategory = (cat: Account['type'], indexInCat: number, direction: 'up' | 'down') => {
    const catAccounts = orderedAccounts.filter(a => a.type === cat);
    const newCatAccounts = [...catAccounts];
    const item = newCatAccounts[indexInCat];

    const getSubtreeRange = (idx: number) => {
      const parent = newCatAccounts[idx];
      let endIdx = idx;
      for (let i = idx + 1; i < newCatAccounts.length; i++) {
        if (newCatAccounts[i].parentId === parent.id) {
          endIdx = i;
        } else {
          break;
        }
      }
      return [idx, endIdx];
    };

    if (item.parentId) {
      // Child account swap: only swap if the neighbor is a child of the SAME parent
      const targetIndex = direction === 'up' ? indexInCat - 1 : indexInCat + 1;
      if (targetIndex < 0 || targetIndex >= newCatAccounts.length) return;
      
      const targetItem = newCatAccounts[targetIndex];
      if (targetItem.parentId === item.parentId) {
        newCatAccounts[indexInCat] = targetItem;
        newCatAccounts[targetIndex] = item;
        
        setOrderedAccounts(prev => {
          const result: Account[] = [];
          let catIndex = 0;
          prev.forEach(acc => {
            if (acc.type === cat) {
              result.push(newCatAccounts[catIndex++]);
            } else {
              result.push(acc);
            }
          });
          return result;
        });
      }
    } else {
      // Parent account swap: move whole subtree (hen with chicks)
      const [start, end] = getSubtreeRange(indexInCat);
      const groupLength = end - start + 1;
      
      if (direction === 'up') {
        let prevParentStart = -1;
        for (let i = start - 1; i >= 0; i--) {
          if (!newCatAccounts[i].parentId) {
            prevParentStart = i;
            break;
          }
        }
        if (prevParentStart === -1) return;
        
        const group = newCatAccounts.splice(start, groupLength);
        newCatAccounts.splice(prevParentStart, 0, ...group);
      } else {
        const nextParentStart = end + 1;
        if (nextParentStart >= newCatAccounts.length) return;
        
        const [, targetEnd] = getSubtreeRange(nextParentStart);
        const group = newCatAccounts.splice(start, groupLength);
        const insertAt = targetEnd - groupLength + 1;
        newCatAccounts.splice(insertAt, 0, ...group);
      }

      setOrderedAccounts(prev => {
        const result: Account[] = [];
        let catIndex = 0;
        prev.forEach(acc => {
          if (acc.type === cat) {
            result.push(newCatAccounts[catIndex++]);
          } else {
            result.push(acc);
          }
        });
        return result;
      });
    }
  };

  const canMoveAccountUp = (cat: Account['type'], indexInCat: number) => {
    const catAccounts = orderedAccounts.filter(a => a.type === cat);
    const item = catAccounts[indexInCat];
    if (item.parentId) {
      return indexInCat > 0 && catAccounts[indexInCat - 1].parentId === item.parentId;
    }
    for (let i = indexInCat - 1; i >= 0; i--) {
      if (!catAccounts[i].parentId) return true;
    }
    return false;
  };

  const canMoveAccountDown = (cat: Account['type'], indexInCat: number) => {
    const catAccounts = orderedAccounts.filter(a => a.type === cat);
    const item = catAccounts[indexInCat];
    if (item.parentId) {
      return indexInCat < catAccounts.length - 1 && catAccounts[indexInCat + 1].parentId === item.parentId;
    }
    let endIdx = indexInCat;
    for (let i = indexInCat + 1; i < catAccounts.length; i++) {
      if (catAccounts[i].parentId === item.id) endIdx = i;
      else break;
    }
    return endIdx < catAccounts.length - 1;
  };

  const categoryUiConfig: Record<Account['type'], { label: string; bg: string; icon: string }> = {
    cash: { label: '現金', bg: 'bg-[#26A69A]', icon: '💵' },
    bank: { label: '銀行', bg: 'bg-[#42A5F5]', icon: '🏦' },
    credit: { label: '信用卡', bg: 'bg-[#EF5350]', icon: '💳' },
    'e-payment': { label: '電子支付', bg: 'bg-[#26C6DA]', icon: '📱' },
    'e-ticket': { label: '儲值卡', bg: 'bg-[#FFA726]', icon: '🚃' },
    investment: { label: '證券', bg: 'bg-[#78909C]', icon: '📈' },
    deposit: { label: '定存', bg: 'bg-[#9CCC65]', icon: '🏦' },
    insurance: { label: '保險', bg: 'bg-[#FF7043]', icon: '🛡️' },
    points: { label: '點數 / 虛擬資產', bg: 'bg-[#FDD835]', icon: '⭐' },
    other: { label: '其他', bg: 'bg-[#8D6E63]', icon: '💼' }
  };

  const handleSave = () => {
    const finalOrderedAccounts: Account[] = [];
    
    categoryOrder.forEach(cat => {
      const catAccs = orderedAccounts.filter(a => a.type === cat);
      finalOrderedAccounts.push(...catAccs);
    });
    
    const savedAccounts = finalOrderedAccounts.map((acc, index) => ({
      ...acc,
      order: index
    }));
    
    onSave(savedAccounts);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#5D4037]/60 backdrop-blur-md z-[80] flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="bg-[#FFFDF5] w-full max-w-sm rounded-[44px] flex flex-col shadow-2xl border-4 border-white overflow-hidden max-h-[85vh]"
        style={getFontFamily()}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-8 pb-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
              <ChevronLeft className="w-6 h-6 text-[#5D4037]" />
            </button>
            <h3 className="text-2xl font-black text-[#5D4037]">帳戶類型排序</h3>
          </div>
          <div className="w-12 h-12 bg-[#FFD54F] rounded-2xl flex items-center justify-center shadow-md">
            <span className="text-xl font-bold text-[#5D4037]">☰↑</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 no-scrollbar">
          {categoryOrder.map((cat, index) => {
            const config = categoryUiConfig[cat];
            const catAccounts = orderedAccounts.filter(a => a.type === cat);
            const isExpanded = expandedCategories.includes(cat);
            const hasAccounts = catAccounts.length > 0;
            
            return (
              <div key={cat} className="flex flex-col gap-2">
                {/* Category Header Row */}
                <div className="flex items-center gap-3 p-4 bg-white rounded-3xl border-2 border-stone-50 shadow-sm transition-all hover:bg-stone-50/50">
                  {/* Category Icon */}
                  <div className={`w-12 h-12 rounded-full ${config.bg} flex items-center justify-center text-2xl shadow-sm text-white`}>
                    {config.icon}
                  </div>
                  
                  {/* Category Name & Toggle Arrow */}
                  <button 
                    onClick={() => toggleCategoryExpanded(cat)}
                    className="flex-1 flex items-center justify-between min-w-0 text-left font-black text-[#5D4037]"
                  >
                    <span className="text-base truncate">{config.label}</span>
                    <ChevronDown 
                      size={20} 
                      className={`text-[#5D4037]/60 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
                    />
                  </button>
                  
                  {/* Category Sorting Buttons */}
                  <div className="flex items-center gap-1 border-l border-stone-100 pl-2">
                    <button 
                      disabled={index === 0}
                      onClick={() => moveCategory(index, 'up')}
                      className="p-1 hover:bg-stone-100 rounded-lg text-stone-300 hover:text-[#5D4037] disabled:opacity-10 transition-all active:scale-75"
                    >
                      <ChevronUp size={20} />
                    </button>
                    <button 
                      disabled={index === categoryOrder.length - 1}
                      onClick={() => moveCategory(index, 'down')}
                      className="p-1 hover:bg-stone-100 rounded-lg text-stone-300 hover:text-[#5D4037] disabled:opacity-10 transition-all active:scale-75"
                    >
                      <ChevronDown size={20} />
                    </button>
                  </div>
                </div>
                
                {/* Expanded Account List */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden pl-4 pr-2 py-1 space-y-2 border-l-2 border-[#5D4037]/10 ml-6"
                    >
                      {hasAccounts ? (
                        catAccounts.map((acc, idx) => {
                          const isChild = !!acc.parentId;
                          return (
                            <div 
                              key={acc.id}
                              className={`flex items-center gap-3 p-3 bg-white/70 rounded-2xl border border-stone-100 shadow-sm transition-all group ${isChild ? 'ml-6 bg-white/40 scale-95' : ''}`}
                            >
                              <AccountIcon icon={acc.icon} sizeClassName="w-5 h-5" className="text-xl flex items-center justify-center" />
                              <div className="flex-1 min-w-0">
                                <span className="font-bold text-[#5D4037] text-sm truncate block">{acc.name}</span>
                              </div>
                              
                              {/* Account Sorting Buttons */}
                              <div className="flex items-center gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                                <button 
                                  disabled={!canMoveAccountUp(cat, idx)}
                                  onClick={() => moveAccountWithinCategory(cat, idx, 'up')}
                                  className="p-1 hover:bg-stone-50 rounded-lg text-stone-300 hover:text-[#5D4037] disabled:opacity-5 transition-all active:scale-75"
                                >
                                  <ChevronUp size={16} />
                                </button>
                                <button 
                                  disabled={!canMoveAccountDown(cat, idx)}
                                  onClick={() => moveAccountWithinCategory(cat, idx, 'down')}
                                  className="p-1 hover:bg-stone-50 rounded-lg text-stone-300 hover:text-[#5D4037] disabled:opacity-5 transition-all active:scale-75"
                                >
                                  <ChevronDown size={16} />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-stone-500 text-xs py-3 pl-2 italic">此類型暫無帳戶</div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
          <div className="h-6" />
        </div>

        <div className="p-8 pt-4 flex-shrink-0 bg-white/80 backdrop-blur-sm border-t border-stone-100">
          <button 
            onClick={handleSave}
            className="w-full py-5 bg-[#5D4037] text-white rounded-3xl font-black text-xl flex items-center justify-center gap-3 shadow-[0_10px_30px_-10px_rgba(93,64,55,0.4)] active:scale-95 transition-all"
          >
            <Check size={28} /> 完成排序
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function TemplateSortModal({ 
  templates, 
  onClose, 
  onSave 
}: { 
  templates: Template[], 
  onClose: () => void, 
  onSave: (newTemplates: Template[]) => void 
}) {
  const [items, setItems] = useState<Template[]>(() => {
    return [...templates].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  });

  const handleSave = () => {
    const updated = items.map((t, idx) => ({ ...t, order: idx }));
    onSave(updated);
    onClose();
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#5D4037]/40 backdrop-blur-md z-[100] flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="bg-[#FFFDF5] w-full max-w-sm rounded-[30px] shadow-2xl border-2 border-white overflow-hidden max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
        style={getFontFamily()}
      >
        <div className="p-6 pb-2 border-b border-stone-50 flex items-center justify-between shrink-0">
          <h3 className="text-xl font-black text-[#5D4037]">範本排序</h3>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
            <X size={20} className="text-stone-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest leading-none mb-2 px-1">
            按住右側圖示 ☰ 上下拖曳以排序
          </div>
          
          <Reorder.Group axis="y" values={items} onReorder={setItems} className="space-y-3">
            {items.map(t => (
              <Reorder.Item 
                key={t.id} 
                value={t}
                className="bg-white rounded-2xl border-2 border-stone-50 shadow-sm p-4 flex items-center gap-3 relative"
              >
                <div className={`w-10 h-10 ${t.color} rounded-xl flex items-center justify-center text-xl shadow-sm bg-[#FFFDF5]`}>
                  {t.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-base text-[#5D4037] truncate block">{t.name}</span>
                  <span className="text-xs text-stone-400 block">{t.type === 'transfer' ? '轉帳' : t.category}</span>
                </div>
                <div className="cursor-grab active:cursor-grabbing p-2 text-stone-300 hover:text-[#5D4037] transition-colors">
                  <GripVertical size={20} />
                </div>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        </div>

        <div className="p-6 border-t border-stone-50 bg-[#FFFDF5] shrink-0">
          <button 
            onClick={handleSave}
            className="w-full py-4 bg-[#5D4037] hover:bg-[#5D4037]/90 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"
          >
            <Check size={24} /> 完成排序
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function ProjectSortModal({ projects, onClose, onSave }: {
  projects: Project[],
  onClose: () => void,
  onSave: (newOrder: Project[]) => void
}) {
  const [rootProjects, setRootProjects] = useState(() => 
    projects.filter(p => !(p.parentProjectId || p.parentId))
  );

  const [childProjectsMap, setChildProjectsMap] = useState<Record<string, Project[]>>(() => {
    const map: Record<string, Project[]> = {};
    projects.forEach(p => {
      const pid = p.parentProjectId || p.parentId;
      if (pid) {
        if (!map[pid]) {
          map[pid] = [];
        }
        map[pid].push(p);
      }
    });
    return map;
  });

  const handleReorderChildren = (parentId: string, newChildren: Project[]) => {
    setChildProjectsMap(prev => ({
      ...prev,
      [parentId]: newChildren
    }));
  };

  const handleSave = () => {
    let currentOrder = 1;
    const finalProjects: Project[] = [];

    rootProjects.forEach(rp => {
      finalProjects.push({ ...rp, order: currentOrder++ });
      const children = childProjectsMap[rp.id] || [];
      children.forEach(cp => {
        finalProjects.push({ ...cp, order: currentOrder++ });
      });
    });

    projects.forEach(p => {
      if (!(Array.isArray(finalProjects) ? finalProjects : []).find(fp => fp.id === p.id)) {
        finalProjects.push({ ...p, order: currentOrder++ });
      }
    });

    onSave(finalProjects);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#5D4037]/60 backdrop-blur-md z-[80] flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="bg-[#FFFDF5] w-full max-w-sm rounded-[44px] flex flex-col shadow-2xl border-4 border-white overflow-hidden max-h-[85vh]"
        style={getFontFamily()}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-8 pb-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
              <ChevronLeft className="w-6 h-6 text-[#5D4037]" />
            </button>
            <h3 className="text-2xl font-black text-[#5D4037]">專案排序</h3>
          </div>
          <div className="w-12 h-12 bg-[#FFD54F] rounded-2xl flex items-center justify-center shadow-md">
            <Layers size={24} className="text-[#5D4037]" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest leading-none mb-2 px-1">
            按住右側圖示 ☰ 上下拖曳以排序
          </div>
          
          <Reorder.Group axis="y" values={rootProjects} onReorder={setRootProjects} className="space-y-4">
            {rootProjects.map(project => {
              const children = childProjectsMap[project.id] || [];
              return (
                <Reorder.Item 
                  key={project.id} 
                  value={project}
                  className="bg-white rounded-3xl border-2 border-stone-50 shadow-sm p-4 space-y-3 relative"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl border border-stone-50 shadow-sm bg-[#FFFDF5]">
                      <AccountIcon icon={project.icon || '📂'} sizeClassName="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest leading-none block mb-1">
                        主專案
                      </span>
                      <span className="font-black text-base text-[#5D4037] truncate block">{project.name}</span>
                    </div>
                    <div className="cursor-grab active:cursor-grabbing p-2 text-stone-300 hover:text-[#5D4037] transition-colors">
                      <GripVertical size={20} />
                    </div>
                  </div>

                  {children.length > 0 && (
                    <div className="pl-6 pt-2 border-t border-stone-50 space-y-2">
                      <Reorder.Group 
                        axis="y" 
                        values={children} 
                        onReorder={(newChildren) => handleReorderChildren(project.id, newChildren)}
                        className="space-y-2"
                      >
                        {children.map(child => (
                          <Reorder.Item 
                            key={child.id} 
                            value={child}
                            className="flex items-center gap-3 p-3 bg-stone-50/70 rounded-2xl border border-stone-100/50 relative"
                          >
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base border border-stone-50 shadow-sm bg-white">
                              <AccountIcon icon={child.icon || '📄'} sizeClassName="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest leading-none block mb-0.5">
                                子專案
                              </span>
                              <span className="font-bold text-sm text-[#5D4037] truncate block">{child.name}</span>
                            </div>
                            <div className="cursor-grab active:cursor-grabbing p-1.5 text-stone-300 hover:text-[#5D4037] transition-colors">
                              <GripVertical size={16} />
                            </div>
                          </Reorder.Item>
                        ))}
                      </Reorder.Group>
                    </div>
                  )}
                </Reorder.Item>
              );
            })}
          </Reorder.Group>
          <div className="h-6" />
        </div>

        <div className="p-8 pt-4 flex-shrink-0 bg-white/80 backdrop-blur-sm border-t border-stone-100">
          <button 
            onClick={handleSave}
            className="w-full py-5 bg-[#5D4037] text-white rounded-3xl font-black text-xl flex items-center justify-center gap-3 shadow-[0_10px_30px_-10px_rgba(93,64,55,0.4)] active:scale-95 transition-all"
          >
            <Check size={28} /> 完成排序
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

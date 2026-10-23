import { getFontFamily } from '../lib/financeUtils';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Layers,
  Search,
  Settings2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Project, Transaction } from '../types';
import { AccountIcon } from '../components/AccountWidgets';

export function ProjectsView({ projects, records, onProjectClick, onEditProject, onBack }: { 
  projects: Project[], 
  records: Transaction[], 
  onProjectClick: (id: string) => void,
  onEditProject: (p: Project) => void,
  onBack: () => void 
}) {
  const [searchQuery, setSearchQuery] = useState('');
  // 預設收合狀態：所有母專案預設收合
  const [expandedParentIds, setExpandedParentIds] = useState<Set<string>>(new Set());

  const getProjectStats = (projectId: string): { expense: number, income: number } => {
    // 支援母子階層與拆分子項目獨立專案即時加總
    const childProjectIds = projects
      .filter(p => (p.parentProjectId || p.parentId) === projectId)
      .map(p => p.id);
    const allIds = [projectId, ...childProjectIds];

    let expense = 0;
    let income = 0;

    records.forEach(r => {
      if (r.isMergedChild || r.parentId || r.parentTransactionId || r.isChildTransaction) return;

      if (r.subItems && r.subItems.length > 0) {
        r.subItems.forEach(s => {
          const sPid = s.projectId || r.projectId || 'p1';
          const matches = projectId === 'p1' ? (!s.projectId && !r.projectId) || allIds.includes(sPid) : allIds.includes(sPid);
          if (matches) {
            if (r.type === 'expense' && !s.isPrepay) {
              expense += (s.amount || 0);
            } else if (r.type === 'income' && !s.isPrepay) {
              income += (s.amount || 0);
            }
          }
        });
        if (r.fee && r.fee > 0) {
          const rPid = r.projectId || 'p1';
          const matches = projectId === 'p1' ? (!r.projectId || allIds.includes(r.projectId)) : allIds.includes(rPid);
          if (matches && r.type === 'expense' && !r.isPrepay) {
            expense += r.fee;
          }
        }
      } else {
        const rPid = r.projectId || 'p1';
        const matches = projectId === 'p1' ? (!r.projectId || allIds.includes(r.projectId)) : allIds.includes(rPid);
        if (matches) {
          if (r.type === 'expense' && !r.isPrepay) {
            expense += Math.abs(r.amount) + (r.fee || 0);
          } else if (r.type === 'income' && !r.isPrepay) {
            income += Math.abs(r.amount);
          }
        }
      }
    });

    return { expense, income };
  };

  const query = searchQuery.trim().toLowerCase();

  // 頂層母專案與無母專案之專案
  const rootProjects = useMemo(() => {
    const parentIds = new Set(projects.map(p => p.id));
    return projects.filter(p => {
      const pid = p.parentProjectId || p.parentId;
      return !pid || !parentIds.has(pid);
    });
  }, [projects]);

  const getChildren = (parentId: string) => 
    projects.filter(p => (p.parentProjectId || p.parentId) === parentId);

  const filteredTree = useMemo(() => {
    if (!query) {
      return rootProjects.map(project => ({
        project,
        children: getChildren(project.id),
      }));
    }

    const result: { project: Project; children: Project[] }[] = [];

    rootProjects.forEach(project => {
      const allChildren = getChildren(project.id);
      const isParentMatch = project.name.toLowerCase().includes(query);
      const matchingChildren = allChildren.filter(c => c.name.toLowerCase().includes(query));

      if (isParentMatch) {
        result.push({
          project,
          children: allChildren,
        });
      } else if (matchingChildren.length > 0) {
        result.push({
          project,
          children: matchingChildren,
        });
      }
    });

    return result;
  }, [rootProjects, projects, query]);

  // 搜尋時若比對到子專案，自動展開該母專案
  useEffect(() => {
    if (query) {
      const matchedParents = new Set<string>();
      filteredTree.forEach(({ project, children }) => {
        if (children.length > 0) {
          matchedParents.add(project.id);
        }
      });
      setExpandedParentIds(matchedParents);
    }
  }, [query, filteredTree]);

  // 所有含有子專案的母專案 ID
  const parentIdsWithChildren = useMemo(() => {
    return filteredTree.filter(item => item.children.length > 0).map(item => item.project.id);
  }, [filteredTree]);

  const isAllExpanded = parentIdsWithChildren.length > 0 && parentIdsWithChildren.every(id => expandedParentIds.has(id));

  const toggleExpandAll = () => {
    if (isAllExpanded) {
      setExpandedParentIds(new Set());
    } else {
      setExpandedParentIds(new Set(parentIdsWithChildren));
    }
  };

  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedParentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full bg-white shadow-inner"
      style={getFontFamily()}
    >
      {/* 頂部即時關鍵字搜尋欄 */}
      <div className="px-4 py-3 bg-white border-b border-stone-100 flex-shrink-0">
        <div className="relative flex items-center">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-300 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜尋專案名稱..."
            className="w-full pl-10 pr-10 py-2.5 bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200 focus:border-[#FFD54F] rounded-full text-sm font-bold text-[#5D4037] placeholder-stone-300 outline-none transition-all shadow-sm"
            style={getFontFamily()}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-stone-200 hover:bg-stone-300 text-stone-500 flex items-center justify-center transition-colors active:scale-95"
              aria-label="清空搜尋"
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      {/* 專案列表上方控制列：顯示數量與一鍵展開/收合按鈕 */}
      <div className="px-4 py-2.5 bg-[#FFFDF5] border-b border-stone-100 flex items-center justify-between text-xs font-bold text-stone-400 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <Layers size={14} className="text-stone-400" />
          <span>共 {filteredTree.length} 個專案群組</span>
        </div>
        {parentIdsWithChildren.length > 0 && (
          <button
            onClick={toggleExpandAll}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-stone-200/80 text-[#5D4037] hover:bg-stone-50 shadow-xs active:scale-95 transition-all text-xs font-black"
            style={getFontFamily()}
          >
            {isAllExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            <span>{isAllExpanded ? '全部收合' : '全部展開'}</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredTree.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-stone-300 gap-2 opacity-60">
            <Search size={36} className="text-stone-300" />
            <span className="text-sm font-bold text-stone-400" style={getFontFamily()}>
              找不到相符的專案
            </span>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {filteredTree.map(({ project, children }) => {
              const hasChildren = children.length > 0;
              const isExpanded = expandedParentIds.has(project.id);
              const parentStats = getProjectStats(project.id);
              const isDefault = project.id === 'p1';

              return (
                <div key={project.id} className="transition-colors">
                  {/* 母專案卡片 */}
                  <div 
                    onClick={() => {
                      if (hasChildren) {
                        toggleExpand(project.id);
                      } else {
                        onProjectClick(project.id);
                      }
                    }}
                    className={`flex items-center gap-3.5 py-4 px-4 active:bg-stone-50/80 transition-colors cursor-pointer group ${
                      isExpanded ? 'bg-stone-50/40' : ''
                    }`}
                  >
                    {/* 專案圖示 */}
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        onProjectClick(project.id);
                      }}
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm flex-shrink-0 transition-transform group-active:scale-95 ${
                        project.color || 'bg-blue-400'
                      } text-white`}
                      title="點擊查看專案明細"
                    >
                      <AccountIcon icon={project.icon} sizeClassName="w-7 h-7" />
                    </div>

                    {/* 專案名稱與子項目數量標籤 */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span 
                          onClick={(e) => {
                            e.stopPropagation();
                            onProjectClick(project.id);
                          }}
                          className="font-black text-[#5D4037] text-[16px] hover:underline truncate"
                        >
                          {project.name}
                        </span>
                        {hasChildren && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-black bg-[#FFF4C7] text-[#8D6E63] border border-[#FFE082]/70 shadow-2xs">
                            含 {children.length} 個子項目
                          </span>
                        )}
                      </div>
                      {project.description && (
                        <span className="text-xs text-stone-400 font-bold truncate mt-0.5">
                          {project.description}
                        </span>
                      )}
                    </div>
                    
                    {/* 金額彙總與操作按鈕 */}
                    <div className="flex items-center gap-2.5 flex-shrink-0">
                      <div className="text-right">
                        <div className="text-[15px] font-black text-rose-500">
                          ${parentStats.expense.toLocaleString()}
                        </div>
                        {parentStats.income > 0 && (
                          <div className="text-[13px] font-black text-blue-500">
                            +${parentStats.income.toLocaleString()}
                          </div>
                        )}
                      </div>

                      {/* 編輯按鈕 */}
                      {!isDefault && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditProject(project);
                          }}
                          className="p-2 text-stone-300 hover:text-[#5D4037] hover:bg-stone-100 rounded-xl transition-all"
                          title="編輯專案"
                        >
                          <Settings2 size={18} />
                        </button>
                      )}

                      {/* 展開/收合旋轉切換箭頭 */}
                      {hasChildren ? (
                        <button
                          onClick={(e) => toggleExpand(project.id, e)}
                          className="p-1.5 text-stone-400 hover:text-[#5D4037] hover:bg-stone-100 rounded-xl transition-all"
                          aria-label={isExpanded ? '收合子專案' : '展開子專案'}
                        >
                          <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown size={20} />
                          </motion.div>
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onProjectClick(project.id);
                          }}
                          className="p-1.5 text-stone-300 hover:text-[#5D4037] hover:bg-stone-100 rounded-xl transition-all"
                          title="查看明細"
                        >
                          <ChevronRight size={18} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 展開之子專案 Accordion 抽屜 */}
                  <AnimatePresence initial={false}>
                    {hasChildren && isExpanded && (
                      <motion.div
                        key={`sub-${project.id}`}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className="overflow-hidden bg-[#FAF8F5]/90 border-t border-stone-100/90"
                      >
                        {/* 專案快速入口列 */}
                        <div className="px-5 pt-3 pb-2 flex items-center justify-between">
                          <button
                            onClick={() => onProjectClick(project.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-amber-50 text-[#5D4037] rounded-xl text-xs font-black shadow-xs border border-stone-200/80 active:scale-95 transition-all"
                          >
                            <span>📊 查看【{project.name}】全體收支明細</span>
                            <ChevronRight size={13} />
                          </button>
                          <span className="text-[11px] font-bold text-stone-400">
                            已彙總 {children.length} 個子專案
                          </span>
                        </div>

                        {/* 巢狀子專案卡片列表 */}
                        <div className="px-4 pb-3 space-y-2">
                          {children.map(child => {
                            const childStats = getProjectStats(child.id);
                            return (
                              <div
                                key={child.id}
                                onClick={() => onProjectClick(child.id)}
                                className="flex items-center gap-3 py-2.5 px-3.5 bg-white hover:bg-[#FFFDF9] rounded-2xl border border-stone-100 shadow-2xs cursor-pointer active:scale-[0.99] transition-all ml-4 relative before:content-[''] before:absolute before:-left-3 before:top-1/2 before:w-3 before:h-[2px] before:bg-stone-200"
                              >
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-2xs flex-shrink-0 ${
                                  child.color || 'bg-stone-100 text-[#5D4037]'
                                }`}>
                                  <AccountIcon icon={child.icon} sizeClassName="w-5 h-5" />
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="font-bold text-[#5D4037] text-[14px] truncate">
                                    {child.name}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <div className="text-right">
                                    <div className="text-[13px] font-bold text-rose-500">
                                      ${childStats.expense.toLocaleString()}
                                    </div>
                                    {childStats.income > 0 && (
                                      <div className="text-[11px] font-bold text-blue-500">
                                        +${childStats.income.toLocaleString()}
                                      </div>
                                    )}
                                  </div>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onEditProject(child);
                                    }}
                                    className="p-1.5 text-stone-300 hover:text-[#5D4037] hover:bg-stone-100 rounded-lg transition-all"
                                    title="編輯子專案"
                                  >
                                    <Settings2 size={16} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

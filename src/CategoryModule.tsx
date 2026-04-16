import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  X, 
  Check,
  Star,
  Mic,
  Gift,
  Gem as Diamond,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Category } from './types';

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'c1', name: '食物', icon: '🍱', type: 'expense', sub: ['早餐', '午餐', '晚餐', '飲料', '零食'] },
  { id: 'c2', name: '交通', icon: '🚗', type: 'expense', sub: ['捷運', '公車', '火車', '加油', '停車'] },
  { id: 'c3', name: '購物', icon: '🛍️', type: 'expense', sub: ['服飾', '日用品', '電子產品', '美妝'] },
  { id: 'c4', name: '娛樂', icon: '🎮', type: 'expense', sub: ['電影', '遊戲', 'KTV', '旅遊'] },
  { id: 'c5', name: '生活', icon: '🏠', type: 'expense', sub: ['房租', '水電費', '電話費', '保險'] },
  { id: 'c6', name: '醫療', icon: '🏥', type: 'expense', sub: ['診所', '藥局', '保健品'] },
  { id: 'c7', name: '其他', icon: '✨', type: 'expense', sub: ['雜項', '捐款', '禮物'] },
  { id: 'c8', name: '薪資', icon: '💼', type: 'income', sub: ['月薪', '獎金', '兼職'] },
  { id: 'c9', name: '投資', icon: '📈', type: 'income', sub: ['股利', '利息', '價差'] },
];

export function CategoryManagementPage({ categories, onSave, onBack }: { 
  categories: Category[], 
  onSave: (cats: Category[]) => void,
  onBack: () => void 
}) {
  const [tab, setTab] = useState<'expense' | 'income'>('expense');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [newCat, setNewCat] = useState<Partial<Category>>({ name: '', icon: '✨', type: 'expense', sub: [] });
  
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [newSubIcon, setNewSubIcon] = useState('⭐');

  const filtered = categories.filter(c => c.type === tab);

  useEffect(() => {
    const handleAdd = () => {
      setNewCat({ name: '', icon: '✨', type: tab, sub: [] });
      setEditingCat(null);
      setIsAddModalOpen(true);
    };
    window.addEventListener('trigger-add-category', handleAdd);
    return () => window.removeEventListener('trigger-add-category', handleAdd);
  }, [tab]);

  const handleSave = () => {
    if (!newCat.name) return;
    const catToSave = {
      id: editingCat?.id || Math.random().toString(36).substr(2, 9),
      name: newCat.name,
      icon: newCat.icon || '✨',
      type: tab,
      sub: newCat.sub || []
    } as Category;

    if (editingCat) {
      onSave(categories.map(c => c.id === editingCat.id ? catToSave : c));
    } else {
      onSave([...categories, catToSave]);
    }
    setIsAddModalOpen(false);
    setEditingCat(null);
    setNewCat({ name: '', icon: '✨', type: 'expense', sub: [] });
  };

  const handleAddSub = () => {
    if (!newSubName) return;
    const subStr = `${newSubIcon} ${newSubName}`;
    setNewCat(prev => ({
      ...prev,
      sub: [...(prev.sub || []), subStr]
    }));
    setNewSubName('');
    setIsSubModalOpen(false);
  };

  const removeSub = (index: number) => {
    setNewCat(prev => ({
      ...prev,
      sub: (prev.sub || []).filter((_, i) => i !== index)
    }));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full bg-[#FFF9E3]"
    >
      <div className="p-6 flex flex-col gap-6">
        <div className="flex bg-white/50 p-1.5 rounded-2xl border-2 border-white shadow-sm">
          {(['expense', 'income'] as const).map(t => (
            <button 
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${tab === t ? 'bg-[#5D4037] text-white shadow-md' : 'text-stone-400'}`}
            >
              {t === 'expense' ? '支出分類' : '收入分類'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-6 space-y-3 pb-24">
        {filtered.map(cat => (
          <div 
            key={cat.id}
            className="bg-white p-4 rounded-[25px] border-2 border-white shadow-sm flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#FFFDF5] rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-stone-50">
                {cat.icon}
              </div>
              <div className="flex flex-col">
                <span className="font-black text-[#5D4037]">{cat.name}</span>
                <span className="text-[10px] font-bold text-stone-300 uppercase tracking-widest">
                  {cat.sub.length} 個子分類
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => { setEditingCat(cat); setNewCat(cat); setIsAddModalOpen(true); }}
                className="p-2 hover:bg-stone-50 rounded-xl text-stone-300 hover:text-[#5D4037] transition-all"
              >
                <Pencil size={18} />
              </button>
              <button 
                onClick={() => onSave(categories.filter(c => c.id !== cat.id))}
                className="p-2 hover:bg-rose-50 rounded-xl text-stone-200 hover:text-rose-400 transition-all"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#5D4037]/40 backdrop-blur-md"
              onClick={() => setIsAddModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="relative bg-[#FFFDF5] w-full max-w-sm rounded-[40px] shadow-2xl border-2 border-white overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-8 pb-4 flex items-center justify-between">
                <h3 className="text-xl font-black text-[#5D4037]">{editingCat ? '編輯分類' : '新增分類'}</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                  <X size={20} className="text-stone-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar p-8 pt-2 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">分類名稱</label>
                  <input 
                    value={newCat.name}
                    onChange={e => setNewCat({ ...newCat, name: e.target.value })}
                    className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                    placeholder="輸入分類名稱"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">分類圖示</label>
                  <div className="grid grid-cols-6 gap-2">
                    {['🍱', '🚗', '🛍️', '🎮', '🏠', '🏥', '✨', '💼', '📈', '🍔', '☕', '🎬', '👗', '💊', '🎁', '💡', '📚', '⚽'].map(icon => (
                      <button 
                        key={icon}
                        onClick={() => setNewCat({ ...newCat, icon })}
                        className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center text-xl transition-all ${newCat.icon === icon ? 'bg-[#FFD54F] border-[#FFD54F] shadow-md scale-110' : 'bg-white border-stone-50 shadow-sm'}`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest">子分類列表</label>
                    <button 
                      onClick={() => setIsSubModalOpen(true)}
                      className="text-[10px] font-black text-[#FFD54F] uppercase tracking-widest flex items-center gap-1 hover:opacity-80 transition-opacity"
                    >
                      <Plus size={12} /> 新增子分類
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {newCat.sub?.map((sub, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-xl border-2 border-stone-50 shadow-sm group">
                        <span className="font-bold text-[#5D4037] text-sm">{sub}</span>
                        <button 
                          onClick={() => removeSub(idx)}
                          className="p-1 text-stone-200 hover:text-rose-400 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    {(!newCat.sub || newCat.sub.length === 0) && (
                      <div className="text-center py-6 border-2 border-dashed border-stone-100 rounded-2xl">
                        <span className="text-xs font-bold text-stone-300">尚未新增子分類</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-8 pt-4">
                <button 
                  onClick={handleSave}
                  className="w-full py-5 bg-[#5D4037] text-white rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Check size={20} /> 儲存分類
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sub-category Add Modal */}
      <AnimatePresence>
        {isSubModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#5D4037]/20 backdrop-blur-sm"
              onClick={() => setIsSubModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-[280px] rounded-[30px] shadow-2xl p-6 space-y-6"
            >
              <h4 className="font-black text-[#5D4037] text-center">新增子分類</h4>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">名稱</label>
                <input 
                  autoFocus
                  value={newSubName}
                  onChange={e => setNewSubName(e.target.value)}
                  className="w-full p-3 bg-stone-50 rounded-xl font-bold text-[#5D4037] outline-none border-2 border-transparent focus:border-[#FFD54F] text-sm"
                  placeholder="子分類名稱"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">圖示</label>
                <div className="flex justify-around bg-stone-50 p-2 rounded-xl">
                  {[
                    { icon: <Diamond size={20} />, label: '💎' },
                    { icon: <Star size={20} />, label: '⭐' },
                    { icon: <Mic size={20} />, label: '🎤' },
                    { icon: <Gift size={20} />, label: '🎁' }
                  ].map(item => (
                    <button 
                      key={item.label}
                      onClick={() => setNewSubIcon(item.label)}
                      className={`p-2 rounded-lg transition-all ${newSubIcon === item.label ? 'bg-[#FFD54F] text-[#5D4037] shadow-sm scale-110' : 'text-stone-300 hover:text-[#5D4037]'}`}
                    >
                      {item.icon}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setIsSubModalOpen(false)}
                  className="flex-1 py-3 bg-stone-100 text-stone-400 rounded-xl font-black text-sm"
                >
                  取消
                </button>
                <button 
                  onClick={handleAddSub}
                  className="flex-1 py-3 bg-[#5D4037] text-white rounded-xl font-black text-sm shadow-lg active:scale-95"
                >
                  確定
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

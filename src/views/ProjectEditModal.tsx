import { getFontFamily } from '../lib/financeUtils';
import React, { useState } from 'react';
import { Check, ChevronLeft, Trash2, Upload } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Project } from '../types';

export function ProjectEditModal({ project, projects, onClose, onSave, onDelete }: { 
  project: Project, 
  projects: Project[],
  onClose: () => void, 
  onSave: (p: Project) => void,
  onDelete: (id: string) => void
}) {
  const [edited, setEdited] = useState<Project>({ ...project });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Eligible parents are projects that are not the current project and don't have a parent themselves (to simplify to 2 levels)
  // or just not the current project. The prompt suggests a 2-level structure ("主專案" and "子專案").
  const eligibleParents = projects.filter(p => p.id !== project.id && !p.parentId && !p.parentProjectId && p.id !== 'p1');

  const handleUploadIconImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 128;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/png');
          setEdited(prev => ({ ...prev, icon: dataUrl }));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#5D4037]/60 backdrop-blur-md z-[80] flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="bg-[#FFFDF5] w-full max-w-sm rounded-[44px] flex flex-col shadow-2xl border-4 border-white overflow-hidden"
        style={getFontFamily()}
        onClick={e => e.stopPropagation()}
      >
        <AnimatePresence>
          {showDeleteConfirm && (
            <motion.div 
              initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }}
              className="absolute inset-0 bg-rose-500 z-[90] flex flex-col items-center justify-center p-8 text-white text-center gap-6"
            >
              <Trash2 size={64} className="mb-2" />
              <h4 className="text-2xl font-black">確定要刪除專案嗎？</h4>
              <p className="text-sm font-bold opacity-80 text-rose-100">刪除後將無法復原內容，現有交易紀錄的專案關聯將消失。</p>
              <div className="flex w-full gap-3 mt-4">
                <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-4 bg-white/20 rounded-2xl font-bold">取消</button>
                <button onClick={() => onDelete(project.id)} className="flex-1 py-4 bg-white text-rose-500 rounded-2xl font-black shadow-lg">確定刪除</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-8 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
              <ChevronLeft className="w-6 h-6 text-[#5D4037]" />
            </button>
            <h3 className="text-2xl font-black text-[#5D4037]">編輯專案</h3>
          </div>
          <button onClick={() => setShowDeleteConfirm(true)} className="p-3 text-rose-400 hover:bg-rose-50 rounded-2xl transition-colors">
            <Trash2 size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[60vh] p-8 pt-0 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-[#5D4037]/40 uppercase tracking-widest px-1">專案名稱</label>
            <input 
              value={edited.name}
              onChange={e => setEdited({ ...edited, name: e.target.value })}
              className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
              placeholder="輸入專案名稱..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-[#5D4037]/40 uppercase tracking-widest px-1">所屬母專案</label>
            <select 
              value={edited.parentProjectId || edited.parentId || ''}
              onChange={e => {
                const val = e.target.value || null;
                setEdited({
                  ...edited,
                  parentId: val || undefined,
                  parentProjectId: val,
                  isStandalone: val === null ? true : false,
                });
              }}
              className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all appearance-none cursor-pointer"
            >
              <option value="">(無母專案 / 獨立專案)</option>
              {eligibleParents.map(p => {
                const displayIcon = p.icon && !(p.icon.startsWith('http') || p.icon.startsWith('data:image/') || p.icon.startsWith('/')) ? p.icon : '📂';
                return (
                  <option key={p.id} value={p.id}>{displayIcon} {p.name}</option>
                );
              })}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-[#5D4037]/40 uppercase tracking-widest px-1">自訂 Emoji</label>
            <input 
              type="text"
              placeholder="輸入 Emoji..."
              value={edited.icon && !(edited.icon.startsWith('http') || edited.icon.startsWith('data:image/') || edited.icon.startsWith('/')) ? edited.icon : ''}
              onChange={e => {
                const val = e.target.value;
                if (val === '') {
                  setEdited({ ...edited, icon: '' });
                } else {
                  // Simple logic to take the last character if it's an emoji-like input
                  setEdited({ ...edited, icon: val.slice(-2).trim() });
                }
              }}
              className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] transition-all"
              maxLength={2}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-[#5D4037]/40 uppercase tracking-widest px-1">專案圖示</label>
            <div className="grid grid-cols-5 gap-2">
              {/* Upload Custom Image Icon */}
              <div className="relative">
                <label className="w-12 h-12 rounded-2xl border-2 border-dashed bg-white border-stone-300 shadow-sm flex flex-col items-center justify-center cursor-pointer hover:bg-stone-50 transition-all active:scale-95">
                  <Upload size={16} className="text-stone-400" />
                  <span className="text-[8px] font-black text-stone-400 mt-0.5" style={getFontFamily()}>上傳</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleUploadIconImage} 
                    className="hidden" 
                  />
                </label>
              </div>

              {/* Render Custom Image Icon Preview if active */}
              {edited.icon && (edited.icon.startsWith('data:image/') || edited.icon.startsWith('http') || edited.icon.startsWith('/')) && (
                <div className="relative w-12 h-12 rounded-2xl border-2 border-[#FFD54F] bg-white shadow-md flex items-center justify-center overflow-hidden">
                  <img src={edited.icon} className="w-full h-full object-contain p-1 select-none pointer-events-none" alt="custom-icon" />
                  <button 
                    type="button"
                    onClick={() => setEdited({ ...edited, icon: '📝' })}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center text-[8px] font-black shadow-sm"
                  >
                    ✕
                  </button>
                </div>
              )}

              {['📝', '✈️', '📱', '👗', '🏠', '💼', '🍱', '🍔', '🎨', '🎬', '🚆', '🚲', '🍕', '🍰', '☕', '🎸', '🎮', '💡', '🧼', '💊'].map(icon => (
                <button 
                   key={icon}
                  onClick={() => setEdited({ ...edited, icon })}
                  className={`w-12 h-12 rounded-2xl text-xl flex items-center justify-center transition-all ${edited.icon === icon ? 'bg-[#FFD54F] shadow-md scale-110' : 'bg-white border-2 border-stone-50 hover:bg-stone-50'}`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <button 
            onClick={() => {
              const parentVal = edited.parentProjectId ?? edited.parentId ?? null;
              onSave({ 
                ...edited, 
                parentId: parentVal || undefined,
                parentProjectId: parentVal,
                isStandalone: parentVal === null ? true : false,
                icon: edited.icon ? edited.icon.trim() : '📝' 
              });
            }}
            className="w-full py-5 bg-[#5D4037] text-white rounded-[24px] font-black text-[20px] flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all mt-4 sticky bottom-0"
          >
            <Check size={28} /> 儲存設定
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

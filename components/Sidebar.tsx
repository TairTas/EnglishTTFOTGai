import React from 'react';
import { PenTool, Mic, Languages } from 'lucide-react';
import { AppMode } from '../types';

interface SidebarProps {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  disabled?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentMode, onModeChange, disabled }) => {
  return (
    <div className="w-16 bg-white border-r border-slate-200 flex flex-col items-center py-6 gap-4 shrink-0 z-20">
      <button
        onClick={() => onModeChange('writing')}
        disabled={disabled}
        className={`p-3 rounded-xl transition-all ${
          currentMode === 'writing'
            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
            : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
        }`}
        title="Writing Mode"
      >
        <PenTool size={24} />
      </button>
      <button
        onClick={() => onModeChange('speaking')}
        disabled={disabled}
        className={`p-3 rounded-xl transition-all ${
          currentMode === 'speaking'
            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
            : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
        }`}
        title="Speaking Mode"
      >
        <Mic size={24} />
      </button>
      <button
        onClick={() => onModeChange('translator')}
        disabled={disabled}
        className={`p-3 rounded-xl transition-all ${
          currentMode === 'translator'
            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
            : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
        }`}
        title="Translator Mode"
      >
        <Languages size={24} />
      </button>
    </div>
  );
};
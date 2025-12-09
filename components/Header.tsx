import React from 'react';
import { PenTool, GraduationCap } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <GraduationCap size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">ttfotg AI</h1>
            <p className="text-xs text-slate-500 font-medium">by Tasmukhambetov Tair</p>
          </div>
        </div>
        <div className="hidden md:flex items-center space-x-4 text-sm text-slate-600">
           <span className="flex items-center space-x-1">
            <PenTool size={16} />
            <span>Smart Correction</span>
           </span>
        </div>
      </div>
    </header>
  );
};
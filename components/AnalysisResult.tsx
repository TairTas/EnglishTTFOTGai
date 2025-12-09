import React from 'react';
import { EssayAnalysis, AppMode } from '../types';
import { CheckCircle, AlertCircle, AlertOctagon } from 'lucide-react';

interface AnalysisResultProps {
  analysis: EssayAnalysis;
  mode?: AppMode;
}

export const AnalysisResult: React.FC<AnalysisResultProps> = ({ analysis, mode = 'writing' }) => {
  return (
    <div className="h-full flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      
      {/* 1. Header Section (Fixed at top) */}
      <div className="shrink-0 bg-white border-b border-slate-200 p-5 flex flex-col gap-5 z-10">
        {/* Scores Row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6">
                {/* CEFR Badge */}
                <div className="flex items-center gap-3">
                    <div className={`
                        w-12 h-12 rounded-lg flex items-center justify-center text-xl font-bold text-white shadow-sm
                        ${analysis.cefrLevel.startsWith('C') ? 'bg-gradient-to-br from-purple-500 to-indigo-600' : 
                          analysis.cefrLevel.startsWith('B') ? 'bg-gradient-to-br from-blue-500 to-cyan-600' : 
                          'bg-gradient-to-br from-green-500 to-emerald-600'}
                    `} title="CEFR Level">
                        {analysis.cefrLevel}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Level</span>
                        <span className="text-sm font-semibold text-slate-700">CEFR</span>
                    </div>
                </div>

                <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>

                {/* IELTS Badge */}
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-xl border border-slate-200">
                        {analysis.ieltsScore}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">IELTS</span>
                        <span className="text-sm font-semibold text-slate-700">Band</span>
                    </div>
                </div>
            </div>

            {/* Assessment & Errors */}
            <div className="flex items-center gap-6">
                 {/* Errors Count */}
                 <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                        <AlertOctagon size={10} /> Errors
                    </span>
                    <div className="flex items-baseline gap-1">
                        <span className={`text-2xl font-bold ${analysis.corrections.length > 5 ? 'text-red-600' : 'text-orange-500'}`}>
                            {analysis.corrections.length}
                        </span>
                    </div>
                </div>

                <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>

                {/* Total Score */}
                <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Assessment</span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-slate-900">{analysis.estimatedScore}</span>
                        <span className="text-sm font-medium text-slate-400">/100</span>
                    </div>
                </div>
            </div>
        </div>

        {/* Feedback Summary */}
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <AlertCircle size={12} />
                Examiner's Feedback
            </h4>
            <p className="text-sm text-slate-700 leading-relaxed">
                {analysis.generalFeedback}
            </p>
        </div>
      </div>

      {/* 2. Scrollable Body: Clean Corrected Essay */}
      <div className="flex-1 overflow-y-auto relative bg-slate-50/30">
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-slate-100 px-5 py-2 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <CheckCircle size={14} className="text-green-600"/>
                {mode === 'writing' ? 'Corrected Essay' : 'Improved Transcript'}
            </span>
            <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                British English
            </span>
        </div>
        
        <div className="p-8 pb-16">
            <div className="bg-white p-8 rounded-lg shadow-sm border border-slate-100 min-h-[300px]">
                {/* We display the clean corrected version here */}
                <p className="whitespace-pre-wrap font-serif text-lg leading-relaxed text-slate-900">
                    {analysis.correctedEssay}
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};
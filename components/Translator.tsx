import React, { useState, useEffect, useCallback } from 'react';
import { ArrowRightLeft, Sparkles, X, ToggleLeft, ToggleRight } from 'lucide-react';
import { GeminiModel, TranslationResult } from '../types';
import { translateWithNuance } from '../services/geminiService';

interface TranslatorProps {
  model: GeminiModel;
}

export const Translator: React.FC<TranslatorProps> = ({ model }) => {
  const [inputText, setInputText] = useState('');
  const [direction, setDirection] = useState<'ru-en' | 'en-ru'>('ru-en');
  const [isTranslating, setIsTranslating] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [isAutoTranslate, setIsAutoTranslate] = useState(false);
  
  // Tooltip State
  const [tooltip, setTooltip] = useState<{
      text: string;
      definition: string;
      x: number;
      y: number;
  } | null>(null);

  const handleTranslate = useCallback(async () => {
    if (!inputText.trim()) return;
    setIsTranslating(true);
    // Don't clear result immediately for auto-translate to prevent flickering
    if (!isAutoTranslate) setResult(null);

    const from = direction === 'ru-en' ? 'ru' : 'en';
    const to = direction === 'ru-en' ? 'en' : 'ru';

    try {
        const data = await translateWithNuance(inputText, from, to, model);
        setResult(data);
    } catch (e) {
        if (!isAutoTranslate) alert("Translation failed. Please try again.");
    } finally {
        setIsTranslating(false);
    }
  }, [inputText, direction, model, isAutoTranslate]);

  // Auto-translate Logic
  useEffect(() => {
    if (!isAutoTranslate || !inputText.trim()) return;
    
    const timer = setTimeout(() => {
        handleTranslate();
    }, 1000); // Reduced to 1 second

    return () => clearTimeout(timer);
  }, [inputText, isAutoTranslate, handleTranslate]);

  const swapLanguages = () => {
      setDirection(prev => prev === 'ru-en' ? 'en-ru' : 'ru-en');
      setInputText('');
      setResult(null);
  };

  const handleMouseEnter = (e: React.MouseEvent, text: string, definition?: string) => {
      if (!definition) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setTooltip({
          text,
          definition,
          x: rect.left + rect.width / 2,
          y: rect.top
      });
  };

  const handleSwapWord = (segmentIdx: number, altIdx: number) => {
      if (!result) return;
      
      const newResult = { ...result };
      const newSegments = [...newResult.segments];
      const segment = { ...newSegments[segmentIdx] };
      
      if (segment.alternatives) {
          const newAlternatives = [...segment.alternatives];
          
          // Store old main
          const oldMainText = segment.text;
          const oldMainDef = segment.definition || '';

          // Get new main from alternatives
          const newMain = newAlternatives[altIdx];

          // Swap logic
          segment.text = newMain.text;
          segment.definition = newMain.definition;

          // Put old main into alternatives
          newAlternatives[altIdx] = {
              text: oldMainText,
              definition: oldMainDef
          };

          segment.alternatives = newAlternatives;
          newSegments[segmentIdx] = segment;
          newResult.segments = newSegments;
          setResult(newResult);
          
          // Close tooltip after swap to prevent stale content
          setTooltip(null);
      }
  };

  const sourceLang = direction === 'ru-en' ? 'Russian' : 'English';
  const targetLang = direction === 'ru-en' ? 'English' : 'Russian';

  return (
    <div className="h-full flex flex-col gap-6">
       {/* Controls */}
       <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
           <div className="flex items-center gap-4 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
               <div className="text-sm font-bold w-28 text-center py-2 rounded-lg bg-white text-blue-700 shadow-sm transition-all">
                   {sourceLang}
               </div>
               
               <button 
                onClick={swapLanguages}
                className="p-2 rounded-full hover:bg-slate-200 text-slate-400 hover:text-blue-600 transition-colors"
                title="Swap Languages"
               >
                   <ArrowRightLeft size={16} />
               </button>
               
               <div className="text-sm font-bold w-28 text-center py-2 rounded-lg bg-white text-blue-700 shadow-sm transition-all">
                   {targetLang}
               </div>
           </div>
           
           <div className="flex items-center gap-4">
               <button
                  onClick={() => setIsAutoTranslate(!isAutoTranslate)}
                  className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors border ${isAutoTranslate ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
               >
                  {isAutoTranslate ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                  Auto-translate
               </button>

               <button 
                    onClick={handleTranslate}
                    disabled={isTranslating || !inputText.trim()}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium shadow-md shadow-blue-600/20 transition-all active:scale-95 flex items-center gap-2"
               >
                   {isTranslating ? (
                       <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Translating...
                       </>
                   ) : (
                       <>
                        <Sparkles size={16} /> Translate
                       </>
                   )}
               </button>
           </div>
       </div>

       {/* Editor Area */}
       <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-6">
           
           {/* Input */}
           <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden focus-within:ring-2 focus-within:ring-blue-100 transition-shadow">
                <div className="p-3 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {sourceLang} Source
                    </span>
                    {inputText && (
                        <button onClick={() => setInputText('')} className="text-slate-400 hover:text-red-500">
                            <X size={14} />
                        </button>
                    )}
                </div>
                <textarea 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className="flex-1 w-full p-6 resize-none focus:outline-none text-lg text-slate-800 placeholder:text-slate-300 font-serif leading-relaxed bg-transparent"
                    placeholder={`Type in ${sourceLang}...`}
                />
           </div>

           {/* Output */}
           <div className="bg-slate-50 rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden relative">
                <div className="p-3 border-b border-slate-200/50 bg-slate-100/50">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {targetLang} Result
                    </span>
                </div>
                <div className="flex-1 p-6 overflow-y-auto">
                    {result ? (
                        <div className="font-serif text-lg leading-loose text-slate-800">
                            {result.segments.map((seg, segIdx) => (
                                <span 
                                    key={segIdx} 
                                    className="relative inline-block mr-1.5 align-baseline"
                                >
                                    {/* Main Text */}
                                    <span 
                                        className="group cursor-help hover:text-blue-700 transition-colors border-b border-transparent hover:border-blue-200"
                                        onMouseEnter={(e) => handleMouseEnter(e, seg.text, seg.definition)}
                                        onMouseLeave={() => setTooltip(null)}
                                    >
                                        {seg.text}
                                    </span>
                                    
                                    {/* Alternatives (Transparent Gray) - Only show if single segment */}
                                    {result.segments.length === 1 && seg.alternatives && seg.alternatives.length > 0 && (
                                        <span className="inline-flex gap-1 ml-1 text-sm select-none align-baseline">
                                            <span className="text-slate-300">(</span>
                                            {seg.alternatives.slice(0, 3).map((alt, altIdx) => (
                                                <span 
                                                    key={altIdx}
                                                    onClick={() => handleSwapWord(segIdx, altIdx)}
                                                    onMouseEnter={(e) => handleMouseEnter(e, alt.text, alt.definition)}
                                                    onMouseLeave={() => setTooltip(null)}
                                                    className="text-slate-400/60 hover:text-blue-500 hover:font-bold hover:underline cursor-pointer transition-all"
                                                >
                                                    {alt.text}{altIdx < (seg.alternatives!.length < 3 ? seg.alternatives!.length : 3) - 1 ? ',' : ''}
                                                </span>
                                            ))}
                                            <span className="text-slate-300">)</span>
                                        </span>
                                    )}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-300">
                            Translation will appear here
                        </div>
                    )}
                </div>
           </div>
       </div>

       {/* Tooltip */}
       {tooltip && (
            <div 
                className="fixed z-[9999] w-64 pointer-events-none"
                style={{ 
                    left: tooltip.x, 
                    top: tooltip.y - 12,
                    transform: `translateX(-50%) translateY(-100%)`
                }}
            >
                <div className="bg-slate-900/95 backdrop-blur-md text-white text-sm rounded-lg shadow-xl p-3 border border-slate-700 animate-in fade-in zoom-in-95 duration-200">
                    <p className="font-bold text-blue-200 mb-1 border-b border-slate-700/50 pb-1">{tooltip.text}</p>
                    <p className="text-slate-300 text-xs leading-relaxed">{tooltip.definition}</p>
                    
                    {/* Tooltip Arrow */}
                    <div className="absolute left-1/2 -translate-x-1/2 top-full border-8 border-transparent border-t-slate-900/95"></div>
                </div>
            </div>
       )}
    </div>
  );
};
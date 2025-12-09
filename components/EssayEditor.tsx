import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Upload, Image as ImageIcon, X, Edit3, AlertCircle, FileText } from 'lucide-react';
import { transcribeImage } from '../services/geminiService';
import { EssayAnalysis, Correction } from '../types';

interface EssayEditorProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  analysis?: EssayAnalysis | null;
}

export const EssayEditor: React.FC<EssayEditorProps> = ({ value, onChange, disabled, analysis }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textFileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(true);

  // Switch to view mode automatically when analysis arrives
  useEffect(() => {
    if (analysis) {
        setIsEditing(false);
    } else {
        setIsEditing(true);
    }
  }, [analysis]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = ''; // Reset input

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }

    setIsUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const base64Data = base64.split(',')[1];
      const mimeType = file.type;
      
      const transcribedText = await transcribeImage(base64Data, mimeType);
      onChange(transcribedText);
    } catch (error) {
      console.error(error);
      alert('Failed to transcribe image.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleTextFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    e.target.value = ''; // Reset input

    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) onChange(text);
    };
    reader.onerror = () => alert("Failed to read text file.");
    reader.readAsText(file);
  };

  // --- ANNOTATION LOGIC (Moved from AnalysisResult) ---
  const [tooltip, setTooltip] = useState<{
    correction: Correction;
    x: number;
    y: number;
    elemHeight: number;
  } | null>(null);

  const handleMouseEnter = (e: React.MouseEvent, correction: Correction) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({
      correction,
      x: rect.left + rect.width / 2,
      y: rect.top,
      elemHeight: rect.height
    });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  const renderedText = useMemo(() => {
    if (!analysis?.corrections || analysis.corrections.length === 0) {
      return <span className="font-serif text-lg leading-relaxed text-slate-900">{value}</span>;
    }

    const segments: React.ReactNode[] = [];
    let currentIndex = 0;
    const remainingCorrections = [...analysis.corrections];

    while (currentIndex < value.length) {
        let bestMatchIndex = -1;
        let bestMatchCorrection: Correction | null = null;
        let correctionIdxToRemove = -1;

        for (let i = 0; i < remainingCorrections.length; i++) {
            const corr = remainingCorrections[i];
            const idx = value.indexOf(corr.originalText, currentIndex);
            
            if (idx !== -1) {
                if (bestMatchIndex === -1 || idx < bestMatchIndex) {
                    bestMatchIndex = idx;
                    bestMatchCorrection = corr;
                    correctionIdxToRemove = i;
                }
            }
        }

        if (bestMatchIndex !== -1 && bestMatchCorrection) {
            if (bestMatchIndex > currentIndex) {
                segments.push(
                    <span key={`text-${currentIndex}`} className="font-serif text-lg leading-relaxed text-slate-900">
                        {value.substring(currentIndex, bestMatchIndex)}
                    </span>
                );
            }

            const isSuffixInsertion = bestMatchCorrection.suggestedText.startsWith(bestMatchCorrection.originalText);
            const isPrefixInsertion = bestMatchCorrection.suggestedText.endsWith(bestMatchCorrection.originalText);

            let content;
            const interactionProps = {
                onMouseEnter: (e: React.MouseEvent) => handleMouseEnter(e, bestMatchCorrection!),
                onMouseLeave: handleMouseLeave,
                className: "inline-block cursor-help relative group"
            };

            if (isSuffixInsertion && bestMatchCorrection.suggestedText !== bestMatchCorrection.originalText) {
                const insertion = bestMatchCorrection.suggestedText.slice(bestMatchCorrection.originalText.length);
                content = (
                    <span {...interactionProps}>
                        <span className="text-slate-900">{bestMatchCorrection.originalText}</span>
                        <span className="text-red-600 font-bold bg-red-100 rounded px-0.5 ml-0.5 border border-red-200 shadow-sm">{insertion}</span>
                    </span>
                );
            } else if (isPrefixInsertion && bestMatchCorrection.suggestedText !== bestMatchCorrection.originalText) {
                 const insertion = bestMatchCorrection.suggestedText.slice(0, -bestMatchCorrection.originalText.length);
                 content = (
                    <span {...interactionProps}>
                        <span className="text-red-600 font-bold bg-red-100 rounded px-0.5 mr-0.5 border border-red-200 shadow-sm">{insertion}</span>
                        <span className="text-slate-900">{bestMatchCorrection.originalText}</span>
                    </span>
                );
            } else {
                content = (
                    <span {...interactionProps}>
                        <span className="font-serif text-lg leading-relaxed text-red-600 bg-red-50 decoration-red-400 decoration-wavy underline underline-offset-4 rounded px-0.5 mx-0.5">
                            {bestMatchCorrection.originalText}
                        </span>
                    </span>
                );
            }

            segments.push(<span key={`err-${bestMatchIndex}`}>{content}</span>);
            currentIndex = bestMatchIndex + bestMatchCorrection.originalText.length;
            remainingCorrections.splice(correctionIdxToRemove, 1);
        } else {
            segments.push(
                <span key={`text-end`} className="font-serif text-lg leading-relaxed text-slate-900">
                    {value.substring(currentIndex)}
                </span>
            );
            break;
        }
    }
    return segments;
  }, [value, analysis]);

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50 shrink-0">
        <span className="text-sm font-semibold text-slate-600">Your Essay</span>
        
        <div className="flex items-center gap-2">
            {analysis && (
                <div className="flex bg-slate-200 rounded-lg p-0.5 mr-2">
                    <button 
                        onClick={() => setIsEditing(true)}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${isEditing ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <span className="flex items-center gap-1.5"><Edit3 size={12} /> Edit</span>
                    </button>
                    <button 
                        onClick={() => setIsEditing(false)}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${!isEditing ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <span className="flex items-center gap-1.5"><AlertCircle size={12} /> Errors</span>
                    </button>
                </div>
            )}

            {/* Import Buttons Group */}
            <div className="flex items-center space-x-2">
                <button
                    onClick={() => textFileInputRef.current?.click()}
                    disabled={disabled || isUploading}
                    className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors disabled:opacity-50"
                    title="Import Text File"
                >
                    <FileText size={14} />
                    <span className="hidden sm:inline">File</span>
                </button>

                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={disabled || isUploading}
                    className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors disabled:opacity-50"
                    title="Import Image"
                >
                    {isUploading ? (
                        <span className="animate-pulse">Scanning...</span>
                    ) : (
                        <>
                        <ImageIcon size={14} />
                        <span className="hidden sm:inline">Photo</span>
                        </>
                    )}
                </button>
            </div>
        </div>
        
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          capture="environment"
          onChange={handleImageUpload}
        />
        <input 
            type="file"
            ref={textFileInputRef}
            className="hidden"
            accept=".txt,.md"
            onChange={handleTextFileUpload}
        />
      </div>

      {isEditing ? (
          <textarea
            className="flex-1 w-full p-6 resize-none focus:outline-none focus:ring-0 font-serif text-lg leading-relaxed text-slate-900 placeholder:text-slate-300 bg-white"
            placeholder="Start typing your essay here, upload a photo, or import a text file..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            spellCheck={false}
          />
      ) : (
          <div className="flex-1 w-full p-6 overflow-y-auto bg-white">
              <p className="whitespace-pre-wrap">{renderedText}</p>
          </div>
      )}

      {value && !disabled && isEditing && (
        <button 
            onClick={() => onChange('')}
            className="absolute bottom-4 right-4 p-2 text-slate-400 hover:text-red-500 bg-white/80 backdrop-blur-sm rounded-full shadow-sm border border-slate-200 hover:border-red-200 transition-all z-10"
            title="Clear text"
        >
            <X size={16} />
        </button>
      )}

    {/* FIXED TOOLTIP OVERLAY (Moved here) */}
      {!isEditing && tooltip && (
        <div 
            className="fixed z-[9999] w-72 pointer-events-none transition-opacity duration-200"
            style={{ 
                left: tooltip.x, 
                top: tooltip.y > 250 ? tooltip.y : tooltip.y + tooltip.elemHeight,
                transform: `translateX(-50%) ${tooltip.y > 250 ? 'translateY(-100%) translateY(-12px)' : 'translateY(12px)'}`
            }}
        >
             <div className="bg-slate-900/95 backdrop-blur-md text-white text-sm rounded-lg shadow-2xl p-4 border border-slate-700 relative animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-start justify-between mb-2 pb-2 border-b border-slate-700/50">
                    <span className="font-bold text-green-400 break-words pr-2 font-mono text-base">{tooltip.correction.suggestedText}</span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded whitespace-nowrap border border-slate-600">
                        {tooltip.correction.type}
                    </span>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">{tooltip.correction.explanation}</p>
                <div 
                    className={`absolute left-1/2 -translate-x-1/2 border-8 border-transparent ${tooltip.y > 250 ? 'border-t-slate-900/95 top-full' : 'border-b-slate-900/95 bottom-full'}`}
                ></div>
            </div>
        </div>
      )}
    </div>
  );
};
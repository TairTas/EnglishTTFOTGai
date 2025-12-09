import React, { useState } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ModelSelector } from './components/ModelSelector';
import { EssayEditor } from './components/EssayEditor';
import { AnalysisResult } from './components/AnalysisResult';
import { SpeakingPractice } from './components/SpeakingPractice';
import { Translator } from './components/Translator';
import { GeminiModel, EssayAnalysis, AppMode } from './types';
import { analyzeEssay } from './services/geminiService';
import { Wand2, AlertTriangle } from 'lucide-react';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('writing');
  const [model, setModel] = useState<GeminiModel>(GeminiModel.FLASH);
  
  // Writing Mode State
  const [essayText, setEssayText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<EssayAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyzeEssay = async () => {
    if (!essayText.trim()) return;
    
    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);

    try {
      const result = await analyzeEssay(essayText, model);
      setAnalysis(result);
    } catch (err) {
      setError("Failed to analyze essay. Please check your text or try a different model.");
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getPageTitle = () => {
      switch(mode) {
          case 'writing': return 'Essay Checker';
          case 'speaking': return 'Speaking Practice';
          case 'translator': return 'Smart Translator';
      }
  };

  const getPageSubtitle = () => {
      switch(mode) {
          case 'writing': return 'Improve your writing with AI-powered analysis';
          case 'speaking': return 'Simulate an IELTS speaking test with AI';
          case 'translator': return 'Contextual translation with definitions and synonyms';
      }
  };

  return (
    <div className="h-screen bg-slate-50 text-slate-900 flex flex-col overflow-hidden">
      <Header />
      
      <div className="flex flex-1 min-h-0">
          <Sidebar currentMode={mode} onModeChange={setMode} disabled={isAnalyzing} />

          <main className="flex-1 min-w-0 p-4 sm:p-6 overflow-y-auto">
            <div className="max-w-7xl mx-auto h-full flex flex-col">
                
                {/* Global Controls Row */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 shrink-0">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-2xl font-bold text-slate-900">{getPageTitle()}</h2>
                        <p className="text-slate-500 text-sm">{getPageSubtitle()}</p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <ModelSelector selectedModel={model} onSelect={setModel} disabled={isAnalyzing} />
                        
                        {/* Writing Mode Specific Action Button */}
                        {mode === 'writing' && (
                            <button
                                onClick={handleAnalyzeEssay}
                                disabled={isAnalyzing || !essayText.trim()}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-5 py-2.5 rounded-lg font-medium shadow-md shadow-blue-600/20 transition-all active:scale-95"
                            >
                                {isAnalyzing ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Analyzing...</span>
                                    </>
                                ) : (
                                    <>
                                        <Wand2 size={18} />
                                        <span>Check Essay</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {mode === 'writing' && (
                     <>
                        {error && (
                            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2 shrink-0">
                                <AlertTriangle size={20} />
                                {error}
                            </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-[500px] resize-y overflow-hidden">
                            <div className="h-full min-h-0 flex flex-col">
                                <EssayEditor 
                                    value={essayText} 
                                    onChange={(val) => {
                                        setEssayText(val);
                                        if (analysis) setAnalysis(null);
                                    }}
                                    disabled={isAnalyzing}
                                    analysis={analysis}
                                />
                            </div>

                            <div className="h-full min-h-0 flex flex-col">
                                {analysis ? (
                                    <AnalysisResult analysis={analysis} mode="writing" />
                                ) : (
                                    <div className="h-full bg-white rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 p-8 text-center shadow-sm">
                                        <div className="bg-slate-50 p-4 rounded-full mb-4 shadow-sm border border-slate-100">
                                            <Wand2 size={32} className="text-slate-300" />
                                        </div>
                                        <h3 className="text-lg font-semibold text-slate-600 mb-1">Ready to Analyze</h3>
                                        <p className="max-w-xs text-sm text-slate-500 mb-6">
                                            Enter your essay on the left or upload a photo to get instant feedback.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {mode === 'speaking' && (
                    <div className="flex-1 min-h-[500px]">
                        <SpeakingPractice model={model} />
                    </div>
                )}
                
                {mode === 'translator' && (
                    <div className="flex-1 min-h-[500px]">
                        <Translator model={model} />
                    </div>
                )}

            </div>
          </main>
      </div>
    </div>
  );
};

export default App;
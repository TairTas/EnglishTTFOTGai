import React, { useState, useRef, useEffect } from 'react';
import { Mic, Send, Bot, User, StopCircle, RefreshCw, BarChart2, Play, Volume2, VolumeX, Activity, Radio } from 'lucide-react';
import { GeminiModel, ChatMessage, EssayAnalysis } from '../types';
import { analyzeSpeakingSession, createLiveSession } from '../services/geminiService';
import { AnalysisResult } from './AnalysisResult';
import { LiveServerMessage, LiveSession } from '@google/genai';

interface SpeakingPracticeProps {
  model: GeminiModel;
}

// Audio Utils
function floatTo16BitPCM(input: Float32Array) {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
}

function base64ToUint8Array(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

export const SpeakingPractice: React.FC<SpeakingPracticeProps> = ({ model }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysis, setAnalysis] = useState<EssayAnalysis | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);

  // Live API & Audio Refs
  const sessionRef = useRef<Promise<LiveSession> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Transcription state buffers
  const currentInputTransRef = useRef('');
  const currentOutputTransRef = useRef('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const userMessageCount = messages.filter(m => m.role === 'user').length;
  const MIN_PHRASES = 10;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
       disconnect();
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const initAudio = async () => {
      // 1. Output Audio Context (24kHz for Gemini Live)
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass({ sampleRate: 24000 });
      
      // Ensure context is running (browser autoplay policy)
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      
      audioContextRef.current = ctx;
      nextStartTimeRef.current = 0;
  };

  const connect = async () => {
    setIsProcessing(true);
    setMessages([]);
    setAnalysis(null);
    
    try {
        await initAudio();

        // 2. Input Stream (Microphone) - 16kHz preference
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        // 3. Setup Processing Node to capture audio chunks
        // We use a temporary context for input to ensure consistent processing
        const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        
        processor.onaudioprocess = (e) => {
             // Visualizer logic
             const inputData = e.inputBuffer.getChannelData(0);
             let sum = 0;
             for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
             setVolumeLevel(Math.sqrt(sum / inputData.length) * 5); // Scale up for visibility

             if (!sessionRef.current) return;

             // Convert Float32 to Int16 PCM
             const pcm16 = floatTo16BitPCM(inputData);
             const base64Data = arrayBufferToBase64(pcm16.buffer);
             
             // Send to Gemini
             sessionRef.current.then(session => {
                 session.sendRealtimeInput({
                     media: {
                         mimeType: 'audio/pcm;rate=16000',
                         data: base64Data
                     }
                 });
             });
        };

        source.connect(processor);
        processor.connect(inputCtx.destination); // Required for script processor to run
        
        inputSourceRef.current = source;
        processorRef.current = processor;

        // 4. Connect to Gemini Live API
        sessionRef.current = createLiveSession({
            onopen: () => {
                console.log("Gemini Live Connected");
                setIsConnected(true);
                setIsProcessing(false);
            },
            onmessage: async (message: LiveServerMessage) => {
                // A. Handle Audio Output
                const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                if (audioData && !isMuted && audioContextRef.current) {
                    const ctx = audioContextRef.current;
                    const audioBytes = base64ToUint8Array(audioData);
                    
                    // Decode Custom PCM (Raw 16-bit 24kHz)
                    // Since it's raw PCM, decodeAudioData won't work directly without headers.
                    // We must convert manually to AudioBuffer.
                    const pcm16 = new Int16Array(audioBytes.buffer);
                    const float32 = new Float32Array(pcm16.length);
                    for (let i = 0; i < pcm16.length; i++) {
                        float32[i] = pcm16[i] / 32768.0;
                    }
                    
                    const buffer = ctx.createBuffer(1, float32.length, 24000);
                    buffer.getChannelData(0).set(float32);

                    // Playback Scheduling
                    const source = ctx.createBufferSource();
                    source.buffer = buffer;
                    source.connect(ctx.destination);
                    
                    const currentTime = ctx.currentTime;
                    // Start at next available time or now
                    const startTime = Math.max(nextStartTimeRef.current, currentTime);
                    source.start(startTime);
                    
                    nextStartTimeRef.current = startTime + buffer.duration;
                    sourcesRef.current.add(source);
                    source.onended = () => sourcesRef.current.delete(source);
                }

                // B. Handle Transcriptions (Real-time update)
                const inputTrans = message.serverContent?.inputTranscription?.text;
                const outputTrans = message.serverContent?.outputTranscription?.text;
                const turnComplete = message.serverContent?.turnComplete;

                if (inputTrans) {
                    currentInputTransRef.current += inputTrans;
                }
                if (outputTrans) {
                    currentOutputTransRef.current += outputTrans;
                }

                if (turnComplete) {
                     // Commit transcripts to history
                     const newMessages: ChatMessage[] = [];
                     
                     if (currentInputTransRef.current.trim()) {
                         newMessages.push({ role: 'user', text: currentInputTransRef.current.trim() });
                         currentInputTransRef.current = '';
                     }
                     if (currentOutputTransRef.current.trim()) {
                         newMessages.push({ role: 'model', text: currentOutputTransRef.current.trim() });
                         currentOutputTransRef.current = '';
                     }

                     if (newMessages.length > 0) {
                         setMessages(prev => [...prev, ...newMessages]);
                     }
                }
            },
            onclose: () => {
                console.log("Gemini Live Disconnected");
                setIsConnected(false);
            },
            onerror: (e) => {
                console.error("Gemini Live Error", e);
                setIsConnected(false);
                setIsProcessing(false);
                const errorMsg = (e as any).message || "An unknown error occurred.";
                alert(`Connection Error: ${errorMsg}\n\nPlease refresh or try again.`);
            }
        });

    } catch (err) {
        console.error("Failed to start session", err);
        setIsProcessing(false);
        alert("Microphone access denied or error starting session.");
    }
  };

  const disconnect = () => {
    if (sessionRef.current) {
        sessionRef.current.then(s => s.close());
        sessionRef.current = null;
    }
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    }
    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
    }
    if (inputSourceRef.current) {
        inputSourceRef.current.disconnect();
        inputSourceRef.current = null;
    }
    if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
    }
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
    setIsConnected(false);
  };

  const handleFinish = async () => {
    disconnect();
    setIsProcessing(true);
    try {
        const result = await analyzeSpeakingSession(messages, model);
        setAnalysis(result);
    } catch (err) {
        alert("Failed to analyze session.");
    } finally {
        setIsProcessing(false);
    }
  };

  // --- Render ---

  if (analysis) {
      return (
          <div className="h-full flex flex-col gap-4">
              <div className="flex items-center justify-between shrink-0 mb-2">
                  <h2 className="text-xl font-bold text-slate-800">Speaking Analysis</h2>
                  <button 
                    onClick={() => { setAnalysis(null); setMessages([]); }}
                    className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm"
                  >
                      <RefreshCw size={16} /> Start New Session
                  </button>
              </div>
              <div className="flex-1 min-h-0">
                  <AnalysisResult analysis={analysis} mode="speaking" />
              </div>
          </div>
      );
  }

  // Initial Join Screen
  if (!isConnected && messages.length === 0 && !isProcessing) {
      return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
            
            <div className="relative mb-8">
                <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-100 border border-blue-100 relative z-10">
                    <Mic size={48} strokeWidth={1.5} />
                </div>
                <div className="absolute top-0 left-0 w-full h-full rounded-full bg-blue-100 animate-ping opacity-20"></div>
                <div className="absolute top-[-10px] left-[-10px] w-[calc(100%+20px)] h-[calc(100%+20px)] rounded-full border border-blue-50"></div>
            </div>

            <h2 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">IELTS Live Speaking</h2>
            <p className="text-slate-500 max-w-md mb-8 leading-relaxed text-lg">
                Connect to a real-time AI examiner. It's like a phone call - speak naturally, interrupt if you need to, and practice your fluency.
            </p>

            <div className="flex flex-col gap-4 w-full max-w-xs">
                <button
                    onClick={connect}
                    className="flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-xl shadow-blue-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                    <Radio size={24} className={isProcessing ? "animate-pulse" : ""} />
                    {isProcessing ? 'Connecting...' : 'Start Live Call'}
                </button>
                <div className="flex items-center justify-center gap-2 text-xs text-slate-400 font-medium bg-slate-50 py-2 rounded-lg border border-slate-100">
                    <Activity size={12} className="text-green-500" />
                    <span>Low Latency Voice Mode</span>
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 rounded-xl overflow-hidden shadow-sm border border-slate-200">
      
      {/* Live Header */}
      <div className="bg-white border-b border-slate-200 p-4 flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-red-50 text-red-600 px-3 py-1.5 rounded-full border border-red-100">
                <div className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                </div>
                <span className="text-sm font-bold tracking-wide uppercase">Live</span>
            </div>
            
            {/* Audio Visualizer */}
            <div className="flex items-center gap-1 h-6">
                 {[1,2,3,4,5].map(i => (
                     <div key={i} 
                          className="w-1 bg-slate-800 rounded-full transition-all duration-75"
                          style={{ 
                              height: `${Math.max(4, Math.min(24, volumeLevel * (i % 2 === 0 ? 10 : 15) + Math.random() * 5))}px`,
                              opacity: volumeLevel > 0.01 ? 1 : 0.2
                          }}
                     />
                 ))}
            </div>
        </div>
        
        <div className="flex items-center gap-3">
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${userMessageCount >= MIN_PHRASES ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                {userMessageCount} / {MIN_PHRASES} Phrases
            </span>

            <button 
                onClick={() => setIsMuted(!isMuted)}
                className={`p-2 rounded-full transition-colors border ${isMuted ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                title={isMuted ? "Unmute" : "Mute"}
            >
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>

            <button 
                onClick={handleFinish}
                disabled={userMessageCount < MIN_PHRASES || isProcessing}
                className="flex items-center gap-2 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed px-5 py-2 rounded-lg transition-colors shadow-lg shadow-slate-900/10"
            >
                {isProcessing ? 'Processing...' : (
                    <>
                        <StopCircle size={18} /> Finish & Analyze
                    </>
                )}
            </button>
        </div>
      </div>

      {/* Real-time Transcript Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
        {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-slate-400 opacity-60">
                 <div className="w-16 h-16 rounded-full border-4 border-slate-200 flex items-center justify-center mb-4">
                    <Activity size={32} />
                 </div>
                 <p className="text-sm font-medium">Listening for audio...</p>
                 <p className="text-xs">Start speaking to begin the conversation</p>
            </div>
        ) : (
            messages.map((msg, idx) => (
                <div key={idx} className={`flex w-full animate-in slide-in-from-bottom-2 fade-in duration-300 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex max-w-[85%] sm:max-w-[75%] gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm border ${msg.role === 'user' ? 'bg-blue-100 text-blue-600 border-blue-200' : 'bg-white text-slate-600 border-slate-200'}`}>
                            {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                        </div>
                        <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                            msg.role === 'user' 
                            ? 'bg-blue-600 text-white rounded-tr-none shadow-blue-600/10' 
                            : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                        }`}>
                            {msg.text}
                        </div>
                    </div>
                </div>
            ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer Status */}
      <div className="bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between text-xs text-slate-400 shrink-0">
         <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Using high-fidelity native audio streaming
         </div>
         <div>
            {model === GeminiModel.FLASH ? 'Gemini 2.5 Flash' : 'Gemini Live Preview'}
         </div>
      </div>
    </div>
  );
};
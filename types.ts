export interface Correction {
  originalText: string;
  suggestedText: string;
  explanation: string;
  type: 'grammar' | 'spelling' | 'vocabulary' | 'clarity' | 'semantic';
}

export interface EssayAnalysis {
  cefrLevel: string;
  ieltsScore: string;
  estimatedScore: number; // 0-100
  generalFeedback: string;
  correctedEssay: string; // New field for the full corrected version
  corrections: Correction[];
}

export enum GeminiModel {
  FLASH_LITE = 'gemini-flash-lite-latest',
  FLASH = 'gemini-2.5-flash',
  PRO_3_0 = 'gemini-3-pro-preview',
}

export const MODEL_LABELS: Record<GeminiModel, string> = {
  [GeminiModel.FLASH_LITE]: 'Gemini 2.5 Flash Lite',
  [GeminiModel.FLASH]: 'Gemini 2.5 Flash',
  [GeminiModel.PRO_3_0]: 'Gemini 3.0 Pro Preview',
};

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface TranslationAlternative {
  text: string;
  definition: string;
}

export interface TranslationSegment {
  text: string;           // The main translated word/phrase
  definition?: string;    // English definition
  alternatives?: TranslationAlternative[]; // Synonyms/Other meanings with definitions
}

export interface TranslationResult {
  segments: TranslationSegment[];
  detectedLanguage?: string;
}

export type AppMode = 'writing' | 'speaking' | 'translator';
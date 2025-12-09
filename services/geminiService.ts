import { GoogleGenAI, Type, Schema, LiveServerMessage, Modality } from "@google/genai";
import { EssayAnalysis, GeminiModel, ChatMessage, TranslationResult } from "../types";

// Helper to robustly get the API Key in different environments
const getApiKey = () => {
  // 1. Priority: Check Vite/Vercel environment (Standard for this project)
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
    // @ts-ignore
    return import.meta.env.VITE_API_KEY;
  }
  
  // 2. Fallback: Check process.env (Node/Webpack/Legacy)
  try {
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      return process.env.API_KEY;
    }
  } catch (e) {
    // Ignore reference errors if process is not defined
  }

  return '';
};

const apiKey = getApiKey();
const ai = new GoogleGenAI({ apiKey });

// Shared schema properties
const correctionsSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      originalText: {
        type: Type.STRING,
        description: "The exact substring from the original text that contains the error.",
      },
      suggestedText: {
        type: Type.STRING,
        description: "The corrected version of the text.",
      },
      explanation: {
        type: Type.STRING,
        description: "A concise explanation of why the original was incorrect and why the suggestion is better.",
      },
      type: {
        type: Type.STRING,
        enum: ['grammar', 'spelling', 'vocabulary', 'clarity', 'semantic'],
        description: "The category of the error.",
      },
    },
    required: ["originalText", "suggestedText", "explanation", "type"],
  },
};

const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    cefrLevel: {
      type: Type.STRING,
      description: "The CEFR level (e.g., A1, A2, B1, B2, C1, C2).",
    },
    ieltsScore: {
      type: Type.STRING,
      description: "The estimated IELTS band score (e.g., '5.5', '6.0', '7.0', '8.5').",
    },
    estimatedScore: {
      type: Type.INTEGER,
      description: "An estimated score from 0 to 100 based on academic standards.",
    },
    generalFeedback: {
      type: Type.STRING,
      description: "A comprehensive summary of strengths and weaknesses.",
    },
    correctedEssay: {
      type: Type.STRING,
      description: "The full, rewritten version of the text/transcript with all corrections applied.",
    },
    corrections: correctionsSchema,
  },
  required: ["cefrLevel", "ieltsScore", "estimatedScore", "generalFeedback", "correctedEssay", "corrections"],
};

export const analyzeEssay = async (text: string, model: GeminiModel): Promise<EssayAnalysis> => {
  if (!text || text.trim().length < 10) {
    throw new Error("Text is too short to analyze.");
  }

  try {
    const isPro = model.includes('pro');
    
    const response = await ai.models.generateContent({
      model: model,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `You are a strict British English language examiner. Analyze the following essay. 
              
              STRICT GUIDELINES:
              1. Standard: Use BRITISH English (e.g., 'colour', 'centre', 'travelling').
              2. Assessment Criteria:
                 - Be STRICT and CRITICAL. Act like an IELTS examiner.
                 - Do NOT inflate the CEFR level or IELTS score. Most casual learners are A2-B1.
                 - Check for VERB TENSE consistency.
                 - Check for PREPOSITIONS and ARTICLES rigoriously.
                 - Check for VOCABULARY range.
                 - **MANDATORY SCORING MAPPING**:
                   - C2 -> IELTS 8.5 - 9.0
                   - C1 -> IELTS 7.0 - 8.0
                   - B2 -> IELTS 5.5 - 6.5
                   - B1 -> IELTS 4.0 - 5.0
                   - A2 -> IELTS 3.0 - 3.5
                   - A1 -> IELTS 2.0 - 2.5
                   - A0 -> IELTS 1.0
              3. Output: 
                 - Identify errors in grammar, spelling, semantics, and clarity.
                 - Determine the CEFR level and IELTS Band Score.
                 - Provide specific corrections.
                 - Provide a 'correctedEssay' field which is the fully corrected text.
                 - IMPORTANT: 'originalText' must match the source text character-for-character.

              Essay:
              "${text}"`
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        systemInstruction: "You are a strict British English examiner.",
        thinkingConfig: isPro ? { thinkingBudget: 4096 } : undefined
      }
    });

    let jsonText = response.text;
    if (!jsonText) throw new Error("No response from AI");
    jsonText = jsonText.replace(/```json\n?|```/g, '').trim();
    
    return JSON.parse(jsonText) as EssayAnalysis;
  } catch (error) {
    console.error("Error analyzing essay:", error);
    throw error;
  }
};

export const transcribeImage = async (base64Image: string, mimeType: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: GeminiModel.FLASH, 
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: base64Image,
                mimeType: mimeType
              }
            },
            {
              text: "Transcribe the text in this image. Format it properly into natural paragraphs. Fix any OCR spacing errors (like words broken across lines). Do not add any conversational filler, just return the transcribed text."
            }
          ]
        }
      ]
    });

    return response.text || "";
  } catch (error) {
    console.error("Error transcribing image:", error);
    throw error;
  }
};

// --- Speaking Mode Services ---

export const getExaminerResponse = async (history: ChatMessage[], model: GeminiModel): Promise<string> => {
  try {
     const contents = history.map(msg => ({
         role: msg.role,
         parts: [{ text: msg.text }]
     }));

     const response = await ai.models.generateContent({
         model: model,
         contents: contents,
         config: {
            systemInstruction: "You are a professional IELTS Speaking examiner. Conduct a speaking test with the user. guidelines:\n1. Ask only ONE question at a time.\n2. Keep your responses concise (1-2 sentences max) to let the user speak more.\n3. Do NOT correct the user's grammar during the chat. Just maintain a natural flow.\n4. Start with a simple question about their home, work, or studies.\n5. Ask follow-up questions based on their answers.\n6. Be polite but formal."
         }
     });

     return response.text || "";
  } catch (error) {
    console.error("Chat error:", error);
    throw error;
  }
};

export const createLiveSession = (callbacks: {
    onopen?: () => void;
    onmessage?: (message: LiveServerMessage) => void;
    onclose?: (event: CloseEvent) => void;
    onerror?: (event: ErrorEvent) => void;
}) => {
    return ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks,
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
            },
            systemInstruction: "You are a professional IELTS Speaking examiner. Conduct a speaking test with the user. Guidelines:\n1. Ask only ONE question at a time.\n2. Keep your responses concise (1-2 sentences max) to let the user speak more.\n3. Do NOT correct the user's grammar during the chat. Just maintain a natural flow.\n4. Start with a simple question about their home, work, or studies.\n5. Ask follow-up questions based on their answers.\n6. Be polite but formal.",
            inputAudioTranscription: {}, 
            outputAudioTranscription: {}, 
        },
    });
};

export const analyzeSpeakingSession = async (history: ChatMessage[], model: GeminiModel): Promise<EssayAnalysis> => {
  try {
    const transcript = history.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
    const isPro = model.includes('pro');

    const response = await ai.models.generateContent({
      model: model,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Analyze the following IELTS Speaking test transcript. The user is labeled 'USER'.
              
              Transcript:
              ${transcript}
              
              STRICT GUIDELINES:
              1. Focus ONLY on the USER's errors. Ignore the model's text.
              2. Assessment Criteria:
                 - Check for grammar (tense, agreement), vocabulary range, and clarity.
                 - Estimate CEFR level and IELTS Band Score based on the user's performance.
                 - **MANDATORY SCORING MAPPING**:
                   - C2 -> IELTS 8.5 - 9.0
                   - C1 -> IELTS 7.0 - 8.0
                   - B2 -> IELTS 5.5 - 6.5
                   - B1 -> IELTS 4.0 - 5.0
                   - A2 -> IELTS 3.0 - 3.5
                   - A1 -> IELTS 2.0 - 2.5
              3. Output:
                 - 'generalFeedback': Summary of speaking performance.
                 - 'correctedEssay': Rewrite the USER's dialogue turns to be more natural, grammatically correct, and advanced (C1/C2 level). Present it as a corrected transcript or just the improved user responses.
                 - 'corrections': Specific errors in the user's speech.
                 - 'originalText' must match the user's text exactly.
              `
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        thinkingConfig: isPro ? { thinkingBudget: 4096 } : undefined
      }
    });

    let jsonText = response.text;
    if (!jsonText) throw new Error("No response from AI");
    jsonText = jsonText.replace(/```json\n?|```/g, '').trim();

    return JSON.parse(jsonText) as EssayAnalysis;
  } catch (error) {
    console.error("Error analyzing speaking session:", error);
    throw error;
  }
};

// --- Translation Services ---

export const translateWithNuance = async (text: string, from: 'ru'|'en', to: 'ru'|'en', model: GeminiModel): Promise<TranslationResult> => {
  try {
     const targetLanguageName = to === 'ru' ? 'Russian' : 'English';
     const sourceLanguageName = from === 'ru' ? 'Russian' : 'English';

     const response = await ai.models.generateContent({
        model: model,
        contents: [
            {
                role: 'user',
                parts: [{
                    text: `You are a professional translator. 
                    Task: Translate the text from ${sourceLanguageName} to ${targetLanguageName}.
                    
                    Input Text: "${text}"

                    Strict Guidelines:
                    1. The output JSON must contain a 'segments' array.
                    2. If the input is a full sentence, break it into logical phrases for the segments.
                    3. For each segment:
                       - 'text': The strict translation in ${targetLanguageName}. DO NOT return the original text here.
                       - 'definition': A short definition of the meaning in English.
                       - 'alternatives': Synonyms or other meanings in ${targetLanguageName}.
                    4. Ensure the grammar of the translated sentence is correct in ${targetLanguageName}.
                    `
                }]
            }
        ],
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    segments: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                text: { type: Type.STRING },
                                definition: { type: Type.STRING },
                                alternatives: { 
                                    type: Type.ARRAY, 
                                    items: { 
                                        type: Type.OBJECT,
                                        properties: {
                                            text: { type: Type.STRING },
                                            definition: { type: Type.STRING }
                                        }
                                    } 
                                },
                            },
                            required: ["text"]
                        }
                    }
                }
            }
        }
     });

     let jsonText = response.text;
     if (!jsonText) return { segments: [] };
     jsonText = jsonText.replace(/```json\n?|```/g, '').trim();
     return JSON.parse(jsonText) as TranslationResult;

  } catch (error) {
      console.error("Translation error", error);
      throw error;
  }
}
import React from 'react';
import { GeminiModel, MODEL_LABELS } from '../types';
import { Sparkles } from 'lucide-react';

interface ModelSelectorProps {
  selectedModel: GeminiModel;
  onSelect: (model: GeminiModel) => void;
  disabled?: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ selectedModel, onSelect, disabled }) => {
  return (
    <div className="flex items-center space-x-2 bg-white p-1 rounded-md border border-slate-200 shadow-sm">
      <div className="pl-2 text-slate-400">
        <Sparkles size={16} />
      </div>
      <select
        value={selectedModel}
        onChange={(e) => onSelect(e.target.value as GeminiModel)}
        disabled={disabled}
        className="text-sm font-medium text-slate-700 bg-transparent border-none focus:ring-0 cursor-pointer py-1 pr-8"
      >
        {Object.entries(MODEL_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
};

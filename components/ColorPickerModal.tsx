
import React, { useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { X, Check } from 'lucide-react';

interface ColorPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (color: string) => void;
}

export const ColorPickerModal: React.FC<ColorPickerModalProps> = ({ isOpen, onClose, onSelect }) => {
  const [color, setColor] = useState("#007acc");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div 
        className="bg-vscode-sidebar w-full max-w-sm p-4 rounded-xl border border-vscode-border shadow-2xl flex flex-col items-center gap-4 animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-full flex justify-between items-center mb-2">
            <span className="font-bold text-white text-sm uppercase tracking-wider">Select Color</span>
            <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded hover:bg-vscode-hover transition-colors">
                <X size={16}/>
            </button>
        </div>
        
        {/* Color Wheel */}
        <div className="w-full flex justify-center py-2">
            <HexColorPicker color={color} onChange={setColor} />
        </div>
        
        {/* Preview and Input */}
        <div className="flex items-center gap-3 w-full bg-vscode-activity/50 p-2 rounded-lg border border-vscode-border">
            <div 
                className="w-10 h-10 rounded border border-gray-600 shadow-inner"
                style={{ backgroundColor: color }} 
            />
            <div className="flex-1 flex flex-col">
                <label className="text-[10px] text-gray-400 uppercase font-bold">Hex Code</label>
                <input 
                    className="bg-transparent text-white text-lg outline-none font-mono uppercase tracking-widest w-full"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                />
            </div>
        </div>

        <button 
            onClick={() => { onSelect(color); onClose(); }}
            className="w-full bg-vscode-accent text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
        >
            <Check size={18} /> Insert Color
        </button>
      </div>
    </div>
  );
};


import React, { useState } from 'react';
import { Undo, Redo, ArrowRightFromLine, AlignLeft, Palette } from 'lucide-react';
import { ColorPickerModal } from './ColorPickerModal';

interface MobileToolbarProps {
  onInsert: (text: string) => void;
  onTab: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onFormat: () => void;
}

const SYMBOLS = ['<', '>', '/', '{', '}', '(', ')', '[', ']', '=', '"', "'", '`', ';', ':', '!', '-', '_', '$', '*', '.', ','];

export const MobileToolbar: React.FC<MobileToolbarProps> = ({ onInsert, onTab, onUndo, onRedo, onFormat }) => {
  const [showColorPicker, setShowColorPicker] = useState(false);

  return (
    <>
        <div className="w-full h-12 bg-vscode-activity border-t border-vscode-border flex items-center overflow-x-auto no-scrollbar touch-pan-x z-40 select-none shadow-lg">
        <div className="flex px-2 gap-2 h-full items-center">
            
            {/* Format Action */}
            <button 
            onMouseDown={(e) => { e.preventDefault(); onFormat(); }} 
            className="h-8 px-3 bg-vscode-input rounded text-vscode-fg flex items-center justify-center hover:bg-vscode-accent active:bg-vscode-accent transition-colors"
            title="Format Document"
            >
                <AlignLeft size={16} />
            </button>

            {/* Color Picker Button */}
            <button 
            onClick={() => setShowColorPicker(true)}
            className="h-8 px-3 bg-vscode-input rounded text-vscode-fg flex items-center justify-center hover:bg-vscode-accent active:bg-vscode-accent transition-colors"
            title="Insert Color"
            >
                <Palette size={16} />
            </button>

            {/* Actions */}
            <button onMouseDown={(e) => { e.preventDefault(); onTab(); }} className="h-8 px-3 bg-vscode-input rounded text-vscode-fg flex items-center justify-center hover:bg-vscode-accent active:bg-vscode-accent transition-colors">
                <ArrowRightFromLine size={16} />
            </button>
            <button onMouseDown={(e) => { e.preventDefault(); onUndo(); }} className="h-8 px-3 bg-vscode-input rounded text-vscode-fg flex items-center justify-center hover:bg-vscode-accent active:bg-vscode-accent transition-colors">
                <Undo size={16} />
            </button>
            <button onMouseDown={(e) => { e.preventDefault(); onRedo(); }} className="h-8 px-3 bg-vscode-input rounded text-vscode-fg flex items-center justify-center hover:bg-vscode-accent active:bg-vscode-accent transition-colors">
                <Redo size={16} />
            </button>
            
            <div className="w-px h-6 bg-vscode-border mx-1" />

            {/* Symbols */}
            {SYMBOLS.map((char) => (
            <button
                key={char}
                onMouseDown={(e) => { e.preventDefault(); onInsert(char); }}
                className="h-8 min-w-[32px] px-2 bg-vscode-input rounded text-vscode-fg font-mono text-lg flex items-center justify-center hover:bg-vscode-accent active:bg-vscode-accent active:scale-95 transition-all"
            >
                {char}
            </button>
            ))}
        </div>
        </div>

        {/* Color Picker Modal */}
        <ColorPickerModal 
            isOpen={showColorPicker} 
            onClose={() => setShowColorPicker(false)} 
            onSelect={(color) => onInsert(color)} 
        />
    </>
  );
};

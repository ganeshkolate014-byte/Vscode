
import React, { useState } from 'react';
import { 
  Undo, 
  Redo, 
  ArrowRightFromLine, 
  AlignLeft, 
  Palette, 
  Search, 
  Copy, 
  Check, 
  MousePointerSquare,
  Eraser
} from 'lucide-react';
import { ColorPickerModal } from './ColorPickerModal';

interface MobileToolbarProps {
  onInsert: (text: string) => void;
  onTab: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onFormat: () => void;
  onSearch: () => void;
  onSelectAll: () => void;
  onCopyAll: () => void;
  onClear: () => void;
}

const SYMBOLS = ['<', '>', '/', '{', '}', '(', ')', '[', ']', '=', '"', "'", '`', ';', ':', '!', '-', '_', '$', '*', '.', ','];

export const MobileToolbar: React.FC<MobileToolbarProps> = ({ 
  onInsert, onTab, onUndo, onRedo, onFormat, onSearch, onSelectAll, onCopyAll, onClear
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    onCopyAll();
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleClear = () => {
    if (confirm("Are you sure you want to clear the entire file?")) {
        onClear();
    }
  };

  return (
    <>
        <div className="w-full h-12 bg-vscode-activity border-t border-vscode-border flex items-center overflow-x-auto no-scrollbar touch-pan-x z-40 select-none shadow-lg">
        <div className="flex px-2 gap-2 h-full items-center">
            
            {/* Search */}
            <button 
              onMouseDown={(e) => { e.preventDefault(); onSearch(); }} 
              className="h-8 min-w-[32px] px-2 bg-vscode-input rounded text-vscode-fg flex items-center justify-center hover:bg-vscode-accent active:bg-vscode-accent transition-colors"
              title="Find"
            >
                <Search size={16} />
            </button>

            {/* Select All */}
            <button 
              onMouseDown={(e) => { e.preventDefault(); onSelectAll(); }} 
              className="h-8 min-w-[32px] px-2 bg-vscode-input rounded text-vscode-fg flex items-center justify-center hover:bg-vscode-accent active:bg-vscode-accent transition-colors"
              title="Select All"
            >
                <MousePointerSquare size={16} />
            </button>

            {/* Copy All */}
            <button 
              onMouseDown={(e) => { e.preventDefault(); handleCopy(); }} 
              className="h-8 min-w-[32px] px-2 bg-vscode-input rounded text-vscode-fg flex items-center justify-center hover:bg-vscode-accent active:bg-vscode-accent transition-colors"
              title="Copy All"
            >
                {isCopied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
            </button>

             {/* Clear All */}
             <button 
              onMouseDown={(e) => { e.preventDefault(); handleClear(); }} 
              className="h-8 min-w-[32px] px-2 bg-vscode-input rounded text-vscode-fg flex items-center justify-center hover:bg-red-500 active:bg-red-600 transition-colors"
              title="Clear File"
            >
                <Eraser size={16} />
            </button>

            {/* Format */}
            <button 
              onMouseDown={(e) => { e.preventDefault(); onFormat(); }} 
              className="h-8 min-w-[32px] px-2 bg-vscode-input rounded text-vscode-fg flex items-center justify-center hover:bg-vscode-accent active:bg-vscode-accent transition-colors"
              title="Format Document"
            >
                <AlignLeft size={16} />
            </button>

            {/* Color Picker */}
            <button 
              onClick={() => setShowColorPicker(true)}
              className="h-8 min-w-[32px] px-2 bg-vscode-input rounded text-vscode-fg flex items-center justify-center hover:bg-vscode-accent active:bg-vscode-accent transition-colors"
              title="Insert Color"
            >
                <Palette size={16} />
            </button>

            <div className="w-px h-6 bg-vscode-border mx-1" />

            {/* Actions */}
            <button onMouseDown={(e) => { e.preventDefault(); onTab(); }} className="h-8 min-w-[32px] px-2 bg-vscode-input rounded text-vscode-fg flex items-center justify-center hover:bg-vscode-accent active:bg-vscode-accent transition-colors">
                <ArrowRightFromLine size={16} />
            </button>
            <button onMouseDown={(e) => { e.preventDefault(); onUndo(); }} className="h-8 min-w-[32px] px-2 bg-vscode-input rounded text-vscode-fg flex items-center justify-center hover:bg-vscode-accent active:bg-vscode-accent transition-colors">
                <Undo size={16} />
            </button>
            <button onMouseDown={(e) => { e.preventDefault(); onRedo(); }} className="h-8 min-w-[32px] px-2 bg-vscode-input rounded text-vscode-fg flex items-center justify-center hover:bg-vscode-accent active:bg-vscode-accent transition-colors">
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

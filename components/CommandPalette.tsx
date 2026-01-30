
import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronRight } from 'lucide-react';
import { Command } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, commands }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredCommands = commands.filter(cmd => 
      cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (!isOpen) return;

          if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
          } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
          } else if (e.key === 'Enter') {
              e.preventDefault();
              if (filteredCommands[selectedIndex]) {
                  filteredCommands[selectedIndex].action();
                  onClose();
              }
          } else if (e.key === 'Escape') {
              onClose();
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[1px] flex justify-center pt-[10vh] px-2" onClick={onClose}>
        <div 
          className="w-full max-w-xl bg-vscode-widget border border-vscode-border rounded-lg shadow-2xl flex flex-col overflow-hidden max-h-[60vh] animate-in fade-in zoom-in-95 duration-100"
          onClick={e => e.stopPropagation()}
        >
            <div className="p-2 border-b border-vscode-border flex items-center gap-2">
                <ChevronRight size={16} className="text-vscode-accent" />
                <input 
                    ref={inputRef}
                    className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 text-sm"
                    placeholder="Type a command..."
                    value={query}
                    onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
                />
            </div>
            <div className="overflow-y-auto py-1">
                {filteredCommands.length === 0 ? (
                    <div className="p-3 text-xs text-gray-500 text-center">No commands found</div>
                ) : (
                    filteredCommands.map((cmd, idx) => (
                        <div 
                            key={cmd.id}
                            className={`px-3 py-2 flex justify-between items-center cursor-pointer text-sm ${idx === selectedIndex ? 'bg-vscode-accent text-white' : 'hover:bg-vscode-hover text-gray-300'}`}
                            onClick={() => { cmd.action(); onClose(); }}
                        >
                            <span>{cmd.label}</span>
                            {cmd.shortcut && (
                                <span className={`text-[10px] ${idx === selectedIndex ? 'text-white/80' : 'text-gray-500'}`}>{cmd.shortcut}</span>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    </div>
  );
};

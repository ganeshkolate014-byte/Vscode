
import React from 'react';
import { X, Check } from 'lucide-react';
import { EditorSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: EditorSettings;
  onUpdate: (newSettings: EditorSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onUpdate }) => {
  if (!isOpen) return null;

  const toggle = (key: keyof EditorSettings) => {
    const value = settings[key];
    if (typeof value === 'boolean') {
      onUpdate({ ...settings, [key]: !value });
    }
  };

  const setNumber = (key: keyof EditorSettings, val: number) => {
    onUpdate({ ...settings, [key]: val });
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-vscode-sidebar w-full max-w-md border border-vscode-border shadow-2xl rounded-lg overflow-hidden flex flex-col max-h-[80vh] animate-scale-in">
        <div className="flex justify-between items-center p-3 border-b border-vscode-border bg-vscode-activity/50">
          <span className="font-bold text-sm text-white">Settings</span>
          <button onClick={onClose} className="hover:text-white transition-colors"><X size={16} /></button>
        </div>
        
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          
          {/* Font Size */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-gray-400 uppercase">Editor Font Size</label>
            <div className="flex items-center gap-4">
               <input 
                 type="range" 
                 min="10" 
                 max="24" 
                 value={settings.fontSize} 
                 onChange={(e) => setNumber('fontSize', parseInt(e.target.value))}
                 className="flex-1 accent-vscode-accent h-1 bg-vscode-input rounded-lg appearance-none cursor-pointer"
               />
               <span className="text-sm font-mono bg-vscode-input px-2 py-1 rounded w-12 text-center">{settings.fontSize}px</span>
            </div>
          </div>

          <div className="h-px bg-vscode-border/50 my-2" />

          {/* Toggles */}
          <div className="space-y-2">
             <SettingToggle 
               label="Word Wrap" 
               desc="Wrap long lines to the next line" 
               checked={settings.wordWrap} 
               onChange={() => toggle('wordWrap')} 
             />
             <SettingToggle 
               label="Line Numbers" 
               desc="Show line numbers in the gutter" 
               checked={settings.lineNumbers} 
               onChange={() => toggle('lineNumbers')} 
             />
             <SettingToggle 
               label="Auto Save" 
               desc="Automatically save changes to local storage" 
               checked={settings.autoSave} 
               onChange={() => toggle('autoSave')} 
             />
          </div>
        </div>
        
        <div className="p-3 border-t border-vscode-border bg-vscode-input/30 flex justify-end">
            <button 
              onClick={onClose}
              className="px-4 py-1.5 bg-vscode-accent text-white rounded text-xs font-bold hover:opacity-90 active:scale-95 transition-all"
            >
              Done
            </button>
        </div>
      </div>
    </div>
  );
};

const SettingToggle = ({ label, desc, checked, onChange }: { label: string, desc: string, checked: boolean, onChange: () => void }) => (
  <div 
    className="flex items-start justify-between p-2 hover:bg-vscode-hover rounded cursor-pointer group transition-colors"
    onClick={onChange}
  >
     <div className="flex flex-col">
       <span className="text-sm text-gray-200">{label}</span>
       <span className="text-[10px] text-gray-500">{desc}</span>
     </div>
     <div className={`w-10 h-5 rounded-full relative transition-colors duration-200 ${checked ? 'bg-vscode-accent' : 'bg-gray-600'}`}>
        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-200 shadow-sm ${checked ? 'left-6' : 'left-1'}`} />
     </div>
  </div>
);

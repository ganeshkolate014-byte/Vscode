import React, { useState } from 'react';
import { X, ChevronRight, Code2, Hash, FileCode, Type } from 'lucide-react';
import { EditorSettings, Suggestion } from '../types';
import { SnippetsManager } from './SnippetsManager';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: EditorSettings;
  onUpdate: (newSettings: EditorSettings) => void;
  
  // Customization Props
  htmlTags: Suggestion[];
  setHtmlTags: (items: Suggestion[]) => void;
  resetHtmlTags: () => void;

  htmlAttributes: Suggestion[];
  setHtmlAttributes: (items: Suggestion[]) => void;
  resetHtmlAttributes: () => void;

  cssProps: Suggestion[];
  setCssProps: (items: Suggestion[]) => void;
  resetCssProps: () => void;

  jsKeywords: Suggestion[];
  setJsKeywords: (items: Suggestion[]) => void;
  resetJsKeywords: () => void;
}

type View = 'main' | 'html_tags' | 'html_attrs' | 'css_props' | 'js_keywords';

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
    isOpen, onClose, settings, onUpdate,
    htmlTags, setHtmlTags, resetHtmlTags,
    htmlAttributes, setHtmlAttributes, resetHtmlAttributes,
    cssProps, setCssProps, resetCssProps,
    jsKeywords, setJsKeywords, resetJsKeywords
}) => {
  const [view, setView] = useState<View>('main');

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

  const renderContent = () => {
      switch(view) {
          case 'html_tags':
              return <SnippetsManager title="HTML Tags & Snippets" items={htmlTags} onSave={setHtmlTags} onBack={() => setView('main')} onReset={resetHtmlTags} />;
          case 'html_attrs':
              return <SnippetsManager title="HTML Attributes" items={htmlAttributes} onSave={setHtmlAttributes} onBack={() => setView('main')} onReset={resetHtmlAttributes} />;
          case 'css_props':
              return <SnippetsManager title="CSS Properties" items={cssProps} onSave={setCssProps} onBack={() => setView('main')} onReset={resetCssProps} />;
          case 'js_keywords':
              return <SnippetsManager title="JS Keywords & Snippets" items={jsKeywords} onSave={setJsKeywords} onBack={() => setView('main')} onReset={resetJsKeywords} />;
          default:
              return (
                <>
                    <div className="flex justify-between items-center p-3 border-b border-vscode-border bg-vscode-activity/50 shrink-0">
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

                        <div className="h-px bg-vscode-border/50 my-2" />

                        {/* Customization Navigation */}
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-gray-400 uppercase mb-1">Autocomplete & Snippets</label>
                            
                            <MenuButton icon={<Code2 size={16} className="text-orange-400"/>} label="HTML Tags" onClick={() => setView('html_tags')} count={htmlTags.length} />
                            <MenuButton icon={<Type size={16} className="text-blue-400"/>} label="HTML Attributes" onClick={() => setView('html_attrs')} count={htmlAttributes.length} />
                            <MenuButton icon={<Hash size={16} className="text-blue-300"/>} label="CSS Properties" onClick={() => setView('css_props')} count={cssProps.length} />
                            <MenuButton icon={<FileCode size={16} className="text-yellow-400"/>} label="JS Keywords" onClick={() => setView('js_keywords')} count={jsKeywords.length} />
                        </div>
                    </div>
                    
                    <div className="p-3 border-t border-vscode-border bg-vscode-input/30 flex justify-end shrink-0">
                        <button 
                            onClick={onClose}
                            className="px-4 py-1.5 bg-vscode-accent text-white rounded text-xs font-bold hover:opacity-90 active:scale-95 transition-all"
                        >
                            Done
                        </button>
                    </div>
                </>
              );
      }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-vscode-sidebar w-full max-w-md border border-vscode-border shadow-2xl rounded-lg overflow-hidden flex flex-col h-[85vh] animate-scale-in">
          {renderContent()}
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

const MenuButton = ({ icon, label, onClick, count }: { icon: React.ReactNode, label: string, onClick: () => void, count: number }) => (
    <button 
        onClick={onClick}
        className="flex items-center justify-between w-full p-3 bg-vscode-input/50 border border-vscode-border rounded hover:bg-vscode-hover transition-colors"
    >
        <div className="flex items-center gap-3">
            {icon}
            <span className="text-sm text-gray-200">{label}</span>
        </div>
        <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{count}</span>
            <ChevronRight size={14} className="text-gray-500"/>
        </div>
    </button>
);
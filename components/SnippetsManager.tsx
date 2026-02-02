import React, { useState, useMemo } from 'react';
import { Suggestion } from '../types';
import { ArrowLeft, Plus, Search, Trash2, Edit2, RotateCcw } from 'lucide-react';

interface SnippetsManagerProps {
  title: string;
  items: Suggestion[];
  onSave: (items: Suggestion[]) => void;
  onBack: () => void;
  onReset: () => void;
}

export const SnippetsManager: React.FC<SnippetsManagerProps> = ({ title, items, onSave, onBack, onReset }) => {
  const [search, setSearch] = useState('');
  const [editingItem, setEditingItem] = useState<Suggestion | null>(null);
  const [isNew, setIsNew] = useState(false);
  
  // Edit Form State
  const [editLabel, setEditLabel] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editDetail, setEditDetail] = useState('');
  const [editType, setEditType] = useState<Suggestion['type']>('snippet');

  const filteredItems = useMemo(() => {
    return items.filter(i => 
        i.label.toLowerCase().includes(search.toLowerCase()) || 
        i.detail?.toLowerCase().includes(search.toLowerCase())
    );
  }, [items, search]);

  const handleEdit = (item: Suggestion) => {
      setEditingItem(item);
      setEditLabel(item.label);
      setEditValue(item.value);
      setEditDetail(item.detail || '');
      setEditType(item.type);
      setIsNew(false);
  };

  const handleAdd = () => {
      setEditingItem({ label: '', value: '', type: 'snippet', detail: '' });
      setEditLabel('');
      setEditValue('');
      setEditDetail('');
      setEditType('snippet');
      setIsNew(true);
  };

  const handleSaveItem = () => {
      if (!editLabel || !editValue) return;
      
      const newItem: Suggestion = {
          label: editLabel,
          value: editValue,
          detail: editDetail,
          type: editType
      };

      if (isNew) {
          onSave([...items, newItem]);
      } else {
          onSave(items.map(i => i === editingItem ? newItem : i));
      }
      setEditingItem(null);
  };

  const handleDelete = (item: Suggestion) => {
      if(confirm(`Delete snippet "${item.label}"?`)) {
          onSave(items.filter(i => i !== item));
      }
  };

  if (editingItem) {
      return (
          <div className="flex flex-col h-full bg-vscode-sidebar animate-fade-in w-full">
             <div className="flex items-center gap-2 p-3 border-b border-vscode-border bg-vscode-activity/50 shrink-0">
                 <button onClick={() => setEditingItem(null)} className="hover:text-white"><ArrowLeft size={16}/></button>
                 <span className="font-bold text-sm text-white">{isNew ? 'New Snippet' : 'Edit Snippet'}</span>
             </div>
             <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1">
                 <div className="flex flex-col gap-1">
                     <label className="text-xs text-gray-400">Trigger / Label</label>
                     <input className="bg-vscode-input border border-vscode-border p-2 rounded text-sm text-white outline-none focus:border-vscode-accent" value={editLabel} onChange={e => setEditLabel(e.target.value)} placeholder="e.g. div" />
                 </div>
                 <div className="flex flex-col gap-1">
                     <label className="text-xs text-gray-400">Type</label>
                     <select className="bg-vscode-input border border-vscode-border p-2 rounded text-sm text-white outline-none focus:border-vscode-accent" value={editType} onChange={e => setEditType(e.target.value as any)}>
                         <option value="tag">Tag</option>
                         <option value="snippet">Snippet</option>
                         <option value="property">Property</option>
                         <option value="keyword">Keyword</option>
                         <option value="emmet">Emmet</option>
                     </select>
                 </div>
                 <div className="flex flex-col gap-1">
                     <label className="text-xs text-gray-400">Description</label>
                     <input className="bg-vscode-input border border-vscode-border p-2 rounded text-sm text-white outline-none focus:border-vscode-accent" value={editDetail} onChange={e => setEditDetail(e.target.value)} placeholder="e.g. Div Element" />
                 </div>
                 <div className="flex flex-col gap-1 flex-1 min-h-[150px]">
                     <label className="text-xs text-gray-400">Expansion Code ($0 for cursor)</label>
                     <textarea className="bg-vscode-input border border-vscode-border p-2 rounded text-sm text-white outline-none focus:border-vscode-accent font-mono flex-1 resize-none" value={editValue} onChange={e => setEditValue(e.target.value)} placeholder="<div>$0</div>" />
                 </div>
                 <button onClick={handleSaveItem} className="bg-vscode-accent text-white py-3 rounded-lg font-bold hover:opacity-90 active:scale-95 transition-all">Save</button>
             </div>
          </div>
      );
  }

  return (
    <div className="flex flex-col h-full bg-vscode-sidebar animate-fade-in w-full">
      <div className="flex items-center justify-between p-3 border-b border-vscode-border bg-vscode-activity/50 shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="hover:text-white"><ArrowLeft size={16}/></button>
            <span className="font-bold text-sm text-white">{title}</span>
          </div>
          <div className="flex gap-4">
            <button onClick={() => { if(confirm('Reset all to defaults? This will erase custom changes.')) onReset(); }} className="text-gray-400 hover:text-white" title="Reset Defaults"><RotateCcw size={16}/></button>
            <button onClick={handleAdd} className="text-vscode-accent hover:text-white"><Plus size={20}/></button>
          </div>
      </div>
      
      <div className="p-2 border-b border-vscode-border shrink-0">
          <div className="flex items-center bg-vscode-input px-2 rounded border border-transparent focus-within:border-vscode-accent">
              <Search size={14} className="text-gray-400"/>
              <input className="bg-transparent border-none outline-none text-white text-xs p-2 flex-1" placeholder="Search snippets..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
      </div>

      <div className="flex-1 overflow-y-auto">
          {filteredItems.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 border-b border-vscode-border/50 hover:bg-vscode-hover group">
                  <div className="flex-1 min-w-0 mr-2" onClick={() => handleEdit(item)}>
                      <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-bold text-vscode-accent text-sm font-mono truncate">{item.label}</span>
                          <span className="text-[9px] uppercase tracking-wider bg-vscode-activity px-1.5 py-0.5 rounded text-gray-400">{item.type}</span>
                      </div>
                      <div className="text-xs text-gray-500 truncate font-mono">{item.value.replace(/\n/g, '↵')}</div>
                  </div>
                  <div className="flex gap-3 items-center">
                      <button onClick={() => handleEdit(item)} className="text-gray-400 hover:text-white"><Edit2 size={14}/></button>
                      <button onClick={() => handleDelete(item)} className="text-gray-400 hover:text-red-400"><Trash2 size={14}/></button>
                  </div>
              </div>
          ))}
          {filteredItems.length === 0 && (
              <div className="p-8 text-center text-gray-500 text-xs flex flex-col items-center gap-2">
                <Search size={24} className="opacity-20"/>
                <span>No snippets found</span>
              </div>
          )}
      </div>
    </div>
  );
};
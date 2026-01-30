
import React, { useState } from 'react';
import { FileNode } from '../types';
import { 
  ChevronRight, 
  ChevronDown, 
  FileCode, 
  FileJson, 
  FileType, 
  Folder, 
  FolderOpen, 
  Plus, 
  Trash2, 
  FilePlus, 
  FolderPlus,
  MoreHorizontal,
  FolderInput,
  Edit2,
  Check
} from 'lucide-react';

interface FileExplorerProps {
  nodes: FileNode[];
  activeFileId: string | null;
  onFileSelect: (file: FileNode) => void;
  onToggleFolder: (folderId: string) => void;
  onCreateNode: (parentId: string | null, type: 'file' | 'folder', name: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onRenameNode: (nodeId: string, newName: string) => void;
  onOpenFolder: () => void;
}

const getFileIcon = (filename: string) => {
  if (filename.endsWith('.html')) return <FileCode size={14} className="text-orange-500" />;
  if (filename.endsWith('.css')) return <FileType size={14} className="text-blue-400" />;
  if (filename.endsWith('.js') || filename.endsWith('.ts') || filename.endsWith('.tsx')) return <FileCode size={14} className="text-yellow-400" />;
  if (filename.endsWith('.json')) return <FileJson size={14} className="text-yellow-200" />;
  return <FileType size={14} className="text-gray-400" />;
};

const FileItem: React.FC<{
  node: FileNode;
  activeFileId: string | null;
  depth: number;
  onSelect: (node: FileNode) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
}> = ({ node, activeFileId, depth, onSelect, onToggle, onDelete, onRename, editingId, setEditingId }) => {
  const [tempName, setTempName] = useState(node.name);
  const isEditing = editingId === node.id;
  const isActive = node.id === activeFileId;

  const handleRenameSubmit = () => {
    if (tempName.trim() && tempName !== node.name) {
       onRename(node.id, tempName.trim());
    }
    setEditingId(null);
  };

  const startRename = (e: React.MouseEvent) => {
      e.stopPropagation();
      setTempName(node.name);
      setEditingId(node.id);
  };

  return (
    <div>
      <div
        className={`flex items-center py-0.5 px-2 cursor-pointer select-none border-l-2 group ${
          isActive 
            ? 'bg-vscode-hover border-vscode-accent text-white' 
            : 'border-transparent hover:bg-vscode-hover text-vscode-fg'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => node.type === 'folder' ? onToggle(node.id) : onSelect(node)}
      >
        <span className="mr-1.5 opacity-80">
          {node.type === 'folder' ? (
             node.isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
             <span className="w-3.5 inline-block" />
          )}
        </span>
        
        <span className="mr-2">
           {node.type === 'folder' ? (
             node.isOpen ? <FolderOpen size={14} className="text-vscode-fg" /> : <Folder size={14} className="text-vscode-fg" />
           ) : (
             getFileIcon(node.name)
           )}
        </span>
        
        {isEditing ? (
            <div className="flex-1 flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <input 
                    autoFocus
                    className="bg-vscode-input text-white text-xs p-0.5 px-1 w-full outline-none border border-vscode-accent rounded-sm"
                    value={tempName}
                    onChange={e => setTempName(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') handleRenameSubmit();
                        if (e.key === 'Escape') setEditingId(null);
                    }}
                    onBlur={handleRenameSubmit}
                />
            </div>
        ) : (
            <span className="text-[13px] truncate flex-1 font-sans leading-6" onDoubleClick={startRename}>{node.name}</span>
        )}
        
        {/* Actions - Visible on Hover or when Active */}
        {!isEditing && (
            <div className={`flex gap-1 ${isActive ? 'flex' : 'hidden group-hover:flex'}`}>
                <button 
                    onClick={startRename}
                    className="hover:text-vscode-accent p-1 text-gray-400"
                    title="Rename"
                >
                    <Edit2 size={12} />
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); if(confirm('Delete ' + node.name + '?')) onDelete(node.id); }}
                    className="hover:text-red-400 p-1 text-gray-400"
                    title="Delete"
                >
                    <Trash2 size={12} />
                </button>
            </div>
        )}
      </div>
      
      {node.type === 'folder' && node.isOpen && node.children && (
        <div>
          {node.children.map(child => (
            <FileItem 
                key={child.id} 
                node={child} 
                activeFileId={activeFileId} 
                depth={depth + 1} 
                onSelect={onSelect} 
                onToggle={onToggle}
                onDelete={onDelete}
                onRename={onRename}
                editingId={editingId}
                setEditingId={setEditingId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const FileExplorer: React.FC<FileExplorerProps> = ({ nodes, activeFileId, onFileSelect, onToggleFolder, onCreateNode, onDeleteNode, onRenameNode, onOpenFolder }) => {
    const [isCreating, setIsCreating] = useState<'file' | 'folder' | null>(null);
    const [newName, setNewName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);

    const handleCreate = () => {
        if (newName.trim()) {
            onCreateNode(null, isCreating!, newName.trim());
        }
        setIsCreating(null);
        setNewName('');
    }

  return (
    <div className="h-full bg-vscode-sidebar text-vscode-fg flex flex-col font-sans select-none border-r border-vscode-activity">
      <div className="h-9 px-4 text-[11px] font-bold uppercase tracking-wider flex justify-between items-center text-gray-400">
        <span>Explorer</span>
        <div className="flex gap-2">
           <MoreHorizontal size={14} className="cursor-pointer hover:text-white" />
        </div>
      </div>
      
      {/* Project Header */}
      <div className="px-2 py-1 flex justify-between items-center bg-vscode-activity/30 group">
          <div className="flex items-center gap-1 font-bold text-xs">
              <ChevronDown size={12} />
              <span>PROJECT</span>
          </div>
          <div className="flex gap-1.5 opacity-100 group-hover:opacity-100 transition-opacity">
              <button onClick={onOpenFolder} className="hover:text-vscode-accent text-gray-300" title="Open Folder"><FolderInput size={14} /></button>
              <button onClick={() => setIsCreating('file')} className="hover:text-white" title="New File"><FilePlus size={14}/></button>
              <button onClick={() => setIsCreating('folder')} className="hover:text-white" title="New Folder"><FolderPlus size={14}/></button>
          </div>
      </div>

      {isCreating && (
          <div className="p-1 pl-4 flex gap-1 bg-vscode-input">
              <input 
                autoFocus
                className="bg-vscode-bg text-white text-xs p-1 w-full outline-none border border-vscode-accent"
                placeholder={isCreating === 'file' ? "filename.js" : "foldername"}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                onBlur={() => handleCreate()}
              />
          </div>
      )}

      <div className="flex-1 overflow-y-auto pt-1">
        {nodes.map(node => (
          <FileItem 
            key={node.id} 
            node={node} 
            activeFileId={activeFileId} 
            depth={0} 
            onSelect={onFileSelect} 
            onToggle={onToggleFolder}
            onDelete={onDeleteNode}
            onRename={onRenameNode}
            editingId={editingId}
            setEditingId={setEditingId}
          />
        ))}
      </div>
      
      <div className="p-2 border-t border-vscode-activity text-[10px] text-gray-500 text-center">
          Tap file to select. Icons appear on active item.
      </div>
    </div>
  );
};

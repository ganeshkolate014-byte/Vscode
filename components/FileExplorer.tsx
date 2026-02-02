
import React, { useState, useEffect, useRef } from 'react';
import { FileNode } from '../types';
import { 
  ChevronRight, 
  ChevronDown, 
  FileCode, 
  FileJson, 
  FileType, 
  Folder, 
  FolderOpen, 
  Trash2, 
  FilePlus, 
  FolderPlus,
  MoreHorizontal,
  FolderInput,
  Edit2,
  X,
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

interface CreatingState {
    parentId: string | null;
    type: 'file' | 'folder';
}

const getFileIcon = (filename: string) => {
  if (filename.endsWith('.html')) return <FileCode size={16} className="text-orange-500" />;
  if (filename.endsWith('.css')) return <FileType size={16} className="text-blue-500" />;
  if (filename.endsWith('.js') || filename.endsWith('.ts') || filename.endsWith('.tsx') || filename.endsWith('.jsx')) return <FileCode size={16} className="text-yellow-400" />;
  if (filename.endsWith('.json')) return <FileJson size={16} className="text-yellow-200" />;
  return <FileType size={16} className="text-gray-400" />;
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
  menuOpenId: string | null;
  setMenuOpenId: (id: string | null) => void;
  onStartCreate: (parentId: string, type: 'file' | 'folder') => void;
  creatingState: CreatingState | null;
  submitCreate: (name: string) => void;
  cancelCreate: () => void;
}> = ({ 
    node, activeFileId, depth, onSelect, onToggle, onDelete, onRename, 
    editingId, setEditingId, menuOpenId, setMenuOpenId, onStartCreate,
    creatingState, submitCreate, cancelCreate
}) => {
  const [tempName, setTempName] = useState(node.name);
  const [newChildName, setNewChildName] = useState('');
  
  const isEditing = editingId === node.id;
  const isMenuOpen = menuOpenId === node.id;
  const isActive = node.id === activeFileId;
  const isCreatingHere = creatingState?.parentId === node.id;

  const handleRenameSubmit = () => {
    if (tempName.trim() && tempName !== node.name) {
       onRename(node.id, tempName.trim());
    }
    setEditingId(null);
  };

  const handleCreateSubmit = () => {
      if (newChildName.trim()) {
          submitCreate(newChildName.trim());
          setNewChildName('');
      } else {
          cancelCreate();
      }
  };

  const startRename = (e: React.MouseEvent) => {
      e.stopPropagation();
      setTempName(node.name);
      setEditingId(node.id);
      setMenuOpenId(null);
  };

  return (
    <div className="relative">
       {/* Indent Guide */}
      {depth > 0 && (
          <div 
            className="absolute top-0 bottom-0 w-px bg-vscode-border/50" 
            style={{ left: `${depth * 12}px` }} 
          />
      )}

      <div
        className={`flex items-center py-0.5 px-2 cursor-pointer select-none border-l-2 group relative z-10 transition-colors duration-150 ${
          isActive 
            ? 'bg-vscode-hover border-vscode-accent text-white' 
            : 'border-transparent hover:bg-vscode-hover text-vscode-fg'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => node.type === 'folder' ? onToggle(node.id) : onSelect(node)}
      >
        {/* Toggle / Icon */}
        <span className="mr-1.5 opacity-80 shrink-0">
          {node.type === 'folder' ? (
             node.isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
             <span className="w-3.5 inline-block" />
          )}
        </span>
        
        <span className="mr-2 shrink-0">
           {node.type === 'folder' ? (
             node.isOpen ? <FolderOpen size={14} className="text-vscode-fg" /> : <Folder size={14} className="text-vscode-fg" />
           ) : (
             getFileIcon(node.name)
           )}
        </span>
        
        {/* Name / Rename Input */}
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
                    onClick={e => e.stopPropagation()}
                />
            </div>
        ) : (
            <span className="text-[13px] truncate flex-1 font-sans leading-6">{node.name}</span>
        )}
        
        {/* Menu Toggle or Actions Toolbar */}
        <div className="ml-2" onClick={e => e.stopPropagation()}>
            {isMenuOpen ? (
                <div className="flex items-center bg-vscode-activity rounded shadow-lg border border-vscode-border animate-scale-in">
                    {node.type === 'folder' && (
                        <>
                            <button onClick={() => { onStartCreate(node.id, 'file'); setMenuOpenId(null); }} className="p-1.5 hover:text-white hover:bg-vscode-hover transition-colors" title="New File"><FilePlus size={12}/></button>
                            <button onClick={() => { onStartCreate(node.id, 'folder'); setMenuOpenId(null); }} className="p-1.5 hover:text-white hover:bg-vscode-hover transition-colors" title="New Folder"><FolderPlus size={12}/></button>
                            <div className="w-px h-3 bg-gray-600 mx-0.5" />
                        </>
                    )}
                    <button onClick={startRename} className="p-1.5 hover:text-white hover:bg-vscode-hover transition-colors" title="Rename"><Edit2 size={12}/></button>
                    <button onClick={() => { if(confirm(`Delete ${node.name}?`)) onDelete(node.id); setMenuOpenId(null); }} className="p-1.5 hover:text-red-400 hover:bg-vscode-hover transition-colors" title="Delete"><Trash2 size={12}/></button>
                    <button onClick={() => setMenuOpenId(null)} className="p-1.5 text-gray-400 hover:text-white hover:bg-vscode-hover transition-colors" title="Close"><X size={12}/></button>
                </div>
            ) : (
                !isEditing && (
                    <button 
                        onClick={() => setMenuOpenId(node.id)}
                        className={`p-1 rounded hover:bg-gray-700 hover:text-white transition-colors ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                    >
                        <MoreHorizontal size={14} />
                    </button>
                )
            )}
        </div>
      </div>
      
      {/* Creation Input (if creating inside this folder) */}
      {isCreatingHere && node.isOpen && (
           <div 
             className="flex items-center py-1 pr-2 animate-fade-in"
             style={{ paddingLeft: `${(depth + 1) * 12 + 28}px` }}
           >
              <span className="mr-2 text-gray-400">
                  {creatingState?.type === 'folder' ? <Folder size={14}/> : <FileCode size={14}/>}
              </span>
              <input 
                  autoFocus
                  className="bg-vscode-input text-white text-xs p-1 w-full outline-none border border-vscode-accent rounded-sm"
                  placeholder={creatingState?.type === 'folder' ? 'Folder Name' : 'File Name'}
                  value={newChildName}
                  onChange={e => setNewChildName(e.target.value)}
                  onKeyDown={e => {
                      if (e.key === 'Enter') handleCreateSubmit();
                      if (e.key === 'Escape') cancelCreate();
                  }}
                  onBlur={() => { if (!newChildName) cancelCreate(); }}
              />
           </div>
      )}

      {/* Children */}
      {node.type === 'folder' && node.isOpen && node.children && (
        <div className="origin-top">
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
                menuOpenId={menuOpenId}
                setMenuOpenId={setMenuOpenId}
                onStartCreate={onStartCreate}
                creatingState={creatingState}
                submitCreate={submitCreate}
                cancelCreate={cancelCreate}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const FileExplorer: React.FC<FileExplorerProps> = ({ nodes, activeFileId, onFileSelect, onToggleFolder, onCreateNode, onDeleteNode, onRenameNode, onOpenFolder }) => {
    const [creatingState, setCreatingState] = useState<CreatingState | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    const [rootNewName, setRootNewName] = useState('');

    const startCreate = (parentId: string | null, type: 'file' | 'folder') => {
        setCreatingState({ parentId, type });
        if (parentId) {
            // Logic to open folder if closed could go here if parentId logic wasn't in FileItem
        }
    };

    const submitCreate = (name: string) => {
        if (creatingState && name) {
            onCreateNode(creatingState.parentId, creatingState.type, name);
        }
        setCreatingState(null);
        setRootNewName('');
    };

    return (
    <div className="h-full bg-vscode-sidebar text-vscode-fg flex flex-col font-sans select-none border-r border-vscode-activity" onClick={() => setMenuOpenId(null)}>
      <div className="h-9 px-4 text-[11px] font-bold uppercase tracking-wider flex justify-between items-center text-gray-400">
        <span>Explorer</span>
        <div className="flex gap-2">
           <MoreHorizontal size={14} className="cursor-pointer hover:text-white transition-colors" />
        </div>
      </div>
      
      {/* Project Header */}
      <div className="px-2 py-1 flex justify-between items-center bg-vscode-activity/30 group">
          <div className="flex items-center gap-1 font-bold text-xs">
              <ChevronDown size={12} />
              <span>PROJECT</span>
          </div>
          <div className="flex gap-1.5 opacity-100 transition-opacity">
              <button onClick={(e) => { e.stopPropagation(); onOpenFolder(); }} className="hover:text-vscode-accent text-gray-300 transition-colors" title="Open Folder"><FolderInput size={14} /></button>
              <button onClick={(e) => { e.stopPropagation(); startCreate(null, 'file'); }} className="hover:text-white transition-colors" title="New File"><FilePlus size={14}/></button>
              <button onClick={(e) => { e.stopPropagation(); startCreate(null, 'folder'); }} className="hover:text-white transition-colors" title="New Folder"><FolderPlus size={14}/></button>
          </div>
      </div>

      {/* Root Creation Input */}
      {creatingState?.parentId === null && (
          <div className="p-1 pl-4 flex gap-1 bg-vscode-input animate-fade-in border-l-2 border-vscode-accent mx-2 my-1 rounded-r">
              <span className="text-gray-400 flex items-center">{creatingState.type === 'folder' ? <Folder size={14}/> : <FileCode size={14}/>}</span>
              <input 
                autoFocus
                className="bg-transparent text-white text-xs p-1 w-full outline-none"
                placeholder={creatingState.type === 'folder' ? "foldername" : "filename.js"}
                value={rootNewName}
                onChange={e => setRootNewName(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter') submitCreate(rootNewName);
                    if (e.key === 'Escape') setCreatingState(null);
                }}
                onBlur={() => { if(rootNewName) submitCreate(rootNewName); else setCreatingState(null); }}
              />
          </div>
      )}

      <div className="flex-1 overflow-y-auto pt-1 relative pb-10">
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
            menuOpenId={menuOpenId}
            setMenuOpenId={setMenuOpenId}
            onStartCreate={startCreate}
            creatingState={creatingState}
            submitCreate={submitCreate}
            cancelCreate={() => setCreatingState(null)}
          />
        ))}
      </div>
      
    </div>
  );
};

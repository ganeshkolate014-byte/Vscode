
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { CodeEditor } from './components/CodeEditor';
import { FileExplorer } from './components/FileExplorer';
import { LivePreview } from './components/LivePreview';
import { GitPanel } from './components/GitPanel';
import { FileNode, ChatMessage } from './types';
import { 
  Files, 
  Search, 
  GitGraph, 
  Play, 
  Settings, 
  X, 
  MessageSquare, 
  Send, 
  Code2, 
  Maximize2,
  Columns
} from 'lucide-react';
import { generateCodeHelp } from './services/geminiService';

// Initial File System
const initialFiles: FileNode[] = [
  {
    id: '1',
    name: 'index.html',
    type: 'file',
    language: 'html',
    content: '<div class="container">\n  <h1>Hello DroidCoder</h1>\n  <p>Start editing to see magic!</p>\n  <button id="btn">Click Me</button>\n</div>'
  },
  {
    id: '2',
    name: 'style.css',
    type: 'file',
    language: 'css',
    content: 'body {\n  background: #1e1e1e;\n  color: #fff;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  height: 100vh;\n  margin: 0;\n  font-family: sans-serif;\n}\n\n.container {\n  text-align: center;\n  background: #252526;\n  padding: 2rem;\n  border: 1px solid #454545;\n  border-radius: 8px;\n  box-shadow: 0 4px 12px rgba(0,0,0,0.3);\n}\n\nh1 {\n  color: #007acc;\n}\n\nbutton {\n  background: #007acc;\n  color: white;\n  border: none;\n  padding: 8px 16px;\n  border-radius: 2px;\n  cursor: pointer;\n  font-size: 0.9rem;\n}\n\nbutton:active {\n  opacity: 0.8;\n}'
  },
  {
    id: '3',
    name: 'script.js',
    type: 'file',
    language: 'javascript',
    content: 'const btn = document.getElementById("btn");\n\nbtn.addEventListener("click", () => {\n  alert("Hello from VS Code Mobile!");\n});'
  }
];

// Helper to determine language
const getLanguage = (filename: string): 'html' | 'css' | 'javascript' => {
    if (filename.endsWith('.css')) return 'css';
    if (filename.endsWith('.js') || filename.endsWith('.ts')) return 'javascript';
    return 'html';
};

export default function App() {
  // Load files from local storage if available
  const [files, setFiles] = useState<FileNode[]>(() => {
    const saved = localStorage.getItem('droidcoder_files');
    return saved ? JSON.parse(saved) : initialFiles;
  });

  const [openFiles, setOpenFiles] = useState<string[]>(['1']); 
  const [activeFileId, setActiveFileId] = useState<string>('1');
  const [activeSideBar, setActiveSideBar] = useState<string | null>('explorer');
  const [previewMode, setPreviewMode] = useState<'hidden' | 'full' | 'split'>('hidden');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [debouncedFiles, setDebouncedFiles] = useState<FileNode[]>(files);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Viewport Height Management for Mobile Keyboard
  const [viewportHeight, setViewportHeight] = useState('100%');
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    let timeoutId: any;
    const handleResize = () => {
       if (timeoutId) clearTimeout(timeoutId);
       timeoutId = setTimeout(() => {
            // Use visualViewport if available for precise keyboard handling
            if (window.visualViewport) {
                setViewportHeight(`${window.visualViewport.height}px`);
                setIsKeyboardOpen(window.visualViewport.height < window.screen.height * 0.75);
            } else {
                setViewportHeight(`${window.innerHeight}px`);
            }
       }, 100);
    };

    // Initial set
    handleResize();

    // Listeners
    window.visualViewport?.addEventListener('resize', handleResize);
    window.addEventListener('resize', handleResize);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.removeEventListener('resize', handleResize);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // Save logic
  useEffect(() => {
    const hasHandles = files.some(f => f.handle);
    if (!hasHandles) {
        localStorage.setItem('droidcoder_files', JSON.stringify(files));
    }
    const handler = setTimeout(() => setDebouncedFiles(files), 500);
    return () => clearTimeout(handler);
  }, [files]);

  const getFileContent = (name: string) => {
      const findContent = (nodes: FileNode[]): string | undefined => {
          for (const node of nodes) {
              if (node.name === name && node.type === 'file') return node.content;
              if (node.children) {
                  const found = findContent(node.children);
                  if (found) return found;
              }
          }
          return undefined;
      };
      return findContent(debouncedFiles) || '';
  };
  
  const activeFile = useMemo(() => {
      const findNode = (nodes: FileNode[]): FileNode | undefined => {
          for (const node of nodes) {
              if (node.id === activeFileId) return node;
              if (node.children) {
                  const found = findNode(node.children);
                  if (found) return found;
              }
          }
          return undefined;
      };
      return findNode(files);
  }, [files, activeFileId]);

  const handleOpenFolder = async () => {
    try {
        // @ts-ignore
        const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        setOpenFiles([]);
        setActiveFileId('');
        setFiles([]);
        const nodes = await readDirectory(dirHandle, null);
        setFiles(nodes);
        const indexNode = nodes.find(n => n.name === 'index.html');
        if (indexNode) {
            setOpenFiles([indexNode.id]);
            setActiveFileId(indexNode.id);
        }
    } catch (err) {
      console.error("Error opening folder:", err);
      // alert("Could not open folder.");
    }
  };

  const readDirectory = async (dirHandle: any, parentId: string | null): Promise<FileNode[]> => {
      const nodes: FileNode[] = [];
      for await (const entry of dirHandle.values()) {
          const id = parentId ? `${parentId}/${entry.name}` : entry.name;
          if (entry.kind === 'file') {
              const file = await entry.getFile();
              let content = '';
              if (file.size < 100000 && !file.type.startsWith('image')) {
                 try { content = await file.text(); } catch (e) {}
              }
              nodes.push({
                  id, name: entry.name, type: 'file', language: getLanguage(entry.name), content, handle: entry
              });
          } else if (entry.kind === 'directory') {
              const children = await readDirectory(entry, id);
              nodes.push({
                  id, name: entry.name, type: 'folder', children, isOpen: false, handle: entry
              });
          }
      }
      return nodes.sort((a, b) => {
          if (a.type === b.type) return a.name.localeCompare(b.name);
          return a.type === 'folder' ? -1 : 1;
      });
  };

  const handleCodeChange = (newCode: string) => {
    setFiles(prev => {
        const updateNode = (nodes: FileNode[]): FileNode[] => {
            return nodes.map(node => {
                if (node.id === activeFileId) return { ...node, content: newCode };
                if (node.children) return { ...node, children: updateNode(node.children) };
                return node;
            });
        };
        return updateNode(prev);
    });

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
        if (!activeFile || !activeFile.handle) return;
        try {
            const writable = await activeFile.handle.createWritable();
            await writable.write(newCode);
            await writable.close();
        } catch (e) { console.error("Failed to save file:", e); }
    }, 1000);
  };

  const toggleFolder = (folderId: string) => {
    setFiles(prev => {
         const toggle = (nodes: FileNode[]): FileNode[] => {
             return nodes.map(node => {
                 if (node.id === folderId) return { ...node, isOpen: !node.isOpen };
                 if (node.children) return { ...node, children: toggle(node.children) };
                 return node;
             });
         };
         return toggle(prev);
    });
  };

  const handleFileSelect = (node: FileNode) => {
    if (!openFiles.includes(node.id)) setOpenFiles(prev => [...prev, node.id]);
    setActiveFileId(node.id);
    if (window.innerWidth < 768) setActiveSideBar(null);
  };

  const closeTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newOpenFiles = openFiles.filter(fid => fid !== id);
    setOpenFiles(newOpenFiles);
    if (activeFileId === id && newOpenFiles.length > 0) setActiveFileId(newOpenFiles[newOpenFiles.length - 1]);
    else if (newOpenFiles.length === 0) setActiveFileId('');
  };

  const createFile = (parentId: string | null, type: 'file' | 'folder', name: string) => {
      const newFile: FileNode = {
        id: Date.now().toString(), name, type, content: type === 'file' ? '' : undefined, language: getLanguage(name), isOpen: true, children: []
      };
      setFiles(prev => {
          if (!parentId) return [...prev, newFile];
          const addToParent = (nodes: FileNode[]): FileNode[] => {
              return nodes.map(node => {
                  if (node.id === parentId && node.children) return { ...node, children: [...node.children, newFile], isOpen: true };
                  if (node.children) return { ...node, children: addToParent(node.children) };
                  return node;
              });
          };
          return addToParent(prev);
      });
      if (type === 'file') handleFileSelect(newFile);
  };

  const deleteNode = (id: string) => {
    setFiles(prev => {
        const remove = (nodes: FileNode[]): FileNode[] => {
            return nodes.filter(n => n.id !== id).map(n => {
                if (n.children) return { ...n, children: remove(n.children) };
                return n;
            });
        };
        return remove(prev);
    });
    if (openFiles.includes(id)) {
       const newOpen = openFiles.filter(fid => fid !== id);
       setOpenFiles(newOpen);
       if (activeFileId === id) setActiveFileId(newOpen[0] || '');
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;
    const userMsg: ChatMessage = { role: 'user', text: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);
    const context = activeFile ? `Active File: ${activeFile.name}\n${activeFile.content}` : 'No active file.';
    const response = await generateCodeHelp(userMsg.text, context);
    setChatMessages(prev => [...prev, { role: 'model', text: response }]);
    setIsChatLoading(false);
  };

  const togglePreviewMode = () => {
      if (previewMode === 'hidden') setPreviewMode('split');
      else if (previewMode === 'split') setPreviewMode('full');
      else setPreviewMode('hidden');
  };
  
  const findActiveNode = (nodes: FileNode[], id: string): FileNode | undefined => {
      for (const node of nodes) {
          if (node.id === id) return node;
          if (node.children) {
              const found = findActiveNode(node.children, id);
              if (found) return found;
          }
      }
      return undefined;
  };
  
  const currentActiveNode = useMemo(() => findActiveNode(files, activeFileId), [files, activeFileId]);

  // --- GitHub Integrations ---
  const handleGitImport = (nodes: FileNode[], repoName: string) => {
      setFiles(nodes);
      setOpenFiles([]);
      setActiveFileId('');
      // Try to open index.html or README
      const readme = nodes.find(n => n.name.toLowerCase().startsWith('readme'));
      const index = nodes.find(n => n.name === 'index.html');
      const firstFile = index || readme || nodes.find(n => n.type === 'file');
      
      if (firstFile) {
          setOpenFiles([firstFile.id]);
          setActiveFileId(firstFile.id);
      }
      
      // Auto-switch to files view on mobile after import
      setActiveSideBar('explorer');
  };

  const handleUpdateFileNode = (id: string, sha: string) => {
      setFiles(prev => {
          const update = (nodes: FileNode[]): FileNode[] => {
              return nodes.map(n => {
                  if (n.id === id) return { ...n, sha };
                  if (n.children) return { ...n, children: update(n.children) };
                  return n;
              });
          };
          return update(prev);
      });
  };

  return (
    <div className="flex flex-col bg-vscode-bg text-vscode-fg font-sans w-full" style={{ height: viewportHeight, overflow: 'hidden' }}>
      
      {/* 1. Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* A. Activity Bar */}
        <aside className="hidden md:flex flex-col w-12 bg-vscode-activity items-center py-2 gap-4 border-r border-vscode-bg shrink-0 z-20">
            <ActivityIcon icon={<Files size={24} />} active={activeSideBar === 'explorer'} onClick={() => setActiveSideBar(activeSideBar === 'explorer' ? null : 'explorer')} />
            <ActivityIcon icon={<Search size={24} />} active={activeSideBar === 'search'} onClick={() => setActiveSideBar(activeSideBar === 'search' ? null : 'search')} />
            <ActivityIcon icon={<GitGraph size={24} />} active={activeSideBar === 'git'} onClick={() => setActiveSideBar(activeSideBar === 'git' ? null : 'git')} />
            <ActivityIcon icon={<MessageSquare size={24} />} active={activeSideBar === 'ai'} onClick={() => setActiveSideBar(activeSideBar === 'ai' ? null : 'ai')} />
            <div className="flex-1" />
            <ActivityIcon icon={<Settings size={24} />} active={false} onClick={() => {}} />
        </aside>

        {/* B. Side Bar */}
        {activeSideBar && (
          <div className={`absolute inset-0 z-30 md:static md:w-64 bg-vscode-sidebar border-r border-black flex flex-col transition-all ${activeSideBar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} ${activeSideBar === 'ai' ? 'w-full md:w-80' : 'w-64'}`}>
             
             {activeSideBar === 'explorer' && (
               <FileExplorer 
                 nodes={files} 
                 activeFileId={activeFileId} 
                 onFileSelect={handleFileSelect} 
                 onToggleFolder={toggleFolder}
                 onCreateNode={createFile}
                 onDeleteNode={deleteNode}
                 onOpenFolder={handleOpenFolder}
               />
             )}

             {activeSideBar === 'git' && (
               <GitPanel 
                 files={files}
                 onImport={handleGitImport}
                 onUpdateFileNode={handleUpdateFileNode}
               />
             )}

             {activeSideBar === 'ai' && (
                <div className="flex flex-col h-full bg-vscode-sidebar">
                    <div className="p-3 uppercase text-xs font-bold text-gray-400 border-b border-vscode-activity flex justify-between">
                        <span>AI Assistant</span>
                        <button onClick={() => setActiveSideBar(null)} className="md:hidden"><X size={16}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {chatMessages.map((msg, idx) => (
                            <div key={idx} className={`p-2 rounded text-sm ${msg.role === 'user' ? 'bg-vscode-accent text-white self-end ml-4' : 'bg-vscode-input text-gray-200 mr-4'}`}>
                                {msg.text}
                            </div>
                        ))}
                        {isChatLoading && <div className="text-xs text-gray-500 animate-pulse">Thinking...</div>}
                    </div>
                    <div className="p-2 border-t border-vscode-activity flex gap-2">
                        <input 
                            className="flex-1 bg-vscode-input border border-vscode-border rounded p-2 text-sm outline-none focus:border-vscode-accent"
                            placeholder="Ask AI..."
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                        />
                        <button onClick={sendChatMessage} className="p-2 bg-vscode-accent rounded text-white"><Send size={16}/></button>
                    </div>
                </div>
             )}
             <div className="md:hidden absolute top-0 -right-12 w-12 h-full" onClick={() => setActiveSideBar(null)} />
          </div>
        )}

        {/* C. Editor & Preview Group */}
        <div className="flex-1 flex flex-col min-w-0 bg-vscode-bg relative">
          
          {/* C1. Tabs Header */}
          <div className="flex bg-vscode-sidebar overflow-x-auto no-scrollbar h-9 shrink-0 border-b border-black">
             {openFiles.map(fid => {
                 const node = findActiveNode(files, fid);
                 if (!node) return null;
                 const isActive = activeFileId === fid;
                 return (
                     <div 
                        key={fid}
                        onClick={() => setActiveFileId(fid)}
                        className={`flex items-center px-3 min-w-[100px] max-w-[150px] border-r border-vscode-border cursor-pointer select-none group ${isActive ? 'bg-vscode-tabActive text-white border-t-2 border-t-vscode-accent' : 'bg-vscode-tabInactive text-gray-400 hover:bg-vscode-bg'}`}
                     >
                        <span className="truncate text-xs flex-1 mr-2">{node.name}</span>
                        <button 
                            onClick={(e) => closeTab(e, fid)} 
                            className={`opacity-0 group-hover:opacity-100 p-0.5 rounded-sm hover:bg-gray-600 ${isActive ? 'opacity-100' : ''}`}
                        >
                            <X size={12} />
                        </button>
                     </div>
                 );
             })}
             
             {/* Right Controls in Tab Bar */}
             <div className="flex-1 bg-vscode-sidebar border-b border-black flex items-center justify-end px-2 gap-2">
                 <button 
                    onClick={togglePreviewMode} 
                    className={`p-1 rounded hover:bg-gray-700 ${previewMode !== 'hidden' ? 'text-vscode-accent' : 'text-gray-400'}`}
                    title="Toggle Preview Mode"
                 >
                    {previewMode === 'split' ? <Columns size={16} /> : previewMode === 'full' ? <Maximize2 size={16} /> : <Play size={16} />}
                 </button>
             </div>
          </div>

          {/* C2. Content Area (Editor + Preview) */}
          <div className="flex-1 flex flex-col md:flex-row relative overflow-hidden">
             
             {/* EDITOR PANE */}
             <div className={`${previewMode === 'full' ? 'hidden' : 'flex-1'} relative h-full border-r border-black`}>
                {currentActiveNode ? (
                    <CodeEditor 
                        code={currentActiveNode.content || ''} 
                        language={currentActiveNode.language || 'html'} 
                        onChange={handleCodeChange}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
                        <Code2 size={48} className="opacity-20" />
                        <p className="text-sm">Select a file or Open Folder</p>
                    </div>
                )}
             </div>

             {/* PREVIEW PANE */}
             {(previewMode !== 'hidden') && (
                <div className={`${previewMode === 'split' ? 'h-1/2 md:h-full md:w-1/2' : 'absolute inset-0 z-40'} bg-white flex flex-col border-t md:border-t-0 md:border-l border-black`}>
                   <div className="h-6 bg-gray-100 border-b flex items-center px-4 text-[10px] text-gray-600 justify-between shrink-0">
                      <span>Live Preview</span>
                      <button onClick={() => setPreviewMode('hidden')}><X size={12}/></button>
                   </div>
                   <div className="flex-1 relative">
                        <LivePreview 
                            html={getFileContent('index.html')} 
                            css={getFileContent('style.css')} 
                            js={getFileContent('script.js')} 
                        />
                   </div>
                </div>
             )}
          </div>
        </div>
      </div>

      {/* 2. Activity Bar (Mobile Bottom) - Hide when Keyboard Open to give space */}
      {!isKeyboardOpen && (
        <div className="md:hidden h-12 bg-vscode-activity flex justify-around items-center border-t border-black shrink-0 z-40">
           <ActivityIcon icon={<Files size={20} />} active={activeSideBar === 'explorer'} onClick={() => setActiveSideBar(activeSideBar === 'explorer' ? null : 'explorer')} />
           <ActivityIcon icon={<Search size={20} />} active={activeSideBar === 'search'} onClick={() => setActiveSideBar(activeSideBar === 'search' ? null : 'search')} />
           
           <div 
            className="w-12 h-12 -mt-6 bg-vscode-accent rounded-full flex items-center justify-center shadow-lg border-4 border-vscode-bg cursor-pointer" 
            onClick={togglePreviewMode}
           >
               {previewMode === 'hidden' ? <Play size={24} className="text-white ml-1" /> : <Code2 size={24} className="text-white" />}
           </div>
           
           <ActivityIcon icon={<GitGraph size={20} />} active={activeSideBar === 'git'} onClick={() => setActiveSideBar(activeSideBar === 'git' ? null : 'git')} />
           <ActivityIcon icon={<MessageSquare size={20} />} active={activeSideBar === 'ai'} onClick={() => setActiveSideBar(activeSideBar === 'ai' ? null : 'ai')} />
        </div>
      )}

      {/* 3. Status Bar - Hide when Keyboard Open */}
      {!isKeyboardOpen && (
        <div className="h-6 bg-vscode-accent text-white flex items-center px-3 text-[11px] justify-between select-none shrink-0 z-50">
          <div className="flex gap-4">
              <span className="flex items-center gap-1"><Code2 size={10}/> {currentActiveNode ? 'Local File' : 'Main'}</span>
              <span>Preview: {previewMode}</span>
          </div>
          <div className="flex gap-4">
               <span>Ln {currentActiveNode ? (currentActiveNode.content?.split('\n').length || 1) : 0}</span>
               <span>{currentActiveNode?.language?.toUpperCase() || 'TXT'}</span>
          </div>
        </div>
      )}
    </div>
  );
}

const ActivityIcon = ({ icon, active, onClick }: { icon: React.ReactNode, active: boolean, onClick: () => void }) => (
    <button 
        onClick={onClick}
        className={`p-2 relative group ${active ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
    >
        {active && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-vscode-accent md:block hidden" />}
        {icon}
    </button>
);

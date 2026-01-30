
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
  Columns,
  Save,
  Check,
  Menu,
  Terminal,
  GitBranch
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
  const [isSaved, setIsSaved] = useState(true);
  const [cursorStats, setCursorStats] = useState({ line: 1, col: 1 });

  // Viewport Height Management for Mobile Keyboard
  const [viewportHeight, setViewportHeight] = useState('100%');

  useEffect(() => {
    let timeoutId: any;
    const handleResize = () => {
       if (timeoutId) clearTimeout(timeoutId);
       timeoutId = setTimeout(() => {
            // Use visualViewport if available for precise keyboard handling
            if (window.visualViewport) {
                setViewportHeight(`${window.visualViewport.height}px`);
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
    setIsSaved(false);
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
        setIsSaved(true);
        if (activeFile && activeFile.handle) {
            try {
                const writable = await activeFile.handle.createWritable();
                await writable.write(newCode);
                await writable.close();
            } catch (e) { console.error("Failed to save file:", e); }
        }
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
    if (node.type === 'file') {
        if (!openFiles.includes(node.id)) setOpenFiles(prev => [...prev, node.id]);
        setActiveFileId(node.id);
        if (window.innerWidth < 768) setActiveSideBar(null);
    }
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

  const renameNode = (id: string, newName: string) => {
      if (!newName.trim()) return;
      setFiles(prev => {
          const update = (nodes: FileNode[]): FileNode[] => {
              return nodes.map(n => {
                  if (n.id === id) return { ...n, name: newName, language: n.type === 'file' ? getLanguage(newName) : n.language };
                  if (n.children) return { ...n, children: update(n.children) };
                  return n;
              });
          };
          return update(prev);
      });
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
    <div 
        className="flex flex-col w-full bg-vscode-bg text-vscode-fg overflow-hidden fixed inset-0"
        style={{ height: viewportHeight }}
    >
      {/* 1. Header (Tabs & Actions) */}
      <div className="h-10 flex bg-vscode-tabInactive shrink-0 items-center overflow-x-auto no-scrollbar border-b border-vscode-bg">
        {/* Toggle Sidebar (Mobile) */}
        <button 
           className="px-3 h-full hover:bg-vscode-activity flex items-center justify-center md:hidden border-r border-vscode-bg"
           onClick={() => setActiveSideBar(activeSideBar ? null : 'explorer')}
        >
           <Menu size={16} />
        </button>

        {/* Tabs */}
        <div className="flex-1 flex overflow-x-auto no-scrollbar h-full">
            {openFiles.map(fileId => {
                const node = (function find(nodes): FileNode | undefined {
                    for(const n of nodes) {
                        if(n.id === fileId) return n;
                        if(n.children) { const f = find(n.children); if(f) return f; }
                    }
                })(files);
                
                if (!node) return null;
                const isActive = activeFileId === node.id;
                
                return (
                    <div 
                        key={node.id}
                        onClick={() => { setActiveFileId(node.id); if(window.innerWidth < 768) setActiveSideBar(null); }}
                        className={`
                            group flex items-center gap-2 px-3 min-w-[120px] max-w-[200px] h-full text-xs cursor-pointer select-none border-r border-vscode-bg
                            ${isActive ? 'bg-vscode-bg text-white border-t-2 border-t-vscode-accent' : 'bg-vscode-tabInactive text-gray-400 hover:bg-vscode-activity'}
                        `}
                    >
                        <span className={`w-2 h-2 rounded-full ${isSaved ? 'hidden' : isActive ? 'bg-white' : 'bg-gray-400'} shrink-0`} />
                        <span className="truncate flex-1">{node.name}</span>
                        <button 
                            onClick={(e) => closeTab(e, node.id)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-600 rounded"
                        >
                            <X size={12}/>
                        </button>
                    </div>
                );
            })}
        </div>
        
        {/* Top Right Actions */}
        <div className="flex items-center h-full px-2 gap-1 bg-vscode-tabInactive">
            <button onClick={() => setActiveSideBar(activeSideBar === 'git' ? null : 'git')} className={`p-2 hover:bg-vscode-activity rounded ${activeSideBar === 'git' ? 'text-white' : 'text-gray-400'}`}>
                <GitGraph size={16} />
            </button>
            <button onClick={() => setActiveSideBar(activeSideBar === 'chat' ? null : 'chat')} className={`p-2 hover:bg-vscode-activity rounded ${activeSideBar === 'chat' ? 'text-white' : 'text-gray-400'}`}>
                <MessageSquare size={16} />
            </button>
            <button onClick={togglePreviewMode} className={`p-2 hover:bg-vscode-activity rounded ${previewMode !== 'hidden' ? 'text-green-400' : 'text-gray-400'}`}>
                {previewMode === 'hidden' ? <Play size={16} /> : previewMode === 'split' ? <Columns size={16}/> : <Maximize2 size={16} />}
            </button>
        </div>
      </div>

      {/* 2. Main Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
          
          {/* Sidebar Area */}
          {(activeSideBar || (window.innerWidth >= 768)) && (
             <div 
                className={`
                    absolute md:relative z-30 h-full bg-vscode-sidebar border-r border-vscode-activity transition-all duration-200 ease-in-out flex flex-col
                    ${activeSideBar ? 'w-64 translate-x-0 shadow-2xl' : 'w-0 -translate-x-full md:w-12 md:translate-x-0'}
                `}
             >
                 {/* Sidebar Content */}
                 <div className={`flex-1 overflow-hidden flex flex-col ${!activeSideBar && 'hidden'}`}>
                     {activeSideBar === 'explorer' && (
                         <FileExplorer 
                            nodes={debouncedFiles} 
                            activeFileId={activeFileId} 
                            onFileSelect={handleFileSelect}
                            onToggleFolder={toggleFolder}
                            onCreateNode={createFile}
                            onDeleteNode={deleteNode}
                            onRenameNode={renameNode}
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
                     {activeSideBar === 'chat' && (
                         <div className="flex flex-col h-full">
                             <div className="p-2 text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-vscode-activity">
                                 AI Assistant
                             </div>
                             <div className="flex-1 overflow-y-auto p-3 space-y-3">
                                 {chatMessages.map((msg, i) => (
                                     <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                         <div className={`max-w-[85%] p-2 rounded text-xs ${msg.role === 'user' ? 'bg-vscode-accent text-white' : 'bg-vscode-activity text-gray-200'}`}>
                                             {msg.text}
                                         </div>
                                     </div>
                                 ))}
                                 {isChatLoading && <div className="text-xs text-gray-500 italic">AI is thinking...</div>}
                             </div>
                             <div className="p-2 border-t border-vscode-activity flex gap-2">
                                 <input 
                                     className="flex-1 bg-vscode-input rounded px-2 py-1 text-xs outline-none focus:border focus:border-vscode-accent"
                                     placeholder="Ask about your code..."
                                     value={chatInput}
                                     onChange={e => setChatInput(e.target.value)}
                                     onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
                                 />
                                 <button onClick={sendChatMessage} className="p-1.5 bg-vscode-accent rounded text-white">
                                     <Send size={14} />
                                 </button>
                             </div>
                         </div>
                     )}
                 </div>

                 {/* Activity Bar (Desktop Icon Strip) */}
                 <div className={`w-12 flex-col items-center py-2 gap-4 border-r border-vscode-activity bg-vscode-activity hidden md:flex ${activeSideBar ? 'hidden' : 'flex'}`}>
                     <button onClick={() => setActiveSideBar('explorer')}><Files size={24} className="text-gray-400 hover:text-white" /></button>
                     <button onClick={() => setActiveSideBar('git')}><GitGraph size={24} className="text-gray-400 hover:text-white" /></button>
                     <button onClick={() => setActiveSideBar('chat')}><MessageSquare size={24} className="text-gray-400 hover:text-white" /></button>
                     <div className="flex-1" />
                     <Settings size={24} className="text-gray-400 hover:text-white cursor-pointer" />
                 </div>
             </div>
          )}

          {/* Editor & Preview Area */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative bg-vscode-bg">
              {/* Editor */}
              <div 
                className={`
                    flex-1 relative flex flex-col min-h-0
                    ${previewMode === 'full' ? 'hidden' : ''} 
                    ${previewMode === 'split' ? 'h-1/2 md:h-full md:w-1/2 border-b md:border-b-0 md:border-r border-vscode-activity' : 'h-full'}
                `}
              >
                 {activeFile ? (
                     <CodeEditor 
                        code={activeFile.content || ''} 
                        language={activeFile.language || 'javascript'} 
                        onChange={handleCodeChange}
                        onCursorMove={(line, col) => setCursorStats({line, col})}
                     />
                 ) : (
                     <div className="flex items-center justify-center h-full text-gray-500 text-sm flex-col gap-4">
                         <Code2 size={48} className="opacity-20" />
                         <p>Select a file to edit</p>
                     </div>
                 )}
              </div>

              {/* Preview */}
              <div 
                className={`
                    bg-white flex-col
                    ${previewMode === 'hidden' ? 'hidden' : 'flex'}
                    ${previewMode === 'full' ? 'absolute inset-0 z-40' : 'h-1/2 md:h-full md:w-1/2'}
                `}
              >
                  {previewMode === 'full' && (
                      <button 
                        onClick={() => setPreviewMode('split')}
                        className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full z-50 hover:bg-black/70"
                      >
                          <X size={16} />
                      </button>
                  )}
                  <LivePreview 
                      html={getFileContent('index.html')} 
                      css={getFileContent('style.css')} 
                      js={getFileContent('script.js')} 
                  />
              </div>
          </div>
      </div>

      {/* 3. Status Bar */}
      <div className="h-6 bg-vscode-activity border-t border-vscode-border text-[11px] text-white flex items-center justify-between px-3 select-none shrink-0 z-50">
          <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 hover:bg-vscode-hover px-1 rounded cursor-pointer">
                  <GitBranch size={10} />
                  <span>main</span>
              </div>
              <div className="flex items-center gap-1">
                 {isSaved ? <span className="flex items-center gap-1"><Check size={10}/> Saved</span> : <span className="flex items-center gap-1 text-yellow-500"><Save size={10}/> Unsaved</span>}
              </div>
              <div>
                  0 Errors
              </div>
          </div>
          <div className="flex items-center gap-4">
              <div className="hover:bg-vscode-hover px-1 rounded cursor-pointer">
                  Ln {cursorStats.line}, Col {cursorStats.col}
              </div>
              <div className="hover:bg-vscode-hover px-1 rounded cursor-pointer">
                  Spaces: 2
              </div>
              <div className="hover:bg-vscode-hover px-1 rounded cursor-pointer">
                  UTF-8
              </div>
              <div className="flex items-center gap-1 hover:bg-vscode-hover px-1 rounded cursor-pointer text-vscode-accent font-bold">
                  {activeFile ? activeFile.language?.toUpperCase() : 'TXT'}
              </div>
          </div>
      </div>
    </div>
  );
}

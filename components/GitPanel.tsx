
import React, { useState, useEffect } from 'react';
import { Github, LogIn, Download, Upload, RefreshCw, LogOut, Loader2, GitBranch, AlertCircle, CheckCircle2, Plus, Lock, Globe, X } from 'lucide-react';
import { validateToken, getUserRepos, getRepoTree, getBlob, updateFile, createRepo } from '../services/githubService';
import { FileNode } from '../types';

interface GitPanelProps {
  files: FileNode[];
  onImport: (nodes: FileNode[], repoName: string) => void;
  onUpdateFileNode: (id: string, sha: string) => void;
}

export const GitPanel: React.FC<GitPanelProps> = ({ files, onImport, onUpdateFileNode }) => {
  const [token, setToken] = useState(localStorage.getItem('gh_token') || '');
  const [user, setUser] = useState<any>(null);
  const [repos, setRepos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeRepo, setActiveRepo] = useState<any>(null);
  const [view, setView] = useState<'login' | 'repos' | 'sync'>('login');
  const [status, setStatus] = useState<string>('');
  const [pushProgress, setPushProgress] = useState({ current: 0, total: 0 });
  
  // Create Repo State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [commitMsg, setCommitMsg] = useState('Update via DroidCoder');

  useEffect(() => {
    if (token) handleLogin(token, true);
  }, []);

  const handleLogin = async (inputToken: string, isAuto = false) => {
    setLoading(true);
    setStatus('');
    try {
      const userData = await validateToken(inputToken);
      setUser(userData);
      localStorage.setItem('gh_token', inputToken);
      setToken(inputToken);
      
      const reposData = await getUserRepos(inputToken);
      setRepos(reposData);
      setView('repos');
    } catch (err) {
      if (!isAuto) setStatus('Invalid Token');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('gh_token');
    setToken('');
    setUser(null);
    setRepos([]);
    setActiveRepo(null);
    setView('login');
  };

  const handleCreateRepo = async () => {
      if (!newRepoName.trim()) return;
      setLoading(true);
      try {
          const newRepo = await createRepo(token, newRepoName, isPrivate);
          setRepos(prev => [newRepo, ...prev]);
          setActiveRepo(newRepo);
          setShowCreateForm(false);
          setNewRepoName('');
          setView('sync');
          setStatus('Repository created! You can now push your files.');
      } catch (err: any) {
          setStatus(`Error: ${err.message}`);
      } finally {
          setLoading(false);
      }
  };

  const handleClone = async (repo: any) => {
    setActiveRepo(repo);
    setLoading(true);
    setStatus('Fetching file structure...');
    
    try {
      const treeData = await getRepoTree(token, repo.owner.login, repo.name, repo.default_branch);
      const tree = treeData.tree;
      
      setStatus(`Downloading ${tree.length} files... this may take time.`);

      const nodes: FileNode[] = [];
      const nodeMap = new Map<string, FileNode>();

      // First pass: create folders and file placeholders
      tree.forEach((item: any) => {
          const parts = item.path.split('/');
          const name = parts.pop();
          const parentPath = parts.join('/');
          
          const node: FileNode = {
              id: item.path,
              name: name,
              type: item.type === 'blob' ? 'file' : 'folder',
              path: item.path,
              sha: item.sha,
              language: name.endsWith('.js') ? 'javascript' : name.endsWith('.css') ? 'css' : 'html',
              children: item.type === 'tree' ? [] : undefined,
              isOpen: false
          };
          
          nodeMap.set(item.path, node);
          
          if (parentPath === '') {
              nodes.push(node);
          } else {
              const parent = nodeMap.get(parentPath);
              if (parent && parent.children) {
                  parent.children.push(node);
              }
          }
      });

      const textExtensions = ['.html', '.css', '.js', '.ts', '.tsx', '.json', '.md', '.txt', '.jsx'];
      const fileItems = tree.filter((t: any) => t.type === 'blob' && textExtensions.some(ext => t.path.endsWith(ext)));
      
      let fetchedCount = 0;
      const totalToFetch = fileItems.length;
      
      const batchSize = 5;
      for (let i = 0; i < totalToFetch; i += batchSize) {
          const batch = fileItems.slice(i, i + batchSize);
          await Promise.all(batch.map(async (item: any) => {
              try {
                  const content = await getBlob(token, item.url);
                  const node = nodeMap.get(item.path);
                  if (node) node.content = content;
              } catch (e) {
                  console.error('Failed to load', item.path);
              }
          }));
          fetchedCount += batch.length;
          setStatus(`Downloaded ${Math.min(fetchedCount, totalToFetch)}/${totalToFetch} files`);
      }

      onImport(nodes, repo.name);
      setView('sync');
      setStatus('Repository cloned successfully!');
    } catch (err: any) {
      console.error(err);
      setStatus(`Clone failed: ${err.message}`);
      setActiveRepo(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePush = async () => {
    if (!activeRepo) return;
    setLoading(true);
    setStatus('Starting push...');
    
    // Recursive function to get all files with their computed Git paths
    // This allows us to handle folder structures created locally
    const getFilesToPush = (nodes: FileNode[], parentPath = ''): { file: FileNode, path: string }[] => {
        let result: { file: FileNode, path: string }[] = [];
        nodes.forEach(node => {
            // Build the path: if parentPath exists, append '/', otherwise just name
            const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
            
            if (node.type === 'file') {
                result.push({ file: node, path: currentPath });
            } else if (node.children) {
                result = [...result, ...getFilesToPush(node.children, currentPath)];
            }
        });
        return result;
    };
    
    const allFiles = getFilesToPush(files);
    setPushProgress({ current: 0, total: allFiles.length });
    
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < allFiles.length; i++) {
        const { file, path } = allFiles[i];
        if (typeof file.content !== 'string') continue;
        
        try {
            const res = await updateFile(
                token, 
                activeRepo.owner.login, 
                activeRepo.name, 
                path, // Use the computed path, not the ID
                file.content, 
                file.sha, // If undefined, GitHub creates new. If defined, it updates.
                commitMsg || `Update ${path}`
            );
            
            onUpdateFileNode(file.id, res.content.sha);
            successCount++;
        } catch (e) {
            console.error('Push error', path, e);
            failCount++;
        }
        setPushProgress({ current: i + 1, total: allFiles.length });
    }
    
    setLoading(false);
    setStatus(`Commit & Push complete: ${successCount} files synced.`);
  };

  if (view === 'login') {
    return (
      <div className="h-full flex flex-col p-4 gap-4 bg-vscode-sidebar text-vscode-fg">
        <div className="flex items-center gap-2 text-lg font-bold">
           <Github size={24} />
           <span>GitHub Login</span>
        </div>
        <p className="text-xs text-gray-400">
           Enter a Personal Access Token (Classic) with 'repo' scope.
        </p>
        <input 
           className="bg-vscode-input border border-vscode-border p-2 rounded text-sm outline-none focus:border-vscode-accent text-white"
           placeholder="ghp_..."
           value={token}
           onChange={e => setToken(e.target.value)}
           type="password"
        />
        <button 
           onClick={() => handleLogin(token)}
           disabled={loading || !token}
           className="bg-vscode-accent text-white p-2 rounded flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
        >
            {loading ? <Loader2 className="animate-spin" size={16}/> : <LogIn size={16} />}
            Connect
        </button>
        {status && <p className="text-red-400 text-xs">{status}</p>}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-vscode-sidebar text-vscode-fg">
      {/* Header */}
      <div className="p-3 border-b border-vscode-activity flex justify-between items-center bg-vscode-activity/20">
          <div className="flex items-center gap-2 font-bold text-sm">
             {user && <img src={user.avatar_url} className="w-5 h-5 rounded-full" />}
             <span className="truncate max-w-[120px]">{user?.login}</span>
          </div>
          <button onClick={handleLogout} title="Logout" className="hover:text-white"><LogOut size={14}/></button>
      </div>

      {view === 'sync' && activeRepo && (
          <div className="p-4 bg-vscode-bg/50 border-b border-vscode-activity flex flex-col gap-3">
              <div className="flex items-center gap-2">
                  <GitBranch size={16} className="text-vscode-accent" />
                  <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">{activeRepo.name}</div>
                      <div className="text-[10px] text-gray-400 truncate">{activeRepo.html_url}</div>
                  </div>
              </div>
              
              <div className="flex flex-col gap-2">
                  <input 
                      className="bg-vscode-input border border-vscode-border p-1.5 rounded text-xs text-white placeholder-gray-500 outline-none focus:border-vscode-accent"
                      placeholder="Commit message..."
                      value={commitMsg}
                      onChange={e => setCommitMsg(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button 
                        onClick={() => setView('repos')} 
                        className="flex-1 bg-vscode-input text-xs py-1.5 rounded hover:bg-vscode-hover border border-vscode-border"
                    >
                        Repos
                    </button>
                    <button 
                        onClick={handlePush}
                        disabled={loading}
                        className="flex-1 bg-green-700/80 text-white text-xs py-1.5 rounded hover:bg-green-600 flex items-center justify-center gap-1"
                    >
                        {loading ? <Loader2 size={12} className="animate-spin"/> : <Upload size={12} />}
                        Commit & Push
                    </button>
                  </div>
              </div>

              {status && (
                  <div className={`text-[10px] flex items-center gap-1 ${status.includes('error') || status.includes('failed') ? 'text-red-400' : 'text-green-400'}`}>
                      {status.includes('failed') ? <AlertCircle size={10}/> : <CheckCircle2 size={10}/>}
                      {status}
                  </div>
              )}
               {loading && pushProgress.total > 0 && (
                  <div className="w-full bg-vscode-activity h-1 rounded overflow-hidden">
                      <div 
                        className="bg-green-500 h-full transition-all duration-200"
                        style={{ width: `${(pushProgress.current / pushProgress.total) * 100}%` }}
                      />
                  </div>
              )}
          </div>
      )}

      {/* Repo List */}
      <div className="flex-1 overflow-y-auto">
         {view === 'repos' && (
             <div className="p-2">
                 <div className="flex justify-between items-center px-2 pb-2">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Repositories</div>
                    <button 
                        onClick={() => setShowCreateForm(!showCreateForm)}
                        className="p-1 hover:bg-vscode-hover rounded text-vscode-accent"
                        title="Create New Repo"
                    >
                        <Plus size={16} />
                    </button>
                 </div>

                 {/* Create Repo Form */}
                 {showCreateForm && (
                     <div className="mx-2 mb-3 p-3 bg-vscode-activity rounded border border-vscode-border flex flex-col gap-2">
                         <div className="flex justify-between items-center text-xs font-bold">
                             <span>New Repository</span>
                             <button onClick={() => setShowCreateForm(false)}><X size={12}/></button>
                         </div>
                         <input 
                            className="bg-vscode-input border border-vscode-border p-1.5 rounded text-xs text-white outline-none"
                            placeholder="Repository Name"
                            value={newRepoName}
                            onChange={e => setNewRepoName(e.target.value)}
                         />
                         <div className="flex items-center gap-2 text-xs cursor-pointer" onClick={() => setIsPrivate(!isPrivate)}>
                             <div className={`w-3 h-3 border border-gray-400 rounded-sm ${isPrivate ? 'bg-vscode-accent border-vscode-accent' : ''}`} />
                             <span>Private Repository</span>
                         </div>
                         <button 
                            onClick={handleCreateRepo}
                            disabled={loading || !newRepoName}
                            className="bg-vscode-accent text-white py-1 rounded text-xs mt-1 disabled:opacity-50"
                         >
                            {loading ? 'Creating...' : 'Create Repository'}
                         </button>
                     </div>
                 )}

                 {repos.map(repo => (
                     <div 
                        key={repo.id}
                        onClick={() => handleClone(repo)}
                        className="flex items-center gap-2 p-2 hover:bg-vscode-hover cursor-pointer rounded-sm group"
                     >
                        <div className="bg-vscode-activity p-1.5 rounded">
                            {repo.private ? <Lock size={12} className="text-yellow-500"/> : <Globe size={12} className="text-gray-400"/>}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm truncate font-medium">{repo.name}</div>
                            <div className="text-[10px] text-gray-500">{repo.default_branch} • {new Date(repo.updated_at).toLocaleDateString()}</div>
                        </div>
                        <button className="opacity-0 group-hover:opacity-100 text-vscode-accent">
                            <Download size={14} />
                        </button>
                     </div>
                 ))}
             </div>
         )}
         
         {loading && view === 'repos' && (
             <div className="flex flex-col items-center justify-center pt-10 text-gray-500 gap-2">
                 <Loader2 className="animate-spin" />
                 <span className="text-xs">{status || 'Loading...'}</span>
             </div>
         )}
      </div>
    </div>
  );
};

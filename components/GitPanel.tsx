
import React, { useState, useEffect } from 'react';
import { Github, LogIn, Download, Upload, LogOut, Loader2, GitBranch, AlertCircle, CheckCircle2, Plus, Lock, Globe, X, Link as LinkIcon, Unplug } from 'lucide-react';
import { validateToken, getUserRepos, getRepoTree, getBlob, updateFile, createRepo } from '../services/githubService';
import { FileNode, RepoConfig } from '../types';

interface GitPanelProps {
  files: FileNode[];
  onImport: (nodes: FileNode[], repoName: string) => void;
  onUpdateFileNode: (id: string, sha: string) => void;
  repoConfig: RepoConfig | null;
  onSetRepoConfig: (config: RepoConfig | null) => void;
  onSetGlobalLoading: (isLoading: boolean) => void;
}

export const GitPanel: React.FC<GitPanelProps> = ({ 
  files, 
  onImport, 
  onUpdateFileNode, 
  repoConfig, 
  onSetRepoConfig,
  onSetGlobalLoading
}) => {
  const [token, setToken] = useState(localStorage.getItem('gh_token') || '');
  const [user, setUser] = useState<any>(null);
  const [repos, setRepos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'login' | 'repos' | 'sync'>(
      !localStorage.getItem('gh_token') ? 'login' : (repoConfig ? 'sync' : 'repos')
  );
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

  // Effect to switch to sync view if repoConfig is externally set (e.g., after Clone)
  useEffect(() => {
      if (repoConfig && token) {
          setView('sync');
      }
  }, [repoConfig, token]);

  const handleLogin = async (inputToken: string, isAuto = false) => {
    setLoading(true);
    onSetGlobalLoading(true);
    setStatus('');
    try {
      const userData = await validateToken(inputToken);
      setUser(userData);
      localStorage.setItem('gh_token', inputToken);
      setToken(inputToken);
      
      const reposData = await getUserRepos(inputToken);
      setRepos(reposData);
      
      // If we already have a linked repo, go to sync, else list
      if (repoConfig) setView('sync');
      else setView('repos');

    } catch (err) {
      if (!isAuto) setStatus('Invalid Token');
      else if (isAuto) {
          // If auto login fails, clear everything
          localStorage.removeItem('gh_token');
          setToken('');
      }
    } finally {
      setLoading(false);
      onSetGlobalLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('gh_token');
    setToken('');
    setUser(null);
    setRepos([]);
    onSetRepoConfig(null);
    setView('login');
  };

  const handleCreateRepo = async () => {
      if (!newRepoName.trim()) return;
      setLoading(true);
      onSetGlobalLoading(true);
      try {
          const hasFiles = files.length > 0;
          const newRepo = await createRepo(token, newRepoName, isPrivate, !hasFiles);
          
          setRepos(prev => [newRepo, ...prev]);
          
          onSetRepoConfig({
             owner: newRepo.owner.login,
             name: newRepo.name,
             branch: newRepo.default_branch,
             html_url: newRepo.html_url,
             private: newRepo.private
          });

          setShowCreateForm(false);
          setNewRepoName('');
          setView('sync');
          setStatus('Repository created! Ready to push.');
      } catch (err: any) {
          setStatus(`Error: ${err.message}`);
      } finally {
          setLoading(false);
          onSetGlobalLoading(false);
      }
  };

  const handleClone = async (repo: any) => {
    if (!confirm('This will overwrite your current local files. Continue?')) return;
    
    setLoading(true);
    onSetGlobalLoading(true);
    setStatus('Fetching file structure...');
    
    try {
      const treeData = await getRepoTree(token, repo.owner.login, repo.name, repo.default_branch);
      const tree = treeData.tree;
      
      setStatus(`Downloading ${tree.length} files...`);

      const nodes: FileNode[] = [];
      const nodeMap = new Map<string, FileNode>();

      // Structure parsing logic...
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

      const textExtensions = ['.html', '.css', '.js', '.ts', '.tsx', '.json', '.md', '.txt', '.jsx', '.svg'];
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

      onSetRepoConfig({
         owner: repo.owner.login,
         name: repo.name,
         branch: repo.default_branch,
         html_url: repo.html_url,
         private: repo.private
      });

      onImport(nodes, repo.name);
      // Note: Component likely unmounts here as sideBar switches to 'explorer'
      // But repoConfig is now persisted in App, so returning later will show 'sync' view.
    } catch (err: any) {
      console.error(err);
      setStatus(`Clone failed: ${err.message}`);
    } finally {
      setLoading(false);
      onSetGlobalLoading(false);
    }
  };

  const handleLink = (repo: any) => {
      onSetRepoConfig({
         owner: repo.owner.login,
         name: repo.name,
         branch: repo.default_branch,
         html_url: repo.html_url,
         private: repo.private
      });
      setView('sync');
      setStatus('Linked. Ready to push local files.');
  };

  const handleUnlink = () => {
      if (confirm('Disconnect from this repository? Local files will remain.')) {
          onSetRepoConfig(null);
          setView('repos');
      }
  };

  const handlePush = async () => {
    if (!repoConfig) return;
    setLoading(true);
    onSetGlobalLoading(true);
    setStatus('Preparing push...');
    
    try {
        let remoteFileMap = new Map<string, string>();
        try {
            const treeData = await getRepoTree(token, repoConfig.owner, repoConfig.name, repoConfig.branch || 'main');
            treeData.tree.forEach((item: any) => {
                if (item.type === 'blob') remoteFileMap.set(item.path, item.sha);
            });
        } catch (e) {
            console.log("Empty repo or branch not found, assuming fresh push.");
        }

        const getFilesToPush = (nodes: FileNode[], parentPath = ''): { file: FileNode, path: string }[] => {
            let result: { file: FileNode, path: string }[] = [];
            nodes.forEach(node => {
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
            
            const shaToUse = remoteFileMap.get(path) || file.sha;

            try {
                const res = await updateFile(
                    token, 
                    repoConfig.owner, 
                    repoConfig.name, 
                    path, 
                    file.content, 
                    shaToUse,
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
        
        setStatus(`Push complete: ${successCount} sent, ${failCount} failed.`);
    } catch (e: any) {
        setStatus(`Push failed: ${e.message}`);
    } finally {
        setLoading(false);
        onSetGlobalLoading(false);
    }
  };

  if (view === 'login') {
    return (
      <div className="h-full flex flex-col p-4 gap-4 bg-vscode-sidebar text-vscode-fg animate-fade-in">
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
           className="bg-vscode-accent text-white p-2 rounded flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all active:scale-95"
        >
            {loading ? <Loader2 className="animate-spin" size={16}/> : <LogIn size={16} />}
            Connect
        </button>
        {status && <p className="text-red-400 text-xs animate-fade-in">{status}</p>}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-vscode-sidebar text-vscode-fg animate-fade-in">
      {/* Header */}
      <div className="p-3 border-b border-vscode-activity flex justify-between items-center bg-vscode-activity/20">
          <div className="flex items-center gap-2 font-bold text-sm">
             {user && <img src={user.avatar_url} className="w-5 h-5 rounded-full" />}
             <span className="truncate max-w-[120px]">{user?.login}</span>
          </div>
          <button onClick={handleLogout} title="Logout" className="hover:text-white transition-colors"><LogOut size={14}/></button>
      </div>

      {view === 'sync' && repoConfig && (
          <div className="flex-1 flex flex-col animate-slide-in-right">
              <div className="p-4 bg-vscode-bg/50 border-b border-vscode-activity flex flex-col gap-3">
                <div className="flex items-center gap-2">
                    <GitBranch size={16} className="text-vscode-accent" />
                    <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate">{repoConfig.name}</div>
                        <div className="text-[10px] text-gray-400 truncate">{repoConfig.html_url}</div>
                    </div>
                    <button onClick={handleUnlink} className="text-xs bg-vscode-input px-2 py-1 rounded hover:text-red-400 flex items-center gap-1 transition-colors" title="Disconnect">
                        <Unplug size={12} />
                    </button>
                </div>
                
                <div className="flex flex-col gap-2 mt-2">
                    <label className="text-[10px] uppercase text-gray-500 font-bold">Sync Changes</label>
                    <input 
                        className="bg-vscode-input border border-vscode-border p-2 rounded text-xs text-white placeholder-gray-500 outline-none focus:border-vscode-accent"
                        placeholder="Commit message (e.g. Fixed bug)"
                        value={commitMsg}
                        onChange={e => setCommitMsg(e.target.value)}
                    />
                    <button 
                        onClick={handlePush}
                        disabled={loading}
                        className="w-full bg-green-700/80 text-white text-sm py-2 rounded hover:bg-green-600 flex items-center justify-center gap-2 font-bold shadow-md active:scale-95 transition-all"
                    >
                        {loading ? <Loader2 size={14} className="animate-spin"/> : <Upload size={14} />}
                        Push Local Files
                    </button>
                </div>

                {status && (
                    <div className={`text-[11px] p-2 rounded bg-vscode-input border border-vscode-border flex items-center gap-2 animate-fade-in ${status.includes('error') || status.includes('failed') ? 'text-red-400' : 'text-green-400'}`}>
                        {status.includes('failed') ? <AlertCircle size={12}/> : <CheckCircle2 size={12}/>}
                        <span className="flex-1 break-words">{status}</span>
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
              <div className="flex-1 p-4 text-xs text-gray-500 overflow-y-auto">
                   <p className="mb-2"><strong>Connected to:</strong> <span className="text-white">{repoConfig.name}</span></p>
                   <p className="mb-2">Changes made in the editor will be pushed to this repository.</p>
              </div>
          </div>
      )}

      {/* Repo List */}
      <div className="flex-1 overflow-y-auto">
         {view === 'repos' && (
             <div className="p-2 animate-slide-in-right">
                 <div className="flex justify-between items-center px-2 pb-2">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Repositories</div>
                    <button 
                        onClick={() => setShowCreateForm(!showCreateForm)}
                        className="p-1 hover:bg-vscode-hover rounded text-vscode-accent flex items-center gap-1 text-[10px] transition-colors"
                        title="Create New Repo"
                    >
                        <Plus size={14} /> New
                    </button>
                 </div>

                 {/* Create Repo Form */}
                 {showCreateForm && (
                     <div className="mx-2 mb-3 p-3 bg-vscode-activity rounded border border-vscode-border flex flex-col gap-2 shadow-lg animate-scale-in">
                         <div className="flex justify-between items-center text-xs font-bold">
                             <span>Create Repository</span>
                             <button onClick={() => setShowCreateForm(false)} className="hover:text-white"><X size={12}/></button>
                         </div>
                         <input 
                            className="bg-vscode-input border border-vscode-border p-1.5 rounded text-xs text-white outline-none"
                            placeholder="my-new-project"
                            value={newRepoName}
                            onChange={e => setNewRepoName(e.target.value)}
                         />
                         <div className="flex items-center gap-2 text-xs cursor-pointer select-none" onClick={() => setIsPrivate(!isPrivate)}>
                             <div className={`w-3 h-3 border border-gray-400 rounded-sm flex items-center justify-center transition-colors ${isPrivate ? 'bg-vscode-accent border-vscode-accent' : ''}`}>
                                 {isPrivate && <div className="w-1.5 h-1.5 bg-white rounded-sm" />}
                             </div>
                             <span>Private</span>
                         </div>
                         <button 
                            onClick={handleCreateRepo}
                            disabled={loading || !newRepoName}
                            className="bg-vscode-accent text-white py-1.5 rounded text-xs mt-1 disabled:opacity-50 font-bold active:scale-95 transition-all"
                         >
                            {loading ? 'Creating...' : 'Create & Link'}
                         </button>
                     </div>
                 )}

                 {repos.map((repo, idx) => (
                     <div 
                        key={repo.id}
                        className="flex flex-col gap-2 p-2 hover:bg-vscode-hover rounded-sm group border-b border-transparent hover:border-vscode-activity transition-all animate-fade-in"
                        style={{ animationDelay: `${idx * 0.05}s` }}
                     >
                        <div className="flex items-center gap-2">
                            <div className="bg-vscode-activity p-1.5 rounded text-gray-400">
                                {repo.private ? <Lock size={12} className="text-yellow-500"/> : <Globe size={12}/>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm truncate font-medium text-gray-200">{repo.name}</div>
                                <div className="text-[10px] text-gray-500">{new Date(repo.updated_at).toLocaleDateString()}</div>
                            </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex gap-2 pl-8">
                            <button 
                                onClick={() => handleLink(repo)}
                                className="flex-1 text-[10px] bg-vscode-input hover:bg-vscode-accent hover:text-white py-1 px-2 rounded flex items-center justify-center gap-1 transition-colors active:scale-95"
                                title="Use this repo for current files"
                            >
                                <LinkIcon size={10} /> Link (Push)
                            </button>
                            <button 
                                onClick={() => handleClone(repo)}
                                className="flex-1 text-[10px] bg-vscode-input hover:bg-vscode-accent hover:text-white py-1 px-2 rounded flex items-center justify-center gap-1 transition-colors active:scale-95"
                                title="Overwrite local with repo files"
                            >
                                <Download size={10} /> Clone (Pull)
                            </button>
                        </div>
                     </div>
                 ))}
             </div>
         )}
         
         {loading && view === 'repos' && (
             <div className="flex flex-col items-center justify-center pt-10 text-gray-500 gap-2 animate-fade-in">
                 <Loader2 className="animate-spin" />
                 <span className="text-xs">{status || 'Loading...'}</span>
             </div>
         )}
      </div>
    </div>
  );
};

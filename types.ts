export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  content?: string; // Only for files
  language?: 'html' | 'css' | 'javascript';
  children?: FileNode[]; // Only for folders
  isOpen?: boolean; // For folders
  handle?: any; // FileSystemHandle (FileSystemFileHandle | FileSystemDirectoryHandle)
  sha?: string; // GitHub blob SHA
  path?: string; // GitHub file path
}

export type TabView = 'editor' | 'preview' | 'files';

export interface Suggestion {
  label: string;
  value: string;
  type: 'tag' | 'property' | 'keyword' | 'snippet' | 'emmet';
  detail?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface RepoConfig {
  owner: string;
  name: string;
  branch: string;
  html_url: string;
  private: boolean;
}

export interface EditorSettings {
  fontSize: number;
  wordWrap: boolean;
  lineNumbers: boolean;
  autoSave: boolean;
}

export interface Command {
  id: string;
  label: string;
  action: () => void;
  shortcut?: string;
}

export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  content?: string; // Only for files
  language?: 'html' | 'css' | 'javascript';
  children?: FileNode[]; // Only for folders
  isOpen?: boolean; // For folders
  handle?: any; // FileSystemHandle (FileSystemFileHandle | FileSystemDirectoryHandle)
}

export type TabView = 'editor' | 'preview' | 'files';

export interface Suggestion {
  label: string;
  value: string;
  type: 'tag' | 'property' | 'keyword' | 'snippet' | 'emmet';
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
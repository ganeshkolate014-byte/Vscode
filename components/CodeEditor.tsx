import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markup'; 
if (typeof window !== 'undefined' && Prism.languages.markup) {
    Prism.languages.html = Prism.languages.markup;
}

import { Suggestion, EditorSettings, FileNode } from '../types';
import { expandAbbreviation, extractAbbreviation } from '../services/emmetService';
import { formatCode } from '../services/formattingService';
import { MobileToolbar } from './MobileToolbar';
import { Search, ArrowUp, ArrowDown, X, Wrench, Code2, Hash, Box, Type, LayoutTemplate, FileCode } from 'lucide-react';

interface CodeEditorProps {
  code: string;
  language: 'html' | 'css' | 'javascript';
  onChange: (newCode: string) => void;
  readOnly?: boolean;
  settings?: EditorSettings;
  contextHtml?: string;
  files?: FileNode[];
  
  // Custom Suggestions Props
  htmlTags: Suggestion[];
  htmlAttributes: Suggestion[];
  cssProps: Suggestion[];
  jsKeywords: Suggestion[];
}

const DEFAULT_SETTINGS: EditorSettings = {
    fontSize: 14,
    wordWrap: false,
    lineNumbers: true,
    autoSave: true
};

const getIndentLevel = (line: string) => {
    if (!line.trim()) return -1;
    let spaces = 0;
    for (const char of line) {
        if (char === ' ') spaces++;
        else if (char === '\t') spaces += 2;
        else break;
    }
    return Math.floor(spaces / 2);
};

const extractCssSelectors = (html: string): Suggestion[] => {
    const suggestions: Suggestion[] = [];
    const idSet = new Set<string>();
    const classSet = new Set<string>();
    const tagSet = new Set<string>();

    const idRegex = /id=["']([^"']+)["']/g;
    const classRegex = /class=["']([^"']+)["']/g;
    const tagRegex = /<([a-z0-9-]+)/gi; 

    let match;
    while ((match = idRegex.exec(html)) !== null) {
        if(match[1]) idSet.add(match[1]);
    }
    while ((match = classRegex.exec(html)) !== null) {
        if(match[1]) {
            const classes = match[1].split(/\s+/);
            classes.forEach(c => c && classSet.add(c));
        }
    }
    while ((match = tagRegex.exec(html)) !== null) {
        if(match[1]) tagSet.add(match[1]);
    }

    idSet.forEach(id => {
        suggestions.push({
            label: `#${id}`,
            value: `#${id} {\n\t$0\n}`,
            type: 'keyword',
            detail: 'ID Selector'
        });
    });

    classSet.forEach(cls => {
        suggestions.push({
            label: `.${cls}`,
            value: `.${cls} {\n\t$0\n}`,
            type: 'keyword',
            detail: 'Class Selector'
        });
    });

    tagSet.forEach(tag => {
        suggestions.push({
            label: tag,
            value: `${tag} {\n\t$0\n}`,
            type: 'tag',
            detail: 'Tag Selector'
        });
    });

    return suggestions;
};

// Flatten file tree to relative paths
const getAllFilePaths = (nodes: FileNode[], prefix = ''): string[] => {
    let results: string[] = [];
    nodes.forEach(node => {
        const path = prefix ? `${prefix}/${node.name}` : node.name;
        if (node.type === 'file') {
            results.push(path);
        }
        if (node.children) {
            results = [...results, ...getAllFilePaths(node.children, path)];
        }
    });
    return results;
};

const getSuggestionIcon = (type: Suggestion['type']) => {
    switch (type) {
        case 'emmet':
            return <Wrench size={14} className="text-gray-300" />;
        case 'snippet':
            return <LayoutTemplate size={14} className="text-gray-300" />;
        case 'tag':
            return <Code2 size={14} className="text-gray-300" />;
        case 'property':
            return <Hash size={14} className="text-gray-300" />;
        case 'keyword':
            return <Box size={14} className="text-gray-300" />;
        case 'file' as any: 
            return <FileCode size={14} className="text-yellow-400" />;
        default:
            return <Type size={14} className="text-gray-300" />;
    }
};

export const CodeEditor: React.FC<CodeEditorProps> = ({ 
    code, 
    language, 
    onChange, 
    readOnly = false,
    settings = DEFAULT_SETTINGS,
    contextHtml,
    files = [],
    htmlTags,
    htmlAttributes,
    cssProps,
    jsKeywords
}) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [cursorXY, setCursorXY] = useState({ top: 0, left: 0 });
  const [suggestionPlacement, setSuggestionPlacement] = useState<'top' | 'bottom'>('bottom');
  const [charSize, setCharSize] = useState({ width: 0, height: 0 });
  const [activeLineIndex, setActiveLineIndex] = useState(0);
  
  // Search State
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchMatches, setSearchMatches] = useState<number[]>([]);
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nextCursorPosRef = useRef<number | null>(null); 
  
  const historyRef = useRef<string[]>([code]);
  const historyPointer = useRef<number>(0);

  const lineHeight = Math.round(settings.fontSize * 1.25);

  const allProjectFiles = useMemo(() => getAllFilePaths(files), [files]);

  const measureChar = () => {
      const span = document.createElement('span');
      span.style.fontFamily = '"Fira Code", monospace';
      span.style.fontSize = `${settings.fontSize}px`;
      span.style.lineHeight = `${lineHeight}px`; 
      span.style.visibility = 'hidden';
      span.style.position = 'absolute';
      span.textContent = 'M'; 
      document.body.appendChild(span);
      const rect = span.getBoundingClientRect();
      setCharSize({ width: rect.width, height: rect.height }); 
      document.body.removeChild(span);
  };

  useEffect(() => {
      measureChar();
      window.addEventListener('resize', measureChar);
      return () => window.removeEventListener('resize', measureChar);
  }, [settings.fontSize]);

  // --- Search Logic ---
  useEffect(() => {
      if (!searchTerm) {
          setSearchMatches([]);
          setCurrentMatchIdx(0);
          return;
      }
      
      const indices: number[] = [];
      const lowerCode = code.toLowerCase();
      const lowerTerm = searchTerm.toLowerCase();
      
      let pos = lowerCode.indexOf(lowerTerm);
      while (pos !== -1) {
          indices.push(pos);
          pos = lowerCode.indexOf(lowerTerm, pos + 1);
      }
      
      setSearchMatches(indices);
      
      if (indices.length > 0) {
          const currentPos = textareaRef.current?.selectionStart || 0;
          const nextMatch = indices.findIndex(idx => idx >= currentPos);
          setCurrentMatchIdx(nextMatch !== -1 ? nextMatch : 0);
      } else {
          setCurrentMatchIdx(0);
      }
  }, [searchTerm, code]);

  useEffect(() => {
     if (showSearch && searchInputRef.current) {
         searchInputRef.current.focus();
     }
  }, [showSearch]);

  const jumpToMatch = (idx: number) => {
      if (searchMatches.length === 0 || !textareaRef.current || !containerRef.current) return;
      
      let newIdx = idx;
      if (newIdx < 0) newIdx = searchMatches.length - 1;
      if (newIdx >= searchMatches.length) newIdx = 0;
      
      setCurrentMatchIdx(newIdx);
      
      const startPos = searchMatches[newIdx];
      const endPos = startPos + searchTerm.length;
      
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(startPos, endPos);
      
      const textBefore = code.substring(0, startPos);
      const lines = textBefore.split('\n');
      const lineNum = lines.length - 1;
      
      const targetScrollTop = (lineNum * lineHeight) - (containerRef.current.clientHeight / 2) + (lineHeight / 2);
      containerRef.current.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
      
      setActiveLineIndex(lineNum);
  };

  const handleNextMatch = () => jumpToMatch(currentMatchIdx + 1);
  const handlePrevMatch = () => jumpToMatch(currentMatchIdx - 1);

  const highlightedCode = useMemo(() => {
      try {
          let grammar = Prism.languages[language];
          if (!grammar) {
             if (language === 'html') grammar = Prism.languages.markup || Prism.languages.html;
             if (language === 'javascript') grammar = Prism.languages.javascript || Prism.languages.js;
             if (language === 'css') grammar = Prism.languages.css;
          }
          if (!grammar) grammar = Prism.languages.markup;
          if (!code) return '<br />';
          return Prism.highlight(code, grammar, language) + '<br />';
      } catch (e) {
          return code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") + '<br />';
      }
  }, [code, language]);

  const indentGuidesPath = useMemo(() => {
    if (!code || charSize.width === 0) return '';
    
    const lines = code.split('\n');
    const tabWidth = 2 * charSize.width;
    const paths: string[] = [];
    
    const depths = lines.map(line => getIndentLevel(line));
    const maxDepth = Math.max(...depths, 0) + 1;
    
    for (let level = 1; level < maxDepth; level++) {
        let active = false;
        let startLine = 0;
        const x = (level - 1) * tabWidth;
        
        for (let i = 0; i < lines.length; i++) {
            const d = depths[i];
            const isCovered = d >= level || (d === -1 && active);
            
            if (isCovered) {
                if (!active) {
                    active = true;
                    startLine = i;
                }
            } else {
                if (active) {
                    active = false;
                    paths.push(`M${x},${startLine * lineHeight} V${i * lineHeight}`);
                }
            }
        }
        if (active) {
            paths.push(`M${x},${startLine * lineHeight} V${lines.length * lineHeight}`);
        }
    }
    return paths.join(' ');
  }, [code, charSize.width, lineHeight]);

  useLayoutEffect(() => {
    if (nextCursorPosRef.current !== null && textareaRef.current) {
      const pos = nextCursorPosRef.current;
      textareaRef.current.setSelectionRange(pos, pos);
      nextCursorPosRef.current = null;
      ensureCursorVisible();
      updateCursorPosition();
    }
  }, [code]);

  useEffect(() => {
     if (code !== historyRef.current[historyPointer.current]) {
         const nextPtr = historyPointer.current + 1;
         historyRef.current = [...historyRef.current.slice(0, nextPtr), code];
         historyPointer.current = nextPtr;
     }
  }, [code]);

  const ensureCursorVisible = () => {
    if (!textareaRef.current || !containerRef.current) return;
    
    const { selectionEnd, value } = textareaRef.current;
    const textBefore = value.substring(0, selectionEnd);
    const lines = textBefore.split('\n');
    const lineNo = lines.length;
    
    const cursorTop = (lineNo - 1) * lineHeight + 20; 
    const cursorBottom = cursorTop + lineHeight;
    
    const container = containerRef.current;
    const { scrollTop, clientHeight } = container;
    
    if (cursorTop < scrollTop) {
        container.scrollTop = cursorTop - 20;
    } else if (cursorBottom > scrollTop + clientHeight - 40) {
        container.scrollTop = cursorBottom - clientHeight + 40;
    }
  };

  const updateCursorPosition = () => {
      if (!textareaRef.current || charSize.width === 0) return;
      
      const { selectionEnd, value } = textareaRef.current;
      
      const textUpToCursor = value.substring(0, selectionEnd);
      const lines = textUpToCursor.split('\n');
      const row = lines.length; 
      const col = lines[lines.length - 1].length;

      setActiveLineIndex(row - 1);

      const top = (row * lineHeight) - lineHeight + 20; 
      const left = (col * charSize.width) + (settings.lineNumbers ? 40 : 20);
      
      setCursorXY({ top, left });

      if (containerRef.current) {
         const container = containerRef.current;
         const cursorVisualTop = top - container.scrollTop;
         setSuggestionPlacement(cursorVisualTop > container.clientHeight / 2 ? 'top' : 'bottom');
      }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChange(val);
    
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    
    updateCursorPosition();
    
    let newSuggestions: Suggestion[] = [];
    
    const attrMatch = textBeforeCursor.match(/(src|href)=["']([^"']*)$/);

    if (attrMatch) {
        const attrType = attrMatch[1];
        const partialPath = attrMatch[2];
        const lowerPartial = partialPath.toLowerCase();

        const validExtensions = attrType === 'src' 
            ? ['.js', '.png', '.jpg', '.svg', '.mp4', '.mp3'] 
            : ['.css', '.html'];
        
        const matchingFiles = allProjectFiles.filter(path => {
            const hasValidExt = validExtensions.some(ext => path.endsWith(ext));
            return hasValidExt && path.toLowerCase().startsWith(lowerPartial);
        });

        matchingFiles.forEach(path => {
            newSuggestions.push({
                label: path,
                value: path,
                type: 'file' as any,
                detail: attrType === 'src' ? 'Source File' : 'Link Target'
            });
        });

    } else {
        let delimiterRegex = /[\s<>{}().,;:'"]+/;
        if (language === 'css') {
            delimiterRegex = /[\s{}:;'"()]+/;
        }
        const words = textBeforeCursor.split(delimiterRegex);
        const currentWord = words[words.length - 1];

        if (currentWord.length > 1 && language === 'html') {
             const lowerWord = currentWord.toLowerCase();
             allProjectFiles.forEach(path => {
                 if (path.toLowerCase().includes(lowerWord)) {
                     if (path.endsWith('.js')) {
                         newSuggestions.push({
                             label: `script:${path}`,
                             value: `<script src="${path}"></script>`,
                             type: 'snippet',
                             detail: 'Import JS File'
                         });
                     }
                     if (path.endsWith('.css')) {
                         newSuggestions.push({
                             label: `link:${path}`,
                             value: `<link rel="stylesheet" href="${path}" />`,
                             type: 'snippet',
                             detail: 'Import CSS File'
                         });
                     }
                 }
             });
        }

        if (language === 'html') {
            const potentialAbbr = extractAbbreviation(textBeforeCursor);
            if (potentialAbbr && potentialAbbr.length > 0) {
                const emmetResult = expandAbbreviation(potentialAbbr);
                if (emmetResult) {
                     newSuggestions.push({ label: potentialAbbr, value: emmetResult, type: 'emmet', detail: 'Emmet Abbreviation' });
                }
            }
        }

        if (currentWord.length > 0) {
            let source: Suggestion[] = [];
            
            if (language === 'html') {
                const lastOpenBracket = textBeforeCursor.lastIndexOf('<');
                const lastCloseBracket = textBeforeCursor.lastIndexOf('>');
                
                if (lastOpenBracket > lastCloseBracket) {
                    const tagContent = textBeforeCursor.slice(lastOpenBracket + 1);
                    if (tagContent.includes(' ')) {
                        source = htmlAttributes; // Use prop
                    } else {
                        source = htmlTags; // Use prop
                    }
                } else {
                    source = htmlTags; // Use prop
                }
            }
            else if (language === 'css') {
                source = [...cssProps]; // Use prop
                if (contextHtml) {
                    const htmlSuggestions = extractCssSelectors(contextHtml);
                    source = [...htmlSuggestions, ...source];
                }
            }
            else if (language === 'javascript') source = jsKeywords; // Use prop
            
            // Filter Matches
            const matches = source.filter(s => s.label.toLowerCase().includes(currentWord.toLowerCase()));
            
            // Smart Sorting: Exact -> Starts With -> Alphabetical
            matches.sort((a, b) => {
                const curr = currentWord.toLowerCase();
                const aLab = a.label.toLowerCase();
                const bLab = b.label.toLowerCase();
                
                // 1. Exact matches top
                if (aLab === curr && bLab !== curr) return -1;
                if (bLab === curr && aLab !== curr) return 1;
                
                // 2. Starts with matches next
                const aStarts = aLab.startsWith(curr);
                const bStarts = bLab.startsWith(curr);
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;
                
                // 3. Alphabetical fallback
                return aLab.localeCompare(bLab);
            });

            matches.forEach(m => { if (!newSuggestions.find(s => s.label === m.label)) newSuggestions.push(m); });
        }
    }

    if (newSuggestions.length > 0) {
        setSuggestions(newSuggestions);
        setSelectedIdx(0);
    } else {
        setSuggestions([]);
    }
  };

  const insertSuggestion = (suggestion: Suggestion) => {
    if (!textareaRef.current) return;
    const val = textareaRef.current.value;
    const cursorPos = textareaRef.current.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    
    let insertion = suggestion.value;
    let before = "";
    let after = "";
    
    let charsToDelete = 0;
    
    const attrMatch = textBeforeCursor.match(/(src|href)=["']([^"']*)$/);
    
    if (attrMatch && (suggestion.type === 'file' as any)) {
         charsToDelete = attrMatch[2].length;
    } else if (suggestion.type === 'emmet') {
         charsToDelete = extractAbbreviation(textBeforeCursor).length;
    } else {
        let delimiterRegex = /[\s<>{}().,;:'"]+/;
        if (language === 'css') {
            delimiterRegex = /[\s{}:;'"()]+/;
        }
        const words = textBeforeCursor.split(delimiterRegex);
        charsToDelete = words[words.length - 1].length;
    }
    
    before = val.substring(0, cursorPos - charsToDelete);
    after = val.substring(cursorPos);
    
    if (language === 'html' && insertion.startsWith('<') && before.trimEnd().endsWith('<')) {
        const lastOpenBracket = before.lastIndexOf('<');
        if (lastOpenBracket !== -1) before = before.substring(0, lastOpenBracket);
    }
    
    const cursorMarkerIndex = insertion.indexOf('$0');
    let finalValue = "";
    let newCursorPos = 0;

    if (cursorMarkerIndex !== -1) {
        const cleanInsertion = insertion.replace(/\$0/g, ''); 
        finalValue = before + cleanInsertion + after;
        newCursorPos = before.length + cursorMarkerIndex;
    } else {
        finalValue = before + insertion + after;
        newCursorPos = before.length + insertion.length;
    }
    
    onChange(finalValue);
    setSuggestions([]);
    nextCursorPosRef.current = newCursorPos;
    textareaRef.current.focus();
  };

  const handleFormat = async () => {
    const formatted = await formatCode(code, language);
    onChange(formatted);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
        return;
    }

    if (e.shiftKey && e.altKey && e.code === 'KeyF') {
        e.preventDefault();
        handleFormat();
        return;
    }

    if (suggestions.length > 0) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIdx(prev => (prev + 1) % suggestions.length);
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIdx(prev => (prev - 1 + suggestions.length) % suggestions.length);
            return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            insertSuggestion(suggestions[selectedIdx]);
            return;
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            setSuggestions([]);
            return;
        }
    }

    const { selectionStart, selectionEnd, value } = e.currentTarget;
    if (e.key === 'Tab') {
      e.preventDefault();
      const newValue = value.substring(0, selectionStart) + '  ' + value.substring(selectionEnd);
      onChange(newValue);
      nextCursorPosRef.current = selectionStart + 2;
    } 
    else if (e.key === 'Enter') {
      e.preventDefault();
      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      const textBeforeCursor = value.substring(0, selectionStart);
      const currentLine = textBeforeCursor.substring(lineStart);
      const match = currentLine.match(/^\s*/);
      const currentIndent = match ? match[0] : '';
      
      const charBefore = value[selectionStart - 1];
      const charAfter = value[selectionStart];
      
      let insertion = '\n' + currentIndent;
      let extraOffset = 0;

      if ((charBefore === '{' && charAfter === '}') || (charBefore === '(' && charAfter === ')') || (charBefore === '[' && charAfter === ']')) {
         insertion += '  \n' + currentIndent;
         extraOffset = currentIndent.length + 3;
      } else if (['{', '(', '[', ':'].includes(charBefore) || (language === 'html' && textBeforeCursor.trim().endsWith('>'))) {
         insertion += '  ';
         extraOffset = currentIndent.length + 3;
      } else {
         extraOffset = insertion.length;
      }
      
      const newValue = value.substring(0, selectionStart) + insertion + value.substring(selectionEnd);
      onChange(newValue);
      nextCursorPosRef.current = selectionStart + extraOffset;
    }
  };

  const handleToolbarInsert = (text: string) => {
      if (!textareaRef.current) return;
      const val = textareaRef.current.value;
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      let insertion = text;
      let finalPos = start + text.length;
      if (start !== end) { 
         const sel = val.substring(start, end);
         if (['"', "'", '(', '{', '['].includes(text)) {
            const closing = text === '(' ? ')' : text === '{' ? '}' : text === '[' ? ']' : text;
            insertion = text + sel + closing;
            finalPos = end + 2;
         }
      } else {
          if (['(', '{', '['].includes(text)) {
              const closing = text === '(' ? ')' : text === '{' ? '}' : ']';
              insertion = text + closing;
              finalPos = start + 1;
          } else if (['"', "'", '`'].includes(text)) {
              insertion = text + text;
              finalPos = start + 1;
          }
      }
      onChange(val.substring(0, start) + insertion + val.substring(end));
      nextCursorPosRef.current = finalPos;
      textareaRef.current.focus();
  };

  const commonStyle: React.CSSProperties = {
    fontFamily: '"Fira Code", monospace',
    fontSize: `${settings.fontSize}px`,
    lineHeight: `${lineHeight}px`,
    padding: settings.lineNumbers ? '20px 20px 20px 40px' : '20px',
    margin: 0,
    border: 0,
    whiteSpace: settings.wordWrap ? 'pre-wrap' : 'pre',
    wordWrap: settings.wordWrap ? 'break-word' : 'normal',
    overflowWrap: 'anywhere',
    tabSize: 2,
    boxSizing: 'border-box',
    textTransform: 'none'
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-vscode-bg">
      {/* Search Widget */}
      {showSearch && (
          <div className="absolute top-2 right-2 z-50 flex items-center bg-[#252526] p-1 rounded shadow-xl border border-[#454545] animate-scale-in">
             <div className="relative flex items-center">
                 <Search size={14} className="absolute left-2 text-gray-400 pointer-events-none"/>
                 <input 
                    ref={searchInputRef}
                    className="bg-vscode-input text-white text-sm pl-8 pr-2 py-1 w-32 md:w-48 outline-none border border-transparent focus:border-vscode-accent rounded-sm placeholder-gray-500"
                    placeholder="Find"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            if (e.shiftKey) handlePrevMatch();
                            else handleNextMatch();
                        }
                        if (e.key === 'Escape') {
                            e.preventDefault();
                            setShowSearch(false);
                            textareaRef.current?.focus();
                        }
                    }}
                 />
             </div>
             
             <div className="flex items-center ml-1 text-xs text-gray-400 min-w-[50px] justify-center select-none">
                 {searchMatches.length > 0 ? (
                     <span>{currentMatchIdx + 1} of {searchMatches.length}</span>
                 ) : (
                     <span className={searchTerm ? "text-red-400" : ""}>No results</span>
                 )}
             </div>

             <div className="flex items-center ml-1 border-l border-[#454545] pl-1 gap-0.5">
                 <button onClick={handlePrevMatch} className="p-1 hover:bg-[#383b3d] rounded text-gray-300" title="Previous (Shift+Enter)">
                     <ArrowUp size={14} />
                 </button>
                 <button onClick={handleNextMatch} className="p-1 hover:bg-[#383b3d] rounded text-gray-300" title="Next (Enter)">
                     <ArrowDown size={14} />
                 </button>
                 <button onClick={() => { setShowSearch(false); textareaRef.current?.focus(); }} className="p-1 hover:bg-[#383b3d] rounded text-gray-300 ml-1">
                     <X size={14} />
                 </button>
             </div>
          </div>
      )}

      <div 
        ref={containerRef}
        className="relative flex-1 overflow-auto bg-vscode-bg scroll-smooth" 
        style={{ backgroundColor: '#1e1e1e' }} 
        onClick={() => textareaRef.current?.focus()}
      >
        <div 
            className="relative min-h-full" 
            style={{ width: settings.wordWrap ? '100%' : 'fit-content', minWidth: '100%' }}
        >
            {/* Active Line Highlight */}
            <div 
                className="absolute left-0 w-full bg-[#2f3333] border-l-2 border-[#454545] pointer-events-none z-0"
                style={{
                    top: activeLineIndex * lineHeight + 20,
                    height: lineHeight
                }}
            />

            {/* Indentation Guides */}
            <div 
                className="absolute inset-0 pointer-events-none z-0" 
                style={{ padding: settings.lineNumbers ? '20px 20px 20px 40px' : '20px' }}
            >
               <svg className="w-full h-full overflow-visible">
                  <path d={indentGuidesPath} stroke="#3a3a3a" strokeWidth="1" fill="none" />
               </svg>
            </div>

            {/* Gutter */}
            {settings.lineNumbers && (
                <div 
                    className="absolute top-0 left-0 bottom-0 w-10 bg-vscode-bg border-r border-transparent text-gray-600 font-mono text-xs pt-5 pr-2 text-right select-none z-10"
                    style={{ lineHeight: `${lineHeight}px` }}
                >
                    {code.split('\n').map((_, i) => <div key={i} className={i === activeLineIndex ? 'text-gray-200 font-bold' : ''}>{i+1}</div>)}
                </div>
            )}

            <pre
                aria-hidden="true"
                className={`pointer-events-none language-${language} m-0 border-0 relative z-10`}
                style={{ ...commonStyle, minHeight: '100%', paddingBottom: '250px' }}
                dangerouslySetInnerHTML={{ __html: highlightedCode }}
            />

            <textarea
                ref={textareaRef}
                value={code}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                onClick={updateCursorPosition}
                onKeyUp={updateCursorPosition} 
                
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                autoComplete="off"
                inputMode="text"
                
                className="absolute inset-0 w-full h-full overflow-hidden resize-none outline-none z-20 text-transparent bg-transparent caret-white"
                style={{ 
                    ...commonStyle,
                    color: 'transparent',
                    paddingBottom: '250px',
                    backgroundColor: 'transparent'
                }}
                disabled={readOnly}
            />

            {(suggestions.length > 0) && (
                <div 
                    className="absolute z-50 bg-[#252526] border border-[#454545] shadow-2xl rounded-sm flex flex-col min-w-[200px] max-w-[300px] max-h-48 overflow-y-auto"
                    style={{
                        left: cursorXY.left,
                        ...(suggestionPlacement === 'top' 
                            ? { bottom: `calc(100% - ${cursorXY.top}px + 5px)` }
                            : { top: cursorXY.top + lineHeight + 5 } 
                        )
                    }}
                >
                    {suggestions.map((s, idx) => (
                        <div
                            key={idx}
                            onClick={() => insertSuggestion(s)}
                            className={`flex items-center justify-between px-3 py-1 cursor-pointer font-mono text-sm border-b border-[#333333] last:border-0 ${idx === selectedIdx ? 'bg-[#007acc] text-white' : 'hover:bg-[#2a2d2e] text-[#cccccc]'}`}
                        >
                            <div className="flex items-center gap-2 overflow-hidden flex-1">
                                <span className="shrink-0 flex items-center justify-center w-5">
                                    {getSuggestionIcon(s.type)}
                                </span>
                                <span className={`truncate ${idx === selectedIdx ? 'text-white' : 'text-[#9cdcfe]'}`}>
                                    {s.label}
                                </span>
                            </div>
                            <span className={`text-xs ml-2 italic shrink-0 ${idx === selectedIdx ? 'text-white opacity-80' : 'text-gray-500'}`}>
                                {s.detail ? s.detail.replace(' Abbreviation', '') : s.type}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>

       {!readOnly && (
           <MobileToolbar 
             onInsert={handleToolbarInsert}
             onTab={() => {
                const e = { preventDefault: () => {} } as any;
                if (textareaRef.current) {
                     const { selectionStart, selectionEnd, value } = textareaRef.current;
                     const newValue = value.substring(0, selectionStart) + '  ' + value.substring(selectionEnd);
                     onChange(newValue);
                     nextCursorPosRef.current = selectionStart + 2;
                     textareaRef.current.focus();
                }
             }}
             onUndo={() => {
                if (historyPointer.current > 0) {
                    historyPointer.current -= 1;
                    onChange(historyRef.current[historyPointer.current]);
                }
             }}
             onRedo={() => {
                if (historyPointer.current < historyRef.current.length - 1) {
                    historyPointer.current += 1;
                    onChange(historyRef.current[historyPointer.current]);
                }
             }}
             onFormat={handleFormat}
             onSearch={() => setShowSearch(!showSearch)}
           />
       )}
    </div>
  );
};
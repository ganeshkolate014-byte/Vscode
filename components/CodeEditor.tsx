
import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markup'; 
if (typeof window !== 'undefined' && Prism.languages.markup) {
    Prism.languages.html = Prism.languages.markup;
}

import { HTML_TAGS, CSS_PROPS, JS_KEYWORDS } from '../constants';
import { Suggestion, EditorSettings } from '../types';
import { Bot } from 'lucide-react'; 
import { completeCode } from '../services/geminiService';
import { expandAbbreviation, extractAbbreviation } from '../services/emmetService';
import { formatCode } from '../services/formattingService';
import { MobileToolbar } from './MobileToolbar';

interface CodeEditorProps {
  code: string;
  language: 'html' | 'css' | 'javascript';
  onChange: (newCode: string) => void;
  readOnly?: boolean;
  settings?: EditorSettings;
}

const DEFAULT_SETTINGS: EditorSettings = {
    fontSize: 14,
    wordWrap: false,
    lineNumbers: true,
    autoSave: true
};

export const CodeEditor: React.FC<CodeEditorProps> = ({ 
    code, 
    language, 
    onChange, 
    readOnly = false,
    settings = DEFAULT_SETTINGS
}) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [cursorXY, setCursorXY] = useState({ top: 0, left: 0 });
  const [suggestionPlacement, setSuggestionPlacement] = useState<'top' | 'bottom'>('bottom');
  const [charSize, setCharSize] = useState({ width: 0, height: 0 });
  const [activeLineIndex, setActiveLineIndex] = useState(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nextCursorPosRef = useRef<number | null>(null); 
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [autoSuggestTimer, setAutoSuggestTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const activeRequestRef = useRef<number>(0);
  
  const historyRef = useRef<string[]>([code]);
  const historyPointer = useRef<number>(0);

  const lineHeight = Math.round(settings.fontSize * 1.5);

  // Measure Character Size when font size changes
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
      const left = (col * charSize.width) + (settings.lineNumbers ? 40 : 20); // Adjust for gutter
      
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
    activeRequestRef.current++;
    
    if (autoSuggestTimer) clearTimeout(autoSuggestTimer);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    
    updateCursorPosition();
    
    // Suggestion logic...
    let newSuggestions: Suggestion[] = [];
    const words = textBeforeCursor.split(/[\s<>{}().,;:'"]+/);
    const currentWord = words[words.length - 1];

    if (currentWord.length > 0) {
        if (language === 'html') {
            const potentialAbbr = extractAbbreviation(textBeforeCursor);
            if (potentialAbbr && potentialAbbr.length > 0) {
                const emmetResult = expandAbbreviation(potentialAbbr);
                if (emmetResult) {
                     newSuggestions.push({ label: potentialAbbr, value: emmetResult, type: 'emmet', detail: 'Emmet' });
                }
            }
        }
        let source: Suggestion[] = [];
        if (language === 'html') source = HTML_TAGS;
        if (language === 'css') source = CSS_PROPS;
        if (language === 'javascript') source = JS_KEYWORDS;
        const matches = source.filter(s => s.label.toLowerCase().startsWith(currentWord.toLowerCase()));
        matches.forEach(m => { if (!newSuggestions.find(s => s.label === m.label)) newSuggestions.push(m); });
    }

    if (newSuggestions.length > 0) {
        setSuggestions(newSuggestions);
        setSelectedIdx(0);
    } else {
        setSuggestions([]);
        if (!readOnly && val.trim().length > 10) {
            const timer = setTimeout(() => triggerAiSuggestion(val, cursorPos), 1500);
            setAutoSuggestTimer(timer);
        }
    }
  };

  const triggerAiSuggestion = async (currentVal: string, cursor: number) => {
      const requestId = activeRequestRef.current;
      if (textareaRef.current?.selectionStart !== cursor) return;

      setIsAiLoading(true);
      const textBefore = currentVal.slice(0, cursor);
      try {
        const completion = await completeCode(textBefore, language);
        if (requestId !== activeRequestRef.current) return;
        if (completion && completion.trim().length > 0) {
            setSuggestions([{ label: "AI Suggestion", value: completion, type: 'snippet', detail: 'Gemini' }]);
            updateCursorPosition();
        }
      } catch (e) { } 
      finally { if (requestId === activeRequestRef.current) setIsAiLoading(false); }
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
    if (suggestion.type === 'emmet') {
         charsToDelete = extractAbbreviation(textBeforeCursor).length;
    } else if (suggestion.label === 'AI Suggestion') {
         charsToDelete = 0;
    } else {
        const words = textBeforeCursor.split(/[\s<>{}().,;:'"]+/);
        charsToDelete = words[words.length - 1].length;
    }
    
    before = val.substring(0, cursorPos - charsToDelete);
    after = val.substring(cursorPos);
    if (insertion.startsWith('<') && before.trimEnd().endsWith('<')) {
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
    boxSizing: 'border-box'
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-vscode-bg">
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

            {/* Gutter */}
            {settings.lineNumbers && (
                <div 
                    className="absolute top-0 left-0 bottom-0 w-10 bg-vscode-bg border-r border-transparent text-gray-600 font-mono text-xs pt-5 pr-2 text-right select-none z-10 hidden sm:block"
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
                autoCapitalize="none"
                autoComplete="off"
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
                            <div className="flex items-center gap-2 overflow-hidden">
                                {s.label === 'AI Suggestion' && <Bot size={12} />}
                                <span className={`truncate ${idx === selectedIdx ? 'text-white' : s.label === 'AI Suggestion' ? 'text-purple-400' : 'text-blue-400'}`}>
                                    {s.label}
                                </span>
                            </div>
                            <span className={`text-xs ml-4 italic shrink-0 ${idx === selectedIdx ? 'text-white opacity-80' : 'text-gray-500'}`}>
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
                // ... same implementation ...
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
             onAiTrigger={() => {
                 if (!textareaRef.current) return;
                 setIsAiLoading(true);
                 triggerAiSuggestion(textareaRef.current.value, textareaRef.current.selectionStart);
             }}
             isAiLoading={isAiLoading}
           />
       )}
    </div>
  );
};

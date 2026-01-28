import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markup'; 
import { HTML_TAGS, CSS_PROPS, JS_KEYWORDS } from '../constants';
import { Suggestion } from '../types';
import { Sparkles, Zap, Bot, Box, Code, Hash, Type } from 'lucide-react'; 
import { completeCode } from '../services/geminiService';
import { expandAbbreviation, extractAbbreviation } from '../services/emmetService';
import { MobileToolbar } from './MobileToolbar';

interface CodeEditorProps {
  code: string;
  language: 'html' | 'css' | 'javascript';
  onChange: (newCode: string) => void;
  readOnly?: boolean;
}

const SuggestionIcon = ({ type, label }: { type: string, label: string }) => {
    if (label === 'AI Suggestion') return <Bot size={14} className="text-purple-400" />;
    if (type === 'tag') return <Code size={14} className="text-blue-400" />;
    if (type === 'snippet') return <Box size={14} className="text-white" />;
    if (type === 'emmet') return <Zap size={14} className="text-green-400" />;
    if (type === 'keyword') return <Box size={14} className="text-pink-400" />;
    if (type === 'property') return <Hash size={14} className="text-blue-300" />;
    return <Type size={14} className="text-gray-400" />;
};

export const CodeEditor: React.FC<CodeEditorProps> = ({ code, language, onChange, readOnly = false }) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const nextCursorPosRef = useRef<number | null>(null); 
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [autoSuggestTimer, setAutoSuggestTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const activeRequestRef = useRef<number>(0);
  
  // Simple History Stack for custom Undo
  const historyRef = useRef<string[]>([code]);
  const historyPointer = useRef<number>(0);

  // Sync scroll exactly
  const handleScroll = () => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  // Syntax Highlighting & Color Preview
  useEffect(() => {
    if (Prism.languages.css) {
        Prism.languages.css['color-preview'] = {
            pattern: /\b(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:(?:\s*\d+\s*%?)\s*,){2}(?:\s*\d+\s*%?)\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\))\b/i,
            alias: 'color-value'
        };
    }

    const hookId = 'css-color-preview-hook';
    // @ts-ignore
    if (!window[hookId]) {
        // @ts-ignore
        window[hookId] = true;
        
        Prism.hooks.add('wrap', (env) => {
            if (env.type === 'color-preview' || (env.type === 'color' && env.language === 'css')) {
                env.attributes.style = `
                    background-color: ${env.content}; 
                    color: rgba(255,255,255,0.9); 
                    text-shadow: 0px 0px 2px black, 0 0 1px black;
                    border-radius: 2px;
                    outline: 1px solid rgba(128,128,128,0.5);
                `;
            }
        });
    }

    if (preRef.current) {
      Prism.highlightElement(preRef.current);
    }
  }, [code, language]);

  // Cursor Positioning Effect
  useLayoutEffect(() => {
    if (nextCursorPosRef.current !== null && textareaRef.current) {
      const pos = nextCursorPosRef.current;
      textareaRef.current.setSelectionRange(pos, pos);
      nextCursorPosRef.current = null;
    }
  }, [code]);

  // History tracking
  useEffect(() => {
     if (code !== historyRef.current[historyPointer.current]) {
         const nextPtr = historyPointer.current + 1;
         historyRef.current = [...historyRef.current.slice(0, nextPtr), code];
         historyPointer.current = nextPtr;
     }
  }, [code]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChange(val);

    // Invalidate pending AI requests
    activeRequestRef.current++;

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    
    // Clear existing timer
    if (autoSuggestTimer) clearTimeout(autoSuggestTimer);

    // 1. Check for Emmet (Only in HTML)
    if (language === 'html') {
        const potentialAbbr = extractAbbreviation(textBeforeCursor);
        const emmetResult = expandAbbreviation(potentialAbbr);
        
        if (emmetResult) {
            setSuggestions([{
                label: potentialAbbr,
                value: emmetResult,
                type: 'emmet',
                detail: 'Emmet Abbreviation'
            }]);
            return; 
        }
    }

    // 2. Standard Autocomplete
    const words = textBeforeCursor.split(/[\s<>{}().,;:'"]+/);
    const currentWord = words[words.length - 1];

    if (currentWord.length > 0) {
      let source: Suggestion[] = [];
      if (language === 'html') source = HTML_TAGS;
      if (language === 'css') source = CSS_PROPS;
      if (language === 'javascript') source = JS_KEYWORDS;

      const matches = source.filter(s => s.label.toLowerCase().startsWith(currentWord.toLowerCase()));
      setSuggestions(matches);
    } else {
      setSuggestions([]);
      
      // 3. Passive AI Suggestion if user stops typing for 1.5s
      if (!readOnly && val.trim().length > 10) {
          const timer = setTimeout(() => {
              triggerAiSuggestion(val, cursorPos);
          }, 1500);
          setAutoSuggestTimer(timer);
      }
    }
  };

  const triggerAiSuggestion = async (currentVal: string, cursor: number) => {
      const requestId = activeRequestRef.current;
      
      // Don't trigger if cursor moved away in the meantime
      if (textareaRef.current?.selectionStart !== cursor) return;

      setIsAiLoading(true);
      const textBefore = currentVal.slice(0, cursor);
      
      try {
        const completion = await completeCode(textBefore, language);
        
        if (requestId !== activeRequestRef.current) {
            setIsAiLoading(false);
            return;
        }

        if (completion && completion.trim().length > 0) {
            setSuggestions([{
                label: "AI Suggestion",
                value: completion,
                type: 'snippet',
                detail: 'Gemini Auto-complete'
            }]);
        }
      } catch (e) {
          // ignore
      } finally {
          if (requestId === activeRequestRef.current) {
             setIsAiLoading(false);
          }
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const { selectionStart, selectionEnd, value } = e.currentTarget;

    if (e.key === 'Tab') {
      e.preventDefault();
      handleTab();
    } 
    else if (e.key === 'Enter') {
      e.preventDefault();
      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      const currentLine = value.substring(lineStart, selectionStart);
      const match = currentLine.match(/^\s*/);
      const indent = match ? match[0] : '';
      
      let insertion = '\n' + indent;
      if (/[:{(\[>]\s*$/.test(currentLine)) {
         insertion += '  ';
      }
      
      const newValue = value.substring(0, selectionStart) + insertion + value.substring(selectionEnd);
      onChange(newValue);
      nextCursorPosRef.current = selectionStart + insertion.length;
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
    
    if (suggestion.type === 'emmet') {
         const abbr = extractAbbreviation(textBeforeCursor);
         before = val.substring(0, cursorPos - abbr.length);
         after = val.substring(cursorPos);
    } else if (suggestion.label === 'AI Suggestion') {
         before = val.substring(0, cursorPos);
         after = val.substring(cursorPos);
    } else {
        const words = textBeforeCursor.split(/[\s<>{}().,;:'"]+/);
        const currentWord = words[words.length - 1];
        before = val.substring(0, cursorPos - currentWord.length);
        after = val.substring(cursorPos);
    }

    if (insertion.startsWith('<') && before.trimEnd().endsWith('<')) {
        const lastOpenBracket = before.lastIndexOf('<');
        if (lastOpenBracket !== -1) {
            before = before.substring(0, lastOpenBracket);
        }
    }
    
    const cursorMarkerIndex = insertion.indexOf('$0');
    if (cursorMarkerIndex !== -1) {
        const cleanInsertion = insertion.replace(/\$0/g, ''); 
        const finalValue = before + cleanInsertion + after;
        const newCursorPos = before.length + cursorMarkerIndex;
        onChange(finalValue);
        setSuggestions([]);
        nextCursorPosRef.current = newCursorPos;
    } else {
        const finalValue = before + insertion + after;
        const newCursorPos = before.length + insertion.length;
        onChange(finalValue);
        setSuggestions([]);
        nextCursorPosRef.current = newCursorPos;
    }
    
    textareaRef.current.focus();
  };

  const handleAiAutocomplete = async () => {
    if (!textareaRef.current) return;
    setIsAiLoading(true);
    const val = textareaRef.current.value;
    const cursorPos = textareaRef.current.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    
    activeRequestRef.current++;

    try {
        const completion = await completeCode(textBeforeCursor, language);
        if (completion) {
            const before = val.substring(0, cursorPos);
            const after = val.substring(cursorPos);
            onChange(before + completion + after);
            nextCursorPosRef.current = (before + completion).length;
        }
    } finally {
        setIsAiLoading(false);
    }
  };

  // Toolbar Handlers
  const handleToolbarInsert = (text: string) => {
    if (!textareaRef.current) return;
    const val = textareaRef.current.value;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    
    let insertion = text;
    let finalCursorPos = start + text.length;

    if (start !== end) {
        const selection = val.substring(start, end);
        if (['"', "'", '`', '(', '{', '['].includes(text)) {
           const closing = text === '(' ? ')' : text === '{' ? '}' : text === '[' ? ']' : text;
           insertion = text + selection + closing;
           finalCursorPos = end + 2; 
        }
    } else {
        if (['(', '{', '['].includes(text)) {
            const closing = text === '(' ? ')' : text === '{' ? '}' : ']';
            insertion = text + closing;
            finalCursorPos = start + 1; 
        }
        else if (['"', "'", '`'].includes(text)) {
             insertion = text + text;
             finalCursorPos = start + 1;
        }
    }

    const newVal = val.substring(0, start) + insertion + val.substring(end);
    onChange(newVal);
    nextCursorPosRef.current = finalCursorPos;
    textareaRef.current.focus();
  };

  const handleTab = () => {
    if (!textareaRef.current) return;
    const { selectionStart, selectionEnd, value } = textareaRef.current;
    const newValue = value.substring(0, selectionStart) + '  ' + value.substring(selectionEnd);
    onChange(newValue);
    nextCursorPosRef.current = selectionStart + 2;
    textareaRef.current.focus();
  };

  const handleUndo = () => {
      if (historyPointer.current > 0) {
          historyPointer.current -= 1;
          const prevCode = historyRef.current[historyPointer.current];
          onChange(prevCode);
      }
      textareaRef.current?.focus();
  };
  
  const handleRedo = () => {
      if (historyPointer.current < historyRef.current.length - 1) {
          historyPointer.current += 1;
          onChange(historyRef.current[historyPointer.current]);
      }
      textareaRef.current?.focus();
  };

  // Explicit shared styles for exact alignment
  const sharedEditorStyles: React.CSSProperties = {
    fontFamily: '"Fira Code", monospace',
    fontSize: '14px',
    lineHeight: '21px',
    paddingTop: '20px',
    paddingBottom: '20px',
    paddingLeft: '20px',  
    paddingRight: '20px',
    border: '0',
    margin: '0',
    outline: 'none',
    whiteSpace: 'pre',
    wordWrap: 'normal',
    overflowWrap: 'normal',
    tabSize: 2,
    boxSizing: 'border-box',
    fontVariantLigatures: 'none',
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-vscode-bg">
      {/* Suggestions Widget (Vertical List anchored to bottom left) */}
      {(suggestions.length > 0) && (
        <div className="absolute bottom-12 left-2 z-50 w-72 max-h-60 overflow-y-auto bg-vscode-widget border border-vscode-activity shadow-[0_8px_16px_rgba(0,0,0,0.5)] rounded-md flex flex-col">
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              onClick={() => insertSuggestion(s)}
              className={`flex items-center justify-between px-3 py-2 text-sm border-b border-vscode-activity/30 last:border-0 hover:bg-vscode-hover transition-colors text-left ${idx === 0 ? 'bg-vscode-activity/50' : ''}`}
            >
               <div className="flex items-center gap-3 overflow-hidden">
                 <span className="shrink-0"><SuggestionIcon type={s.type} label={s.label} /></span>
                 <span className={`font-mono truncate ${s.label === 'AI Suggestion' ? 'text-purple-300' : 'text-vscode-fg'}`}>
                   {s.label}
                 </span>
               </div>
               
               {/* Detail / Type */}
               <span className="text-xs text-gray-500 font-sans italic shrink-0 ml-4">
                   {s.detail || s.type}
               </span>
            </button>
          ))}
        </div>
      )}

      <div className="relative flex-1 overflow-hidden" style={{ cursor: 'text' }} onClick={() => textareaRef.current?.focus()}>
        {/* Line Numbers Gutter */}
        <div className="absolute top-0 left-0 w-10 h-full bg-vscode-bg border-r border-transparent text-gray-600 font-mono text-sm pt-4 pr-2 text-right select-none z-20 hidden sm:block" style={{ lineHeight: '21px', paddingTop: '20px' }}>
           {code.split('\n').map((_, i) => <div key={i}>{i+1}</div>)}
        </div>

        <textarea
          ref={textareaRef}
          value={code}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="none"
          autoComplete="off"
          className="absolute top-0 left-0 outline-none z-10 code-input resize-none"
          style={{ 
            ...sharedEditorStyles,
            color: 'transparent',
            caretColor: 'white',
            overflow: 'auto', // textarea handles scroll
          }}
          disabled={readOnly}
        />
        <pre
          ref={preRef}
          aria-hidden="true"
          className={`absolute top-0 left-0 pointer-events-none z-0 language-${language} m-0 border-0`}
          style={{ 
            ...sharedEditorStyles,
            overflow: 'hidden' // pre follows textarea
          }}
        >
          {code}
        </pre>
      </div>
       
       {/* Mobile Toolbar */}
       {!readOnly && (
           <MobileToolbar 
             onInsert={handleToolbarInsert}
             onTab={handleTab}
             onUndo={handleUndo}
             onRedo={handleRedo}
             onAiTrigger={handleAiAutocomplete}
             isAiLoading={isAiLoading}
           />
       )}
    </div>
  );
};
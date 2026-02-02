
import React, { useRef, useEffect, useState, useCallback } from 'react';
import Editor, { useMonaco, OnMount } from "@monaco-editor/react";
import { Suggestion, EditorSettings, FileNode } from '../types';
import { MobileToolbar } from './MobileToolbar';
import { completeCode } from '../services/geminiService';
import { expandAbbreviation, extractAbbreviation } from '../services/emmetService';
import { Loader2 } from 'lucide-react';

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
  const monaco = useMonaco();
  const editorRef = useRef<any>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Helper to map our Suggestion type to Monaco's CompletionItemKind
  const getMonacoKind = (type: Suggestion['type']) => {
      if (!monaco) return 0;
      switch (type) {
          case 'tag': return monaco.languages.CompletionItemKind.Class; // Tags look good as Class
          case 'property': return monaco.languages.CompletionItemKind.Property;
          case 'snippet': return monaco.languages.CompletionItemKind.Snippet;
          case 'keyword': return monaco.languages.CompletionItemKind.Keyword;
          case 'emmet': return monaco.languages.CompletionItemKind.Snippet;
          default: return monaco.languages.CompletionItemKind.Text;
      }
  };

  // Register Custom Completion Providers
  useEffect(() => {
    if (!monaco) return;

    const disposables: any[] = [];

    // --- HTML Provider ---
    if (language === 'html') {
        disposables.push(monaco.languages.registerCompletionItemProvider('html', {
            triggerCharacters: ['>', '.', '#', '*', '+', '!'],
            provideCompletionItems: (model, position) => {
                const word = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn,
                };

                const suggestions: any[] = [];

                // Standard Suggestions
                suggestions.push(...htmlTags.map(tag => ({
                        label: tag.label,
                        kind: getMonacoKind(tag.type),
                        insertText: tag.value,
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        detail: tag.detail || 'Custom Tag',
                        range: range,
                        sortText: '10'
                    })),
                    ...htmlAttributes.map(attr => ({
                        label: attr.label,
                        kind: getMonacoKind(attr.type),
                        insertText: attr.value,
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        detail: attr.detail || 'Attribute',
                        range: range,
                        sortText: '10'
                    }))
                );

                // --- Emmet Integration ---
                const textUntilPosition = model.getValueInRange({
                    startLineNumber: position.lineNumber,
                    startColumn: 1,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column
                });
                
                const abbr = extractAbbreviation(textUntilPosition);
                if (abbr) {
                    const expansion = expandAbbreviation(abbr);
                    if (expansion) {
                         const abbrRange = {
                            startLineNumber: position.lineNumber,
                            endLineNumber: position.lineNumber,
                            startColumn: position.column - abbr.length,
                            endColumn: position.column
                        };
                        
                        suggestions.unshift({
                            label: abbr + ' (Emmet)',
                            kind: monaco.languages.CompletionItemKind.Snippet,
                            insertText: expansion,
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: 'Emmet Abbreviation',
                            documentation: expansion,
                            range: abbrRange,
                            sortText: '00', // High priority
                            filterText: abbr
                        });
                    }
                }

                return { suggestions };
            }
        }));
    }

    // --- CSS Provider ---
    if (language === 'css') {
        disposables.push(monaco.languages.registerCompletionItemProvider('css', {
            provideCompletionItems: (model, position) => {
                const word = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn,
                };
                
                const suggestions = cssProps.map(prop => ({
                    label: prop.label,
                    kind: getMonacoKind(prop.type),
                    insertText: prop.value,
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    detail: prop.detail || 'CSS Property',
                    range: range
                }));

                return { suggestions };
            }
        }));
    }

    // --- JS Provider ---
    if (language === 'javascript') {
        disposables.push(monaco.languages.registerCompletionItemProvider('javascript', {
            provideCompletionItems: (model, position) => {
                const word = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn,
                };
                
                const suggestions = jsKeywords.map(kw => ({
                    label: kw.label,
                    kind: getMonacoKind(kw.type),
                    insertText: kw.value,
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    detail: kw.detail || 'JS Keyword',
                    range: range
                }));

                return { suggestions };
            }
        }));
    }

    return () => {
        disposables.forEach(d => d.dispose());
    };
  }, [monaco, language, htmlTags, htmlAttributes, cssProps, jsKeywords]);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Define custom theme to match our app
    monaco.editor.defineTheme('droidcoder-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
            'editor.background': '#1e1e1e',
            'editor.lineHighlightBackground': '#2f3333',
            'editorLineNumber.foreground': '#858585',
            'editorIndentGuide.background': '#404040',
        }
    });
    monaco.editor.setTheme('droidcoder-dark');
    
    // Initial content set (Editor is controlled, but good to be safe)
    if (editor.getValue() !== code) {
        editor.setValue(code);
    }
  };

  const handleAiComplete = async () => {
      if (!editorRef.current || isAiThinking) return;
      
      const editor = editorRef.current;
      const model = editor.getModel();
      const position = editor.getPosition();
      
      // Get text before cursor for context
      const textUntilPosition = model.getValueInRange({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column
      });

      setIsAiThinking(true);
      
      // Insert a placeholder comment
      const placeholderId = { major: 1, minor: 1 };
      const op = { range: new monaco!.Range(position.lineNumber, position.column, position.lineNumber, position.column), text: ' /* AI Thinking... */', forceMoveMarkers: true };
      editor.executeEdits("ai-placeholder", [op]);
      
      try {
          const completion = await completeCode(textUntilPosition, language);
          
          // Remove placeholder (Undo the edit basically, or just find and replace)
          // We will just perform an undo to remove the placeholder then insert real text
          editor.trigger('keyboard', 'undo', null);
          
          if (completion) {
             const insertOp = { 
                 range: new monaco!.Range(position.lineNumber, position.column, position.lineNumber, position.column), 
                 text: completion, 
                 forceMoveMarkers: true 
             };
             editor.executeEdits("ai-completion", [insertOp]);
          }
      } catch (e) {
          console.error(e);
          editor.trigger('keyboard', 'undo', null); // Remove placeholder
      } finally {
          setIsAiThinking(false);
          editor.focus();
      }
  };

  // Mobile Toolbar Handlers
  const handleInsert = (text: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      const position = editor.getPosition();
      
      // Handle wrapping if there is a selection
      const selection = editor.getSelection();
      const hasSelection = !selection.isEmpty();
      
      let insertText = text;
      
      if (hasSelection && ['"', "'", '(', '{', '['].includes(text)) {
           const selectedText = editor.getModel().getValueInRange(selection);
           const closing = text === '(' ? ')' : text === '{' ? '}' : text === '[' ? ']' : text;
           insertText = text + selectedText + closing;
           editor.executeEdits("toolbar-wrap", [{
              range: selection,
              text: insertText,
              forceMoveMarkers: true
           }]);
           return;
      }
      
      // Standard insertion
      editor.executeEdits("toolbar-insert", [{
          range: new monaco!.Range(position.lineNumber, position.column, position.lineNumber, position.column),
          text: insertText,
          forceMoveMarkers: true
      }]);
      editor.focus();
  };

  const handleFormat = () => {
      editorRef.current?.getAction('editor.action.formatDocument').run();
  };

  const handleSelectAll = () => {
      editorRef.current?.trigger('keyboard', 'editor.action.selectAll', null);
      editorRef.current?.focus();
  };

  const handleCopyAll = () => {
      const value = editorRef.current?.getValue();
      if (value) {
          navigator.clipboard.writeText(value);
      }
  };

  const handleClear = () => {
      const editor = editorRef.current;
      if (!editor) return;
      const model = editor.getModel();
      const fullRange = model.getFullModelRange();
      
      // Use executeEdits to support Undo
      editor.executeEdits("toolbar-clear", [{
          range: fullRange,
          text: "",
          forceMoveMarkers: true
      }]);
      editor.focus();
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-vscode-bg overflow-hidden">
        {isAiThinking && (
            <div className="absolute top-2 right-2 z-50 bg-vscode-accent text-white px-3 py-1 rounded-full text-xs flex items-center gap-2 shadow-lg animate-fade-in">
                <Loader2 size={12} className="animate-spin" />
                AI Thinking...
            </div>
        )}

        <div className="flex-1 relative overflow-hidden">
            <Editor
                height="100%"
                language={language}
                theme="droidcoder-dark"
                value={code}
                onChange={(value) => onChange(value || '')}
                onMount={handleEditorDidMount}
                options={{
                    fontSize: settings.fontSize,
                    wordWrap: settings.wordWrap ? 'on' : 'off',
                    lineNumbers: settings.lineNumbers ? 'on' : 'off',
                    minimap: { enabled: false }, // Save space on mobile
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    padding: { top: 10, bottom: 10 },
                    fontFamily: "'Fira Code', monospace",
                    fontLigatures: true,
                    cursorBlinking: 'smooth',
                    smoothScrolling: true,
                    contextmenu: false, // Custom context menu is better for mobile usually, or disable system one
                    readOnly: readOnly,
                    // Mobile Optimizations
                    touchEdit: true, // Experimental touch support
                }}
            />
        </div>

        {!readOnly && (
           <MobileToolbar 
             onInsert={handleInsert}
             onTab={() => handleInsert('  ')} // Insert 2 spaces
             onUndo={() => editorRef.current?.trigger('keyboard', 'undo', null)}
             onRedo={() => editorRef.current?.trigger('keyboard', 'redo', null)}
             onFormat={handleFormat}
             onSearch={() => editorRef.current?.trigger('keyboard', 'actions.find', null)}
             onSelectAll={handleSelectAll}
             onCopyAll={handleCopyAll}
             onClear={handleClear}
           />
        )}
        
        <button 
            onClick={handleAiComplete}
            disabled={isAiThinking}
            className="absolute bottom-14 right-4 z-40 bg-purple-600 text-white p-3 rounded-full shadow-xl hover:bg-purple-500 active:scale-95 transition-all flex items-center justify-center"
            title="Ask AI to Complete"
        >
            {isAiThinking ? <Loader2 className="animate-spin" size={20}/> : <span className="font-bold text-xs">AI</span>}
        </button>
    </div>
  );
};

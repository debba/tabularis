import React, { useState, useEffect, useRef, useCallback } from "react";
import MonacoEditor, { type OnMount } from "@monaco-editor/react";

interface SqlEditorWrapperProps {
  initialValue: string;
  onChange: (value: string) => void;
  onRun: () => void;
  onMount?: OnMount;
  height?: string | number;
}

export const SqlEditorWrapper: React.FC<SqlEditorWrapperProps> = React.memo(
  ({ initialValue, onChange, onRun, onMount, height = "100%" }) => {
    const [localValue, setLocalValue] = useState(initialValue);
    const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

    useEffect(() => {
      // Only update if the prop value is significantly different from local state
      // (e.g. when switching tabs or loading a saved query)
      // We don't want to overwrite local state while user is typing if the prop update is delayed
      if (initialValue !== localValue) {
          // Simple check to avoid loop, but ideally we trust the parent to only send stable initialValue
          setLocalValue(initialValue);
      }
    }, [initialValue]); 
    // ^ Warning: this might still cause cursor jumps if parent updates 'initialValue' while typing.
    // Ideally parent should only change 'initialValue' when switching context (tabs).

    const handleChange = useCallback(
      (val: string | undefined) => {
        const newValue = val || "";
        setLocalValue(newValue);

        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
        }

        updateTimeoutRef.current = setTimeout(() => {
          onChange(newValue);
        }, 300);
      },
      [onChange]
    );

    const handleEditorMount: OnMount = (editor, monaco) => {
      editorRef.current = editor;
      
      // Bind Ctrl+Enter to Run
      editor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
        () => {
            onRun();
        }
      );

      if (onMount) onMount(editor, monaco);
    };

    return (
      <MonacoEditor
        height={height}
        defaultLanguage="sql"
        theme="vs-dark"
        value={localValue}
        onChange={handleChange}
        onMount={handleEditorMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          padding: { top: 16 },
          scrollBeyondLastLine: false,
          automaticLayout: true,
        }}
      />
    );
  }
);

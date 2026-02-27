import React, { useRef, useCallback, useEffect } from "react";
import MonacoEditor, { type OnMount, type BeforeMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { useTheme } from "../../hooks/useTheme";
import { loadMonacoTheme } from "../../themes/themeUtils";
import { readText } from "@tauri-apps/plugin-clipboard-manager";

interface SqlEditorWrapperProps {
  initialValue: string;
  onChange: (value: string) => void;
  onRun: () => void;
  onMount?: OnMount;
  height?: string | number;
  options?: React.ComponentProps<typeof MonacoEditor>['options'];
  editorKey?: string;
}

// Internal component that resets when key changes
const SqlEditorInternal: React.FC<SqlEditorWrapperProps & { editorKey: string }> = ({
  initialValue,
  onChange,
  onRun,
  onMount,
  height = "100%",
  options
}) => {
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const { currentTheme } = useTheme();

  // Sync editor value only when initialValue changes externally (e.g., tab switch)
  useEffect(() => {
    if (editorRef.current && initialValue !== editorRef.current.getValue()) {
      editorRef.current.setValue(initialValue);
    }
  }, [initialValue]);

  // Update Monaco theme when theme changes
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      loadMonacoTheme(currentTheme, monacoRef.current);
    }
  }, [currentTheme]);

    const handleChange = useCallback(
      (val: string | undefined) => {
        const newValue = val || "";

        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
        }

        updateTimeoutRef.current = setTimeout(() => {
          onChange(newValue);
        }, 300);
      },
      [onChange]
    );

    const handleBeforeMount: BeforeMount = (monaco) => {
      // Load Monaco theme before editor is created
      loadMonacoTheme(currentTheme, monaco);

      // Override Monaco's default paste action to use Tauri clipboard API
      monaco.editor.addEditorAction({
        id: 'editor.action.clipboardPasteAction',
        label: 'Paste',
        contextMenuGroupId: '9_cutcopypaste',
        contextMenuOrder: 2,
        run: async (editor: Monaco.editor.IStandaloneCodeEditor) => {
          try {
            const text = await readText();
            const selection = editor.getSelection();
            if (selection && text) {
              editor.executeEdits('paste', [{
                range: selection,
                text: text,
                forceMoveMarkers: true
              }]);
              editor.pushUndoStop();
            }
          } catch (err) {
            console.error('Failed to read clipboard:', err);
          }
        }
      });
    };

    const handleEditorMount: OnMount = (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

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
        theme={currentTheme.id}
        defaultValue={initialValue}
        onChange={handleChange}
        beforeMount={handleBeforeMount}
        onMount={handleEditorMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          padding: { top: 16, bottom: 32 },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          wordWrap: 'on',
          ...options
        }}
      />
    );
};

export const SqlEditorWrapper: React.FC<SqlEditorWrapperProps> = React.memo((props) => {
  // Use editorKey to control when component remounts (only on tab switch)
  return <SqlEditorInternal key={props.editorKey || "default"} editorKey={props.editorKey || "default"} {...props} />;
});

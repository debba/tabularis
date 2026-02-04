import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { MessageCircle, Trash2, X, Loader2 } from "lucide-react";
import { useSettings } from "../../hooks/useSettings";
import { useDatabase } from "../../hooks/useDatabase";
import { useEditor } from "../../hooks/useEditor";
import { buildAiChatContext } from "../../utils/aiChatContext";
import { getProviderLabel } from "../../utils/settingsUI";
import type { TableSchema } from "../../types/editor";

interface AiChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeQuery: string | null;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatRequestMessage {
  role: "user" | "assistant";
  content: string;
}

export const AiChatPanel = ({ isOpen, onClose, activeQuery }: AiChatPanelProps) => {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const {
    activeConnectionId,
    activeConnectionName,
    activeDatabaseName,
    activeDriver,
    activeTable,
  } = useDatabase();
  const { getSchema } = useEditor();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [schema, setSchema] = useState<TableSchema[]>([]);
  const [isSchemaLoading, setIsSchemaLoading] = useState(false);
  const [chatPrompt, setChatPrompt] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const loadSchema = useCallback(async () => {
    if (!activeConnectionId) return;
    setIsSchemaLoading(true);
    setError(null);
    try {
      const snapshot = await getSchema(activeConnectionId);
      setSchema(snapshot);
    } catch (err) {
      console.error("Failed to load schema for chat:", err);
      setError(String(err));
    } finally {
      setIsSchemaLoading(false);
    }
  }, [activeConnectionId, getSchema]);

  useEffect(() => {
    if (isOpen && activeConnectionId) {
      loadSchema();
    }
  }, [isOpen, activeConnectionId, loadSchema]);

  useEffect(() => {
    const loadChatPrompt = async () => {
      try {
        const prompt = await invoke<string>("get_chat_prompt");
        setChatPrompt(prompt);
      } catch (err) {
        console.error("Failed to load chat prompt:", err);
      }
    };

    if (isOpen) {
      loadChatPrompt();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isOpen]);

  const providerLabel = useMemo(() => {
    return settings.aiProvider ? getProviderLabel(settings.aiProvider) : "";
  }, [settings.aiProvider]);

  const systemPrompt = useMemo(() => {
    const language = settings.language === "it" ? "Italian" : "English";
    const context = buildAiChatContext({
      schema,
      activeTable,
      activeQuery,
      connectionName: activeConnectionName,
      databaseName: activeDatabaseName,
      driver: activeDriver,
      language,
    });
    const trimmedPrompt = chatPrompt.trim();
    if (!trimmedPrompt) return context;
    if (trimmedPrompt.includes("{{CONTEXT}}")) {
      return trimmedPrompt.replace("{{CONTEXT}}", context);
    }
    return `${trimmedPrompt}\n\n${context}`;
  }, [
    schema,
    activeTable,
    activeQuery,
    activeConnectionName,
    activeDatabaseName,
    activeDriver,
    settings.language,
    chatPrompt,
  ]);

  const canSend =
    !!input.trim() &&
    !!settings.aiProvider &&
    !!activeConnectionId &&
    !isLoading;

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (!settings.aiProvider) {
      setError(t("aiChat.providerMissing"));
      return;
    }
    if (!activeConnectionId) {
      setError(t("aiChat.noConnection"));
      return;
    }

    const userMessage: ChatMessage = {
      id: `${Date.now()}-${Math.round(Math.random() * 10000)}`,
      role: "user",
      content: trimmed,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await invoke<string>("chat_ai_assist", {
        req: {
          provider: settings.aiProvider,
          model: settings.aiModel || "",
          system_prompt: systemPrompt,
          messages: nextMessages.map<ChatRequestMessage>((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        },
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.round(Math.random() * 10000)}`,
          role: "assistant",
          content: response,
        },
      ]);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, [
    input,
    settings.aiProvider,
    settings.aiModel,
    activeConnectionId,
    messages,
    systemPrompt,
    t,
  ]);

  const handleClear = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="w-[340px] border-l border-default bg-elevated flex flex-col min-h-0">
      <div className="flex items-center justify-between p-3 border-b border-default bg-base">
        <div className="flex items-center gap-2 text-primary font-medium">
          <div className="p-1.5 rounded-lg bg-purple-900/30">
            <MessageCircle size={16} className="text-purple-300" />
          </div>
          <div>
            <div className="text-sm">{t("aiChat.title")}</div>
            <div className="text-[11px] text-secondary">
              {t("aiChat.subtitle")} {providerLabel ? `- ${providerLabel}` : ""}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleClear}
            className="p-1.5 text-secondary hover:text-primary hover:bg-surface-secondary rounded transition-colors"
            title={t("aiChat.clear")}
            disabled={messages.length === 0}
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-secondary hover:text-primary hover:bg-surface-secondary rounded transition-colors"
            title={t("aiChat.close")}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {!settings.aiProvider && (
          <div className="bg-warning-bg border border-warning-border text-warning-text px-3 py-2 rounded text-xs">
            {t("aiChat.providerMissing")}
          </div>
        )}
        {!activeConnectionId && (
          <div className="bg-warning-bg border border-warning-border text-warning-text px-3 py-2 rounded text-xs">
            {t("aiChat.noConnection")}
          </div>
        )}
        {isSchemaLoading && (
          <div className="flex items-center gap-2 text-xs text-muted">
            <Loader2 size={12} className="animate-spin" />
            {t("aiChat.schemaLoading")}
          </div>
        )}
        {error && (
          <div className="text-error-text text-xs bg-error-bg p-2 rounded border border-error-border whitespace-pre-wrap">
            {t("aiChat.errorPrefix")}
            {error}
          </div>
        )}
        {messages.length === 0 && !error && (
          <div className="text-xs text-muted bg-surface-secondary/40 border border-strong rounded-lg p-3">
            {t("aiChat.tips")}
          </div>
        )}
        <div className="flex flex-col gap-2">
          {messages.map((message) => (
            <div
              key={message.id}
              className={
                message.role === "user"
                  ? "self-end max-w-[90%] bg-purple-900/40 text-primary border border-purple-500/30 rounded-lg px-3 py-2 text-sm whitespace-pre-wrap"
                  : "self-start max-w-[90%] bg-base border border-strong rounded-lg px-3 py-2 text-sm text-secondary whitespace-pre-wrap"
              }
            >
              {message.content}
            </div>
          ))}
        </div>
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-default p-3 bg-elevated/60">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("aiChat.placeholder")}
          className="w-full h-24 bg-base border border-strong rounded-lg p-2 text-sm text-primary focus:outline-none focus:border-focus resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-muted">{t("aiChat.tips")}</span>
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="flex items-center gap-2 px-3 py-1.5 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs font-medium transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                {t("aiChat.sending")}
              </>
            ) : (
              t("aiChat.send")
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

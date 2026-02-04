import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { MessageCircle, Trash2, X, Loader2, ImagePlus } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { useSettings } from "../../hooks/useSettings";
import { useDatabase } from "../../hooks/useDatabase";
import { useEditor } from "../../hooks/useEditor";
import { buildAiChatContext } from "../../utils/aiChatContext";
import { getProviderLabel } from "../../utils/settingsUI";
import {
  arrayBufferToBase64,
  validateImageSize,
  getMimeTypeFromExtension,
  createImageContentPart,
  createTextContentPart,
  type MessageContentPart,
} from "../../utils/image";
import { ChatMessageContent } from "./ChatMessageContent";
import type { TableSchema } from "../../types/editor";

interface AiChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeQuery: string | null;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string | MessageContentPart[];
}

interface ChatRequestMessage {
  role: "user" | "assistant";
  content: MessageContentPart[];
}

interface SelectedImage {
  id: string;
  dataUrl: string;
  mimeType: string;
  size: number;
  name: string;
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
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
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
    (!!input.trim() || selectedImages.length > 0) &&
    !!settings.aiProvider &&
    !!activeConnectionId &&
    !isLoading;

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed && selectedImages.length === 0) return;
    if (!settings.aiProvider) {
      setError(t("aiChat.providerMissing"));
      return;
    }
    if (!activeConnectionId) {
      setError(t("aiChat.noConnection"));
      return;
    }

    // Build content array with text and images
    const contentParts: MessageContentPart[] = [];
    if (trimmed) {
      contentParts.push(createTextContentPart(trimmed));
    }
    selectedImages.forEach((img) => {
      contentParts.push(createImageContentPart(img.dataUrl, img.mimeType));
    });

    const userMessage: ChatMessage = {
      id: `${Date.now()}-${Math.round(Math.random() * 10000)}`,
      role: "user",
      content: contentParts,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setSelectedImages([]);
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
            content: typeof msg.content === "string"
              ? [createTextContentPart(msg.content)]
              : msg.content,
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
    selectedImages,
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

  const handleImageSelect = useCallback(async () => {
    const MAX_IMAGES = 5;

    if (selectedImages.length >= MAX_IMAGES) {
      setError(t("aiChat.maxImagesReached", { max: MAX_IMAGES }));
      return;
    }

    try {
      const selected = await open({
        filters: [
          {
            name: "Images",
            extensions: ["png", "jpg", "jpeg", "gif", "webp"],
          },
        ],
        multiple: true,
      });

      if (!selected) return;
      const files = Array.isArray(selected) ? selected : [selected];

      for (const filePath of files) {
        if (selectedImages.length >= MAX_IMAGES) {
          setError(t("aiChat.maxImagesReached", { max: MAX_IMAGES }));
          break;
        }

        try {
          const fileData = await readFile(filePath);
          if (!validateImageSize(fileData.length)) {
            setError(t("aiChat.imageTooLarge", { max: "5MB" }));
            continue;
          }

          const mimeType = getMimeTypeFromExtension(filePath);
          const base64 = arrayBufferToBase64(fileData.buffer);
          const dataUrl = `data:${mimeType};base64,${base64}`;

          setSelectedImages((prev) => {
            if (prev.length >= MAX_IMAGES) return prev;
            return [
              ...prev,
              {
                id: `${Date.now()}-${Math.random()}`,
                dataUrl,
                mimeType,
                size: fileData.length,
                name: filePath.split("/").pop() || "image",
              },
            ];
          });
        } catch (err) {
          setError(t("aiChat.imageLoadError"));
          console.error("Failed to load image:", err);
        }
      }
    } catch (err) {
      console.error("File picker error:", err);
    }
  }, [t, selectedImages]);

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
                  ? "self-end max-w-[90%] bg-purple-900/40 text-primary border border-purple-500/30 rounded-lg px-3 py-2"
                  : "self-start max-w-[90%] bg-base border border-strong rounded-lg px-3 py-2 text-secondary"
              }
            >
              <ChatMessageContent content={message.content} />
            </div>
          ))}
        </div>
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-default p-3 bg-elevated/60">
        {selectedImages.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedImages.map((img) => (
              <div key={img.id} className="relative group">
                <img
                  src={img.dataUrl}
                  alt={img.name}
                  className="h-16 w-16 object-cover rounded border border-default"
                />
                <button
                  onClick={() =>
                    setSelectedImages((prev) =>
                      prev.filter((i) => i.id !== img.id)
                    )
                  }
                  className="absolute -top-1 -right-1 bg-error p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} className="text-white" />
                </button>
              </div>
            ))}
          </div>
        )}
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
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={handleImageSelect}
            disabled={!canSend || isLoading}
            className="p-2 text-muted hover:text-primary hover:bg-surface-secondary rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={t("aiChat.attachImage")}
          >
            <ImagePlus size={16} />
          </button>
          <div className="flex-1" />
          <button
            onClick={handleSend}
            disabled={!canSend && selectedImages.length === 0}
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

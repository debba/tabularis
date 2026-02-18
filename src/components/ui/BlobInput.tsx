import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Download,
  Upload,
  FileIcon,
  Trash2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { extractBlobMetadata, type BlobMetadata } from "../../utils/blob";

export interface BlobInputProps {
  value: unknown;
  dataType?: string;
  onChange: (value: unknown) => void;
  placeholder?: string;
  className?: string;
  // Connection context for downloading truncated BLOBs
  connectionId?: string | null;
  tableName?: string | null;
  pkCol?: string | null;
  pkVal?: unknown;
  colName?: string | null;
  schema?: string | null;
}

/**
 * BlobInput component for viewing and editing BLOB data.
 * Shows metadata (MIME type, size) and provides upload/download functionality.
 * For truncated BLOBs, download fetches the full data from the database and
 * saves it via the native OS file dialog.
 */
export const BlobInput: React.FC<BlobInputProps> = ({
  value,
  dataType,
  onChange,
  placeholder,
  className = "",
  connectionId,
  tableName,
  pkCol,
  pkVal,
  colName,
  schema,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const metadata: BlobMetadata | null = extractBlobMetadata(value);
  const hasValue = value !== null && value !== undefined && value !== "";

  const canFetchFull =
    metadata?.isTruncated &&
    connectionId &&
    tableName &&
    pkCol &&
    pkVal !== null &&
    pkVal !== undefined &&
    colName;

  const isDownloadDisabled = isDownloading || (metadata?.isTruncated && !canFetchFull);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64String = event.target?.result as string;
        const base64Data = base64String.split(",")[1];
        onChange(base64Data);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Failed to upload file:", error);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getExtension = (mimeType: string): string => {
    const ext = mimeType.split("/")[1];
    if (!ext || ext === "octet-stream") return "bin";
    return ext;
  };

  const handleDownload = async () => {
    if (!hasValue || !metadata) return;

    if (metadata.isTruncated) {
      if (!canFetchFull) return;

      const extension = getExtension(metadata.mimeType);
      const filePath = await save({
        defaultPath: `download.${extension}`,
        filters: [{ name: dataType || "BLOB", extensions: [extension] }],
      });
      if (!filePath) return;

      setIsDownloading(true);
      try {
        await invoke("save_blob_to_file", {
          connectionId,
          table: tableName,
          colName,
          pkCol,
          pkVal,
          filePath,
          ...(schema ? { schema } : {}),
        });
      } catch (error) {
        console.error("Failed to save BLOB:", error);
      } finally {
        setIsDownloading(false);
      }
      return;
    }

    try {
      const extension = getExtension(metadata.mimeType);
      const filePath = await save({
        defaultPath: `download.${extension}`,
        filters: [{ name: dataType || "BLOB", extensions: [extension] }],
      });
      if (!filePath) return;

      const binaryString = atob(String(value));
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      await writeFile(filePath, bytes);
    } catch (error) {
      console.error("Failed to download file:", error);
    }
  };

  return (
    <div className={className}>
      {hasValue && metadata ? (
        <div className="bg-surface-secondary border border-default rounded-lg overflow-hidden">
          {/* Main row: icon + info + actions */}
          <div className="flex items-center gap-3 px-3 py-3">
            {/* Icon with background */}
            <div className="p-2 rounded-md bg-surface-tertiary flex-shrink-0">
              <FileIcon className="text-secondary" size={15} />
            </div>

            {/* File info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-primary font-mono truncate leading-tight">
                {metadata.mimeType}
              </p>
              <p className="text-xs text-muted mt-0.5">
                {metadata.formattedSize}
                {dataType && (
                  <span className="ml-1.5 opacity-50">· {dataType}</span>
                )}
              </p>
            </div>

            {/* Action icons — visually separated with left border */}
            <div className="flex items-center gap-0.5 border-l border-default pl-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title={t("blobInput.uploadFile")}
                className="p-1.5 rounded text-muted hover:text-secondary hover:bg-surface-tertiary transition-colors"
              >
                <Upload size={14} />
              </button>

              <button
                type="button"
                onClick={handleDownload}
                disabled={isDownloadDisabled}
                title={
                  isDownloading
                    ? t("blobInput.downloading")
                    : isDownloadDisabled
                    ? t("blobInput.downloadDisabledTruncated")
                    : t("blobInput.download")
                }
                className="p-1.5 rounded text-muted hover:text-secondary hover:bg-surface-tertiary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isDownloading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
              </button>

              <div className="w-px h-3 bg-default mx-0.5" />

              <button
                type="button"
                onClick={() => onChange(null)}
                title={t("blobInput.delete")}
                className="p-1.5 rounded text-muted hover:text-red-400 hover:bg-red-900/10 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Truncated warning — footer */}
          {metadata.isTruncated && (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/5 border-t border-amber-500/20">
              <AlertTriangle size={11} className="text-amber-500 flex-shrink-0" />
              <span className="text-xs text-amber-500/80">
                {t("blobInput.truncatedWarning")}
              </span>
            </div>
          )}
        </div>
      ) : (
        /* Empty state — whole card is clickable to upload */
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex flex-col items-center gap-2.5 px-4 py-6 bg-surface-secondary border border-dashed border-default rounded-lg text-muted hover:text-secondary hover:border-strong hover:bg-surface-tertiary transition-colors"
        >
          <div className="p-2.5 rounded-full bg-surface-tertiary">
            <Upload size={15} />
          </div>
          <span className="text-sm">
            {placeholder || t("blobInput.noData")}
          </span>
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileUpload}
        accept="*/*"
      />
    </div>
  );
};

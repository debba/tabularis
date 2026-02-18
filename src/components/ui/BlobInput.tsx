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
import { extractBlobMetadata, detectMimeTypeFromBase64, type BlobMetadata } from "../../utils/blob";

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

  // Truncated BLOB can be downloaded only when connection context is available
  const canFetchFull =
    metadata?.isTruncated &&
    connectionId &&
    tableName &&
    pkCol &&
    pkVal !== null &&
    pkVal !== undefined &&
    colName;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64String = event.target?.result as string;
        // Remove data URL prefix (e.g., "data:image/png;base64,")
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

  const getExtensionForMime = (mimeType: string): string => {
    const ext = mimeType.split("/")[1];
    if (!ext || ext === "octet-stream") return "bin";
    return ext;
  };

  const handleDownload = async () => {
    if (!hasValue || !metadata) return;

    if (metadata.isTruncated) {
      // Fetch full BLOB from DB and save via native dialog
      if (!canFetchFull) return;

      const extension = getExtensionForMime(metadata.mimeType);
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

    // Small BLOB already in memory — decode base64 and save via native dialog
    try {
      const extension = getExtensionForMime(metadata.mimeType);
      const filePath = await save({
        defaultPath: `download.${extension}`,
        filters: [{ name: dataType || "BLOB", extensions: [extension] }],
      });
      if (!filePath) return;

      const stringValue = String(value);
      const binaryString = atob(stringValue);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      await writeFile(filePath, bytes);
    } catch (error) {
      console.error("Failed to download file:", error);
    }
  };

  const handleDelete = () => {
    onChange(null);
  };

  const isDownloadDisabled = isDownloading || (metadata?.isTruncated && !canFetchFull);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* BLOB Info Display */}
      {hasValue && metadata ? (
        <div className="bg-surface-secondary border border-default rounded-lg p-4">
          <div className="flex items-start gap-3">
            <FileIcon className="text-secondary mt-1" size={24} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-primary">
                  {t("blobInput.mimeType")}:
                </span>
                <span className="text-sm text-secondary font-mono">
                  {metadata.mimeType}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-primary">
                  {t("blobInput.size")}:
                </span>
                <span className="text-sm text-secondary font-mono">
                  {metadata.formattedSize}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-primary">
                  {t("blobInput.type")}:
                </span>
                <span className="text-sm text-muted font-mono">
                  {dataType || "BLOB"}
                </span>
              </div>
              {metadata.isTruncated && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-default">
                  <AlertTriangle className="text-yellow-400" size={16} />
                  <span className="text-xs text-yellow-400">
                    {t("blobInput.truncatedWarning")}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-surface-secondary border border-default border-dashed rounded-lg p-4 text-center">
          <FileIcon className="mx-auto text-muted mb-2" size={32} />
          <p className="text-sm text-muted">
            {placeholder || t("blobInput.noData")}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 flex-wrap">
        {/* Upload Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-2 text-sm bg-blue-900/20 text-blue-400 rounded border border-blue-900/50 hover:bg-blue-900/30 transition-colors flex items-center gap-2"
          title={t("blobInput.uploadFile")}
        >
          <Upload size={16} />
          {t("blobInput.uploadFile")}
        </button>

        {/* Download Button */}
        {hasValue && (
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloadDisabled}
            className={`px-3 py-2 text-sm rounded border flex items-center gap-2 transition-colors ${
              isDownloadDisabled
                ? "bg-surface-secondary text-muted border-default cursor-not-allowed opacity-50"
                : "bg-green-900/20 text-green-400 border-green-900/50 hover:bg-green-900/30"
            }`}
            title={
              isDownloading
                ? t("blobInput.downloading")
                : isDownloadDisabled
                ? t("blobInput.downloadDisabledTruncated")
                : t("blobInput.download")
            }
          >
            {isDownloading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            {isDownloading ? t("blobInput.downloading") : t("blobInput.download")}
          </button>
        )}

        {/* Delete Button */}
        {hasValue && (
          <button
            type="button"
            onClick={handleDelete}
            className="px-3 py-2 text-sm bg-red-900/20 text-red-400 rounded border border-red-900/50 hover:bg-red-900/30 transition-colors flex items-center gap-2"
            title={t("blobInput.delete")}
          >
            <Trash2 size={16} />
            {t("blobInput.delete")}
          </button>
        )}
      </div>

      {/* Hidden File Input */}
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

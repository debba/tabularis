export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function validateImageSize(size: number, maxSizeMB = 5): boolean {
  return size <= maxSizeMB * 1024 * 1024;
}

export function getMimeTypeFromExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
  };
  return mimeTypes[ext || ''] || 'image/jpeg';
}

export interface MessageContentPart {
  type: "text" | "image";
  text?: string;
  image_url?: string;
  mime_type?: string;
}

export function createImageContentPart(
  dataUrl: string,
  mimeType: string
): MessageContentPart {
  return { type: "image", image_url: dataUrl, mime_type: mimeType };
}

export function createTextContentPart(text: string): MessageContentPart {
  return { type: "text", text };
}

import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/types/src/display/api';

// PDFワーカーの設定は index.tsx で行っているので、ここでは省略します

// PDF page cache to improve performance
interface CachedPage {
  canvas: HTMLCanvasElement;
  timestamp: number;
}

// Cache object with expiration time (30 minutes)
const pageCache: Map<string, CachedPage> = new Map();
const CACHE_EXPIRATION_MS = 30 * 60 * 1000; // 30 minutes

// Clear expired cache entries
const cleanupCache = () => {
  const now = Date.now();
  for (const [key, cachedPage] of pageCache.entries()) {
    if (now - cachedPage.timestamp > CACHE_EXPIRATION_MS) {
      pageCache.delete(key);
    }
  }
};

/**
 * ArrayBufferからPDFドキュメントを読み込む
 */
export const loadPdfDocument = async (arrayBuffer: ArrayBuffer): Promise<PDFDocumentProxy> => {
  return await pdfjsLib.getDocument(arrayBuffer).promise;
};

/**
 * PDFページをcanvasにレンダリングする
 */
export const renderPageToCanvas = async (
  page: PDFPageProxy,
  scale: number = 1.5
): Promise<HTMLCanvasElement> => {
  // Generate a cache key based on the page reference and scale
  const cacheKey = `page_${page.pageNumber}_scale_${scale}`;
  
  // Check if the page is already in cache
  if (pageCache.has(cacheKey)) {
    const cachedPage = pageCache.get(cacheKey)!;
    // Update the timestamp to mark it as recently used
    cachedPage.timestamp = Date.now();
    return cachedPage.canvas;
  }
  
  // Clean up expired cache entries to avoid memory leaks
  cleanupCache();
  
  // Render the page if not in cache
  const viewport = page.getViewport({ scale });
  
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  if (!context) {
    throw new Error('Canvas 2D context is not available');
  }
  
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  const renderContext = {
    canvasContext: context,
    viewport
  };
  
  await page.render(renderContext).promise;
  
  // Store the rendered page in cache
  pageCache.set(cacheKey, {
    canvas,
    timestamp: Date.now()
  });
  
  return canvas;
};

// Clear cache for a specific document when it's closed
export const clearPdfCache = (documentId: string): void => {
  // Remove all cache entries that start with this document's ID
  for (const key of pageCache.keys()) {
    if (key.startsWith(`doc_${documentId}`)) {
      pageCache.delete(key);
    }
  }
}; 
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/types/src/display/api';

// PDFワーカーの設定は index.tsx で行っているので、ここでは省略します

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
  
  return canvas;
}; 
import { Object as FabricObject } from 'fabric/fabric-impl';
import { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';

export interface CustomBanner {
  id: string;
  src: string;
  filename: string;
}

export interface AppState {
  currentFile: File | null;
  currentPage: number;
  totalPages: number;
  pdfDocument: PDFDocumentProxy | null;
  isSelectionMode: boolean;
  customBanners: CustomBanner[];
  activeBanner: FabricObject | null;
  isFullScreen: boolean;
} 
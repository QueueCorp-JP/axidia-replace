import React, { useState, useEffect, useRef } from 'react';
import { fabric } from 'fabric';
import { Canvas as FabricCanvas, Image as FabricImage, Object as FabricObject } from 'fabric/fabric-impl';
import { AppState, CustomBanner } from '../types';
import { isImageFile, isPdfFile, downloadFile } from '../utils/fileUtils';
import { loadPdfDocument, renderPageToCanvas, clearPdfCache } from '../utils/pdfUtils';
import './BannerEditor.css';

const BannerEditor: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  
  // 状態管理
  const [state, setState] = useState<AppState>({
    currentFile: null,
    currentPage: 0,
    totalPages: 0,
    pdfDocument: null,
    isSelectionMode: false,
    customBanners: [],
    activeBanner: null,
    isFullScreen: false
  });

  // 全画面モード切り替え
  const toggleFullScreen = () => {
    setState(prev => ({ ...prev, isFullScreen: !prev.isFullScreen }));
    
    // Resize canvas after layout changes are applied
    setTimeout(() => {
      if (fabricCanvasRef.current && state.currentFile) {
        resizeCanvasInFullScreenMode(!state.isFullScreen);
      }
    }, 100);
  };

  // Resizes the canvas properly to maximize the available space in fullscreen mode
  const resizeCanvasInFullScreenMode = (isFullScreen: boolean) => {
    try {
      if (!fabricCanvasRef.current || !canvasContainerRef.current) return;
      if (!fabricCanvasRef.current.getContext()) return;
      
      const canvas = fabricCanvasRef.current;
      const container = canvasContainerRef.current;
      
      // Get the current canvas dimensions
      const currentWidth = canvas.width || 800;
      const currentHeight = canvas.height || 600;
      const aspectRatio = currentWidth / currentHeight;
      
      if (isFullScreen) {
        // In fullscreen mode, get the available size while respecting the aspect ratio
        const containerWidth = container.clientWidth - 40; // Subtract padding/margin
        const containerHeight = container.clientHeight - 40; // Subtract padding/margin
        
        let newWidth, newHeight;
        
        // Determine if width or height is the limiting factor
        if (containerWidth / aspectRatio <= containerHeight) {
          // Width is limiting
          newWidth = containerWidth;
          newHeight = containerWidth / aspectRatio;
        } else {
          // Height is limiting
          newHeight = containerHeight;
          newWidth = containerHeight * aspectRatio;
        }
        
        // Apply the new dimensions
        canvas.setWidth(newWidth);
        canvas.setHeight(newHeight);
        
        // Scale all objects proportionally to the new size
        const scaleX = newWidth / currentWidth;
        const scaleY = newHeight / currentHeight;
        
        canvas.getObjects().forEach(obj => {
          if (obj) {
            const currentScaleX = obj.scaleX || 1;
            const currentScaleY = obj.scaleY || 1;
            obj.set({
              scaleX: currentScaleX * scaleX,
              scaleY: currentScaleY * scaleY,
              left: (obj.left || 0) * scaleX,
              top: (obj.top || 0) * scaleY
            });
            obj.setCoords();
          }
        });
        
        // Also scale background image if it exists
        const backgroundImage = canvas.backgroundImage;
        if (backgroundImage) {
          const bgScaleX = (backgroundImage as any).scaleX || 1;
          const bgScaleY = (backgroundImage as any).scaleY || 1;
          (backgroundImage as any).set({
            scaleX: bgScaleX * scaleX,
            scaleY: bgScaleY * scaleY
          });
        }
      }
      
      // Make sure canvas is still valid before rendering
      if (canvas.getContext()) {
        canvas.renderAll();
      }
    } catch (error) {
      console.error('Error resizing canvas:', error);
    }
  };

  // ESCキーで全画面モード解除
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state.isFullScreen) {
        setState(prev => ({ ...prev, isFullScreen: false }));
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [state.isFullScreen]);

  // ウィンドウリサイズへの対応
  useEffect(() => {
    // 全画面モードでのリサイズ対応
    const handleResize = () => {
      if (state.isFullScreen && fabricCanvasRef.current && state.currentFile) {
        // リサイズ時にキャンバスを再描画
        resizeCanvasInFullScreenMode(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [state.isFullScreen, state.currentFile]);

  // Fabric.js キャンバスの初期化
  useEffect(() => {
    if (canvasRef.current && !fabricCanvasRef.current) {
      try {
        const canvas = new fabric.Canvas(canvasRef.current, {
          preserveObjectStacking: true,
          selection: false,
          width: 800,
          height: 600
        });
        fabricCanvasRef.current = canvas;

        // オブジェクト選択時のイベント
        canvas.on('selection:created', (e) => {
          if (e.selected && e.selected.length > 0) {
            const selectedObject = e.selected[0];
            setState(prev => ({ ...prev, activeBanner: selectedObject }));
          }
        });

        canvas.on('selection:updated', (e) => {
          if (e.selected && e.selected.length > 0) {
            const selectedObject = e.selected[0];
            setState(prev => ({ ...prev, activeBanner: selectedObject }));
          }
        });

        canvas.on('selection:cleared', () => {
          setState(prev => ({ ...prev, activeBanner: null }));
        });
      } catch (error) {
        console.error('Fabric canvas initialization error:', error);
      }
    }

    return () => {
      // Make sure to clean up the canvas when the component unmounts
      try {
        if (fabricCanvasRef.current) {
          fabricCanvasRef.current.dispose();
          fabricCanvasRef.current = null;
        }
      } catch (error) {
        console.error('Error during canvas cleanup:', error);
      }
    };
  }, []);

  // ファイル処理関数
  const handleFileUpload = async (file: File) => {
    try {
      // 既存のローディングインジケータをクリア
      document.querySelectorAll('.loading-indicator').forEach(el => el.remove());
      
      // Clear the PDF cache when loading a new file
      if (state.pdfDocument) {
        clearPdfCache(`doc_${state.currentFile?.name || 'current'}`);
      }
      
      resetCanvas();
      setState(prev => ({ ...prev, currentFile: file }));

      if (isImageFile(file.name)) {
        await processImageFile(file);
      } else if (isPdfFile(file.name)) {
        await processPdfFile(file);
      } else {
        alert('サポートされていないファイル形式です。JPG、PNG、PDFファイルをアップロードしてください。');
      }
    } catch (error) {
      // エラー時にもローディングインジケータをクリア
      document.querySelectorAll('.loading-indicator').forEach(el => el.remove());
      console.error('ファイルアップロード中にエラーが発生しました:', error);
      alert('ファイルのアップロードに失敗しました。再度お試しください。');
    }
  };

  // 画像ファイル処理 - Promiseを返すように修正
  const processImageFile = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      // 読み込み中の表示
      const loadingElement = document.createElement('div');
      loadingElement.className = 'loading-indicator';
      loadingElement.id = 'image-loading-indicator';
      loadingElement.innerHTML = '<div class="spinner"></div><p>画像を読み込み中...</p>';
      
      // 既存のローディングインジケータがあれば削除
      document.querySelectorAll('.loading-indicator').forEach(el => el.remove());
      
      const canvasWrapper = document.querySelector('.canvas-wrapper');
      canvasWrapper?.appendChild(loadingElement);
      
      // 安全対策: 10秒後に自動的にローディングインジケータを削除
      const loadingTimeout = setTimeout(() => {
        document.getElementById('image-loading-indicator')?.remove();
      }, 10000);
      
      reader.onload = (e) => {
        if (e.target?.result && fabricCanvasRef.current) {
          try {
            fabric.Image.fromURL(e.target.result.toString(), (img: FabricImage) => {
              try {
                // 読み込み中の表示を削除
                clearTimeout(loadingTimeout);
                document.getElementById('image-loading-indicator')?.remove();
                
                if (fabricCanvasRef.current && fabricCanvasRef.current.getContext()) {
                  resizeCanvasToFitImage(img);
                  fabricCanvasRef.current.add(img);
                  fabricCanvasRef.current.renderAll();
                  resolve();
                } else {
                  reject(new Error('ファブリックキャンバスが初期化されていません'));
                }
              } catch (imgError) {
                console.error('Image processing error:', imgError);
                clearTimeout(loadingTimeout);
                document.getElementById('image-loading-indicator')?.remove();
                reject(imgError);
              }
            }, { crossOrigin: 'anonymous' });
          } catch (error) {
            console.error('Fabric.js error:', error);
            clearTimeout(loadingTimeout);
            document.getElementById('image-loading-indicator')?.remove();
            reject(error);
          }
        } else {
          // 読み込み結果がない場合もローディングを削除
          clearTimeout(loadingTimeout);
          document.getElementById('image-loading-indicator')?.remove();
          reject(new Error('画像の読み込みに失敗しました'));
        }
      };
      
      reader.onerror = (error) => {
        console.error('FileReader error:', error);
        clearTimeout(loadingTimeout);
        document.getElementById('image-loading-indicator')?.remove();
        reject(new Error('画像の読み込みに失敗しました'));
      };
      
      reader.readAsDataURL(file);
    });
  };

  // PDFファイル処理
  const processPdfFile = async (file: File) => {
    // 読み込み中の表示
    const loadingElement = document.createElement('div');
    loadingElement.className = 'loading-indicator';
    loadingElement.id = 'pdf-loading-indicator';
    loadingElement.innerHTML = '<div class="spinner"></div><p>PDFを読み込み中...</p>';
    
    // 既存のローディングインジケータがあれば削除
    document.querySelectorAll('.loading-indicator').forEach(el => el.remove());
    
    const canvasWrapper = document.querySelector('.canvas-wrapper');
    canvasWrapper?.appendChild(loadingElement);
    
    // 安全対策: 15秒後に自動的にローディングインジケータを削除
    const loadingTimeout = setTimeout(() => {
      document.getElementById('pdf-loading-indicator')?.remove();
    }, 15000);
    
    try {
      // ArrayBufferに変換
      const arrayBuffer = await file.arrayBuffer();
      
      // PDFドキュメントを読み込む
      const pdf = await loadPdfDocument(arrayBuffer);
      
      // ステートを更新
      setState(prev => ({
        ...prev,
        pdfDocument: pdf,
        totalPages: pdf.numPages,
        currentPage: 1
      }));
      
      // 最初のページをレンダリング
      await renderPdfPage(1);
      
      // 読み込み中の表示を削除
      clearTimeout(loadingTimeout);
      document.getElementById('pdf-loading-indicator')?.remove();
    } catch (error) {
      // 読み込み中の表示を削除
      clearTimeout(loadingTimeout);
      document.getElementById('pdf-loading-indicator')?.remove();
      console.error('PDFの読み込み中にエラーが発生しました:', error);
      alert('PDFの読み込み中にエラーが発生しました。別のPDFを試してください。');
    }
  };

  // PDFページレンダリング
  const renderPdfPage = async (pageNumber: number) => {
    try {
      const { pdfDocument } = state;
      if (!pdfDocument || !fabricCanvasRef.current) return;
      if (!fabricCanvasRef.current.getContext()) return;

      // ページ切り替え中の表示
      const loadingElement = document.createElement('div');
      loadingElement.className = 'loading-indicator';
      loadingElement.id = 'page-loading-indicator';
      loadingElement.innerHTML = '<div class="spinner"></div><p>ページを読み込み中...</p>';
      
      // 既存のローディングインジケータがあれば削除
      document.querySelectorAll('.loading-indicator').forEach(el => el.remove());
      
      const canvasWrapper = document.querySelector('.canvas-wrapper');
      canvasWrapper?.appendChild(loadingElement);
      
      // 安全対策: 10秒後に自動的にローディングインジケータを削除
      const loadingTimeout = setTimeout(() => {
        document.getElementById('page-loading-indicator')?.remove();
      }, 10000);

      // PDFのページを取得
      const page = await pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.5 });
      
      // Check if canvas is still valid
      if (!fabricCanvasRef.current || !fabricCanvasRef.current.getContext()) {
        clearTimeout(loadingTimeout);
        document.getElementById('page-loading-indicator')?.remove();
        return;
      }
      
      // キャンバスサイズを設定
      fabricCanvasRef.current.setWidth(viewport.width);
      fabricCanvasRef.current.setHeight(viewport.height);
      
      // ページをレンダリング
      const renderedCanvas = await renderPageToCanvas(page, 1.5);
      
      // Check again if canvas is still valid
      if (!fabricCanvasRef.current || !fabricCanvasRef.current.getContext()) {
        clearTimeout(loadingTimeout);
        document.getElementById('page-loading-indicator')?.remove();
        return;
      }
      
      // キャンバスをクリア（サイズはリセットしない）
      resetCanvas(false);
      
      // レンダリングされたページをキャンバスの背景にセット
      fabric.Image.fromURL(renderedCanvas.toDataURL(), (img: FabricImage) => {
        try {
          if (!fabricCanvasRef.current || !fabricCanvasRef.current.getContext()) {
            clearTimeout(loadingTimeout);
            document.getElementById('page-loading-indicator')?.remove();
            return;
          }
          
          // 背景画像として設定
          fabricCanvasRef.current.setBackgroundImage(
            img, 
            fabricCanvasRef.current.renderAll.bind(fabricCanvasRef.current), 
            {
              scaleX: fabricCanvasRef.current.width! / img.width!,
              scaleY: fabricCanvasRef.current.height! / img.height!,
              selectable: false,
              evented: false
            }
          );
          
          // ローディングインジケータを削除
          clearTimeout(loadingTimeout);
          document.getElementById('page-loading-indicator')?.remove();
        } catch (error) {
          console.error('Error setting PDF background:', error);
          clearTimeout(loadingTimeout);
          document.getElementById('page-loading-indicator')?.remove();
        }
      });
      
      // 現在のページ番号を更新
      setState(prev => ({ ...prev, currentPage: pageNumber }));
    } catch (error) {
      // エラー時もローディングインジケータを削除
      console.error('PDFページのレンダリング中にエラーが発生しました:', error);
      document.getElementById('page-loading-indicator')?.remove();
      alert('PDFページのレンダリングに失敗しました。別のPDFを試してください。');
    }
  };

  // Canvas サイズ調整
  const resizeCanvasToFitImage = (img: FabricImage) => {
    if (!fabricCanvasRef.current) return;
    
    const imgWidth = img.width || img.getScaledWidth();
    const imgHeight = img.height || img.getScaledHeight();
    
    fabricCanvasRef.current.setWidth(imgWidth);
    fabricCanvasRef.current.setHeight(imgHeight);
    
    img.set({
      left: 0,
      top: 0,
      selectable: false,
      evented: false
    });
  };

  // キャンバスをリセット
  const resetCanvas = (resetSize = true) => {
    try {
      if (!fabricCanvasRef.current) return;
      
      // 念のため、すべてのローディングインジケータを削除
      document.querySelectorAll('.loading-indicator').forEach(el => el.remove());
      
      // Guard against null canvas context
      if (fabricCanvasRef.current.getContext()) {
        fabricCanvasRef.current.clear();
        
        if (resetSize) {
          fabricCanvasRef.current.setWidth(800);
          fabricCanvasRef.current.setHeight(600);
        }
        
        fabricCanvasRef.current.renderAll();
      }
    } catch (error) {
      console.error('Error resetting canvas:', error);
    }
  };

  // バナー画像処理
  const handleBannerUpload = (file: File) => {
    if (!isImageFile(file.name)) {
      alert('バナーには画像ファイル（JPG、PNG）のみアップロード可能です。');
      return;
    }
    
    // アップロード中の表示
    const bannerSection = document.querySelector('.banner-section');
    
    // 既存のローディングや成功メッセージがあれば削除
    document.querySelectorAll('.banner-loading, .banner-success').forEach(el => el.remove());
    
    const loadingElement = document.createElement('div');
    loadingElement.className = 'banner-loading';
    loadingElement.id = 'banner-loading-indicator';
    loadingElement.innerHTML = '<div class="spinner spinner-sm"></div><span>バナーをアップロード中...</span>';
    bannerSection?.appendChild(loadingElement);
    
    // 安全対策: 8秒後に自動的にローディングインジケータを削除
    const loadingTimeout = setTimeout(() => {
      document.getElementById('banner-loading-indicator')?.remove();
    }, 8000);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        if (e.target?.result) {
          const bannerId = `banner-${Date.now()}`;
          const newBanner: CustomBanner = {
            id: bannerId,
            src: e.target.result.toString(),
            filename: file.name
          };
          
          setState(prev => ({
            ...prev,
            customBanners: [...prev.customBanners, newBanner]
          }));
          
          // アップロード完了後に表示を削除
          clearTimeout(loadingTimeout);
          document.getElementById('banner-loading-indicator')?.remove();
          
          // 成功メッセージを表示
          const successElement = document.createElement('div');
          successElement.className = 'banner-success';
          successElement.id = 'banner-success-message';
          successElement.innerHTML = '<span>バナーを追加しました！</span>';
          bannerSection?.appendChild(successElement);
          
          // 成功メッセージを数秒後に削除
          setTimeout(() => {
            document.getElementById('banner-success-message')?.remove();
          }, 3000);
        } else {
          throw new Error('Banner image could not be loaded');
        }
      } catch (error) {
        clearTimeout(loadingTimeout);
        document.getElementById('banner-loading-indicator')?.remove();
        console.error('バナー画像の処理中にエラーが発生しました:', error);
        alert('バナー画像の処理中にエラーが発生しました。別の画像を試してください。');
      }
    };
    
    reader.onerror = () => {
      clearTimeout(loadingTimeout);
      document.getElementById('banner-loading-indicator')?.remove();
      alert('バナー画像の読み込みに失敗しました。別の画像を試してください。');
    };
    
    reader.readAsDataURL(file);
  };

  // バナーをキャンバスに追加
  const addBannerToCanvas = (banner: CustomBanner) => {
    if (!fabricCanvasRef.current) return;
    
    fabric.Image.fromURL(banner.src, (img: FabricImage) => {
      const maxWidth = fabricCanvasRef.current!.width! / 3;
      
      if (img.width! > maxWidth) {
        const scale = maxWidth / img.width!;
        img.scale(scale);
      }
      
      // バナーを選択可能に設定
      img.set({
        left: 50,
        top: 50,
        cornerColor: 'rgba(69, 98, 255, 0.8)',
        cornerStrokeColor: '#fff',
        borderColor: 'rgba(69, 98, 255, 0.8)',
        cornerSize: 12,
        transparentCorners: false,
        centeredScaling: true,
        selectable: true,
        evented: true,
        data: { id: banner.id, isBanner: true }
      });
      
      fabricCanvasRef.current!.discardActiveObject();
      fabricCanvasRef.current!.add(img);
      fabricCanvasRef.current!.setActiveObject(img);
      
      setState(prev => ({ ...prev, activeBanner: img }));
      
      fabricCanvasRef.current!.renderAll();
    });
  };

  // 選択モード切り替え
  const toggleSelectionMode = () => {
    if (!fabricCanvasRef.current) return;
    
    const newSelectionMode = !state.isSelectionMode;
    
    setState(prev => ({ ...prev, isSelectionMode: newSelectionMode }));
    
    fabricCanvasRef.current.selection = newSelectionMode;
    
    if (newSelectionMode) {
      enableObjectDetection();
    } else {
      disableObjectDetection();
    }

    // 選択モードを視覚的に表示
    if (fabricCanvasRef.current.getActiveObject()) {
      fabricCanvasRef.current.discardActiveObject();
      fabricCanvasRef.current.renderAll();
    }
  };

  // オブジェクト検出を有効化
  const enableObjectDetection = () => {
    if (!fabricCanvasRef.current) return;
    
    fabricCanvasRef.current.forEachObject((obj: FabricObject) => {
      const objData = obj.get('data');
      // バナーオブジェクトは常に選択可能
      if (objData && objData.isBanner) {
        obj.set({
          selectable: true,
          evented: true
        });
      } else {
        // その他のオブジェクト（テキストや背景の画像など）
        obj.set({
          selectable: true,
          evented: true,
          borderColor: 'rgba(255, 0, 0, 0.5)',
          cornerColor: 'rgba(255, 0, 0, 0.5)',
          cornerSize: 10,
          transparentCorners: false,
          borderDashArray: [3, 3]
        });
      }
    });
    
    // カーソルスタイルを変更
    document.querySelector('.canvas-wrapper')?.classList.add('selection-mode');
    fabricCanvasRef.current.renderAll();
  };

  // オブジェクト検出を無効化
  const disableObjectDetection = () => {
    if (!fabricCanvasRef.current) return;
    
    fabricCanvasRef.current.forEachObject((obj: FabricObject) => {
      const objData = obj.get('data');
      // バナーは選択モードに関わらず常に選択可能
      if (objData && objData.isBanner) {
        obj.set({
          selectable: true,
          evented: true
        });
      } else {
        // バナー以外は選択不可に
        obj.set({
          selectable: false,
          evented: false
        });
      }
    });
    
    // カーソルスタイルを元に戻す
    document.querySelector('.canvas-wrapper')?.classList.remove('selection-mode');
    fabricCanvasRef.current.renderAll();
  };

  // 選択オブジェクトを削除
  const deleteSelection = () => {
    if (!fabricCanvasRef.current) return;
    
    const activeObject = fabricCanvasRef.current.getActiveObject();
    
    if (activeObject) {
      fabricCanvasRef.current.remove(activeObject);
      fabricCanvasRef.current.discardActiveObject();
      fabricCanvasRef.current.renderAll();
      
      // アクティブなバナーをリセット
      setState(prev => ({ ...prev, activeBanner: null }));
    } else {
      alert('削除するオブジェクトを選択してください。');
    }
  };

  // 画像として保存
  const saveAsImage = () => {
    if (!fabricCanvasRef.current || !state.currentFile) {
      alert('保存するファイルがありません。');
      return;
    }
    
    // 選択を解除してから保存
    fabricCanvasRef.current.discardActiveObject();
    fabricCanvasRef.current.renderAll();
    
    const format = prompt("保存形式を選択してください（png または jpg）:", "png");
    
    if (format && (format.toLowerCase() === 'png' || format.toLowerCase() === 'jpg')) {
      const originalFilename = state.currentFile.name.split('.')[0];
      const newFilename = `${originalFilename}_edited.${format.toLowerCase()}`;
      
      const dataUrl = fabricCanvasRef.current.toDataURL({
        format: format.toLowerCase() === 'jpg' ? 'jpeg' : 'png',
        quality: 1,
        multiplier: 1
      });
      
      downloadFile(dataUrl, newFilename);
    }
  };

  // PDF保存機能
  const saveAsPDF = async () => {
    if (!fabricCanvasRef.current || !state.currentFile) {
      alert('保存するファイルがありません。');
      return;
    }
    
    try {
      // 選択を解除してから保存
      fabricCanvasRef.current.discardActiveObject();
      fabricCanvasRef.current.renderAll();
      
      const originalFilename = state.currentFile.name.split('.')[0];
      const newFilename = `${originalFilename}_edited.pdf`;
      
      // キャンバスを画像として取得
      const dataUrl = fabricCanvasRef.current.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 1
      });
      
      // PDF生成ライブラリを使用
      const { jsPDF } = await import('jspdf');
      const width = fabricCanvasRef.current.width!;
      const height = fabricCanvasRef.current.height!;
      
      // ページ方向を自動的に決定
      const orientation = width > height ? 'landscape' : 'portrait';
      
      const pdf = new jsPDF({
        orientation,
        unit: 'px',
        format: [width, height],
        hotfixes: ['px_scaling']
      });
      
      // 画像をPDFに追加
      pdf.addImage(
        dataUrl,
        'PNG',
        0,
        0,
        width,
        height
      );
      
      // PDFを保存
      pdf.save(newFilename);
    } catch (error) {
      console.error('PDF生成中にエラーが発生しました:', error);
      alert('PDF生成中にエラーが発生しました。画像として保存してください。');
      
      // エラー時は画像として保存
      const originalFilename = state.currentFile.name.split('.')[0];
      const newFilename = `${originalFilename}_edited.png`;
      
      const dataUrl = fabricCanvasRef.current.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 1
      });
      
      downloadFile(dataUrl, newFilename);
    }
  };

  // ファイルドロップハンドラー
  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.currentTarget;
    target.classList.remove('drag-over');
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // バナードロップハンドラー
  const handleBannerDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.currentTarget;
    target.classList.remove('drag-over');
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleBannerUpload(e.dataTransfer.files[0]);
    }
  };
  
  // ドラッグオーバーハンドラー
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('drag-over');
  };
  
  // ドラッグリーブハンドラー
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
  };
  
  // バナーを前面に移動
  const bringBannerToFront = () => {
    if (!fabricCanvasRef.current) return;
    
    const activeObject = fabricCanvasRef.current.getActiveObject();
    if (activeObject) {
      // TypeScriptの型定義の問題を回避
      (activeObject as any).bringToFront();
      fabricCanvasRef.current.renderAll();
    }
  };
  
  // バナーを背面に移動
  const sendBannerToBack = () => {
    if (!fabricCanvasRef.current) return;
    
    const activeObject = fabricCanvasRef.current.getActiveObject();
    if (activeObject) {
      // TypeScriptの型定義の問題を回避
      (activeObject as any).sendToBack();
      fabricCanvasRef.current.renderAll();
    }
  };

  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      // Clear PDF cache when component unmounts
      if (state.pdfDocument) {
        clearPdfCache(`doc_${state.currentFile?.name || 'current'}`);
      }
      
      // Dispose of Fabric canvas
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
      }
    };
  }, [state.pdfDocument, state.currentFile]);

  return (
    <main className={`main-content ${state.isFullScreen ? 'full-screen-mode' : ''}`}>
      <div className="tools-panel">
        <div className="file-upload-section">
          <h2>画像/PDFアップロード</h2>
          <div
            className="upload-container"
            onDragOver={handleDragOver}
            onDragEnter={(e) => e.preventDefault()}
            onDragLeave={handleDragLeave}
            onDrop={handleFileDrop}
            onClick={(e) => {
              // 直接inputをクリックした場合は重複して発火しないようにする
              if (e.target === document.getElementById('fileInput')) {
                return;
              }
              document.getElementById('fileInput')?.click();
            }}
          >
            <input
              type="file"
              id="fileInput"
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={(e) => e.target.files && e.target.files[0] && handleFileUpload(e.target.files[0])}
              style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
            />
            <div className="upload-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48">
                <path fill="none" d="M0 0h24v24H0z"/>
                <path d="M12 12.586l4.243 4.242-1.415 1.415L13 16.415V22h-2v-5.587l-1.828 1.83-1.415-1.415L12 12.586zM12 2a7.001 7.001 0 0 1 6.954 6.194 5.5 5.5 0 0 1-.953 10.784v-2.014a3.5 3.5 0 1 0-1.112-6.91 5 5 0 1 0-9.777 0 3.5 3.5 0 0 0-1.292 6.88l.18.03v2.014a5.5 5.5 0 0 1-.954-10.784A7 7 0 0 1 12 2z" fill="currentColor"/>
              </svg>
            </div>
            <p>ファイルをドラッグ＆ドロップするか、クリックして選択</p>
          </div>
        </div>
        
        <div className="banner-section">
          <h2>自社バナー管理</h2>
          <div
            className="upload-container"
            onDragOver={handleDragOver}
            onDragEnter={(e) => e.preventDefault()}
            onDragLeave={handleDragLeave}
            onDrop={handleBannerDrop}
            onClick={(e) => {
              // 直接inputをクリックした場合は重複して発火しないようにする
              if (e.target === document.getElementById('bannerInput')) {
                return;
              }
              document.getElementById('bannerInput')?.click();
            }}
          >
            <input
              type="file"
              id="bannerInput"
              accept=".jpg,.jpeg,.png"
              onChange={(e) => e.target.files && e.target.files[0] && handleBannerUpload(e.target.files[0])}
              style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
            />
            <div className="upload-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48">
                <path fill="none" d="M0 0h24v24H0z"/>
                <path d="M4.828 21l-.02.02-.021-.02H2.992A.993.993 0 0 1 2 20.007V3.993A1 1 0 0 1 2.992 3h18.016c.548 0 .992.445.992.993v16.014a1 1 0 0 1-.992.993H4.828zM20 15V5H4v14L14 9l6 6zm0 2.828l-6-6L6.828 19H20v-1.172zM8 11a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" fill="currentColor"/>
              </svg>
            </div>
            <p>バナー画像をアップロード</p>
          </div>
          
          <div className="banner-gallery">
            {state.customBanners.map((banner) => (
              <div 
                key={banner.id} 
                className="banner-item" 
                onClick={() => {
                  if (!state.currentFile) {
                    alert('はじめに不動産物件のファイルをアップロードしてください。');
                    return;
                  }
                  addBannerToCanvas(banner);
                }}
              >
                <img src={banner.src} alt={banner.filename} />
              </div>
            ))}
          </div>
        </div>
        
        <div className="actions-section">
          <h2>操作</h2>
          <div className="action-buttons-grid">
            <button
              className={`action-button ${state.isSelectionMode ? 'primary' : ''}`}
              onClick={toggleSelectionMode}
              title="バナーの選択モードを切り替え"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18">
                <path fill="none" d="M0 0h24v24H0z"/>
                <path d="M10.121 19.121L12 21l7-7h4v-2h-4.101l-7-7-1.879 1.879 5.172 5.172-1.414 1.414-5.172-5.172-4.243 4.243 1.414 1.414 3.95-3.95 5.172 5.172 1.414-1.414-5.172-5.172 3.95-3.95L12 4.222l-7 7H1v2h4z" fill="currentColor"/>
              </svg>
              <span>選択モード</span>
            </button>
            
            <button
              className={`action-button ${state.isFullScreen ? 'primary' : ''}`}
              onClick={toggleFullScreen}
              title={state.isFullScreen ? "全画面モード解除" : "全画面モードに切り替え"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18">
                <path fill="none" d="M0 0h24v24H0z"/>
                {state.isFullScreen ? 
                  <path d="M18 7h4v2h-6V3h2v4zM8 9H2V7h4V3h2v6zm10 8v4h-2v-6h6v2h-4zM8 15v6H6v-4H2v-2h6z" fill="currentColor"/> :
                  <path d="M20 3h2v6h-2V5h-4V3h4zM4 3h4v2H4v4H2V3h2zm16 16v-4h2v6h-6v-2h4zM4 19h4v2H2v-6h2v4z" fill="currentColor"/>
                }
              </svg>
              <span>{state.isFullScreen ? "全画面解除" : "全画面表示"}</span>
            </button>
            
            <button
              className="action-button"
              onClick={deleteSelection}
              title="選択したバナーを削除"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18">
                <path fill="none" d="M0 0h24v24H0z"/>
                <path d="M17 6h5v2h-2v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8H2V6h5V3a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v3zm1 2H6v12h12V8zm-9 3h2v6H9v-6zm4 0h2v6h-2v-6zM9 4v2h6V4H9z" fill="currentColor"/>
              </svg>
              <span>削除</span>
            </button>
            
            <button
              className="action-button"
              onClick={bringBannerToFront}
              title="バナーを前面に移動"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18">
                <path fill="none" d="M0 0h24v24H0z"/>
                <path d="M11 2l7.298 2.28a1 1 0 0 1 .702.955V7h2a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1l-3.22.001c-.387.51-.857.96-1.4 1.33L11 22l-5.38-3.668A6 6 0 0 1 3 13.374V5.235a1 1 0 0 1 .702-.954L11 2zm0 2.094L5 5.97v7.404a4 4 0 0 0 1.558 3.169l.189.136L11 19.58 14.782 17H10a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h7V5.97l-6-1.876zM11 12v3h9v-3h-9zm0-2h9V9h-9v1z" fill="currentColor"/>
              </svg>
              <span>前面へ</span>
            </button>
            
            <button
              className="action-button"
              onClick={sendBannerToBack}
              title="バナーを背面に移動"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18">
                <path fill="none" d="M0 0h24v24H0z"/>
                <path d="M11 12V2l-8.4 8.4c-.8.8-.8 2 0 2.8L11 22v-4.8c0-.5.2-1 .5-1.3l4.5-4.5-4.5-4.5c-.3-.4-.5-.8-.5-1.3V12zm10 0h-3l-4.5 4.5.7.7c.8.8 2 .8 2.8 0L22 12z" fill="currentColor"/>
              </svg>
              <span>背面へ</span>
            </button>
          </div>
          
          <div className="save-buttons">
            <button
              className="action-button primary"
              onClick={saveAsImage}
              title="PNG/JPG形式で保存"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18">
                <path fill="none" d="M0 0h24v24H0z"/>
                <path d="M5 5v14h14V7.828L16.172 5H5zM4 3h13l3.707 3.707a1 1 0 0 1 .293.707V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm8 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6zM6 6h9v4H6V6z" fill="currentColor"/>
              </svg>
              <span>保存 (PNG/JPG)</span>
            </button>
            
            <button
              className="action-button primary"
              onClick={saveAsPDF}
              title="PDF形式で保存"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18">
                <path fill="none" d="M0 0h24v24H0z"/>
                <path d="M12 16H8V8h4a4 4 0 1 1 0 8zm-2-6v4h2a2 2 0 1 0 0-4h-2zm10-3v2H4V7H2V5h20v2h-2zm0 12v2H4v-2H2v-2h20v2h-2z" fill="currentColor"/>
              </svg>
              <span>保存 (PDF)</span>
            </button>
          </div>
        </div>
      </div>
      
      <div className="canvas-container" ref={canvasContainerRef}>
        <div className={`canvas-wrapper ${state.isFullScreen ? 'fullscreen' : ''}`}>
          <canvas ref={canvasRef} id="canvas"></canvas>
          
          {!state.currentFile && (
            <div className="canvas-placeholder">
              <div className="placeholder-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64">
                  <path fill="none" d="M0 0h24v24H0z"/>
                  <path d="M4.828 21l-.02.02-.021-.02H2.992A.993.993 0 0 1 2 20.007V3.993A1 1 0 0 1 2.992 3h18.016c.548 0 .992.445.992.993v16.014a1 1 0 0 1-.992.993H4.828zM20 15V5H4v14L14 9l6 6zm0 2.828l-6-6L6.828 19H20v-1.172zM8 11a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" fill="currentColor"/>
                </svg>
              </div>
              <p>画像またはPDFをアップロードしてください</p>
            </div>
          )}
        </div>
        
        {state.totalPages > 1 && (
          <div className="file-pages">
            {Array.from({ length: state.totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                className={`page-button ${page === state.currentPage ? 'active' : ''}`}
                onClick={() => renderPdfPage(page)}
              >
                {page}
              </button>
            ))}
          </div>
        )}
        
        {state.isFullScreen && (
          <button 
            className="exit-fullscreen-button" 
            onClick={toggleFullScreen}
            title="全画面モード解除"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
              <path fill="none" d="M0 0h24v24H0z"/>
              <path d="M18 7h4v2h-6V3h2v4zM8 9H2V7h4V3h2v6zm10 8v4h-2v-6h6v2h-4zM8 15v6H6v-4H2v-2h6z" fill="currentColor"/>
            </svg>
          </button>
        )}
      </div>
    </main>
  );
};

export default BannerEditor; 
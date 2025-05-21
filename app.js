document.addEventListener('DOMContentLoaded', function() {
    // ユーティリティ関数
    const utils = {
        // ファイル拡張子の取得
        getFileExtension(filename) {
            return filename.split('.').pop().toLowerCase();
        },
        
        // 画像ファイルかどうかを判定
        isImageFile(filename) {
            const ext = this.getFileExtension(filename);
            return ['jpg', 'jpeg', 'png'].includes(ext);
        },
        
        // PDFファイルかどうかを判定
        isPdfFile(filename) {
            return this.getFileExtension(filename) === 'pdf';
        },
        
        // ダウンロードヘルパー
        downloadFile(dataUrl, filename) {
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    // Canvas & Fabric 初期化
    const canvasEl = document.getElementById('canvas');
    let canvas = new fabric.Canvas('canvas', {
        preserveObjectStacking: true,
        selection: false, // 初期状態では選択モードをオフ
        width: 800,
        height: 600
    });
    
    // 状態管理
    let state = {
        currentFile: null,
        currentPage: 0,
        totalPages: 0,
        pdfDocument: null,
        isSelectionMode: false,
        customBanners: [],
        activeBanner: null
    };
    
    // ファイルアップロード処理
    function setupFileUpload() {
        const fileInput = document.getElementById('fileInput');
        const fileDropZone = document.getElementById('fileDropZone');
        
        // クリックでファイル選択
        fileDropZone.addEventListener('click', () => {
            fileInput.click();
        });
        
        // ファイル選択時の処理
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
            }
        });
        
        // ドラッグ＆ドロップ処理
        fileDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            fileDropZone.classList.add('drag-over');
        });
        
        fileDropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            fileDropZone.classList.remove('drag-over');
        });
        
        fileDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            fileDropZone.classList.remove('drag-over');
            
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileUpload(e.dataTransfer.files[0]);
            }
        });
    }
    
    // ファイル処理
    function handleFileUpload(file) {
        resetCanvas();
        state.currentFile = file;
        
        if (utils.isImageFile(file.name)) {
            processImageFile(file);
        } else if (utils.isPdfFile(file.name)) {
            processPdfFile(file);
        } else {
            alert('サポートされていないファイル形式です。JPG、PNG、PDFファイルをアップロードしてください。');
        }
    }
    
    // 画像ファイル処理
    function processImageFile(file) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            fabric.Image.fromURL(e.target.result, function(img) {
                // キャンバスサイズを画像に合わせる
                resizeCanvasToFitImage(img);
                // 画像をキャンバスに配置
                canvas.add(img);
                canvas.renderAll();
            });
        };
        
        reader.readAsDataURL(file);
    }
    
    // PDFファイル処理
    function processPdfFile(file) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const arrayBuffer = e.target.result;
            
            // PDF.js を使用してPDFを読み込む
            pdfjsLib.getDocument(arrayBuffer).promise.then(function(pdf) {
                state.pdfDocument = pdf;
                state.totalPages = pdf.numPages;
                state.currentPage = 1;
                
                // ページナビゲーションを作成
                createPageNavigation();
                
                // 最初のページを表示
                renderPdfPage(1);
            }).catch(function(error) {
                console.error('PDFの読み込み中にエラーが発生しました:', error);
                alert('PDFの読み込み中にエラーが発生しました');
            });
        };
        
        reader.readAsArrayBuffer(file);
    }
    
    // PDFページレンダリング
    function renderPdfPage(pageNumber) {
        state.pdfDocument.getPage(pageNumber).then(function(page) {
            const viewport = page.getViewport({ scale: 1.5 });
            
            // キャンバスサイズをPDFページに合わせる
            canvas.setWidth(viewport.width);
            canvas.setHeight(viewport.height);
            
            // PDFページをレンダリング
            const renderContext = {
                canvasContext: document.createElement('canvas').getContext('2d'),
                viewport: viewport
            };
            
            renderContext.canvasContext.canvas.width = viewport.width;
            renderContext.canvasContext.canvas.height = viewport.height;
            
            page.render(renderContext).promise.then(function() {
                // キャンバスをリセット
                resetCanvas(false);
                
                // レンダリングしたPDFページをFabric.jsのImageオブジェクトに変換
                fabric.Image.fromURL(renderContext.canvasContext.canvas.toDataURL(), function(img) {
                    canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
                        scaleX: canvas.width / img.width,
                        scaleY: canvas.height / img.height
                    });
                });
                
                // ページナビゲーションの状態を更新
                updatePageNavigation(pageNumber);
            });
        });
    }
    
    // PDFページナビゲーション作成
    function createPageNavigation() {
        const pageNav = document.getElementById('pageNavigation');
        pageNav.innerHTML = '';
        
        if (state.totalPages <= 1) {
            pageNav.style.display = 'none';
            return;
        }
        
        pageNav.style.display = 'flex';
        
        for (let i = 1; i <= state.totalPages; i++) {
            const button = document.createElement('button');
            button.classList.add('page-button');
            button.textContent = i;
            
            if (i === 1) {
                button.classList.add('active');
            }
            
            button.addEventListener('click', function() {
                renderPdfPage(i);
            });
            
            pageNav.appendChild(button);
        }
    }
    
    // ページナビゲーション状態更新
    function updatePageNavigation(activePage) {
        const pageButtons = document.querySelectorAll('.page-button');
        
        pageButtons.forEach((button, index) => {
            if (index + 1 === activePage) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }
    
    // Canvas サイズ調整
    function resizeCanvasToFitImage(img) {
        // 画像サイズを取得
        const imgWidth = img.width || img.getScaledWidth();
        const imgHeight = img.height || img.getScaledHeight();
        
        // キャンバスサイズを画像サイズに合わせる
        canvas.setWidth(imgWidth);
        canvas.setHeight(imgHeight);
        
        // 画像をキャンバスの中央に配置
        img.set({
            left: 0,
            top: 0,
            selectable: false,
            evented: false
        });
    }
    
    // キャンバスをリセット
    function resetCanvas(resetSize = true) {
        canvas.clear();
        
        if (resetSize) {
            canvas.setWidth(800);
            canvas.setHeight(600);
        }
        
        canvas.renderAll();
    }
    
    // 自社バナーのアップロード処理
    function setupBannerUpload() {
        const bannerInput = document.getElementById('bannerInput');
        const bannerDropZone = document.getElementById('bannerDropZone');
        const bannerGallery = document.getElementById('bannerGallery');
        
        // クリックでファイル選択
        bannerDropZone.addEventListener('click', () => {
            bannerInput.click();
        });
        
        // ファイル選択時の処理
        bannerInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleBannerUpload(e.target.files[0]);
            }
        });
        
        // ドラッグ＆ドロップ処理
        bannerDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            bannerDropZone.classList.add('drag-over');
        });
        
        bannerDropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            bannerDropZone.classList.remove('drag-over');
        });
        
        bannerDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            bannerDropZone.classList.remove('drag-over');
            
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleBannerUpload(e.dataTransfer.files[0]);
            }
        });
    }
    
    // バナー画像処理
    function handleBannerUpload(file) {
        if (!utils.isImageFile(file.name)) {
            alert('バナーには画像ファイル（JPG、PNG）のみアップロード可能です。');
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            // バナーをカスタムバナーリストに追加
            const bannerId = 'banner-' + Date.now();
            state.customBanners.push({
                id: bannerId,
                src: e.target.result,
                filename: file.name
            });
            
            // バナーギャラリーを更新
            updateBannerGallery();
        };
        
        reader.readAsDataURL(file);
    }
    
    // バナーギャラリー更新
    function updateBannerGallery() {
        const gallery = document.getElementById('bannerGallery');
        gallery.innerHTML = '';
        
        state.customBanners.forEach(banner => {
            const bannerEl = document.createElement('div');
            bannerEl.classList.add('banner-item');
            bannerEl.dataset.id = banner.id;
            
            const img = document.createElement('img');
            img.src = banner.src;
            img.alt = banner.filename;
            
            bannerEl.appendChild(img);
            
            // バナーがクリックされたときの処理
            bannerEl.addEventListener('click', () => {
                if (!state.currentFile) {
                    alert('はじめに不動産物件のファイルをアップロードしてください。');
                    return;
                }
                
                // クリックされたバナーを選択状態にする
                document.querySelectorAll('.banner-item').forEach(item => {
                    item.classList.remove('selected');
                });
                bannerEl.classList.add('selected');
                
                // バナーを追加
                addBannerToCanvas(banner);
            });
            
            gallery.appendChild(bannerEl);
        });
    }
    
    // バナーをキャンバスに追加
    function addBannerToCanvas(banner) {
        fabric.Image.fromURL(banner.src, function(img) {
            // バナーのサイズを適切に調整（最大幅を元の画像幅の1/3くらいに）
            const maxWidth = canvas.width / 3;
            
            if (img.width > maxWidth) {
                const scale = maxWidth / img.width;
                img.scale(scale);
            }
            
            // バナー画像の属性設定
            img.set({
                left: 50,
                top: 50,
                cornerColor: 'rgba(69, 98, 255, 0.8)',
                cornerStrokeColor: '#fff',
                borderColor: 'rgba(69, 98, 255, 0.8)',
                cornerSize: 12,
                transparentCorners: false,
                centeredScaling: true,
                customId: banner.id
            });
            
            // バナーを選択状態にする
            canvas.discardActiveObject();
            canvas.add(img);
            canvas.setActiveObject(img);
            
            // アクティブバナーを更新
            state.activeBanner = img;
            
            canvas.renderAll();
        });
    }
    
    // 選択モード切り替え
    function setupSelectionMode() {
        const selectModeButton = document.getElementById('selectMode');
        
        selectModeButton.addEventListener('click', () => {
            state.isSelectionMode = !state.isSelectionMode;
            
            if (state.isSelectionMode) {
                // 選択モードをオン
                canvas.selection = true;
                selectModeButton.classList.add('primary');
                enableObjectDetection();
            } else {
                // 選択モードをオフ
                canvas.selection = false;
                selectModeButton.classList.remove('primary');
                disableObjectDetection();
            }
        });
    }
    
    // オブジェクト検出を有効化
    function enableObjectDetection() {
        // キャンバス上の全オブジェクトを選択可能にする
        canvas.forEachObject(function(obj) {
            if (!obj.customId) { // 追加したバナー以外のオブジェクト
                obj.selectable = true;
                obj.evented = true;
            }
        });
    }
    
    // オブジェクト検出を無効化
    function disableObjectDetection() {
        // バナー以外のオブジェクトを選択不可にする
        canvas.forEachObject(function(obj) {
            if (!obj.customId) { // 追加したバナー以外のオブジェクト
                obj.selectable = false;
                obj.evented = false;
            }
        });
    }
    
    // 削除ボタン処理
    function setupDeleteButton() {
        const deleteButton = document.getElementById('deleteSelection');
        
        deleteButton.addEventListener('click', () => {
            const activeObject = canvas.getActiveObject();
            
            if (activeObject) {
                canvas.remove(activeObject);
                canvas.discardActiveObject();
                canvas.renderAll();
            } else {
                alert('削除するオブジェクトを選択してください。');
            }
        });
    }
    
    // 画像保存処理
    function setupSaveImage() {
        const saveImageButton = document.getElementById('saveImage');
        
        saveImageButton.addEventListener('click', () => {
            if (!state.currentFile) {
                alert('保存するファイルがありません。');
                return;
            }
            
            // 保存形式を選択するダイアログを表示
            const format = prompt("保存形式を選択してください（png または jpg）:", "png");
            
            if (format && (format.toLowerCase() === 'png' || format.toLowerCase() === 'jpg')) {
                // 全てのオブジェクトを選択解除
                canvas.discardActiveObject();
                canvas.renderAll();
                
                // ファイル名の生成
                const originalFilename = state.currentFile.name.split('.')[0];
                const newFilename = `${originalFilename}_edited.${format.toLowerCase()}`;
                
                // 画像として保存
                const dataUrl = canvas.toDataURL({
                    format: format.toLowerCase() === 'jpg' ? 'jpeg' : 'png',
                    quality: 1
                });
                
                utils.downloadFile(dataUrl, newFilename);
            }
        });
    }
    
    // PDF保存処理
    function setupSavePDF() {
        const savePDFButton = document.getElementById('savePDF');
        
        savePDFButton.addEventListener('click', () => {
            if (!state.currentFile) {
                alert('保存するファイルがありません。');
                return;
            }
            
            // PDFの場合、現在のページを画像に変換して保存
            // 注: 本格的なPDF編集・出力機能を実装するにはPDF.jsとjsPDFの両方を使用する必要があります
            
            alert('PDF出力機能は現在開発中です。画像として保存してください。');
            // ここでは簡易的に現在のページを画像として保存
            
            // 全てのオブジェクトを選択解除
            canvas.discardActiveObject();
            canvas.renderAll();
            
            // ファイル名の生成
            const originalFilename = state.currentFile.name.split('.')[0];
            const newFilename = `${originalFilename}_edited.png`;
            
            // 画像として保存
            const dataUrl = canvas.toDataURL({
                format: 'png',
                quality: 1
            });
            
            utils.downloadFile(dataUrl, newFilename);
        });
    }
    
    // 初期化
    function init() {
        setupFileUpload();
        setupBannerUpload();
        setupSelectionMode();
        setupDeleteButton();
        setupSaveImage();
        setupSavePDF();
    }
    
    // アプリを初期化
    init();
}); 
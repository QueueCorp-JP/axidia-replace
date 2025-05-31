import React, { useState, useEffect, useRef } from 'react';

interface SpotlightTutorialProps {
  onComplete?: () => void;
}

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  target: string;
  actionType: 'auto' | 'click' | 'upload' | 'drag' | 'save' | 'manual';
  waitFor?: string; // DOM変化やイベントを待つ
  timeout?: number;
  hints?: string[];
  highlightElements?: string[];
}

const SpotlightTutorial: React.FC<SpotlightTutorialProps> = ({ onComplete }) => {
  const [run, setRun] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [actionCompleted, setActionCompleted] = useState(false);
  const [currentHintIndex, setCurrentHintIndex] = useState(0);
  const [spotlightPositions, setSpotlightPositions] = useState<Array<{top: number, left: number, width: number, height: number}>>([]);
  
  const timeoutRef = useRef<number | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const hintTimeoutRef = useRef<number | null>(null);
  const spotlightUpdateRef = useRef<number | null>(null);

  const tutorialSteps: TutorialStep[] = [
    {
      id: 'welcome',
      title: "🎉 実際のワークフローを体験しよう！",
      description: "不動産バナー置換ツールの完全なワークフローを一緒に実行してみましょう。実際にファイルをアップロードして編集していきます。",
      target: "body",
      actionType: 'auto',
      timeout: 4000
    },
    {
      id: 'file-upload',
      title: "📁 ファイルをアップロードしてください",
      description: "まず、編集したい画像やPDFファイルをアップロードしましょう。「ファイルを選択」ボタンをクリックしてください。",
      target: ".file-upload-section input[type='file']",
      actionType: 'upload',
      waitFor: 'file-selected',
      timeout: 60000,
      hints: [
        "📄 画像ファイル（JPG、PNG）またはPDFファイルを選択してください",
        "💡 ドラッグ&ドロップでもアップロードできます",
        "⚠️ ファイルサイズは150MB以下にしてください"
      ],
      highlightElements: [".file-upload-section"]
    },
    {
      id: 'wait-upload-process',
      title: "⏳ ファイル処理中...",
      description: "ファイルが正常にアップロードされました！処理が完了するまでお待ちください。",
      target: ".canvas-container",
      actionType: 'manual',
      waitFor: 'canvas-ready',
      timeout: 30000
    },
    {
      id: 'banner-upload',
      title: "🏷️ 自社バナーをアップロードしてください",
      description: "次に、配置したい自社バナーをアップロードしましょう。バナー管理セクションの「バナーアップロード」をクリックしてください。",
      target: ".banner-section input[type='file']",
      actionType: 'upload',
      waitFor: 'banner-uploaded',
      timeout: 60000,
      hints: [
        "🎨 PNG形式のバナー画像が推奨です",
        "📏 透明背景のバナーだと綺麗に配置できます",
        "💡 複数のバナーをアップロードして比較できます"
      ],
      highlightElements: [".banner-section"]
    },
    {
      id: 'banner-placement',
      title: "🎯 バナーを配置してください",
      description: "アップロードしたバナーをクリックして、編集エリアに配置してください。バナーが一覧に表示されているはずです。",
      target: ".banner-item",
      actionType: 'click',
      waitFor: 'banner-placed',
      timeout: 60000,
      hints: [
        "👆 バナー画像をクリックすると編集エリアに配置されます",
        "🎯 複数のバナーがある場合は好きなものを選んでください",
        "📍 配置後は自由に移動・リサイズできます"
      ],
      highlightElements: [".banner-list", ".canvas-container"]
    },
    {
      id: 'banner-editing',
      title: "✏️ バナーを編集してみましょう",
      description: "配置されたバナーをドラッグして移動したり、角をドラッグしてサイズを調整してみてください。編集ツールも活用できます。",
      target: ".canvas-container canvas",
      actionType: 'drag',
      waitFor: 'banner-moved',
      timeout: 90000,
      hints: [
        "🖱️ バナーをドラッグして好きな位置に移動してください",
        "📏 角をドラッグしてサイズを調整できます", 
        "🛠️ 左側の編集ツールも使用できます",
        "🎯 選択モードを有効にすると編集しやすくなります"
      ],
      highlightElements: [".canvas-container", ".actions-section"]
    },
    {
      id: 'save-work',
      title: "💾 作品を保存してください",
      description: "編集が完了したら作品を保存しましょう。「PNGで保存」「JPGで保存」「PDFで保存」のいずれかをクリックしてください。",
      target: ".save-buttons button",
      actionType: 'save',
      waitFor: 'file-saved',
      timeout: 60000,
      hints: [
        "💾 PNG: 高品質、透明背景対応",
        "📄 JPG: 軽量、一般的な形式",
        "📋 PDF: 印刷用、プロフェッショナル",
        "💡 用途に応じて最適な形式を選んでください"
      ],
      highlightElements: [".save-buttons"]
    },
    {
      id: 'completion',
      title: "🎊 ワークフロー完了！",
      description: "おめでとうございます！不動産バナー置換ツールの完全なワークフローを体験しました。これで実際の作業に取り組む準備が整いました！",
      target: "body",
      actionType: 'auto',
      timeout: 5000
    }
  ];

  // 自動初期化
  useEffect(() => {
    const timer = setTimeout(() => {
      const hasSeenInteractiveTutorial = localStorage.getItem('hasSeenInteractiveTutorial');
      if (!hasSeenInteractiveTutorial) {
        console.log('🚀 Starting interactive tutorial...');
        startTutorial();
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // ステップ変更時の処理
  useEffect(() => {
    if (run && isVisible) {
      const currentStepData = tutorialSteps[currentStep];
      console.log(`🎯 Starting step: ${currentStepData.title}`);
      
      // リセット
      setIsWaiting(false);
      setActionCompleted(false);
      setShowHint(false);
      setCurrentHintIndex(0);
      
      // タイムアウトをクリア
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (hintTimeoutRef.current) {
        clearTimeout(hintTimeoutRef.current);
      }
      
      // ステップ処理
      handleStepAction(currentStepData);
    }
  }, [run, currentStep, isVisible]);

  // ステップアクションの処理
  const handleStepAction = (step: TutorialStep) => {
    switch (step.actionType) {
      case 'auto':
        // 自動進行
        timeoutRef.current = setTimeout(() => {
          nextStep();
        }, step.timeout || 4000);
        break;
        
      case 'upload':
      case 'click':
      case 'drag':
      case 'save':
      case 'manual':
        // ユーザーの操作を待つ
        setIsWaiting(true);
        startWaitingForAction(step);
        break;
    }
  };

  // アクション待機の開始
  const startWaitingForAction = (step: TutorialStep) => {
    console.log(`⏳ Waiting for action: ${step.waitFor}`);
    
    // ファイルアップロード待機の場合は完了フラグをクリア
    if (step.waitFor === 'file-selected') {
      document.body.removeAttribute('data-file-processed');
    }
    
    // ヒント表示のタイマー
    if (step.hints && step.hints.length > 0) {
      hintTimeoutRef.current = setTimeout(() => {
        setShowHint(true);
        cycleHints(step.hints!);
      }, 10000); // 10秒後にヒント表示
    }
    
    // タイムアウト設定
    if (step.timeout) {
      timeoutRef.current = setTimeout(() => {
        console.log('⏰ Step timeout reached');
        setShowHint(true);
        setCurrentHintIndex(0);
      }, step.timeout);
    }
    
    // DOM監視開始
    startDOMObserver(step);
  };

  // ヒントのサイクル表示
  const cycleHints = (hints: string[]) => {
    let index = 0;
    const interval = setInterval(() => {
      setCurrentHintIndex(index);
      index = (index + 1) % hints.length;
    }, 5000);
    
    // 後でクリアできるようにrefに保存
    hintTimeoutRef.current = interval;
  };

  // DOM変化の監視
  const startDOMObserver = (step: TutorialStep) => {
    if (!step.waitFor) return;
    
    // 既存のオブザーバーを停止
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    
    const observer = new MutationObserver(() => {
      checkForStepCompletion(step);
    });
    
    // DOM全体を監視
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: true
    });
    
    observerRef.current = observer;
    
    // 初期チェック
    setTimeout(() => checkForStepCompletion(step), 1000);
  };

  // ステップ完了チェック
  const checkForStepCompletion = (step: TutorialStep) => {
    if (actionCompleted) return;
    
    let completed = false;
    
    switch (step.waitFor) {
      case 'file-selected':
        // ファイル入力の変化を検知
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        completed = Boolean(fileInput?.files && fileInput.files.length > 0);
        break;
        
      case 'canvas-ready':
        // キャンバスにコンテンツが表示されたか
        const canvas = document.querySelector('.canvas-container canvas');
        const loadingIndicators = document.querySelectorAll('.loading-indicator');
        
        // 詳細なデバッグ情報を収集
        console.log('🔍 Canvas ready detailed check:');
        
        // 1. ローディングインジケータチェック
        const noLoadingIndicators = loadingIndicators.length === 0;
        console.log('  📊 Loading indicators:', loadingIndicators.length, Array.from(loadingIndicators).map(el => el.id || el.className));
        
        // 2. 完了フラグチェック
        const hasCompletionFlag = document.body.hasAttribute('data-file-processed');
        console.log('  🏁 Completion flag:', hasCompletionFlag);
        
        // 3. キャンバス存在チェック
        const canvasExists = Boolean(canvas);
        console.log('  🎨 Canvas exists:', canvasExists);
        
        // 4. Fabric.jsオブジェクトチェック
        let canvasHasContent = false;
        let fabricObjectCount = 0;
        try {
          const fabricCanvas = (window as any).__fabricCanvas;
          if (fabricCanvas && fabricCanvas.getObjects) {
            const objects = fabricCanvas.getObjects();
            fabricObjectCount = objects.length;
            canvasHasContent = objects.length > 0;
            console.log('  🔧 Fabric objects:', fabricObjectCount, objects.map((obj: any) => obj.type || 'unknown'));
          } else {
            console.log('  ⚠️ Fabric canvas not available via global reference');
          }
        } catch (e) {
          console.log('  ❌ Fabric canvas access error:', e);
        }
        
        // 5. DOM要素でのフォールバック検知
        const fabricElements = document.querySelectorAll('.canvas-container .upper-canvas, .canvas-container canvas[data-fabric]');
        const hasFabricElements = fabricElements.length > 0;
        console.log('  🎯 Fabric DOM elements:', fabricElements.length);
        
        // 6. グローバル状態チェック
        let hasCurrentFile = false;
        let currentFileName = '';
        try {
          const appState = (window as any).__appState;
          hasCurrentFile = Boolean(appState?.currentFile);
          currentFileName = appState?.currentFile?.name || '';
          console.log('  📁 App state - current file:', hasCurrentFile, currentFileName);
        } catch (e) {
          console.log('  ⚠️ App state not available:', e);
          hasCurrentFile = true; // フォールバック
        }
        
        // 7. キャンバスの背景画像チェック
        let hasBackgroundImage = false;
        try {
          const fabricCanvas = (window as any).__fabricCanvas;
          if (fabricCanvas && fabricCanvas.backgroundImage) {
            hasBackgroundImage = Boolean(fabricCanvas.backgroundImage);
            console.log('  🖼️ Canvas background image:', hasBackgroundImage);
          }
        } catch (e) {
          // ignore
        }
        
        // 8. より柔軟な完了条件
        // 以下のいずれかが満たされれば完了とみなす
        const conditions = {
          // 条件A: 完了フラグが設定されている
          flagComplete: hasCompletionFlag,
          
          // 条件B: ローディングが完了し、キャンバスにコンテンツがある
          contentComplete: noLoadingIndicators && canvasExists && (canvasHasContent || hasBackgroundImage),
          
          // 条件C: ローディングが完了し、アプリ状態にファイルがある
          stateComplete: noLoadingIndicators && canvasExists && hasCurrentFile,
          
          // 条件D: Fabric要素が検出された（DOM ベースのフォールバック）
          fabricElementsDetected: noLoadingIndicators && canvasExists && hasFabricElements,
          
          // 条件E: 強制的に5秒経過後（最後の手段）
          timeElapsed: false // これは別途タイマーで管理
        };
        
        completed = conditions.flagComplete || conditions.contentComplete || conditions.stateComplete || conditions.fabricElementsDetected;
        
        console.log('  ✅ Completion conditions:', conditions);
        console.log('  🎯 Final result:', completed);
        
        // 完了フラグをクリア（次回用）
        if (completed && hasCompletionFlag) {
          document.body.removeAttribute('data-file-processed');
          console.log('  🧹 Cleared completion flag');
        }
        
        // まだ完了していない場合の追加情報
        if (!completed) {
          console.log('  ❓ Waiting for:', {
            needsNoLoading: !noLoadingIndicators,
            needsCanvas: !canvasExists,
            needsContent: !canvasHasContent && !hasBackgroundImage,
            needsFile: !hasCurrentFile,
            needsFabricElements: !hasFabricElements
          });
          
          // 5秒経過後の強制完了チェック用タイマー設定
          if (!timeoutRef.current) {
            console.log('  ⏰ Setting emergency completion timer (5s)');
            timeoutRef.current = setTimeout(() => {
              console.log('  🚨 Emergency completion triggered');
              setActionCompleted(true);
              setIsWaiting(false);
              setShowHint(false);
              setTimeout(() => nextStep(), 1000);
            }, 5000);
          }
        }
        break;
        
      case 'banner-uploaded':
        // バナーがアップロードされた
        const bannerItems = document.querySelectorAll('.banner-item');
        completed = bannerItems.length > 0;
        break;
        
      case 'banner-placed':
        // バナーがキャンバスに配置された
        const canvasObjects = document.querySelectorAll('.canvas-container .upper-canvas');
        completed = Boolean(canvasObjects.length > 0);
        // またはfabric.jsのオブジェクト数をチェック
        break;
        
      case 'banner-moved':
        // バナーが移動またはリサイズされた
        // この検知は難しいので、一定時間の操作を検知
        completed = true; // 暫定的に即座に完了とする
        break;
        
      case 'file-saved':
        // ファイル保存が実行された（ダウンロードリンクのクリックを検知）
        const saveButtons = document.querySelectorAll('.save-buttons button');
        completed = Array.from(saveButtons).some(btn => 
          (btn as HTMLElement).style.pointerEvents === 'none' || 
          (btn as HTMLElement).hasAttribute('disabled')
        );
        break;
    }
    
    if (completed && !actionCompleted) {
      console.log(`✅ Step completed: ${step.waitFor}`);
      setActionCompleted(true);
      setIsWaiting(false);
      setShowHint(false);
      
      // タイマーをクリア
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (hintTimeoutRef.current) {
        clearTimeout(hintTimeoutRef.current);
        hintTimeoutRef.current = null;
      }
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      
      // 次のステップへ進む（少し遅延を入れる）
      setTimeout(() => {
        nextStep();
      }, 2000);
    }
  };

  const startTutorial = () => {
    console.log('🎯 Starting interactive tutorial...');
    setRun(true);
    setCurrentStep(0);
    setIsVisible(true);
  };

  const completeTutorial = () => {
    setRun(false);
    setIsVisible(false);
    setIsWaiting(false);
    setActionCompleted(false);
    localStorage.setItem('hasSeenInteractiveTutorial', 'true');
    localStorage.setItem('interactiveTutorialCompletedAt', new Date().toISOString());
    
    // 全てのタイマーをクリア
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (hintTimeoutRef.current) {
      clearTimeout(hintTimeoutRef.current);
    }
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    
    if (onComplete) {
      onComplete();
    }
  };

  const resetTutorial = () => {
    console.log('🔄 Resetting interactive tutorial...');
    localStorage.removeItem('hasSeenInteractiveTutorial');
    localStorage.removeItem('interactiveTutorialCompletedAt');
    setRun(false);
    setIsVisible(false);
    setIsWaiting(false);
    setActionCompleted(false);
    setCurrentStep(0);
    setTimeout(() => startTutorial(), 500);
  };

  const skipTutorial = () => {
    console.log('⏭️ Skipping interactive tutorial...');
    completeTutorial();
  };

  const nextStep = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeTutorial();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const forceNext = () => {
    console.log('🚀 Force advancing to next step...');
    setActionCompleted(true);
    setIsWaiting(false);
    setShowHint(false);
    
    // タイマーをクリア
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (hintTimeoutRef.current) {
      clearTimeout(hintTimeoutRef.current);
    }
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    
    setTimeout(() => nextStep(), 500);
  };

  // スポットライト位置更新関数
  const updateSpotlightPositions = () => {
    const currentStepData = tutorialSteps[currentStep];
    if (!currentStepData.highlightElements) {
      setSpotlightPositions([]);
      return;
    }

    const positions = currentStepData.highlightElements.map(selector => {
      const element = document.querySelector(selector);
      if (!element) return null;
      
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top - 10,
        left: rect.left - 10,
        width: rect.width + 20,
        height: rect.height + 20
      };
    }).filter(pos => pos !== null) as Array<{top: number, left: number, width: number, height: number}>;

    setSpotlightPositions(positions);
  };

  // スクロールイベントのハンドラー
  useEffect(() => {
    if (!run || !isVisible) return;

    // 初期位置設定
    updateSpotlightPositions();

    // スクロールイベントで位置更新
    const handleScroll = () => {
      if (spotlightUpdateRef.current) {
        cancelAnimationFrame(spotlightUpdateRef.current);
      }
      spotlightUpdateRef.current = requestAnimationFrame(updateSpotlightPositions);
    };

    // リサイズイベントでも位置更新
    const handleResize = () => {
      if (spotlightUpdateRef.current) {
        cancelAnimationFrame(spotlightUpdateRef.current);
      }
      spotlightUpdateRef.current = requestAnimationFrame(updateSpotlightPositions);
    };

    // イベントリスナー追加
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true });

    // 定期的な位置更新（DOM変化に対応）
    const intervalId = setInterval(updateSpotlightPositions, 1000);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('scroll', handleScroll);
      clearInterval(intervalId);
      if (spotlightUpdateRef.current) {
        cancelAnimationFrame(spotlightUpdateRef.current);
      }
    };
  }, [run, isVisible, currentStep]);

  if (!run || !isVisible) {
    return (
      <>
        {/* チュートリアル操作パネル */}
        <div style={{ 
          position: 'fixed', 
          bottom: '20px', 
          right: '20px', 
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          {/* メインチュートリアルボタン */}
          <button
            onClick={startTutorial}
            className="tutorial-button"
            style={{
              background: 'linear-gradient(135deg, #10B981 0%, #059669 50%, #047857 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '80px',
              height: '80px',
              fontSize: '16px',
              cursor: 'pointer',
              boxShadow: '0 8px 32px rgba(16, 185, 129, 0.4), 0 0 0 0 rgba(16, 185, 129, 0.6)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '600',
              position: 'relative',
              overflow: 'hidden',
              animation: 'tutorial-glow 3s ease-in-out infinite'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #059669 0%, #047857 50%, #065f46 100%)';
              e.currentTarget.style.transform = 'scale(1.15) rotate(10deg)';
              e.currentTarget.style.boxShadow = '0 12px 40px rgba(16, 185, 129, 0.6), 0 0 0 8px rgba(16, 185, 129, 0.2)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #10B981 0%, #059669 50%, #047857 100%)';
              e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(16, 185, 129, 0.4), 0 0 0 0 rgba(16, 185, 129, 0.6)';
            }}
            title="🎯 ガイド付きチュートリアルを開始"
          >
            <div style={{ fontSize: '24px', marginBottom: '2px' }}>🎯</div>
            <div style={{ fontSize: '10px', lineHeight: '1' }}>START</div>
          </button>
          
          {/* リセットボタン */}
          <button
            onClick={resetTutorial}
            style={{
              background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 50%, #B91C1C 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '50px',
              height: '50px',
              fontSize: '16px',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(239, 68, 68, 0.3)',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '600'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #DC2626 0%, #B91C1C 50%, #991B1B 100%)';
              e.currentTarget.style.transform = 'scale(1.1) rotate(-5deg)';
              e.currentTarget.style.boxShadow = '0 6px 25px rgba(239, 68, 68, 0.5)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #EF4444 0%, #DC2626 50%, #B91C1C 100%)';
              e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(239, 68, 68, 0.3)';
            }}
            title="🔄 チュートリアルリセット"
          >
            🔄
          </button>
        </div>
        
        {/* 初回ユーザー向けウェルカムメッセージ */}
        {!localStorage.getItem('hasSeenInteractiveTutorial') && (
          <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            color: 'white',
            padding: '16px 24px',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(16, 185, 129, 0.3)',
            zIndex: 999,
            fontSize: '14px',
            fontWeight: '600',
            animation: 'welcome-pulse 2s infinite',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '20px' }}>🎯</span>
            <div>
              <div style={{ fontSize: '16px', marginBottom: '2px' }}>ガイド付きチュートリアル</div>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>実際のワークフローを体験しよう！</div>
            </div>
          </div>
        )}
      </>
    );
  }

  const currentStepData = tutorialSteps[currentStep];
  const progress = ((currentStep + 1) / tutorialSteps.length) * 100;
  const currentHint = currentStepData.hints?.[currentHintIndex];

  return (
    <>
      {/* オーバーレイ */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.25)',
        zIndex: 10000,
        pointerEvents: isWaiting ? 'none' : 'auto'
      }} />

      {/* スポットライト効果 */}
      {spotlightPositions.map((position, index) => {
        return (
          <div
            key={index}
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              width: position.width,
              height: position.height,
              border: '3px solid #10B981',
              borderRadius: '8px',
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.25)',
              zIndex: 10000,
              pointerEvents: 'none',
              animation: 'spotlight-pulse 2s infinite'
            }}
          />
        );
      })}

      {/* チュートリアルダイアログ */}
      <div style={{
        position: 'fixed',
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '700px',
        width: '90%',
        zIndex: 10001,
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
        textAlign: 'center',
        maxHeight: '80vh',
        overflowY: 'auto'
      }}>
        {/* プログレスバー */}
        <div style={{
          width: '100%',
          height: '6px',
          backgroundColor: '#E5E7EB',
          borderRadius: '3px',
          marginBottom: '24px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            backgroundColor: '#10B981',
            borderRadius: '3px',
            transition: 'width 0.5s ease'
          }} />
        </div>

        {/* ステップ情報 */}
        <div style={{
          fontSize: '14px',
          color: '#6B7280',
          marginBottom: '16px'
        }}>
          ステップ {currentStep + 1} / {tutorialSteps.length}
        </div>

        {/* タイトル */}
        <h2 style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#1F2937',
          marginBottom: '16px',
          lineHeight: 1.3
        }}>
          {currentStepData.title}
        </h2>

        {/* 説明 */}
        <p style={{
          fontSize: '16px',
          color: '#4B5563',
          lineHeight: 1.6,
          marginBottom: '24px'
        }}>
          {currentStepData.description}
        </p>

        {/* 待機状態インジケーター */}
        {isWaiting && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
            gap: '8px',
            padding: '12px',
            backgroundColor: '#FEF3C7',
            borderRadius: '8px',
            border: '1px solid #F59E0B'
          }}>
            <div style={{
              width: '12px',
              height: '12px',
              backgroundColor: '#F59E0B',
              borderRadius: '50%',
              animation: 'pulse 1.5s infinite'
            }} />
            <span style={{ fontSize: '14px', color: '#92400E', fontWeight: '500' }}>
              あなたの操作をお待ちしています...
            </span>
          </div>
        )}

        {/* ヒント表示 */}
        {showHint && currentHint && (
          <div style={{
            backgroundColor: '#EFF6FF',
            border: '1px solid #3B82F6',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px',
            textAlign: 'left'
          }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#1E40AF', marginBottom: '8px' }}>
              💡 ヒント:
            </div>
            <div style={{ fontSize: '14px', color: '#1E40AF' }}>
              {currentHint}
            </div>
          </div>
        )}

        {/* コントロールボタン */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px'
        }}>
          <button
            onClick={prevStep}
            disabled={currentStep === 0}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid #D1D5DB',
              backgroundColor: currentStep === 0 ? '#F3F4F6' : 'white',
              color: currentStep === 0 ? '#9CA3AF' : '#374151',
              cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            ← 戻る
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={skipTutorial}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#F3F4F6',
                color: '#6B7280',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              スキップ
            </button>

            {isWaiting && (
              <button
                onClick={forceNext}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '1px solid #F59E0B',
                  backgroundColor: '#FEF3C7',
                  color: '#92400E',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                強制的に次へ
              </button>
            )}
          </div>

          <button
            onClick={nextStep}
            disabled={isWaiting && !actionCompleted}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: (isWaiting && !actionCompleted) ? '#F3F4F6' : '#10B981',
              color: (isWaiting && !actionCompleted) ? '#9CA3AF' : 'white',
              cursor: (isWaiting && !actionCompleted) ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {currentStep === tutorialSteps.length - 1 ? '完了 🎉' : '次へ →'}
          </button>
        </div>
      </div>

      {/* アニメーションスタイル */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          
          @keyframes tutorial-glow {
            0%, 100% { 
              box-shadow: 0 8px 32px rgba(16, 185, 129, 0.4), 0 0 0 0 rgba(16, 185, 129, 0.6);
            }
            50% { 
              box-shadow: 0 8px 32px rgba(16, 185, 129, 0.6), 0 0 0 4px rgba(16, 185, 129, 0.3);
            }
          }
          
          @keyframes welcome-pulse {
            0%, 100% { 
              transform: scale(1);
              box-shadow: 0 8px 32px rgba(16, 185, 129, 0.3);
            }
            50% { 
              transform: scale(1.02);
              box-shadow: 0 12px 40px rgba(16, 185, 129, 0.4);
            }
          }
          
          @keyframes spotlight-pulse {
            0%, 100% { 
              border-color: #10B981;
              box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.25), 0 0 20px #10B981;
            }
            50% { 
              border-color: #34D399;
              box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.25), 0 0 40px #34D399;
            }
          }
        `}
      </style>
    </>
  );
};

export default SpotlightTutorial; 
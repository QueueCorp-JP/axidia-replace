import React, { useState, useEffect } from 'react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

interface UploadFile {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
}

interface UploadProgressBarProps {
  files: File[];
  onUploadComplete?: (results: UploadFile[]) => void;
  maxCapacity?: number; // MB単位
  visible?: boolean;
}

const UploadProgressBar: React.FC<UploadProgressBarProps> = ({
  files,
  onUploadComplete,
  maxCapacity = 100, // デフォルト100MB
  visible = false
}) => {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [totalProgress, setTotalProgress] = useState(0);

  // ファイルサイズをMB単位で計算
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 総ファイルサイズを計算
  const getTotalSize = (): number => {
    return files.reduce((total, file) => total + file.size, 0) / (1024 * 1024); // MB単位
  };

  // 容量チェック
  const isCapacityExceeded = (): boolean => {
    return getTotalSize() > maxCapacity;
  };

  // ファイルアップロードのシミュレーション
  const simulateUpload = (fileId: string): Promise<void> => {
    return new Promise((resolve) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15 + 5; // 5-20%ずつ進捗
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setUploadFiles(prev => prev.map(f => 
            f.id === fileId 
              ? { ...f, progress: 100, status: 'completed' }
              : f
          ));
          resolve();
        } else {
          setUploadFiles(prev => prev.map(f => 
            f.id === fileId 
              ? { ...f, progress: Math.min(progress, 100), status: 'uploading' }
              : f
          ));
        }
      }, 200 + Math.random() * 300); // 200-500ms間隔
    });
  };

  // アップロード開始
  const startUpload = async () => {
    if (isCapacityExceeded()) {
      alert(`ファイル容量が制限(${maxCapacity}MB)を超えています。ファイルサイズを確認してください。`);
      return;
    }

    // ファイルを初期化
    const initialFiles: UploadFile[] = files.map(file => ({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'pending'
    }));
    
    setUploadFiles(initialFiles);

    // 並列アップロード（最大3ファイル同時）
    const uploadPromises = initialFiles.map(async (uploadFile, index) => {
      // 少し遅延させて順次開始
      await new Promise(resolve => setTimeout(resolve, index * 100));
      return simulateUpload(uploadFile.id);
    });

    try {
      await Promise.all(uploadPromises);
      if (onUploadComplete) {
        onUploadComplete(uploadFiles);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  // 総進捗の計算
  useEffect(() => {
    if (uploadFiles.length > 0) {
      const totalProgress = uploadFiles.reduce((sum, file) => sum + file.progress, 0) / uploadFiles.length;
      setTotalProgress(totalProgress);
    }
  }, [uploadFiles]);

  // ファイルが変更された時にアップロード開始
  useEffect(() => {
    if (files.length > 0 && visible) {
      startUpload();
    }
  }, [files, visible]);

  if (!visible || files.length === 0) {
    return null;
  }

  return (
    <div className="upload-progress-container" style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '30px',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
      zIndex: 9999,
      minWidth: '400px',
      maxWidth: '500px',
    }}>
      {/* ヘッダー */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#374151' }}>
          📤 ファイルアップロード中
        </h3>
        <div style={{ fontSize: '14px', color: '#6B7280' }}>
          {uploadFiles.filter(f => f.status === 'completed').length} / {uploadFiles.length} 完了
        </div>
      </div>

      {/* 総進捗の円形プログレスバー */}
      <div style={{ 
        width: '120px', 
        height: '120px', 
        margin: '0 auto 20px',
        position: 'relative'
      }}>
        <CircularProgressbar
          value={totalProgress}
          text={`${Math.round(totalProgress)}%`}
          styles={buildStyles({
            textSize: '16px',
            pathColor: totalProgress === 100 ? '#10B981' : '#3B82F6',
            textColor: '#374151',
            trailColor: '#E5E7EB',
            backgroundColor: '#F3F4F6',
          })}
        />
      </div>

      {/* 容量情報 */}
      <div style={{
        backgroundColor: '#F9FAFB',
        padding: '12px',
        borderRadius: '8px',
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>
          使用容量
        </div>
        <div style={{ 
          fontSize: '14px', 
          fontWeight: 'bold',
          color: isCapacityExceeded() ? '#EF4444' : '#374151'
        }}>
          {formatFileSize(getTotalSize() * 1024 * 1024)} / {maxCapacity}MB
        </div>
        {isCapacityExceeded() && (
          <div style={{ fontSize: '12px', color: '#EF4444', marginTop: '4px' }}>
            ⚠️ 容量制限を超えています
          </div>
        )}
      </div>

      {/* 個別ファイルの進捗 */}
      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
        {uploadFiles.map((file) => (
          <div key={file.id} style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 0',
            borderBottom: '1px solid #E5E7EB'
          }}>
            {/* ファイル状態アイコン */}
            <div style={{ marginRight: '12px', fontSize: '16px' }}>
              {file.status === 'completed' && '✅'}
              {file.status === 'uploading' && '⏳'}
              {file.status === 'pending' && '⏸️'}
              {file.status === 'error' && '❌'}
            </div>

            {/* ファイル情報 */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '13px',
                fontWeight: '500',
                color: '#374151',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {file.name}
              </div>
              <div style={{ fontSize: '11px', color: '#6B7280' }}>
                {formatFileSize(file.size)}
              </div>
            </div>

            {/* 個別進捗バー */}
            <div style={{ width: '60px', marginLeft: '12px' }}>
              <div style={{
                width: '100%',
                height: '4px',
                backgroundColor: '#E5E7EB',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${file.progress}%`,
                  height: '100%',
                  backgroundColor: file.status === 'completed' ? '#10B981' : '#3B82F6',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <div style={{
                fontSize: '10px',
                color: '#6B7280',
                textAlign: 'center',
                marginTop: '2px'
              }}>
                {Math.round(file.progress)}%
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 完了メッセージ */}
      {totalProgress === 100 && (
        <div style={{
          textAlign: 'center',
          marginTop: '20px',
          padding: '12px',
          backgroundColor: '#ECFDF5',
          borderRadius: '8px',
          color: '#065F46'
        }}>
          🎉 すべてのファイルのアップロードが完了しました！
        </div>
      )}
    </div>
  );
};

export default UploadProgressBar; 
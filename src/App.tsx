import React, { useState } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import BannerEditor from './components/BannerEditor';
import SpotlightTutorial from './components/SpotlightTutorial';
import UploadProgressBar from './components/UploadProgressBar';
import './App.css';

const App: React.FC = () => {
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [showUploadProgress, setShowUploadProgress] = useState(false);

  const handleFilesSelected = (files: File[]) => {
    setUploadFiles(files);
    setShowUploadProgress(true);
  };

  const handleUploadComplete = (results: any[]) => {
    console.log('Upload completed:', results);
    // 3秒後にプログレスバーを非表示
    setTimeout(() => {
      setShowUploadProgress(false);
      setUploadFiles([]);
    }, 3000);
  };

  return (
    <div className="app-container">
      <Header />
      <BannerEditor onFilesSelected={handleFilesSelected} />
      <Footer />
      
      {/* スポットライトチュートリアル */}
      <SpotlightTutorial />
      
      {/* アップロードプログレスバー */}
      <UploadProgressBar
        files={uploadFiles}
        visible={showUploadProgress}
        onUploadComplete={handleUploadComplete}
        maxCapacity={150} // 150MBの制限
      />
    </div>
  );
};

export default App; 
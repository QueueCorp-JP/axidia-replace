import React from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import BannerEditor from './components/BannerEditor';
import './App.css';

const App: React.FC = () => {
  return (
    <div className="app-container">
      <Header />
      <BannerEditor />
      <Footer />
    </div>
  );
};

export default App; 
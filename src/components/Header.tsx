import React from 'react';
import './Header.css';

const Header: React.FC = () => {
  return (
    <header className="app-header">
      <div className="logo">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
          <path fill="none" d="M0 0h24v24H0z"/>
          <path d="M21 19h2v2H1v-2h2V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v15h4v-8h-2V9h3a1 1 0 0 1 1 1v9zM5 5v14h8V5H5zm2 6h4v2H7v-2zm0-4h4v2H7V7z" fill="currentColor"/>
        </svg>
        <h1>不動産バナー編集ツール</h1>
      </div>
      <div className="app-description">
        画像やPDFのバナーを簡単に差し替えできるツールです
      </div>
    </header>
  );
};

export default Header;
import React from 'react';
import './Footer.css';

const Footer: React.FC = () => {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <p>© 2024 不動産バナー編集ツール - All rights reserved</p>
        <div className="footer-links">
          <a href="#privacy">プライバシーポリシー</a>
          <a href="#terms">利用規約</a>
          <a href="#contact">お問い合わせ</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
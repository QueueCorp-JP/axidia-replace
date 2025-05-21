/**
 * ファイル操作に関するユーティリティ関数
 */

/**
 * ファイル拡張子を取得する
 */
export const getFileExtension = (filename: string): string => {
  return filename.split('.').pop()?.toLowerCase() || '';
};

/**
 * 画像ファイルかどうかを判定する
 */
export const isImageFile = (filename: string): boolean => {
  const ext = getFileExtension(filename);
  return ['jpg', 'jpeg', 'png'].includes(ext);
};

/**
 * PDFファイルかどうかを判定する
 */
export const isPdfFile = (filename: string): boolean => {
  return getFileExtension(filename) === 'pdf';
};

/**
 * データURLからファイルをダウンロードする
 */
export const downloadFile = (dataUrl: string, filename: string): void => {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}; 
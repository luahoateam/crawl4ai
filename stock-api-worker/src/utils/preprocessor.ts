/**
 * Bộ tiền xử lý văn bản OCR BCTC thô
 */
export class FinancialOcrPreprocessor {
  /**
   * Chuẩn hóa Unicode NFC cho tiếng Việt
   */
  static normalizeVietnamese(text: string): string {
    if (!text) return '';
    return text.normalize('NFC');
  }

  /**
   * Loại bỏ các ký tự rác phi-printable và các dòng phân tách bảng lỗi do OCR
   */
  static removeOcrGarbage(text: string): string {
    if (!text) return '';

    // 1. Loại bỏ ký tự phi-printable (ngoại trừ tab \t, xuống dòng \n, \r)
    // Bao gồm cả \x0c (Form Feed) thường gặp ở ranh giới trang PDF OCR
    const nonPrintableRegex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
    let cleaned = text.replace(nonPrintableRegex, '');

    // 2. Tách dòng để xử lý các dòng rác phân tách bảng (ví dụ: _ _ _ _, ......., -------)
    const lines = cleaned.split(/\r?\n/);
    const processedLines = lines.filter(line => {
      const trimmed = line.trim();
      if (trimmed.length === 0) return true; // Giữ dòng trống để cleanWhitespace xử lý sau

      // Regex nhận diện các dòng chỉ chứa ký tự rác lặp lại (dài từ 3 ký tự trở lên)
      // Ví dụ: "------", "......", "_ _ _ _", "* * *", "~~~~"
      const isGarbageLine = /^[._\-~*\s]{3,}$/.test(trimmed);
      return !isGarbageLine;
    });

    return processedLines.join('\n');
  }

  /**
   * Nén khoảng trắng thừa, chuẩn hóa các dòng trống (tối đa 1 dòng trống liên tiếp)
   */
  static cleanWhitespace(text: string): string {
    if (!text) return '';

    // 1. Tách dòng và xử lý từng dòng
    const lines = text.split(/\r?\n/);
    const cleanedLines = lines.map(line => {
      // Bỏ khoảng trắng ở đầu và cuối dòng, nén khoảng trắng ở giữa dòng
      return line.trim().replace(/[ \t]+/g, ' ');
    });

    // 2. Nén các dòng trống liên tiếp (tối đa 1 dòng trống liên tiếp)
    const finalLines: string[] = [];
    let consecutiveEmptyCount = 0;

    for (const line of cleanedLines) {
      if (line === '') {
        consecutiveEmptyCount++;
        if (consecutiveEmptyCount === 1) {
          finalLines.push('');
        }
      } else {
        consecutiveEmptyCount = 0;
        finalLines.push(line);
      }
    }

    // Xóa dòng trống ở đầu và cuối toàn bộ văn bản
    let result = finalLines.join('\n');
    return result.trim();
  }

  /**
   * Quy trình tiền xử lý toàn diện
   */
  static process(text: string): string {
    if (!text) return '';
    let res = this.normalizeVietnamese(text);
    res = this.removeOcrGarbage(res);
    res = this.cleanWhitespace(res);
    return res;
  }
}

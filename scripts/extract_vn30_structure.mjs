#!/usr/bin/env node
/**
 * extract_vn30_structure.mjs
 *
 * Tự động phân ngành và chạy Dual-Run AI Extractor để bóc tách dữ liệu
 * Business Model năm 2025 cho rổ VN30.
 *
 * Đầu vào: Thư mục stock_data/vnstock_raw/{SYMBOL}/2025/
 * Đầu ra: stock_data/extracted_structure/{SYMBOL}/2025.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────────────────────────────────────────────────────────────────────────
// PHÂN NGÀNH VN30
// ─────────────────────────────────────────────────────────────────────────────

const BANKING_SYMBOLS = new Set([
  'ACB', 'BID', 'CTG', 'HDB', 'MBB', 'LPB', 'SHB', 'SSB', 'STB', 'TCB', 'TPB', 'VCB', 'VPB'
]);

const REAL_ESTATE_SYMBOLS = new Set([
  'VHM', 'VIC', 'VRE', 'BCM', 'KDH', 'PDR'
]);

export function getSectorOfSymbol(symbol) {
  const sym = symbol.toUpperCase();
  const rawDir = path.resolve(__dirname, '..', 'stock_data', 'vnstock_raw');
  const overviewPath = path.join(rawDir, sym, '2025', 'overview.json');

  // Rổ fallback cứng bền bỉ diện rộng
  const BANKING_FALLBACK = [
    'ACB', 'BID', 'CTG', 'HDB', 'LPB', 'MBB', 'SHB', 'SSB', 'STB', 'TCB', 'TPB', 'VCB', 'VPB', 'VIB', 'MSB', 'BAB', 'ABB', 'NAB', 'OCB', 'BVB', 'KLB', 'SGB', 'PGB'
  ];
  const REAL_ESTATE_FALLBACK = [
    'VHM', 'VIC', 'VRE', 'KDH', 'NLG', 'DXG', 'PDR', 'DIG', 'CEO', 'DXS', 'CRE', 'KHG', 'TCH', 'HDC', 'HDG', 'SJS', 'SZC', 'IJC', 'BCM', 'KBC', 'LHG', 'D2D', 'NDN'
  ];

  if (BANKING_FALLBACK.includes(sym)) return 'banking';
  if (REAL_ESTATE_FALLBACK.includes(sym)) return 'real_estate';

  if (fs.existsSync(overviewPath)) {
    try {
      const content = fs.readFileSync(overviewPath, 'utf8');
      const data = JSON.parse(content);
      const profile = Array.isArray(data) ? data[0] : data;

      if (profile) {
        // 1. Phân loại BANKING
        const bankingFields = [
          profile.company_type,
          profile.icb_name1,
          profile.icb_name2,
          profile.icb_name3,
          profile.icb_name4
        ].filter(Boolean).map(s => s.toString().toLowerCase());

        const bankingText = bankingFields.join(' | ');
        if (
          bankingText.includes('ngân hàng') || 
          bankingText.includes('tín dụng') || 
          bankingText.includes('banking') || 
          bankingText.includes('banks')
        ) {
          return 'banking';
        }

        // 2. Phân loại REAL ESTATE
        const reFields = [
          profile.company_type,
          profile.icb_name1,
          profile.icb_name2,
          profile.icb_name3,
          profile.icb_name4,
          profile.business_model,
          profile.company_profile
        ].filter(Boolean).map(s => s.toString().toLowerCase());

        const reText = reFields.join(' | ');
        if (
          reText.includes('bất động sản') || 
          reText.includes('địa ốc') || 
          reText.includes('nhà ở') || 
          reText.includes('real estate') ||
          reText.includes('phát triển đô thị')
        ) {
          return 'real_estate';
        }
      }
    } catch (e) {
      // bỏ qua lỗi đọc file
    }
  }

  return 'generic';
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION & AI CALLS
// ─────────────────────────────────────────────────────────────────────────────

// JSON Schema cho Run 2 (Operational Sweep) theo phân ngành
const OPERATIONAL_SCHEMAS = {
  banking: {
    type: "object",
    properties: {
      nim: { type: "string", description: "Biên lãi thuần NIM thực tế năm 2025, ví dụ: 4.2%" },
      casa: { type: "string", description: "Tỷ lệ tiền gửi không kỳ hạn CASA thực tế năm 2025, ví dụ: 40.5%" },
      npl: { type: "string", description: "Tỷ lệ nợ xấu NPL thực tế năm 2025, ví dụ: 1.1%" },
      llr: { type: "string", description: "Tỷ lệ bao phủ nợ xấu LLR thực tế năm 2025, ví dụ: 135%" },
      credit_growth: { type: "string", description: "Tăng trưởng tín dụng thực tế năm 2025, ví dụ: 18.2%" },
      key_monitor_points_2026: { type: "string", description: "Các thông tin đáng chú ý và rủi ro/cơ hội lớn liên quan đến mô hình kinh doanh cần theo dõi trong năm 2026 (nợ xấu, trích lập dự phòng, room tín dụng, số hóa...)" },
      others: { type: "string", description: "Các mục tiêu năm 2026 hoặc kế hoạch chiến lược tương lai" }
    },
    required: ["nim", "casa", "npl", "llr", "credit_growth", "key_monitor_points_2026", "others"]
  },
  real_estate: {
    type: "object",
    properties: {
      inventory_status: { type: "string", description: "Giá trị hàng tồn kho dở dang tại ngày 31/12/2025 và dự án đang triển khai" },
      projects_progress: { type: "string", description: "Tiến độ bàn giao hoặc mở bán các dự án chính trong năm 2025 và kế hoạch mở bán năm 2026" },
      key_monitor_points_2026: { type: "string", description: "Các dự án dang dở lớn nhất, hàng tồn kho lớn đang ngốn vốn có ảnh hưởng trọng yếu tới lợi nhuận và dòng tiền của công ty trong năm 2026 (ví dụ Vinhomes Cổ Loa, Vũ Yên...)" },
      others: { type: "string", description: "Mục tiêu doanh thu/lợi nhuận 2026 hoặc kế hoạch mở rộng quỹ đất" }
    },
    required: ["inventory_status", "projects_progress", "key_monitor_points_2026", "others"]
  },
  generic: {
    type: "object",
    properties: {
      physical_volume: { type: "string", description: "Sản lượng vật lý sản xuất hoặc tiêu thụ thực tế năm 2025 (ví dụ: 8.5 triệu tấn thép, 1000 cửa hàng)" },
      market_share: { type: "string", description: "Thị phần phần trăm % của các sản phẩm chủ đạo thực tế năm 2025" },
      key_monitor_points_2026: { type: "string", description: "Các dự án đầu tư nhà máy mới, dự án dang dở lớn ảnh hưởng lớn lên mô hình kinh doanh và năng lực tạo ra tiền của doanh nghiệp trong năm 2026 (ví dụ Dung Quất 2 của HPG...)" },
      others: { type: "string", description: "Cập nhật tiến độ dự án lớn (ví dụ: Dung Quất 2 chạy thử Q1/2026) hoặc mục tiêu kinh doanh năm 2026" }
    },
    required: ["physical_volume", "market_share", "key_monitor_points_2026", "others"]
  }
};

/**
 * Gọi API MiMo AI với cơ chế retry và response JSON
 * @param {string} prompt
 * @param {object} jsonSchema
 * @returns {Promise<object>}
 */
async function callMiMoAI(prompt, jsonSchema) {
  const apiKey = process.env.MIMO_API_KEY || 'tp-stqnsqsdo4lq2o3318io1krk50woxsw505t1rt5e56bmichv';
  const apiBaseUrl = process.env.MIMO_API_BASE_URL || 'https://token-plan-sgp.xiaomimimo.com/v1';
  const url = `${apiBaseUrl}/chat/completions`;

  const payload = {
    model: "xiaomi/mimo-v2.5-pro",
    messages: [
      {
        role: "system",
        content: `Bạn là một trợ lý phân tích tài chính cao cấp chuyên sâu về thị trường Việt Nam. 
Nhiệm vụ của bạn là đọc dữ liệu thô tài chính/tin tức và bóc tách dữ liệu có cấu trúc chính xác theo JSON Schema được yêu cầu.
Hãy trả về một đối tượng JSON hợp lệ duy nhất, tuyệt đối không thêm markdown chèn bên ngoài.`
      },
      {
        role: "user",
        content: prompt
      }
    ],
    response_format: { 
      type: "json_object" 
    }
  };

  let lastError = null;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`MiMo AI HTTP ${response.status}: ${errText}`);
      }

      const resJson = await response.json();
      const content = resJson.choices[0].message.content;
      return JSON.parse(content);
      
    } catch (err) {
      lastError = err;
      console.warn(`[WARN] Lần thử ${attempt}/${maxRetries} thất bại khi gọi MiMo AI: ${err.message}`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  }

  throw new Error(`Không thể kết nối hoặc bóc tách dữ liệu qua MiMo AI sau ${maxRetries} lần thử. Lỗi: ${lastError?.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE DUAL-RUN EXTRACTOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Chạy trích xuất Dual-Run AI cho một mã cổ phiếu cụ thể
 */
export async function runAIExtraction(options = {}) {
  const {
    symbol,
    year = 2025,
    rawDir = path.resolve(__dirname, '..', 'stock_data', 'vnstock_raw'),
    outputDir = path.resolve(__dirname, '..', 'stock_data', 'extracted_structure'),
    aiClient = null // Cho phép truyền mock client khi viết unit test
  } = options;

  const sym = symbol.toUpperCase();
  const sector = getSectorOfSymbol(sym);
  const targetRawDir = path.join(rawDir, sym, year.toString());
  
  if (!fs.existsSync(targetRawDir)) {
    throw new Error(`Không tìm thấy thư mục cache dữ liệu thô: ${targetRawDir}`);
  }

  // Đọc các file dữ liệu thô
  const fhPath = path.join(targetRawDir, 'financial_health.json');
  const planPath = path.join(targetRawDir, 'annual_plan.json');
  const newsPath = path.join(targetRawDir, 'news.json');

  const rawFH = fs.existsSync(fhPath) ? fs.readFileSync(fhPath, 'utf8') : '{}';
  const rawPlan = fs.existsSync(planPath) ? fs.readFileSync(planPath, 'utf8') : '{}';
  const rawNews = fs.existsSync(newsPath) ? fs.readFileSync(newsPath, 'utf8') : '{}';

  console.log(`[EXTRACT][${sym}] Bắt đầu bóc tách Dual-Run. Ngành: ${sector}`);

  // RUN 1: Financial Sweep
  let run1Result = { revenue_struct: '', profit_struct: '' };
  const promptRun1 = `Dưới đây là dữ liệu Sức khỏe Tài chính và Báo cáo tài chính năm ${year} của doanh nghiệp ${sym}:
${rawFH}

Nhiệm vụ của bạn: Hãy phân tích báo cáo và bóc tách dữ liệu thành cơ cấu doanh thu & lợi nhuận của năm ${year}.
Hãy trả về JSON chứa chính xác 2 trường sau:
1. "revenue_struct": Chuỗi mô tả tỉ trọng cơ cấu doanh thu chi tiết các mảng của năm ${year} (ví dụ: "Thép xây dựng đóng góp 65% doanh thu, HRC đóng góp 25% doanh thu, còn lại là nông nghiệp và gia dụng").
2. "profit_struct": Chuỗi mô tả tỉ trọng cơ cấu lợi nhuận gộp chi tiết các mảng tương ứng của năm ${year} (ví dụ: "Mảng thép đóng góp 92% lợi nhuận gộp, nông nghiệp đóng góp 5%, mảng khác 3%").
Hãy viết câu chữ tiếng Việt tự nhiên, trực quan, chuyên nghiệp.`;

  const run1Schema = {
    type: "object",
    properties: {
      revenue_struct: { type: "string" },
      profit_struct: { type: "string" }
    },
    required: ["revenue_struct", "profit_struct"]
  };

  try {
    if (aiClient) {
      run1Result = await aiClient(promptRun1, run1Schema);
    } else {
      run1Result = await callMiMoAI(promptRun1, run1Schema);
    }
    console.log(`[EXTRACT][${sym}] ✓ Run 1 (Financial Sweep) hoàn thành.`);
  } catch (err) {
    console.error(`[EXTRACT][${sym}] ✗ Run 1 thất bại: ${err.message}. Sử dụng fallback rỗng.`);
  }

  // RUN 2: Operational Sweep (Đặc thù phân ngành)
  let run2Result = {};
  const sectorSchema = OPERATIONAL_SCHEMAS[sector];

  const promptRun2 = `Dưới đây là kế hoạch kinh doanh năm mới và tin tức hoạt động vận hành của doanh nghiệp ${sym} trong năm ${year}:
Kế hoạch kinh doanh:
${rawPlan}

Tin tức hoạt động:
${rawNews}

Nhiệm vụ của bạn: Hãy đọc dữ liệu thô và bóc tách thông số đặc thù của phân ngành "${sector}" cho năm ${year} theo đúng JSON Schema sau:
${JSON.stringify(sectorSchema, null, 2)}
Lưu ý: Nếu một chỉ tiêu nào đó không có trong dữ liệu thô, hãy ghi "Không có thông tin chi tiết trong BCTC/Tin tức năm ${year}". Không được bịa số liệu. Hãy viết câu chữ tiếng Việt cực kỳ tự nhiên và chuyên nghiệp.`;

  try {
    if (aiClient) {
      run2Result = await aiClient(promptRun2, sectorSchema);
    } else {
      run2Result = await callMiMoAI(promptRun2, sectorSchema);
    }
    console.log(`[EXTRACT][${sym}] ✓ Run 2 (Operational Sweep) hoàn thành.`);
  } catch (err) {
    console.error(`[EXTRACT][${sym}] ✗ Run 2 thất bại: ${err.message}. Sử dụng fallback rỗng.`);
  }

  // RUN 3: Value Chain Sweep (Inputs, Production, Outputs Enrichment)
  let run3Result = { inputs: '', production: '', outputs: '' };
  const run3Schema = {
    type: "object",
    properties: {
      inputs: { type: "string", description: "Chi tiết các nguyên liệu đầu vào và tỷ trọng % chi phí cấu thành giá vốn, dạng danh sách gạch đầu dòng Markdown" },
      production: { type: "string", description: "Chi tiết công nghệ, công suất thiết kế và cơ cấu sản lượng sản phẩm chính, dạng danh sách gạch đầu dòng Markdown" },
      outputs: { type: "string", description: "Chi tiết thị trường tiêu thụ (nội địa/xuất khẩu) và vị thế thị phần sản phẩm chính, dạng danh sách gạch đầu dòng Markdown" }
    },
    required: ["inputs", "production", "outputs"]
  };

  const promptRun3 = `Dưới đây là dữ liệu thô tài chính, mô hình kinh doanh, cấu trúc hoạt động và tin tức vận hành của doanh nghiệp ${sym} trong năm ${year}:
Tài chính & Sức khỏe doanh nghiệp:
${rawFH}

Kế hoạch năm & Cơ cấu:
${rawPlan}

Tin tức & Sự kiện:
${rawNews}

Nhiệm vụ của bạn: Hãy bóc tách và phân tích sâu Chuỗi giá trị (Value Chain) của doanh nghiệp ${sym} cho năm ${year} theo đúng JSON Schema sau:
${JSON.stringify(run3Schema, null, 2)}

Yêu cầu chi tiết cho từng trường:
1. "inputs" (Đầu vào - Cơ cấu chi phí): Chi tiết các nguyên liệu đầu vào chính, tỷ trọng % của chúng cấu thành giá vốn hàng bán (ví dụ: quặng sắt 30%, than coke 30%, điện 10%... hoặc cơ cấu nguồn vốn huy động/casa đối với ngân hàng).
2. "production" (Sản xuất - Công nghệ & Công suất): Mô tả công nghệ sản xuất, sản lượng thực tế và công suất thiết kế của các nhà máy, cùng cơ cấu sản lượng các dòng sản phẩm chính (ví dụ: HRC 40%, thép xây dựng 55%...).
3. "outputs" (Đầu ra - Thị phần & Thị trường): Phân bổ doanh thu theo địa lý (Nội địa % vs. Xuất khẩu %) và vị thế thị phần của các dòng sản phẩm chính.

Lưu ý quan trọng:
- Viết câu chữ tiếng Việt cực kỳ tự nhiên, chuyên nghiệp và ngắn gọn.
- Sử dụng dạng các dòng gạch đầu dòng ngắn gọn (Markdown), thụt lề thụ động khi cần chi tiết hóa.
- Tuyệt đối không được tự bịa số liệu. Nếu không có số liệu tỷ trọng % chính xác, hãy ghi nhận định định tính dựa trên dữ liệu thô. Nếu hoàn toàn không có thông tin, ghi "Không có thông tin chi tiết trong BCTC/Tin tức năm ${year}".`;

  try {
    if (aiClient) {
      run3Result = await aiClient(promptRun3, run3Schema);
    } else {
      run3Result = await callMiMoAI(promptRun3, run3Schema);
    }
    console.log(`[EXTRACT][${sym}] ✓ Run 3 (Value Chain Sweep) hoàn thành.`);
  } catch (err) {
    console.error(`[EXTRACT][${sym}] ✗ Run 3 thất bại: ${err.message}. Sử dụng fallback rỗng.`);
  }

  // MERGE RESULTS
  const unifiedData = {
    symbol: sym,
    year,
    sector,
    extractedAt: new Date().toISOString(),
    revenue_struct: run1Result.revenue_struct || '',
    profit_struct: run1Result.profit_struct || '',
    inputs: run3Result.inputs || '',
    production: run3Result.production || '',
    outputs: run3Result.outputs || '',
    ...run2Result
  };

  // Ghi tệp kết quả JSON
  const symOutputDir = path.join(outputDir, sym);
  fs.mkdirSync(symOutputDir, { recursive: true });
  const resultPath = path.join(symOutputDir, `${year}.json`);
  fs.writeFileSync(resultPath, JSON.stringify(unifiedData, null, 2), 'utf8');

  console.log(`[EXTRACT][${sym}] ✓ Đã ghi Unified JSON cache: ${resultPath}`);
  return unifiedData;
}

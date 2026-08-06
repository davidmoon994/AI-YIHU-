/**
 * 生成默认 SVG 图标（医疗护理主题）
 * 运行：node generate-icons.js
 * 输出到 default-icons/ 目录
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'default-icons');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const NORMAL_COLOR = '#999999';
const ACTIVE_COLOR = '#1890ff';

// SVG 图标路径定义（viewBox 0 0 48 48，线条风格）
const icons = {
  // ===== 用户端 =====
  'user-home': {
    label: '首页',
    path: `<path d="M8 22L24 8l16 14" stroke="{C}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M12 20v16a2 2 0 002 2h6V28h8v10h6a2 2 0 002-2V20" stroke="{C}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="21" y="14" width="6" height="6" rx="1" stroke="{C}" stroke-width="2" fill="none"/>
    <line x1="24" y1="15.5" x2="24" y2="18.5" stroke="{C}" stroke-width="1.5"/>
    <line x1="22.5" y1="17" x2="25.5" y2="17" stroke="{C}" stroke-width="1.5"/>`
  },
  'user-ai': {
    label: 'AI问诊',
    path: `<rect x="10" y="12" width="28" height="22" rx="6" stroke="{C}" stroke-width="3" fill="none"/>
    <circle cx="19" cy="23" r="2.5" fill="{C}"/>
    <circle cx="29" cy="23" r="2.5" fill="{C}"/>
    <line x1="24" y1="8" x2="24" y2="12" stroke="{C}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="24" cy="6" r="2" fill="{C}"/>
    <path d="M18 30c0 0 3 3 6 3s6-3 6-3" stroke="{C}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <line x1="6" y1="20" x2="10" y2="20" stroke="{C}" stroke-width="3" stroke-linecap="round"/>
    <line x1="38" y1="20" x2="42" y2="20" stroke="{C}" stroke-width="3" stroke-linecap="round"/>`
  },
  'user-service': {
    label: '服务',
    path: `<rect x="12" y="6" width="24" height="34" rx="3" stroke="{C}" stroke-width="3" fill="none"/>
    <line x1="18" y1="14" x2="30" y2="14" stroke="{C}" stroke-width="2" stroke-linecap="round"/>
    <line x1="18" y1="20" x2="30" y2="20" stroke="{C}" stroke-width="2" stroke-linecap="round"/>
    <line x1="18" y1="26" x2="26" y2="26" stroke="{C}" stroke-width="2" stroke-linecap="round"/>
    <path d="M24 30l3 3 5-6" stroke="{C}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="18" y="4" width="12" height="4" rx="1" stroke="{C}" stroke-width="2" fill="none"/>`
  },
  'user-mine': {
    label: '我的',
    path: `<circle cx="24" cy="16" r="8" stroke="{C}" stroke-width="3" fill="none"/>
    <path d="M8 42c0-8.837 7.163-14 16-14s16 5.163 16 14" stroke="{C}" stroke-width="3" fill="none" stroke-linecap="round"/>
    <line x1="24" y1="12" x2="24" y2="16" stroke="{C}" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="22" y1="14" x2="26" y2="14" stroke="{C}" stroke-width="1.5" stroke-linecap="round"/>`
  },
  // ===== 陪诊员端 =====
  'escort-home': {
    label: '首页',
    path: `<rect x="6" y="14" width="36" height="26" rx="4" stroke="{C}" stroke-width="3" fill="none"/>
    <line x1="6" y1="22" x2="42" y2="22" stroke="{C}" stroke-width="2"/>
    <line x1="24" y1="8" x2="24" y2="14" stroke="{C}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="24" cy="6" r="2.5" stroke="{C}" stroke-width="2" fill="none"/>
    <rect x="14" y="28" width="8" height="6" rx="1" stroke="{C}" stroke-width="2" fill="none"/>
    <line x1="30" y1="28" x2="36" y2="28" stroke="{C}" stroke-width="2" stroke-linecap="round"/>
    <line x1="30" y1="32" x2="34" y2="32" stroke="{C}" stroke-width="2" stroke-linecap="round"/>`
  },
  'escort-order': {
    label: '接单',
    path: `<path d="M14 6h20a2 2 0 012 2v32a2 2 0 01-2 2H14a2 2 0 01-2-2V8a2 2 0 012-2z" stroke="{C}" stroke-width="3" fill="none"/>
    <path d="M18 16l4 4 8-8" stroke="{C}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="16" y1="28" x2="32" y2="28" stroke="{C}" stroke-width="2" stroke-linecap="round"/>
    <line x1="16" y1="34" x2="28" y2="34" stroke="{C}" stroke-width="2" stroke-linecap="round"/>`
  },
  'escort-task': {
    label: '任务',
    path: `<circle cx="24" cy="24" r="16" stroke="{C}" stroke-width="3" fill="none"/>
    <polyline points="24,14 24,24 32,28" stroke="{C}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="24" cy="24" r="2" fill="{C}"/>`
  },
  'escort-wallet': {
    label: '钱包',
    path: `<rect x="6" y="12" width="36" height="26" rx="4" stroke="{C}" stroke-width="3" fill="none"/>
    <path d="M6 12V10a4 4 0 014-4h24a4 4 0 014 4v2" stroke="{C}" stroke-width="2" fill="none"/>
    <circle cx="34" cy="25" r="3" stroke="{C}" stroke-width="2" fill="none"/>
    <line x1="6" y1="20" x2="42" y2="20" stroke="{C}" stroke-width="2"/>`
  },
  'escort-learn': {
    label: '学习',
    path: `<path d="M8 8h12l4 4h16a2 2 0 012 2v22a2 2 0 01-2 2H8a2 2 0 01-2-2V10a2 2 0 012-2z" stroke="{C}" stroke-width="3" fill="none"/>
    <line x1="14" y1="20" x2="34" y2="20" stroke="{C}" stroke-width="2" stroke-linecap="round"/>
    <line x1="14" y1="26" x2="30" y2="26" stroke="{C}" stroke-width="2" stroke-linecap="round"/>
    <line x1="14" y1="32" x2="26" y2="32" stroke="{C}" stroke-width="2" stroke-linecap="round"/>`
  }
};

function generateSVG(iconDef, color) {
  const paths = iconDef.path.replace(/\{C\}/g, color);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="81" height="81">
  ${paths}
</svg>`;
}

let count = 0;
for (const [key, def] of Object.entries(icons)) {
  // 正常态（灰色）
  const normalSvg = generateSVG(def, NORMAL_COLOR);
  fs.writeFileSync(path.join(OUT_DIR, `${key}-normal.svg`), normalSvg);
  count++;

  // 选中态（医疗蓝）
  const activeSvg = generateSVG(def, ACTIVE_COLOR);
  fs.writeFileSync(path.join(OUT_DIR, `${key}-active.svg`), activeSvg);
  count++;
}

console.log(`已生成 ${count} 个 SVG 图标到 ${OUT_DIR}`);

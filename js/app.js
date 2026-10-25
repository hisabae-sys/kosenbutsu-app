import { render, SIZE, QR_KINDS, PHOTO_BOXES } from './templates/komei-soto.js';
import { removeDigitUnitSpaces, warnings, urlWarnings, DEFAULT_AGE_BASE_DATE } from './rules.js';
import { SAMPLE } from './sample.js';

const DB_NAME = 'kosenbutsu';
const STORE = 'drafts';
const DRAFT_KEY = 'komei-soto';

// ---------- 保存（この端末のブラウザ内。ドライブ保存は次の段階） ----------
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function loadDraft() {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).get(DRAFT_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}
async function saveDraft(data) {
  try {
    const db = await openDb();
    db.transaction(STORE, 'readwrite').objectStore(STORE).put(data, DRAFT_KEY);
  } catch { /* 保存できない環境でも画面は動かす */ }
}

// ---------- 入力項目 ----------
const FIELDS = [
  { group: '号・発行', items: [
    { key: 'town', label: '市町名', placeholder: '徳島市' },
    { key: 'season', label: '号', placeholder: '2026秋号' },
    { key: 'vol', label: 'vol.（号数）', placeholder: '03' },
    { key: 'issued', label: '発行年月', placeholder: '2026年10月' },
  ] },
  { group: '表紙', items: [
    { key: 'name', label: '表示名', placeholder: 'こうめい花子' },
    { key: 'rubyBase', label: 'ふりがなを付ける部分', placeholder: '花子', hint: '表示名のうち漢字の部分' },
    { key: 'ruby', label: 'ふりがな', placeholder: 'はなこ' },
    { key: 'catch', label: 'キャッチコピー', type: 'textarea', rows: 2, hint: '2行。改行で行を分けます' },
    { key: 'band', label: '縦の帯', placeholder: '公明党の政策推進力' },
    { key: 'photos.face', label: '表紙の顔写真', type: 'photo', box: 'face' },
  ] },
  { group: 'プロフィール面', items: [
    { key: 'bubble', label: '吹き出しのキャッチ（縦書き）', type: 'textarea', rows: 3, hint: '1行が縦1列になります' },
    { key: 'photos.full', label: '全身写真', type: 'photo', box: 'full' },
  ] },
  ...[0, 1, 2].map((i) => ({ group: `政策${i + 1}`, items: [
    { key: `policies.${i}.title`, label: '見出し', type: 'textarea', rows: 2, hint: '2行まで' },
    { key: `policies.${i}.body`, label: '本文', type: 'textarea', rows: 4 },
    { key: `policies.${i}.illust`, label: 'イラスト（任意）', type: 'photo' },
  ] })),
  { group: 'プロフィール', items: [
    { key: 'birth', label: '生年月日', type: 'date', hint: '年齢は自動で計算します' },
    { key: 'ageBaseDate', label: '年齢を数える日', type: 'date', hint: `空欄なら ${DEFAULT_AGE_BASE_DATE}` },
    { key: 'hometown', label: '出身地', placeholder: '徳島市' },
    { key: 'schools', label: '学歴', type: 'textarea', rows: 4, hint: '1行に1校。「卒」「県立」などは自動でそろえます' },
    { key: 'career', label: '職歴' },
    { key: 'role', label: '党役職', list: 'roles' },
    { key: 'term', label: '期数（現職のみ）', type: 'number', hint: '数字だけ。「（現在N期目）」になります' },
    { key: 'license', label: '資格' },
    { key: 'hobby', label: '趣味' },
    { key: 'family', label: '家族' },
    { key: 'motto', label: '座右の銘' },
    { key: 'extra', label: 'その他の行', type: 'textarea', rows: 2, hint: '1行ずつ。行頭の○は自動で付きます' },
  ] },
  { group: 'QRコード', items: QR_KINDS.map((k) => ({ key: `qr.${k.key}`, label: `${k.label}のURL`, type: 'url' })) },
];

const ROLES = ['県代表', '県幹事長', '県副代表', '県青年局長', '県女性局長', '支部長', '副支部長'];

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
function set(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  keys.slice(0, -1).forEach((k, i) => {
    if (o[k] == null) o[k] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    o = o[k];
  });
  o[keys.at(-1)] = value;
}

let data = structuredClone(SAMPLE);
const photoSizes = {}; // key → {w, h}（px）

function fieldHtml(f) {
  const id = `f-${f.key.replace(/\./g, '-')}`;
  const hint = f.hint ? `<small>${f.hint}</small>` : '';
  if (f.type === 'photo') {
    return `<label class="field" for="${id}"><span>${f.label}</span>
      <input type="file" accept="image/*" id="${id}" data-key="${f.key}" data-box="${f.box || ''}">
      <button type="button" class="clear-photo" data-key="${f.key}">写真を外す</button>${hint}</label>`;
  }
  const v = get(data, f.key) ?? '';
  const common = `id="${id}" data-key="${f.key}" ${f.placeholder ? `placeholder="${f.placeholder}"` : ''}`;
  const input = f.type === 'textarea'
    ? `<textarea ${common} rows="${f.rows || 3}"></textarea>`
    : `<input type="${f.type || 'text'}" ${common} ${f.list ? `list="${f.list}"` : ''}>`;
  return `<label class="field" for="${id}"><span>${f.label}</span>${input}${hint}</label>`;
}

function buildForm() {
  const form = document.getElementById('form');
  form.innerHTML = FIELDS.map((g) => `<fieldset><legend>${g.group}</legend>${g.items.map(fieldHtml).join('')}</fieldset>`).join('')
    + `<datalist id="roles">${ROLES.map((r) => `<option value="${r}">`).join('')}</datalist>`;
  form.querySelectorAll('[data-key]:not([type=file]):not(button)').forEach((el) => {
    el.value = get(data, el.dataset.key) ?? '';
    el.addEventListener('input', () => { set(data, el.dataset.key, el.value); update(); });
  });
  form.querySelectorAll('input[type=file]').forEach((el) => {
    el.addEventListener('change', () => {
      const file = el.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { set(data, el.dataset.key, reader.result); update(); };
      reader.readAsDataURL(file);
    });
  });
  form.querySelectorAll('.clear-photo').forEach((b) => b.addEventListener('click', () => {
    set(data, b.dataset.key, ''); update();
  }));
}

function makeQr(url) {
  const qr = window.qrcode(0, 'H');
  qr.addData(url);
  qr.make();
  return qr.createSvgTag({ cellSize: 2, margin: 0, scalable: true });
}

// ---------- チェック ----------
function textFields() {
  const out = [];
  FIELDS.forEach((g) => g.items.forEach((f) => {
    if (['photo', 'date', 'number', 'url'].includes(f.type)) return;
    out.push({ label: `${g.group}・${f.label}`, value: String(get(data, f.key) ?? '') });
  }));
  return out;
}

function collectChecks(sheet) {
  const fixed = [];
  const notes = [];
  textFields().forEach(({ label, value }) => {
    if (!value) return;
    if (/[!?]/.test(value)) fixed.push(`${label}：半角の「!」「?」を全角にしました`);
    if (removeDigitUnitSpaces(value) !== value) fixed.push(`${label}：数字と単位の間のスペースを取りました`);
    notes.push(...warnings(label, value));
  });
  QR_KINDS.forEach((k) => notes.push(...urlWarnings(k.label, get(data, `qr.${k.key}`))));
  if (!data.birth) notes.push('生年月日が未入力です');
  Object.entries(PHOTO_BOXES).forEach(([key, box]) => {
    if (!get(data, `photos.${key}`)) notes.push(`${box.label}がまだ入っていません`);
  });

  sheet.querySelectorAll('[data-fit]').forEach((el) => {
    if (el.tagName === 'IMG') return;
    if (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) {
      notes.push(`${el.dataset.fit}：枠からあふれています。文字を減らしてください`);
    }
  });
  Object.entries(PHOTO_BOXES).forEach(([key, box]) => {
    const s = photoSizes[key];
    if (!s) return;
    const dpi = Math.min(s.w / (box.w / 25.4), s.h / (box.h / 25.4));
    if (dpi < 300) notes.push(`${box.label}：画質が足りません（約${Math.round(dpi)}dpi、300dpi以上が目安）`);
  });
  return { fixed, notes };
}

function showChecks({ fixed, notes }) {
  const el = document.getElementById('checks');
  const li = (s) => `<li>${s}</li>`;
  el.innerHTML = (notes.length
    ? `<h3 class="warn">確認してください（${notes.length}件）</h3><ul>${notes.map(li).join('')}</ul>`
    : '<h3 class="ok">注意はありません</h3>')
    + (fixed.length ? `<h3>自動で直したところ</h3><ul>${fixed.map(li).join('')}</ul>` : '');
}

// ---------- プレビュー ----------
function fitPreview() {
  const wrap = document.getElementById('preview-wrap');
  const sheet = document.getElementById('sheet');
  const scale = wrap.clientWidth / sheet.offsetWidth;
  sheet.style.transform = `scale(${scale})`;
  wrap.style.height = `${sheet.offsetHeight * scale}px`;
}

let timer;
function update() {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const sheet = document.getElementById('sheet');
    sheet.innerHTML = render(data, { makeQr });
    await Promise.all([...sheet.querySelectorAll('img')].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))));
    for (const key of Object.keys(PHOTO_BOXES)) {
      const img = sheet.querySelector(`.photo-${key}`);
      photoSizes[key] = img && img.tagName === 'IMG' ? { w: img.naturalWidth, h: img.naturalHeight } : null;
    }
    await document.fonts.ready;
    fitPreview();
    showChecks(collectChecks(sheet));
    saveDraft(data);
  }, 150);
}

function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function init() {
  const saved = await loadDraft();
  if (saved) data = saved;
  buildForm();
  document.getElementById('sheet').style.width = `${SIZE.width + SIZE.bleed * 2}mm`;
  document.getElementById('btn-print').addEventListener('click', () => window.print());
  document.getElementById('btn-sample').addEventListener('click', () => {
    if (!confirm('入力中の内容を見本に置き換えます。よろしいですか？')) return;
    data = structuredClone(SAMPLE); buildForm(); update();
  });
  document.getElementById('btn-export').addEventListener('click', () => download(`${data.name || '原稿'}_公明ニュース外面.json`, JSON.stringify(data)));
  document.getElementById('btn-import').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    file.text().then((t) => { data = JSON.parse(t); buildForm(); update(); });
  });
  window.addEventListener('resize', fitPreview);
  update();
}

init();

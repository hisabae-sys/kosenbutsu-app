import {
  render, TEMPLATE, QR_KINDS, PHOTO_BOXES, ELEMENTS, FONTS, LABEL_FIELDS, DEFAULT_LABELS, styleAttr,
} from './templates/komei-soto.js?v=4';
import { removeDigitUnitSpaces, warnings, urlWarnings, DEFAULT_AGE_BASE_DATE } from './rules.js?v=4';
import { SAMPLE } from './sample.js?v=4';

const DB_NAME = 'kosenbutsu';
const STORE = 'drafts';
const DRAFT_KEY = 'komei-soto';
const MAX_POLICIES = 5;
const PX_PER_MM = 96 / 25.4;
const MIN_FIT = 0.7; // 文字は7割まで自動で小さくする

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
async function saveDraft(d) {
  try {
    const db = await openDb();
    db.transaction(STORE, 'readwrite').objectStore(STORE).put(d, DRAFT_KEY);
  } catch { /* 保存できない環境でも画面は動かす */ }
}

// ---------- 入力項目 ----------
const policyFields = (i) => [
  { key: `policies.${i}.title`, label: '見出し', type: 'textarea', rows: 2, hint: '改行で2行に分けます' },
  { key: `policies.${i}.body`, label: '本文', type: 'textarea', rows: 4 },
  { key: `policies.${i}.illust`, label: 'イラスト（任意）', type: 'photo' },
];

function contentGroups() {
  return [
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
      { key: 'catch', label: 'キャッチコピー', type: 'textarea', rows: 2, hint: '改行で行を分けます' },
      { key: 'band', label: '縦の帯', placeholder: '公明党の政策推進力' },
      { key: 'photos.face', label: '表紙の顔写真', type: 'photo' },
      { key: 'photos.logo', label: '公明党ロゴ（画像）', type: 'photo', hint: '入れない場合は印刷時に空けます' },
    ] },
    { group: 'プロフィール面', items: [
      { key: 'bubble', label: '吹き出しのキャッチ（縦書き）', type: 'textarea', rows: 3, hint: '1行が縦1列になります' },
      { key: 'photos.full', label: '全身写真', type: 'photo' },
    ] },
    ...(data.policies || []).map((_, i) => ({ group: `政策${i + 1}`, policy: i, items: policyFields(i) })),
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
      { key: 'extra', label: 'その他の行', type: 'textarea', rows: 3, hint: '1行ずつ。行頭の○は自動で付きます' },
    ] },
    { group: 'QRコード', items: QR_KINDS.map((k) => ({ key: `qr.${k.key}`, label: `${k.label}のURL`, type: 'url' })) },
    { group: '見出し・ラベル', items: LABEL_FIELDS.map((f) => ({ ...f, key: `labels.${f.key}`, placeholder: DEFAULT_LABELS[f.key] })) },
  ];
}

const ROLES = ['県代表', '県幹事長', '県副代表', '県青年局長', '県女性局長', '支部長', '副支部長'];

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
function set(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  keys.slice(0, -1).forEach((k, i) => {
    if (o[k] == null) o[k] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    o = o[k];
  });
  o[keys[keys.length - 1]] = value;
}
const escAttr = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

let data = structuredClone(SAMPLE);
let selected = null; // デザイン設定で選んでいる要素のid
let activeTab = 'content';
let zoom = 'fit';
const photoSizes = {};

function fieldHtml(f) {
  const id = `f-${f.key.replace(/\./g, '-')}`;
  const hint = f.hint ? `<small>${f.hint}</small>` : '';
  if (f.type === 'photo') {
    const has = get(data, f.key) ? '（入っています）' : '';
    return `<div class="field"><label for="${id}">${f.label}<em>${has}</em></label>
      <input type="file" accept="image/*" id="${id}" data-key="${f.key}">
      <button type="button" class="small clear-photo" data-key="${f.key}">写真を外す</button>${hint}</div>`;
  }
  const common = `id="${id}" data-key="${f.key}" ${f.placeholder ? `placeholder="${escAttr(f.placeholder)}"` : ''}`;
  const input = f.type === 'textarea'
    ? `<textarea ${common} rows="${f.rows || 3}"></textarea>`
    : `<input type="${f.type || 'text'}" ${common} ${f.list ? `list="${f.list}"` : ''}>`;
  return `<div class="field"><label for="${id}">${f.label}</label>${input}${hint}</div>`;
}

function bindInputs(root, onChange) {
  root.querySelectorAll('[data-key]:not([type=file]):not(button)').forEach((el) => {
    el.value = get(data, el.dataset.key) ?? '';
    el.addEventListener('input', () => { set(data, el.dataset.key, el.value); onChange(); });
  });
  root.querySelectorAll('input[type=file]').forEach((el) => {
    el.addEventListener('change', () => {
      const file = el.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { set(data, el.dataset.key, reader.result); buildContent(); update(); };
      reader.readAsDataURL(file);
    });
  });
  root.querySelectorAll('.clear-photo').forEach((b) => b.addEventListener('click', () => {
    set(data, b.dataset.key, ''); buildContent(); update();
  }));
}

function buildContent() {
  const form = document.getElementById('tab-content');
  form.innerHTML = contentGroups().map((g) => {
    const remove = g.policy != null
      ? `<button type="button" class="small danger remove-policy" data-i="${g.policy}">この政策を削除</button>` : '';
    const add = g.policy === data.policies.length - 1 && data.policies.length < MAX_POLICIES
      ? '<button type="button" class="add-policy">＋ 政策を追加</button>' : '';
    return `<fieldset><legend>${g.group}</legend>${g.items.map(fieldHtml).join('')}${remove}</fieldset>${add}`;
  }).join('')
    + (data.policies.length ? '' : '<button type="button" class="add-policy">＋ 政策を追加</button>')
    + `<datalist id="roles">${ROLES.map((r) => `<option value="${r}">`).join('')}</datalist>`;
  bindInputs(form, update);
  form.querySelectorAll('.add-policy').forEach((b) => b.addEventListener('click', () => {
    data.policies.push({ title: '', body: '', illust: '' });
    buildContent(); update();
  }));
  form.querySelectorAll('.remove-policy').forEach((b) => b.addEventListener('click', () => {
    if (!confirm('この政策を削除します。よろしいですか？')) return;
    data.policies.splice(Number(b.dataset.i), 1);
    buildContent(); update();
  }));
}

// ---------- デザイン設定 ----------
const STYLE_FIELDS = [
  { key: 'dx', label: '横の位置（右へ mm）', type: 'number', step: 0.5 },
  { key: 'dy', label: '縦の位置（下へ mm）', type: 'number', step: 0.5 },
  { key: 'w', label: '幅（mm）', type: 'number', step: 0.5, current: 'width' },
  { key: 'h', label: '高さ（mm）', type: 'number', step: 0.5, current: 'height' },
  { key: 'font', label: 'フォント', type: 'select', options: FONTS, text: true },
  { key: 'size', label: '文字の大きさ（mm）', type: 'number', step: 0.1, text: true, current: 'fontSize' },
  { key: 'color', label: '文字の色', type: 'color', text: true },
  { key: 'bg', label: '背景の色', type: 'color' },
  { key: 'bold', label: '太さ', type: 'select', options: [{ value: '', label: '型のまま' }, { value: 'bold', label: '太字' }, { value: 'normal', label: '標準' }], text: true },
  { key: 'italic', label: '斜体', type: 'select', options: [{ value: '', label: '型のまま' }, { value: 'on', label: '斜体にする' }, { value: 'off', label: '斜体にしない' }], text: true },
  { key: 'dir', label: '向き', type: 'select', options: [{ value: '', label: '型のまま' }, { value: 'horizontal', label: '横書き' }, { value: 'vertical', label: '縦書き' }], text: true },
  { key: 'align', label: '揃え', type: 'select', options: [{ value: '', label: '型のまま' }, { value: 'left', label: '左（上）' }, { value: 'center', label: '中央' }, { value: 'right', label: '右（下）' }], text: true },
  { key: 'lineHeight', label: '行間（倍）', type: 'number', step: 0.05, text: true },
  { key: 'letter', label: '字間（mm）', type: 'number', step: 0.1, text: true },
  { key: 'hidden', label: 'この要素を表示しない', type: 'checkbox' },
];

function currentMm(el, prop) {
  if (!el) return '';
  const cs = getComputedStyle(el);
  const px = prop === 'width' ? el.offsetWidth : prop === 'height' ? el.offsetHeight : parseFloat(cs[prop]);
  return (px / PX_PER_MM).toFixed(1);
}

function buildDesign() {
  const pane = document.getElementById('tab-design');
  const meta = ELEMENTS.find((e) => e.id === selected);
  const st = (data.styles || {})[selected] || {};
  const target = selected ? document.querySelector(`#sheet [data-el="${selected}"]`) : null;
  const fields = meta ? STYLE_FIELDS.filter((f) => !f.text || meta.text).map((f) => {
    const id = `s-${f.key}`;
    const v = st[f.key] ?? '';
    if (f.type === 'select') {
      return `<div class="field"><label for="${id}">${f.label}</label><select id="${id}" data-style="${f.key}">${f.options.map((o) => `<option value="${escAttr(o.value)}"${o.value === v ? ' selected' : ''}>${o.label}</option>`).join('')}</select></div>`;
    }
    if (f.type === 'checkbox') {
      return `<div class="field check"><label><input type="checkbox" data-style="${f.key}"${v ? ' checked' : ''}> ${f.label}</label></div>`;
    }
    if (f.type === 'color') {
      return `<div class="field"><label for="${id}">${f.label}</label><div class="row"><input type="color" id="${id}" data-style="${f.key}" value="${v || '#000000'}"><span class="muted">${v ? v : '型のまま'}</span>${v ? `<button type="button" class="small unset" data-style="${f.key}">型のままに戻す</button>` : ''}</div></div>`;
    }
    const ph = f.current ? currentMm(target, f.current) : '';
    return `<div class="field"><label for="${id}">${f.label}</label><input type="number" inputmode="decimal" id="${id}" data-style="${f.key}" step="${f.step}" value="${escAttr(v)}" placeholder="${ph ? `いま ${ph}` : '型のまま'}"></div>`;
  }).join('') : '';

  pane.innerHTML = `
    <p class="muted">プレビューの文字や写真を押すと選べます。ドラッグで動かせます。</p>
    <div class="field"><label for="el-select">設定する要素</label>
      <select id="el-select"><option value="">（選んでください）</option>${ELEMENTS.map((e) => `<option value="${e.id}"${e.id === selected ? ' selected' : ''}>${e.label}${(data.styles || {})[e.id] ? ' ＊' : ''}</option>`).join('')}</select>
      <small>＊は変更している要素です</small></div>
    ${meta ? `<fieldset><legend>${meta.label}</legend>${fields}
      <button type="button" class="reset-one">この要素を標準に戻す</button></fieldset>` : ''}
    <button type="button" class="danger reset-all">すべてのデザインを標準に戻す</button>`;

  pane.querySelector('#el-select').addEventListener('change', (e) => select(e.target.value || null));
  pane.querySelectorAll('[data-style]').forEach((el) => {
    if (el.classList.contains('unset')) {
      el.addEventListener('click', () => { setStyle(el.dataset.style, ''); buildDesign(); });
      return;
    }
    const ev = el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'color' ? 'change' : 'input';
    el.addEventListener(ev, () => {
      setStyle(el.dataset.style, el.type === 'checkbox' ? el.checked : el.value);
      if (el.type === 'color' || el.type === 'checkbox') buildDesign();
    });
  });
  pane.querySelector('.reset-one')?.addEventListener('click', () => {
    delete data.styles[selected]; update(); buildDesign();
  });
  pane.querySelector('.reset-all').addEventListener('click', () => {
    if (!confirm('すべての要素のデザイン設定を標準に戻します。入力した文字はそのままです。よろしいですか？')) return;
    data.styles = {}; update(); buildDesign();
  });
}

function setStyle(key, value) {
  data.styles = data.styles || {};
  const st = { ...(data.styles[selected] || {}) };
  if (value === '' || value === false) delete st[key]; else st[key] = value;
  if (Object.keys(st).length) data.styles[selected] = st; else delete data.styles[selected];
  update();
}

function select(id) {
  selected = id;
  document.querySelectorAll('#sheet .selected').forEach((n) => n.classList.remove('selected'));
  if (id) document.querySelectorAll(`#sheet [data-el="${id}"]`).forEach((n) => n.classList.add('selected'));
  buildDesign();
}

// ---------- 書類の設定 ----------
function buildSettings() {
  const pane = document.getElementById('tab-settings');
  pane.innerHTML = `
    <fieldset><legend>種類</legend>
      <div class="field"><label for="doc-type">発行物</label>
        <select id="doc-type">
          <option value="komei-soto" selected>公明ニュース 外面</option>
          <option disabled>公明ニュース 中面（準備中）</option>
          <option disabled>後援会通信（かじわら一哉通信の型・準備中）</option>
        </select></div>
    </fieldset>
    <fieldset><legend>用紙・印刷</legend>
      <p>${TEMPLATE.paper}</p>
      <p>塗り足し ${TEMPLATE.bleed}mm を含めた ${TEMPLATE.width + TEMPLATE.bleed * 2}×${TEMPLATE.height + TEMPLATE.bleed * 2}mm で出力します。</p>
      <div class="field check"><label><input type="checkbox" id="show-trim"${data.print?.showTrim ? ' checked' : ''}> プレビューに仕上がり線と折り線を出す（印刷には出ません）</label></div>
    </fieldset>
    <fieldset><legend>色</legend>
      <div class="field"><label for="theme">テーマ色（題字・見出し・帯・背景の斜線などの色）</label>
        <div class="row"><input type="color" id="theme" value="${data.theme || '#2fb5a3'}">
        <button type="button" class="small" id="theme-reset">標準に戻す</button></div></div>
      <div class="field"><label for="stripe-a">背景の斜線の色</label>
        <div class="row"><input type="color" id="stripe-a" value="${data.stripeA || '#b8e3dd'}"><span class="muted">${data.stripeA ? '' : 'テーマ色に合わせる'}</span>
        <button type="button" class="small" id="stripe-a-reset">標準に戻す</button></div></div>
      <div class="field"><label for="stripe-b">背景の地の色（斜線の間）</label>
        <div class="row"><input type="color" id="stripe-b" value="${data.stripeB || '#e6f5f2'}"><span class="muted">${data.stripeB ? '' : 'テーマ色に合わせる'}</span>
        <button type="button" class="small" id="stripe-b-reset">標準に戻す</button></div></div>
    </fieldset>`;
  pane.querySelector('#show-trim').addEventListener('change', (e) => { set(data, 'print.showTrim', e.target.checked); update(); });
  pane.querySelector('#theme').addEventListener('input', (e) => { data.theme = e.target.value; update(); });
  pane.querySelector('#theme-reset').addEventListener('click', () => { data.theme = ''; buildSettings(); update(); });
  [['stripe-a', 'stripeA'], ['stripe-b', 'stripeB']].forEach(([id, key]) => {
    pane.querySelector(`#${id}`).addEventListener('input', (e) => { data[key] = e.target.value; update(); });
    pane.querySelector(`#${id}`).addEventListener('change', () => buildSettings());
    pane.querySelector(`#${id}-reset`).addEventListener('click', () => { data[key] = ''; buildSettings(); update(); });
  });
}

function switchTab(name) {
  activeTab = name;
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab').forEach((t) => { t.hidden = t.id !== `tab-${name}`; });
  document.getElementById('sheet').classList.toggle('design', name === 'design');
  if (name === 'design') buildDesign();
  if (name !== 'design') select(null);
  document.getElementById('quick-edit').hidden = true;
}

function makeQr(url) {
  const qr = window.qrcode(0, 'H');
  qr.addData(url);
  qr.make();
  return qr.createSvgTag({ cellSize: 2, margin: 0, scalable: true });
}

// ---------- 文字が枠に収まるよう自動で小さくする ----------
function overflows(el) {
  if (el.dataset.fit === '政策') {
    return [...el.querySelectorAll('.policy')].some((p) => p.scrollHeight > p.clientHeight + 1) || el.scrollHeight > el.clientHeight + 1;
  }
  return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
}

function autoFit(sheet) {
  const shrunk = [];
  const over = [];
  sheet.querySelectorAll('[data-fit]').forEach((el) => {
    if (el.tagName === 'IMG' || el.classList.contains('photo-empty')) return;
    let fit = 1;
    el.style.setProperty('--fit', fit);
    while (overflows(el) && fit > MIN_FIT) {
      fit = Math.round((fit - 0.02) * 100) / 100;
      el.style.setProperty('--fit', fit);
    }
    if (overflows(el)) over.push(el.dataset.fit);
    else if (fit < 1) shrunk.push(`${el.dataset.fit}（${Math.round(fit * 100)}%）`);
  });
  return { shrunk, over };
}

// ---------- チェック ----------
function textFields() {
  const out = [];
  contentGroups().forEach((g) => g.items.forEach((f) => {
    if (['photo', 'date', 'number', 'url'].includes(f.type)) return;
    out.push({ label: `${g.group}・${f.label}`, value: String(get(data, f.key) ?? '') });
  }));
  return out;
}

function collectChecks(fit) {
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
    if (!get(data, `photos.${key}`)) { notes.push(`${box.label}がまだ入っていません`); return; }
    const s = photoSizes[key];
    if (!s) return;
    const dpi = Math.min(s.w / (box.w / 25.4), s.h / (box.h / 25.4));
    if (dpi < 300) notes.push(`${box.label}：画質が足りません（約${Math.round(dpi)}dpi、300dpi以上が目安）`);
  });
  fit.over.forEach((name) => notes.push(`${name}：小さくしても枠からあふれています。文字を減らしてください`));
  fit.shrunk.forEach((name) => fixed.push(`${name}：枠に収まるよう文字を小さくしました`));
  return { fixed, notes };
}

function showChecks({ fixed, notes }) {
  const el = document.getElementById('checks');
  const li = (s) => `<li>${s}</li>`;
  el.innerHTML = (notes.length
    ? `<summary class="warn">確認してください（${notes.length}件）</summary><ul>${notes.map(li).join('')}</ul>`
    : '<summary class="ok">注意はありません</summary>')
    + (fixed.length ? `<h3>自動で直したところ（${fixed.length}件）</h3><ul>${fixed.map(li).join('')}</ul>` : '');
}

// ---------- プレビュー ----------
const isNarrow = () => window.matchMedia('(max-width: 860px)').matches;

function sheetScale() {
  const wrap = document.getElementById('preview-wrap');
  const sheet = document.getElementById('sheet');
  const byWidth = (wrap.clientWidth - 2) / sheet.offsetWidth;
  // スマホは幅に合わせる。PCは画面の高さにも収める
  const fit = isNarrow() ? byWidth : Math.min(byWidth, (wrap.clientHeight - 2) / sheet.offsetHeight);
  return zoom === 'fit' ? fit : zoom;
}

function fitPreview() {
  const sheet = document.getElementById('sheet');
  const sizer = document.getElementById('sizer');
  const scale = sheetScale();
  sheet.style.transform = `scale(${scale})`;
  sizer.style.width = `${sheet.offsetWidth * scale}px`;
  sizer.style.height = `${sheet.offsetHeight * scale}px`;
  document.getElementById('zoom-label').textContent = `${Math.round(scale * 100)}%`;
  if (isNarrow()) {
    const wrap = document.getElementById('preview-wrap');
    wrap.style.height = `${Math.min(sheet.offsetHeight * Math.min(scale, (wrap.clientWidth - 2) / sheet.offsetWidth) + 2, window.innerHeight * 0.45)}px`;
  } else {
    document.getElementById('preview-wrap').style.height = '';
  }
}

function setZoom(z) {
  zoom = z === 'fit' ? 'fit' : Math.min(3, Math.max(0.15, z));
  fitPreview();
}

let timer;
function update() {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const sheet = document.getElementById('sheet');
    sheet.innerHTML = render(data, { makeQr });
    sheet.classList.toggle('show-trim', !!data.print?.showTrim);
    // 色の設定は用紙全体（背景の斜線を含む）にかける
    [['--teal', data.theme], ['--stripe-a', data.stripeA], ['--stripe-b', data.stripeB]].forEach(([name, v]) => {
      if (v) sheet.style.setProperty(name, v); else sheet.style.removeProperty(name);
    });
    await Promise.all([...sheet.querySelectorAll('img')].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))));
    Object.keys(PHOTO_BOXES).forEach((key) => {
      const img = sheet.querySelector(`.photo-${key}`);
      photoSizes[key] = img && img.tagName === 'IMG' ? { w: img.naturalWidth, h: img.naturalHeight } : null;
    });
    await document.fonts.ready;
    const fit = autoFit(sheet);
    fitPreview();
    if (selected) document.querySelectorAll(`#sheet [data-el="${selected}"]`).forEach((n) => n.classList.add('selected'));
    showChecks(collectChecks(fit));
    saveDraft(data);
  }, 120);
}

// ---------- プレビュー上での選択とドラッグ ----------
function initDrag() {
  const sheet = document.getElementById('sheet');
  let drag = null;
  sheet.addEventListener('pointerdown', (e) => {
    if (activeTab !== 'design') return;
    const target = e.target.closest('[data-el]');
    if (!target) return;
    e.preventDefault();
    const id = target.dataset.el;
    if (id !== selected) select(id);
    const st = (data.styles || {})[id] || {};
    drag = { id, x: e.clientX, y: e.clientY, dx: Number(st.dx) || 0, dy: Number(st.dy) || 0, moved: false };
    sheet.setPointerCapture(e.pointerId);
  });
  sheet.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const k = 1 / sheetScale() / PX_PER_MM;
    const dx = Math.round((drag.dx + (e.clientX - drag.x) * k) * 2) / 2;
    const dy = Math.round((drag.dy + (e.clientY - drag.y) * k) * 2) / 2;
    if (dx === drag.nx && dy === drag.ny) return;
    drag.nx = dx; drag.ny = dy; drag.moved = true;
    const st = { ...((data.styles || {})[drag.id] || {}), dx, dy };
    // 動かしている間は再描画せず、位置だけ変える
    document.querySelectorAll(`#sheet [data-el="${drag.id}"]`).forEach((n) => {
      n.style.translate = styleAttr(st).match(/translate:([^;"]+)/)?.[1] || '';
    });
  });
  const end = () => {
    if (drag?.moved) {
      data.styles = data.styles || {};
      data.styles[drag.id] = { ...(data.styles[drag.id] || {}), dx: drag.nx, dy: drag.ny };
      update(); buildDesign();
    }
    drag = null;
  };
  sheet.addEventListener('pointerup', end);
  sheet.addEventListener('pointercancel', end);
}

// ---------- プレビューから編集（「内容」タブのとき） ----------
function findField(key) {
  for (const g of contentGroups()) {
    const f = g.items.find((it) => it.key === key);
    if (f) return { ...f, group: g.group };
  }
  return null;
}

function focusGroup(name) {
  const legend = [...document.querySelectorAll('#tab-content legend')].find((l) => l.textContent === name);
  if (!legend) return;
  legend.parentElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  legend.parentElement.classList.add('flash');
  setTimeout(() => legend.parentElement.classList.remove('flash'), 1200);
}

function openQuickEdit(key) {
  if (key.startsWith('@')) { focusGroup(key.slice(1)); return; }
  const f = findField(key);
  if (!f) return;
  const formEl = document.getElementById(`f-${key.replace(/\./g, '-')}`);
  if (f.type === 'photo') { formEl?.click(); return; }
  const box = document.getElementById('quick-edit');
  const area = box.querySelector('textarea');
  box.querySelector('label').textContent = `${f.group}・${f.label}`;
  area.value = get(data, key) ?? '';
  area.placeholder = f.placeholder || '';
  area.rows = f.type === 'textarea' ? (f.rows || 3) + 1 : 2;
  box.hidden = false;
  area.focus();
  area.oninput = () => {
    set(data, key, area.value);
    if (formEl) formEl.value = area.value;
    update();
  };
  box.querySelector('.qe-form').onclick = () => {
    box.hidden = true;
    formEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    formEl?.focus({ preventScroll: true });
  };
}

function initQuickEdit() {
  const box = document.getElementById('quick-edit');
  box.querySelector('.qe-close').addEventListener('click', () => { box.hidden = true; });
  document.getElementById('sheet').addEventListener('click', (e) => {
    if (activeTab === 'design') return;
    const t = e.target.closest('[data-edit]');
    if (t) openQuickEdit(t.dataset.edit);
  });
}

function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function loadData(d) {
  data = { ...structuredClone(SAMPLE), ...d };
  data.policies = Array.isArray(data.policies) ? data.policies : [];
  data.styles = data.styles || {};
  data.labels = data.labels || {};
  selected = null;
  buildContent(); buildSettings(); if (activeTab === 'design') buildDesign();
  update();
}

async function init() {
  const saved = await loadDraft();
  document.getElementById('sheet').style.width = `${TEMPLATE.width + TEMPLATE.bleed * 2}mm`;
  document.getElementById('sheet').style.height = `${TEMPLATE.height + TEMPLATE.bleed * 2}mm`;
  document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  document.getElementById('btn-print').addEventListener('click', () => { select(null); window.print(); });
  document.getElementById('btn-sample').addEventListener('click', () => {
    if (!confirm('入力中の内容とデザイン設定を、見本に置き換えます。よろしいですか？')) return;
    loadData(structuredClone(SAMPLE));
  });
  document.getElementById('btn-export').addEventListener('click', () => download(`${data.name || '原稿'}_公明ニュース外面.json`, JSON.stringify(data)));
  document.getElementById('btn-import').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    file.text().then((t) => loadData(JSON.parse(t)));
  });
  document.getElementById('zoom-in').addEventListener('click', () => setZoom(sheetScale() * 1.25));
  document.getElementById('zoom-out').addEventListener('click', () => setZoom(sheetScale() / 1.25));
  document.getElementById('zoom-fit').addEventListener('click', () => setZoom('fit'));
  document.getElementById('preview-wrap').addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setZoom(sheetScale() * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
  }, { passive: false });
  document.getElementById('toggle-preview').addEventListener('click', () => {
    document.body.classList.toggle('preview-collapsed');
    fitPreview();
  });
  window.addEventListener('resize', fitPreview);
  initDrag();
  initQuickEdit();
  loadData(saved || structuredClone(SAMPLE));
  switchTab('content');
}

init();

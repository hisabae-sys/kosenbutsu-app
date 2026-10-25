import {
  render, TEMPLATE, QR_KINDS, PHOTO_BOXES, FONTS, DEFAULT_LABELS,
} from './templates/komei-soto.js?v=5';
import { removeDigitUnitSpaces, warnings, urlWarnings, DEFAULT_AGE_BASE_DATE } from './rules.js?v=5';
import { SAMPLE } from './sample.js?v=5';

const DB_NAME = 'kosenbutsu';
const STORE = 'drafts';
const DRAFT_KEY = 'komei-soto';
const MAX_POLICIES = 5;
const PX_PER_MM = 96 / 25.4;
const MIN_FIT = 0.7; // 文字は7割まで自動で小さくする
const DRAG_START_PX = 4; // これより動いたらドラッグとみなす

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

// ---------- 入力項目（内容） ----------
const F = (key, label, extra = {}) => ({ key, label, ...extra });
const L = (key, label, extra = {}) => F(`labels.${key}`, label, { placeholder: DEFAULT_LABELS[key], ...extra });
const ROLES = ['県代表', '県幹事長', '県副代表', '県青年局長', '県女性局長', '支部長', '副支部長'];

// 一覧に並べる要素。styles はデザインを設定できる部品（プレビューの data-el）
const PANEL = [
  { group: '全体', items: [
    { id: 'doc', label: '書類の設定（種類・用紙・色）', styles: [], doc: true },
  ] },
  { group: '表紙（右の面）', items: [
    { id: 'title', label: '題字「公明ニュース」', styles: ['title', 'masthead'], fields: [L('titleA', '題字（前半）'), L('titleB', '題字（後半）')] },
    { id: 'title-sub', label: '題字の英字', styles: ['title-sub'], fields: [L('titleSub', '英字')] },
    { id: 'issue-tag', label: '号数', styles: ['issue-tag'], fields: [F('season', '号', { placeholder: '2026秋号' }), L('issuePrefix', '号数の前の文字'), F('vol', '号数', { placeholder: '03' })] },
    { id: 'publisher', label: '発行元・発行年月', styles: ['publisher'], fields: [L('publisher', '発行元', { type: 'textarea', rows: 2 }), L('issuedPrefix', '発行年月の前の文字'), F('issued', '発行年月', { placeholder: '2026年10月' })] },
    { id: 'cover-catch', label: 'キャッチコピー', styles: ['cover-catch'], fields: [F('catch', 'キャッチコピー', { type: 'textarea', rows: 2, hint: '改行で行を分けます' })] },
    { id: 'band', label: '縦の帯', styles: ['band'], fields: [F('band', '帯の文字', { placeholder: '公明党の政策推進力' })] },
    { id: 'tokushu-right', label: '特集ラベル（表紙）', styles: ['tokushu-right'], fields: [F('town', '市町名', { placeholder: '徳島市' }), L('tokushu', '特集ラベル', { hint: '空欄なら「市町名＋特集」', placeholder: '' })] },
    { id: 'cover-name', label: '表紙の名前', styles: ['cover-name'], fields: [F('name', '表示名', { placeholder: 'こうめい花子' }), F('rubyBase', 'ふりがなを付ける部分', { placeholder: '花子', hint: '表示名のうち漢字の部分' }), F('ruby', 'ふりがな', { placeholder: 'はなこ' }), L('coverNo', '名前の後ろ'), L('coverChallenge', '横の列')] },
    { id: 'photo-face', label: '表紙の顔写真', styles: ['photo-face'], fields: [F('photos.face', '顔写真', { type: 'photo' })] },
    { id: 'circle', label: '白い円', styles: ['circle'] },
    { id: 'logo', label: '公明党ロゴ', styles: ['logo'], fields: [F('photos.logo', 'ロゴの画像', { type: 'photo', hint: '入れない場合は印刷時に空けます' })] },
  ] },
  { group: 'プロフィール面（左の面）', items: [
    { id: 'bubble', label: '吹き出し', styles: ['bubble'] },
    { id: 'tokushu-left', label: '特集ラベル（プロフィール面）', styles: ['tokushu-left'], fields: [F('town', '市町名', { placeholder: '徳島市' }), L('tokushu', '特集ラベル', { hint: '空欄なら「市町名＋特集」', placeholder: '' })] },
    { id: 'bubble-catch', label: '吹き出しのキャッチ', styles: ['bubble-catch'], fields: [F('bubble', 'キャッチ（縦書き）', { type: 'textarea', rows: 3, hint: '1行が縦1列になります' })] },
    { id: 'photo-full', label: '全身写真', styles: ['photo-full'], fields: [F('photos.full', '全身写真', { type: 'photo' })] },
    { id: 'challenge-head', label: '政策の見出し', styles: ['challenge-head'], fields: [F('name', '表示名'), L('challengeSuffix', '名前の後ろ')] },
    { id: 'policies', label: '政策（チャレンジ）', styles: ['policy-no', 'policy-title', 'policy-body'], policies: true },
    { id: 'profile-head', label: 'プロフィールの見出し', styles: ['profile-head'], fields: [F('name', '表示名'), L('profileSuffix', '名前の後ろ')] },
    { id: 'profile', label: 'プロフィール', styles: ['profile'], fields: [
      F('birth', '生年月日', { type: 'date', hint: '年齢は自動で計算します' }),
      F('ageBaseDate', '年齢を数える日', { type: 'date', hint: `空欄なら ${DEFAULT_AGE_BASE_DATE}` }),
      F('hometown', '出身地', { placeholder: '徳島市' }),
      F('schools', '学歴', { type: 'textarea', rows: 4, hint: '1行に1校。「卒」「県立」などは自動でそろえます' }),
      F('career', '職歴'),
      F('role', '党役職', { list: 'roles' }),
      F('term', '期数（現職のみ）', { type: 'number', hint: '数字だけ。「（現在N期目）」になります' }),
      F('license', '資格'), F('hobby', '趣味'), F('family', '家族'), F('motto', '座右の銘'),
      F('extra', 'その他の行', { type: 'textarea', rows: 3, hint: '1行ずつ。行頭の○は自動で付きます' }),
    ] },
    { id: 'qr-row', label: 'QRコード', styles: ['qr-row'], fields: QR_KINDS.map((k) => F(`qr.${k.key}`, `${k.label}のURL`, { type: 'url' })) },
  ] },
];

const STYLE_LABELS = {
  masthead: '題字の枠', 'policy-no': '数字', 'policy-title': '見出し文', 'policy-body': '本文',
};
const ITEMS = PANEL.flatMap((g) => g.items);
const ITEM_OF_STYLE = Object.fromEntries(ITEMS.flatMap((it) => it.styles.map((s) => [s, it.id])));
const TEXT_STYLES = new Set(['title', 'title-sub', 'issue-tag', 'publisher', 'cover-catch', 'band', 'tokushu-right', 'cover-name',
  'tokushu-left', 'bubble-catch', 'challenge-head', 'policy-no', 'policy-title', 'policy-body', 'profile-head', 'profile']);

const policyFields = (i) => [
  F(`policies.${i}.title`, '見出し', { type: 'textarea', rows: 2, hint: '改行で2行に分けます' }),
  F(`policies.${i}.body`, '本文', { type: 'textarea', rows: 4 }),
  F(`policies.${i}.illust`, 'イラスト（任意）', { type: 'photo' }),
];

function allFields() {
  const out = [];
  ITEMS.forEach((it) => (it.fields || []).forEach((f) => out.push({ ...f, where: it.label })));
  (data.policies || []).forEach((_, i) => policyFields(i).forEach((f) => out.push({ ...f, where: `政策${i + 1}` })));
  return out;
}

// ---------- デザインの設定項目 ----------
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
  { key: 'hidden', label: '表示しない', type: 'checkbox' },
];

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
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let data = structuredClone(SAMPLE);
let openItem = null; // 開いている要素
let focusPolicy = null; // 政策の何番目を押したか
let zoom = 'fit';
const photoSizes = {};

// ---------- 入力欄の部品 ----------
function fieldHtml(f) {
  const id = `f-${f.key.replace(/\./g, '-')}`;
  const hint = f.hint ? `<small>${f.hint}</small>` : '';
  if (f.type === 'photo') {
    const has = get(data, f.key);
    return `<div class="field"><label for="${id}">${f.label}<em>${has ? '（入っています）' : ''}</em></label>
      <input type="file" accept="image/*" id="${id}" data-key="${f.key}">
      ${has ? `<button type="button" class="small clear-photo" data-key="${f.key}">外す</button>` : ''}${hint}</div>`;
  }
  const common = `id="${id}" data-key="${f.key}" ${f.placeholder ? `placeholder="${escAttr(f.placeholder)}"` : ''}`;
  const input = f.type === 'textarea'
    ? `<textarea ${common} rows="${f.rows || 3}"></textarea>`
    : `<input type="${f.type || 'text'}" ${common} ${f.list ? `list="${f.list}"` : ''}>`;
  return `<div class="field"><label for="${id}">${f.label}</label>${input}${hint}</div>`;
}

function bindFields(root) {
  $$('[data-key]:not([type=file]):not(button)', root).forEach((el) => {
    el.value = get(data, el.dataset.key) ?? '';
    el.addEventListener('input', () => {
      set(data, el.dataset.key, el.value);
      // 同じ項目（市町名・表示名など）が別の要素の欄にもあればそろえる
      $$(`#panel [data-key="${el.dataset.key}"]`).forEach((o) => { if (o !== el) o.value = el.value; });
      update();
    });
  });
  $$('input[type=file]', root).forEach((el) => el.addEventListener('change', () => {
    const file = el.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { set(data, el.dataset.key, reader.result); refreshOpen(); update(); };
    reader.readAsDataURL(file);
  }));
  $$('.clear-photo', root).forEach((b) => b.addEventListener('click', () => {
    set(data, b.dataset.key, ''); refreshOpen(); update();
  }));
}

function currentMm(el, prop) {
  if (!el) return '';
  const px = prop === 'width' ? el.offsetWidth : prop === 'height' ? el.offsetHeight : parseFloat(getComputedStyle(el)[prop]);
  return (px / PX_PER_MM).toFixed(1);
}

function styleSection(styleId, single) {
  const st = (data.styles || {})[styleId] || {};
  const target = $(`#sheet [data-el="${styleId}"]`);
  const isText = TEXT_STYLES.has(styleId);
  const rows = STYLE_FIELDS.filter((f) => !f.text || isText).map((f) => {
    const id = `s-${styleId}-${f.key}`;
    const v = st[f.key] ?? '';
    const attrs = `id="${id}" data-style="${styleId}" data-prop="${f.key}"`;
    if (f.type === 'select') {
      return `<div class="field half"><label for="${id}">${f.label}</label><select ${attrs}>${f.options.map((o) => `<option value="${escAttr(o.value)}"${o.value === v ? ' selected' : ''}>${o.label}</option>`).join('')}</select></div>`;
    }
    if (f.type === 'checkbox') {
      return `<div class="field half check"><label><input type="checkbox" ${attrs}${v ? ' checked' : ''}> ${f.label}</label></div>`;
    }
    if (f.type === 'color') {
      return `<div class="field half"><label for="${id}">${f.label}</label><div class="row"><input type="color" ${attrs} value="${v || '#000000'}">${v ? `<button type="button" class="small unset" data-style="${styleId}" data-prop="${f.key}">型に戻す</button>` : '<span class="muted">型のまま</span>'}</div></div>`;
    }
    const ph = f.current ? currentMm(target, f.current) : '';
    return `<div class="field half"><label for="${id}">${f.label}</label><input type="number" inputmode="decimal" step="${f.step}" ${attrs} value="${escAttr(v)}" placeholder="${ph ? `いま ${ph}` : '型のまま'}"></div>`;
  }).join('');
  const changed = Object.keys(st).length ? ' ＊変更あり' : '';
  const title = single ? 'デザイン' : `デザイン（${STYLE_LABELS[styleId] || styleId}）`;
  return `<details class="design" data-style-section="${styleId}"${changed ? ' open' : ''}><summary>${title}<span class="changed">${changed}</span></summary>
    <div class="grid">${rows}</div>
    <button type="button" class="small reset-one" data-style="${styleId}">このデザインを標準に戻す</button></details>`;
}

function bindStyles(root) {
  $$('[data-prop]', root).forEach((el) => {
    if (el.classList.contains('unset')) {
      el.addEventListener('click', () => { setStyle(el.dataset.style, el.dataset.prop, ''); refreshOpen(); });
      return;
    }
    const ev = el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'color' ? 'change' : 'input';
    el.addEventListener(ev, () => {
      setStyle(el.dataset.style, el.dataset.prop, el.type === 'checkbox' ? el.checked : el.value);
      if (el.type !== 'number') refreshOpen();
    });
    if (el.type === 'color') el.addEventListener('input', () => setStyle(el.dataset.style, el.dataset.prop, el.value));
  });
  $$('.reset-one', root).forEach((b) => b.addEventListener('click', () => {
    delete data.styles[b.dataset.style]; update(); refreshOpen();
  }));
}

function setStyle(styleId, key, value) {
  data.styles = data.styles || {};
  const st = { ...(data.styles[styleId] || {}) };
  if (value === '' || value === false) delete st[key]; else st[key] = value;
  if (Object.keys(st).length) data.styles[styleId] = st; else delete data.styles[styleId];
  update();
}

// ---------- 要素ごとの編集欄 ----------
function docBody() {
  const color = (id, key, def, label) => `<div class="field"><label for="${id}">${label}</label>
    <div class="row"><input type="color" id="${id}" data-doc="${key}" value="${data[key] || def}">
    ${data[key] ? `<button type="button" class="small" data-doc-reset="${key}">標準に戻す</button>` : '<span class="muted">標準</span>'}</div></div>`;
  return `
    <div class="field"><label for="doc-type">発行物の種類</label>
      <select id="doc-type">
        <option value="komei-soto" selected>公明ニュース 外面</option>
        <option disabled>公明ニュース 中面（準備中）</option>
        <option disabled>後援会通信（かじわら一哉通信の型・準備中）</option>
      </select></div>
    <p class="muted">用紙：${TEMPLATE.paper}。塗り足し ${TEMPLATE.bleed}mm を含めた ${TEMPLATE.width + TEMPLATE.bleed * 2}×${TEMPLATE.height + TEMPLATE.bleed * 2}mm で出力します。</p>
    <div class="field check"><label><input type="checkbox" id="show-trim"${data.print?.showTrim ? ' checked' : ''}> プレビューに仕上がり線と折り線を出す（印刷には出ません）</label></div>
    ${color('theme', 'theme', '#2fb5a3', 'テーマ色（題字・見出し・帯・背景の斜線など）')}
    ${color('stripe-a', 'stripeA', '#b8e3dd', '背景の斜線の色（標準はテーマ色に合わせる）')}
    ${color('stripe-b', 'stripeB', '#e6f5f2', '背景の地の色（標準はテーマ色に合わせる）')}
    <button type="button" class="danger reset-all">すべてのデザインを標準に戻す</button>`;
}

function bindDoc(root) {
  $('#show-trim', root).addEventListener('change', (e) => { set(data, 'print.showTrim', e.target.checked); update(); });
  $$('[data-doc]', root).forEach((el) => {
    el.addEventListener('input', () => { data[el.dataset.doc] = el.value; update(); });
    el.addEventListener('change', () => refreshOpen());
  });
  $$('[data-doc-reset]', root).forEach((b) => b.addEventListener('click', () => { data[b.dataset.docReset] = ''; refreshOpen(); update(); }));
  $('.reset-all', root).addEventListener('click', () => {
    if (!confirm('すべての要素のデザインと色を標準に戻します。入力した文字はそのままです。よろしいですか？')) return;
    data.styles = {}; data.theme = ''; data.stripeA = ''; data.stripeB = '';
    refreshOpen(); update();
  });
}

function policiesBody() {
  const list = (data.policies || []).map((_, i) => `
    <fieldset class="policy-set${focusPolicy === i ? ' focus' : ''}" data-policy="${i}"><legend>政策${i + 1}</legend>
      ${policyFields(i).map(fieldHtml).join('')}
      <button type="button" class="small danger remove-policy" data-i="${i}">この政策を削除</button></fieldset>`).join('');
  const add = data.policies.length < MAX_POLICIES ? '<button type="button" class="add-policy">＋ 政策を追加</button>' : '';
  return list + add;
}

function itemBody(it) {
  if (it.doc) return docBody();
  const content = it.policies ? policiesBody() : (it.fields || []).map(fieldHtml).join('');
  const designs = it.styles.map((s) => styleSection(s, it.styles.length === 1)).join('');
  return content + designs;
}

function bindItem(root, it) {
  if (it.doc) { bindDoc(root); return; }
  bindFields(root);
  bindStyles(root);
  $$('.add-policy', root).forEach((b) => b.addEventListener('click', () => {
    data.policies.push({ title: '', body: '', illust: '' });
    focusPolicy = data.policies.length - 1;
    refreshOpen(); update();
  }));
  $$('.remove-policy', root).forEach((b) => b.addEventListener('click', () => {
    if (!confirm('この政策を削除します。よろしいですか？')) return;
    data.policies.splice(Number(b.dataset.i), 1);
    focusPolicy = null;
    refreshOpen(); update();
  }));
}

function buildPanel() {
  const panel = $('#panel');
  panel.innerHTML = PANEL.map((g) => `
    <section class="group"><h2>${g.group}</h2>
      ${g.items.map((it) => `
        <div class="item${openItem === it.id ? ' open' : ''}" data-item="${it.id}">
          <button type="button" class="item-head" data-item="${it.id}">
            <span>${it.label}</span>${it.styles.some((s) => (data.styles || {})[s]) ? '<span class="changed">＊</span>' : ''}
            <span class="chev">${openItem === it.id ? '▲' : '▼'}</span></button>
          ${openItem === it.id ? `<div class="item-body">${itemBody(it)}</div>` : ''}
        </div>`).join('')}
    </section>`).join('')
    + `<datalist id="roles">${ROLES.map((r) => `<option value="${r}">`).join('')}</datalist>`;
  $$('.item-head', panel).forEach((h) => {
    h.addEventListener('click', () => openPanelItem(openItem === h.dataset.item ? null : h.dataset.item));
    h.addEventListener('mouseenter', () => highlight(h.dataset.item, true));
    h.addEventListener('mouseleave', () => highlight(h.dataset.item, false));
  });
  const it = ITEMS.find((x) => x.id === openItem);
  if (it) bindItem($('.item.open .item-body', panel), it);
}

function refreshOpen() {
  const scroll = $('.editor').scrollTop;
  buildPanel();
  $('.editor').scrollTop = scroll;
  markSelection();
}

function openPanelItem(id, { scroll = false, policy = null } = {}) {
  openItem = id;
  focusPolicy = policy;
  buildPanel();
  markSelection();
  if (!id) return;
  const node = $(`.item[data-item="${id}"]`);
  if (scroll) {
    const target = (policy != null && $(`.policy-set[data-policy="${policy}"]`)) || node;
    if (isNarrow()) {
      // スマホでは上に固定したプレビューの下に来るようにずらす
      const top = $('.preview').getBoundingClientRect().bottom + 8;
      window.scrollBy({ top: target.getBoundingClientRect().top - top, behavior: 'smooth' });
    } else {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  const first = $(`.item[data-item="${id}"] ${policy != null ? `.policy-set[data-policy="${policy}"] ` : ''}textarea, .item[data-item="${id}"] input:not([type=file]):not([type=checkbox]):not([type=color])`);
  // スマホでキーボードが勝手に開かないよう、PCのときだけ入力欄に移る
  if (first && !isNarrow()) first.focus({ preventScroll: true });
}

// ---------- プレビューでの強調・選択枠 ----------
function stylesOf(itemId) {
  return ITEMS.find((x) => x.id === itemId)?.styles || [];
}

function highlight(itemId, on) {
  stylesOf(itemId).forEach((s) => $$(`#sheet [data-el="${s}"]`).forEach((n) => n.classList.toggle('hl', on)));
}

function markSelection() {
  $$('#sheet .selected').forEach((n) => n.classList.remove('selected'));
  const handle = $('#sel-handle');
  if (handle) handle.remove();
  if (!openItem) return;
  const ids = stylesOf(openItem);
  ids.forEach((s) => $$(`#sheet [data-el="${s}"]`).forEach((n) => n.classList.add('selected')));
  // 大きさを変えるつまみは、部品が1つだけの要素に付ける
  const own = $$(`#sheet [data-el="${ids[0]}"]`);
  if (own.length !== 1) return;
  const sheet = $('#sheet');
  const s = sheetScale();
  const r = own[0].getBoundingClientRect();
  const sr = sheet.getBoundingClientRect();
  const h = document.createElement('div');
  h.id = 'sel-handle';
  h.className = 'sel-handle';
  h.title = 'ドラッグで大きさを変える';
  h.dataset.style = ids[0];
  h.style.left = `${(r.right - sr.left) / s}px`;
  h.style.top = `${(r.bottom - sr.top) / s}px`;
  h.style.width = h.style.height = `${(isNarrow() ? 28 : 16) / s}px`;
  h.style.borderWidth = `${2 / s}px`;
  sheet.appendChild(h);
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
    return $$('.policy', el).some((p) => p.scrollHeight > p.clientHeight + 1) || el.scrollHeight > el.clientHeight + 1;
  }
  return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
}

function autoFit(sheet) {
  const shrunk = [];
  const over = [];
  $$('[data-fit]', sheet).forEach((el) => {
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
function collectChecks(fit) {
  const fixed = [];
  const notes = [];
  const seen = new Set();
  allFields().forEach((f) => {
    if (['photo', 'date', 'number', 'url'].includes(f.type) || seen.has(f.key)) return;
    seen.add(f.key);
    const value = String(get(data, f.key) ?? '');
    if (!value) return;
    const label = `${f.where}・${f.label}`;
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
  const el = $('#checks');
  const wasOpen = el.open;
  const li = (s) => `<li>${s}</li>`;
  el.innerHTML = `<summary class="${notes.length ? 'warn' : 'ok'}">${notes.length ? `確認してください（${notes.length}件）` : '注意はありません'}${fixed.length ? `・自動で直したところ ${fixed.length}件` : ''}</summary>`
    + (notes.length ? `<ul>${notes.map(li).join('')}</ul>` : '')
    + (fixed.length ? `<h3>自動で直したところ</h3><ul>${fixed.map(li).join('')}</ul>` : '');
  el.open = wasOpen;
}

// ---------- プレビュー ----------
const isNarrow = () => window.matchMedia('(max-width: 860px)').matches;

function sheetScale() {
  const wrap = $('#preview-wrap');
  const sheet = $('#sheet');
  const byWidth = (wrap.clientWidth - 2) / sheet.offsetWidth;
  // スマホは幅に合わせる。PCは画面の高さにも収める
  const fit = isNarrow() ? byWidth : Math.min(byWidth, (wrap.clientHeight - 2) / sheet.offsetHeight);
  return zoom === 'fit' ? fit : zoom;
}

function fitPreview() {
  const sheet = $('#sheet');
  const sizer = $('#sizer');
  const wrap = $('#preview-wrap');
  const scale = sheetScale();
  sheet.style.transform = `scale(${scale})`;
  sizer.style.width = `${sheet.offsetWidth * scale}px`;
  sizer.style.height = `${sheet.offsetHeight * scale}px`;
  $('#zoom-label').textContent = `${Math.round(scale * 100)}%`;
  if (isNarrow()) {
    wrap.style.height = `${Math.min(sheet.offsetHeight * Math.min(scale, (wrap.clientWidth - 2) / sheet.offsetWidth) + 2, window.innerHeight * 0.45)}px`;
  } else {
    wrap.style.height = '';
  }
}

function setZoom(z) {
  zoom = z === 'fit' ? 'fit' : Math.min(3, Math.max(0.15, z));
  fitPreview();
  markSelection();
}

let timer;
function update() {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const sheet = $('#sheet');
    sheet.innerHTML = render(data, { makeQr });
    sheet.classList.toggle('show-trim', !!data.print?.showTrim);
    // 色の設定は用紙全体（背景の斜線を含む）にかける
    [['--teal', data.theme], ['--stripe-a', data.stripeA], ['--stripe-b', data.stripeB]].forEach(([name, v]) => {
      if (v) sheet.style.setProperty(name, v); else sheet.style.removeProperty(name);
    });
    await Promise.all($$('img', sheet).map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))));
    Object.keys(PHOTO_BOXES).forEach((key) => {
      const img = $(`.photo-${key}`, sheet);
      photoSizes[key] = img && img.tagName === 'IMG' ? { w: img.naturalWidth, h: img.naturalHeight } : null;
    });
    await document.fonts.ready;
    const fit = autoFit(sheet);
    fitPreview();
    markSelection();
    showChecks(collectChecks(fit));
    saveDraft(data);
  }, 120);
}

// ---------- プレビューを押す・ドラッグする ----------
function initPointer() {
  const sheet = $('#sheet');
  const wrap = $('#preview-wrap');
  let drag = null;
  // 要素を押した直後の click（つかんだ要素ではなく #sheet に届く）で選択が外れないようにする
  let swallowClick = false;

  sheet.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.sel-handle');
    const target = e.target.closest('[data-el]');
    if (!handle && !target) return;
    const styleId = handle ? handle.dataset.style : target.dataset.el;
    const itemId = ITEM_OF_STYLE[styleId];
    // スマホでは、選んでいない要素の上で指を動かしたら画面のスクロールにする
    if (!handle && e.pointerType === 'touch' && openItem !== itemId) return;
    e.preventDefault();
    const st = (data.styles || {})[styleId] || {};
    const node = handle ? $(`#sheet [data-el="${styleId}"]`) : target;
    drag = {
      styleId, itemId, x: e.clientX, y: e.clientY, moved: false, resize: !!handle,
      dx: Number(st.dx) || 0, dy: Number(st.dy) || 0,
      w: node.offsetWidth / PX_PER_MM, h: node.offsetHeight / PX_PER_MM,
      policy: target?.closest('.policy') ? $$('.policy', sheet).indexOf(target.closest('.policy')) : null,
    };
    sheet.setPointerCapture(e.pointerId);
  });

  sheet.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < DRAG_START_PX) return;
    if (!drag.moved && !drag.resize && openItem !== drag.itemId) openPanelItem(drag.itemId);
    drag.moved = true;
    const k = 1 / sheetScale() / PX_PER_MM;
    const mx = (e.clientX - drag.x) * k;
    const my = (e.clientY - drag.y) * k;
    const half = (v) => Math.round(v * 2) / 2;
    const nodes = $$(`#sheet [data-el="${drag.styleId}"]`);
    if (drag.resize) {
      drag.nw = Math.max(5, half(drag.w + mx));
      drag.nh = Math.max(5, half(drag.h + my));
      nodes.forEach((n) => { n.style.width = `${drag.nw}mm`; n.style.height = `${drag.nh}mm`; });
    } else {
      drag.nx = half(drag.dx + mx);
      drag.ny = half(drag.dy + my);
      nodes.forEach((n) => { n.style.translate = `${drag.nx}mm ${drag.ny}mm`; });
    }
    const h = $('#sel-handle');
    if (h) h.style.display = 'none';
  });

  const end = () => {
    if (!drag) return;
    swallowClick = true;
    setTimeout(() => { swallowClick = false; }, 0);
    if (drag.moved) {
      data.styles = data.styles || {};
      const st = { ...(data.styles[drag.styleId] || {}) };
      if (drag.resize) { st.w = drag.nw; st.h = drag.nh; } else { st.dx = drag.nx; st.dy = drag.ny; }
      data.styles[drag.styleId] = st;
      update(); refreshOpen();
    } else if (!drag.resize) {
      openPanelItem(drag.itemId, { scroll: true, policy: drag.policy });
    }
    drag = null;
  };
  sheet.addEventListener('pointerup', end);
  sheet.addEventListener('pointercancel', () => { drag = null; update(); });

  // 何もない所を押したら選択を外す
  wrap.addEventListener('click', (e) => {
    if (swallowClick) return;
    // スマホで選んでいない要素を軽く押したとき（pointerdown では受けない）はここで開く
    const target = e.target.closest('#sheet [data-el]');
    if (target) {
      const pol = target.closest('.policy');
      openPanelItem(ITEM_OF_STYLE[target.dataset.el], { scroll: true, policy: pol ? $$('.policy', sheet).indexOf(pol) : null });
    } else if (!e.target.closest('.sel-handle') && openItem) {
      openPanelItem(null);
    }
  });
  // スマホで要素を選んでいる間は、その要素の上ではスクロールしない
  sheet.addEventListener('touchmove', (e) => { if (drag) e.preventDefault(); }, { passive: false });
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
  openItem = null;
  buildPanel();
  update();
}

async function init() {
  const saved = await loadDraft();
  $('#sheet').style.width = `${TEMPLATE.width + TEMPLATE.bleed * 2}mm`;
  $('#sheet').style.height = `${TEMPLATE.height + TEMPLATE.bleed * 2}mm`;
  $('#btn-print').addEventListener('click', () => { openPanelItem(null); window.print(); });
  $('#btn-sample').addEventListener('click', () => {
    if (!confirm('入力中の内容とデザイン設定を、見本に置き換えます。よろしいですか？')) return;
    loadData(structuredClone(SAMPLE));
  });
  $('#btn-export').addEventListener('click', () => download(`${data.name || '原稿'}_公明ニュース外面.json`, JSON.stringify(data)));
  $('#btn-import').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    file.text().then((t) => loadData(JSON.parse(t)));
  });
  $('#zoom-in').addEventListener('click', () => setZoom(sheetScale() * 1.25));
  $('#zoom-out').addEventListener('click', () => setZoom(sheetScale() / 1.25));
  $('#zoom-fit').addEventListener('click', () => setZoom('fit'));
  $('#preview-wrap').addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setZoom(sheetScale() * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
  }, { passive: false });
  $('#toggle-preview').addEventListener('click', () => {
    document.body.classList.toggle('preview-collapsed');
    fitPreview();
  });
  window.addEventListener('resize', () => { fitPreview(); markSelection(); });
  initPointer();
  loadData(saved || structuredClone(SAMPLE));
}

init();

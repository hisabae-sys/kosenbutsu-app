// 公明ニュース 外面（A4横・二つ折り）。左＝プロフィール面、右＝表紙。
// 位置はすべて仕上がり線からのmm。塗り足し3mmは .sheet 側で付ける。
// 文字や写真のまとまりには data-el を付け、要素ごとの設定（styles）を重ねられるようにしている。
import {
  autoFix, birthLine, educationText, termText, normalizeProfileMark, PROFILE_SEP,
} from '../rules.js?v=5';

export const TEMPLATE = {
  id: 'komei-soto',
  name: '公明ニュース 外面',
  paper: 'A4（297×210mm）二つ折り・両面カラー（4c－4c）・コート90kg',
  width: 297,
  height: 210,
  bleed: 3,
};

export const PUBLISHER = '公明党徳島県本部ニュース　［発行元］公明党徳島県本部 〒770-0856 徳島市中洲町3丁目5-1 共正ビル1F';

export const DEFAULT_LABELS = {
  titleA: '公明',
  titleB: 'ニュース',
  titleSub: 'TOKUSHIMA',
  issuePrefix: 'vol.',
  publisher: PUBLISHER,
  issuedPrefix: '［発行］',
  tokushu: '', // 空なら「<市町名>特集」
  challengeSuffix: 'のチャレンジ',
  profileSuffix: 'プロフィール',
  coverNo: 'の',
  coverChallenge: 'チャレンジ',
};

export const LABEL_FIELDS = [
  { key: 'titleA', label: '題字（前半）' },
  { key: 'titleB', label: '題字（後半）' },
  { key: 'titleSub', label: '題字の上の英字' },
  { key: 'issuePrefix', label: '号数の前の文字' },
  { key: 'tokushu', label: '特集ラベル', hint: '空欄なら「市町名＋特集」' },
  { key: 'challengeSuffix', label: '政策の見出し（名前の後ろ）' },
  { key: 'profileSuffix', label: 'プロフィールの見出し（名前の後ろ）' },
  { key: 'coverNo', label: '表紙の名前の後ろ' },
  { key: 'coverChallenge', label: '表紙の名前の横の列' },
  { key: 'publisher', label: '発行元の行', type: 'textarea', rows: 2 },
  { key: 'issuedPrefix', label: '発行年月の前の文字' },
];

export const QR_KINDS = [
  { key: 'hp', label: 'ホームページ', icon: '⌂' },
  { key: 'x', label: 'X', icon: '𝕏' },
  { key: 'instagram', label: 'Instagram', icon: '◎' },
  { key: 'facebook', label: 'Facebook', icon: 'f' },
  { key: 'line', label: 'LINE', icon: 'L' },
  { key: 'koenkai', label: '後援会入会', icon: '入' },
];

// 写真の枠（mm）。解像度チェックに使う
export const PHOTO_BOXES = {
  face: { label: '表紙の顔写真', w: 73.5, h: 112 },
  full: { label: 'プロフィール面の全身写真', w: 52, h: 127 },
};

// 設定パネルに出す要素の一覧。text=true は文字の設定（フォント等）ができる
export const ELEMENTS = [
  { id: 'masthead', label: '題字の枠' },
  { id: 'title', label: '題字「公明ニュース」', text: true },
  { id: 'title-sub', label: '題字の英字', text: true },
  { id: 'issue-tag', label: '号数', text: true },
  { id: 'publisher', label: '発行元の行', text: true },
  { id: 'cover-catch', label: 'キャッチコピー', text: true },
  { id: 'band', label: '縦の帯', text: true },
  { id: 'tokushu-right', label: '特集ラベル（表紙）', text: true },
  { id: 'cover-name', label: '表紙の名前', text: true },
  { id: 'photo-face', label: '表紙の顔写真' },
  { id: 'circle', label: '表紙の白い円' },
  { id: 'logo', label: '公明党ロゴ' },
  { id: 'bubble', label: '吹き出し' },
  { id: 'tokushu-left', label: '特集ラベル（プロフィール面）', text: true },
  { id: 'bubble-catch', label: '吹き出しのキャッチ', text: true },
  { id: 'photo-full', label: '全身写真' },
  { id: 'challenge-head', label: '政策の見出し', text: true },
  { id: 'policy-no', label: '政策の数字（全部）', text: true },
  { id: 'policy-title', label: '政策の見出し文（全部）', text: true },
  { id: 'policy-body', label: '政策の本文（全部）', text: true },
  { id: 'profile-head', label: 'プロフィールの見出し', text: true },
  { id: 'profile', label: 'プロフィール', text: true },
  { id: 'qr-row', label: 'QRコードの列' },
];

export const FONTS = [
  { value: '', label: '型のまま' },
  { value: "'BIZ UDPGothic'", label: 'BIZ UDPゴシック' },
  { value: "'Zen Maru Gothic'", label: '丸ゴシック（Zen Maru Gothic）' },
  { value: "'Noto Sans JP'", label: 'ゴシック（Noto Sans JP）' },
  { value: "'Shippori Mincho B1'", label: '明朝（しっぽり明朝）' },
  { value: "'Noto Serif JP'", label: '明朝（Noto Serif JP）' },
];

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const lines = (s) => String(s ?? '').split('\n').map((l) => l.trim()).filter(Boolean);

const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));

// 要素ごとの設定を style 属性にする。位置は「型の位置からのずれ」(mm)
export function styleAttr(st) {
  if (!st) return '';
  const css = [];
  const dx = num(st.dx) || 0;
  const dy = num(st.dy) || 0;
  if (dx || dy) css.push(`translate:${dx}mm ${dy}mm`);
  if (num(st.w) != null) css.push(`width:${num(st.w)}mm`);
  if (num(st.h) != null) css.push(`height:${num(st.h)}mm`);
  if (st.font) css.push(`font-family:${st.font}`);
  if (num(st.size) != null) css.push(`font-size:calc(${num(st.size)}mm * var(--fit, 1))`);
  if (st.color) css.push(`color:${st.color}`);
  if (st.bg) css.push(`background:${st.bg}`);
  if (st.bold === 'bold') css.push('font-weight:700');
  if (st.bold === 'normal') css.push('font-weight:400');
  if (st.italic === 'on') css.push('font-style:italic');
  if (st.italic === 'off') css.push('font-style:normal');
  if (st.dir === 'vertical') css.push('writing-mode:vertical-rl');
  if (st.dir === 'horizontal') css.push('writing-mode:horizontal-tb');
  if (st.align) css.push(`text-align:${st.align}`);
  if (num(st.lineHeight) != null) css.push(`line-height:${num(st.lineHeight)}`);
  if (num(st.letter) != null) css.push(`letter-spacing:${num(st.letter)}mm`);
  if (st.hidden) css.push('display:none');
  return css.length ? ` style="${css.join(';')}"` : '';
}

function profileLines(d) {
  const out = [];
  const birth = birthLine(d.birth, d.hometown, d.ageBaseDate || undefined);
  if (birth) out.push(birth);
  const edu = educationText(lines(d.schools));
  if (edu) out.push(normalizeProfileMark(edu));
  const item = (label, value) => {
    if (String(value ?? '').trim()) out.push(normalizeProfileMark(`${label}${PROFILE_SEP}${value.trim()}`));
  };
  item('職歴', d.career);
  item('党役職', [d.role, termText(d.term)].filter(Boolean).join(''));
  item('資格', d.license);
  item('趣味', d.hobby);
  item('家族', d.family);
  item('座右の銘', d.motto);
  lines(d.extra).forEach((l) => out.push(normalizeProfileMark(l)));
  return out.map(autoFix);
}

// 名前の一部にふりがなを付ける
function nameWithRuby(name, base, ruby) {
  const n = esc(name);
  if (!base || !ruby || !name.includes(base)) return n;
  return n.replace(esc(base), `<ruby>${esc(base)}<rt>${esc(ruby)}</rt></ruby>`);
}

export function render(d, { makeQr }) {
  const L = { ...DEFAULT_LABELS, ...(d.labels || {}) };
  const S = d.styles || {};
  // 要素の共通属性：data-el と、要素ごとの設定
  const el = (id) => ` data-el="${id}"${styleAttr(S[id])}`;
  const tokushu = L.tokushu || `${d.town || ''}特集`;

  // プレビューから編集するときの入力項目
  const ed = (key) => ` data-edit="${key}"`;
  const photo = (src, id, fit, key) => (src
    ? `<img class="${id}" src="${src}" alt="" data-fit="${fit}"${el(id)}${ed(key)}>`
    : `<div class="${id} photo-empty" data-fit="${fit}"${el(id)}${ed(key)}>写真</div>`);

  const policies = (d.policies || []).map((p, i) => `
    <div class="policy">
      <div class="policy-no"${el('policy-no')}>${i + 1}</div>
      <div class="policy-text">
        <div class="policy-title"${el('policy-title')}${ed(`policies.${i}.title`)}>${esc(autoFix(p.title || '')).replace(/\n/g, '<br>')}</div>
        <div class="policy-body${p.illust ? ' with-illust' : ''}"${el('policy-body')}${ed(`policies.${i}.body`)}>${esc(autoFix(p.body || ''))}</div>
      </div>
      ${p.illust ? `<img class="policy-illust" src="${p.illust}" alt=""${ed(`policies.${i}.illust`)}>` : ''}
    </div>`).join('');

  const qrs = QR_KINDS.filter((k) => (d.qr || {})[k.key]).map((k) => `
    <div class="qr"><div class="qr-code">${makeQr(d.qr[k.key])}</div><span class="qr-icon">${esc(k.icon)}</span></div>`).join('');

  return `
  <div class="trim">
    <section class="page page-left">
      <div class="bubble"${el('bubble')}></div>
      <div class="tokushu tokushu-left"${el('tokushu-left')}${ed('labels.tokushu')}>${esc(tokushu)}</div>
      <div class="bubble-catch" data-fit="吹き出しのキャッチ"${el('bubble-catch')}${ed('bubble')}>${lines(d.bubble).map((l) => `<span>${esc(autoFix(l))}</span>`).join('')}</div>
      ${photo(d.photos?.full, 'photo-full', '全身写真', 'photos.full')}
      <div class="col-right">
        <div class="challenge-head"${el('challenge-head')}><span class="slash">＼</span><span class="accent"${ed('name')}>${esc(d.name)}</span><span${ed('labels.challengeSuffix')}>${esc(L.challengeSuffix)}</span><span class="slash">／</span></div>
        <div class="policies" data-fit="政策"${policies ? '' : ' data-empty'}>${policies}</div>
        <div class="profile-head"${el('profile-head')}><span><span${ed('name')}>${esc(d.name)}</span><span${ed('labels.profileSuffix')}>${esc(L.profileSuffix)}</span></span></div>
        <div class="profile" data-fit="プロフィール"${el('profile')}${ed('@プロフィール')}>${profileLines(d).map((l) => `<p>${esc(l)}</p>`).join('')}</div>
        <div class="qr-row"${el('qr-row')}${ed('@QRコード')}>${qrs}</div>
      </div>
    </section>
    <section class="page page-right">
      <div class="masthead"${el('masthead')}>
        <div class="issue-tag"${el('issue-tag')}${ed('@号・発行')}>${esc(d.season)} ${esc(L.issuePrefix)}${esc(d.vol)}</div>
        <div class="title-sub"${el('title-sub')}${ed('labels.titleSub')}>${esc(L.titleSub)}</div>
        <div class="title"${el('title')}><span class="t-komei"${ed('labels.titleA')}>${esc(L.titleA)}</span><span class="t-news"${ed('labels.titleB')}>${esc(L.titleB)}</span></div>
        <div class="publisher"${el('publisher')}${ed('labels.publisher')}>${esc(L.publisher)}　${esc(L.issuedPrefix)}${esc(d.issued)}</div>
      </div>
      <div class="cover-catch" data-fit="キャッチコピー"${el('cover-catch')}${ed('catch')}>${lines(d.catch).map((l) => `<p>${esc(autoFix(l))}</p>`).join('')}</div>
      <div class="circle"${el('circle')}></div>
      ${photo(d.photos?.face, 'photo-face', '顔写真', 'photos.face')}
      <div class="band" data-fit="縦の帯"${el('band')}${ed('band')}>${esc(autoFix(d.band || ''))}</div>
      <div class="tokushu tokushu-right"${el('tokushu-right')}${ed('labels.tokushu')}>${esc(tokushu)}</div>
      <div class="cover-name" data-fit="表紙の名前"${el('cover-name')}>
        <span class="cn-name"${ed('name')}>${nameWithRuby(d.name || '', d.rubyBase, d.ruby)}<span class="cn-no"${ed('labels.coverNo')}>${esc(L.coverNo)}</span></span>
        <span class="cn-challenge"${ed('labels.coverChallenge')}>${esc(L.coverChallenge)}</span>
      </div>
      ${d.photos?.logo
    ? `<img class="logo-slot logo-img" src="${d.photos.logo}" alt=""${el('logo')}${ed('photos.logo')}>`
    : `<div class="logo-slot"${el('logo')}${ed('photos.logo')}>公明党ロゴ</div>`}
    </section>
  </div>`;
}

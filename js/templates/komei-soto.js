// 公明ニュース 外面（A4横・二つ折り）。左＝プロフィール面、右＝表紙。
// 位置はすべて仕上がり線からのmm。塗り足し3mmは .sheet 側で付ける。
import {
  autoFix, birthLine, educationText, termText, normalizeProfileMark, PROFILE_SEP,
} from '../rules.js';

export const SIZE = { width: 297, height: 210, bleed: 3 };

export const PUBLISHER = '公明党徳島県本部ニュース　［発行元］公明党徳島県本部 〒770-0856 徳島市中洲町3丁目5-1 共正ビル1F';

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
  full: { label: 'プロフィール面の全身写真', w: 49, h: 122 },
};

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const lines = (s) => String(s ?? '').split('\n').map((l) => l.trim()).filter(Boolean);

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

function photo(src, cls, fit) {
  if (!src) return `<div class="${cls} photo-empty" data-fit="${fit}">写真</div>`;
  return `<img class="${cls}" src="${src}" alt="" data-fit="${fit}">`;
}

function qrBlock(kind, url, makeQr) {
  if (!url) return '';
  return `<div class="qr"><div class="qr-code">${makeQr(url)}</div><span class="qr-icon">${esc(kind.icon)}</span></div>`;
}

export function render(d, { makeQr }) {
  const policies = (d.policies || []).slice(0, 3).map((p, i) => `
    <div class="policy" data-fit="政策${i + 1}">
      <div class="policy-no">${i + 1}</div>
      <div class="policy-title">${esc(autoFix(p.title || '')).replace(/\n/g, '<br>')}</div>
      <div class="policy-body${p.illust ? ' with-illust' : ''}">${esc(autoFix(p.body || ''))}</div>
      ${p.illust ? `<img class="policy-illust" src="${p.illust}" alt="">` : ''}
    </div>`).join('');

  const qrs = QR_KINDS.map((k) => qrBlock(k, (d.qr || {})[k.key], makeQr)).join('');

  return `
  <div class="trim">
    <section class="page page-left">
      <div class="bubble">
        <div class="tokushu tokushu-left">${esc(d.town)}特集</div>
        <div class="bubble-catch" data-fit="吹き出しのキャッチ">${lines(d.bubble).map((l) => `<span>${esc(autoFix(l))}</span>`).join('')}</div>
      </div>
      ${photo(d.photos?.full, 'photo-full', '全身写真')}
      <div class="col-right">
        <div class="challenge-head"><span class="slash">＼</span><span class="accent">${esc(d.name)}</span>のチャレンジ<span class="slash">／</span></div>
        ${policies}
        <div class="profile-head"><span>${esc(d.name)}プロフィール</span></div>
        <div class="profile" data-fit="プロフィール">${profileLines(d).map((l) => `<p>${esc(l)}</p>`).join('')}</div>
        <div class="qr-row">${qrs}</div>
      </div>
    </section>
    <section class="page page-right">
      <div class="masthead">
        <div class="issue-tag">${esc(d.season)} vol.${esc(d.vol)}</div>
        <div class="title-sub">TOKUSHIMA</div>
        <div class="title"><span class="t-komei">公明</span><span class="t-news">ニュース</span></div>
        <div class="publisher">${esc(PUBLISHER)}　［発行］${esc(d.issued)}</div>
      </div>
      <div class="cover-catch" data-fit="キャッチコピー">${lines(d.catch).map((l) => `<p>${esc(autoFix(l))}</p>`).join('')}</div>
      <div class="circle"></div>
      ${photo(d.photos?.face, 'photo-face', '顔写真')}
      <div class="band" data-fit="縦の帯">${esc(autoFix(d.band || ''))}</div>
      <div class="tokushu tokushu-right">${esc(d.town)}特集</div>
      <div class="cover-name" data-fit="表紙の名前">
        <span class="cn-name">${nameWithRuby(d.name || '', d.rubyBase, d.ruby)}<span class="cn-no">の</span></span>
        <span class="cn-challenge">チャレンジ</span>
      </div>
      <div class="logo-slot">公明党ロゴ</div>
    </section>
  </div>`;
}

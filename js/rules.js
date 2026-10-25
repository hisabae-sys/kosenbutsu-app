// 表記統一ルール。公明ニュース・後援会通信で決めたルールをまとめている。
// ブラウザとテスト（Node）の両方から読み込む。

export const PROFILE_MARK = '○'; // U+25CB。「〇」(U+3007) は使わない
export const PROFILE_SEP = ' / ';
export const DEFAULT_AGE_BASE_DATE = '2027-04-01'; // 年齢は統一選の時点で数える

const KANJI_DIGITS = /[0-9０-９]/;

// 半角の「!」「?」を全角にする
export function toFullWidthMarks(text) {
  return text.replace(/!/g, '！').replace(/\?/g, '？');
}

// 数字と「年・月・日・歳・期・人」などの単位の間のスペースを取る
export function removeDigitUnitSpaces(text) {
  return text
    .replace(/([0-9０-９])[ 　]+(?=[年月日歳期人回号])/g, '$1')
    .replace(/(?<=[年月日])[ 　]+(?=[0-9０-９])/g, '');
}

// 行頭の「〇」や「・」を「○」にそろえる
export function normalizeProfileMark(line) {
  const body = line.replace(/^[ 　]*[○〇◯・●]?[ 　]*/, '');
  return body ? PROFILE_MARK + body : '';
}

export function ageAt(birth, baseDate = DEFAULT_AGE_BASE_DATE) {
  const [by, bm, bd] = birth.split('-').map(Number);
  const [y, m, d] = baseDate.split('-').map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}

// ○1985年1月8日生まれ〈42歳〉、徳島市出身
export function birthLine(birth, hometown, baseDate = DEFAULT_AGE_BASE_DATE) {
  if (!birth) return '';
  const [y, m, d] = birth.split('-').map(Number);
  let line = `${PROFILE_MARK}${y}年${m}月${d}日生まれ〈${ageAt(birth, baseDate)}歳〉`;
  if (hometown) line += `、${hometown.trim()}出身`;
  return line;
}

const DROP_PREFIX = /^(国立|県立|町立|村立)/;
const NEEDS_GRADUATION = /(高校|大学|大学院|短期大学|専門学校|高等専門学校)$/;

// 学歴1校分を「～小学校」「～高校卒」「～大学卒」の形にする
export function normalizeSchool(name) {
  let s = name.trim().replace(DROP_PREFIX, '');
  s = s.replace(/高等学校/g, '高校');
  s = s.replace(/卒業$/, '卒');
  if (NEEDS_GRADUATION.test(s)) s += '卒';
  return s;
}

export function educationText(lines) {
  return lines.map(normalizeSchool).filter(Boolean).join('、');
}

export function termText(n) {
  const num = String(n ?? '').trim();
  return num ? `（現在${num}期目）` : '';
}

// 本文全体にかける自動修正
export function autoFix(text) {
  return removeDigitUnitSpaces(toFullWidthMarks(text));
}

// 自動では直さず、注意だけ出すもの
export function warnings(fieldLabel, text) {
  const out = [];
  if (/[ 　](?=[0-9０-９])|(?<=[0-9０-９])[ 　]/.test(text)) {
    out.push(`${fieldLabel}：数字の前後にスペースがあります。意図したものか確認してください`);
  }
  if (/^市立/.test(text.trim())) {
    out.push(`${fieldLabel}：「市立」が付いています。正式名の一部でなければ外してください`);
  }
  return out;
}

export function urlWarnings(label, url) {
  const out = [];
  const u = (url || '').trim();
  if (!u) return out;
  if (!/^https:\/\//.test(u)) out.push(`${label}のURL：https:// から始まるURLにしてください`);
  if (/facebook\.com\/profile\.php/.test(u)) {
    out.push(`${label}のURL：番号だけのFacebookアドレスです。ユーザー名のURLがあればそちらが確実です`);
  }
  if (/[ 　]/.test(u)) out.push(`${label}のURL：スペースが入っています`);
  return out;
}

export { KANJI_DIGITS };

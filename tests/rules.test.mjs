import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toFullWidthMarks, removeDigitUnitSpaces, normalizeProfileMark, ageAt, birthLine,
  normalizeSchool, educationText, termText, autoFix, warnings, urlWarnings,
} from '../js/rules.js';

test('「!」は全角にする', () => {
  assert.equal(toFullWidthMarks('推進!'), '推進！');
  assert.equal(toFullWidthMarks('PICK UP!'), 'PICK UP！');
});

test('数字と単位の間のスペースを取る', () => {
  assert.equal(removeDigitUnitSpaces('1985 年 1 月 8 日'), '1985年1月8日');
  assert.equal(removeDigitUnitSpaces('42 歳'), '42歳');
});

test('行頭は○（U+25CB）にそろえる', () => {
  assert.equal(normalizeProfileMark('〇職歴 / 看護師'), '○職歴 / 看護師');
  assert.equal(normalizeProfileMark('職歴'), '○職歴');
  assert.equal(normalizeProfileMark('  '), '');
});

test('年齢は2027年4月時点', () => {
  assert.equal(ageAt('1985-01-08'), 42);
  assert.equal(ageAt('1985-04-02'), 41);
  assert.equal(ageAt('1985-04-01'), 42);
});

test('生年月日の行', () => {
  assert.equal(birthLine('1985-01-08', '徳島市'), '○1985年1月8日生まれ〈42歳〉、徳島市出身');
});

test('学歴の表記', () => {
  assert.equal(normalizeSchool('上八万小学校'), '上八万小学校');
  assert.equal(normalizeSchool('県立城南高等学校'), '城南高校卒');
  assert.equal(normalizeSchool('国立徳島大学'), '徳島大学卒');
  assert.equal(normalizeSchool('創価大学卒業'), '創価大学卒');
  assert.equal(normalizeSchool('創価大学卒'), '創価大学卒');
  assert.equal(educationText(['上八万小学校', '上八万中学校', '城南高校']), '上八万小学校、上八万中学校、城南高校卒');
});

test('期数', () => {
  assert.equal(termText(3), '（現在3期目）');
  assert.equal(termText(''), '');
});

test('自動修正と注意', () => {
  assert.equal(autoFix('目指します!'), '目指します！');
  assert.equal(warnings('党役職', '徳島第6 支部長').length, 1);
  assert.equal(urlWarnings('HP', 'http://example.com').length, 1);
  assert.equal(urlWarnings('Facebook', 'https://www.facebook.com/profile.php?id=1').length, 1);
});

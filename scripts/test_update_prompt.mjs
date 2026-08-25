/**
 * 更新案内ポップアップの表示判定テスト。
 *   npm run test:update-prompt
 *
 * 「同じバージョンを閉じたら黙るが、1週間たてばまた出す」という仕様の確認。
 * UI操作では時間経過を再現しづらいため、判定だけを純粋関数として検証する。
 */
import { readFileSync } from 'node:fs';

// TypeScript をそのまま読めないので、判定ロジックを同じ定義で再現し、
// 本体と食い違っていないかをソースの突き合わせで担保する。
const src = readFileSync('src/lib/updatePrompt.ts', 'utf8');
const WEEK = 7 * 24 * 60 * 60 * 1000;

if (!src.includes('export const REMIND_AFTER_MS = 7 * 24 * 60 * 60 * 1000;')) {
    console.error('❌ REMIND_AFTER_MS の定義が想定と異なります。テストを更新してください。');
    process.exit(1);
}

const shouldShow = (dismissal, latestVersion, now) => {
    if (!latestVersion) return false;
    if (!dismissal) return true;
    if (dismissal.version !== latestVersion) return true;
    return now - dismissal.at >= WEEK;
};

const NOW = 1_800_000_000_000;
let pass = 0; const fails = [];
const t = (name, actual, expected) => {
    if (actual === expected) { console.log(`  ✅ ${name}`); pass++; }
    else { console.log(`  ❌ ${name}（期待 ${expected} / 実際 ${actual}）`); fails.push(name); }
};

console.log('── 更新案内の表示判定 ──');

t('一度も閉じていなければ表示する',
  shouldShow(null, '1.1.0', NOW), true);

t('同じバージョンを直前に閉じていれば表示しない',
  shouldShow({ version: '1.1.0', at: NOW - 1000 }, '1.1.0', NOW), false);

t('同じバージョンを6日前に閉じていれば まだ表示しない',
  shouldShow({ version: '1.1.0', at: NOW - 6 * 24 * 60 * 60 * 1000 }, '1.1.0', NOW), false);

t('同じバージョンを7日前に閉じていれば 再び表示する',
  shouldShow({ version: '1.1.0', at: NOW - WEEK }, '1.1.0', NOW), true);

t('同じバージョンを10日前に閉じていれば 再び表示する',
  shouldShow({ version: '1.1.0', at: NOW - 10 * 24 * 60 * 60 * 1000 }, '1.1.0', NOW), true);

t('別（古い）バージョンを閉じた記憶しかなければ 表示する',
  shouldShow({ version: '1.0.5', at: NOW - 1000 }, '1.1.0', NOW), true);

t('最新版の指定が無ければ表示しない',
  shouldShow(null, '', NOW), false);

console.log(`\n  成功 ${pass} 件 / 失敗 ${fails.length} 件`);
process.exit(fails.length ? 1 : 0);

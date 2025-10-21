# maku_note_search.js 改善提案

対象: `static/js/maku_note_search.js`

- 更新日: 2025-10-21
- 目的: 検索機能コードの安全性・正確性・パフォーマンス・保守性を向上する。

## 状況
- IMEイベント二重登録: 対応済み（masterへマージ済み）
  - コミット: 46a31be0ce
  - 内容: `searchWithHash` 内で `compositionstart/end` を一度だけ登録するようガード変数 `imeListenersRegistered` を導入。

---

## 重要度: 高（セキュリティ）
- XSS対策（必須）
  - ユーザー入力のクエリや `entry.title` / `entry.body` をそのまま `innerHTML` に流し込んでいます。HTMLエスケープした上でハイライトを適用してください。
  - 例: `escapeHtml` と `highlight` を導入し、`<mark>` で強調。

```js
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const escapeHtml = (s) => s
  .replace(/[&<>"'`=\/]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;', '/': '&#47;', '=': '&#61;'
  }[c]));
const highlight = (text, q) =>
  text.replace(new RegExp(escapeRegExp(q), 'giu'), m => `<mark>${escapeHtml(m)}</mark>`);
```

- 新規タブ遷移の安全性
  - `<a target="_blank">` には `rel="noopener noreferrer"` を付与。

## 正確性/バグの芽
- 最新エントリ取得の非破壊ソート + 安定比較
```js
const getLatestEntry = () => {
  const [latest] = [...allEntries].sort((a, b) => new Date(b.date) - new Date(a.date));
  return latest;
};
```

- 正規表現の安全化
  - 入力をそのまま `new RegExp(q, 'i')` に渡すとメタ文字が暴発します。`escapeRegExp` を通し、`'iu'` を付与（Unicode対応）。
```js
const regexpList = queries.map(q => new RegExp(escapeRegExp(q), 'iu'));
```

- ハイライト処理の一貫化
  - タイトル/本文/日付で同一ロジック（大小無視・複数出現）を適用。`highlight(text, q)` を共通利用。

- IMEイベント重複登録（対応済み）
  - `searchWithHash` が複数回呼ばれても一度だけ登録するガードを維持。

- URLハッシュ復元の関数
  - `decodeURI` ではなく `decodeURIComponent` を使用。
```js
const hashStr = decodeURIComponent(location.hash.slice(1));
```

## パフォーマンス
- 重複計算の削減
  - `searchData` 内で `formatDateString(entry.date)` をクエリごとに計算しています。エントリごとに一度だけ算出し再利用。

- DOM構築の最適化（必要に応じて）
  - 文字列連結ではなく `DocumentFragment` + `append` で構築し、`result` へ `replaceChildren`。描画回数を最小化。

## UX/使い勝手
- クエリ分割の改善
  - 連続スペース/タブ/全角スペース対応:
```js
const splitInput = (input) => input.trim().split(/[\s\u3000]+/).filter(Boolean);
```
  - フレーズ検索対応（ダブルクォートで括る）:
```js
const splitInput = (input) => (input.trim().match(/\"[^\"]+\"|\S+/g) || []).map(s => s.replace(/^\"|\"$/g, ''));
```

- 未変更クエリの早期リターン
  - `isNewQueries` を活用し、同一クエリなら検索・再描画を省略。

- テンプレートリテラルへ統一
  - 文字列連結 `+` と混在している箇所を `` `...${v}...` `` に統一。

## コード整理
- 未使用関数の削除
  - `createTitle` / `createDate` など未使用ヘルパーを削除。

- 変数宣言の統一
  - `var` を `const`/`let` に置換（再代入不要なら `const`）。

- デバッグログの整理
  - `console.log/dir` は開発時のみ出力（フラグや `NODE_ENV` で制御）。

## 簡易テスト観点
- XSS: タイトル/本文に `<script>`/`<img onerror>` 相当の文字列を含むデータで、DOMに挿入しても実行されないこと。
- 検索精度: 大文字小文字混在・全角スペース・複数キーワード・フレーズ検索が期待通りにヒットすること。
- ハイライト: 複数箇所・重複一致・日付/タイトル/本文の全てで正しく `<mark>` が入ること。
- IME: 連続 `hashchange` 後も `compositionstart/end` が一度だけ登録されていること（DevTools の `getEventListeners` で件数確認）。

---

## 実装メモ
- 検索ロジック/ハイライト/DOM更新の3層を分離すると保守性が上がります。
- 将来的に件数が増える場合、`allEntries` のインデックス化（タイトル・日付のプリミティブ配列を別保持）を検討してください。


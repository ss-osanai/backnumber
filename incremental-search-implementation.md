# rawセクション記事のJSON化とIncremental Search実装ドキュメント

## 目次

1. [システム概要](#システム概要)
2. [全体アーキテクチャ](#全体アーキテクチャ)
3. [コンポーネント詳細](#コンポーネント詳細)
4. [データフロー](#データフロー)
5. [実装詳細](#実装詳細)
6. [ファイル構成](#ファイル構成)
7. [使用方法](#使用方法)

---

## システム概要

このシステムは、Hugoで構築された静的サイトにおいて、rawセクションの記事をJSON化し、クライアントサイドでリアルタイムのインクリメンタル検索を実現します。

### 主な特徴

- **完全静的**: サーバーサイド処理不要
- **リアルタイム検索**: キー入力と同時に検索結果を表示
- **複数キーワード対応**: スペース区切りでAND検索可能
- **URL連動**: 検索クエリがURLハッシュに反映され、共有可能
- **年別分割**: 2003年～2025年まで年別にJSONファイルを分割して効率化

### 技術スタック

- **Hugo**: 静的サイトジェネレーター（テンプレートエンジン）
- **JavaScript**: クライアントサイド検索ロジック
- **正規表現**: 検索マッチング処理

---

## 全体アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                      Hugo ビルドプロセス                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────┐
│ Content Layer   │───▶│ Template Layer   │───▶│ Output Layer│
│                 │    │                  │    │             │
│ content/raw/    │    │ layouts/search/  │    │ docs/search/│
│ content/search/ │    │                  │    │             │
└─────────────────┘    └──────────────────┘    └─────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Client Side      │
                    │                  │
                    │ maku_search.js   │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Search UI        │
                    │ (incremental)    │
                    └──────────────────┘
```

---

## コンポーネント詳細

### 1. コンテンツ層 (Content Layer)

#### 1.1 記事データ: `content/raw/YYYY/`

各年ごとのディレクトリに記事のMarkdownファイルを配置します。

**ディレクトリ構造:**
```
content/raw/
├── 2003/
│   ├── _index.md
│   ├── 030825_0645.md
│   ├── 030916_0645.md
│   └── ...
├── 2004/
├── ...
└── 2025/
```

**記事ファイルの形式:**
```markdown
---
title: "記事のタイトル"
date: 2003-08-25T06:45:24+09:00
draft: false
---

記事の本文コンテンツ...
```

#### 1.2 JSON生成トリガー: `content/search/YYYY.md`

各年のJSONファイルを生成するためのトリガーファイルです。

**ファイル例: `content/search/2003.md`**
```markdown
---
url: "search/2003.js"
---
```

このファイルは、Hugoがビルド時に `search/2003.js` というURLで出力することを指定します。

---

### 2. テンプレート層 (Template Layer)

#### 2.1 JSON生成テンプレート: `layouts/search/single.html`

このテンプレートが、`content/search/YYYY.md` に対して適用され、JavaScript形式のJSONデータを生成します。

**主要なロジック:**

```go-template
{{/* エスケープ処理（改行を空白化、前後の空白削除、連続する空白を集約） */}}
{{- define "escape" }}
{{- trim (replace . "\n" " ") " " | replaceRE " +" " " | jsonify -}}
{{- end -}}

{{/* ファイル名から年を抽出 (例: 2007) */}}
{{- $year := .File.BaseFileName -}}

var {{ printf "entries_%s" $year }} = [
{{- range where .Site.RegularPages "Section" "raw" }}

{{- if (eq (substr .File.Dir 4 4) $year) }}
{
url: {{ .Permalink | jsonify }},
title: {{ .Title | jsonify }},
date: {{ .Date | jsonify }},
body: {{ template "escape" (printf "%s %s" .Title .Plain) }}
},
{{ end -}}

{{ end -}}
];
```

**処理内容:**

1. **年の抽出**: ファイル名（例: 2003.md）から年を取得
2. **記事のフィルタリング**: `content/raw/` セクションの記事のうち、該当年のもののみを抽出
3. **データ変換**: 各記事を以下の形式に変換:
   - `url`: 記事のパーマリンク
   - `title`: 記事のタイトル
   - `date`: 記事の日付
   - `body`: タイトル + 本文（改行や余分な空白を削除）
4. **JavaScript変数化**: `entries_2003` のような変数名で出力

**エスケープ処理:**
- 改行を空白に置換
- 前後の空白をトリム
- 連続する空白を1つに集約
- JSON形式にエスケープ

#### 2.2 検索UIテンプレート: `layouts/search/list.html`

検索ページのHTMLを生成します。

**主要な要素:**

```html
<!-- 検索入力欄 -->
<input id="query"
       onkeyup="location.replace('#' + this.value)"
       size="20"
       autocomplete="off"
       autofocus
       placeholder="検索ワード" />

<!-- 結果表示エリア -->
<div id="result"></div>

<!-- 各年のJSONファイルを読み込み -->
<script src="2003.js"></script>
<script src="2004.js"></script>
...
<script src="2025.js"></script>

<!-- 検索ロジック -->
<script src="../js/maku_search.js"></script>
```

---

### 3. 検索実装層 (Client Side)

#### 3.1 検索スクリプト: `static/js/maku_search.js`

クライアントサイドの検索ロジックを実装します。

**主要な機能:**

##### 3.1.1 データの統合

```javascript
let allEntries = [];

// 各年のJSONを結合
[
  entries_2003,
  entries_2004,
  // ...
  entries_2025,
].forEach(entries => {
  allEntries = allEntries.concat(entries);
});
```

##### 3.1.2 検索クエリの処理

```javascript
/**
 * 検索クエリをデリミタで分割した配列を返す
 */
function splitInput(input) {
  const queries = [];
  if (input.length < 1) {
    return queries;
  }
  const splittedInput = input.trim().split(' ');

  // 空文字列を除外
  for (let i = 0; i < splittedInput.length; i++) {
    if (splittedInput[i]) {
      queries.push(splittedInput[i]);
    }
  }
  return queries;
}
```

##### 3.1.3 検索実行

```javascript
function searchData(rawQuery) {
  const queries = splitInput(rawQuery);
  const regexpList = queries.map(q => new RegExp(q, 'i'));

  // 全てのqueryにマッチするエントリを抽出（AND検索）
  const matchedEntries = allEntries.filter(entry =>
    regexpList.every(re => {
      let dateString = formatDateString(entry.date);
      return re.test(entry.body) ||
             re.test(entry.title) ||
             re.test(dateString);
    })
  );

  // マッチ位置情報を付加
  const result = matchedEntries.map(entry => {
    const queries2 = [];

    for (let i = 0; i < queries.length; i++) {
      // body内のマッチ
      if (regexpList[i].test(entry.body)) {
        let pos = entry.body.search(regexpList[i]);
        let end = pos + queries[i].length;

        queries2.push({
          kind: "body",
          query: queries[i],
          posBegin: pos,
          posEnd: end
        });
      }

      // title内のマッチ
      if (regexpList[i].test(entry.title)) {
        let pos = entry.title.search(regexpList[i]);
        let end = pos + queries[i].length;

        queries2.push({
          kind: "title",
          query: queries[i],
          posBegin: pos,
          posEnd: end
        });
      }

      // date内のマッチ
      let dateString = formatDateString(entry.date);
      if (regexpList[i].test(dateString)) {
        let pos = dateString.search(regexpList[i]);
        let end = pos + queries[i].length;

        queries2.push({
          kind: "date",
          query: queries[i],
          posBegin: pos,
          posEnd: end
        });
      }
    }

    return {
      entry: entry,
      queries: queries2
    };
  });

  return result;
}
```

##### 3.1.4 結果表示

```javascript
function createEntry(url, title, date, body, queries) {
  const queriesBody = queries.filter(query => query.kind === 'body');
  const queriesTitle = queries.filter(query => query.kind === 'title');
  const queriesDate = queries.filter(query => query.kind === 'date');

  // タイトル内のマッチをハイライト
  function createTitle2(url, title, queries) {
    if (queries.length === 0) {
      return '<a class="item_title" href="' + url + '" target="_blank">' + title + '</a>';
    }
    const fragments = title.split(queries[0].query);
    const titleHtml = `${fragments[0]}<b>${queries[0].query}</b>${fragments[1]}`;
    return '<a class="item_title" href="' + url + '" target="_blank">' + titleHtml + '</a>';
  }

  // 抜粋部分を生成（マッチ箇所の前後を表示）
  function createExcerpt(body, queries) {
    const before = 50;
    const after = 100;

    return queries.map(q =>
      '<div class="item_excerpt">'
      + body.substring(q.posBegin - before, q.posBegin)
      + `<b>${q.query}</b>`
      + body.substring(q.posEnd, q.posEnd + after)
      + '</div>'
    ).join('');
  }

  return '<div class="item">'
    + createTitle2(url, title, queriesTitle)
    + createDate2(date, queriesDate)
    + createExcerpt(body, queriesBody)
    + '</div>';
}
```

##### 3.1.5 URLハッシュ連動

```javascript
function searchWithHash() {
  const hashStr = decodeURI(location.hash.substring(1));

  if (!hashStr) {
    clearResult();
    clearResultCount();
    return;
  }

  // 日本語入力中は検索を実行しない
  if (compositionFlag) {
    return;
  } else {
    search(hashStr);
    if (queryElem.value === '') {
      queryElem.value = hashStr;
    }
  }
}

// ページロード時に検索
window.addEventListener('DOMContentLoaded', searchWithHash);

// ハッシュ変更時に検索（デバウンス処理付き）
window.addEventListener('hashchange', () => {
  clearTimeout(hashChangeTimeout);
  hashChangeTimeout = setTimeout(searchWithHash, 500);
});
```

---

### 4. 出力層 (Output Layer)

#### 4.1 生成されるJSONファイル: `docs/search/YYYY.js`

Hugoのビルドプロセスにより、以下の形式のJavaScriptファイルが生成されます。

**例: `docs/search/2003.js`**

```javascript
var entries_2003 = [
{
url: "https://ss-osanai.github.io/backnumber/raw/2003/12/031231_1000/",
title: "【平成・進化論。】～年末最後にアマゾン１位になっちゃいました。。。",
date: "2003-12-31T10:00:00+09:00",
body: "【平成・進化論。】～年末最後にアマゾン１位になっちゃいました。。。 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ メルマガ●●「キャリアアップ！ 『スーパー派遣』のヒミツ。」●● ..."
},
// ... その他の記事
];
```

---

## データフロー

### ビルド時のデータフロー

```
1. Hugo ビルド開始
   ↓
2. content/search/2003.md を読み込み
   ↓
3. layouts/search/single.html テンプレート適用
   ↓
4. content/raw/2003/* の全記事を走査
   ↓
5. 各記事のメタデータと本文を抽出
   ↓
6. JSON形式に変換（エスケープ処理含む）
   ↓
7. JavaScript変数 entries_2003 として出力
   ↓
8. docs/search/2003.js に書き込み
   ↓
9. 全年分（2003-2025）について2-8を繰り返し
```

### 検索時のデータフロー

```
1. ユーザーがページにアクセス
   ↓
2. search/index.html がロード
   ↓
3. 2003.js ~ 2025.js が順次ロード
   ↓
4. entries_2003 ~ entries_2025 が定義される
   ↓
5. maku_search.js が実行
   ↓
6. 全エントリを allEntries に統合
   ↓
7. 最新エントリの情報を表示
   ↓
8. ユーザーが検索語を入力
   ↓
9. URLハッシュが更新
   ↓
10. hashchange イベント発火
   ↓
11. searchWithHash() が実行
   ↓
12. searchData() で検索実行
   ↓
13. マッチした記事とマッチ位置を抽出
   ↓
14. createHtml() で結果HTMLを生成
   ↓
15. DOM更新（結果表示）
```

---

## 実装詳細

### 1. JSON生成の仕組み

#### 1.1 Hugoテンプレート関数

- `.File.BaseFileName`: ファイル名（拡張子なし）を取得
- `.Site.RegularPages`: サイト内の全ページを取得
- `where ... "Section" "raw"`: rawセクションのページのみをフィルタ
- `.File.Dir`: ファイルのディレクトリパスを取得
- `substr .File.Dir 4 4`: ディレクトリパスから年を抽出（例: "raw/2003/" → "2003"）
- `.Permalink`: 記事の完全URL
- `.Title`: 記事のタイトル
- `.Date`: 記事の日付
- `.Plain`: 記事の本文（HTMLタグなし）

#### 1.2 エスケープ処理の詳細

```go-template
{{- define "escape" }}
{{- trim (replace . "\n" " ") " " | replaceRE " +" " " | jsonify -}}
{{- end -}}
```

**処理ステップ:**
1. `replace . "\n" " "`: 改行を半角スペースに置換
2. `trim ... " "`: 前後の空白を削除
3. `replaceRE " +" " "`: 連続する空白を1つに集約
4. `jsonify`: JSON形式にエスケープ（特殊文字の処理）

これにより、検索対象テキストが1行の文字列として適切にエスケープされます。

### 2. 検索アルゴリズムの詳細

#### 2.1 AND検索の実装

```javascript
const matchedEntries = allEntries.filter(entry =>
  regexpList.every(re => {
    let dateString = formatDateString(entry.date);
    return re.test(entry.body) ||
           re.test(entry.title) ||
           re.test(dateString);
  })
);
```

**ロジック:**
- `regexpList.every()`: すべての検索語が含まれている必要がある（AND条件）
- 各検索語は、`body`、`title`、`date` のいずれかにマッチすればOK（OR条件）

#### 2.2 大文字小文字の区別なし検索

```javascript
const regexpList = queries.map(q => new RegExp(q, 'i'));
```

正規表現の `i` フラグにより、大文字小文字を区別しない検索を実現。

#### 2.3 マッチ箇所のハイライト

検索結果では、マッチした箇所が `<b>` タグで囲まれ、CSSで背景色（ピンク）が適用されます。

```css
.item_excerpt b {
  background: pink;
}
```

### 3. パフォーマンス最適化

#### 3.1 年別分割

全記事を1つのファイルにすると数十MBになる可能性があるため、年別に分割:
- `2003.js`: 約1.9MB
- `2004.js`: 約7MB
- ...
- 合計: 約170MB

各ファイルは独立してロードされるため、初期ロードは高速です。

#### 3.2 デバウンス処理

```javascript
const timeout = 500;
let hashChangeTimeout;

window.addEventListener('hashchange', () => {
  clearTimeout(hashChangeTimeout);
  hashChangeTimeout = setTimeout(searchWithHash, timeout);
});
```

ハッシュ変更が頻繁に発生しても、500ms待ってから検索を実行することで、無駄な処理を削減。

#### 3.3 日本語入力対応

```javascript
let compositionFlag = false;

queryElem.addEventListener('compositionstart', () => {
  compositionFlag = true;
});
queryElem.addEventListener('compositionend', () => {
  compositionFlag = false;
});

if (compositionFlag) {
  return;  // 日本語入力中は検索しない
}
```

日本語入力中（変換中）は検索を実行せず、確定後に検索することで無駄な処理を回避。

---

## ファイル構成

```
backnumber/
├── config.toml                    # Hugo設定ファイル
├── content/
│   ├── raw/                       # 記事データ
│   │   ├── 2003/
│   │   │   ├── _index.md
│   │   │   ├── 030825_0645.md    # 個別記事
│   │   │   └── ...
│   │   ├── 2004/
│   │   └── ...
│   └── search/                    # JSON生成トリガー
│       ├── 2003.md                # url: "search/2003.js"
│       ├── 2004.md
│       └── ...
├── layouts/
│   ├── raw/
│   │   └── single.html            # 記事表示テンプレート
│   └── search/
│       ├── list.html              # 検索ページUI
│       └── single.html            # JSON生成テンプレート
├── static/
│   └── js/
│       └── maku_search.js         # 検索ロジック
└── docs/                          # ビルド出力（GitHub Pages用）
    └── search/
        ├── index.html             # 検索ページ
        ├── 2003.js                # 年別JSONデータ
        ├── 2004.js
        └── ...
```

### 各ファイルの役割

| ファイル | 役割 |
|---------|------|
| `content/raw/YYYY/*.md` | 記事の元データ（Markdown + Front Matter） |
| `content/search/YYYY.md` | JSON生成のトリガー（url指定のみ） |
| `layouts/search/single.html` | 記事をJSONに変換するHugoテンプレート |
| `layouts/search/list.html` | 検索ページのHTMLテンプレート |
| `static/js/maku_search.js` | クライアントサイド検索ロジック |
| `docs/search/YYYY.js` | 生成されたJSONデータ（JavaScript変数） |
| `docs/search/index.html` | 検索ページ（ビルド後） |

---

## 使用方法

### 1. 新しい記事の追加

```bash
# 記事ファイルを作成
hugo new raw/2025/250109_1234.md
```

記事のFront Matterを設定:
```yaml
---
title: "記事のタイトル"
date: 2025-01-09T12:34:56+09:00
draft: false
---

記事の本文...
```

### 2. ビルド

```bash
hugo
```

これにより:
1. `docs/raw/2025/01/250109_1234/index.html` が生成される
2. `docs/search/2025.js` が更新される（新しい記事が追加される）

### 3. 検索ページへのアクセス

```
https://example.com/search/
```

### 4. 検索クエリの共有

検索語がURLハッシュに反映されるため、以下のようなURLで共有可能:

```
https://example.com/search/#検索ワード
```

複数キーワードの場合:
```
https://example.com/search/#キーワード1 キーワード2
```

---

## カスタマイズ

### 1. 検索対象フィールドの変更

`layouts/search/single.html` でbodyの定義を変更:

```go-template
body: {{ template "escape" (printf "%s %s" .Title .Plain) }}
```

例えば、タイトルを検索対象から除外する場合:
```go-template
body: {{ template "escape" .Plain }}
```

### 2. 抜粋表示の長さ調整

`static/js/maku_search.js` の `createExcerpt` 関数:

```javascript
const before = 50;   // マッチ箇所の前の文字数
const after = 100;   // マッチ箇所の後の文字数
```

### 3. デバウンス時間の調整

```javascript
const timeout = 500;  // ミリ秒
```

短くすると反応が速くなりますが、処理負荷が増えます。

### 4. スタイルのカスタマイズ

`layouts/search/list.html` のCSSセクションを編集:

```css
.item_excerpt b {
  background: pink;  /* ハイライト色を変更 */
}
```

---

## トラブルシューティング

### 問題: 新しい記事が検索に表示されない

**原因:**
- Hugoビルドが実行されていない
- `draft: true` になっている

**解決策:**
```bash
hugo  # ビルドを実行
```

記事のFront Matterを確認:
```yaml
draft: false  # trueになっていないか確認
```

### 問題: 検索結果が表示されない

**原因:**
- JavaScriptエラー
- JSONファイルが読み込めていない

**解決策:**
ブラウザの開発者ツール（F12）でコンソールを確認:
```javascript
console.log(allEntries.length);  // エントリ数を確認
```

### 問題: 日本語検索がうまくいかない

**原因:**
- エンコーディングの問題
- デコード処理の不備

**解決策:**
`searchWithHash` 関数で `decodeURI` が正しく動作しているか確認。

---

## まとめ

このシステムは、以下の3つの層から構成されています:

1. **ビルド時処理（Hugo）**: Markdownファイルを読み込み、JSONに変換
2. **データ層（静的JSON）**: 年別に分割されたJavaScriptファイル
3. **検索UI（JavaScript）**: クライアントサイドでリアルタイム検索

完全に静的なため、サーバーサイド処理は不要で、CDNなどで高速に配信できます。また、URLハッシュを利用することで、検索結果の共有も可能です。

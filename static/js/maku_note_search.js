// キーワードのデリミタは半角スペースとする
const delim = ' ';

// 全てのエントリを入れる配列
let allEntries = [];

// 各セクションごとの JSON を結合する
[
  note_entries_2025,
].forEach(entries => {
  allEntries = allEntries.concat(entries);
  console.log(`allEntries length: ${allEntries.length}`);
});

/**
 * 検索クエリをデリミタで分割した配列を返す。
 * @param {String} input
 * @returns {Array}
 */
function splitInput(input) {
  const queries = [];

  if (input.length < 1) {
    return queries;
  }
  const splittedInput = input.trim().split(delim);

  // 空文字列を除外する
  for (let i = 0; i < splittedInput.length; i++) {
    if (splittedInput[i]) {
      queries.push(splittedInput[i]);
    }
  }
  return queries;
}

let oldInput = null;
// IME イベント（二重登録防止）
let imeListenersRegistered = false;

/**
 * 検索クエリが変更されているか
 * @param {Array} splittedInput
 * @returns {Boolean}
 */
function isNewQueries(splittedInput) {
  return (!oldInput || (splittedInput.join(delim) != oldInput.join(delim)));
}

/**
 * Hugo の日付文字列をパースして指定したフォーマットにする
 * @param {Date} date
 * @returns String
 */
function formatDateString(date) {
  const dt = new Date(date);
  const year = dt.getFullYear();
  const month = ('0' + (dt.getMonth() + 1)).slice(-2);
  const postDate = ('0' + dt.getDate()).slice(-2);
  const hour = ('0' + dt.getHours()).slice(-2);
  const minute = ('0' + dt.getMinutes()).slice(-2);

  return `${year}-${month}-${postDate} ${hour}:${minute}`;
}

/**
 * すべてのエントリーから date が最新のものを得る
 * @returns Object
 */
function getLatestEntry() {
  const sorted = allEntries.sort((a, b) => {
    return (a.date > b.date) ? -1 : 1;
  });
  return sorted[0];
}

/**
 * 最新エントリーの日付とタイトルを並べる
 * @returns String
 */
function createLatestHtml() {
  const entry = getLatestEntry();
  const date = formatDateString(entry.date);
  return `（最新： ${date} ${entry.title}）`;
}
document.querySelector("#latest").innerHTML = createLatestHtml();

/**
 * エントリの div タグを組み立てる
 * @param {String} url エントリの URL
 * @param {String} title エントリのタイトル
 * @param {String} body エントリの本文
 * @param {Array} queries 検索ワードの配列
 * @returns
 */
function createEntry(url, title, date, body, queries) {
  const queriesBody = queries.filter(query => query.kind === 'body');
  const queriesTitle = queries.filter(query => query.kind === 'title');
  const queriesDate = queries.filter(query => query.kind === 'date');

  console.log(queriesTitle);
  console.log(queriesDate);
  /**
   * タイトルの HTML を作成する
   * @param {String} url
   * @param {String} title
   * @returns {String}
   */
  function createTitle(url, title) {
    return '<a class="item_title" href="' + url + '" target="_blank">' + title + '</a>';
  }

  function createTitle2(url, title, queries) {
    if (queries.length === 0) {
      return '<a class="item_title" href="' + url + '" target="_blank">' + title + '</a>';
    }
    // 複数箇所がヒットした場合にどうしたらよいか？
    const fragments = title.split(queries[0].query);
    const titleHtml = `${fragments[0]}<b>${queries[0].query}</b>${fragments[1]}`;
    return '<a class="item_title" href="' + url + '" target="_blank">' + titleHtml + '</a>';
  }

  function createDate(date) {
    const dateString = formatDateString(date);
    return '<div class="item_date">' + dateString + '</div>';
  }

  function createDate2(date, queries) {
    const dateString = formatDateString(date);
    if (queries.length === 0) {
      return '<div class="item_date">' + dateString + '</div>';
    }
    // 複数箇所がヒットした場合にどうしたらよいか？
    const fragments = dateString.split(queries[0].query);
    return '<div class="item_date">' + fragments[0] + '<b>' + queries[0].query + '</b>' + fragments[1] + '</div>';
  }

  /**
   * 抜粋部分の HTML を作る
   * @param {String} body
   * @param {Array} queries
   * @returns
   */
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

/**
 *
 * @param {String} rawQuery
 * @returns {Array} - [{entry: entry, queries: [{query1, posBegin, posEnd}, {query2, posBegin, posEnd}...]}, ...]
 */
function searchData(rawQuery) {
  const queries = splitInput(rawQuery);

  if (isNewQueries(queries)) {
    oldInput = queries;
  }
  const regexpList = queries.map(q => new RegExp(q, 'i'));

  /* 全ての query にマッチするエントリの配列 */
  const matchedEntries = allEntries.filter(entry =>
    regexpList.every(re => re.test(entry.body))
  );

  /* 全ての query にマッチするエントリの配列 */
  const matchedEntries_ = allEntries.filter(entry =>
    regexpList.every(re => {
      let dateString = formatDateString(entry.date);
      return re.test(entry.body) || re.test(entry.title) || re.test(dateString);
    })
  );

  const result2 = matchedEntries_.map(entry => {
    const queries2 = [];

    for (let i = 0; i < queries.length; i++) {
      // body
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
      // title
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
      // date
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

  /*
    配列
    entry: entry
    queries: [{query, posBegin, posEnd}, ...]
  */
  const result = matchedEntries.map(entry => {
    const queries2 = [];

    for (let i = 0; i < queries.length; i++) {
      let pos = entry.body.search(regexpList[i]);
      let end = pos + queries[i].length;

      queries2.push({
        query: queries[i],
        posBegin: pos,
        posEnd: end
      });
    }

    return {
      entry: entry,
      queries: queries2
    };
  })
  console.dir(result)
  // return result;
  return result2;
}

/**
 *
 * @param {Array} result - [{entry: entry, queries: [{query1, posBegin, posEnd}, {query2, posBegin, posEnd}...]}, ...]
 * @returns
 */
function createHtml(result) {
  const htmls = result.map(x =>
    createEntry(x.entry.url, x.entry.title, x.entry.date, x.entry.body, x.queries)
  )
  return htmls.join('');
}

function showResult(html) {
  var el = document.getElementById('result');
  el.innerHTML = html;
}

function showResultCount(count, total) {
  var el = document.getElementById('resultCount');
  el.innerHTML = '<b>' + count + '</b> 件見つかりました（' + total + '件中）';
}

function search(query) {
  const result = searchData(query);
  const html = createHtml(result);
  showResult(html);
  showResultCount(result.length, allEntries.length);
}

function clearResult() {
  var el = document.getElementById('result');
  el.innerHTML = '';
}

function clearResultCount() {
  var el = document.getElementById('resultCount');
  el.innerHTML = '';
}

// 入力中フラグ
let compositionFlag = false;

/**
 * 検索のエントリポイント
 * @returns
 */
function searchWithHash() {
  const hashStr = decodeURI(location.hash.substring(1));
  console.log(`hashStr: ${hashStr}`);
  console.log(`compositionFlag: ${compositionFlag}`);

  // 空文字列の場合
  if (!hashStr) {
    clearResult();
    clearResultCount();
    return;
  }

  const queryElem = document.querySelector('input#query');
  // IMEイベントは一度だけ登録
  if (!imeListenersRegistered && queryElem) {
    queryElem.addEventListener('compositionstart', () => {
      compositionFlag = true;
    });
    queryElem.addEventListener('compositionend', () => {
      compositionFlag = false;
    });
    imeListenersRegistered = true;
  }

  if (compositionFlag) {
    return;
  } else {
    search(hashStr);
    if (queryElem.value === '') {
      queryElem.value = hashStr;
    }
  }
}

// ハッシュフラグメント付きの URL でページを開いたときに検索
window.addEventListener('DOMContentLoaded', searchWithHash);

const timeout = 500;
let hashChangeTimeout;

// ページ表示後にハッシュフラグメントが変化したら検索
window.addEventListener('hashchange', () => {
  clearTimeout(hashChangeTimeout);
  hashChangeTimeout = setTimeout(searchWithHash, timeout);
});

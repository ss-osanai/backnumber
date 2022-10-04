// キーワードのデリミタは半角スペースとする
const delim = ' ';

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

/**
 * 検索クエリが変更されているか
 * @param {Array} splittedInput 
 * @returns {Boolean}
 */
function isNewQueries(splittedInput) {
  return (!oldInput || (splittedInput.join(delim) != oldInput.join(delim)));
}

// 全てのエントリを入れる配列
let allEntries = [];
// 各セクションごとの JSON を結合する
[
  entries_2003,
  entries_2004,
  entries_2005,
  entries_2006,
  entries_2007,
  entries_2008,
  entries_2009,
  entries_2010,
  entries_2011,
  entries_2012,
  entries_2013,
  entries_2014,
  entries_2015,
  entries_2016,
  entries_2017,
  entries_2018,
  entries_2019,
  entries_2020,
  entries_2021,
  entries_2022,
].forEach(entries => {
  allEntries = allEntries.concat(entries);
  console.log(`allEntries length: ${allEntries.length}`);
});

/**
 * 
 * @param {String} rawQuery 
 * @returns {Array} - [{entry: entry, queries: [{query1, posBegin, posEnd}, {query2, posBegin, posEnd}...]}, ...]
 */
function searchData(rawQuery) {
  let result = [];
  const queries = splitInput(rawQuery);

  if (isNewQueries(queries)) {
    oldInput = queries;
  }
  const regexpList = queries.map(q => new RegExp(q, 'i'));

  /* 全ての query にマッチするエントリの配列 */
  const matchedEntries = allEntries.filter(entry =>
    regexpList.every(re => re.test(entry.body))
  );

  /*
    配列
    entry: entry
    queries: [{query, posBegin, posEnd}, ...]
  */
  result = matchedEntries.map(entry => {
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
  return result;
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
  return `<p>（最新： ${date} ${entry.title}）</p>`;
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
  /**
   * タイトルの HTML を作成する
   * @param {String} url 
   * @param {String} title 
   * @returns {String}
   */
  function createTitle(url, title) {
    return '<a class="item_title" href="' + url + '" target="_blank">' + title + '</a>';
  }

  function createDate(date) {
    const dateString = formatDateString(date);
    return '<div class="item_date">' + dateString + '</div>';
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

  return '<div class="item">' +
    createTitle(url, title) +
    createDate(date) +
    createExcerpt(body, queries) +
    '</div>';
}

/**
 * 
 * @param {Array} result - [{entry: entry, queries: [{query1, posBegin, posEnd}, {query2, posBegin, posEnd}...]}, ...]
 * @returns 
 */
function createHtml(result) {
  const htmls = result.map(x => createEntry(x.entry.url, x.entry.title, x.entry.date, x.entry.body, x.queries))
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
  queryElem.addEventListener('compositionstart', () => {
    compositionFlag = true;
  });
  queryElem.addEventListener('compositionend', () => {
    compositionFlag = false;
  });

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
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
  entries_2007,
  entries_2008,
  entries_2009,
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
  console.log(Object.keys({ entries })[0]);
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
 * 
 * @param {Array} result - [{entry: entry, queries: [{query1, posBegin, posEnd}, {query2, posBegin, posEnd}...]}, ...]
 * @returns 
 */
function createHtml(result) {
  const htmls = result.map(x => createEntry(x.entry.url, x.entry.title, x.entry.body, x.queries))
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

/**
 * タイトルの HTML を作成する
 * @param {String} url 
 * @param {String} title 
 * @returns {String}
 */
function createTitle(url, title) {
  return '<a class="item_title" href="' + url + '">' + title + '</a>';
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

/**
 * エントリの div タグを組み立てる
 * @param {String} url エントリの URL
 * @param {String} title エントリのタイトル
 * @param {String} body エントリの本文
 * @param {Array} queries 検索ワードの配列
 * @returns 
 */
function createEntry(url, title, body, queries) {
  return '<div class="item">' +
    createTitle(url, title) +
    createExcerpt(body, queries) +
    '</div>';
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
function search(query) {
  const result = searchData(query);
  const html = createHtml(result);
  showResult(html);
  showResultCount(result.length, data.length);
}

var oldInput = null;
const delim = ' ';
const interval = 500;

/**
 * 検索クエリを半角スペースで分割した配列を返す。
 * @param {String} input 
 * @returns {Array}
 */
function splitInput(input) {
  const queries = [];

  if (input.length < 1) {
    return queries;
  }
  const splittedInput = input.trim().split(delim);

  /* 空文字列を除外する */
  for (let i = 0; i < splittedInput.length; i++) {
    if (splittedInput[i]) {
      queries.push(splittedInput[i]);
    }
  }
  return queries;
}

/**
 * 
 * @param {Array} splittedInput 
 * @returns {Boolean}
 */
function isNewQueries(splittedInput) {
  return (!oldInput || (splittedInput.join(delim) != oldInput.join(delim)));
}

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
  console.log(`queries: ${queries}`);

  const regexpList = queries.map(q => new RegExp(q, 'i'));
  console.log(`regexpList: ${regexpList}`);

  /* 全ての query にマッチするエントリの配列 */
  const matchedEntries = data.filter(entry =>
    regexpList.every(re => re.test(entry.body))
  );
  console.log(`matchedEntries.length: ${matchedEntries.length}`);
  console.dir(matchedEntries);

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

function createEntry(url, title, body, queries) {
  return '<div class="item">' +
    createTitle(url, title) +
    createExcerpt(body, queries) +
    '</div>';
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

function clearResult() {
  var el = document.getElementById('result');
  el.innerHTML = '';
}

function clearResultCount() {
  var el = document.getElementById('resultCount');
  el.innerHTML = '';
}


// 入力中フラグ
var compositionFlag = false;

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

  function startSearch(hashStr) {
    if (compositionFlag) {
      return;
    } else {
      search(hashStr);

      if (queryElem.value == '') {
        queryElem.value = hashStr;
      }
    }
  }

  const queryElem = document.querySelector('input#query');

  queryElem.addEventListener('compositionstart', () => {
    compositionFlag = true;
  });

  queryElem.addEventListener('compositionend', () => {
    compositionFlag = false;
  });

  startSearch(hashStr);
}

// ハッシュフラグメント付きの URL でページを開いたときに検索
window.addEventListener('DOMContentLoaded', searchWithHash);

var hashChangeTimeout;
// ページ表示後にハッシュフラグメントが変化したら検索
window.addEventListener('hashchange', () => {
  clearTimeout(hashChangeTimeout);
  hashChangeTimeout = setTimeout(searchWithHash, 500);
});
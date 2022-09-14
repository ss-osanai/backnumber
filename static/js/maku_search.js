function search(query) {
  const result = searchData(query);
  const html = createHtml(result);
  showResult(html);
  showResultCount(result.length, data.length);
}

/**
 * 
 * @param {String} rawQuery 
 * @returns {Array} - [{entry: entry, queries: [{query1, posBegin, posEnd}, {query2, posBegin, posEnd}...]}, ...]
 */
function searchData(rawQuery) {
  const delim = ' ';
  let result = [];

  if (rawQuery.length < 1) {
    return [];
  }

  const splittedQuery = rawQuery.trim().split(delim);
  const queries = [];

  /* 空文字列を除外する */
  for (let i = 0; i < splittedQuery.length; i++) {
    if (splittedQuery[i]) {
      queries.push(splittedQuery[i]);
    }
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

function searchWithHash() {
  const hash = decodeURI(location.hash.substring(1));
  search(hash);

  const queryElem = document.getElementById('query');
  if (queryElem.value !== hash) {
    queryElem.value = hash;
  }
}

// ハッシュフラグメント付きの URL でページを開いたときに検索
window.addEventListener('DOMContentLoaded', searchWithHash);

// ページ表示後にハッシュフラグメントが変化したら検索
window.addEventListener('hashchange', searchWithHash);
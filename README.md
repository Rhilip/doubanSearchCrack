豆瓣搜索信息 Crack
----

Based on: 
 - https://github.com/dli98/Spider/tree/master/douban
 - https://github.com/SergioJune/Spider-Crack-JS/tree/master/douban

# 安装

`npm i douban-search-crack` or `yarn add douban-search-crack`

# 使用方法

```javascript
import axios from 'axios';
import { extractDataFromPage, decryptDoubanData } from 'douban-search-crack';

const { data: doubanSearchPage } = axios.get('https://search.douban.com/movie/subject_search', {
  params: {
    search_text: '肖申克的救赎',
    cat: 1002
  },
  responseType: 'text'
})

const encryptDoubanData = extractDataFromPage(doubanSearchPage)
console.log(decryptDoubanData(encryptDoubanData))
```

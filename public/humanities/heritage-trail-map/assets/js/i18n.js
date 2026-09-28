/* ==========================================================================
   介面文字（繁體中文）、地區／類別顏色、語音設定
   ========================================================================== */

window.T = {
  appTitle: '香港抗日戰爭遺址互動地圖',
  about: '關於',
  searchPh: '搜尋遺址、地名、人物…',
  byCategory: '按類別',
  byDistrict: '按地區',
  all: '全部',
  fitAll: '顯示全部遺址',
  toggleLabels: '顯示／隱藏名稱',
  resultCount: (n, t) => `顯示 ${n} / ${t} 處遺址`,
  noResult: '沒有符合條件的遺址',
  coords: '座標',
  openInMaps: '在 Google 地圖開啟',
  readSource: '博物館原文',
  prev: '上一處',
  next: '下一處',
  photoCredit: '圖片：香港海防博物館',
  creditLabel: '史料來源：',
  museumName: '香港海防博物館',
  readMore: '閱讀詳情 →',

  voiceLabel: '主語音開關',
  voiceOnHint: '語音導覽已開啟：點開遺址時會自動朗讀。',
  voiceUnsupported: '這個瀏覽器不支援語音朗讀。',
  voicePlay: '朗讀',
  voiceStop: '停止朗讀',

  listLabel: '清單與搜尋',
  districtAll: '全部地區',
  districtBarLabel: '按地區篩選',
  siteNoInDistrict: (d, n) => `${d} 第 ${n} 處`,

  landsdLogoAlt: '地政總署標誌',
  landsdMapNotice: '地圖由地政總署提供',

  aboutTitle: '關於本地圖',
  about_html: `
    <p>本地圖標示香港 52 處與抗日戰爭相關的歷史遺址，涵蓋<strong>廣東人民抗日游擊隊港九獨立大隊</strong>（港九大隊）各中隊的駐地、情報交通站、秘密大營救路線上的中轉站，以及戰後設立的紀念碑與紀念設施。</p>
    <p>1941 年 12 月 8 日日軍進攻香港，18 日後香港淪陷，開始三年八個月的日佔時期。廣東人民抗日游擊隊在同月派出武工隊進入新界，1942 年 2 月 3 日於西貢黃毛應村玫瑰小堂正式成立港九獨立大隊，是日佔時期香港境內唯一一支持續作戰的成建制武裝力量，並協助營救了大批文化界人士及盟軍人員。</p>
    <h3>使用方法</h3>
    <ul>
      <li>點擊地圖上的標記，即彈出該處的圖片與史料。</li>
      <li>頂部一排<strong>地區按鈕</strong>本身就是圖例：標記按地區上色，並在區內編號。按一下即只看該區，可多選。</li>
      <li>「<strong>主語音開關</strong>」開啟後，點開遺址會自動朗讀，並逐段高亮。</li>
      <li>「清單與搜尋」可開啟 52 處的完整清單、關鍵字搜尋，以及 7 個主題類別篩選。</li>
      <li>鍵盤：<kbd>←</kbd> <kbd>→</kbd> 瀏覽上／下一處，<kbd>Esc</kbd> 關閉面板。</li>
    </ul>
    <h3>資料來源</h3>
    <p>所有遺址名稱、座標、圖片及史料文字，均整理自香港特別行政區政府康樂及文化事務署<a href="https://hk.waranddefence.museum/tc/web/mcd/interactive-map.html" target="_blank" rel="noopener">香港海防博物館「香港中共抗戰遺址」互動地圖</a>。版權屬原作者所有，本頁僅作教育及非商業用途。</p>
    <h3>底圖</h3>
    <p>本地圖只用一個底圖：<strong>地政總署「香港地圖服務」</strong>的香港地圖，香港地名最詳盡。</p>
    <p>此服務的公眾版<strong>無須註冊、無須 API key</strong>，端點在 <code>mapapi.geodata.gov.hk</code>，說明見 <a href="https://portal.csdi.gov.hk/csdi-webpage/apilist" target="_blank" rel="noopener">CSDI 空間數據共享平台</a>。底圖提供第 10 至 20 級，而第 10 級已可看到全境，所以地圖的最小縮放級別設為 10。</p>
    <p>按其<a href="https://portal.csdi.gov.hk/csdi-webpage/apidoc/TopographicMapAPI" target="_blank" rel="noopener">使用條款</a>，地圖左下角已顯示地政總署標誌及「地圖由地政總署提供」版權聲明，並且不會在短時間內發出大量請求。</p>
    <h3>其他參考資料</h3>
    <ul>
      <li>香港政府中國人民抗日戰爭暨世界反法西斯戰爭勝利80周年網頁（2025）。〈香港中共抗戰遺址〉。<a href="https://www.80avictory.gov.hk/tc/site.html" target="_blank" rel="noopener">80avictory.gov.hk</a></li>
      <li>維基百科（2025）。〈潘屋〉。<a href="https://zh.wikipedia.org/zh-tw/%E6%BD%98%E5%B1%8B" target="_blank" rel="noopener">zh.wikipedia.org</a></li>
    </ul>
    <h3>製作</h3>
    <p>本網頁及資源由香港教育大學人工智能及數碼能力教育中心（AIDCEC）團隊設計，旨在支援小學人文學科的學習。<br>© AIDCEC EdUHK</p>
  `,

  cats: {
    base: '部隊駐地與活動',
    intel: '情報交通與電台',
    rescue: '營救行動',
    battle: '戰鬥與事件',
    org: '抗日機構與組織',
    person: '人物故居',
    memorial: '紀念設施',
  },

  dists: {
    north: '北區',
    tuenmun: '屯門',
    yuenlong: '元朗',
    taipo: '大埔',
    saikung: '西貢',
    shatin: '沙田',
    ssp: '深水埗',
    central: '中西區',
    islands: '離島',
  },
};

/* 類別顏色（詳情面板的標籤仍按類別上色） */
window.CATEGORY_STYLE = {
  base: { color: '#b3261e' },
  intel: { color: '#1b6ca8' },
  rescue: { color: '#0f7b6c' },
  battle: { color: '#8b2f00' },
  org: { color: '#6741a5' },
  person: { color: '#a8611b' },
  memorial: { color: '#8a6d1f' },
};

/* 地區顏色 — 地圖標記與頂部地區按鈕共用同一組顏色，
   這樣頂部那一排按鈕本身就是圖例。 */
window.DISTRICT_STYLE = {
  north:    { color: '#e01e2d' },
  tuenmun:  { color: '#7b2d8e' },
  yuenlong: { color: '#1b3a97' },
  taipo:    { color: '#0f7038' },
  saikung:  { color: '#4fb03a' },
  shatin:   { color: '#12bcdf' },
  ssp:      { color: '#5b7fb8' },
  central:  { color: '#e0530c' },
  islands:  { color: '#eda315' },
};

/* 地區次序（頂部按鈕與清單分組共用） */
window.DISTRICT_ORDER = [
  'north', 'tuenmun', 'yuenlong', 'taipo', 'saikung', 'shatin', 'ssp', 'central', 'islands',
];

/* 語音導覽偏好的語言代碼，依次嘗試 */
window.SPEECH_LANG = ['zh-HK', 'zh-TW', 'zh'];

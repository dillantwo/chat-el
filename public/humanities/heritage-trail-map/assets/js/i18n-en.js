/* ==========================================================================
   English interface text. Loaded by index-en.html after i18n.js, so it only
   replaces window.T and the voice-guide language; the category and district
   colours and the district order still come from i18n.js.

   Terms follow HKSAR Government English usage: Antiquities and Monuments
   Office (Hong Kong-Kowloon Brigade, Dongjiang Column, Japanese Occupation),
   the 80avictory.gov.hk website, and official district names.
   ========================================================================== */

window.T = {
  appTitle: 'Hong Kong War of Resistance Historic Sites Map',
  about: 'About',
  searchPh: 'Search sites, places, people…',
  byCategory: 'By category',
  byDistrict: 'By district',
  all: 'All',
  fitAll: 'Show all sites',
  toggleLabels: 'Show / hide names',
  resultCount: (n, t) => `Showing ${n} of ${t} sites`,
  noResult: 'No sites match your filters',
  coords: 'Coordinates',
  openInMaps: 'Open in Google Maps',
  readSource: 'Museum page',
  prev: 'Previous',
  next: 'Next',
  photoCredit: 'Photo: Hong Kong Museum of the War of Resistance and Coastal Defence',
  creditLabel: 'Source: ',
  museumName: 'Hong Kong Museum of the War of Resistance and Coastal Defence',
  museumUrl: 'https://hk.waranddefence.museum/en/web/mcd/interactive-map.html',
  readMore: 'Read more →',

  voiceLabel: 'Voice guide',
  voiceOnHint: 'Voice guide is on: sites are read aloud when you open them.',
  voiceUnsupported: 'This browser cannot read text aloud.',
  voicePlay: 'Read aloud',
  voiceStop: 'Stop reading',

  listLabel: 'List & search',
  districtAll: 'All districts',
  districtBarLabel: 'Filter by district',
  siteNoInDistrict: (d, n) => `${d} · No. ${n}`,

  landsdLogoAlt: 'Lands Department logo',
  landsdMapNotice: 'Map from Lands Department',

  // Place-name labels on the Lands Department basemap (tc / sc / en).
  tileLang: 'en',
  // Between a district name and its count in the list, and in the photo caption.
  listSep: ' · ',
  dataMissing: 'The site data (assets/data/sites-en.js) could not be loaded.',

  aboutTitle: 'About this map',
  about_html: `
    <p>This map shows 52 historic sites in Hong Kong related to the War of Resistance against Japanese Aggression. They include the bases of the detachments of the <strong>Hong Kong-Kowloon Independent Brigade of the Guangdong People's Anti-Japanese Guerrilla Force</strong> (the Hong Kong-Kowloon Brigade), intelligence and liaison stations, stops along the route of the Secret Rescue Operation, and memorials and memorial facilities set up after the war.</p>
    <p>The Japanese army attacked Hong Kong on 8 December 1941. Hong Kong fell 18 days later, and the three years and eight months of the Japanese Occupation began. In the same month, the Guangdong People's Anti-Japanese Guerrilla Force sent Armed Working Teams into the New Territories. On 3 February 1942, the Hong Kong-Kowloon Independent Brigade was formally founded at the Rosary Mission Centre in Wong Mo Ying Village, Sai Kung. It was the only organised armed force that kept fighting inside Hong Kong throughout the Japanese Occupation, and it helped rescue large numbers of cultural figures and Allied personnel.</p>
    <h3>How to use</h3>
    <ul>
      <li>Click a marker on the map to see a photo and the history of that site.</li>
      <li>The row of <strong>district buttons</strong> at the top is also the legend: markers are coloured by district and numbered within each district. Click a district to show only that district. You can choose more than one.</li>
      <li>When the <strong>Voice guide</strong> is on, a site is read aloud as soon as you open it, and each paragraph is highlighted as it is read.</li>
      <li>"List &amp; search" opens the full list of 52 sites, keyword search, and filters for 7 categories.</li>
      <li>Keyboard: <kbd>←</kbd> <kbd>→</kbd> go to the previous / next site, <kbd>Esc</kbd> closes a panel.</li>
    </ul>
    <h3>Sources</h3>
    <p>All site names, coordinates, photos and historical text come from the <a href="https://hk.waranddefence.museum/en/web/mcd/interactive-map.html" target="_blank" rel="noopener">Interactive Map of Historic Sites of the Communist Party of China in the War of Resistance in Hong Kong</a> by the Hong Kong Museum of the War of Resistance and Coastal Defence, Leisure and Cultural Services Department, HKSAR Government. The English text is based on the museum's English version and was checked against its Chinese version. Copyright belongs to the original authors. This page is for educational, non-commercial use only.</p>
    <h3>Basemap</h3>
    <p>This map uses one basemap: the Hong Kong map from the <strong>Lands Department's Map Service</strong>, which has the most detailed Hong Kong place names.</p>
    <p>The public version of this service needs <strong>no registration and no API key</strong>. Its endpoint is <code>mapapi.geodata.gov.hk</code>, and it is described on the <a href="https://portal.csdi.gov.hk/csdi-webpage/apilist" target="_blank" rel="noopener">CSDI Portal</a>. The basemap has zoom levels 10 to 20, and level 10 already shows the whole territory, so the map's minimum zoom is 10.</p>
    <p>As its <a href="https://portal.csdi.gov.hk/csdi-webpage/apidoc/TopographicMapAPI" target="_blank" rel="noopener">terms of use</a> require, the Lands Department logo and the notice "Map from Lands Department" are shown in the bottom-left corner of the map, and the map does not send large numbers of requests in a short time.</p>
    <h3>Other references</h3>
    <ul>
      <li>HKSAR Government website for the 80th Anniversary of the Victory of the Chinese People's War of Resistance Against Japanese Aggression and the World Anti-Fascist War (2025). <em>Historic Sites of the Communist Party of China in the War of Resistance in Hong Kong</em>. <a href="https://www.80avictory.gov.hk/en/site.html" target="_blank" rel="noopener">80avictory.gov.hk</a></li>
      <li>Wikipedia (2025). 潘屋 [Pun Uk] (in Chinese). <a href="https://zh.wikipedia.org/zh-tw/%E6%BD%98%E5%B1%8B" target="_blank" rel="noopener">zh.wikipedia.org</a></li>
    </ul>
    <h3>Credits</h3>
    <p>This website and its resources were designed by the team at the Artificial Intelligence and Digital Competency Education Centre (AIDCEC), The Education University of Hong Kong, to support learning in primary Humanities.<br>© AIDCEC EdUHK</p>
  `,

  cats: {
    base: 'Unit bases and activities',
    intel: 'Intelligence, liaison and radio',
    rescue: 'Rescue operations',
    battle: 'Battles and incidents',
    org: 'Anti-Japanese organisations',
    person: 'Former residences',
    memorial: 'Memorials',
  },

  // Official names of Hong Kong's 18 districts.
  dists: {
    north: 'North',
    tuenmun: 'Tuen Mun',
    yuenlong: 'Yuen Long',
    taipo: 'Tai Po',
    saikung: 'Sai Kung',
    shatin: 'Sha Tin',
    ssp: 'Sham Shui Po',
    central: 'Central and Western',
    islands: 'Islands',
  },
};

/* British English first (as taught in Hong Kong schools), then any English voice. */
window.SPEECH_LANG = ['en-GB', 'en-HK', 'en-US', 'en'];

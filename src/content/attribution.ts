// Data sources for S19 (handoff H-11; research compliance-market.md §3.1–3.4, L-a/L-b).
// EDRDG requires this on a separate About/Sources screen, not only a launch page, and no copyright claim over the data.
// Unverified: edrdg.org was blocked during research; the 2021 licence snapshot named CC BY-SA 3.0. Confirm the
// current licence page before release.
export interface DataSource {
  name: string
  holder: string
  license: string
  licenseUrl: string
  url: string
  note: string
}

export const DATA_SOURCES: DataSource[] = [
  {
    name: 'JMdict / EDICT',
    holder: 'Electronic Dictionary Research and Development Group (EDRDG)',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://www.edrdg.org/edrdg/licence.html',
    url: 'https://www.edrdg.org/jmdict/j_jmdict.html',
    note: '單字英文釋義與 JMdict/EDICT 高度重合，依 EDRDG 授權標示；本 App 不主張此資料的著作權。',
  },
  {
    name: 'JLPT 單字清單',
    holder: 'Jonathan Waller (tanos.co.uk)',
    license: 'CC BY',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    url: 'https://www.tanos.co.uk/jlpt/',
    note: '各級單字表來源。',
  },
  {
    name: 'elzup/jlpt-word-list',
    holder: 'Copyright (c) 2020 Jamie Sinclair, elzup',
    license: 'MIT',
    licenseUrl: 'https://github.com/elzup/jlpt-word-list/blob/master/LICENSE',
    url: 'https://github.com/elzup/jlpt-word-list',
    note: '單字資料整理來源。',
  },
  {
    name: 'jamsinclair/open-anki-jlpt-decks',
    holder: 'Jamie Sinclair',
    license: 'MIT',
    licenseUrl: 'https://github.com/jamsinclair/open-anki-jlpt-decks/blob/main/LICENSE',
    url: 'https://github.com/jamsinclair/open-anki-jlpt-decks',
    note: '單字資料整理來源。',
  },
  {
    name: 'chyyran/jlpt-anki-decks',
    holder: 'chyyran',
    license: 'WTFPL v3',
    licenseUrl: 'https://github.com/chyyran/jlpt-anki-decks/blob/master/LICENSE',
    url: 'https://github.com/chyyran/jlpt-anki-decks',
    note: '單字資料整理來源。',
  },
  {
    name: 'Sigmabond01/jlpt-grammar-api',
    holder: 'Sigmabond01',
    license: 'MIT',
    licenseUrl: 'https://github.com/Sigmabond01/jlpt-grammar-api/blob/main/LICENSE',
    url: 'https://github.com/Sigmabond01/jlpt-grammar-api',
    note: 'N5・N4 文法點清單（涵蓋範圍）；例句與繁中解析為本專案自行撰寫。',
  },
]

export const ATTRIBUTION_TEXT = [
  '單字英文釋義使用 Electronic Dictionary Research and Development Group（EDRDG）的 JMdict/EDICT 辭書資料，依 EDRDG 授權（CC BY-SA 4.0）標示；本 App 不主張這些資料的著作權。',
  '單字清單來自 Jonathan Waller（tanos.co.uk，CC BY），經 elzup/jlpt-word-list 等專案整理；繁體中文釋義為本專案自行翻譯。',
  'N5・N4 文法點清單參考 Sigmabond01/jlpt-grammar-api（MIT）；N5・N4 的例句、解析、讀解與聽力，以及 N3–N1 標示為原創的題目，為本專案自行撰寫的練習題。所有題目都不是 JLPT 官方試題。',
].join('\n\n')

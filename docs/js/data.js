// Indhold til Lær-skærmen og spillene.

// Grundtabellen (gojūon). null = tom plads i tabellen.
const ROMAJI = [
  ['a', 'i', 'u', 'e', 'o'],
  ['ka', 'ki', 'ku', 'ke', 'ko'],
  ['sa', 'shi', 'su', 'se', 'so'],
  ['ta', 'chi', 'tsu', 'te', 'to'],
  ['na', 'ni', 'nu', 'ne', 'no'],
  ['ha', 'hi', 'fu', 'he', 'ho'],
  ['ma', 'mi', 'mu', 'me', 'mo'],
  ['ya', null, 'yu', null, 'yo'],
  ['ra', 'ri', 'ru', 're', 'ro'],
  ['wa', null, null, null, 'wo'],
  ['n', null, null, null, null]
];
const HIRA = [
  'あいうえお', 'かきくけこ', 'さしすせそ', 'たちつてと', 'なにぬねの',
  'はひふへほ', 'まみむめも', 'や ゆ よ', 'らりるれろ', 'わ   を', 'ん    '
];
const KATA = [
  'アイウエオ', 'カキクケコ', 'サシスセソ', 'タチツテト', 'ナニヌネノ',
  'ハヒフヘホ', 'マミムメモ', 'ヤ ユ ヨ', 'ラリルレロ', 'ワ   ヲ', 'ン    '
];

function table(rows) {
  const out = [];
  rows.forEach((row, r) => {
    for (let c = 0; c < 5; c++) {
      const ch = row[c];
      const ro = ROMAJI[r][c];
      out.push(ch && ch !== ' ' && ro ? { ch, ro } : null);
    }
  });
  return out;
}

export const HIRAGANA = table(HIRA);
export const KATAKANA = table(KATA);

// Simple N5-kanji med læsninger og betydning på dansk og engelsk
export const KANJI = [
  { k: '一', on: 'イチ', kun: 'ひと(つ)', da: 'en, 1', en: 'one' },
  { k: '二', on: 'ニ', kun: 'ふた(つ)', da: 'to, 2', en: 'two' },
  { k: '三', on: 'サン', kun: 'みっ(つ)', da: 'tre, 3', en: 'three' },
  { k: '四', on: 'シ', kun: 'よん, よっ(つ)', da: 'fire, 4', en: 'four' },
  { k: '五', on: 'ゴ', kun: 'いつ(つ)', da: 'fem, 5', en: 'five' },
  { k: '六', on: 'ロク', kun: 'むっ(つ)', da: 'seks, 6', en: 'six' },
  { k: '七', on: 'シチ', kun: 'なな', da: 'syv, 7', en: 'seven' },
  { k: '八', on: 'ハチ', kun: 'やっ(つ)', da: 'otte, 8', en: 'eight' },
  { k: '九', on: 'キュウ, ク', kun: 'ここの(つ)', da: 'ni, 9', en: 'nine' },
  { k: '十', on: 'ジュウ', kun: 'とお', da: 'ti, 10', en: 'ten' },
  { k: '百', on: 'ヒャク', kun: '–', da: 'hundrede', en: 'hundred' },
  { k: '円', on: 'エン', kun: '–', da: 'yen, cirkel', en: 'yen, circle' },
  { k: '日', on: 'ニチ', kun: 'ひ', da: 'sol, dag', en: 'sun, day' },
  { k: '月', on: 'ゲツ', kun: 'つき', da: 'måne, måned', en: 'moon, month' },
  { k: '火', on: 'カ', kun: 'ひ', da: 'ild', en: 'fire' },
  { k: '水', on: 'スイ', kun: 'みず', da: 'vand', en: 'water' },
  { k: '木', on: 'モク', kun: 'き', da: 'træ', en: 'tree' },
  { k: '金', on: 'キン', kun: 'かね', da: 'guld, penge', en: 'gold, money' },
  { k: '土', on: 'ド', kun: 'つち', da: 'jord', en: 'earth, soil' },
  { k: '年', on: 'ネン', kun: 'とし', da: 'år', en: 'year' },
  { k: '人', on: 'ジン, ニン', kun: 'ひと', da: 'menneske', en: 'person' },
  { k: '子', on: 'シ', kun: 'こ', da: 'barn', en: 'child' },
  { k: '女', on: 'ジョ', kun: 'おんな', da: 'kvinde', en: 'woman' },
  { k: '男', on: 'ダン', kun: 'おとこ', da: 'mand', en: 'man' },
  { k: '口', on: 'コウ', kun: 'くち', da: 'mund', en: 'mouth' },
  { k: '目', on: 'モク', kun: 'め', da: 'øje', en: 'eye' },
  { k: '耳', on: 'ジ', kun: 'みみ', da: 'øre', en: 'ear' },
  { k: '手', on: 'シュ', kun: 'て', da: 'hånd', en: 'hand' },
  { k: '足', on: 'ソク', kun: 'あし', da: 'fod, ben', en: 'foot, leg' },
  { k: '山', on: 'サン', kun: 'やま', da: 'bjerg', en: 'mountain' },
  { k: '川', on: 'セン', kun: 'かわ', da: 'flod', en: 'river' },
  { k: '田', on: 'デン', kun: 'た', da: 'rismark', en: 'rice field' },
  { k: '大', on: 'ダイ', kun: 'おお(きい)', da: 'stor', en: 'big' },
  { k: '小', on: 'ショウ', kun: 'ちい(さい)', da: 'lille', en: 'small' },
  { k: '中', on: 'チュウ', kun: 'なか', da: 'midte, inde i', en: 'middle, inside' },
  { k: '上', on: 'ジョウ', kun: 'うえ', da: 'op, over', en: 'up, above' },
  { k: '下', on: 'カ, ゲ', kun: 'した', da: 'ned, under', en: 'down, below' },
  { k: '右', on: 'ウ', kun: 'みぎ', da: 'højre', en: 'right' },
  { k: '左', on: 'サ', kun: 'ひだり', da: 'venstre', en: 'left' },
  { k: '本', on: 'ホン', kun: 'もと', da: 'bog, oprindelse', en: 'book, origin' },
  { k: '学', on: 'ガク', kun: 'まな(ぶ)', da: 'studere, lære', en: 'study, learn' },
  { k: '生', on: 'セイ', kun: 'い(きる)', da: 'liv, født', en: 'life, birth' },
  { k: '先', on: 'セン', kun: 'さき', da: 'før, forude', en: 'ahead, previous' },
  { k: '猫', on: 'ビョウ', kun: 'ねこ', da: 'kat', en: 'cat' }
];

// Hvad hver partikel bruges til – vises i Partikel-jagt
export const PARTICLES = {
  'は': { ro: 'wa', da: 'emne – det sætningen handler om', en: 'topic – what the sentence is about' },
  'を': { ro: 'o', da: 'objekt – det handlingen sker på', en: 'object – what the action is done to' },
  'に': { ro: 'ni', da: 'mål, tidspunkt eller sted hvor noget er', en: 'goal, time, or where something is' },
  'が': { ro: 'ga', da: 'subjekt – hvem/hvad (også ved 好き, わかる, いる)', en: 'subject – who/what (also with 好き, わかる, いる)' },
  'の': { ro: 'no', da: 'ejefald – »min«, »din«, »…s«', en: 'possessive – "my", "your", "…\'s"' },
  'と': { ro: 'to', da: '»og« mellem navneord, eller »sammen med«', en: '"and" between nouns, or "together with"' },
  'で': { ro: 'de', da: 'sted hvor noget sker, eller middel (»med«)', en: 'where an action happens, or means ("by", "with")' },
  'か': { ro: 'ka', da: 'gør sætningen til et spørgsmål', en: 'turns the sentence into a question' },
  'も': { ro: 'mo', da: '»også«', en: '"also", "too"' },
  'から': { ro: 'kara', da: '»fra«', en: '"from"' }
};

export const PARTICLE_QS = [
  { pre: '私', post: '猫が好きです。', read: 'わたし＿ねこがすきです。', ans: 'は', da: 'Jeg kan godt lide katte.', en: 'I like cats.' },
  { pre: 'パン', post: '食べます。', read: 'パン＿たべます。', ans: 'を', da: 'Jeg spiser brød.', en: 'I eat bread.' },
  { pre: '学校', post: '行きます。', read: 'がっこう＿いきます。', ans: 'に', da: 'Jeg går i skole.', en: 'I go to school.' },
  { pre: '公園に猫', post: 'います。', read: 'こうえんにねこ＿います。', ans: 'が', da: 'Der er en kat i parken.', en: 'There is a cat in the park.' },
  { pre: 'これは私', post: '本です。', read: 'これはわたし＿ほんです。', ans: 'の', da: 'Det her er min bog.', en: 'This is my book.' },
  { pre: '友だち', post: '映画を見ます。', read: 'ともだち＿えいがをみます。', ans: 'と', da: 'Jeg ser film med en ven.', en: 'I watch a movie with a friend.' },
  { pre: '図書館', post: '勉強します。', read: 'としょかん＿べんきょうします。', ans: 'で', da: 'Jeg studerer på biblioteket.', en: 'I study at the library.' },
  { pre: '七時', post: '起きます。', read: 'しちじ＿おきます。', ans: 'に', da: 'Jeg står op klokken syv.', en: 'I get up at seven.' },
  { pre: 'これは何です', post: '。', read: 'これはなんです＿。', ans: 'か', da: 'Hvad er det her?', en: 'What is this?' },
  { pre: 'お茶', post: '飲みます。', read: 'おちゃ＿のみます。', ans: 'を', da: 'Jeg drikker te.', en: 'I drink tea.' },
  { pre: '田中さん', post: '先生です。', read: 'たなかさん＿せんせいです。', ans: 'は', da: 'Tanaka er lærer.', en: 'Tanaka is a teacher.' },
  { pre: 'バス', post: '行きます。', read: 'バス＿いきます。', ans: 'で', da: 'Jeg tager med bussen.', en: 'I go by bus.' },
  { pre: 'りんご', post: 'バナナを買います。', read: 'りんご＿バナナをかいます。', ans: 'と', da: 'Jeg køber æbler og bananer.', en: 'I buy apples and bananas.' },
  { pre: '日本語', post: 'わかります。', read: 'にほんご＿わかります。', ans: 'が', da: 'Jeg forstår japansk.', en: 'I understand Japanese.' },
  { pre: '犬', post: '好きです。', read: 'いぬ＿すきです。', ans: 'も', da: 'Jeg kan også lide hunde.', en: 'I like dogs too.' },
  { pre: '東京', post: '来ました。', read: 'とうきょう＿きました。', ans: 'から', da: 'Jeg kom fra Tokyo.', en: 'I came from Tokyo.' }
];

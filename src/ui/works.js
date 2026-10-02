// Selected works. Each entry carries what the Works scene shows: the stack
// (the technologies used), a few highlights, scope and year.
//
// HAND and FUNKY: summary and highlights come from the sites themselves
// (fetched 2026-10-01); FUNKY's Next.js is from its generator tag.
// For the five client sites, stack / year / role are PROVISIONAL: the sites were
// not inspectable from here, so the tags are what their footage shows or
// their hosting reveals. Confirm before launch (see REDESIGN_V19.md).
export const WORKS = [
  {
    name: 'TO PLACE',
    href: 'https://to-place.co.jp/',
    video: '/videos/toplace.mp4',
    year: 2025,
    role: 'Design, Development',
    summary: '住空間の写真を主役にした、住まいの企業のコーポレートサイト。',
    highlights: ['大きな写真で空間を伝えるレイアウト', 'スクロールに合わせた見出しの演出'],
    stack: ['HTML / CSS', 'JavaScript', 'GSAP'],
    verified: false,
  },
  {
    name: 'IWAKIKI',
    href: 'https://d2crmzpw5das9r.cloudfront.net/',
    video: '/videos/iwakiki.mp4',
    year: 2025,
    role: 'Design, Development',
    summary: '福島県いわき市の不動産会社サイト。「縁結び」を大胆な文字組みで。',
    highlights: ['画面いっぱいの文字と写真の重ね合わせ', '縦書きの案内タブ'],
    stack: ['HTML / CSS', 'JavaScript', 'AWS CloudFront'],
    verified: false,
  },
  {
    name: 'NEXT',
    href: 'https://next-inc.group/',
    video: '/videos/next.mp4',
    year: 2024,
    role: 'Design, Development',
    summary: '事業ポートフォリオを伝える、株式会社NEXTのコーポレートサイト。',
    highlights: ['夜景と光の粒で「実体経済」を表すビジュアル', '事業ごとの構成'],
    stack: ['HTML / CSS', 'JavaScript', 'Canvas'],
    verified: false,
  },
  {
    name: 'TRANS B',
    href: 'https://trans-b.vercel.app/',
    video: '/videos/trans.mp4',
    year: 2025,
    role: 'Design, 3D, Development',
    summary: '物流企業のサイト。夜の道路を走る3D演出とキネティックタイポ。',
    highlights: ['夜の道路を進むリアルタイム3D', 'スクロールで切り替わる事業紹介'],
    stack: ['Three.js', 'WebGL', 'GSAP', 'Vercel'],
    verified: false,
  },
  {
    name: 'LUZ REAL',
    href: 'https://luz-real.com/',
    video: '/videos/luzreal.mp4',
    year: 2024,
    role: 'Design, Development',
    summary: '都心4区の不動産会社サイト。音楽とともに物件の世界観を伝える。',
    highlights: ['音楽のオン・オフ切り替え', 'モノクロ写真と余白で見せる構成'],
    stack: ['HTML / CSS', 'JavaScript', 'Web Audio'],
    verified: false,
  },
  // JUNKBRANDING's own sites: the same studio, different approaches.
  {
    name: 'HAND',
    nameJa: 'JUNKBRANDING Hand Version',
    href: 'https://hand.junkbranding.com/',
    video: null,
    poster: '/videos/hand.jpg',
    record: '/videos/hand.mp4',
    year: 2026,
    role: 'Concept, Design, Development',
    summary: '「眺めるWebから、入り込むWebへ。」体験型のWeb制作を、そのまま体験として見せる自社サイト。手の動きでも操作できる。',
    highlights: [
      'カメラで手の動きを認識して操作する Hand Mode（映像はブラウザ内で処理し、外部へ送らない）',
      '入口で Hand Mode と Mouse Mode を選べる',
      '夜の海の音楽とともに進む構成',
    ],
    stack: ['Hand tracking', 'Camera API', 'Web Audio'],
    verified: false,
  },
  {
    name: 'FUNKY',
    nameJa: 'JUNKBRANDING Funky Version',
    href: 'https://funky.junkbranding.com/',
    video: '/videos/junk.mp4',
    year: 2025,
    role: 'Branding, Design, Development',
    summary: '散らばる文字と立体ロゴで「ジャンク」を表現した、もう一つの自社サイト。',
    highlights: [
      '音楽あり・なしを選んで始めるローディング',
      'キーボード操作・スクリーンリーダー・モーション削減への配慮',
      'llms.txt などAI検索を意識した設計',
    ],
    stack: ['Next.js', 'React', 'WebGL'],
    verified: false,
  },
];

export function displayHost(href) {
  const host = new URL(href).hostname.replace(/^www\./, '');
  return host.endsWith('cloudfront.net') ? 'Live preview' : host;
}

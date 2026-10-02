# JUNKBRANDING v25：作品の追加と、作品のショートカット

v24 からの変更点です。

## 作品

### 2件を追加
どちらも JUNKBRANDING 自身の、アプローチの違うサイトです。

**HAND（JUNKBRANDING Hand Version）**：https://hand.junkbranding.com/
- サイトのコピー「眺めるWebから、入り込むWebへ。」を軸に紹介しています。
- 見どころ：
  - カメラで手の動きを認識して操作する Hand Mode（映像はブラウザ内で処理し、外部へ送らない）
  - 入口で Hand Mode と Mouse Mode を選べる
  - 夜の海の音楽とともに進む構成
- 映像はまだないため、サイトの文言で組んだ静止画（`public/videos/hand.jpg`）を表示しています。

**FUNKY（JUNKBRANDING Funky Version）**：https://funky.junkbranding.com/
- 以前「JUNK」として掲載していたサイトです。録画済みの映像をそのまま使っています。
- 見どころ（サイトの内容から）：
  - 音楽あり・なしを選んで始めるローディング
  - キーボード操作・スクリーンリーダー・モーション削減への配慮
  - llms.txt などAI検索を意識した設計
- 技術：Next.js は、サイトの generator タグで確認できました。

### 名前の変更
- TO PLACE
- LUZ REAL
- TRANS B

### 並び順（8件）
KURASHI NAVI、TO PLACE、IWAKIKI、NEXT、TRANS B、LUZ REAL、HAND、FUNKY

- 構造化データ（作品一覧）、読み上げ用の全作品リスト、件数表示（01 / 08）は、作品データから自動で更新されます。
- 秋の場面には、8枚のパネルが花の周りに上下左右へ並びます。

## 作品のショートカット（右側）

- **デスクトップ：**
  - Works の場面の右側に、半透明のガラス風の縦の目次を置きました。
  - 全作品が番号と名前で並び、今見ている作品は季節の色の細い線と色で示します。
  - 押すと、その作品へ移動します。
- **スマホ：** 番号だけの横一列です。
- **離れた場所への移動：** 2つ以上離れた場所へ移るときは、途中のすべての作品を飛び回らないようにしました。
  - 画面を一瞬暗くし、移動先のひとつ手前に切り替えてから、最後の弧だけを移動します。
  - 上部のナビ（About / Services / Works / Contact）も同じ動きにしました。
- **キーボード：** 目次はすべてボタンなので、Tab で順に移動でき、Enter で選べます。

## 要確認

- **HAND：** 年（2026）、担当範囲、技術タグ（Hand tracking / Camera API / Web Audio）は、サイトの内容から推測した値です。
- **FUNKY：** 技術タグのうち WebGL は推測です。

正しい内容に、`src/ui/works.js` で直してください。

## 録画

HAND の映像は、次のコマンドで `/videos/hand.mp4` に書き出せます。

```
node scripts/record-works.mjs --only HAND
```

書き出したあと、`src/ui/works.js` の HAND の `video: null` を `'/videos/hand.mp4'` に変えてください。

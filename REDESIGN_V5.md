# JUNKBRANDING v5 リデザインノート

v4（旧アーキテクチャの磨き込み）に対して、v5 は世界観を保ったままデザインと WebGL を土台から作り直したバージョンです。

## コンセプト：Diving / Cosmos Medusa

**ひとつの生き物がコンセプトを担う。** 実写のコスモス写真を円盤に極座標で貼り、その円盤を球冠状に折りたたむことで、花がそのままクラゲの傘になります。茎は細い糸の束として描かれ、モーフに合わせて傘の縁から触手へ、中心から口腕へと裂けていきます。「クラゲ × 花」を別々に並べるのではなく、一体の生物として混ぜています。

**スクロール＝潜水。** ページを下るほど深く潜ります。深度は実在の海洋区分に合わせています。

| チャプター | 深度 | ゾーン |
| --- | --- | --- |
| Hero | 0 m | Sunlight zone（光が差す水面） |
| About | 200 m | Twilight zone |
| Works | 1,000 m | Midnight zone |
| J × B | 2,500 m | Midnight zone |
| Contact | 4,000 m | Abyssal zone（深海） |

右側の深度計は現在深度とゾーンを表示し、チャプターナビゲーションを兼ねます。

**書体で J × B を表現。** 見出しは必ず2書体のペアで組みます。J 側（Junk / Jolt / Joy）は Syne ExtraBold、B 側（Beautiful / Balance / Blend）は Instrument Serif イタリックです。和文は Zen Kaku Gothic New で、Chrome では `word-break: auto-phrase` により文節単位で改行します。

**配色。** abyss `#03050a`、paper `#edf2f3`、bloom `#ff5fa8`（コスモスの桃色）、lumen `#7ff3ff`（生物発光）。UI にグローやグラデーションは使わず、光は生き物と水だけが持つようにしています。

## 構成

- 900svh の固定シーンをやめ、通常スクロールのセマンティックな DOM ＋ Lenis に変更しました。About の文章は canvas 描画から実テキストになり、検索・読み上げ・選択が可能です。
- WebGL は固定 canvas ひとつ（旧版は最大5コンテキスト）。後処理は RenderPass → UnrealBloom → ワークス映像レンズ → 仕上げ（色収差・ビネット・グレイン）→ OutputPass、トーンマッピングは Neutral です。
- ブルームは深度に応じて強くなり、スクロール速度に応じて色収差と触手のなびきが増えます。ポインター付近の触手は押しのけられます。
- 秘密の地球はフォーム送信成功時に動的 import で読み込むため、初期バンドルに含まれません。
- 和文フォントの `@font-face`（約120分割）は別スタイルシートとして非同期で読み込み、初期描画をブロックしません（メイン CSS 17KB）。
- ローダーは実際の読み込み進捗を数え、最後に「With sound / In silence」を選ばせます。このクリックが音声再生に必要なユーザー操作を兼ねます。

## ファイル

| ファイル | 役割 |
| --- | --- |
| `src/gl/Stage.js` | レンダラー、後処理、チャプターごとの振付（`KEYS_WIDE` / `KEYS_NARROW`）、イントロの開花 |
| `src/gl/Medusa.js` | 写真の傘、触手（LineSegments）と発光ビーズ、中心の光 |
| `src/gl/Abyss.js` | 深度で変わる水・光の筋・コースティクス・マリンスノー |
| `src/gl/WorkLens.js` | カーソル追従の映像パネル（液状の出現、速度で滲む） |
| `src/ui/works.js` | 作品リスト。デスクトップはホバーでレンズ、タッチ端末は行内動画 |
| `src/ui/Gauge.js` / `Sound.js` / `Loader.js` | 深度計、サウンド、ローダー |
| `src/ContactForm.js` | フォーム（blur 時と送信時に検証、ハニーポットと送信間隔チェック） |

チャプターごとの生き物の位置・大きさ・発光量は `Stage.js` 冒頭のキーフレーム表だけで調整できます。

## 判断したこと

- **画像マッチ型の認証を削除。** `api/contact.js` はこの認証を一切検証しておらず、ボットは API に直接 POST できるため防御になっていませんでした。ハニーポットと送信タイミングのチェックは残しています。本当に対策するなら、サーバー側で検証する Cloudflare Turnstile などを推奨します。
- **作品動画を再編集。** 元動画には画面録画ツールの操作バーと上下の黒帯が映り込んでいたため、960×424 に切り抜き、24秒ループに再エンコードしました（合計 8.8MB → 4.1MB）。ポスター画像（`public/videos/*.jpg`）も追加しています。
- **「SECRET」枠を削除。** 中身のないプレースホルダーは審査で減点対象になりやすいため外しました。
- **未使用依存を削除。** `gsap` と `three-fluid-fx` を package.json から外し、`lenis`、`@fontsource/instrument-serif`、`@fontsource/zen-kaku-gothic-new` を追加して `pnpm-lock.yaml` を更新済みです。
- **旧モジュールを削除。** 旧 WebGL 一式（FlowerParticleExperience、SpiralVideoGallery、ContactFluidReveal、lib/ など）は git 履歴から復元できます。

## 仮で入れた値（公開前に差し替えてください）

ご指示により、確定情報がない項目は仮の値で埋めています。**事実と異なる可能性があるものは、公開前に必ず確認してください。**

### 作品の年・担当範囲・一言説明（`src/ui/works.js`）

| 作品 | 年 | 担当範囲 | 一言説明 |
| --- | --- | --- | --- |
| JUNK | 2025 | Branding, Design, Development | 自社スタジオサイト。散らばる文字と立体ロゴで「ジャンク」を表現。 |
| TOPLACE | 2025 | Design, Development | 住空間の写真を主役にした、住まいの企業のコーポレートサイト。 |
| IWAKIKI | 2025 | Design, Development | 福島県いわき市の不動産会社サイト。「縁結び」を大胆な文字組みで。 |
| NEXT | 2024 | Design, Development | 事業ポートフォリオを伝える、株式会社NEXTのコーポレートサイト。 |
| TRANS | 2025 | Design, 3D, Development | 物流企業のサイト。夜の道路を走る3D演出とキネティックタイポ。 |
| LUZREAL | 2024 | Design, Development | 都心4区の不動産会社サイト。音楽とともに物件の世界観を伝える。 |

- **年と担当範囲はすべて推測です。**
- 一言説明は、各サイトの録画に映っている内容（見出し、コピー、演出）から書いています。業種の読み違いがありえます。特に TOPLACE は住宅系かインテリア系か判別できていません。

### og:image の絶対 URL（`vite.config.js`）

- 仮のドメインとして `https://junkbranding.com` を設定しています（funky.junkbranding.com の親ドメインからの推測）。
- `og:image`、`twitter:image`、`og:url`、`canonical`、構造化データの `url` が、ビルド時にこの値から生成されます。
- **変更方法：** Vercel の Environment Variables に `SITE_URL=https://本番ドメイン` を設定すると、コードを変えずに上書きされます。

### 高解像度の作品動画（`scripts/record-works.mjs`）

この作業環境からは外部サイトにアクセスできないため、録り直しそのものは行えていません。代わりに、6サイトを自動で録画するスクリプトを用意しました。

- 1920×848（サイト内プレビューと同じ比率）で、カーソルや録画ツールの UI が映らない映像を撮れます。
- 撮影後は `public/videos/<名前>.mp4` とポスター画像を自動で上書きします。
- 録画→変換の流れは、テストページで動作確認済みです。

```bash
pnpm add -D playwright
pnpm exec playwright install chromium
node scripts/record-works.mjs              # 全6作品
node scripts/record-works.mjs --only TRANS # 1作品だけ
node scripts/record-works.mjs --headed     # WebGL が重いサイトで映像が撮れない場合
```

- ffmpeg が必要です（`brew install ffmpeg`）。
- 撮影後は各動画を目視で確認してください。Cookie バナーや音声ボタンなど、事前にクリックが必要なサイトは、スクリプト内の `BEFORE_RECORD` に操作を追加できます。
- 撮り直すまでは、v5 で切り抜いた現行の 960×424 動画がそのまま使われます。

## 検証状況

- 確認環境はヘッドレス Chromium（SwiftShader、約1fps）です。
- デスクトップ 1280×800 で全チャプター、花→クラゲのモーフ経過、ワークスのホバー、フッターの名前の解読を確認しました。
- モバイル 390×844 で横はみ出しがないこと（修正済み）とレイアウトを確認しました。
- 本番ビルドのプレビューで、コンソールエラーと 4xx がないことを確認しました。
- **実機での動きの滑らかさは未確認です。** 特に iOS Safari の描画負荷とスクロール感、動画の自動再生は実機で確認してください。重い場合は `Stage.js` の `getPixelRatio()` の上限を下げてください。
- **ワークスの動画再生は、ヘッドレス環境が H.264 に非対応のため未確認です。** 映像が準備できるまではポスター画像を表示する仕組みにしています。

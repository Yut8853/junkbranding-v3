# Flower → Particle Scroll

実写写真の一輪の花を、スクロールに同期して数万パーティクルへ変換・拡散するための Vite / Three.js / GLSL / GSAP ScrollTrigger 実装です。

表示本体と粒子色は `public/textures/cosmos-photo.png` の実写写真から生成します。簡易3Dモデルを実写風に見せているのではなく、写真の不透明ピクセルを直接サンプリングしてシェーダーへ渡しています。

## 起動

```bash
npm install
npm run dev
```

本番ビルド:

```bash
npm run build
npm run preview
```

## 実写の花へ差し替える

1. 背景を含まない花の 3D モデルを GLB で用意します。
2. `public/models/flower.glb` に配置します。
3. 花の茎が下、花が上になるよう **Y-up** を推奨します。
4. マテリアルは glTF の PBR マテリアルをそのまま利用できます。

GLB が存在しない場合は、コード内の簡易花モデルへ自動フォールバックします。

### 3Dアセット側の推奨条件

- 1輪のみ。背景・床・鉢は含めない。
- GLB / glTF 2.0。
- 目安 30k〜150k triangles 程度。Web用に最適化する。
- 4Kテクスチャを無条件で使わず、通常は 1K〜2K から検証する。
- 花・茎・葉の Mesh が分かれていても問題ありません。
- Draco / Meshopt / KTX2 を使う場合は、そのデコーダー設定を `GLTFLoader` に追加してください。

## 粒子数

端末性能を見て自動調整します。

- モバイル / 低スペック: 24,000
- 標準: 40,000
- 高スペック: 52,000

検証時はURLで上書きできます。

```text
?particles=80000
```

5,000〜100,000 の範囲に制限しています。

## 実装構成

```text
src/
├─ main.js
├─ FlowerParticleExperience.js
├─ lib/
│  ├─ createDemoFlower.js
│  ├─ model.js
│  └─ particleCloud.js
└─ shaders/
   ├─ particles.vert.glsl
   └─ particles.frag.glsl
```

### CPUの役割

- GLBロード
- MeshSurfaceSampler による初期パーティクル位置生成
- テクスチャ色の初期サンプリング
- ScrollTrigger の progress / scroll velocity 取得
- resize / visibility / cleanup

### GPUの役割

毎フレームの数万粒子移動は vertex shader で処理します。
JavaScript で 50,000 個の座標を毎フレーム書き換えません。

## スクロール設計

Canvasそのものを ScrollTrigger で pin せず、CSS の `position: sticky` を利用しています。
ScrollTrigger は長い `.flower-stage` の 0〜1 の progress を Shader uniform へ渡します。

これにより、CMSや既存サイトへの組み込み時に pin 用ラッパーが増えてレイアウト計算が崩れるリスクを抑えています。

## 色の引き継ぎ

粒子生成時に MeshSurfaceSampler から UV を取得し、読み取り可能な通常テクスチャであれば Canvas 経由でピクセル色を取得します。
テクスチャが CORS 制限・圧縮テクスチャ・特殊形式などで CPU 読み取りできない場合は material.color へフォールバックします。

本番で KTX2 などを使いつつ粒子色を完全一致させたい場合は、以下のどちらかを推奨します。

- DCC側で vertex color をベイクする
- 粒子側でも GPU texture sampling する専用設計へ変更する

## アクセシビリティ

`prefers-reduced-motion: reduce` の場合、長いスクロール演出を解除し、花の静止表示にします。
Canvasは装飾として `aria-hidden="true"` にしています。

## 本番投入前に確認すること

- Chrome / Safari / Firefox / iOS Safari / Android Chrome 実機
- 360px〜大型ディスプレイ
- DPR 1 / 2 / 3
- 低電力モード
- スクロールを激しく往復した場合
- タブをバックグラウンド→復帰した場合
- GLBロード失敗時
- reduced motion
- Lighthouse / Performance panel で長時間のGPU負荷

## 実写感をさらに上げる場合

現在の花本体は PBR マテリアルを維持したまま、根元を支点としてごく小さく揺らしています。
花びら単位の柔らかい変形まで必要なら、次の段階として以下を追加します。

1. Blender側で茎・花びらに Bone を設定
2. glTF animation / SkinnedMesh として出力
3. 風揺れ用 AnimationMixer または独自 Bone 制御
4. 粒子化開始時に Bone 変形後の頂点位置を粒子初期位置へ反映

この方法が、実写寄りの植物表現では最も破綻しにくい構成です。

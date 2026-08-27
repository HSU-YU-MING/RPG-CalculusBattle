# 駱是能重來 — 開發指南

純前端劇情 RPG（HTML + CSS + 原生 JS，無建置步驟、無相依套件）。玩法、特色、劇情
擴充格式見 [README.md](README.md)——README 是使用者／玩家文件，這份是開發慣例。

## 上線位置與部署（最容易搞錯的一件事）

**線上網址是 https://play.cornhsu.com/luo-again/**，不是 GitHub Pages。

部署**不從 GitHub 走**，而是由容器腳本從**本機這個資料夾**複製過去組裝：

```powershell
cd D:\網站\_deploy\play
.\deploy.ps1              # 組裝並上線
.\deploy.ps1 -BuildOnly   # 只組裝到 build\，不上線
```

流程是 **本機開發 → 部署上線 → 推 GitHub 備份**。上線的永遠是本機這份，
GitHub（`HSU-YU-MING/RPG-CalculusBattle`）是備份不是來源。所以：

- **commit 了但沒跑 `deploy.ps1` = 線上沒變**；反過來也成立。
- 腳本每次會警告「有未提交的改動 / 有未推上 GitHub 的提交」，警告但不中止。
- 容器細節看 `D:\網站\_deploy\play\README.md`。

### 部署時會被濾掉的檔案

`deploy.ps1` 複製完會刪掉產物裡的 `*.md`、`.gitattributes`、`.gitignore`——
否則 `發表講稿.md` 之類的東西會變成 `play.cornhsu.com/luo-again/發表講稿.md` 公開可讀。
**這份 CLAUDE.md 也在 `*.md` 之列，不會上線。** 新增任何「給人看不給網站看」的檔案時，
若不是 `.md`，記得先確認它會不會被一起上傳。

### 路徑一律用相對路徑

作品掛在 `/luo-again/` **子路徑**底下。任何 `/image/x.webp` 這種根路徑寫法在本機開
`index.html` 看起來沒事，上線後會全部 404。目前全站都是相對路徑，別破壞它。

### `gh-pages` 分支不是程式碼

遠端的 `gh-pages` 只有一頁轉址（舊的 `hsu-yu-ming.github.io/RPG-CalculusBattle`
→ `play.cornhsu.com/luo-again`）。**不要把 `main` 合併過去、也不要拿它當備份。**

## 圖片一律轉 WebP

2026-08-12 把 19 張場景圖從 PNG 換成 WebP（品質 90），**53.1 MB 減為 4.4 MB**——
最大的兩張各約 7 MB，玩家用手機開場要等很久。原圖都是 RGBA 但沒有一張真的用到透明，
轉檔時一併去掉多餘的 alpha 通道，尺寸不變。

**之後新增任何場景圖都要照做**：轉成 WebP、品質 90、沒用到透明就不留 alpha。
這個站沒有建置步驟，沒有任何工具會幫你壓縮——手動轉好再放進 `image/`。

那次轉檔漏留了 4 個沒有任何程式碼引用的舊圖（`打電動耍廢到天亮.png` 等，共約 3.95 MB），
`deploy.ps1` 是整個資料夾複製，等於每次部署都白推一次；**已於 2026-08-27 刪除**。
現在 `image/` 是 19 個 `.webp`、共 4.5 MB，與 `js/story.js` 的引用一一對應。
再加圖時順手確認一下這個對應還成立——多出來的檔案不會有人提醒你。

## 資料格式的地雷

`js/story.js` 是純資料（`STORY` / `ITEMS` / `QUESTION_BANK`），`js/game.js` 是引擎。
`index.html` 先載 `story.js` 再載 `game.js`，**順序不能反**——game.js 是 IIFE，
直接引用 story.js 定義的那幾個全域常數。

- **`img:` 寫的是純檔名，不含資料夾。** game.js 的 `IMG_BASE = "image/"` 會自己補上，
  再過 `encodeURI()`（因為檔名是中文）。寫成 `img: "image/封面.webp"` 會變成
  `image/image/封面.webp`。
- **`bg:` 是 CSS class 後綴，不是圖片。** 只有 `campus` / `class` / `library` / `dorm` /
  `night` / `exam` 六個在 `css/style.css` 有定義（`.bg-campus` 等），是圖沒載到時的
  漸層底色。打錯字不會報錯，只是那層底色靜靜失效。
- **改場景 id 會弄壞玩家的存檔。** 存檔（localStorage `xuefen_save_v1`）存的是
  `sceneId` 字串，`renderScene()` 找不到場景只會 `console.error` 然後 return——
  玩家看到的是**一片空白、沒有任何錯誤提示、也回不了大廳**。要改動既有 id 或刪場景，
  請一起把 `SAVE_KEY` 的版本號往上加（`_v2`），讓舊存檔直接失效重來，比留下白畫面好。
- 考試出題（`pickExamQuestions`）會打亂選項後用 `opts.indexOf(correctText)` 重算答案
  索引。**同一題的四個選項文字不能重複**，否則答案會指到第一個同名選項。
- 破關（`renderEnd`）會 `removeItem(SAVE_KEY)`，這是刻意的——結算完就清檔。

## 開工慣例

- **沒有測試、沒有 lint、沒有 CI。** 唯一的靜態檢查是 `node --check js/story.js`
  （只驗語法，不驗資料正確性）。任何改動都要真的用瀏覽器把遊戲跑一輪。
- 改劇情資料後至少驗：三章各走一次分支、考試抽題正常、存檔→關掉→繼續遊戲能接上。
- 本機直接開 `index.html` 就能玩（沒有 fetch，不需要起伺服器）。
- 收尾：改到玩法或劇情規則 → 同步 README 的「玩法」與「特色」表。

# 開源協作地圖｜第 J 組社會網絡分析

**誰在開源專案裡連接程式碼與社群？** 依 [SNA Studio 課程案例](https://sna-studio-course-tw.cs-lee.chatgpt.site/cases#sna-github)，我們比較十個 Hugging Face 專案的跨庫橋接者、審查互動位置和網絡穩健性。

我們用 2025 年 1 月的公開 GitHub 事件建立帳號與儲存庫的參與網絡，以及審查者與 PR 作者的互動網絡。

**[開啟互動報告網站](https://linyurou8821.github.io/sna-j-gharchive/)** · **[閱讀完整白話導讀](https://linyurou8821.github.io/sna-j-gharchive/guide.html)** · **[研究結論](https://linyurou8821.github.io/sna-j-gharchive/#conclusion)**

這個版本延續[第 J 組原始專案](https://github.com/xxoon0987/sna-j-gharchive)。

網站為公開的 GitHub Pages 靜態網站。觀看者不需要登入 ChatGPT，也不需要開啟製作者的電腦。網站使用固定研究資料，不會即時追蹤 GitHub 使用者。

## 從哪裡開始讀？

| 你想了解什麼 | 閱讀位置 |
| --- | --- |
| 要上台報告，想確認四人分工和投影操作 | [20 分鐘投影流程與答問](presentation/REPORT_GUIDE.md) |
| 完全沒有背景，想先知道報告在做什麼 | [01｜先看懂這個報告](guide/01-overview.md) |
| Issue、PR、Review 是什麼？原始資料長什麼樣？ | [02｜資料來源、欄位與清理](guide/02-data.md) |
| 二模網絡、橋接榜、Constraint 和節點移除怎麼算？ | [03｜從事件到網絡與數學](guide/03-methods.md) |
| 結果代表什麼？有哪些不能推論的地方？ | [04｜結果與限制](guide/04-results.md) |
| 想準備老師可能問的問題 | [05｜常見疑問](guide/05-questions.md) |
| 想重新計算、更新網站或檢查參數 | [06｜重現與發布步驟](guide/06-reproduce.md) |

每份說明先用白話解釋，再列出定義、算式或來源。A、B、C 帳號例子是教學用的虛構例子；研究數值來自本專案的分析輸出。

## 用一分鐘理解

把十個開源專案想成十個工作小組。有人提出問題，有人回覆，有人送出修改提案，也有人審查修改。GitHub 會留下其中一些公開活動的紀錄。

本組經 ClickHouse 鏡像擷取 GH Archive 2025 年 1 月 UTC 的五種事件。清理時排除缺少觸發帳號、名稱以 `[bot]` 結尾及 `HuggingFaceDocBuilderDev` 的事件。原始資料分四段取得，沒有擷取留言內容。

1. **RQ1：不同事件關係中的橋接者是否相同？**
2. **RQ2：不同中心度與結構洞指標是否會辨識出不同的關鍵帳號？**
3. **RQ3：移除橋接節點後，網絡連通性是否比隨機移除下降得更明顯？**

流程是：**公開事件 → 查詢需要的範圍 → 排除可辨識自動化帳號 → 整理帳號與專案的關係 → 計算指標 → 用網站解釋結果。**

## 最重要的數字

| 數字 | 正確意思 |
| --- | --- |
| 13,555 | 鏡像查詢回傳的所選事件列數；不是整個 GH Archive 的大小 |
| 813 | 被排除的可辨識自動化帳號事件列數；不是 813 個帳號 |
| 12,742 | 清理後保留的事件列數；不保證每筆都由真人操作 |
| 1,379 | 保留事件中出現的不同帳號名稱數；不是事件數 |
| 93 | 上述帳號中，參與至少兩個選定專案的帳號數 |
| 59 | 93 個帳號中，同時有「Issue／留言」及「PR／Review」兩類活動的帳號數 |

**1,379 個帳號 → 其中 93 個跨專案 → 其中 59 個又跨兩類活動。**

其中 1,286 個帳號只參與一個選定專案；93 個跨專案帳號中的另外 34 個沒有同時滿足兩類活動條件。「參與」一律指選定期間內有符合條件的公開事件。

## 三項研究發現

| 問題 | 結果 |
| --- | --- |
| RQ1 | 三層都取滿 10 位，三層共同入榜 **0 位**。Issue／PR **1／19＝0.053**；Issue／Review **1／19＝0.053**；PR／Review **4／16＝0.250**。各層獨有帳號依序為 8、5、5 位。 |
| RQ2 | 審查互動圖有 **375 個帳號、618 條無向邊**。Degree 首名是 **ArthurZucker**，Betweenness 首名是 **aymeric-roucher**。Degree 與 Betweenness 前十名交集 8 位，Degree 與低 Constraint 交集 8 位，Betweenness 與低 Constraint 交集 9 位。 |
| RQ3 | 移除 1、3、5、10 位時，兩種固定排名移除與 500 次隨機試驗均保持 **1 個分量、最大分量與可達配對比例均為 100%**。兩種定向榜單的前十名共有 7 位。移除 10 位時，中介／Degree 優先各少 41／44 條邊，隨機平均少 24.66 條（20–33），但沒有觀察到網絡分裂。 |

### 網絡如何定義

- **RQ1：帳號—儲存庫二模參與圖。** 保留十庫及該層至少參與兩庫的帳號。Issue 用 `IssuesEvent`，PR 用 `PullRequestEvent`，Review 用 `PullRequestReviewEvent` 加 `PullRequestReviewCommentEvent`；一般討論留言獨立。至少一筆指定事件即連一條無向無權重邊。Degree 是相鄰庫數，除以十即為 Degree 中心度。Betweenness 衡量在最短路徑上的中介程度；用標準化分數排序，只選正分前十名，同分依帳號名稱。
- **RQ2：帳號互動圖。** 僅由 `PullRequestReviewEvent` 的觸發者和該筆事件的 PR 作者建立「審查者 → PR 作者」，排除作者缺漏、自我指向及可辨識的自動化帳號。三項指標均使用同一張無向、無權重的簡化圖。Burt’s Constraint 用 `networkx.constraint(weight=None)` 衡量連結集中及冗餘；無有效鄰居則記缺值。直接套在二模圖會退化為 `1 / Degree`，所以二模層不列獨立的 Constraint。
- **RQ3：全部事件的二模核心。** 93 個跨庫帳號、10 庫、229 邊。固定原圖排名，只移除帳號及相鄰邊，保留全部儲存庫。以種子 `202501` 做 500 次不放回隨機實驗，呈現平均與最小–最大。最大分量比例的分母為剩餘節點，配對可達比例的分母為剩餘節點的全部無序配對，另以固定 45 對衡量庫與庫的可達性。

共同參與不代表直接互動。現有鏡像欄位不足以一致重建三類人際互動；公開事件也不涵蓋線下溝通或完整工作投入。中心度與 Constraint 不能評估能力，節點移除模擬不能預測專案是否會停止運作。

### 補充成果

- Issue 與 PR 的帳號交集是 125、聯集是 801，所以 Jaccard 是 `125 / 801 ≈ 0.156`。這表示聯集中約 15.6% 的帳號兩種活動都有，不是「15.6% 的 Issue 被做成 PR」。
- PR 與 Review 的 Jaccard 是 0.291，Issue 與 Review 是 0.107。三組中，PR 與 Review 的帳號集合比較接近，但仍不是完全同一批。
- 四種中心度使用同一張跨專案核心網絡：93 個帳號、10 個儲存庫、229 條二元連線。不同指標量測不同位置，所以排序可能不同。

詳見[結果與限制](guide/04-results.md)。這些結果描述固定研究範圍，不能直接推論個人的能力、因果影響或整個 GitHub。

## 與老師要求的對照

| 報告要求 | 本專案的內容與證據 |
| --- | --- |
| 資料來源 | GH Archive 公開事件，透過 ClickHouse 公開鏡像取得；保留 [SQL](analysis/events.sql) 與 [取得程式](analysis/fetch_events.py) |
| 資料內容 | [9 個欄位、5 種原始事件、4 個展示分類](guide/02-data.md)，以及時間與專案邊界 |
| 基本數學運算 | [0／1 矩陣、加總、集合交聯集、Jaccard、每日平均](guide/03-methods.md) |
| 課文的類似部分 | W02「女性 × 社交活動」對照「帳號 × 儲存庫」；W06 四種中心度 |
| 如何比較橋接位置 | 事件層的中介前十名與審查圖的 Degree、Betweenness、Constraint，見[橋接與審查分數](docs/repro/bridge-scores.csv)；補充的四項中心度見[二模核心分數](docs/repro/centrality-scores.csv) |
| 可檢查的結論 | [分析程式](analysis/analyze.py)、[網站資料](docs/data.json)、[資料版本紀錄](data/provenance.json)、[重現說明](guide/06-reproduce.md) |

## 本地重現

在此版本的專案根目錄，以 Python 3.10 以上執行：

```bash
python -m pip install -r requirements.txt
python analysis/fetch_events.py
python analysis/analyze.py
python analysis/build_guide.py
python -m unittest discover -s analysis -v
python -m http.server 4173 --directory docs
```

瀏覽 `http://127.0.0.1:4173/`，在「互動網絡」切換事件層或展開有向審查關係，在「研究發現」依序查看三項分析。可下載[三層與審查互動的帳號分數](docs/repro/bridge-scores.csv)，或查看[計算方法](docs/repro/method.md)與[瀏覽器測試步驟](guide/06-reproduce.md)。

## 檔案結構

```text
README.md             GitHub 首頁與閱讀入口
guide/                六份說明的 Markdown 原稿
docs/                 GitHub Pages 網站、圖表資料與下載檔
analysis/             查詢、分析及導讀產生程式
data/provenance.json  研究範圍、擷取檔雜湊與環境紀錄
presentation/         報告投影流程與答問
requirements.txt      Python 套件版本
```

原始事件擷取檔沒有上傳；可用查詢程式重新取得相同範圍。網站與分數表含研究範圍內的公開 GitHub 帳號名稱，因此不是匿名資料。重新查詢可能因鏡像或服務更新而不同，詳見[重現說明](guide/06-reproduce.md)。

## 來源

- [GH Archive](https://www.gharchive.org/)與 [GitHub 事件定義](https://docs.github.com/en/rest/using-the-rest-api/github-event-types)。
- [ClickHouse 鏡像匯入程式](https://github.com/ClickHouse/sql.clickhouse.com/blob/main/load_scripts/github_events/ingest.sh)：資料來源與欄位轉換。
- [課程 W02](https://sna-studio-course-tw.cs-lee.chatgpt.site/week/2)、[課程 W06](https://sna-studio-course-tw.cs-lee.chatgpt.site/week/6)：雙模網絡與中心度。
- [NetworkX 3.2 中心度文件](https://networkx.org/documentation/networkx-3.2/reference/algorithms/centrality.html)。

研究期間為 2025 年 1 月（UTC），網站與說明整理於 2026 年。本專案為課程報告，與 Hugging Face、GitHub、GH Archive 無官方隸屬關係。

# 第 J 組 SNA 個案｜重現分析

> 完整的白話解釋、欄位表與逐步算式，請閱讀[六章導讀](../guide.html)。程式與講稿見 [GitHub 專案](https://github.com/linyurou8821/sna-j-gharchive)。

## 研究問題

依 [SNA Studio 的開源協作案例](https://sna-studio-course-tw.cs-lee.chatgpt.site/cases#sna-github)，我們研究三件事：各事件層的跨庫橋接者是否相同；三種指標是否識別同一批審查帳號；移除高中心度帳號是否使二模核心比隨機移除更容易分裂。

## 資料範圍

- 來源：[GH Archive](https://www.gharchive.org/) 公開 GitHub 事件，經 [ClickHouse 公開 GitHub Events 鏡像](https://clickhouse.com/demos)查詢。
- 時間：2025-01-01 00:00:00（含）至 2025-02-01 00:00:00（不含），UTC。
- 專案：Transformers、Datasets、Tokenizers、Accelerate、Diffusers、PEFT、TRL、Hugging Face Hub、Smolagents、Text Generation Inference，共十個 Hugging Face 儲存庫。以同一生態系及該期間有可分析活動為目的性取樣，並非隨機抽樣。
- 原始查詢 13,555 列；排除可辨識自動化帳號後為 12,742 列、1,379 個帳號。

## 資料內容與清理

GH Archive 收錄公開 GitHub 活動；本組透過 ClickHouse 的 `github.github_events` 鏡像，只取 `repo_id`、`repo_name`、`event_type`、`actor_login`、`creator_user_login`、`action`、`review_state`、UTC 事件時間及 issue／PR `number`。十個名稱是 Hugging Face 組織的**程式碼儲存庫**，不是十份資料集。只選五種事件：`IssuesEvent`、`IssueCommentEvent`、`PullRequestEvent`、`PullRequestReviewEvent`、`PullRequestReviewCommentEvent`；網站將後兩者合併為 Review 層。

清理時排除帳號名以 `[bot]` 結尾的 405 筆，以及可辨識的 `HuggingFaceDocBuilderDev` 408 筆，共 813 筆。這是資料清理，不代表所有自動化帳號都被辨識。此批資料沒有缺少 `actor_login` 的列；分析程式若遇到缺少帳號的列也會排除。未擷取留言本文或完整 PR 內容。尚未與 GH Archive 逐時原始壓縮檔逐筆比對，不能聲稱鏡像和原檔完全一致。

## 節點、關係與指標

主網絡是「GitHub 帳號—儲存庫」二模網絡。帳號在指定期間於某儲存庫產生至少一筆所選事件，即建立一條二元邊。網站可切換 `IssuesEvent`、`IssueCommentEvent`、`PullRequestEvent`、`PullRequestReviewEvent` 加 `PullRequestReviewCommentEvent` 四層。事件次數用於描述活動量，不用來替代二元關係。

一條線可以來自議題動作、留言、PR 動作或審查，不限於直接修改程式碼。提出 PR 也不等於修改已被合併。未觀察到所選事件時，矩陣記 0，意義僅是「這份資料及選定期間沒有符合條件的紀錄」，不是證明帳號沒有私下參與。

### 基本運算與實際數字

令 `B[a,r] = 1` 表示帳號 `a` 在儲存庫 `r` 有至少一筆所選事件，否則為 0。帳號的專案 degree 是 `Σ_r B[a,r]`；例如 Wauplin 在全部事件層連到 5 個選定專案，degree＝5。兩個儲存庫的共同參與帳號數是 `Σ_a B[a,r1] × B[a,r2]`，但共同參與不證明專案之間直接合作。

角色重疊用 `Jaccard(I,P) = |I ∩ P| / |I ∪ P|`。在本資料，Issue 帳號集合與 PR 帳號集合共有 125 個，聯集 801 個，因此 `125 / 801 = 0.156`（四捨五入至小數第三位）。網站其餘兩組比較也依相同公式計算。時間切片最後一段有十天，前三段各七天，因此以「事件數 ÷ 天數」換算每日平均，避免拿不同長度的區間直接比總數。

網站的「跨專案參與者」指連至至少兩個選定儲存庫的帳號。圖上最多顯示 40 個示例帳號，依「跨庫帳號＋儲存庫」二模核心中的標準化中介中心度挑選。這個指標反映此網絡的最短路徑位置，不能解讀為個人的能力、工作量或貢獻價值。

### 四種中心度的網絡與參數

為避免不同分析單位混用，四個中心度都在**全部事件層**的同一張核心二模圖計算：93 個跨兩個以上專案的帳號、10 個儲存庫、229 條無向且無權重的二元邊，共 103 個節點；這張核心圖連通。只參與一個專案的帳號仍列入網站整體統計，但不列入這項核心中心度比較。更換核心門檻或事件層，分數與排名就可能改變。

| 指標 | 計算與解讀 | 本組設定 |
| --- | --- | --- |
| Degree | 帳號直接連到幾個儲存庫；`Σ_r B[a,r]` | 整數，最高為 5 個選定專案 |
| Closeness | 到核心其他節點的最短路徑距離越短，分數越高 | `networkx.closeness_centrality`；核心連通 |
| Betweenness | 其他節點間最短路徑經過該帳號的比例；可描述橋接位置 | `networkx.betweenness_centrality(normalized=True)`；網站圖的 40 個示例帳號依此挑選 |
| Eigenvector | 關係矩陣 `A` 的 `A x = λ x`：連到高分節點會提高自己的分數 | `networkx.eigenvector_centrality(max_iter=1000, tol=1e-10)`；帳號分數再以最高帳號為 1 縮放 |

Eigenvector 在這張二模圖的意思是「帳號連向結構上也較中心的儲存庫」，不是直接衡量聲望、能力或實際影響力。四項指標回答不同問題，不合成一個總分。可下載 [93 個跨庫帳號的完整分數](centrality-scores.csv) 檢查排名與同分情形。

角色重疊使用 Jaccard 相似度：兩種事件的共同參與帳號數，除以至少參與其中一種事件的帳號數。另將「issue／討論」歸為社群活動、「PR／review」歸為程式碼活動，計算兩類皆參與且跨庫的帳號數。

有向審查網絡只使用 `PullRequestReviewEvent`，以「審查者 → PR 作者」建立關係，並排除同一帳號對自己的關係。ClickHouse 扁平表中，留言事件的 `creator_user_login` 對應留言作者；因此沒有把留言事件推成「留言者 → 原作者」的人際邊。

### RQ1：三層橋接名單

Issue、PR、Review 各有一張二模核心，固定保留十庫（含孤立庫），帳號需在該層連到至少兩庫。Degree 中心度＝相鄰儲存庫數 ÷ 十個可能的儲存庫。Betweenness 使用 `networkx.betweenness_centrality(normalized=True)`，端點不計入；無向圖按全圖的其他節點配對標準化，不可達的配對不貢獻分數。先取小數第 12 位，按高至低排序，同分先比不分大小寫的帳號，再比原字串。正分帳號才入前十名，不足時不補零分。兩榜交集除以聯集，兩榜皆空時 Jaccard 不定；「獨有」指另兩榜皆無此帳號。

### RQ2：審查互動與 Constraint

[鏡像的匯入程式](https://github.com/ClickHouse/sql.clickhouse.com/blob/main/load_scripts/github_events/ingest.sh)按順序取 `payload.comment.user.login`、`payload.issue.user.login` 或 `payload.pull_request.user.login`。[GitHub 事件定義](https://docs.github.com/en/rest/using-the-rest-api/github-event-types)顯示，送出 Review 時可用 `pull_request`；PR 或 Issue 事件的狀態動作不能一律推成人際互動，留言者也不一定就是原議題的作者。現有擷取不建構 Issue／PR 的人際圖。清理後，從 `PullRequestReviewEvent` 排除缺作者 0 筆、自我審查 882 筆及作者為可辨識自動化帳號 1 筆，留下 2,058 筆事件、675 條不同有向邊。

三種指標均改在「任一方向出現審查就連一條邊」的 375 帳號、618 邊簡單無向圖計算。Degree 中心度是鄰居數 ÷（圖中帳號數 − 1）；中介使用與 RQ1 相同的算法，但圖的意義不同，不比較兩張圖的絕對分數。將 `pᵥw` 定義為帳號 v 投在鄰居 w 的連結比例，Burt’s Constraint 可寫成 `C(v) = Σw (pᵥw + Σq pᵥq p_qw)²`；外層對直接鄰居 w 加總，內層對其他鄰居 q 加總。用 `networkx.constraint(weight=None)`。若無有效鄰居，分數以空值呈現；目前互動圖由有效邊的端點構成，因此沒有孤立帳號。Constraint 可大於 1，不能當成機率。

不使用二模 Constraint，因帳號的鄰居是儲存庫，庫與庫不能相連，間接項消失；等權的直接連線會使分數等於 `1 / Degree`。不以「共同參與同一儲存庫」投影出假定的人際邊。比較高 Degree、高 Betweenness、低 Constraint 的各前十名；後兩榜的交集是候選，排序同分規則同 RQ1。完整資料見[橋接與審查分數 CSV](bridge-scores.csv)。

### RQ3：定向與隨機移除

- 基準固定為全部事件二模核心。只移除帳號及相連邊；所有 10 個儲存庫（包括孤立庫）都保留。
- 比較 0、1、3、5、10 個帳號。定向依原圖 Betweenness 或 Degree 固定排序，不因移除重算；同分規則同 RQ1。
- 用 Python `random.Random(202501)` 隨機產生 500 條不放回順序，每條順序使用對應長度的前綴。公布平均及樣本最小、最大值；不是信賴區間。
- 若各分量大小為 `sᵢ`，剩餘節點數為 `N`：最大分量比例是 `max(sᵢ) / N`；可達配對比例是 `Σ C(sᵢ,2) / C(N,2)`。兩者皆包含帳號與庫，分母在同一移除量下相同。另計算庫與庫配對可達率，以 10 庫的 45 個無序配對為固定分母。
- 同時記錄分量數、剩餘邊、基準邊數減剩餘邊。邊隨節點移除自然減少；網絡是否分裂看連通性指標。這是結構模擬，不代表維護者離開後的實際專案表現。

## 自動化帳號與限制

排除登入名稱以 `[bot]` 結尾的帳號，以及由 [Hugging Face doc-builder 專案文件](https://github.com/huggingface/doc-builder)可辨識的 `HuggingFaceDocBuilderDev`。其他自動化帳號可能留在資料中。

`IssueCommentEvent` 包含 issue 和 PR 上的留言，網站將它獨立標示為「討論」。公開事件不包含所有線下溝通，也不能證明誰影響了誰；單一組織、十個專案與一個月份都限制了結論的適用範圍。事件類型定義參考 [GitHub 官方文件](https://docs.github.com/en/rest/using-the-rest-api/github-event-types)。

## 與課本及課堂個案的關係

[課程第 2 週的 Davis Southern Club Women](https://sna-studio-course-tw.cs-lee.chatgpt.site/week/2) 使用「女性 × 社交活動」的 0／1 出席矩陣；本組使用「GitHub 帳號 × 儲存庫」的 0／1 事件參與矩陣。兩者是相似的雙模資料結構，**不是同一份資料集**。Davis 個案中的共同出席不等於友誼；本組的共同參與也不等於帳號間有直接合作。[課程第 6 週](https://sna-studio-course-tw.cs-lee.chatgpt.site/week/6) 對應 Hanneman & Riddle 第 10 章中心度，列出 degree、closeness、betweenness 和 eigenvector；本組在同一張核心網絡比較這四種中心度，並明示其各自的意義與限制。

## 重現步驟

1. 使用 Python 3.10 以上，執行 `python -m pip install -r requirements.txt`。
2. 在專案根目錄執行 `python3 analysis/fetch_events.py --output data/raw-events.jsonl`。程式將一個月分成四段查詢，避免 ClickHouse 公開示範服務單次回傳 10,000 列的限制。
3. 執行 `python analysis/analyze.py`，產生 `docs/data.json` 及兩份分數 CSV。接著用 `python analysis/build_guide.py` 更新導讀，並用 `python -m unittest discover -s analysis -v` 驗證資料。
4. 透過 HTTP 伺服器開啟 `docs/`（例如 `python -m http.server 4173 --directory docs`），網站會讀取產生的 `data.json`；可在「研究發現」查看三項結果。

原始查詢只取分析需要的事件欄位，未擷取 issue、PR 或留言本文。原始事件列不包含在網站中；網站使用彙總結果、示例節點，以及 93 個跨專案帳號的中心度。這些結果包含公開帳號名稱，並非匿名資料。原始快照未另做 COUNT 比對或依事件 ID 去重，也未逐筆比對 GH Archive 原檔；重現的可檢查程度與限制見完整導讀。

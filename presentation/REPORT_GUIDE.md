# 第 J 組 SNA 報告講稿與示範流程

四人可直接排練的逐字稿見 [FULL_SCRIPT_20MIN.md](FULL_SCRIPT_20MIN.md)。

**題目：**誰在開源專案裡連接程式碼與社群？  
**資料**　GH Archive 公開 GitHub 事件，2025 年 1 月 UTC，十個 Hugging Face 儲存庫

**安排**　2026/11/19，16:35–16:55 報告，16:55–17:00 師生討論（以教師最新公告為準）

**投影入口**　[開源協作地圖](https://linyurou8821.github.io/sna-j-gharchive/)

## 20 分鐘投影流程

| 時間 | 組員與畫面 | 操作與講述重點 |
| --- | --- | --- |
| 00:00–05:00 | 組員一 · 首頁、資料範圍、互動網絡 | 介紹三個問題、資料範圍與二模網絡。最後選「全部」，指左側儲存庫、右側帳號。 |
| 05:00–10:00 | 組員二 · 互動網絡、[RQ1](https://linyurou8821.github.io/sna-j-gharchive/#rq1) | 依序切換 Issue、PR、Review，點一位有編號的帳號。前往重疊表，示範交集除以聯集。 |
| 10:00–15:00 | 組員三 · [審查關係](https://linyurou8821.github.io/sna-j-gharchive/#review-interaction)、[RQ2](https://linyurou8821.github.io/sna-j-gharchive/#rq2) | 展開有向審查關係，再指向散點圖的兩軸、橘點和重疊表。 |
| 15:00–20:00 | 組員四 · [RQ3](https://linyurou8821.github.io/sna-j-gharchive/#rq3)、方法與限制 | 指比例曲線，展示移除 10 位的中介優先與 Degree 優先，再收束三項結果。 |

## 上台前與現場答問

- 用投影電腦開啟正式網址並試一次「簡報模式」。確認 4 位組員都能從逐字稿快速跳到自己的圖表，再計時合練一次。討論時間另計。
- 問到兩個 Issue／PR Jaccard 數字時，RQ1 比較高中介的前十名，分母為 19，結果 0.053。補充成果比較全部參與帳號，分母為 801，結果 0.156。
- 問到 Constraint 的計算位置時，RQ2 使用審查事件建立的帳號互動圖。直接套在無權重的帳號 × 儲存庫二模圖時，分數會等於 Degree 的倒數。
- 問到移除後還剩多少連線時，移除 10 位的中介優先與 Degree 優先分別少 41 與 44 條邊。隨機移除平均少 24.66 條。三種策略在測試步數內都維持單一連通分量。
- 想核對算法或完整數字時，可從網站的「方法與限制」或[導讀的常見疑問](https://linyurou8821.github.io/sna-j-gharchive/guide.html#questions)進入。

const LAYER_LABELS = { issues: 'Issue', pulls: 'PR', reviews: 'Review' };
const METRIC_LABELS = { degree: '高 Degree', betweenness: '高 Betweenness', constraint: '低 Constraint' };
const STRATEGIES = { betweenness: '中介優先', degree: 'Degree 優先', random: '隨機移除' };
const SOURCE_NOTE = '資料：GH Archive／ClickHouse，Hugging Face 十個專案，2025 年 1 月（UTC）。';
const fixed = (value, places = 3) => value == null ? '—' : value.toFixed(places);
const percent = value => value == null ? '—' : fixed(100 * value, 1) + '%';
const names = list => list.length ? list.map(escapeHtml).join('、') : '無';
const get = id => document.getElementById(id);

function researchTable(caption, headers, rows) {
  return `<div class="research-table" tabindex="0" role="region" aria-label="${escapeHtml(caption)}（可橫向捲動）">
    <table><caption>${escapeHtml(caption)}</caption><thead><tr>${headers.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(([label, ...cells]) => `<tr><th scope="row">${label}</th>${cells.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function comparisonRows(comparisons, labels, showNames = true) {
  return Object.entries(comparisons).map(([pair, result]) => [
    pair.split('-').map(key => labels[key]).join(' × '),
    result.intersection, result.union, fixed(result.jaccard),
    ...(showNames ? [names(result.accounts)] : []),
  ]);
}

function renderBridgeResearch(data) {
  const layers = Object.keys(LAYER_LABELS);
  const { limit, common, comparisons, exclusive } = data.bridgeComparison;
  const closest = Object.entries(comparisons).reduce((best, cur) =>
    (cur[1].jaccard ?? -1) > (best[1].jaccard ?? -1) ? cur : best);
  const summaries = layers.map(key => {
    const info = data.views[key].bridgeLayer;
    return [LAYER_LABELS[key], `${info.nodes}（${info.accounts}／${info.repositories}）`, info.edges,
      info.components, info.eligible, `${info.top.length} / ${limit}`];
  });
  const rankings = layers.map(key => {
    const { top, scores } = data.views[key].bridgeLayer;
    return researchTable(`${LAYER_LABELS[key]} 橋接排名`, ['名次', '帳號', 'Degree', '中介中心度'],
      top.map((name, i) => [i + 1, escapeHtml(name), scores[name].degree, fixed(scores[name].betweenness, 5)]));
  });
  get('bridgeResults').innerHTML = `
    <p class="research-answer">三層共同入榜：<strong>${common.length} 位</strong>（${names(common)}）。${
      closest[1].jaccard == null ? '所有榜單皆空，無法比較 Jaccard。' :
        `重疊最多的比例出現在 ${closest[0].split('-').map(key => LAYER_LABELS[key]).join(' × ')}，Jaccard 為 <strong>${fixed(closest[1].jaccard)}</strong>。`}</p>
    ${researchTable('分層二模核心規模與有效名額', ['事件層', '節點（帳號／庫）', '邊', '連通分量', '正中介帳號', '實際入榜／上限'], summaries)}
    ${researchTable('橋接名單重疊：Jaccard＝交集／聯集', ['比較', '交集', '聯集', 'Jaccard', '共同上榜帳號'], comparisonRows(comparisons, LAYER_LABELS))}
    <details class="research-details"><summary>展開三層排名與各層獨有帳號</summary>
      <div class="research-grid three">${rankings.join('')}</div>
      <ul>${layers.map(key => `<li><strong>${LAYER_LABELS[key]} 獨有（${exclusive[key].length}）：</strong>${names(exclusive[key])}</li>`).join('')}</ul>
    </details>
    <p class="research-note">正分候選不足 ${limit} 位時只列實際名額。Degree 中心度為表中 Degree ÷ 儲存庫數；二模 Constraint 會退化為 Degree 的倒數。${SOURCE_NOTE}</p>`;
}

function svgChart(target, label, width = 520, height = 292) {
  const chart = svg('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': label, class: 'research-svg' });
  chart.append(svg('title', {}, label));
  target.replaceChildren(chart);
  return chart;
}

function chartText(chart, x, y, value, options = {}) {
  chart.append(svg('text', { x, y, ...options }, value));
}

function grid(chart, labels, y) {
  labels.forEach(([value, label]) => {
    chart.append(svg('line', { x1: 68, x2: 500, y1: y(value), y2: y(value), class: 'chart-grid-line' }));
    chartText(chart, 61, y(value) + 5, label, { 'text-anchor': 'end' });
  });
}

function renderScatter(review) {
  const points = Object.entries(review.scores).filter(([, row]) => row.constraint != null);
  if (!points.length) {
    get('constraintPlot').textContent = '沒有可同時計算兩項指標的帳號。';
    return;
  }
  const maxX = Math.max(.01, ...points.map(([, row]) => row.betweenness)) * 1.05;
  const maxY = Math.max(1, ...points.map(([, row]) => row.constraint)) * 1.05;
  const x = value => 68 + 432 * value / maxX;
  const y = value => 233 - 187 * value / maxY;
  const chart = svgChart(get('constraintPlot'), '審查互動圖各帳號的 Betweenness × Constraint 散點圖，橘色為同時上榜的候選');
  grid(chart, [0, .25, .5, .75, 1].map(t => [maxY * t, fixed(maxY * t, 2)]), y);
  [0, .25, .5, .75, 1].forEach(t =>
    chartText(chart, x(maxX * t), 256, fixed(maxX * t, 3), { 'text-anchor': 'middle' }));
  chartText(chart, 68, 29, 'Constraint（較低 ↓）');
  chartText(chart, 500, 281, 'Betweenness（較高 →）', { 'text-anchor': 'end' });
  const candidates = new Set(review.candidates);
  points.sort(([a], [b]) => Number(candidates.has(a)) - Number(candidates.has(b)));
  for (const [name, row] of points) {
    const candidate = candidates.has(name);
    const dot = svg('circle', { cx: x(row.betweenness), cy: y(row.constraint), r: candidate ? 4.8 : 3.3,
      class: candidate ? 'candidate-dot' : 'scatter-dot' });
    dot.append(svg('title', {}, `${name}｜Degree ${row.degree}｜Betweenness ${fixed(row.betweenness, 5)}｜Constraint ${fixed(row.constraint, 5)}`));
    chart.append(dot);
  }
}

function renderReviewResearch(review) {
  const degreeFirst = review.top.degree[0];
  const betweenFirst = review.top.betweenness[0];
  const row = name => {
    const score = review.scores[name];
    return [escapeHtml(name), score.degree, fixed(score.betweenness, 5), fixed(score.constraint, 5),
      review.candidates.includes(name) ? '● 候選' : '—'];
  };
  const tables = Object.entries(review.top).map(([key, top]) =>
    researchTable(METRIC_LABELS[key] + '前十名', ['名次', '帳號', '分數'],
      top.map((name, i) => [i + 1, escapeHtml(name),
        key === 'degree' ? review.scores[name][key] : fixed(review.scores[name][key], 5)]))).join('');
  get('reviewResults').innerHTML = `
    <p class="research-answer">${degreeFirst && betweenFirst ?
      `Degree 首名為 <strong>${escapeHtml(degreeFirst)}</strong>，Betweenness 首名為 <strong>${escapeHtml(betweenFirst)}</strong>。` : '沒有有效名次。'}
      高 Betweenness 與低 Constraint 同時入榜的帳號有 <strong>${review.candidates.length} 位</strong>。</p>
    <p>分析圖：${review.nodes} 個帳號、${review.edges} 條無向邊、${review.components} 個連通分量。審查關係沒有出現的帳號不在圖上。</p>
    <div class="research-grid">
      <figure><figcaption>Betweenness × Constraint｜每點一個帳號</figcaption><div id="constraintPlot"></div>
        <p class="research-note"><span class="legend-dot"></span> 同時進入高 Betweenness 與低 Constraint 前十名。部分點重疊；完整數字見分數表。${SOURCE_NOTE}</p></figure>
      <div>${researchTable('三種指標的榜單重疊', ['前十名比較', '交集', '聯集', 'Jaccard'], comparisonRows(review.comparisons, METRIC_LABELS, false))}
        <p><strong>圖中候選：</strong>${names(review.candidates)}。</p>
        <p class="research-note">候選表示在審查圖上的結構位置。低 Constraint 可能同時反映鄰居多且較少彼此連結，不表示帳號能力或績效較強。</p></div>
    </div>
    <details class="research-details"><summary>展開三個指標榜單與完整帳號表</summary><div class="research-grid three">${tables}</div>
      ${researchTable('完整審查互動分數（依中介中心度）', ['帳號', 'Degree', 'Betweenness', 'Constraint', '兩榜皆入'],
        Object.keys(review.scores).sort((a, b) => review.scores[b].betweenness - review.scores[a].betweenness).map(row))}</details>`;
  renderScatter(review);
}

function renderReviewEgo(review) {
  const select = get('reviewAccount');
  if (!review.nodes) {
    get('reviewEgo').textContent = '沒有足夠的有效審查事件可建立互動網絡。';
    return;
  }
  select.replaceChildren(...Object.keys(review.scores).sort((a, b) => a.localeCompare(b, 'en')).map(name => new Option(name, name)));
  select.disabled = false;
  select.value = review.top.betweenness[0] || review.top.degree[0];
  const draw = () => {
    const ego = select.value;
    const ties = review.arcs.filter(([a, b]) => a === ego || b === ego).sort((a, b) => b[2] - a[2]);
    const shown = ties.slice(0, 12);
    get('reviewEgo').innerHTML = `<p>共有 ${ties.length} 條有向關係；圖中顯示事件數最多的 ${shown.length} 條，完整關係見下表。${SOURCE_NOTE}</p>
      <div class="ego-plot" id="egoPlot"></div><details><summary>展開此帳號的所有有向審查關係</summary>
      ${researchTable('有向審查關係', ['審查者', 'PR 作者', '審查事件'],
        ties.map(([a, b, count]) => [escapeHtml(a), escapeHtml(b), count]))}</details>`;
    const chart = svgChart(get('egoPlot'), `${ego} 的有向審查關係`, 660, 58 + shown.length * 27);
    shown.forEach(([a, b, count], i) => {
      const y = 48 + i * 27;
      chartText(chart, 286, y, a, { 'text-anchor': 'end', class: a === ego ? 'ego-current' : '' });
      chartText(chart, 374, y, b, { class: b === ego ? 'ego-current' : '' });
      chartText(chart, 330, y, `→ ${count}`, { 'text-anchor': 'middle' });
    });
    chartText(chart, 286, 22, '審查者', { 'text-anchor': 'end', class: 'ego-current' });
    chartText(chart, 374, 22, 'PR 作者', { class: 'ego-current' });
  };
  select.onchange = draw;
  draw();
}

function renderRemovalCurve(target, rows, field, label, ratio) {
  const chart = svgChart(target, label);
  const x = k => 68 + 432 * k / Math.max(1, rows.at(-1).removed);
  const minimum = ratio ? 0 : Math.floor(Math.min(...rows.flatMap(row =>
    [row.betweenness[field], row.degree[field], row.random[field].min])) / 10) * 10;
  const maximum = ratio ? 1 : Math.ceil(rows[0].betweenness[field] / 10) * 10;
  const y = value => 233 - 184 * (value - minimum) / (maximum - minimum || 1);
  grid(chart, [0, .25, .5, .75, 1].map(t => {
    const value = minimum + (maximum - minimum) * t;
    return [value, ratio ? percent(value) : fixed(value, 0)];
  }), y);
  for (const row of rows) chartText(chart, x(row.removed), 256, row.removed, { 'text-anchor': 'middle' });
  chartText(chart, 500, 281, '移除帳號數', { 'text-anchor': 'end' });
  const point = (row, value) => `${x(row.removed)},${y(value)}`;
  const band = [...rows.map(row => point(row, row.random[field].max)),
    ...rows.slice().reverse().map(row => point(row, row.random[field].min))];
  chart.append(svg('polygon', { points: band.join(' '), class: 'random-band' }));
  for (const strategy of ['betweenness', 'degree', 'random']) {
    const value = row => strategy === 'random' ? row.random[field].mean : row[strategy][field];
    chart.append(svg('polyline', { points: rows.map(row => point(row, value(row))).join(' '),
      class: `curve ${strategy}` }));
    for (const row of rows) {
      const dot = svg('circle', { cx: x(row.removed), cy: y(value(row)), r: strategy === 'betweenness' ? 4 : 2.5, class: `curve-dot ${strategy}` });
      dot.append(svg('title', {}, `${STRATEGIES[strategy]}：移除 ${row.removed} 個，${ratio ? percent(value(row)) : fixed(value(row), 2)}`));
      chart.append(dot);
    }
  }
}

function renderRemovalGraph(target, data, repositories, removed, label) {
  const chart = svgChart(target, label, 510, 426);
  const repoPos = new Map(repositories.map(({ id }, index) => {
    const angle = -Math.PI / 2 + (index + .5) * Math.PI * 2 / repositories.length;
    return [id, [255 + 178 * Math.cos(angle), 209 + 175 * Math.sin(angle)]];
  }));
  const actors = Object.keys(data.accountRepos).sort((a, b) =>
    data.accountRepos[a].join().localeCompare(data.accountRepos[b].join()) || a.localeCompare(b));
  const positions = new Map(actors.map((name, i) => [name, [152 + (i % 10) * 23, 102 + Math.floor(i / 10) * 23]]));
  for (const [name, repos] of Object.entries(data.accountRepos)) {
    if (removed.has(name)) continue;
    const [x1, y1] = positions.get(name);
    for (const repo of repos) {
      const [x2, y2] = repoPos.get(repo);
      chart.append(svg('line', { x1, y1, x2, y2, class: 'removal-edge' }));
    }
  }
  for (const [name, [cx, cy]] of positions) {
    if (removed.has(name)) continue;
    const dot = svg('circle', { cx, cy, r: 3, class: 'removal-actor' });
    dot.append(svg('title', {}, name));
    chart.append(dot);
  }
  for (const repo of repositories) {
    const [cx, cy] = repoPos.get(repo.id);
    chart.append(svg('rect', { x: cx - 5, y: cy - 5, width: 10, height: 10, class: 'removal-repo' }));
    chartText(chart, cx + (cx < 255 ? -9 : 9), cy + 5, repo.label, { 'text-anchor': cx < 255 ? 'end' : 'start' });
  }
}

function renderRemovalResearch(data, repositories) {
  const { rows, nodes, accounts, edges, trials, seed, orders, attackOverlap } = data;
  const last = rows.at(-1);
  const fullyConnected = rows.every(row => row.betweenness.components === 1 &&
    row.degree.components === 1 && row.random.components.min === 1 && row.random.components.max === 1);
  const fields = ['components', 'largestRatio', 'reachableRatio', 'repoReachableRatio', 'edges', 'edgesLost'];
  const tableRows = rows.flatMap(row => Object.entries(STRATEGIES).map(([key, label]) => [
    row.removed, label, ...fields.map((field, i) => {
      const format = i > 0 && i < 4 ? percent : value => Number.isInteger(value) ? String(value) : fixed(value, 2);
      if (key !== 'random') return format(row[key][field]);
      const result = row.random[field];
      return result ? `${format(result.mean)}（${format(result.min)}–${format(result.max)}）` : '—';
    }),
  ]));
  const charts = [['largestRatio', '最大連通分量比例'], ['reachableRatio', '可達配對比例'], ['edges', '剩餘邊數']];
  get('removalResults').innerHTML = `
    <p class="research-answer">${fullyConnected ?
      '測試範圍內沒有觀察到網絡分裂：兩種排名移除及每次隨機試驗都維持一個連通分量，三種策略的連通性曲線重合。' :
      '各策略的連通性與邊數變動見曲線和數值表；隨機結果以實測範圍呈現。'}</p>
    <p>基準：${nodes} 個節點（${accounts} 個帳號與 ${data.repositories} 庫）、${edges} 條邊。兩種排名前 ${last.removed} 位重疊 <strong>${attackOverlap.intersection} 位</strong>。在最大移除量下，按中介／Degree 優先分別少了 ${last.betweenness.edgesLost}／${last.degree.edgesLost} 條邊；隨機平均少 ${fixed(last.random.edgesLost.mean, 2)} 條。邊數減少本身不能證明網絡分裂。</p>
    <div class="chart-legend"><span class="betweenness">中介優先</span><span class="degree">Degree 優先</span><span class="random">隨機平均</span><span class="range">隨機最小–最大</span></div>
    <div class="research-grid three">${charts.map(([field, label]) =>
      `<figure><figcaption>${label}</figcaption><div id="curve-${field}"></div></figure>`).join('')}</div>
    <p class="research-note">隨機移除 ${trials} 次，種子 ${seed}。比例以剩餘節點為分母；分量包含孤立儲存庫。${SOURCE_NOTE}</p>
    <details class="research-details"><summary>展開各步數的完整數值與固定移除排名</summary>
      ${researchTable('移除實驗；隨機列為平均（最小–最大）', ['移除數', '策略', '分量數', '最大分量比例', '可達配對', '庫配對可達', '剩餘邊', '少掉的邊'], tableRows)}
      <p><strong>中介優先：</strong>${names(orders.betweenness)}。<br><strong>Degree 優先：</strong>${names(orders.degree)}。</p></details>
    <h4>同一張圖，移除前與移除後</h4>
    <label for="attackStrategy">排名策略</label>
    <select id="attackStrategy"><option value="betweenness">中介優先</option><option value="degree">Degree 優先</option></select>
    <label for="attackStep">移除數</label>
    <select id="attackStep">${rows.filter(r => r.removed > 0).map(r =>
      `<option value="${r.removed}" ${r === last ? 'selected' : ''}>${r.removed}</option>`).join('')}</select>
    <div class="research-grid compare-graphs">
      <figure><figcaption>移除前｜${nodes} 節點、${edges} 邊</figcaption><div id="beforeRemoval"></div></figure>
      <figure><figcaption id="afterCaption" aria-live="polite"></figcaption><div id="afterRemoval"></div></figure>
    </div>
    <p class="research-note">方塊＝儲存庫，圓點＝跨庫帳號，線＝參與。兩張圖的位置固定；移除後空位保留，便於對照。這是對既有結構的模擬，不預測真實專案是否能繼續運作。</p>`;
  charts.forEach(([field, label]) => renderRemovalCurve(get(`curve-${field}`), rows, field, label, field !== 'edges'));
  renderRemovalGraph(get('beforeRemoval'), data, repositories, new Set(), '移除前的全部事件二模核心');
  const update = () => {
    const strategy = get('attackStrategy').value;
    const step = Number(get('attackStep').value);
    const result = rows.find(row => row.removed === step)[strategy];
    const caption = `移除 ${step} 位後｜${nodes - step} 節點、${result.edges} 邊、${result.components} 分量`;
    get('afterCaption').textContent = caption;
    renderRemovalGraph(get('afterRemoval'), data, repositories, new Set(orders[strategy].slice(0, step)), caption);
  };
  get('attackStrategy').onchange = update;
  get('attackStep').onchange = update;
  update();
}

function renderResearch(data) {
  renderBridgeResearch(data);
  renderReviewResearch(data.reviewNetwork.analysis);
  renderReviewEgo(data.reviewNetwork.analysis);
  renderRemovalResearch(data.robustness, data.repositories);
  get('methodTrials').textContent = data.robustness.trials;
  get('methodSeed').textContent = data.robustness.seed;
}

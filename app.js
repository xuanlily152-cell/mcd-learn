/* ============================================================
 * 学机电传动控制 · 主应用
 * 路由：#/ 首页  #/lessons/[章]  #/lab/[电机]  #/tree 知识树
 * ============================================================ */
(function () {
  'use strict';
  const $ = (s, p) => (p || document).querySelector(s);
  const $$ = (s, p) => [...(p || document).querySelectorAll(s)];

  /* ---------- 课程元数据 ---------- */
  const CH_META = [
    { icon: '📘', diff: 'easy', dname: '入门', desc: '机电系统组成、课程任务与发展概况' },
    { icon: '⚙️', diff: 'easy', dname: '入门', desc: '运动方程、转矩与飞轮矩折算、负载类型与稳定运行' },
    { icon: '🔴', diff: 'mid', dname: '进阶', desc: '他励直流电机结构原理、起动调速制动全流程' },
    { icon: '⚡', diff: 'mid', dname: '进阶', desc: '三相异步电机、旋转磁场、变频调速与 PMSM' },
    { icon: '🎯', diff: 'mid', dname: '进阶', desc: '步进电机、BLDC、交流伺服三大控制电机' },
    { icon: '🧩', diff: 'easy', dname: '入门', desc: '接触器、继电器、起保停与正反转互锁电路' },
    { icon: '🖥️', diff: 'mid', dname: '进阶', desc: '循环扫描原理与梯形图编程规则' },
    { icon: '🔌', diff: 'hard', dname: '挑战', desc: 'IGBT、可控整流与 SPWM 逆变技术' },
    { icon: '🎛️', diff: 'hard', dname: '挑战', desc: '调速指标、双闭环与 PWM 直流调速系统' },
    { icon: '🚀', diff: 'hard', dname: '挑战', desc: 'V/f 控制、矢量控制 FOC 与直接转矩控制 DTC' }
  ];

  const MOTORS = Object.keys(MOTOR_3D);
  const MOTOR_ICONS = { 'dc-shunt': '🔴', 'ac-induction': '⚡', 'pmsm': '🧲', 'stepper': '👣', 'bldc': '🌀', 'servo': '🎯' };

  /* 电机 → 教材章节定位 */
  function findMotorNode(motorId) {
    for (let ci = 0; ci < KNOWLEDGE_TREE.children.length; ci++) {
      const ch = KNOWLEDGE_TREE.children[ci];
      for (const t of ch.children) {
        if (t.motor3d === motorId) return { chapterIdx: ci, node: t };
        if (t.children) for (const st of t.children) {
          if (st.motor3d === motorId) return { chapterIdx: ci, node: st };
        }
      }
    }
    return null;
  }

  /* 章节 → 知识点扁平列表（带唯一 id） */
  function topicsOf(ci) {
    const ch = KNOWLEDGE_TREE.children[ci];
    const list = [];
    ch.children.forEach((t, ti) => {
      if (t.children && t.children.length) {
        t.children.forEach((st, si) => list.push({ id: `${ci}.${ti}.${si}`, node: st, parent: t }));
      } else {
        list.push({ id: `${ci}.${ti}`, node: t, parent: null });
      }
    });
    return list;
  }
  function allTopics() {
    let all = [];
    for (let ci = 0; ci < KNOWLEDGE_TREE.children.length; ci++) all = all.concat(topicsOf(ci));
    return all;
  }
  const TOTAL = allTopics().length;

  /* ---------- 进度 ---------- */
  const PKEY = 'mcd_progress_v1';
  let progress = {};
  try { progress = JSON.parse(localStorage.getItem(PKEY) || '{}'); } catch (e) { progress = {}; }
  function saveProgress() { localStorage.setItem(PKEY, JSON.stringify(progress)); refreshTopProgress(); }
  function isDone(id) { return !!progress[id]; }
  function chapterDoneCount(ci) { return topicsOf(ci).filter(t => isDone(t.id)).length; }
  function refreshTopProgress() {
    const done = Object.keys(progress).filter(k => progress[k]).length;
    $('#tp-num').textContent = `${done}/${TOTAL}`;
    $('#tp-fill').style.width = Math.round(done / TOTAL * 100) + '%';
  }

  /* ---------- 弹窗 ---------- */
  function openModal(title, html) {
    closeModal();
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = `
      <div class="modal" role="dialog">
        <div class="modal-head"><h3>${title}</h3><button class="modal-x">✕</button></div>
        <div class="modal-body">${html}</div>
      </div>`;
    $('#modal-root').appendChild(mask);
    mask.addEventListener('click', e => { if (e.target === mask) closeModal(); });
    $('.modal-x', mask).addEventListener('click', closeModal);
    document.body.style.overflow = 'hidden';
    renderMathInEl($('.modal-body', mask));
  }
  function closeModal() {
    $('#modal-root').innerHTML = '';
    document.body.style.overflow = '';
  }
  window.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  function richTableHTML(t) {
    let h = `<div class="rich-table"><div class="rt-title">📋 ${t.title}</div><table><thead><tr>`;
    t.head.forEach(x => h += `<th>${x}</th>`);
    h += '</tr></thead><tbody>';
    t.rows.forEach(r => { h += '<tr>'; r.forEach(c => h += `<td>${c}</td>`); h += '</tr>'; });
    return h + '</tbody></table></div>';
  }

  function topicModalHTML(topic, ci) {
    const n = topic.node;
    const rich = (typeof TOPIC_RICH !== 'undefined') && TOPIC_RICH[topic.id];
    let html = '';
    if (topic.parent) html += `<p style="font-size:13px;color:var(--ink-mute)">属于：${topic.parent.name}</p>`;
    /* 段落：优先富内容 */
    if (rich && rich.paras) html += rich.paras.map(p => `<p>${p}</p>`).join('');
    else if (n.longDesc) html += n.longDesc.map(p => `<p>${p}</p>`).join('');
    else if (n.desc) html += `<p>${n.desc}</p>`;
    /* 主公式 */
    if (rich && rich.formula) html += `<div class="formula-box">$$${rich.formula}$$</div>`;
    /* 表格 */
    if (rich && rich.table) html += richTableHTML(rich.table);
    /* 图表 */
    if (rich && rich.chart) {
      try {
        const svg = ChartSVG.render(rich.chart);
        if (svg) html += `<div class="chart-box">${svg}</div>`;
      } catch (e) { /* 图表渲染失败不影响内容 */ }
    }
    if (n.img) html += `<img src="${n.img}" alt="${n.name}">`;
    if (n.quiz) html += `
      <div class="quiz-box">
        <div class="q-t">📝 自测：${n.quiz.q}</div>
        <details><summary>查看答案</summary><div class="ans">${n.quiz.a}</div></details>
      </div>`;
    return html;
  }
  function openTopic(topic, ci) {
    openModal(`${CH_META[ci].icon} ${topic.node.name}`, topicModalHTML(topic, ci));
  }

  /* ---------- 首页 ---------- */
  let heroViewer = null;
  function renderHome() {
    const app = $('#app');
    app.innerHTML = `
      <section class="hero">
        <div>
          <div class="hero-chip-row">
            <span class="hero-chip hot">🎓 授课教师：<b>吴超群</b></span>
            <span class="hero-chip">武汉理工大学 机电工程学院</span>
            <span class="hero-chip">《机电传动控制》第六版 · 陈冰 等编著</span>
          </div>
          <h1>学机电传动，<br>把每台电机<em>点开看</em></h1>
          <p class="sub">像玩 Arduino 一样学机电传动控制：拖拽旋转 3D 电机、点击部件听讲解、沿知识树攻克 10 章考点，AI 助教全程陪跑答疑。</p>
          <div class="hero-cta">
            <a class="btn primary" href="#/lessons/0">▶ 开始学习 · 第 1 课</a>
            <a class="btn" href="#/lab">🔬 进入电机实验室</a>
            <a class="btn teal" href="#/tree">🌲 知识树总览</a>
          </div>
        </div>
        <div class="card stage-card">
          <div class="stage-head"><span class="t"><span class="dot"></span>3D 电机 · 可交互</span><span class="badge b-gray" id="hero-motor-name">—</span></div>
          <div class="stage-canvas" id="hero-stage">
            <div class="stage-part-tip" id="hero-tip"></div>
            <div class="stage-tip">🖱️ 拖拽旋转 · 滚轮缩放 · <b>点击部件</b>查看讲解</div>
            <div class="stage-tip" id="hero-part-info" style="left:12px;top:10px;bottom:auto;display:none"></div>
          </div>
          <div class="motor-tabs" id="hero-tabs"></div>
        </div>
      </section>

      <div class="stats-row">
        <div class="card stat"><span class="ic" style="background:var(--blue-soft)">📚</span><div><div class="num">10 章</div><div class="lab">全教材知识体系</div></div></div>
        <div class="card stat"><span class="ic" style="background:var(--teal-soft)">🔬</span><div><div class="num">6 台</div><div class="lab">电机 3D 拆解模型</div></div></div>
        <div class="card stat"><span class="ic" style="background:var(--yellow-soft)">💡</span><div><div class="num">${TOTAL} 个</div><div class="lab">考点 + 自测题</div></div></div>
        <div class="card stat"><span class="ic" style="background:var(--accent-soft)">🤖</span><div><div class="num">AI 助教</div><div class="lab">7×24 答疑解惑</div></div></div>
      </div>

      <div class="section-head">
        <div class="kicker">Course chapters</div>
        <h2 class="h-section">10 章课程 · 逐步进阶</h2>
        <span class="more">点击卡片进入章节学习，勾选知识点自动记录进度 →</span>
      </div>
      <div class="chapters-grid" id="chapters-grid"></div>

      <div class="section-head">
        <div class="kicker">Interactive lab</div>
        <h2 class="h-section">学习模块 · 动手交互</h2>
      </div>
      <div class="mods-grid">
        <a class="card mod-card" href="#/lab"><span class="ic">🔬</span><h3>电机 3D 实验室</h3><p>6 种电机全彩 3D 模型，爆炸拆解每个部件，点击即学结构与功能。</p><span class="arrow">进入实验室 →</span></a>
        <a class="card mod-card" href="#/tree"><span class="ic">🌲</span><h3>知识树导航</h3><p>整本教材知识图谱，分支清晰可缩放，蓝色电机节点直达 3D 视图。</p><span class="arrow">展开知识树 →</span></a>
        <a class="card mod-card" href="#/lessons/2"><span class="ic">🔴</span><h3>直流电机专题</h3><p>他励直流电机的机械特性、三种起动与三种制动方式全解析。</p><span class="arrow">开始专题 →</span></a>
        <a class="card mod-card" href="#/lessons/9"><span class="ic">🚀</span><h3>交流传动专题</h3><p>V/f、FOC 矢量控制、DTC 直接转矩控制，现代传动技术核心。</p><span class="arrow">开始专题 →</span></a>
      </div>`;

    /* 章节卡片 */
    const grid = $('#chapters-grid');
    KNOWLEDGE_TREE.children.forEach((ch, ci) => {
      const m = CH_META[ci];
      const topics = topicsOf(ci);
      const done = topics.filter(t => isDone(t.id)).length;
      const pct = Math.round(done / topics.length * 100);
      const card = document.createElement('div');
      card.className = 'card chapter-card' + (pct === 100 ? ' done' : '');
      card.innerHTML = `
        <span class="no">${String(ci + 1).padStart(2, '0')}</span>
        <h3>${m.icon} ${ch.name.replace(/^第(\d+)章\s*/, '第$1章 ')}</h3>
        <div class="meta"><span class="badge b-${m.diff}">${m.dname}</span><span class="badge b-gray">${topics.length} 个知识点</span></div>
        <div class="desc">${m.desc}</div>
        <div class="ch-progress" title="${done}/${topics.length}"><i style="width:${pct}%"></i></div>
        <div class="go"><a href="#/lessons/${ci}">${pct === 100 ? '✅ 复习本章节' : (done ? '继续学习' : '开始学习')} →</a><span style="font-size:12.5px;color:var(--ink-mute);font-weight:700">${done}/${topics.length}</span></div>`;
      grid.appendChild(card);
    });

    /* HERO 3D */
    const tabs = $('#hero-tabs');
    MOTORS.forEach(id => {
      const b = document.createElement('button');
      b.className = 'motor-tab';
      b.textContent = `${MOTOR_ICONS[id] || '⚙️'} ${MOTOR_3D[id].name}`;
      b.addEventListener('click', () => switchHeroMotor(id));
      b.dataset.motor = id;
      tabs.appendChild(b);
    });
    if (!heroViewer) heroViewer = createMotorViewer($('#hero-stage'));
    heroViewer.onLoaded(n => { /* GLB 加载回调 */ });
    switchHeroMotor('dc-shunt');

    function switchHeroMotor(id) {
      $('#hero-motor-name').textContent = MOTOR_3D[id].name;
      $$('#hero-tabs .motor-tab').forEach(b => b.classList.toggle('active', b.dataset.motor === id));
      const gdef = (typeof MOTOR_GLTF !== 'undefined') && MOTOR_GLTF[id];
      let fellBack = false;
      heroViewer.onLoaded(n => { if (n < 0 && !fellBack) { fellBack = true; heroViewer.loadMotor(id); } });
      if (gdef) heroViewer.loadGLB(gdef.file, gdef);
      else heroViewer.loadMotor(id);
      heroViewer.setAutoRotate(true);
      const info = $('#hero-part-info');
      info.style.display = 'none';
    }
    heroViewer.onHover(h => {
      const tip = $('#hero-tip');
      if (!tip) return;
      if (h) { tip.style.display = 'block'; tip.textContent = h.label; tip.style.left = h.x + 'px'; tip.style.top = h.y + 'px'; }
      else tip.style.display = 'none';
    });
    heroViewer.onPartClick((key, p) => {
      const info = $('#hero-part-info');
      info.style.display = 'block';
      info.innerHTML = `<b style="color:var(--blue)">${p.label}</b> · ${p.desc}`;
    });
  }

  /* ---------- 课程页 ---------- */
  function renderLessons(ci) {
    ci = Math.max(0, Math.min(KNOWLEDGE_TREE.children.length - 1, ci || 0));
    const app = $('#app');
    const ch = KNOWLEDGE_TREE.children[ci];
    const m = CH_META[ci];
    const topics = topicsOf(ci);
    const done = topics.filter(t => isDone(t.id)).length;
    const pct = Math.round(done / topics.length * 100);

    app.innerHTML = `
      <div class="lessons-layout">
        <aside class="card ch-list" id="ch-list"></aside>
        <div>
          <div class="card lessons-head">
            <div class="kicker">Chapter ${ci + 1} / 10 · ${m.dname}</div>
            <h2>${m.icon} ${ch.name}</h2>
            <div class="row">
              <div class="big-progress"><i style="width:${pct}%"></i></div>
              <span class="badge b-gray">${done}/${topics.length} 已掌握</span>
              <span class="badge b-${m.diff}">${m.dname}</span>
            </div>
            <p style="margin-top:10px;font-size:14px;color:var(--ink-soft)">${m.desc} · 勾选左侧方框记录学习进度，点「查看讲解」看教材精讲与自测题。</p>
          </div>
          <div class="topic-list" id="topic-list"></div>
          <div style="display:flex;justify-content:space-between;margin-top:22px;flex-wrap:wrap;gap:10px">
            ${ci > 0 ? `<a class="btn" href="#/lessons/${ci - 1}">← 第${ci}章</a>` : '<span></span>'}
            ${ci < 9 ? `<a class="btn primary" href="#/lessons/${ci + 1}">下一章：${KNOWLEDGE_TREE.children[ci + 1].name} →</a>` : '<a class="btn teal" href="#/tree">🎓 学完啦 · 看知识树 →</a>'}
          </div>
        </div>
      </div>`;

    /* 侧栏 */
    const list = $('#ch-list');
    KNOWLEDGE_TREE.children.forEach((c, i) => {
      const a = document.createElement('a');
      a.href = `#/lessons/${i}`;
      a.className = i === ci ? 'active' : '';
      const dn = chapterDoneCount(i), tt = topicsOf(i).length;
      a.innerHTML = `<span class="n">${i + 1}</span><span style="flex:1">${c.name.replace(/^第\d+章\s*/, '')}</span><span style="font-size:11.5px;color:${i===ci?'#fff':'var(--ink-mute)'}">${dn}/${tt}</span>`;
      list.appendChild(a);
    });

    /* 知识点卡片 */
    const tl = $('#topic-list');
    topics.forEach(t => {
      const n = t.node;
      const short = (n.longDesc ? n.longDesc[0] : (n.desc || (n.children ? n.children.map(c => c.name).join(' · ') : ''))).slice(0, 90);
      const card = document.createElement('div');
      card.className = 'card topic-card' + (isDone(t.id) ? ' finished' : '');
      card.innerHTML = `
        <span class="tick${isDone(t.id) ? ' on' : ''}" title="标记已掌握">✓</span>
        <div class="body">
          ${t.parent ? `<div style="font-size:12px;color:var(--ink-mute);font-weight:700;margin-bottom:2px">${t.parent.name}</div>` : ''}
          <h4>${n.name}</h4>
          <div class="desc">${short}…</div>
          <div class="ops">
            <button class="btn sm learn-btn">📖 查看讲解</button>
            ${n.motor3d ? `<a class="has3d" href="#/lab/${n.motor3d}">🔬 3D 模型</a>` : ''}
            ${n.quiz ? '<span class="quiz-chip">📝 含自测题</span>' : ''}
          </div>
        </div>`;
      $('.tick', card).addEventListener('click', () => {
        progress[t.id] = !progress[t.id];
        saveProgress();
        card.classList.toggle('finished', isDone(t.id));
        $('.tick', card).classList.toggle('on', isDone(t.id));
        renderLessons(ci); // 刷新进度数字
      });
      $('.learn-btn', card).addEventListener('click', () => openTopic(t, ci));
      tl.appendChild(card);
    });
  }

  /* ---------- 电机实验室 ---------- */
  let labViewer = null;
  function renderLab(motorId) {
    motorId = MOTOR_3D[motorId] ? motorId : 'dc-shunt';
    const app = $('#app');
    const def = MOTOR_3D[motorId];
    const gdef = (typeof MOTOR_GLTF !== 'undefined') && MOTOR_GLTF[motorId];
    const loc = findMotorNode(motorId);

    app.innerHTML = `
      <div class="section-head" style="margin-top:6px">
        <div class="kicker">Motor lab · 真实 CAD 3D 交互</div>
        <h2 class="h-section">${MOTOR_ICONS[motorId] || '⚙️'} ${def.name}</h2>
        <span class="more">${loc ? `出自 ${KNOWLEDGE_TREE.children[loc.chapterIdx].name} · ${loc.node.name}` : ''}${gdef ? ` · 模型：${gdef.src}` : ''}</span>
      </div>
      <div class="lab-motor-tabs" id="lab-tabs"></div>
      <div class="lab-layout">
        <div class="card lab-stage">
          <div class="lab-canvas" id="lab-canvas">
            <div class="stage-part-tip" id="lab-tip"></div>
            <div class="stage-tip" id="lab-loading">⏳ 正在加载真实 CAD 模型（约 2~4MB）…</div>
          </div>
          <div class="lab-toolbar">
            <span class="name">${def.name}</span>
            <button class="btn sm" id="btn-explode">☸ 爆炸拆解</button>
            <span class="explode-slider">幅度<input type="range" id="explode-range" min="20" max="250" value="100"><b id="explode-val">100%</b></span>
            <button class="btn sm" id="btn-spin">🔄 自动旋转</button>
            <button class="btn sm" id="btn-resetview">↺ 复位视角</button>
          </div>
        </div>
        <aside class="card parts-panel">
          <h3>🧩 部件清单（点击查看讲解）</h3>
          ${gdef && gdef.note ? `<div class="lab-note">${gdef.note}</div>` : ''}
          <div class="parts-list" id="parts-list"></div>
          <div class="part-detail" id="part-detail"><b>未选择部件</b>点击 3D 模型或上方清单中的部件，这里显示它的结构功能讲解。</div>
        </aside>
      </div>
      <div class="card lab-relate">
        <h3>📖 相关知识点（${def.name}）</h3>
        <div class="topic-mini" id="lab-topics"></div>
      </div>`;

    /* 电机切换 tabs */
    const tabs = $('#lab-tabs');
    MOTORS.forEach(id => {
      const b = document.createElement('button');
      b.className = 'btn sm motor-tab' + (id === motorId ? ' active' : '');
      b.style.fontSize = '13.5px';
      b.textContent = `${MOTOR_ICONS[id] || '⚙️'} ${MOTOR_3D[id].name}`;
      b.addEventListener('click', () => { location.hash = `#/lab/${id}`; });
      tabs.appendChild(b);
    });

    /* 3D：优先真实 GLB，失败回退程序化模型 */
    if (labViewer) { labViewer.dispose(); labViewer = null; }
    labViewer = createMotorViewer($('#lab-canvas'));
    const loadHint = $('#lab-loading');
    let fellBack = false;
    labViewer.onLoaded(n => {
      if (n >= 0) {
        if (loadHint) loadHint.style.display = 'none';
        buildPartsList();
      } else if (!fellBack) {
        fellBack = true;
        loadHint.textContent = '⚠️ 真实模型加载失败，已切换为示意模型';
        setTimeout(() => { if (loadHint) loadHint.style.display = 'none'; }, 2500);
        labViewer.loadMotor(motorId);
        buildPartsList();
      }
    });
    if (gdef) labViewer.loadGLB(gdef.file, gdef);
    else { labViewer.loadMotor(motorId); if (loadHint) loadHint.style.display = 'none'; }
    labViewer.setAutoRotate(true);
    labViewer.onHover(h => {
      const tip = $('#lab-tip');
      if (!tip) return;
      if (h) { tip.style.display = 'block'; tip.textContent = h.label; tip.style.left = h.x + 'px'; tip.style.top = h.y + 'px'; }
      else tip.style.display = 'none';
    });
    labViewer.onPartClick((key, p) => showPart(key, p));

    function showPart(key, p) {
      labViewer.selectPart(key);
      $$('#parts-list .part-item').forEach(el => el.classList.toggle('active', el.dataset.key === key));
      $('#part-detail').innerHTML = `<b>${p.label}</b>${p.desc}`;
    }
    function buildPartsList() {
      const pl = $('#parts-list');
      if (!pl) return;
      pl.innerHTML = '';
      labViewer.getParts().forEach(pt => {
        const it = document.createElement('div');
        it.className = 'part-item';
        it.dataset.key = pt.key;
        it.innerHTML = `<span class="sw" style="background:${pt.color}"></span>${pt.label}`;
        it.addEventListener('click', () => showPart(pt.key, pt));
        pl.appendChild(it);
      });
    }

    /* 工具栏 */
    let exploded = false, spinning = true;
    const exBtn = $('#btn-explode');
    if (exBtn) exBtn.addEventListener('click', function () {
      exploded = !exploded;
      labViewer.setExplode(exploded);
      this.textContent = exploded ? '◎ 组装复位' : '☸ 爆炸拆解';
      this.classList.toggle('primary', exploded);
    });
    const exRange = $('#explode-range');
    if (exRange) exRange.addEventListener('input', function () {
      const f = this.value / 100;
      $('#explode-val').textContent = this.value + '%';
      labViewer.setExplodeFactor(f);
      if (!exploded && f > 0) { exploded = true; labViewer.setExplode(true); if (exBtn) { exBtn.textContent = '◎ 组装复位'; exBtn.classList.add('primary'); } }
    });
    $('#btn-spin').addEventListener('click', function () {
      spinning = !spinning;
      labViewer.setAutoRotate(spinning);
      this.textContent = spinning ? '🔄 自动旋转' : '⏸ 已暂停';
    });
    $('#btn-resetview').addEventListener('click', () => {
      labViewer.resetView();
      labViewer.setAutoRotate(true); spinning = true;
      $('#btn-spin').textContent = '🔄 自动旋转';
    });

    /* 相关知识点：该电机节点本身 + 其兄弟/子节点 */
    const rel = $('#lab-topics');
    if (loc) {
      const related = [];
      if (loc.node.children) loc.node.children.forEach((st, si) => related.push({ id: null, node: st, ci: loc.chapterIdx }));
      else related.push({ id: null, node: loc.node, ci: loc.chapterIdx });
      related.push({ id: null, node: { name: `${KNOWLEDGE_TREE.children[loc.chapterIdx].name} 全章知识点`, quiz: null, longDesc: null }, ci: loc.chapterIdx, linkAll: true });
      related.forEach(r => {
        const b = document.createElement('button');
        b.textContent = r.linkAll ? `📚 ${r.node.name}` : `💡 ${r.node.name}`;
        b.addEventListener('click', () => {
          if (r.linkAll) { location.hash = `#/lessons/${r.ci}`; return; }
          openModal(`${CH_META[r.ci].icon} ${r.node.name}`, `
            ${(r.node.longDesc || []).map(p => `<p>${p}</p>`).join('') || `<p>${r.node.desc || ''}</p>`}
            ${r.node.img ? `<img src="${r.node.img}">` : ''}
            ${r.node.quiz ? `<div class="quiz-box"><div class="q-t">📝 自测：${r.node.quiz.q}</div><details><summary>查看答案</summary><div class="ans">${r.node.quiz.a}</div></details></div>` : ''}`);
        });
        rel.appendChild(b);
      });
    }
  }

  /* ---------- 知识树（指针事件版思维导图） ---------- */
  function renderTree() {
    const app = $('#app');
    app.innerHTML = `
      <div class="section-head" style="margin-top:6px">
        <div class="kicker">Knowledge tree · 全书图谱</div>
        <h2 class="h-section">🌲 机电传动控制知识树</h2>
        <span class="more">拖拽平移 · 滚轮/双指缩放 · 点击节点看讲解 · <b style="color:var(--teal)">青色电机节点</b>进入 3D 实验室</span>
      </div>
      <div class="tree-wrap">
        <div id="mm-viewport"><div id="mm-canvas"></div></div>
        <div class="tree-toolbar">
          <button class="btn sm" id="tree-fit">⤢ 合适大小</button>
          <button class="btn sm" id="tree-plus">＋</button>
          <button class="btn sm" id="tree-minus">－</button>
        </div>
        <div class="tree-legend">
          <span class="k"><span class="dot2" style="background:linear-gradient(135deg,#165dff,#0f3fa8)"></span>课程</span>
          <span class="k"><span class="dot2" style="background:#1f3a68"></span>章节</span>
          <span class="k"><span class="dot2" style="background:var(--teal)"></span>电机（可 3D）</span>
          <span class="k"><span class="dot2" style="background:#fff"></span>知识点</span>
        </div>
      </div>`;

    const viewport = $('#mm-viewport');
    const canvas = $('#mm-canvas');
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'mm-svg');
    const nodeLayer = document.createElement('div');
    nodeLayer.id = 'mm-nodes';
    canvas.appendChild(svg);
    canvas.appendChild(nodeLayer);

    const H_GAP = 250, V_GAP = 34, NODE_H = 32;
    function measure(node) {
      if (!node.children || !node.children.length) { node._h = NODE_H; return NODE_H; }
      let h = 0;
      node.children.forEach(c => { h += measure(c) + V_GAP; });
      node._h = Math.max(h - V_GAP, NODE_H);
      return node._h;
    }
    function layout(node, x, yTop, dir) {
      node._x = x; node._y = yTop + node._h / 2;
      if (!node.children || !node.children.length) return;
      let y = yTop;
      node.children.forEach(c => { layout(c, x + dir * H_GAP, y, dir); y += c._h + V_GAP; });
    }

    const chapters = KNOWLEDGE_TREE.children;
    const leftCh = chapters.slice(0, 5), rightCh = chapters.slice(5);
    leftCh.forEach(c => measure(c)); rightCh.forEach(c => measure(c));
    const leftTotal = leftCh.reduce((s, c) => s + c._h + V_GAP, 0) - V_GAP;
    const rightTotal = rightCh.reduce((s, c) => s + c._h + V_GAP, 0) - V_GAP;
    const maxTotal = Math.max(leftTotal, rightTotal);
    let ys = -maxTotal / 2;
    leftCh.forEach(c => { layout(c, -H_GAP, ys, -1); ys += c._h + V_GAP; });
    ys = -maxTotal / 2;
    rightCh.forEach(c => { layout(c, H_GAP, ys, 1); ys += c._h + V_GAP; });
    KNOWLEDGE_TREE._x = 0; KNOWLEDGE_TREE._y = 0;

    /* 渲染节点 */
    function renderNode(node, kind) {
      const el = document.createElement('div');
      el.className = 'mm-node' + (kind ? ' ' + kind : '');
      el.style.left = node._x + 'px';
      el.style.top = node._y + 'px';
      el.textContent = node.name;
      el.addEventListener('click', e => {
        e.stopPropagation();
        if (node.motor3d) { location.hash = `#/lab/${node.motor3d}`; return; }
        const ci = chapters.indexOf(node._chapter);
        if (node.longDesc || node.desc) {
          openModal(node.name, `
            ${(node.longDesc || []).map(p => `<p>${p}</p>`).join('') || `<p>${node.desc}</p>`}
            ${node.img ? `<img src="${node.img}">` : ''}
            ${node.quiz ? `<div class="quiz-box"><div class="q-t">📝 自测：${node.quiz.q}</div><details><summary>查看答案</summary><div class="ans">${node.quiz.a}</div></details></div>` : ''}`);
        } else if (ci >= 0) location.hash = `#/lessons/${ci}`;
      });
      nodeLayer.appendChild(el);
      if (node.children) node.children.forEach(c => renderNode(c, ''));
    }
    renderNode(KNOWLEDGE_TREE, 'root');
    leftCh.forEach(c => { c._chapter = c; renderNode(c, 'chapter'); c.children.forEach(t => { t._chapter = c; renderNode(t, t.motor3d ? 'motor' : ''); if (t.children) t.children.forEach(st => { st._chapter = c; renderNode(st, st.motor3d ? 'motor' : ''); }); }); });
    rightCh.forEach(c => { c._chapter = c; renderNode(c, 'chapter'); c.children.forEach(t => { t._chapter = c; renderNode(t, t.motor3d ? 'motor' : ''); if (t.children) t.children.forEach(st => { st._chapter = c; renderNode(st, st.motor3d ? 'motor' : ''); }); }); });

    /* 连线 */
    function drawLines(node, parent) {
      if (!parent) return;
      const x1 = parent._x, y1 = parent._y, x2 = node._x, y2 = node._y;
      const dx = (x2 - x1) / 2;
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`);
      path.setAttribute('stroke', '#3a5a8c');
      path.setAttribute('stroke-opacity', '0.32');
      path.setAttribute('stroke-width', '1.6');
      path.setAttribute('fill', 'none');
      svg.appendChild(path);
      if (node.children) node.children.forEach(c => drawLines(c, node));
    }
    leftCh.forEach(c => drawLines(c, KNOWLEDGE_TREE));
    rightCh.forEach(c => drawLines(c, KNOWLEDGE_TREE));

    /* 平移缩放（Pointer Events，支持触屏双指） */
    let tx = viewport.clientWidth / 2, ty = viewport.clientHeight / 2, scale = 0.8;
    function apply() {
      canvas.style.transformOrigin = '0 0';
      canvas.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    }
    const pointers = new Map();
    let lastDist = 0, lastMid = null, panning = false;
    viewport.addEventListener('pointerdown', e => {
      if (e.target.closest('.mm-node') || e.target.closest('button')) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      viewport.setPointerCapture(e.pointerId);
      panning = pointers.size === 1;
      viewport.style.cursor = 'grabbing';
    });
    viewport.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) return;
      const prev = pointers.get(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1 && panning) {
        tx += e.clientX - prev.x; ty += e.clientY - prev.y; apply();
      } else if (pointers.size === 2) {
        const pts = [...pointers.values()];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
        if (lastDist) {
          const factor = dist / lastDist;
          const newScale = Math.max(0.25, Math.min(2.5, scale * factor));
          scale = newScale;
          if (lastMid) { tx += mid.x - lastMid.x; ty += mid.y - lastMid.y; }
          apply();
        }
        lastDist = dist; lastMid = mid;
      }
    });
    const endPointer = e => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) { lastDist = 0; lastMid = null; }
      if (!pointers.size) { panning = false; viewport.style.cursor = 'grab'; }
    };
    viewport.addEventListener('pointerup', endPointer);
    viewport.addEventListener('pointercancel', endPointer);
    viewport.addEventListener('wheel', e => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const rect = viewport.getBoundingClientRect();
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
      const newScale = Math.max(0.25, Math.min(2.5, scale * factor));
      tx = cx - (cx - tx) * (newScale / scale);
      ty = cy - (cy - ty) * (newScale / scale);
      scale = newScale;
      apply();
    }, { passive: false });
    viewport.style.cursor = 'grab';

    /* 工具按钮 */
    const fit = () => { scale = Math.min(0.9, (viewport.clientHeight - 60) / maxTotal); tx = viewport.clientWidth / 2; ty = viewport.clientHeight / 2; apply(); };
    $('#tree-fit').addEventListener('click', fit);
    $('#tree-plus').addEventListener('click', () => { scale = Math.min(2.5, scale * 1.2); apply(); });
    $('#tree-minus').addEventListener('click', () => { scale = Math.max(0.25, scale / 1.2); apply(); });
    setTimeout(fit, 50);
    new ResizeObserver(() => apply()).observe(viewport);
  }

  /* ---------- 路由 ---------- */
  function setActiveNav(key) {
    $$('.nav a').forEach(a => a.classList.toggle('active', a.dataset.nav === key));
  }
  function route() {
    closeModal();
    const hash = location.hash || '#/';
    const parts = hash.replace(/^#\//, '').split('/');
    if (heroViewer && parts[0] !== '') { heroViewer.dispose(); heroViewer = null; }
    if (parts[0] === '' || parts[0] === 'index.html') { setActiveNav('home'); renderHome(); }
    else if (parts[0] === 'lessons') { setActiveNav('lessons'); renderLessons(parseInt(parts[1]) || 0); }
    else if (parts[0] === 'lab') { setActiveNav('lab'); renderLab(parts[1]); }
    else if (parts[0] === 'tree') { setActiveNav('tree'); renderTree(); }
    else { setActiveNav('home'); renderHome(); }
    window.scrollTo(0, 0);
  }

  /* ---------- AI 助教 ---------- */
  const KB = [];
  (function collectKB() {
    const chapters = KNOWLEDGE_TREE.children;
    chapters.forEach((ch, ci) => {
      const add = (node) => {
        let text = node.desc || '';
        if (node.longDesc) text += ' ' + node.longDesc.join(' ');
        if (text) KB.push({ title: node.name, text, chapter: ch.name });
        (node.children || []).forEach(add);
      };
      add(ch);
    });
  })();

  function renderMath(html) {
    if (typeof katex === 'undefined') return html;
    const r = (tex, display) => {
      try { return katex.renderToString(tex.trim(), { displayMode: display, throwOnError: false }); } catch (e) { return null; }
    };
    html = html.replace(/\\\[([\s\S]+?)\\\]/g, (m, tex) => r(tex, true) || m);
    html = html.replace(/\\\(([\s\S]+?)\\\)/g, (m, tex) => r(tex, false) || m);
    html = html.replace(/\$\$([\s\S]+?)\$\$/g, (m, tex) => r(tex, true) || m);
    html = html.replace(/\$([^\$\n]+?)\$/g, (m, tex) => r(tex, false) || m);
    return html;
  }
  function renderMathInEl(el) {
    if (!el || typeof katex === 'undefined') return;
    el.innerHTML = renderMath(el.innerHTML);
  }

  function initChatbot() {
    const root = $('#chatbot-root');
    root.innerHTML = `
      <button id="chatbot-fab" title="AI 助教">🤖</button>
      <div id="chatbot-panel">
        <div class="cb-header">
          <span class="bot-ic">🤖</span>
          <div><div class="t">机电传动 · AI 助教</div><div class="s">已接入大模型 · 免配置直接问</div></div>
          <div class="ops">
            <button id="cb-fs" title="放大">⛶</button>
            <button id="cb-close" title="关闭">✕</button>
          </div>
        </div>
        <div class="cb-tabs">
          <button class="cb-tab active" data-mode="llm">🤖 AI 答疑（大模型）</button>
          <button class="cb-tab" data-mode="local">📖 教材知识库（离线）</button>
        </div>
        <div class="cb-config" style="display:none">
          <div class="hint">AI 直连公共大模型（openai-fast，免 Key），免费额度约 30 秒 1 问；限流时自动用教材知识库回答。「高级」可改用自己的接口（Key 仅存本机）。</div>
          <input type="text" id="cfg-base" placeholder="自定义 Base URL（留空用默认）">
          <input type="password" id="cfg-key" placeholder="自定义 API Key（可选）">
          <input type="text" id="cfg-model" placeholder="自定义模型名（可选）">
          <button id="cfg-save">保存自定义配置</button>
        </div>
        <div class="cb-messages" id="cb-messages">
          <div class="cb-msg bot">你好！我是你的机电传动控制 AI 助教 🤖 <b>已接入大模型，无需任何配置</b>，直接提问即可。<br><br>支持：概念讲解 · 公式推导 · 例题演算 · 复习出题<br><span style="font-size:11.5px;color:var(--ink-mute)">（免费接口限流时会自动切换教材知识库回答）</span></div>
          <div class="cb-quick" id="cb-quick">
            <button>三相异步电机怎么启动？</button>
            <button>直流电机调速方法？</button>
            <button>FOC矢量控制原理</button>
            <button>步距角公式</button>
            <button>Y-Δ启动为什么转矩降为1/3？</button>
            <button>伺服系统三环控制</button>
            <button>帮我出3道制动方式选择题</button>
          </div>
        </div>
        <div class="cb-attached" id="cb-attached" style="display:none"></div>
        <div class="cb-input">
          <input type="text" id="cb-input" placeholder="输入你的问题…">
          <button class="send" id="cb-send">发送 ➤</button>
        </div>
      </div>`;

    const fab = $('#chatbot-fab'), panel = $('#chatbot-panel');
    const open = () => { panel.classList.add('open'); fab.style.display = 'none'; $('#cb-input').focus(); };
    const close = () => { panel.classList.remove('open'); fab.style.display = 'flex'; };
    fab.addEventListener('click', open);
    $('#nav-ai').addEventListener('click', open);
    $('#cb-close').addEventListener('click', close);
    $('#cb-fs').addEventListener('click', () => panel.classList.toggle('fullscreen'));

    const input = $('#cb-input'), sendBtn = $('#cb-send'), msgBox = $('#cb-messages'), quickBox = $('#cb-quick'), configBox = $('.cb-config');
    let mode = 'llm';
    let lastLLMAt = 0;           // 限流节流（免费接口 30s/次）
    const history = [];          // 大模型对话历史（最近几轮）

    $$('.cb-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        $$('.cb-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        mode = tab.dataset.mode;
        configBox.style.display = 'none';
        quickBox.style.display = 'flex';
      });
    });
    /* 高级：双击"AI 答疑"标签展开自定义配置 */
    let advTimer = null;
    $('.cb-tab[data-mode=llm]').addEventListener('dblclick', () => {
      configBox.style.display = configBox.style.display === 'none' ? 'block' : 'none';
    });

    const saved = (() => { try { return JSON.parse(localStorage.getItem('llm_cfg') || '{}'); } catch (e) { return {}; } })();
    $('#cfg-base').value = saved.base || '';
    $('#cfg-key').value = saved.key || '';
    $('#cfg-model').value = saved.model || '';
    $('#cfg-save').addEventListener('click', () => {
      localStorage.setItem('llm_cfg', JSON.stringify({
        base: $('#cfg-base').value.trim(), key: $('#cfg-key').value.trim(), model: $('#cfg-model').value.trim()
      }));
      addMsg('✅ 已保存自定义接口，之后优先使用它。', 'bot');
    });

    function addMsg(text, who) {
      const div = document.createElement('div');
      div.className = 'cb-msg ' + who;
      const fileRe = /\[FILE:([^\]]+)\]([\s\S]*?)\[\/FILE\]/g;
      const files = [];
      text = text.replace(fileRe, (m, name, content) => { files.push({ name, content }); return ''; });
      /* 简易 markdown：表格 / 加粗 / 列表 */
      let html = text
        .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
        .replace(/^###?\s*(.+)$/gm, '<b style="display:block;margin-top:6px">$1</b>')
        .replace(/^\s*[-*]\s+/gm, '• ');
      const tableRe = /((?:^\|.*\|\s*$\n?)+)/gm;
      html = html.replace(tableRe, (block) => {
        const rows = block.trim().split('\n').map(r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
        if (rows.length < 2) return block;
        const body = rows.filter(r => !/^[-: ]+$/.test(r[0]));
        let t = '<table><thead><tr>' + body[0].map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>';
        body.slice(1).forEach(r => { t += '<tr>' + r.map(c => `<td>${c}</td>`).join('') + '</tr>'; });
        return t + '</tbody></table>';
      });
      html = renderMath(html.replace(/\n/g, '<br>')).replace(/(<\/table>)<br>/g, '$1').replace(/<br>(<table>)/g, '$1');
      div.innerHTML = html;
      files.forEach(f => {
        const blob = new Blob([f.content], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = f.name;
        a.className = 'cb-file-link';
        a.textContent = `📥 下载 ${f.name}`;
        div.appendChild(document.createElement('br'));
        div.appendChild(a);
      });
      msgBox.appendChild(div);
      msgBox.scrollTop = msgBox.scrollHeight;
      return div;
    }

    function askLocal(q) {
      const qNorm = q.toLowerCase().replace(/[?？。，、！\s]/g, '');
      const scored = KB.map(item => {
        const text = (item.title + ' ' + item.text).toLowerCase();
        const title = item.title.toLowerCase();
        let score = 0;
        for (let i = 0; i < qNorm.length - 1; i++) {
          const bg = qNorm.substr(i, 2);
          if (text.includes(bg)) score++;
          if (title.includes(bg)) score += 3;
        }
        if (title.includes(qNorm)) score += 8;
        return { item, score };
      }).filter(x => x.score > 1).sort((a, b) => b.score - a.score);
      if (!scored.length || scored[0].score < 2) {
        addMsg('这个问题教材知识库没有直接覆盖 😥 你可以：<br>· 换个问法（如“直流电机 调速”）<br>· 切到「🤖 AI 答疑」标签问大模型', 'bot');
        return;
      }
      const top = scored.slice(0, 3);
      let reply = '<b>📖 教材知识库：</b>';
      top.forEach(s => { reply += `<br><br><b style="color:var(--red)">▸ ${s.item.title}</b><br>${s.item.text.slice(0, 260)}…`; });
      reply += `<br><br><span style="color:var(--ink-mute);font-size:11.5px">—— 出自：${[...new Set(top.map(s => s.chapter))].slice(0, 3).join('、')}</span>`;
      addMsg(reply, 'bot');
    }

    async function askLLM(q) {
      const cfg = (() => { try { return JSON.parse(localStorage.getItem('llm_cfg') || '{}'); } catch (e) { return {}; } })();
      const useCustom = !!(cfg.base && cfg.key && cfg.model);
      const url = useCustom
        ? cfg.base.replace(/\/$/, '') + '/chat/completions'
        : 'https://text.pollinations.ai/openai';
      const headers = { 'Content-Type': 'application/json' };
      if (useCustom) headers['Authorization'] = 'Bearer ' + cfg.key;
      /* 免费直连接口 30 秒 1 次限流 */
      if (!useCustom) {
        const wait = 31 - Math.round((Date.now() - lastLLMAt) / 1000);
        if (wait > 0) {
          addMsg(`⏳ 免费大模型接口每 30 秒限答 1 次，还需等 ${wait}s。先用📖教材知识库回答：<br><br>`, 'bot');
          askLocal(q);
          return;
        }
      }
      const sys = '你是《机电传动控制》（第六版，陈冰、冯清秀、邓星钟等编著）课程助教。用中文回答：准确、条理清晰、适当分点。公式用 $...$ 行内或 $$...$$ 块级 LaTeX。回答末尾如适用，附 1 道自测题。';
      const msgs = [{ role: 'system', content: sys }, ...history.slice(-6), { role: 'user', content: q }];
      const t = addMsg('🤔 AI 思考中…（免费接口较慢，约 10~60 秒，请稍候）', 'bot');
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ model: useCustom ? cfg.model : 'openai-fast', messages: msgs, temperature: 0.3 })
        });
        let d = null;
        try { d = await r.json(); } catch (e) { d = null; }
        t.remove();
        if (!r.ok || !d || !d.choices) {
          const lim = r.status === 402 || r.status === 429 || (d && String(d.error && d.error.code).includes('LIMIT'));
          addMsg(lim
            ? '⏳ 免费大模型接口限流中（约 30 秒 1 问），已自动切换教材知识库：<br><br>'
            : '⚠️ 大模型接口暂不可用，已切换教材知识库：<br><br>', 'bot');
          askLocal(q);
          return;
        }
        const ans = d.choices[0].message.content || '(空)';
        history.push({ role: 'user', content: q }, { role: 'assistant', content: ans });
        if (!useCustom) lastLLMAt = Date.now();
        addMsg(ans, 'bot');
      } catch (e) {
        t.remove();
        addMsg('⚠️ 网络请求失败（' + e.message + '），已切换教材知识库：<br><br>', 'bot');
        askLocal(q);
      }
    }

    function ask(q) { addMsg(q, 'user'); mode === 'local' ? askLocal(q) : askLLM(q); }
    sendBtn.addEventListener('click', () => { const v = input.value.trim(); if (v) { ask(v); input.value = ''; } });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { const v = input.value.trim(); if (v) { ask(v); input.value = ''; } } });
    $$('#cb-quick button').forEach(b => b.addEventListener('click', () => ask(b.textContent)));
  }

  /* ---------- 启动 ---------- */
  window.addEventListener('hashchange', route);
  document.addEventListener('DOMContentLoaded', () => {
    initChatbot();
    route();
    refreshTopProgress();
  });
})();

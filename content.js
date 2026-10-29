/* ============================================================
 * 知识点富内容库：图表生成器 + 扩展讲解（配合 KaTeX 渲染）
 * TOPIC_RICH[topicId] = { formula, paras[], table, chart }
 * ============================================================ */

/* ---------- 通用 SVG 图表生成器 ---------- */
const ChartSVG = (function () {
  const AX = '#3a5a8c', GRID = '#e3eaf4', INK = '#3f5470';
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  /* 折线图：series=[{name,color,pts:[[x,y]...],dash}], cfg={xMax,yMax,xLabel,yLabel,xTicks,yTicks,marks,hlines,vlines,vLabel} */
  function line(cfg) {
    const W = 640, H = 330, M = 46, R = 14;
    const pw = W - M - 16, ph = H - M - 34;
    const xm = cfg.xMax || 10, ym = cfg.yMax || 10;
    const X = v => M + (v / xm) * pw;
    const Y = v => M + ph - (v / ym) * ph;
    let s = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;background:#fff;border:1px solid #d9e2ee;border-radius:10px" font-family="inherit">`;
    // 网格与刻度
    const xt = cfg.xTicks || 5, yt = cfg.yTicks || 4;
    for (let i = 0; i <= xt; i++) {
      const v = xm * i / xt;
      s += `<line x1="${X(v)}" y1="${M}" x2="${X(v)}" y2="${M + ph}" stroke="${GRID}"/>`;
      s += `<text x="${X(v)}" y="${M + ph + 16}" font-size="11" fill="${INK}" text-anchor="middle">${cfg.xFmt ? cfg.xFmt(v) : Math.round(v * 10) / 10}</text>`;
    }
    for (let i = 0; i <= yt; i++) {
      const v = ym * i / yt;
      s += `<line x1="${M}" y1="${Y(v)}" x2="${M + pw}" y2="${Y(v)}" stroke="${GRID}"/>`;
      s += `<text x="${M - 6}" y="${Y(v) + 4}" font-size="11" fill="${INK}" text-anchor="end">${cfg.yFmt ? cfg.yFmt(v) : Math.round(v * 10) / 10}</text>`;
    }
    s += `<line x1="${M}" y1="${M + ph}" x2="${M + pw}" y2="${M + ph}" stroke="${AX}" stroke-width="1.6"/>`;
    s += `<line x1="${M}" y1="${M}" x2="${M}" y2="${M + ph}" stroke="${AX}" stroke-width="1.6"/>`;
    if (cfg.xLabel) s += `<text x="${M + pw / 2}" y="${H - 4}" font-size="12" fill="${AX}" text-anchor="middle" font-weight="700">${esc(cfg.xLabel)}</text>`;
    if (cfg.yLabel) s += `<text x="14" y="${M + ph / 2}" font-size="12" fill="${AX}" text-anchor="middle" font-weight="700" transform="rotate(-90 14 ${M + ph / 2})">${esc(cfg.yLabel)}</text>`;
    // 参考线
    (cfg.hlines || []).forEach(h => { s += `<line x1="${M}" y1="${Y(h.y)}" x2="${M + pw}" y2="${Y(h.y)}" stroke="${h.color || '#b3413a'}" stroke-dasharray="5 4" stroke-width="1.2"/>`; if (h.label) s += `<text x="${M + pw - 4}" y="${Y(h.y) - 5}" font-size="11" fill="${h.color || '#b3413a'}" text-anchor="end">${esc(h.label)}</text>`; });
    (cfg.vlines || []).forEach(v => { s += `<line x1="${X(v.x)}" y1="${M}" x2="${X(v.x)}" y2="${M + ph}" stroke="${v.color || '#0d7a83'}" stroke-dasharray="5 4" stroke-width="1.2"/>`; if (v.label) s += `<text x="${X(v.x) + 5}" y="${M + 12}" font-size="11" fill="${v.color || '#0d7a83'}">${esc(v.label)}</text>`; });
    // 曲线
    (cfg.series || []).forEach(se => {
      const d = se.pts.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join(' ');
      s += `<path d="${d}" fill="none" stroke="${se.color}" stroke-width="2.4" ${se.dash ? `stroke-dasharray="${se.dash}"` : ''}/>`;
    });
    // 标注点
    (cfg.marks || []).forEach(mk => {
      s += `<circle cx="${X(mk.x)}" cy="${Y(mk.y)}" r="4" fill="${mk.color || '#d9433a'}" stroke="#fff" stroke-width="1.5"/>`;
      if (mk.label) s += `<text x="${X(mk.x) + (mk.dx || 8)}" y="${Y(mk.y) + (mk.dy || -8)}" font-size="12" fill="${mk.color || '#b3413a'}" font-weight="700">${esc(mk.label)}</text>`;
    });
    // 图例
    const lg = (cfg.series || []).filter(se => se.name);
    lg.forEach((se, i) => {
      const lx = M + 10, ly = M + 16 + i * 18;
      s += `<line x1="${lx}" y1="${ly}" x2="${lx + 22}" y2="${ly}" stroke="${se.color}" stroke-width="3" ${se.dash ? `stroke-dasharray="${se.dash}"` : ''}/>`;
      s += `<text x="${lx + 28}" y="${ly + 4}" font-size="12" fill="${INK}">${esc(se.name)}</text>`;
    });
    return s + '</svg>';
  }

  /* 块图（流程/控制框图）：blocks=[{x,y,w,h,t,c},...], arrows=[{x1,y1,x2,y2,t,label}] */
  function blocks(cfg) {
    let s = `<svg viewBox="${cfg.viewBox || '0 0 640 300'}" style="width:100%;background:#fff;border:1px solid #d9e2ee;border-radius:10px" font-family="inherit">`;
    (cfg.arrows || []).forEach(a => {
      s += `<line x1="${a.x1}" y1="${a.y1}" x2="${a.x2}" y2="${a.y2}" stroke="${a.color || AX}" stroke-width="1.8" marker-end="url(#arrw)" ${a.dash ? `stroke-dasharray="${a.dash}"` : ''}/>`;
      if (a.label) s += `<text x="${(a.x1 + a.x2) / 2}" y="${(a.y1 + a.y2) / 2 - 6}" font-size="11.5" fill="${a.color || AX}" text-anchor="middle" font-weight="600">${esc(a.label)}</text>`;
    });
    (cfg.blocks || []).forEach(b => {
      s += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="8" fill="${b.c || '#e3ecff'}" stroke="${b.sc || AX}" stroke-width="1.6"/>`;
      const lines = String(b.t).split('\n');
      lines.forEach((ln, i) => {
        s += `<text x="${b.x + b.w / 2}" y="${b.y + b.h / 2 + 4 + (i - (lines.length - 1) / 2) * 15}" font-size="${b.fs || 12.5}" fill="${b.tc || '#1c2b3a'}" text-anchor="middle" font-weight="700">${esc(ln)}</text>`;
      });
    });
    return s + '</svg>';
  }

  const ARROW_DEFS = `<defs><marker id="arrw" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto"><polygon points="0 0, 9 3.5, 0 7" fill="#3a5a8c"/></marker></defs>`;

  function wrap(inner, vb) { return `<svg viewBox="${vb || '0 0 640 300'}" style="width:100%;background:#fff;border:1px solid #d9e2ee;border-radius:10px" font-family="inherit">${ARROW_DEFS}${inner}</svg>`; }

  /* ============ 定制图表 ============ */
  const custom = {
    /* 直流他励固有+人为机械特性 */
    mechDC() {
      const n0 = 1500, pts = f => [[0, n0 * f.k], [f.k * n0 * 0.18, n0 * f.k * 0.6]];
      return line({
        xMax: 4, yMax: 2000, xLabel: '电磁转矩 T (×TN)', yLabel: '转速 n (r/min)',
        series: [
          { name: '固有特性（U_N, Φ_N）', color: '#0f3fa8', pts: [[0, 1500], [3.5, 1350]] },
          { name: '降压调速（U↓ 特性平行下移）', color: '#0d7a83', pts: [[0, 1000], [3.5, 880]], dash: '6 4' },
          { name: '电枢串电阻（特性变软）', color: '#e8743b', pts: [[0, 1500], [3.5, 700]], dash: '6 4' },
          { name: '弱磁调速（n₀ 升高）', color: '#b3413a', pts: [[0, 1900], [3.5, 1650]], dash: '6 4' }
        ],
        marks: [{ x: 0, y: 1500, label: '理想空载 n₀', dx: 10 }, { x: 2, y: 1440, label: '额定工作点', dy: 16 }]
      });
    },
    /* 负载特性三类型 */
    loadTypes() {
      const hy = x => 4200 / Math.max(x, 0.4);      // 恒功率双曲线
      const fan = x => 0.14 * x * x;                 // 风机类
      const ct = [], cp = [], fq = [];
      for (let x = 0; x <= 10; x += 0.25) { ct.push([x, 5]); if (x >= 0.5) cp.push([x, hy(x)]); fq.push([x, fan(x)]); }
      return line({
        xMax: 10, yMax: 12, xLabel: '转速 n', yLabel: '负载转矩 T_L',
        series: [
          { name: '恒转矩负载（起重机/传送带）', color: '#0f3fa8', pts: ct },
          { name: '恒功率负载（机床主切削）', color: '#e8743b', pts: cp },
          { name: '风机泵类负载 T∝n²（P∝n³）', color: '#0d7a83', pts: fq }
        ]
      });
    },
    /* 稳定运行交点 */
    stablePoint() {
      return line({
        xMax: 10, yMax: 12, xLabel: '转速 n', yLabel: '转矩 T',
        series: [
          { name: '电动机机械特性（硬）', color: '#0f3fa8', pts: [[0, 9.2], [10, 7.4]] },
          { name: '恒转矩负载', color: '#e8743b', pts: [[0, 5], [10, 5]] }
        ],
        marks: [{ x: 5.3, y: 8.2, label: '稳定交点（扰动可自动回归）', dy: 20, dx: -130 }]
      });
    },
    /* 异步电机 T-s 曲线 */
    slipTorque() {
      const T = s => 2 * 2.6 / (s / 0.18 + 0.18 / s); // Tm=2.6, sm=0.18 近似公式
      const pts = [];
      for (let s = 1; s >= 0.005; s -= 0.008) pts.push([1 - s, T(s)]);
      return line({
        xMax: 1, yMax: 3.4, xLabel: '转速 n（标幺，1 = 同步转速 n₁）', yLabel: '电磁转矩 T (×T_N)',
        xFmt: v => v.toFixed(1), yFmt: v => v.toFixed(1),
        series: [
          { name: 'T–s 机械特性（稳定区 s: 0~s_m）', color: '#0f3fa8', pts: pts },
          { name: '稳定运行区边界', color: '#b3413a', pts: [[0.82, 0], [0.82, 2.6]], dash: '5 5' }
        ],
        marks: [
          { x: 0, y: 2.0, label: '起动转矩 T_st (n=0, s=1)', dy: 22 },
          { x: 0.82, y: 2.6, label: '最大转矩 T_m（λ≈2.2）', dx: -150, dy: -10 },
          { x: 0.965, y: 1.0, label: '额定工作点 (s_N≈0.035)', dy: 22 }
        ]
      });
    },
    /* 旋转磁场 */
    rotatingField() {
      const w = ` <text x="320" y="26" font-size="13.5" font-weight="800" fill="#0f3fa8" text-anchor="middle">三相对称电流 → 合成旋转磁场（n₁ = 60f/p）</text>`;
      const axes = `<line x1="60" y1="120" x2="360" y2="120" stroke="#3a5a8c" stroke-width="1.4"/><line x1="60" y1="60" x2="60" y2="180" stroke="#3a5a8c" stroke-width="1.4"/><text x="365" y="124" font-size="11" fill="#3f5470">ωt</text>`;
      const curves = ['#d9433a', '#0d7a83', '#e8a13a'].map((c, k) => {
        let d = '';
        for (let x = 0; x <= 300; x += 3) {
          const y = 120 - 45 * Math.sin((x / 300) * 2 * Math.PI - k * 2 * Math.PI / 3);
          d += (x ? 'L' : 'M') + (60 + x) + ' ' + y.toFixed(1) + ' ';
        }
        return `<path d="${d}" fill="none" stroke="${c}" stroke-width="2.2"/>`;
      }).join('');
      const labels = `<text x="140" y="205" font-size="12" fill="#d9433a" font-weight="700">i_U = Im·sin(ωt)</text><text x="255" y="205" font-size="12" fill="#0d7a83" font-weight="700">i_V（滞后120°）</text><text x="365" y="205" font-size="12" fill="#e8a13a" font-weight="700">i_W（滞后240°）</text>`;
      // 右侧旋转矢量
      const cx = 480, cy = 108, r = 62;
      const vecs = [[0, '#d9433a', 'U'], [-120, '#0d7a83', 'V'], [-240, '#e8a13a', 'W']];
      const arrows = vecs.map(([deg, c]) => {
        const rad = deg * Math.PI / 180;
        const x2 = cx + r * Math.cos(rad), y2 = cy - r * Math.sin(rad);
        return `<line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${c}" stroke-width="2.6" marker-end="url(#arrw2)"/>`;
      }).join('');
      const circle = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#b9c8de" stroke-dasharray="4 4"/><path d="M ${cx + r + 14} ${cy - 12} A 20 20 0 0 0 ${cx + r + 10} ${cy + 12}" fill="none" stroke="#0f3fa8" stroke-width="2" marker-end="url(#arrw)"/><text x="480" y="205" font-size="12" fill="#0f3fa8" font-weight="700" text-anchor="middle">合成磁场 ω₁ 逆时针旋转</text>`;
      return wrap(w + axes + curves + labels + arrows + circle, '0 0 640 220');
    },
    /* Y-Δ 起动接线 */
    yDelta() {
      const tri = (cx, cy, r, c, lab) => {
        const a = 90, b = 210, g2 = 330;
        const p = deg => [cx + r * Math.cos(deg * Math.PI / 180), cy - r * Math.sin(deg * Math.PI / 180)];
        const [x1, y1] = p(a), [x2, y2] = p(b), [x3, y3] = p(g2);
        return `<polygon points="${x1},${y1} ${x2},${y2} ${x3},${y3}" fill="none" stroke="${c}" stroke-width="2.4"/>` +
          `<text x="${x1}" y="${y1 - 8}" font-size="12" fill="${c}" text-anchor="middle" font-weight="700">${lab}</text>`;
      };
      const star = (cx, cy, r, c, lab) => {
        const p = deg => [cx + r * Math.cos(deg * Math.PI / 180), cy - r * Math.sin(deg * Math.PI / 180)];
        const [x1, y1] = p(90), [x2, y2] = p(210), [x3, y3] = p(330);
        return `<line x1="${x1}" y1="${y1}" x2="${cx}" y2="${cy}" stroke="${c}" stroke-width="2.4"/><line x1="${x2}" y1="${y2}" x2="${cx}" y2="${cy}" stroke="${c}" stroke-width="2.4"/><line x1="${x3}" y1="${y3}" x2="${cx}" y2="${cy}" stroke="${c}" stroke-width="2.4"/>` +
          `<text x="${cx}" y="${cy + 28}" font-size="12" fill="${c}" text-anchor="middle" font-weight="700">${lab}</text>`;
      };
      const body = `<text x="160" y="34" font-size="13.5" font-weight="800" fill="#0d7a83" text-anchor="middle">起动：Y 接</text><text x="480" y="34" font-size="13.5" font-weight="800" fill="#d9433a" text-anchor="middle">运行：Δ 接</text>` +
        star(160, 120, 52, '#0d7a83', '相电压 = U/√3') +
        tri(480, 110, 56, '#d9433a', '相电压 = U') +
        `<text x="160" y="200" font-size="12" fill="#3f5470" text-anchor="middle">起动电流、起动转矩均为直接起动的 <tspan font-weight="800" fill="#b3413a">1/3</tspan></text>` +
        `<text x="480" y="200" font-size="12" fill="#3f5470" text-anchor="middle">正常运行（额定 380V Δ 接）</text>` +
        `<line x1="290" y1="120" x2="350" y2="120" stroke="#3a5a8c" stroke-width="2" stroke-dasharray="6 4" marker-end="url(#arrw)"/><text x="320" y="110" font-size="11.5" fill="#3a5a8c" text-anchor="middle">切换（≈0.7n_N）</text>`;
      return wrap(body, '0 0 640 220');
    },
    /* 三种制动能量流 */
    braking() {
      const box = (x, w, t, c) => `<rect x="${x}" y="60" width="${w}" height="44" rx="8" fill="${c}" stroke="#3a5a8c" stroke-width="1.5"/><text x="${x + w / 2}" y="87" font-size="12.5" font-weight="700" text-anchor="middle" fill="#1c2b3a">${t}</text>`;
      const arr = (x1, x2, lab, c, y) => `<line x1="${x1}" y1="${y || 82}" x2="${x2}" y2="${y || 82}" stroke="${c || '#3a5a8c'}" stroke-width="2.2" marker-end="url(#arrw)"/>` + (lab ? `<text x="${(x1 + x2) / 2}" y="${(y || 82) - 8}" font-size="11" fill="${c || '#3a5a8c'}" text-anchor="middle" font-weight="700">${lab}</text>` : '');
      const ttl = (x, t, c) => `<text x="${x}" y="40" font-size="13" font-weight="800" fill="${c}" text-anchor="middle">${t}</text>`;
      const body =
        ttl(110, '① 能耗制动', '#0f3fa8') + box(20, 80, '电机（发电）', '#dce7f7') + arr(102, 160, '动能', '#b3413a') + box(162, 76, '制动电阻', '#fdeee6') + arr(240, 292, '热能', '#e8a13a', 100) + `<text x="150" y="140" font-size="11" fill="#3f5470" text-anchor="middle">平稳 · 低速制动有力</text>` +
        ttl(330, '② 反接制动', '#0d7a83') + box(240, 70, '电网', '#dce7f7') + arr(312, 352, '', '#b3413a') + box(354, 70, '电机（反接）', '#dcf0f0') + arr(426, 470, '动能+电能→损耗', '#e8a13a') +
        ttl(540, '③ 回馈制动', '#b3413a') + box(470, 76, '电机（发电）', '#dce7f7') + arr(548, 610, '电能回馈', '#2a8f5a') + `<text x="540" y="140" font-size="11" fill="#3f5470" text-anchor="middle">n > n₀ · 节能</text>`;
      return wrap(body, '0 0 640 160');
    },
    /* 伺服/双闭环框图 */
    doubleLoop() {
      const body =
        `<rect x="14" y="120" width="86" height="40" rx="8" fill="#e3ecff" stroke="#3a5a8c" stroke-width="1.6"/><text x="57" y="144" font-size="12" font-weight="700" text-anchor="middle">转速给定 U*n</text>` +
        `<circle cx="126" cy="140" r="13" fill="#fff" stroke="#3a5a8c" stroke-width="1.8"/><text x="126" y="145" font-size="14" font-weight="800" text-anchor="middle">Σ</text>` +
        `<rect x="160" y="118" width="96" height="44" rx="8" fill="#dce7f7" stroke="#0f3fa8" stroke-width="1.8"/><text x="208" y="136" font-size="12.5" font-weight="800" text-anchor="middle">ASR 转速调节器</text><text x="208" y="152" font-size="11" text-anchor="middle" fill="#3f5470">PI · 限幅</text>` +
        `<circle cx="288" cy="140" r="13" fill="#fff" stroke="#3a5a8c" stroke-width="1.8"/><text x="288" y="145" font-size="14" font-weight="800" text-anchor="middle">Σ</text>` +
        `<rect x="322" y="118" width="96" height="44" rx="8" fill="#dcf0f0" stroke="#0d7a83" stroke-width="1.8"/><text x="370" y="136" font-size="12.5" font-weight="800" text-anchor="middle">ACR 电流调节器</text><text x="370" y="152" font-size="11" text-anchor="middle" fill="#3f5470">PI</text>` +
        `<rect x="448" y="118" width="100" height="44" rx="8" fill="#fdeee6" stroke="#e8743b" stroke-width="1.8"/><text x="498" y="136" font-size="12.5" font-weight="800" text-anchor="middle">触发/整流装置</text><text x="498" y="152" font-size="11" text-anchor="middle" fill="#3f5470">Ud₀ = f(α)</text>` +
        `<rect x="452" y="205" width="92" height="44" rx="8" fill="#fff7e8" stroke="#b8860b" stroke-width="1.8"/><text x="498" y="223" font-size="12.5" font-weight="800" text-anchor="middle">直流电动机</text><text x="498" y="239" font-size="11" text-anchor="middle" fill="#3f5470">n = (Ud−IdR)/CeΦ</text>` +
        `<line x1="100" y1="140" x2="112" y2="140" stroke="#3a5a8c" stroke-width="2" marker-end="url(#arrw)"/>` +
        `<line x1="139" y1="140" x2="159" y2="140" stroke="#3a5a8c" stroke-width="2" marker-end="url(#arrw)"/>` +
        `<line x1="256" y1="140" x2="274" y2="140" stroke="#3a5a8c" stroke-width="2" marker-end="url(#arrw)"/><text x="265" y="132" font-size="10.5" fill="#3a5a8c" text-anchor="middle">U*i</text>` +
        `<line x1="301" y1="140" x2="321" y2="140" stroke="#3a5a8c" stroke-width="2" marker-end="url(#arrw)"/>` +
        `<line x1="418" y1="140" x2="447" y2="140" stroke="#3a5a8c" stroke-width="2" marker-end="url(#arrw)"/><text x="432" y="132" font-size="10.5" fill="#3a5a8c" text-anchor="middle">Uc</text>` +
        `<line x1="498" y1="162" x2="498" y2="204" stroke="#3a5a8c" stroke-width="2" marker-end="url(#arrw)"/>` +
        // 反馈线
        `<line x1="498" y1="249" x2="498" y2="280" stroke="#0d7a83" stroke-width="1.8"/><line x1="498" y1="280" x2="330" y2="280" stroke="#0d7a83" stroke-width="1.8"/><line x1="370" y1="280" x2="370" y2="200" stroke="#0d7a83" stroke-width="1.8" marker-end="url(#arrw)"/><text x="352" y="270" font-size="11" fill="#0d7a83" font-weight="700">电流反馈 β·Id</text>` +
        `<line x1="330" y1="280" x2="126" y2="280" stroke="#0f3fa8" stroke-width="1.8"/><line x1="126" y1="280" x2="126" y2="154" stroke="#0f3fa8" stroke-width="1.8" marker-end="url(#arrw)"/><text x="140" y="270" font-size="11" fill="#0f3fa8" font-weight="700">转速反馈 α·n（TG/编码器）</text>` +
        `<text x="320" y="30" font-size="14" font-weight="800" fill="#0f3fa8" text-anchor="middle">转速、电流双闭环直流调速系统</text>` +
        `<text x="208" y="70" font-size="11.5" fill="#b3413a" text-anchor="middle">起动时 ASR 饱和 → 输出限幅最大电流给定 → 恒流升速（时间最优）</text>`;
      return wrap(body, '0 0 640 300');
    },
    /* FOC 矢量控制框图 */
    focBlock() {
      const body =
        `<text x="320" y="30" font-size="14" font-weight="800" fill="#0f3fa8" text-anchor="middle">FOC 磁场定向控制（矢量控制）信号流</text>` +
        blocks({
          blocks: [
            { x: 20, y: 120, w: 92, h: 44, t: '速度/位置给定', c: '#e3ecff' },
            { x: 140, y: 120, w: 84, h: 44, t: 'PI 速度环', c: '#dce7f7' },
            { x: 252, y: 62, w: 96, h: 40, t: 'iq* 转矩给定', c: '#dcf0f0' },
            { x: 252, y: 182, w: 96, h: 40, t: 'id* = 0（励磁）', c: '#fdeee6' },
            { x: 372, y: 112, w: 108, h: 56, t: 'Park 逆变换\n(dq* → αβ*)', c: '#eef3fb' },
            { x: 504, y: 112, w: 108, h: 56, t: 'SVPWM\n逆变器', c: '#fdeee6' },
            { x: 504, y: 205, w: 108, h: 48, t: 'PMSM\n电机本体', c: '#fff7e8' },
            { x: 372, y: 215, w: 108, h: 52, t: 'Park 变换\n(αβ i → dq i)', c: '#eef3fb' },
            { x: 220, y: 262, w: 130, h: 44, t: 'Clarke 变换\n(iabc → iαβ)', c: '#eef3fb' },
            { x: 504, y: 40, w: 108, h: 40, t: '编码器 θ（转子位置）', c: '#dcf0f0' }
          ],
          arrows: [
            { x1: 112, y1: 142, x2: 139, y2: 142, label: '' },
            { x1: 224, y1: 142, x2: 251, y2: 100, label: '' },
            { x1: 224, y1: 142, x2: 251, y2: 200, label: '' },
            { x1: 348, y1: 82, x2: 371, y2: 122, label: '' },
            { x1: 348, y1: 202, x2: 371, y2: 158, label: '' },
            { x1: 480, y1: 140, x2: 503, y2: 140, label: '' },
            { x1: 558, y1: 168, x2: 558, y2: 204, label: '三相电流' },
            { x1: 503, y1: 229, x2: 481, y2: 240, label: 'ia,ib,ic' },
            { x1: 371, y1: 240, x2: 351, y2: 262, label: '' },
            { x1: 425, y1: 262, x2: 481, y2: 240, label: '' },
            { x1: 558, y1: 205, x2: 558, y2: 81, label: 'θ 反馈', color: '#0d7a83' },
            { x1: 503, y1: 60, x2: 426, y2: 112, label: 'θ', color: '#0d7a83' }
          ]
        }).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
      return wrap(body, '0 0 640 320');
    },
    /* 起保停梯形图 */
    ladderStart() {
      const L = (x1, x2, y, c) => `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${c}" stroke-width="2.4"/>`;
      const contacts = [
        { x: 120, y: 90, t: 'SB2', lab: '起动按钮(常开)', c: '#d9433a' },
        { x: 120, y: 150, t: 'KM', lab: '自锁触点(常开)', c: '#0d7a83' },
        { x: 300, y: 150, t: 'SB1', lab: '停止按钮(常常闭)', c: '#0f3fa8' },
        { x: 300, y: 210, t: 'FR', lab: '热继电器(常闭)', c: '#e8743b' }
      ];
      let body = `<text x="320" y="34" font-size="14" font-weight="800" fill="#0f3fa8" text-anchor="middle">电动机起保停电路（梯形图）</text>`;
      body += `<line x1="60" y1="60" x2="60" y2="240" stroke="#1c2b3a" stroke-width="3"/><line x1="580" y1="60" x2="580" y2="240" stroke="#1c2b3a" stroke-width="3"/><text x="50" y="150" font-size="11" fill="#3f5470">L</text><text x="592" y="150" font-size="11" fill="#3f5700">N</text>`;
      // SB2 支路 + KM 线圈
      body += L(60, 118, 90, '#1c2b3a') + `<text x="138" y="95" font-size="13" font-weight="800" fill="#d9433a">SB2</text><text x="128" y="76" font-size="10.5" fill="#3f5470">起动(常开)</text>` + L(158, 298, 90, '#1c2b3a') + `<text x="318" y="95" font-size="13" font-weight="800" fill="#0f3fa8">SB1</text><text x="308" y="76" font-size="10.5" fill="#3f5470">停止(常闭)</text>` + L(338, 468, 90, '#1c2b3a') + `<circle cx="488" cy="90" r="18" fill="#fff" stroke="#0d7a83" stroke-width="2.4"/><text x="488" y="95" font-size="13" font-weight="800" fill="#0d7a83" text-anchor="middle">KM</text>` + L(506, 580, 90, '#1c2b3a');
      // 自锁支路
      body += L(60, 118, 150, '#1c2b3a') + `<text x="138" y="155" font-size="13" font-weight="800" fill="#0d7a83">KM</text><text x="124" y="136" font-size="10.5" fill="#3f5470">自锁(常开)</text>` + L(158, 298, 150, '#1c2b3a');
      body += `<line x1="118" y1="90" x2="118" y2="150" stroke="#1c2b3a" stroke-width="2"/><line x1="298" y1="90" x2="298" y2="150" stroke="#1c2b3a" stroke-width="2"/><line x1="90" y1="90" x2="90" y2="150" stroke="#1c2b3a" stroke-width="2"/><line x1="60" y1="90" x2="60" y2="150" stroke="#1c2b3a" stroke-width="0"/>`;
      body += `<text x="320" y="196" font-size="11.5" fill="#b3413a" text-anchor="middle" font-weight="700">按下 SB2 → KM 得电 → KM 常开触点闭合短接 SB2（自锁）→ 松手继续运行；按 SB1 或 FR 动作 → 断电</text>`;
      body += `<text x="320" y="222" font-size="11" fill="#3f5470" text-anchor="middle">主电路：KM 主触点控制电机 · FR 热元件串于主回路作过载保护</text>`;
      return wrap(body, '0 0 640 250');
    },
    /* PLC 扫描周期 */
    plcScan() {
      const body =
        `<text x="320" y="30" font-size="14" font-weight="800" fill="#0f3fa8" text-anchor="middle">PLC 循环扫描工作方式（周期：几 ms ~ 几十 ms）</text>` +
        blocks({
          blocks: [
            { x: 60, y: 60, w: 150, h: 52, t: '① 输入采样\n一次性读入全部输入端', c: '#e3ecff' },
            { x: 260, y: 60, w: 150, h: 52, t: '② 程序执行\n梯形图自上而下运算', c: '#dcf0f0' },
            { x: 460, y: 60, w: 150, h: 52, t: '③ 输出刷新\n结果送输出锁存', c: '#fdeee6' }
          ],
          arrows: [
            { x1: 210, y1: 86, x2: 259, y2: 86 },
            { x1: 410, y1: 86, x2: 459, y2: 86 },
            { x1: 535, y1: 112, x2: 535, y2: 150, label: '' },
            { x1: 535, y1: 150, x2: 135, y2: 150, label: '进入下一扫描周期（循环）', color: '#b3413a' },
            { x1: 135, y1: 150, x2: 135, y2: 112, label: '' }
          ]
        }).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '') +
        `<text x="320" y="185" font-size="11.5" fill="#3f5470" text-anchor="middle">扫描期间输入变化不被响应（集中采样）；输出集中在刷新阶段更新（集中输出）→ 抗干扰强</text>`;
      return wrap(body, '0 0 640 205');
    },
    /* SPWM */
    spwm() {
      let sine = '', carry = '';
      for (let x = 0; x <= 520; x += 2) {
        const y = 95 - 52 * Math.sin((x / 520) * 2 * Math.PI * 2);
        sine += (x ? 'L' : 'M') + (60 + x) + ' ' + y.toFixed(1) + ' ';
      }
      for (let x = 0; x <= 520; x += 2) {
        const t = (x % 26) / 26;
        const y = 95 - 62 * (t < 0.5 ? t * 2 : 2 - t * 2);
        carry += (x ? 'L' : 'M') + (60 + x) + ' ' + y.toFixed(1) + ' ';
      }
      let pulses = '';
      for (let x = 0; x <= 520; x += 26) {
        const sv = Math.sin((x / 520) * 2 * Math.PI * 2);
        const w2 = 6 + 14 * Math.abs(sv);
        pulses += `<rect x="${(60 + x - w2 / 2).toFixed(1)}" y="215" width="${w2.toFixed(1)}" height="26" fill="#0f3fa8"/>`;
      }
      const body = `<text x="320" y="26" font-size="14" font-weight="800" fill="#0f3fa8" text-anchor="middle">SPWM：等幅不等宽脉冲等效正弦波</text>` +
        `<path d="${sine}" fill="none" stroke="#d9433a" stroke-width="2.4"/><text x="590" y="60" font-size="11.5" fill="#d9433a" font-weight="700">调制波(正弦)</text>` +
        `<path d="${carry}" fill="none" stroke="#0d7a83" stroke-width="1.6" opacity=".8"/><text x="590" y="132" font-size="11.5" fill="#0d7a83" font-weight="700">载波(三角)</text>` +
        pulses + `<text x="320" y="262" font-size="11.5" fill="#3f5470" text-anchor="middle">脉冲宽度按正弦规律变化 → 基波幅值 ∝ 调制比 m；输出频率 = 调制波频率</text>`;
      return wrap(body, '0 0 640 275');
    },
    /* 步进电机通电时序 */
    stepSeq() {
      const rows = [
        { t: 'A 相', c: [1, 0, 0, 1, 0, 0, 1] },
        { t: 'B 相', c: [0, 1, 0, 0, 1, 0, 0] },
        { t: 'C 相', c: [0, 0, 1, 0, 0, 1, 0] }
      ];
      let body = `<text x="320" y="26" font-size="14" font-weight="800" fill="#0f3fa8" text-anchor="middle">三相单三拍通电时序（A→B→C→A…，每拍转子转过一个步距角）</text>`;
      rows.forEach((r, i) => {
        const y = 56 + i * 42;
        body += `<text x="52" y="${y + 16}" font-size="12.5" font-weight="700" fill="#3f5470" text-anchor="middle">${r.t}</text>`;
        r.c.forEach((on, k) => {
          const x = 86 + k * 76;
          if (on) body += `<rect x="${x}" y="${y}" width="66" height="30" rx="5" fill="${['#d9433a', '#0d7a83', '#e8a13a'][i]}" opacity=".85"/><text x="${x + 33}" y="${y + 20}" font-size="12" fill="#fff" text-anchor="middle" font-weight="800">通电</text>`;
          else body += `<rect x="${x}" y="${y}" width="66" height="30" rx="5" fill="#eef1f6" stroke="#b9c8de"/>`;
        });
      });
      body += `<text x="320" y="212" font-size="12" fill="#3f5470" text-anchor="middle">角位移 ∝ 脉冲数 · 转速 ∝ 脉冲频率 · 反相通电即反转 · 双三拍(A→AB→B→BC…)步距角减半</text>`;
      return wrap(body, '0 0 640 230');
    },
    /* 调速方式对比（直流） */
    speedZones() {
      return line({
        xMax: 2, yMax: 2.2, xLabel: '转速 n (×n_N)', yLabel: '允许输出',
        xFmt: v => v.toFixed(1), yFmt: v => v.toFixed(1),
        series: [
          { name: '允许转矩 T（基速以下恒转矩）', color: '#0f3fa8', pts: [[0.05, 1], [1, 1]] },
          { name: '允许功率 P（基速以上恒功率）', color: '#e8743b', pts: [[0.2, 0.2], [1, 1], [2, 1]] },
          { name: '弱磁段转矩 T ∝ 1/n', color: '#0d7a83', pts: [[1, 1], [2, 0.5]] }
        ],
        vlines: [{ x: 1, label: '基速 n_N（额定）' }]
      });
    },
    /* V/f 曲线 */
    vfCurve() {
      return line({
        xMax: 100, yMax: 120, xLabel: '频率 f (Hz)', yLabel: '电压 U (V)',
        xFmt: v => Math.round(v), yFmt: v => Math.round(v),
        series: [
          { name: 'U/f = 常数（基频以下 · 恒转矩）', color: '#0f3fa8', pts: [[5, 8], [50, 100]] },
          { name: 'U = U_N（基频以上 · 弱磁恒功率）', color: '#e8743b', pts: [[50, 100], [100, 100]] },
          { name: '低速转矩提升补偿', color: '#0d7a83', pts: [[0, 10], [15, 34]], dash: '5 4' }
        ],
        vlines: [{ x: 50, label: '基频 50Hz' }]
      });
    }
  };

  function render(chart) {
    if (typeof chart === 'string') return custom[chart] ? custom[chart]() : '';
    if (chart && chart.type === 'line') return line(chart.cfg || {});
    if (chart && chart.type === 'blocks') return blocks(chart.cfg || {});
    return '';
  }
  return { render, line, blocks, custom };
})();

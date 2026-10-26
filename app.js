(function () {
  const DATA = window.TSE_AUDIT_DATA;
  if (!DATA || !DATA.ufs) return;

  const UFS = DATA.ufs;
  const UF_MAP = {};
  UFS.forEach((u) => { UF_MAP[u.uf] = u; });

  const REGIONS = DATA.mapRegions || {};
  const MICROS = DATA.microregions || [];

  const NATIONAL = {
    uf: "BR",
    nome: "Brasil · Consolidado Nacional",
    regiao: "5 Macrorregiões",
    fuso: "UTC-3 (Horário de Brasília)",
    secoes_1t: 497895,
    secoes_2t: 497895,
    comp_1t: 124934069,
    comp_2t: 127697270,
    com_bio_1t: 109505685,
    sem_bio_1t: 15428384,
    biom_sem_hab_1t: 8342249,
    sem_cad_1t: 7086135,
    pct_com_bio_1t: 87.65,
    pct_sem_bio_1t: 12.35,
    com_bio_2t: 111838843,
    sem_bio_2t: 15858427,
    biom_sem_hab_2t: 8615564,
    sem_cad_2t: 7242863,
    pct_com_bio_2t: 87.58,
    pct_sem_bio_2t: 12.42,
    delta_sb_pp: 0.07,
    votos_ap_17h_2t: 34330,
    pct_ap_17h_2t: 0.027,
    com_bio_ap_17h_2t: 28862,
    sem_bio_ap_17h_2t: 5468,
    pct_sem_bio_ap_17h_2t: 15.93,
    lula_1t_v: 57259504,
    lula_1t_p: 48.43,
    flavio_1t_v: 51072345,
    flavio_1t_p: 43.20,
    lula_2t_v: 60345999,
    lula_2t_p: 50.90,
    flavio_2t_v: 58206354,
    flavio_2t_p: 49.10
  };

  const TIMELINE_STEPS = [
    { key: "17:00", clock: "17:00:00", label: "17h", desc: "Encerramento regular (96,79% das seções até 17:05 BRT)", activeVotos: 34330, pct: 0.027 },
    { key: "17:05", clock: "17:05:00", label: "17:05", desc: "8.654 eleitores habilitados antes das 17h concluem o voto", activeVotos: 25676, pct: 0.020 },
    { key: "17:15", clock: "17:15:00", label: "17:15", desc: "Fila com senha distribuída até 17h00 (99,36% das seções encerradas)", activeVotos: 14820, pct: 0.012 },
    { key: "17:30", clock: "17:30:00", label: "17:30", desc: "Apenas 1.240 seções com fila residual em grandes colégios", activeVotos: 6190, pct: 0.005 },
    { key: "18:00", clock: "18:00:00", label: "18h", desc: "99,91% das urnas encerradas no horário oficial de Brasília", activeVotos: 1480, pct: 0.001 },
    { key: "19:00", clock: "19:00:00", label: "19h", desc: "Encerramento das seções no Acre (17h00 locais = 19h00 BRT)", activeVotos: 195, pct: 0.0002 },
    { key: "23:55", clock: "23:55:00", label: "23h55", desc: "100% das 497.895 urnas auditadas e encerradas", activeVotos: 34330, pct: 0.027 }
  ];

  // Right-side aligned callout badges (identical to Pandora layout)
  const CALLOUT_UFS = {
    RN: { bx: 655, by: 204, ax: 552, ay: 222 },
    PB: { bx: 655, by: 230, ax: 556, ay: 242 },
    PE: { bx: 655, by: 256, ax: 545, ay: 258 },
    AL: { bx: 655, by: 282, ax: 554, ay: 276 },
    SE: { bx: 655, by: 308, ax: 544, ay: 292 },
    DF: { bx: 655, by: 374, ax: 398, ay: 378 },
    ES: { bx: 655, by: 422, ax: 506, ay: 432 },
    RJ: { bx: 655, by: 448, ax: 484, ay: 468 }
  };

  let state = {
    mode: "biometria",     // 'biometria' | 'pos17h' | 'resultado'
    selectedRegion: "ALL", // 'ALL' | 'N' | 'NE' | 'CO' | 'SE' | 'S'
    selectedUf: null,      // null or UF code ('SP', 'AM', etc.)
    timelineIdx: 6,
    zoom: 1,
    sortCol: "comp_2t",
    sortAsc: false
  };

  const fmtInt = (n) => Number(n || 0).toLocaleString("pt-BR");
  const fmtPct = (n, d = 2) => Number(n || 0).toFixed(d).replace(".", ",");
  const fmtSigned = (n, d = 2) => {
    const val = Number(n || 0);
    const sign = val > 0 ? "+" : "";
    return sign + val.toFixed(d).replace(".", ",");
  };

  const REGION_BASE_HUES = {
    N:  ["#064e3b", "#047857", "#059669", "#10b981", "#34d399"],
    NE: ["#0c4a6e", "#0369a1", "#0284c7", "#0ea5e9", "#38bdf8"],
    CO: ["#1e3a8a", "#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa"],
    SE: ["#115e59", "#0f766e", "#0d9488", "#14b8a6", "#2dd4bf"],
    S:  ["#065f46", "#059669", "#10b981", "#34d399", "#6ee7b7"]
  };

  function getMicroFill(m) {
    if (state.mode === "biometria") {
      const v = m.bio_2t;
      const palette = REGION_BASE_HUES[m.region] || REGION_BASE_HUES.N;
      if (v >= 92.5) return palette[4];
      if (v >= 89.5) return palette[3];
      if (v >= 86.0) return palette[2];
      if (v >= 82.0) return palette[1];
      return palette[0];
    } else if (state.mode === "pos17h") {
      const p = m.after17_pct;
      if (p >= 0.065) return "#d97706";
      if (p >= 0.040) return "#b45309";
      if (p >= 0.025) return "#0284c7";
      if (p >= 0.015) return "#0d9488";
      return "#065f46";
    } else {
      const l = m.lula_2t;
      if (l >= 68) return "#991b1b";
      if (l >= 58) return "#dc2626";
      if (l >= 50) return "#ef4444";
      if (l >= 42) return "#3b82f6";
      if (l >= 34) return "#2563eb";
      return "#1d4ed8";
    }
  }

  function getUfBadgeText(u) {
    if (state.mode === "biometria") {
      return `${u.uf} ${Math.round(u.pct_com_bio_2t)}%`;
    } else if (state.mode === "pos17h") {
      return `${u.uf} ${fmtPct(u.pct_ap_17h_2t, 2)}%`;
    } else {
      const winPct = Math.max(u.lula_2t_p, u.flavio_2t_p);
      return `${u.uf} ${Math.round(winPct)}%`;
    }
  }

  function renderMap() {
    const microLayer = document.getElementById("microLayer");
    const ufBorderLayer = document.getElementById("ufBorderLayer");
    const regionBorderLayer = document.getElementById("regionBorderLayer");
    const calloutLinesLayer = document.getElementById("calloutLinesLayer");
    const regionTitlesLayer = document.getElementById("regionTitlesLayer");
    const ufBadgesLayer = document.getElementById("ufBadgesLayer");
    const calloutBadgesLayer = document.getElementById("calloutBadgesLayer");

    microLayer.innerHTML = "";
    ufBorderLayer.innerHTML = "";
    regionBorderLayer.innerHTML = "";
    calloutLinesLayer.innerHTML = "";
    regionTitlesLayer.innerHTML = "";
    ufBadgesLayer.innerHTML = "";
    calloutBadgesLayer.innerHTML = "";

    const ns = "http://www.w3.org/2000/svg";

    MICROS.forEach((m) => {
      const p = document.createElementNS(ns, "path");
      p.setAttribute("d", m.path);
      p.setAttribute("fill", getMicroFill(m));
      const isDimmed =
        (state.selectedRegion !== "ALL" && m.region !== state.selectedRegion) ||
        (state.selectedUf && m.uf !== state.selectedUf);
      p.setAttribute("class", "micro-path" + (isDimmed ? " dimmed" : ""));
      p.dataset.uf = m.uf;
      p.dataset.micro = m.name;
      p.dataset.bio = m.bio_2t;

      p.addEventListener("mouseenter", (e) => showTooltip(e, UF_MAP[m.uf], m));
      p.addEventListener("mousemove", (e) => moveTooltip(e));
      p.addEventListener("mouseleave", hideTooltip);
      p.addEventListener("click", (e) => {
        e.stopPropagation();
        selectUf(m.uf);
      });
      microLayer.appendChild(p);
    });

    UFS.forEach((u) => {
      const p = document.createElementNS(ns, "path");
      p.setAttribute("d", u.path);
      const isSelected = state.selectedUf === u.uf;
      const isDimmed =
        (state.selectedRegion !== "ALL" && u.regiao !== state.selectedRegion) ||
        (state.selectedUf && !isSelected);
      p.setAttribute(
        "class",
        "uf-border-path" + (isSelected ? " selected" : "") + (isDimmed ? " dimmed" : "")
      );
      ufBorderLayer.appendChild(p);
    });

    Object.values(REGIONS).forEach((r) => {
      const p = document.createElementNS(ns, "path");
      p.setAttribute("d", r.path);
      const isRegSelected = state.selectedRegion === r.code;
      p.setAttribute(
        "class",
        "region-border-path" + (isRegSelected ? " highlighted" : "")
      );
      regionBorderLayer.appendChild(p);

      const txt = document.createElementNS(ns, "text");
      txt.setAttribute("x", r.cx);
      txt.setAttribute("y", r.cy - 18);
      txt.setAttribute("class", "region-map-label");
      txt.textContent = r.name.replace("Região ", "").toUpperCase();
      regionTitlesLayer.appendChild(txt);
    });

    UFS.forEach((u) => {
      const labelText = getUfBadgeText(u);
      const isSelected = state.selectedUf === u.uf;
      const isDimmed =
        (state.selectedRegion !== "ALL" && u.regiao !== state.selectedRegion) ||
        (state.selectedUf && !isSelected);

      const callout = CALLOUT_UFS[u.uf];
      const gx = callout ? callout.bx : u.cx;
      const gy = callout ? callout.by : u.cy;

      if (callout) {
        const line = document.createElementNS(ns, "path");
        const midX = callout.bx - 32;
        line.setAttribute(
          "d",
          `M${callout.ax},${callout.ay} L${midX},${callout.by} L${callout.bx - 28},${callout.by}`
        );
        line.setAttribute("class", "callout-line" + (isDimmed ? " dimmed" : ""));
        calloutLinesLayer.appendChild(line);
      }

      const g = document.createElementNS(ns, "g");
      g.setAttribute(
        "class",
        "uf-pill-group" + (isSelected ? " selected" : "") + (isDimmed ? " dimmed" : "")
      );
      g.setAttribute("transform", `translate(${gx}, ${gy})`);

      const w = labelText.length * 6.4 + 12;
      const h = 19;

      const rect = document.createElementNS(ns, "rect");
      rect.setAttribute("x", -w / 2);
      rect.setAttribute("y", -h / 2);
      rect.setAttribute("width", w);
      rect.setAttribute("height", h);
      rect.setAttribute("class", "uf-pill-rect");

      if (state.mode === "resultado") {
        rect.style.stroke = u.lula_2t_p >= 50 ? "rgba(239,68,68,0.65)" : "rgba(59,130,246,0.65)";
      }

      const text = document.createElementNS(ns, "text");
      text.setAttribute("x", 0);
      text.setAttribute("y", 0.5);
      text.setAttribute("class", "uf-pill-text");
      text.textContent = labelText;

      g.appendChild(rect);
      g.appendChild(text);

      g.addEventListener("mouseenter", (e) => showTooltip(e, u, null));
      g.addEventListener("mousemove", (e) => moveTooltip(e));
      g.addEventListener("mouseleave", hideTooltip);
      g.addEventListener("click", (e) => {
        e.stopPropagation();
        selectUf(u.uf);
      });

      if (callout) {
        calloutBadgesLayer.appendChild(g);
      } else {
        ufBadgesLayer.appendChild(g);
      }
    });
  }

  const tooltipEl = document.getElementById("mapTooltip");
  function showTooltip(e, u, micro) {
    if (!u || window.innerWidth <= 1024) return;
    const microLine = micro
      ? `<div style="color:#6ee7b7;font-weight:700;font-size:10.5px;margin-bottom:2px;">Microrregião: ${micro.name} (${fmtPct(micro.bio_2t)}% bio)</div>`
      : "";
    tooltipEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <strong style="font-size:13px;color:#fff;">${u.nome} (${u.uf})</strong>
        <span style="font-size:10px;color:#9ca3af;background:rgba(255,255,255,0.08);padding:1px 6px;border-radius:99px;">Região ${u.regiao} · ${u.fuso.split(" ")[0]}</span>
      </div>
      ${microLine}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 10px;font-size:11px;color:#d1d5db;border-top:1px solid rgba(255,255,255,0.08);padding-top:5px;">
        <span>Com Bio 1ºT: <strong>${fmtPct(u.pct_com_bio_1t)}%</strong></span>
        <span>Com Bio 2ºT: <strong style="color:#34d399">${fmtPct(u.pct_com_bio_2t)}%</strong></span>
        <span>Sem Bio 2ºT: <strong>${fmtPct(u.pct_sem_bio_2t)}%</strong></span>
        <span>Variação Δ: <strong>${fmtSigned(u.delta_sb_pp)} p.p.</strong></span>
        <span>Falha 4x: <strong>${fmtInt(u.biom_sem_hab_2t)}</strong></span>
        <span>Votos &gt;17h BRT: <strong style="color:#fbbf24">${fmtInt(u.votos_ap_17h_2t)} (${fmtPct(u.pct_ap_17h_2t, 3)}%)</strong></span>
      </div>
    `;
    tooltipEl.classList.remove("hidden");
    moveTooltip(e);
  }

  function moveTooltip(e) {
    const canvasRect = document.getElementById("mapCanvas").getBoundingClientRect();
    let x = e.clientX - canvasRect.left + 14;
    let y = e.clientY - canvasRect.top + 14;
    if (x + 240 > canvasRect.width) x -= 255;
    if (y + 130 > canvasRect.height) y -= 135;
    tooltipEl.style.left = `${x}px`;
    tooltipEl.style.top = `${y}px`;
  }

  function hideTooltip() {
    tooltipEl.classList.add("hidden");
  }

  function renderStabilityChart() {
    const svg = document.getElementById("stabilityChart");
    if (!svg) return;
    const sorted = [...UFS].sort((a, b) => a.pct_com_bio_1t - b.pct_com_bio_1t);
    const W = 260;
    const H = 102;
    const padL = 26;
    const padR = 8;
    const padT = 10;
    const padB = 12;
    const minY = 76;
    const maxY = 96;

    const xOf = (i) => padL + (i / (sorted.length - 1)) * (W - padL - padR);
    const yOf = (val) => padT + (1 - (val - minY) / (maxY - minY)) * (H - padT - padB);

    const pts1 = sorted.map((u, i) => `${xOf(i).toFixed(1)},${yOf(u.pct_com_bio_1t).toFixed(1)}`).join(" ");
    const pts2 = sorted.map((u, i) => `${xOf(i).toFixed(1)},${yOf(u.pct_com_bio_2t).toFixed(1)}`).join(" ");

    svg.innerHTML = `
      <line x1="${padL}" y1="${yOf(94)}" x2="${W - padR}" y2="${yOf(94)}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="2,2"/>
      <line x1="${padL}" y1="${yOf(88)}" x2="${W - padR}" y2="${yOf(88)}" stroke="rgba(255,255,255,0.08)" stroke-dasharray="2,2"/>
      <line x1="${padL}" y1="${yOf(80)}" x2="${W - padR}" y2="${yOf(80)}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="2,2"/>
      <text x="2" y="${yOf(94) + 3}" fill="#697182" font-size="8.5" font-weight="600">94%</text>
      <text x="2" y="${yOf(88) + 3}" fill="#697182" font-size="8.5" font-weight="600">88%</text>
      <text x="2" y="${yOf(80) + 3}" fill="#697182" font-size="8.5" font-weight="600">80%</text>
      <polyline fill="none" stroke="#10b981" stroke-width="2" points="${pts1}" opacity="0.9"/>
      <polyline fill="none" stroke="#60a5fa" stroke-width="1.6" stroke-dasharray="3,2" points="${pts2}"/>
    `;
  }

  function updateDashboardUI() {
    let target = NATIONAL;
    if (state.selectedUf && UF_MAP[state.selectedUf]) {
      target = UF_MAP[state.selectedUf];
    } else if (state.selectedRegion !== "ALL" && REGIONS[state.selectedRegion]) {
      const r = REGIONS[state.selectedRegion];
      target = {
        uf: r.code,
        nome: `${r.name} (${r.uf_count} UFs)`,
        regiao: r.name,
        fuso: r.code === "N" || r.code === "CO" ? "Múltiplos fusos (UTC-3 / UTC-4 / UTC-5)" : "UTC-3 (Horário de Brasília)",
        secoes_2t: r.secoes_2t,
        comp_1t: r.comp_1t,
        comp_2t: r.comp_2t,
        com_bio_1t: r.com_bio_1t,
        com_bio_2t: r.com_bio_2t,
        sem_bio_1t: r.sem_bio_1t,
        sem_bio_2t: r.sem_bio_2t,
        biom_sem_hab_2t: r.biom_sem_hab_2t,
        sem_cad_2t: r.sem_cad_2t,
        pct_com_bio_1t: r.pct_com_bio_1t,
        pct_com_bio_2t: r.pct_com_bio_2t,
        pct_sem_bio_1t: r.pct_sem_bio_1t,
        pct_sem_bio_2t: r.pct_sem_bio_2t,
        delta_sb_pp: r.delta_sb_pp,
        votos_ap_17h_2t: r.votos_ap_17h_2t,
        pct_ap_17h_2t: r.pct_ap_17h_2t
      };
    }

    document.getElementById("activeScopeLabel").textContent =
      state.selectedUf ? `${target.nome} (${target.uf})` :
      state.selectedRegion !== "ALL" ? target.nome : "Brasil · 5 Regiões";

    const heroHeadline = document.getElementById("heroHeadline");
    const heroLeftTitle = document.getElementById("heroLeftTitle");
    const heroLeftBadge = document.getElementById("heroLeftBadge");
    const heroRightTitle = document.getElementById("heroRightTitle");
    const heroRightBadge = document.getElementById("heroRightBadge");
    const heroBarLeft = document.getElementById("heroBarLeft");
    const heroBarRight = document.getElementById("heroBarRight");
    const heroBarDivider = document.getElementById("heroBarDivider");
    const heroBarLeftPct = document.getElementById("heroBarLeftPct");
    const heroBarLeftVotes = document.getElementById("heroBarLeftVotes");
    const heroBarRightPct = document.getElementById("heroBarRightPct");
    const heroBarRightVotes = document.getElementById("heroBarRightVotes");
    const heroDividerText = document.getElementById("heroDividerText");
    const heroMobLeftVotes = document.getElementById("heroMobLeftVotes");
    const heroMobRightVotes = document.getElementById("heroMobRightVotes");

    if (state.mode === "biometria") {
      heroLeftTitle.textContent = "Com Biometria";
      heroLeftBadge.textContent = `★ 1ºT ${fmtPct(target.pct_com_bio_1t)}%`;
      heroRightTitle.textContent = "Sem Biometria";
      heroRightBadge.textContent = `1ºT ${fmtPct(target.pct_sem_bio_1t)}%`;
      heroHeadline.innerHTML = `<span class="hl-accent">Estabilidade biométrica</span> de ${fmtPct(100 - Math.abs(target.delta_sb_pp))}% (${target.uf === "BR" ? "Brasil" : target.uf})`;

      heroBarLeft.style.width = `${target.pct_com_bio_2t}%`;
      heroBarRight.style.width = `${target.pct_sem_bio_2t}%`;
      heroBarDivider.style.left = `${target.pct_com_bio_2t}%`;

      heroBarLeftPct.innerHTML = `${fmtPct(target.pct_com_bio_2t)}<small>%</small>`;
      heroBarLeftVotes.textContent = `${fmtInt(target.com_bio_2t)} votos (2ºT) · ${fmtInt(target.com_bio_1t)} (1ºT)`;
      heroBarRightPct.innerHTML = `${fmtPct(target.pct_sem_bio_2t)}<small>%</small>`;
      heroBarRightVotes.textContent = `${fmtInt(target.sem_bio_2t)} votos`;
      heroDividerText.textContent = `Δ ${fmtSigned(target.delta_sb_pp)} p.p.`;

      if (heroMobLeftVotes) heroMobLeftVotes.innerHTML = `<strong>Com Bio:</strong> ${fmtInt(target.com_bio_2t)} votos`;
      if (heroMobRightVotes) heroMobRightVotes.innerHTML = `<strong>Sem Bio:</strong> ${fmtInt(target.sem_bio_2t)} votos`;
    } else if (state.mode === "pos17h") {
      const pctBefore = round2(100 - target.pct_ap_17h_2t);
      const votosBefore = target.comp_2t - target.votos_ap_17h_2t;
      heroLeftTitle.textContent = "Até 17h00 BRT";
      heroLeftBadge.textContent = "★ Horário Regular";
      heroRightTitle.textContent = "Após 17h00 BRT";
      heroRightBadge.textContent = "Fila c/ Senha";
      heroHeadline.innerHTML = `<span class="hl-accent">${fmtInt(target.votos_ap_17h_2t)} votos após 17h BRT</span> (${fmtPct(target.pct_ap_17h_2t, 3)}% do total)`;

      heroBarLeft.style.width = "82%";
      heroBarRight.style.width = "18%";
      heroBarDivider.style.left = "82%";

      heroBarLeftPct.innerHTML = `${fmtPct(pctBefore, 3)}<small>%</small>`;
      heroBarLeftVotes.textContent = `${fmtInt(votosBefore)} votos até 17:00:00 (Horário de Brasília)`;
      heroBarRightPct.innerHTML = `${fmtPct(target.pct_ap_17h_2t, 3)}<small>%</small>`;
      heroBarRightVotes.textContent = `${fmtInt(target.votos_ap_17h_2t)} votos`;
      heroDividerText.textContent = "Fuso UTC-3";

      if (heroMobLeftVotes) heroMobLeftVotes.innerHTML = `<strong>Até 17h:</strong> ${fmtInt(votosBefore)} votos`;
      if (heroMobRightVotes) heroMobRightVotes.innerHTML = `<strong>Pós-17h:</strong> ${fmtInt(target.votos_ap_17h_2t)} votos`;
    } else {
      const l2 = target.lula_2t_p || NATIONAL.lula_2t_p;
      const f2 = target.flavio_2t_p || NATIONAL.flavio_2t_p;
      const lv = target.lula_2t_v || NATIONAL.lula_2t_v;
      const fv = target.flavio_2t_v || NATIONAL.flavio_2t_v;
      heroLeftTitle.textContent = "Lula (PT)";
      heroLeftBadge.textContent = `1ºT ${fmtPct(target.lula_1t_p || NATIONAL.lula_1t_p)}%`;
      heroRightTitle.textContent = "Bolsonaro (PL)";
      heroRightBadge.textContent = `1ºT ${fmtPct(target.flavio_1t_p || NATIONAL.flavio_1t_p)}%`;
      heroHeadline.innerHTML = `<span class="hl-accent">Comparativo Presidencial</span> 1º vs 2º Turno (${target.uf})`;

      heroBarLeft.style.width = `${l2}%`;
      heroBarRight.style.width = `${f2}%`;
      heroBarDivider.style.left = "50%";

      heroBarLeftPct.innerHTML = `${fmtPct(l2)}<small>%</small>`;
      heroBarLeftVotes.textContent = `${fmtInt(lv)} votos válidos (2ºT)`;
      heroBarRightPct.innerHTML = `${fmtPct(f2)}<small>%</small>`;
      heroBarRightVotes.textContent = `${fmtInt(fv)} votos`;
      heroDividerText.textContent = "50%";

      if (heroMobLeftVotes) heroMobLeftVotes.innerHTML = `<strong>Lula:</strong> ${fmtInt(lv)} votos`;
      if (heroMobRightVotes) heroMobRightVotes.innerHTML = `<strong>Bolsonaro:</strong> ${fmtInt(fv)} votos`;
    }

    document.getElementById("duelVal1").textContent = `${fmtPct(target.pct_com_bio_1t)}%`;
    document.getElementById("duelVal2").textContent = `${fmtPct(target.pct_com_bio_2t)}%`;
    document.getElementById("bigHighlightNum").textContent = `${fmtPct(Math.abs(target.delta_sb_pp))} p.p.`;
    document.getElementById("bigHighlightDesc").innerHTML =
      `Em <strong>${target.nome}</strong>, a habilitação sem biometria variou de <strong>${fmtPct(target.pct_sem_bio_1t)}%</strong> (1ºT) para <strong>${fmtPct(target.pct_sem_bio_2t)}%</strong> (2ºT), com <strong>${fmtInt(target.votos_ap_17h_2t)} votos</strong> após 17h BRT.`;

    document.getElementById("mapCenterBadgeText").textContent =
      state.selectedUf
        ? `${target.nome} (${target.uf}) · Região ${target.regiao} · Bio 2ºT ${fmtPct(target.pct_com_bio_2t)}%`
        : state.selectedRegion !== "ALL"
        ? `${target.nome} · Bio 2ºT ${fmtPct(target.pct_com_bio_2t)}% · Δ ${fmtSigned(target.delta_sb_pp)} p.p.`
        : "Estabilidade 1º vs 2º Turno · R² = 0,998 · 5 Regiões & 557 Microrregiões";

    document.getElementById("mscTag").textContent =
      state.selectedUf
        ? `ESTADO SELECIONADO · REGIÃO ${target.regiao}`
        : state.selectedRegion !== "ALL"
        ? `MACRORREGIÃO SELECIONADA`
        : "RAIO-X REGIONAL · 5 MACRORREGIÕES";
    document.getElementById("mscTitle").textContent = target.nome;
    document.getElementById("mscDesc").innerHTML =
      `<strong>1ºT:</strong> ${fmtPct(target.pct_com_bio_1t)}% com bio (${fmtInt(target.com_bio_1t)})<br/>` +
      `<strong>2ºT:</strong> ${fmtPct(target.pct_com_bio_2t)}% com bio · Falha 4x: ${fmtInt(target.biom_sem_hab_2t)}`;
    document.getElementById("mscFoot").innerHTML =
      `<span>${target.fuso.split(" ")[0]}</span><strong>${fmtInt(target.votos_ap_17h_2t)} votos &gt;17h (${fmtPct(target.pct_ap_17h_2t, 3)}%)</strong>`;

    document.getElementById("xrayUfCode").textContent = target.uf;
    document.getElementById("xrayUfName").textContent = target.nome;
    document.getElementById("xrayUfMeta").textContent = `${fmtInt(target.secoes_2t)} seções · ${target.fuso}`;
    document.getElementById("xrayBioVal").textContent = `${fmtPct(target.pct_com_bio_1t)}% → ${fmtPct(target.pct_com_bio_2t)}%`;
    document.getElementById("xrayDeltaVal").textContent = `${fmtSigned(target.delta_sb_pp)} p.p.`;
    document.getElementById("xrayAfter17Val").textContent = `${fmtInt(target.votos_ap_17h_2t)} (${fmtPct(target.pct_ap_17h_2t, 3)}%)`;

    document.getElementById("ufDetailCardTitle").textContent = `Raio-X Detalhado: ${target.nome}`;
    document.getElementById("ufDetailCardPill").textContent = `Δ ${fmtSigned(target.delta_sb_pp)} p.p.`;
    document.getElementById("ufDetailCardBody").innerHTML =
      `<strong>1ºT:</strong> ${fmtInt(target.com_bio_1t)} com bio (${fmtPct(target.pct_com_bio_1t)}%) · ${fmtInt(target.sem_bio_1t)} sem bio (${fmtPct(target.pct_sem_bio_1t)}%).<br/>` +
      `<strong>2ºT:</strong> ${fmtInt(target.com_bio_2t)} com bio (${fmtPct(target.pct_com_bio_2t)}%) · Falha 4x: <strong>${fmtInt(target.biom_sem_hab_2t)}</strong> · Sem cad.: <strong>${fmtInt(target.sem_cad_2t)}</strong>.`;
  }

  function round2(v) {
    return Math.round(v * 1000) / 1000;
  }

  function syncDropdowns() {
    const val = state.selectedUf || "BR";
    const sel1 = document.getElementById("ufSelectDropdown");
    const sel2 = document.getElementById("mobileUfSelect");
    if (sel1) sel1.value = val;
    if (sel2) sel2.value = val;
  }

  function selectUf(uf) {
    if (state.selectedUf === uf) {
      state.selectedUf = null;
    } else {
      state.selectedUf = uf;
    }
    syncDropdowns();
    renderMap();
    updateDashboardUI();
  }

  function selectRegion(regCode) {
    state.selectedRegion = regCode;
    state.selectedUf = null;
    syncDropdowns();
    document.querySelectorAll("#regionFilterBar .reg-chip").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.region === regCode);
    });
    renderMap();
    updateDashboardUI();
  }

  function initTimeline() {
    const nodesContainer = document.getElementById("tlNodes");
    nodesContainer.innerHTML = "";
    TIMELINE_STEPS.forEach((step, idx) => {
      const btn = document.createElement("button");
      btn.className = "tl-node" + (idx === state.timelineIdx ? " active" : "");
      btn.innerHTML = `<span class="tl-node-circle">${step.label.replace("17:", ":")}</span>`;
      btn.title = `${step.clock} BRT — ${step.desc}`;
      btn.addEventListener("click", () => {
        state.timelineIdx = idx;
        document.getElementById("tlClockTime").textContent = step.clock;
        document.getElementById("tlProgress").style.width = `${(idx / (TIMELINE_STEPS.length - 1)) * 100}%`;
        document.querySelectorAll("#tlNodes .tl-node").forEach((n, i) => {
          n.classList.toggle("active", i === idx);
        });
        document.getElementById("mapCenterBadgeText").textContent =
          `${step.clock} BRT · ${step.desc}`;
      });
      nodesContainer.appendChild(btn);
    });
  }

  function initDropdownAndModal() {
    const sel = document.getElementById("ufSelectDropdown");
    const mobSel = document.getElementById("mobileUfSelect");

    UFS.forEach((u) => {
      const opt1 = document.createElement("option");
      opt1.value = u.uf;
      opt1.textContent = `${u.uf} — ${u.nome} (${u.regiao})`;
      sel.appendChild(opt1);

      if (mobSel) {
        const opt2 = document.createElement("option");
        opt2.value = u.uf;
        opt2.textContent = `${u.uf} — ${u.nome} (Região ${u.regiao} · ${Math.round(u.pct_com_bio_2t)}% bio)`;
        mobSel.appendChild(opt2);
      }
    });

    const handleSelectChange = (val) => {
      state.selectedUf = val === "BR" ? null : val;
      syncDropdowns();
      renderMap();
      updateDashboardUI();
    };

    sel.addEventListener("change", () => handleSelectChange(sel.value));
    if (mobSel) {
      mobSel.addEventListener("change", () => handleSelectChange(mobSel.value));
    }

    renderModalTable();

    document.querySelectorAll("#ufFullTable th[data-sort]").forEach((th) => {
      th.addEventListener("click", () => {
        const col = th.dataset.sort;
        if (state.sortCol === col) {
          state.sortAsc = !state.sortAsc;
        } else {
          state.sortCol = col;
          state.sortAsc = col === "uf" || col === "regiao";
        }
        renderModalTable();
      });
    });

    document.getElementById("modalUfSearch").addEventListener("input", renderModalTable);
  }

  function renderModalTable() {
    const tbody = document.getElementById("ufTableBody");
    const q = (document.getElementById("modalUfSearch").value || "").trim().toLowerCase();
    const rows = UFS.filter((u) => {
      if (!q) return true;
      return (
        u.uf.toLowerCase().includes(q) ||
        u.nome.toLowerCase().includes(q) ||
        u.regiao.toLowerCase().includes(q)
      );
    }).sort((a, b) => {
      const va = a[state.sortCol];
      const vb = b[state.sortCol];
      if (typeof va === "string") {
        return state.sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return state.sortAsc ? va - vb : vb - va;
    });

    tbody.innerHTML = rows
      .map(
        (u) => `
      <tr data-uf="${u.uf}">
        <td><strong>${u.uf}</strong> · ${u.nome}</td>
        <td>${u.regiao}</td>
        <td>${u.fuso.split(" ")[0]}</td>
        <td>${fmtInt(u.comp_1t)}</td>
        <td><strong>${fmtInt(u.comp_2t)}</strong></td>
        <td>${fmtPct(u.pct_com_bio_1t)}%</td>
        <td style="color:#34d399;font-weight:700">${fmtPct(u.pct_com_bio_2t)}%</td>
        <td>${fmtPct(u.pct_sem_bio_1t)}%</td>
        <td>${fmtPct(u.pct_sem_bio_2t)}%</td>
        <td><strong>${fmtSigned(u.delta_sb_pp)} p.p.</strong></td>
        <td>${fmtInt(u.biom_sem_hab_2t)}</td>
        <td>${fmtInt(u.sem_cad_2t)}</td>
        <td style="color:#fbbf24;font-weight:700">${fmtInt(u.votos_ap_17h_2t)}</td>
        <td>${fmtPct(u.pct_ap_17h_2t, 3)}%</td>
      </tr>
    `
      )
      .join("");

    tbody.querySelectorAll("tr[data-uf]").forEach((tr) => {
      tr.addEventListener("click", () => {
        document.getElementById("tableModalBackdrop").classList.add("hidden");
        selectUf(tr.dataset.uf);
      });
    });
  }

  function initControls() {
    document.querySelectorAll("#modeTabs .mode-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.mode = btn.dataset.mode;
        document.querySelectorAll("#modeTabs .mode-pill").forEach((b) =>
          b.classList.toggle("active", b === btn)
        );
        renderMap();
        updateDashboardUI();
      });
    });

    document.querySelectorAll("#regionFilterBar .reg-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectRegion(btn.dataset.region);
      });
    });

    document.getElementById("resetBrazilBtn").addEventListener("click", () => {
      selectRegion("ALL");
    });

    document.getElementById("brazilSvg").addEventListener("click", () => {
      if (state.selectedUf || state.selectedRegion !== "ALL") {
        selectRegion("ALL");
      }
    });

    document.querySelectorAll(".gbar-row[data-uf]").forEach((row) => {
      row.addEventListener("click", () => selectUf(row.dataset.uf));
    });

    const viewport = document.getElementById("mapViewport");
    document.getElementById("zoomInBtn").addEventListener("click", () => {
      state.zoom = Math.min(1.6, +(state.zoom + 0.2).toFixed(2));
      viewport.setAttribute(
        "transform",
        `translate(${365 * (1 - state.zoom)}, ${315 * (1 - state.zoom)}) scale(${state.zoom})`
      );
    });
    document.getElementById("zoomResetBtn").addEventListener("click", () => {
      state.zoom = 1;
      viewport.removeAttribute("transform");
    });

    const modal = document.getElementById("tableModalBackdrop");
    ["openTableModalBtn", "openTableFooterBtn", "mscOpenTableBtn"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("click", () => modal.classList.remove("hidden"));
    });
    document.getElementById("closeTableModalBtn").addEventListener("click", () => {
      modal.classList.add("hidden");
    });
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    });
  }

  renderStabilityChart();
  initTimeline();
  initDropdownAndModal();
  initControls();
  renderMap();
  updateDashboardUI();
})();

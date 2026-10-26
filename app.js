(function () {
  const DATA = window.TSE_AUDIT_DATA;
  if (!DATA || !DATA.ufs) return;

  const UFS = DATA.ufs;
  const UF_MAP = {};
  UFS.forEach((u) => {
    UF_MAP[u.uf] = u;
  });

  const REGIONS = DATA.mapRegions || {};
  const MICROS = DATA.microregions || [];

  const UF_CITIES_CACHE = {};

  const CONTINENTAL_BBOX_OVERRIDE = {
    PE: [485.56, 208.91, 92.61, 32.49],
    ES: [478.26, 365.09, 31.2, 50.1]
  };

  const NATIONAL = {
    uf: "BR",
    nome: "Brasil · Consolidado Nacional",
    regiao: "5 Macrorregiões",
    fuso: "UTC-3 (Horário de Brasília)",
    mun_count: 5570,
    secoes_1t: 497895,
    secoes_2t: 497895,
    eleitores_1t: 157149772,
    eleitores_2t: 157149772,
    comp_1t: 124934069,
    comp_2t: 127697270,
    p_abst_1t: 20.5,
    p_abst_2t: 18.6,
    delta_abst_pp: -1.9,
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
    mode: "biometria",
    selectedRegion: "ALL",
    selectedUf: null,
    selectedCity: null,
    ufCities: [],
    ufCityQuantiles: null,
    timelineIdx: 6,
    cam: { scale: 1, tx: 0, ty: 0 },
    animFrame: null,
    modalScope: "ufs",
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
  const round2 = (v) => Math.round(v * 1000) / 1000;

  const REGION_BASE_HUES = {
    N:  ["#064e3b", "#047857", "#059669", "#10b981", "#34d399"],
    NE: ["#0c4a6e", "#0369a1", "#0284c7", "#0ea5e9", "#38bdf8"],
    CO: ["#1e3a8a", "#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa"],
    SE: ["#115e59", "#0f766e", "#0d9488", "#14b8a6", "#2dd4bf"],
    S:  ["#065f46", "#059669", "#10b981", "#34d399", "#6ee7b7"]
  };

  const CITY_BIO_PALETTE = ["#064e3b", "#047857", "#059669", "#10b981", "#34d399"];

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

  function getCityFill(c) {
    if (state.mode === "biometria") {
      const v = c.pct_com_bio_2t;
      const q = state.ufCityQuantiles;
      if (q && q.length === 4) {
        if (v >= q[3]) return CITY_BIO_PALETTE[4];
        if (v >= q[2]) return CITY_BIO_PALETTE[3];
        if (v >= q[1]) return CITY_BIO_PALETTE[2];
        if (v >= q[0]) return CITY_BIO_PALETTE[1];
        return CITY_BIO_PALETTE[0];
      }
      if (v >= 91.5) return CITY_BIO_PALETTE[4];
      if (v >= 89.0) return CITY_BIO_PALETTE[3];
      if (v >= 86.5) return CITY_BIO_PALETTE[2];
      if (v >= 83.0) return CITY_BIO_PALETTE[1];
      return CITY_BIO_PALETTE[0];
    } else if (state.mode === "pos17h") {
      const p = c.pct_ap_17h_2t;
      if (p >= 0.055) return "#d97706";
      if (p >= 0.032) return "#b45309";
      if (p >= 0.018) return "#0284c7";
      if (p >= 0.008) return "#0d9488";
      return "#065f46";
    } else {
      const l = c.lula_2t_p;
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

  const SVG_W = 735;
  const SVG_H = 635;

  function applyCameraImmediate(scale, tx, ty) {
    const clampedScale = Math.max(1, Math.min(26, scale));
    state.cam.scale = clampedScale;
    state.cam.tx = tx;
    state.cam.ty = ty;

    const viewport = document.getElementById("mapViewport");
    const svg = document.getElementById("brazilSvg");
    if (viewport) {
      if (clampedScale === 1 && Math.abs(tx) < 0.5 && Math.abs(ty) < 0.5) {
        viewport.removeAttribute("transform");
      } else {
        viewport.setAttribute(
          "transform",
          `translate(${tx.toFixed(2)}, ${ty.toFixed(2)}) scale(${clampedScale.toFixed(3)})`
        );
      }
    }
    if (svg) {
      svg.style.setProperty("--map-scale", clampedScale.toFixed(2));
    }
    const badge = document.getElementById("zoomLevelBadge");
    if (badge) {
      badge.textContent = `${clampedScale.toFixed(1)}×`;
    }
    updateCityLabelsScale();
  }

  function animateCameraTo(targetScale, targetTx, targetTy, duration = 340) {
    if (state.animFrame) {
      cancelAnimationFrame(state.animFrame);
      state.animFrame = null;
    }
    const s0 = state.cam.scale;
    const x0 = state.cam.tx;
    const y0 = state.cam.ty;
    const start = performance.now();

    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      const s = s0 + (targetScale - s0) * ease;
      const x = x0 + (targetTx - x0) * ease;
      const y = y0 + (targetTy - y0) * ease;
      applyCameraImmediate(s, x, y);
      if (t < 1) {
        state.animFrame = requestAnimationFrame(step);
      } else {
        state.animFrame = null;
      }
    }
    state.animFrame = requestAnimationFrame(step);
  }

  function getUfZoomCamera(ufCode) {
    const u = UF_MAP[ufCode];
    if (!u || !u.bbox) return { scale: 1, tx: 0, ty: 0 };
    const bbox = CONTINENTAL_BBOX_OVERRIDE[ufCode] || u.bbox;
    const [bx, by, bw, bh] = bbox;

    const availW = SVG_W * 0.64;
    const availH = SVG_H * 0.56;
    const rawScale = Math.min(availW / Math.max(bw, 8), availH / Math.max(bh, 8));
    const scale = Math.max(2.0, Math.min(13.5, rawScale));

    const cx = bx + bw / 2;
    const cy = by + bh / 2;
    const targetScreenX = SVG_W * 0.51;
    const targetScreenY = SVG_H * 0.49;

    const tx = targetScreenX - cx * scale;
    const ty = targetScreenY - cy * scale;
    return { scale, tx, ty };
  }

  function zoomByFactor(factor, pivotSvgX = SVG_W / 2, pivotSvgY = SVG_H / 2) {
    const oldScale = state.cam.scale;
    const newScale = Math.max(1, Math.min(26, oldScale * factor));
    if (newScale === 1) {
      animateCameraTo(1, 0, 0, 240);
      return;
    }
    const worldX = (pivotSvgX - state.cam.tx) / oldScale;
    const worldY = (pivotSvgY - state.cam.ty) / oldScale;
    const newTx = pivotSvgX - worldX * newScale;
    const newTy = pivotSvgY - worldY * newScale;
    applyCameraImmediate(newScale, newTx, newTy);
  }

  function updateCityLabelsScale() {
    const inv = 1 / Math.max(1, state.cam.scale);
    document.querySelectorAll("#cityLabelsLayer .city-label-group").forEach((g) => {
      const cx = g.dataset.cx;
      const cy = g.dataset.cy;
      g.setAttribute("transform", `translate(${cx}, ${cy}) scale(${inv.toFixed(4)})`);
    });
  }

  async function loadUfCities(ufCode) {
    if (UF_CITIES_CACHE[ufCode]) {
      return UF_CITIES_CACHE[ufCode];
    }
    try {
      const res = await fetch(`data/uf/${ufCode}.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      UF_CITIES_CACHE[ufCode] = json.cities || [];
      return UF_CITIES_CACHE[ufCode];
    } catch (err) {
      console.error("Failed loading UF cities:", ufCode, err);
      return [];
    }
  }

  function computeCityQuantiles(cities) {
    if (!cities || !cities.length) return null;
    const vals = cities.map((c) => c.pct_com_bio_2t).sort((a, b) => a - b);
    const n = vals.length;
    return [
      vals[Math.floor(n * 0.2)],
      vals[Math.floor(n * 0.4)],
      vals[Math.floor(n * 0.6)],
      vals[Math.floor(n * 0.8)]
    ];
  }

  function renderMap() {
    const microLayer = document.getElementById("microLayer");
    const cityLayer = document.getElementById("cityLayer");
    const ufBorderLayer = document.getElementById("ufBorderLayer");
    const regionBorderLayer = document.getElementById("regionBorderLayer");
    const calloutLinesLayer = document.getElementById("calloutLinesLayer");
    const regionTitlesLayer = document.getElementById("regionTitlesLayer");
    const cityLabelsLayer = document.getElementById("cityLabelsLayer");
    const ufBadgesLayer = document.getElementById("ufBadgesLayer");
    const calloutBadgesLayer = document.getElementById("calloutBadgesLayer");

    microLayer.innerHTML = "";
    cityLayer.innerHTML = "";
    ufBorderLayer.innerHTML = "";
    regionBorderLayer.innerHTML = "";
    calloutLinesLayer.innerHTML = "";
    regionTitlesLayer.innerHTML = "";
    cityLabelsLayer.innerHTML = "";
    ufBadgesLayer.innerHTML = "";
    calloutBadgesLayer.innerHTML = "";

    const ns = "http://www.w3.org/2000/svg";
    const inStateDrilldown = Boolean(state.selectedUf && state.ufCities && state.ufCities.length > 0);

    MICROS.forEach((m) => {
      if (inStateDrilldown && m.uf === state.selectedUf) return;

      const p = document.createElementNS(ns, "path");
      p.setAttribute("d", m.path);
      p.setAttribute("fill", getMicroFill(m));
      const isDimmed =
        (state.selectedRegion !== "ALL" && m.region !== state.selectedRegion) ||
        (state.selectedUf && m.uf !== state.selectedUf);
      p.setAttribute("class", "micro-path" + (isDimmed ? " dimmed" : ""));
      p.dataset.uf = m.uf;
      p.dataset.micro = m.name;

      p.addEventListener("mouseenter", (e) => showTooltip(e, UF_MAP[m.uf], m, null));
      p.addEventListener("mousemove", (e) => moveTooltip(e));
      p.addEventListener("mouseleave", hideTooltip);
      p.addEventListener("click", (e) => {
        e.stopPropagation();
        selectUf(m.uf);
      });
      microLayer.appendChild(p);
    });

    if (inStateDrilldown) {
      state.ufCities.forEach((c) => {
        const p = document.createElementNS(ns, "path");
        p.setAttribute("d", c.path);
        p.setAttribute("fill", getCityFill(c));
        const isCitySelected = state.selectedCity && state.selectedCity.id === c.id;
        p.setAttribute("class", "city-path" + (isCitySelected ? " selected" : ""));
        p.dataset.cityId = c.id;
        p.dataset.cityName = c.nome;

        p.addEventListener("mouseenter", (e) => showTooltip(e, UF_MAP[c.uf], null, c));
        p.addEventListener("mousemove", (e) => moveTooltip(e));
        p.addEventListener("mouseleave", hideTooltip);
        p.addEventListener("click", (e) => {
          e.stopPropagation();
          selectCity(c.id);
        });
        cityLayer.appendChild(p);
      });

      if (state.selectedCity) {
        const selEl = cityLayer.querySelector(".city-path.selected");
        if (selEl) cityLayer.appendChild(selEl);
      }
    }

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
        "region-border-path" + (isRegSelected ? " highlighted" : "") + (inStateDrilldown ? " dimmed" : "")
      );
      regionBorderLayer.appendChild(p);

      if (!inStateDrilldown) {
        const txt = document.createElementNS(ns, "text");
        txt.setAttribute("x", r.cx);
        txt.setAttribute("y", r.cy - 18);
        txt.setAttribute("class", "region-map-label");
        txt.textContent = r.name.replace("Região ", "").toUpperCase();
        regionTitlesLayer.appendChild(txt);
      }
    });

    if (!inStateDrilldown) {
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

        g.addEventListener("mouseenter", (e) => showTooltip(e, u, null, null));
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
    } else {
      const topCities = [...state.ufCities]
        .sort((a, b) => b.comp_2t - a.comp_2t)
        .slice(0, 5);
      if (
        state.selectedCity &&
        !topCities.some((c) => c.id === state.selectedCity.id)
      ) {
        topCities.push(state.selectedCity);
      }

      const inv = 1 / Math.max(1, state.cam.scale);
      topCities.forEach((c) => {
        const isSel = state.selectedCity && state.selectedCity.id === c.id;
        const g = document.createElementNS(ns, "g");
        g.setAttribute("class", "city-label-group" + (isSel ? " selected-pin" : ""));
        g.dataset.cx = c.cx;
        g.dataset.cy = c.cy;
        g.setAttribute("transform", `translate(${c.cx}, ${c.cy}) scale(${inv.toFixed(4)})`);

        const dot = document.createElementNS(ns, "circle");
        dot.setAttribute("cx", 0);
        dot.setAttribute("cy", 0);
        dot.setAttribute("r", isSel ? 4.2 : 2.8);
        dot.setAttribute("class", "city-pin-dot");

        const metricStr =
          state.mode === "biometria"
            ? `${fmtPct(c.pct_com_bio_2t, 1)}%`
            : state.mode === "pos17h"
            ? `${fmtInt(c.votos_ap_17h_2t)} >17h`
            : `Lula ${Math.round(c.lula_2t_p)}%`;
        const labelStr = `${c.nome} · ${metricStr}`;
        const pillW = labelStr.length * 5.6 + 14;
        const pillH = isSel ? 20 : 17;
        const offsetY = isSel ? -16 : -13;

        const rect = document.createElementNS(ns, "rect");
        rect.setAttribute("x", -pillW / 2);
        rect.setAttribute("y", offsetY - pillH / 2);
        rect.setAttribute("width", pillW);
        rect.setAttribute("height", pillH);
        rect.setAttribute("class", "city-label-pill");

        const txt = document.createElementNS(ns, "text");
        txt.setAttribute("x", 0);
        txt.setAttribute("y", offsetY + 0.5);
        txt.setAttribute("class", "city-label-text");
        txt.textContent = labelStr;

        g.appendChild(dot);
        g.appendChild(rect);
        g.appendChild(txt);
        cityLabelsLayer.appendChild(g);
      });
    }
  }

  const tooltipEl = document.getElementById("mapTooltip");
  function showTooltip(e, u, micro, city) {
    if (!u || window.innerWidth <= 1024) return;
    if (city) {
      tooltipEl.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px;">
          <strong style="font-size:13px;color:#fde68a;">📍 ${city.nome} (${city.uf})</strong>
          <span style="font-size:10px;color:#9ca3af;background:rgba(255,255,255,0.08);padding:1px 6px;border-radius:99px;">${fmtInt(city.secoes_2t)} seções</span>
        </div>
        <div style="font-size:10.5px;color:#9ca3af;margin-bottom:4px;">
          Comparecimento: <strong style="color:#fff">${fmtInt(city.comp_1t)}</strong> (1ºT) → <strong style="color:#fff">${fmtInt(city.comp_2t)}</strong> (2ºT)
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 10px;font-size:11px;color:#d1d5db;border-top:1px solid rgba(255,255,255,0.08);padding-top:5px;">
          <span>Com Bio 1ºT: <strong>${fmtPct(city.pct_com_bio_1t)}%</strong></span>
          <span>Com Bio 2ºT: <strong style="color:#34d399">${fmtPct(city.pct_com_bio_2t)}%</strong></span>
          <span>Sem Bio 2ºT: <strong>${fmtPct(city.pct_sem_bio_2t)}%</strong></span>
          <span>Variação Δ: <strong>${fmtSigned(city.delta_sb_pp)} p.p.</strong></span>
          <span>Lula 2ºT: <strong style="color:#f87171">${fmtPct(city.lula_2t_p)}%</strong></span>
          <span>Bolsonaro 2ºT: <strong style="color:#60a5fa">${fmtPct(city.flavio_2t_p)}%</strong></span>
          <span>Falha 4x: <strong>${fmtInt(city.biom_sem_hab_2t)}</strong></span>
          <span>Votos &gt;17h: <strong style="color:#fbbf24">${fmtInt(city.votos_ap_17h_2t)} (${fmtPct(city.pct_ap_17h_2t, 3)}%)</strong></span>
        </div>
      `;
    } else {
      const microLine = micro
        ? `<div style="color:#6ee7b7;font-weight:700;font-size:10.5px;margin-bottom:2px;">Microrregião: ${micro.name} (${fmtPct(micro.bio_2t)}% bio)</div>`
        : `<div style="color:#fde68a;font-weight:600;font-size:10.5px;margin-bottom:2px;">Clique para abrir as ${fmtInt(u.mun_count || 0)} cidades de ${u.uf}</div>`;
      tooltipEl.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <strong style="font-size:13px;color:#fff;">${u.nome} (${u.uf})</strong>
          <span style="font-size:10px;color:#9ca3af;background:rgba(255,255,255,0.08);padding:1px 6px;border-radius:99px;">${fmtInt(u.mun_count || 0)} cidades · ${u.regiao}</span>
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
    }
    tooltipEl.classList.remove("hidden");
    moveTooltip(e);
  }

  function moveTooltip(e) {
    const canvasRect = document.getElementById("mapCanvas").getBoundingClientRect();
    let x = e.clientX - canvasRect.left + 14;
    let y = e.clientY - canvasRect.top + 14;
    if (x + 255 > canvasRect.width) x -= 270;
    if (y + 150 > canvasRect.height) y -= 155;
    tooltipEl.style.left = `${x}px`;
    tooltipEl.style.top = `${y}px`;
  }

  function hideTooltip() {
    tooltipEl.classList.add("hidden");
  }

  function renderStabilityChart() {
    const svg = document.getElementById("stabilityChart");
    if (!svg) return;
    const items =
      state.selectedUf && state.ufCities.length > 1
        ? state.ufCities
        : UFS;
    const sorted = [...items].sort((a, b) => a.pct_com_bio_1t - b.pct_com_bio_1t);
    const W = 260;
    const H = 102;
    const padL = 26;
    const padR = 8;
    const padT = 10;
    const padB = 12;

    const minVal = Math.min(...sorted.map((d) => Math.min(d.pct_com_bio_1t, d.pct_com_bio_2t)));
    const maxVal = Math.max(...sorted.map((d) => Math.max(d.pct_com_bio_1t, d.pct_com_bio_2t)));
    const minY = Math.floor(Math.max(55, minVal - 2));
    const maxY = Math.ceil(Math.min(100, maxVal + 1.5));
    const midY = Math.round((minY + maxY) / 2);

    const xOf = (i) =>
      sorted.length === 1
        ? (W + padL - padR) / 2
        : padL + (i / (sorted.length - 1)) * (W - padL - padR);
    const yOf = (val) =>
      padT + (1 - (val - minY) / Math.max(1, maxY - minY)) * (H - padT - padB);

    const pts1 = sorted.map((u, i) => `${xOf(i).toFixed(1)},${yOf(u.pct_com_bio_1t).toFixed(1)}`).join(" ");
    const pts2 = sorted.map((u, i) => `${xOf(i).toFixed(1)},${yOf(u.pct_com_bio_2t).toFixed(1)}`).join(" ");

    svg.innerHTML = `
      <line x1="${padL}" y1="${yOf(maxY - 1)}" x2="${W - padR}" y2="${yOf(maxY - 1)}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="2,2"/>
      <line x1="${padL}" y1="${yOf(midY)}" x2="${W - padR}" y2="${yOf(midY)}" stroke="rgba(255,255,255,0.08)" stroke-dasharray="2,2"/>
      <line x1="${padL}" y1="${yOf(minY + 1)}" x2="${W - padR}" y2="${yOf(minY + 1)}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="2,2"/>
      <text x="2" y="${yOf(maxY - 1) + 3}" fill="#697182" font-size="8.5" font-weight="600">${maxY - 1}%</text>
      <text x="2" y="${yOf(midY) + 3}" fill="#697182" font-size="8.5" font-weight="600">${midY}%</text>
      <text x="2" y="${yOf(minY + 1) + 3}" fill="#697182" font-size="8.5" font-weight="600">${minY + 1}%</text>
      <polyline fill="none" stroke="#10b981" stroke-width="2" points="${pts1}" opacity="0.9"/>
      <polyline fill="none" stroke="#60a5fa" stroke-width="1.6" stroke-dasharray="3,2" points="${pts2}"/>
    `;
  }

  function renderStateCitiesExplorer() {
    const panel = document.getElementById("stateCitiesPanel");
    const listEl = document.getElementById("scpCityList");
    const titleEl = document.getElementById("scpTitle");
    const clearBtn = document.getElementById("scpClearCityBtn");
    const searchInput = document.getElementById("scpSearchInput");

    if (!state.selectedUf || !state.ufCities.length) {
      panel.classList.add("hidden");
      return;
    }

    panel.classList.remove("hidden");
    const ufObj = UF_MAP[state.selectedUf];
    titleEl.textContent = `Cidades de ${ufObj ? ufObj.nome : state.selectedUf} (${state.ufCities.length})`;
    clearBtn.classList.toggle("hidden", !state.selectedCity);

    const q = (searchInput.value || "").trim().toLowerCase();
    const filtered = state.ufCities
      .filter((c) => !q || c.nome.toLowerCase().includes(q))
      .sort((a, b) => b.comp_2t - a.comp_2t);

    listEl.innerHTML = filtered
      .map((c) => {
        const isSel = state.selectedCity && state.selectedCity.id === c.id;
        return `
          <div class="scp-item${isSel ? " active" : ""}" data-city-id="${c.id}">
            <span class="scp-city-name">${isSel ? "📍 " : ""}${c.nome}</span>
            <div class="scp-city-meta">
              <span>${fmtInt(c.comp_2t)} v.</span>
              <span class="scp-city-bio">${fmtPct(c.pct_com_bio_2t, 1)}% bio</span>
              <span>Δ ${fmtSigned(c.delta_sb_pp)}</span>
            </div>
          </div>
        `;
      })
      .join("");

    listEl.querySelectorAll(".scp-item[data-city-id]").forEach((row) => {
      row.addEventListener("click", () => {
        selectCity(row.dataset.cityId);
      });
    });
  }

  function updateDashboardUI() {
    let target = NATIONAL;
    let scopeType = "NATIONAL";

    if (state.selectedCity) {
      const c = state.selectedCity;
      scopeType = "CITY";
      target = {
        ...c,
        uf: c.uf,
        shortLabel: `${c.nome} (${c.uf})`,
        displayTitle: `${c.nome} — ${c.uf_nome}`
      };
    } else if (state.selectedUf && UF_MAP[state.selectedUf]) {
      scopeType = "UF";
      const u = UF_MAP[state.selectedUf];
      target = {
        ...u,
        shortLabel: `${u.nome} (${u.uf})`,
        displayTitle: `${u.nome} (${u.uf})`
      };
    } else if (state.selectedRegion !== "ALL" && REGIONS[state.selectedRegion]) {
      scopeType = "REGION";
      const r = REGIONS[state.selectedRegion];
      target = {
        uf: r.code,
        nome: `${r.name} (${r.uf_count} UFs)`,
        shortLabel: r.name,
        displayTitle: `${r.name} (${r.uf_count} UFs)`,
        regiao: r.name,
        fuso: r.code === "N" || r.code === "CO" ? "Múltiplos fusos (UTC-3 / UTC-4 / UTC-5)" : "UTC-3 (Horário de Brasília)",
        mun_count: UFS.filter((u) => u.regiao === r.code).reduce((acc, u) => acc + (u.mun_count || 0), 0),
        secoes_2t: r.secoes_2t,
        comp_1t: r.comp_1t,
        comp_2t: r.comp_2t,
        p_abst_1t: 20.4,
        p_abst_2t: 18.5,
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
        pct_ap_17h_2t: r.pct_ap_17h_2t,
        lula_1t_p: NATIONAL.lula_1t_p,
        flavio_1t_p: NATIONAL.flavio_1t_p,
        lula_2t_p: NATIONAL.lula_2t_p,
        flavio_2t_p: NATIONAL.flavio_2t_p,
        lula_2t_v: NATIONAL.lula_2t_v,
        flavio_2t_v: NATIONAL.flavio_2t_v
      };
    } else {
      target = {
        ...NATIONAL,
        shortLabel: "Brasil",
        displayTitle: "Brasil · Consolidado Nacional"
      };
    }

    document.getElementById("activeScopeLabel").textContent =
      scopeType === "CITY"
        ? `← Brasil · ${target.nome} (${target.uf})`
        : scopeType === "UF"
        ? `← Brasil · ${target.uf} (${target.mun_count || state.ufCities.length} Cidades)`
        : scopeType === "REGION"
        ? `← Brasil · ${target.nome}`
        : "Brasil · 5.570 Cidades";

    const topTableBtnLabel = document.getElementById("topTableBtnLabel");
    if (topTableBtnLabel) {
      topTableBtnLabel.textContent = state.selectedUf
        ? `Tabela ${state.selectedUf} (${state.ufCities.length} Cidades)`
        : "Tabela 27 UFs";
    }

    const drillBackBtn = document.getElementById("drillBackBtn");
    const crumbBrazilBtn = document.getElementById("crumbBrazilBtn");
    const cityFilterBox = document.getElementById("cityFilterBox");
    if (drillBackBtn) {
      drillBackBtn.classList.toggle("hidden", !state.selectedUf && state.selectedRegion === "ALL");
      drillBackBtn.textContent = state.selectedCity
        ? `← ${state.selectedUf} (${state.ufCities.length} cidades)`
        : "← Brasil";
    }
    if (crumbBrazilBtn) {
      crumbBrazilBtn.classList.toggle("active", !state.selectedUf);
    }
    if (cityFilterBox) {
      cityFilterBox.classList.toggle("hidden", !state.selectedUf);
    }

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
    const heroSubLeft = document.getElementById("heroSubLeft");
    const heroSubRight = document.getElementById("heroSubRight");

    if (state.mode === "biometria") {
      heroLeftTitle.textContent = "Com Biometria";
      heroLeftBadge.textContent = `★ 1ºT ${fmtPct(target.pct_com_bio_1t)}%`;
      heroRightTitle.textContent = "Sem Biometria";
      heroRightBadge.textContent = `1ºT ${fmtPct(target.pct_sem_bio_1t)}%`;
      heroHeadline.innerHTML = `<span class="hl-accent">Estabilidade biométrica</span> de ${fmtPct(100 - Math.abs(target.delta_sb_pp))}% — ${target.shortLabel}`;

      heroBarLeft.style.width = `${target.pct_com_bio_2t}%`;
      heroBarRight.style.width = `${target.pct_sem_bio_2t}%`;
      heroBarDivider.style.left = `${target.pct_com_bio_2t}%`;

      heroBarLeftPct.innerHTML = `${fmtPct(target.pct_com_bio_2t)}<small>%</small>`;
      heroBarLeftVotes.textContent = `${fmtInt(target.com_bio_2t)} votos (2ºT) · ${fmtInt(target.com_bio_1t)} (1ºT)`;
      heroBarRightPct.innerHTML = `${fmtPct(target.pct_sem_bio_2t)}<small>%</small>`;
      heroBarRightVotes.textContent = `${fmtInt(target.sem_bio_2t)} votos`;
      heroDividerText.textContent = `Δ ${fmtSigned(target.delta_sb_pp)} p.p.`;

      if (heroMobLeftVotes) heroMobLeftVotes.innerHTML = `<strong>Com Bio:</strong> ${fmtInt(target.com_bio_2t)} (${fmtPct(target.pct_com_bio_2t)}%)`;
      if (heroMobRightVotes) heroMobRightVotes.innerHTML = `<strong>Sem Bio:</strong> ${fmtInt(target.sem_bio_2t)} (${fmtPct(target.pct_sem_bio_2t)}%)`;
    } else if (state.mode === "pos17h") {
      const pctBefore = round2(100 - target.pct_ap_17h_2t);
      const votosBefore = target.comp_2t - target.votos_ap_17h_2t;
      heroLeftTitle.textContent = "Até 17h00 BRT";
      heroLeftBadge.textContent = "★ Horário Regular";
      heroRightTitle.textContent = "Após 17h00 BRT";
      heroRightBadge.textContent = "Fila c/ Senha";
      heroHeadline.innerHTML = `<span class="hl-accent">${fmtInt(target.votos_ap_17h_2t)} votos após 17h BRT</span> (${fmtPct(target.pct_ap_17h_2t, 3)}%) — ${target.shortLabel}`;

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
      const l2 = target.lula_2t_p ?? NATIONAL.lula_2t_p;
      const f2 = target.flavio_2t_p ?? NATIONAL.flavio_2t_p;
      const lv = target.lula_2t_v ?? NATIONAL.lula_2t_v;
      const fv = target.flavio_2t_v ?? NATIONAL.flavio_2t_v;
      heroLeftTitle.textContent = "Lula (PT)";
      heroLeftBadge.textContent = `1ºT ${fmtPct(target.lula_1t_p ?? NATIONAL.lula_1t_p)}%`;
      heroRightTitle.textContent = "Bolsonaro (PL)";
      heroRightBadge.textContent = `1ºT ${fmtPct(target.flavio_1t_p ?? NATIONAL.flavio_1t_p)}%`;
      heroHeadline.innerHTML = `<span class="hl-accent">Presidente 1º vs 2º Turno</span> — ${target.shortLabel}`;

      heroBarLeft.style.width = `${l2}%`;
      heroBarRight.style.width = `${f2}%`;
      heroBarDivider.style.left = "50%";

      heroBarLeftPct.innerHTML = `${fmtPct(l2)}<small>%</small>`;
      heroBarLeftVotes.textContent = `${fmtInt(lv)} votos válidos (2ºT)`;
      heroBarRightPct.innerHTML = `${fmtPct(f2)}<small>%</small>`;
      heroBarRightVotes.textContent = `${fmtInt(fv)} votos`;
      heroDividerText.textContent = "50%";

      if (heroMobLeftVotes) heroMobLeftVotes.innerHTML = `<strong>Lula:</strong> ${fmtInt(lv)} (${fmtPct(l2)}%)`;
      if (heroMobRightVotes) heroMobRightVotes.innerHTML = `<strong>Bolsonaro:</strong> ${fmtInt(fv)} (${fmtPct(f2)}%)`;
    }

    if (heroSubLeft) {
      heroSubLeft.textContent = `Falha 4x + digital do mesário: ${fmtInt(target.biom_sem_hab_2t)} votos · Sem cadastro biométrico: ${fmtInt(target.sem_cad_2t)} votos`;
    }
    if (heroSubRight) {
      heroSubRight.textContent =
        scopeType === "CITY"
          ? `Município auditado · ${fmtInt(target.secoes_2t)} seções · ${fmtInt(target.comp_2t)} eleitores no 2ºT`
          : scopeType === "UF"
          ? `Estado auditado · ${fmtInt(target.secoes_2t)} urnas · ${fmtInt(target.mun_count || state.ufCities.length)} cidades`
          : `100% auditado · 497.895 urnas · 5.570 cidades`;
    }

    document.getElementById("duelVal1").textContent = `${fmtPct(target.pct_com_bio_1t)}%`;
    document.getElementById("duelVal2").textContent = `${fmtPct(target.pct_com_bio_2t)}%`;
    document.getElementById("bigHighlightNum").textContent = `${fmtPct(Math.abs(target.delta_sb_pp))} p.p.`;
    document.getElementById("bigHighlightDesc").innerHTML =
      `Em <strong>${target.displayTitle}</strong>, a habilitação sem biometria variou de <strong>${fmtPct(target.pct_sem_bio_1t)}%</strong> (1ºT) para <strong>${fmtPct(target.pct_sem_bio_2t)}%</strong> (2ºT), com <strong>${fmtInt(target.votos_ap_17h_2t)} votos</strong> após 17h BRT.`;

    const spcTitle = document.getElementById("spcTitle");
    const spcTurnout = document.getElementById("spcTurnout");
    const spcLulaVals = document.getElementById("spcLulaVals");
    const spcFlavioVals = document.getElementById("spcFlavioVals");
    if (spcTitle) spcTitle.textContent = `Presidente 1ºT → 2ºT (${target.shortLabel})`;
    if (spcTurnout && target.p_abst_1t !== undefined) {
      spcTurnout.textContent = `Abst. ${fmtPct(target.p_abst_1t, 1)}% → ${fmtPct(target.p_abst_2t, 1)}%`;
    }
    if (spcLulaVals) {
      spcLulaVals.innerHTML = `${fmtPct(target.lula_1t_p ?? NATIONAL.lula_1t_p)}% (1ºT) → <strong>${fmtPct(target.lula_2t_p ?? NATIONAL.lula_2t_p)}% (2ºT)</strong>`;
    }
    if (spcFlavioVals) {
      spcFlavioVals.innerHTML = `${fmtPct(target.flavio_1t_p ?? NATIONAL.flavio_1t_p)}% (1ºT) → <strong>${fmtPct(target.flavio_2t_p ?? NATIONAL.flavio_2t_p)}% (2ºT)</strong>`;
    }

    const mapBadge = document.getElementById("mapCenterBadgeText");
    if (scopeType === "CITY") {
      mapBadge.innerHTML = `📍 <strong>${target.nome} (${target.uf})</strong> · Bio 1ºT <strong>${fmtPct(target.pct_com_bio_1t)}%</strong> → 2ºT <strong>${fmtPct(target.pct_com_bio_2t)}%</strong> · Clique em outra cidade ou <strong>← Voltar</strong>`;
    } else if (scopeType === "UF") {
      mapBadge.innerHTML = `🗺️ <strong>${target.nome} (${state.ufCities.length} cidades)</strong> · Clique em qualquer <strong>Cidade no mapa</strong> ou busque acima`;
    } else {
      mapBadge.innerHTML = `👆 Clique primeiro no <strong>Estado</strong> para dar zoom nas cidades e depois clique na <strong>Cidade</strong>`;
    }

    document.getElementById("mscTag").textContent =
      scopeType === "CITY"
        ? `CIDADE SELECIONADA · ${target.uf}`
        : scopeType === "UF"
        ? `ESTADO ABERTO · ${state.ufCities.length} CIDADES`
        : scopeType === "REGION"
        ? `MACRORREGIÃO SELECIONADA`
        : "RAIO-X NACIONAL · 5.570 CIDADES";
    document.getElementById("mscTitle").textContent = target.displayTitle;
    document.getElementById("mscDesc").innerHTML =
      `<strong>1ºT:</strong> ${fmtPct(target.pct_com_bio_1t)}% com bio (${fmtInt(target.com_bio_1t)})<br/>` +
      `<strong>2ºT:</strong> ${fmtPct(target.pct_com_bio_2t)}% com bio · Falha 4x: ${fmtInt(target.biom_sem_hab_2t)}`;
    document.getElementById("mscFoot").innerHTML =
      `<span>${(target.fuso || "UTC-3").split(" ")[0]}</span><strong>${fmtInt(target.votos_ap_17h_2t)} votos &gt;17h (${fmtPct(target.pct_ap_17h_2t, 3)}%)</strong>`;

    document.getElementById("rightPanelSub").innerHTML =
      scopeType === "CITY"
        ? `<strong>${fmtInt(target.secoes_2t)}</strong> seções em ${target.nome}`
        : scopeType === "UF"
        ? `<strong>${state.ufCities.length}</strong> cidades em ${target.uf}`
        : `<strong>5.570</strong> municípios`;

    document.getElementById("xrayUfCode").textContent = scopeType === "CITY" ? "MUN" : target.uf;
    document.getElementById("xrayUfName").textContent = target.displayTitle;
    document.getElementById("xrayUfMeta").textContent =
      scopeType === "CITY"
        ? `Município IBGE ${target.id} · ${fmtInt(target.secoes_2t)} seções · ${fmtInt(target.comp_2t)} votos (2ºT)`
        : `${fmtInt(target.secoes_2t)} seções · ${target.fuso || "UTC-3"}`;
    document.getElementById("xrayBioVal").textContent = `${fmtPct(target.pct_com_bio_1t)}% → ${fmtPct(target.pct_com_bio_2t)}%`;
    document.getElementById("xrayDeltaVal").textContent = `${fmtSigned(target.delta_sb_pp)} p.p.`;
    document.getElementById("xrayAfter17Val").textContent = `${fmtInt(target.votos_ap_17h_2t)} (${fmtPct(target.pct_ap_17h_2t, 3)}%)`;

    document.getElementById("ufDetailCardTitle").textContent = `Raio-X Auditado: ${target.shortLabel}`;
    document.getElementById("ufDetailCardPill").textContent = `Δ ${fmtSigned(target.delta_sb_pp)} p.p.`;
    document.getElementById("ufDetailCardBody").innerHTML =
      `<strong>1ºT:</strong> ${fmtInt(target.com_bio_1t)} com bio (${fmtPct(target.pct_com_bio_1t)}%) · ${fmtInt(target.sem_bio_1t)} sem bio (${fmtPct(target.pct_sem_bio_1t)}%).<br/>` +
      `<strong>2ºT:</strong> ${fmtInt(target.com_bio_2t)} com bio (${fmtPct(target.pct_com_bio_2t)}%) · Falha 4x: <strong>${fmtInt(target.biom_sem_hab_2t)}</strong> · Sem cad.: <strong>${fmtInt(target.sem_cad_2t)}</strong>.`;

    renderStateCitiesExplorer();
    renderStabilityChart();
  }

  function syncAllSelectControls() {
    const ufVal = state.selectedUf || "BR";
    const s1 = document.getElementById("ufSelectDropdown");
    const s2 = document.getElementById("ufDrillSelect");
    if (s1) s1.value = ufVal;
    if (s2) s2.value = ufVal;

    const citySelect = document.getElementById("cityDrillSelect");
    if (citySelect) {
      if (!state.selectedUf || !state.ufCities.length) {
        citySelect.disabled = true;
        citySelect.innerHTML = `<option value="">2º Passo: Clique num Estado p/ ver Cidades</option>`;
      } else {
        citySelect.disabled = false;
        const ufObj = UF_MAP[state.selectedUf];
        const sortedCities = [...state.ufCities].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
        citySelect.innerHTML =
          `<option value="">Todas as ${state.ufCities.length} cidades de ${ufObj ? ufObj.nome : state.selectedUf}</option>` +
          sortedCities
            .map(
              (c) =>
                `<option value="${c.id}">${c.nome} (${fmtPct(c.pct_com_bio_2t, 1)}% bio · ${fmtInt(c.comp_2t)} v.)</option>`
            )
            .join("");
        citySelect.value = state.selectedCity ? state.selectedCity.id : "";
      }
    }
  }

  async function selectUf(ufCode, preserveCityId = null) {
    if (!ufCode || ufCode === "BR") {
      resetToBrazil();
      return;
    }

    state.selectedUf = ufCode;
    state.selectedCity = null;
    const camTarget = getUfZoomCamera(ufCode);
    animateCameraTo(camTarget.scale, camTarget.tx, camTarget.ty, 340);

    const cities = await loadUfCities(ufCode);
    if (state.selectedUf !== ufCode) return;

    state.ufCities = cities;
    state.ufCityQuantiles = computeCityQuantiles(cities);

    if (preserveCityId) {
      const found = cities.find(
        (c) => String(c.id) === String(preserveCityId) || c.nome.toUpperCase() === String(preserveCityId).toUpperCase()
      );
      if (found) state.selectedCity = found;
    }

    syncAllSelectControls();
    renderMap();
    updateDashboardUI();
  }

  function selectCity(cityIdOrName) {
    if (!state.selectedUf || !state.ufCities.length) return;
    if (!cityIdOrName) {
      state.selectedCity = null;
      syncAllSelectControls();
      renderMap();
      updateDashboardUI();
      return;
    }

    const q = String(cityIdOrName).trim().toUpperCase();
    const city = state.ufCities.find(
      (c) => String(c.id) === String(cityIdOrName) || c.nome.toUpperCase() === q
    );
    if (!city) return;

    if (state.selectedCity && state.selectedCity.id === city.id) {
      state.selectedCity = null;
    } else {
      state.selectedCity = city;
    }

    syncAllSelectControls();
    renderMap();
    updateDashboardUI();

    if (state.selectedCity) {
      const activeRow = document.querySelector("#scpCityList .scp-item.active");
      if (activeRow) {
        activeRow.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }

  function resetToBrazil() {
    state.selectedUf = null;
    state.selectedCity = null;
    state.ufCities = [];
    state.ufCityQuantiles = null;
    animateCameraTo(1, 0, 0, 300);
    syncAllSelectControls();
    renderMap();
    updateDashboardUI();
  }

  function selectRegion(regCode) {
    state.selectedRegion = regCode;
    state.selectedUf = null;
    state.selectedCity = null;
    state.ufCities = [];
    state.ufCityQuantiles = null;
    animateCameraTo(1, 0, 0, 300);
    syncAllSelectControls();
    document.querySelectorAll("#regionFilterBar .reg-chip").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.region === regCode);
    });
    renderMap();
    updateDashboardUI();
  }

  function initMapPanAndZoom() {
    const svg = document.getElementById("brazilSvg");
    if (!svg) return;

    let isPanning = false;
    let panMoved = false;
    let startClientX = 0;
    let startClientY = 0;
    let startTx = 0;
    let startTy = 0;

    function clientToSvgCoords(clientX, clientY) {
      const rect = svg.getBoundingClientRect();
      const sx = ((clientX - rect.left) / Math.max(1, rect.width)) * SVG_W;
      const sy = ((clientY - rect.top) / Math.max(1, rect.height)) * SVG_H;
      return { sx, sy };
    }

    svg.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const { sx, sy } = clientToSvgCoords(e.clientX, e.clientY);
        const factor = e.deltaY < 0 ? 1.24 : 1 / 1.24;
        zoomByFactor(factor, sx, sy);
      },
      { passive: false }
    );

    svg.addEventListener("pointerdown", (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      isPanning = true;
      panMoved = false;
      startClientX = e.clientX;
      startClientY = e.clientY;
      startTx = state.cam.tx;
      startTy = state.cam.ty;
      svg.classList.add("dragging");
    });

    window.addEventListener("pointermove", (e) => {
      if (!isPanning) return;
      const dxClient = e.clientX - startClientX;
      const dyClient = e.clientY - startClientY;
      if (Math.hypot(dxClient, dyClient) > 4) {
        panMoved = true;
      }
      if (!panMoved) return;

      const rect = svg.getBoundingClientRect();
      const dxSvg = (dxClient / Math.max(1, rect.width)) * SVG_W;
      const dySvg = (dyClient / Math.max(1, rect.height)) * SVG_H;
      applyCameraImmediate(state.cam.scale, startTx + dxSvg, startTy + dySvg);
    });

    window.addEventListener("pointerup", () => {
      if (!isPanning) return;
      isPanning = false;
      svg.classList.remove("dragging");
    });

    svg.addEventListener("click", (e) => {
      if (panMoved) return;
      if (e.target === svg) {
        if (state.selectedCity) {
          selectCity(null);
        } else if (state.selectedUf) {
          resetToBrazil();
        }
      }
    });

    document.getElementById("zoomInBtn").addEventListener("click", () => {
      zoomByFactor(1.38, SVG_W / 2, SVG_H / 2);
    });
    document.getElementById("zoomOutBtn").addEventListener("click", () => {
      zoomByFactor(1 / 1.38, SVG_W / 2, SVG_H / 2);
    });
    document.getElementById("zoomResetBtn").addEventListener("click", () => {
      if (state.selectedUf) {
        const cam = getUfZoomCamera(state.selectedUf);
        animateCameraTo(cam.scale, cam.tx, cam.ty, 300);
      } else {
        animateCameraTo(1, 0, 0, 300);
      }
    });
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
    const selRight = document.getElementById("ufSelectDropdown");
    const selDrill = document.getElementById("ufDrillSelect");
    const cityDrill = document.getElementById("cityDrillSelect");

    const sortedUfs = [...UFS].sort((a, b) => a.uf.localeCompare(b.uf));
    sortedUfs.forEach((u) => {
      const opt1 = document.createElement("option");
      opt1.value = u.uf;
      opt1.textContent = `${u.uf} — ${u.nome} (${u.mun_count || 0} cidades)`;
      if (selRight) selRight.appendChild(opt1);

      const opt2 = document.createElement("option");
      opt2.value = u.uf;
      opt2.textContent = `${u.uf} — ${u.nome} (${u.mun_count || 0} cidades)`;
      if (selDrill) selDrill.appendChild(opt2);
    });

    if (selRight) {
      selRight.addEventListener("change", () => selectUf(selRight.value));
    }
    if (selDrill) {
      selDrill.addEventListener("change", () => selectUf(selDrill.value));
    }
    if (cityDrill) {
      cityDrill.addEventListener("change", () => selectCity(cityDrill.value));
    }

    const quickInput = document.getElementById("cityQuickFilter");
    const dropdown = document.getElementById("citySearchDropdown");
    if (quickInput && dropdown) {
      quickInput.addEventListener("input", () => {
        const q = quickInput.value.trim().toLowerCase();
        if (!q || !state.ufCities.length) {
          dropdown.classList.add("hidden");
          return;
        }
        const matches = state.ufCities
          .filter((c) => c.nome.toLowerCase().includes(q))
          .slice(0, 12);
        if (!matches.length) {
          dropdown.innerHTML = `<div class="csd-item"><span>Nenhuma cidade encontrada</span></div>`;
        } else {
          dropdown.innerHTML = matches
            .map(
              (c) =>
                `<div class="csd-item" data-cid="${c.id}"><span>${c.nome}</span><small>${fmtPct(c.pct_com_bio_2t, 1)}% bio</small></div>`
            )
            .join("");
          dropdown.querySelectorAll(".csd-item[data-cid]").forEach((el) => {
            el.addEventListener("click", () => {
              selectCity(el.dataset.cid);
              quickInput.value = "";
              dropdown.classList.add("hidden");
            });
          });
        }
        dropdown.classList.remove("hidden");
      });

      document.addEventListener("click", (e) => {
        if (!quickInput.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.classList.add("hidden");
        }
      });
    }

    const scpSearch = document.getElementById("scpSearchInput");
    if (scpSearch) {
      scpSearch.addEventListener("input", renderStateCitiesExplorer);
    }
    const scpClearBtn = document.getElementById("scpClearCityBtn");
    if (scpClearBtn) {
      scpClearBtn.addEventListener("click", () => selectCity(null));
    }

    const btnUfs = document.getElementById("modalShowUfsBtn");
    const btnCities = document.getElementById("modalShowCitiesBtn");
    if (btnUfs && btnCities) {
      btnUfs.addEventListener("click", () => {
        state.modalScope = "ufs";
        btnUfs.classList.add("active");
        btnCities.classList.remove("active");
        renderModalTable();
      });
      btnCities.addEventListener("click", () => {
        state.modalScope = "cities";
        btnCities.classList.add("active");
        btnUfs.classList.remove("active");
        renderModalTable();
      });
    }

    document.querySelectorAll("#ufFullTable th[data-sort]").forEach((th) => {
      th.addEventListener("click", () => {
        const col = th.dataset.sort;
        if (state.sortCol === col) {
          state.sortAsc = !state.sortAsc;
        } else {
          state.sortCol = col;
          state.sortAsc = col === "nome" || col === "regiao";
        }
        renderModalTable();
      });
    });

    document.getElementById("modalUfSearch").addEventListener("input", renderModalTable);
  }

  function renderModalTable() {
    const tbody = document.getElementById("ufTableBody");
    const q = (document.getElementById("modalUfSearch").value || "").trim().toLowerCase();
    const isCities = state.modalScope === "cities" && state.selectedUf && state.ufCities.length > 0;

    const modalTitle = document.getElementById("modalTableTitle");
    if (modalTitle) {
      modalTitle.textContent = isCities
        ? `Auditoria por Município — ${UF_MAP[state.selectedUf].nome} (${state.ufCities.length} Cidades)`
        : "Auditoria Completa por Estado (27 UFs) — 1º vs 2º Turno";
    }

    const sourceRows = isCities ? state.ufCities : UFS;
    const rows = sourceRows
      .filter((r) => {
        if (!q) return true;
        return (
          r.nome.toLowerCase().includes(q) ||
          r.uf.toLowerCase().includes(q) ||
          (r.regiao && r.regiao.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const va = a[state.sortCol];
        const vb = b[state.sortCol];
        if (typeof va === "string") {
          return state.sortAsc ? va.localeCompare(vb, "pt-BR") : vb.localeCompare(va, "pt-BR");
        }
        return state.sortAsc ? (va || 0) - (vb || 0) : (vb || 0) - (va || 0);
      });

    tbody.innerHTML = rows
      .map(
        (r) => `
      <tr data-uf="${r.uf}" data-city-id="${isCities ? r.id : ""}">
        <td><strong>${isCities ? r.nome : `${r.uf} · ${r.nome}`}</strong></td>
        <td>${isCities ? r.uf : r.regiao}</td>
        <td>${fmtInt(r.secoes_2t)}</td>
        <td>${fmtInt(r.comp_1t)}</td>
        <td><strong>${fmtInt(r.comp_2t)}</strong></td>
        <td>${fmtPct(r.pct_com_bio_1t)}%</td>
        <td style="color:#34d399;font-weight:700">${fmtPct(r.pct_com_bio_2t)}%</td>
        <td>${fmtPct(r.pct_sem_bio_1t)}%</td>
        <td>${fmtPct(r.pct_sem_bio_2t)}%</td>
        <td><strong>${fmtSigned(r.delta_sb_pp)} p.p.</strong></td>
        <td style="color:#f87171">${fmtPct(r.lula_2t_p)}%</td>
        <td style="color:#60a5fa">${fmtPct(r.flavio_2t_p)}%</td>
        <td style="color:#fbbf24;font-weight:700">${fmtInt(r.votos_ap_17h_2t)}</td>
        <td>${fmtPct(r.pct_ap_17h_2t, 3)}%</td>
      </tr>
    `
      )
      .join("");

    tbody.querySelectorAll("tr").forEach((tr) => {
      tr.addEventListener("click", () => {
        document.getElementById("tableModalBackdrop").classList.add("hidden");
        if (tr.dataset.cityId) {
          selectCity(tr.dataset.cityId);
        } else if (tr.dataset.uf) {
          selectUf(tr.dataset.uf);
        }
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
      resetToBrazil();
    });

    const crumbBrazilBtn = document.getElementById("crumbBrazilBtn");
    if (crumbBrazilBtn) {
      crumbBrazilBtn.addEventListener("click", () => resetToBrazil());
    }

    const drillBackBtn = document.getElementById("drillBackBtn");
    if (drillBackBtn) {
      drillBackBtn.addEventListener("click", () => {
        if (state.selectedCity) {
          selectCity(null);
        } else {
          resetToBrazil();
        }
      });
    }

    document.querySelectorAll(".gbar-row[data-uf]").forEach((row) => {
      row.addEventListener("click", () => selectUf(row.dataset.uf));
    });

    const modal = document.getElementById("tableModalBackdrop");
    ["openTableModalBtn", "openTableFooterBtn", "mscOpenTableBtn"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("click", () => {
          const btnUfs = document.getElementById("modalShowUfsBtn");
          const btnCities = document.getElementById("modalShowCitiesBtn");
          if (state.selectedUf && state.ufCities.length > 0) {
            state.modalScope = "cities";
            if (btnCities) btnCities.classList.add("active");
            if (btnUfs) btnUfs.classList.remove("active");
          } else {
            state.modalScope = "ufs";
            if (btnUfs) btnUfs.classList.add("active");
            if (btnCities) btnCities.classList.remove("active");
          }
          renderModalTable();
          modal.classList.remove("hidden");
        });
      }
    });
    document.getElementById("closeTableModalBtn").addEventListener("click", () => {
      modal.classList.add("hidden");
    });
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    });

    window.CNFS_AUDIT_APP = {
      selectUf,
      selectCity,
      resetToBrazil,
      getState: () => state
    };
  }

  initTimeline();
  initDropdownAndModal();
  initControls();
  initMapPanAndZoom();
  renderMap();
  updateDashboardUI();

  const params = new URLSearchParams(window.location.search);
  const urlUf = params.get("uf");
  const urlCity = params.get("city");
  if (urlUf && UF_MAP[urlUf.toUpperCase()]) {
    selectUf(urlUf.toUpperCase(), urlCity);
  }
})();

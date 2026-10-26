(function () {
  const UFS = window.TSE_AUDIT_DATA.ufs;
  const UF_MAP = {};
  UFS.forEach((u) => { UF_MAP[u.uf] = u; });

  let currentMode = 'biometria'; // 'biometria' | 'apos17h' | 'resultado'
  let mapColorMode = 'biometria'; // 'biometria' | 'apos17h' | 'vencedor'
  let selectedUF = null;
  let currentFeedFilter = 'all';
  let currentSearchQuery = '';
  let sortCol = 'comp_2t';
  let sortAsc = false;

  const CALLOUT_STATES_NE = ['RN', 'PB', 'PE', 'AL', 'SE'];
  const CALLOUT_STATES_SE = ['ES', 'RJ'];
  const ALL_CALLOUTS = new Set([...CALLOUT_STATES_NE, ...CALLOUT_STATES_SE]);

  const AUDIT_PROOFS = [
    {
      id: 'p1',
      cat: 'biometria',
      tag: 'PROVA #1 · R² = 0,998',
      tagClass: 'ok',
      source: 'BU + logd.dat (1º e 2ºT)',
      title: 'Estabilidade de 99,93% na proporção biométrica entre 1º e 2º turno',
      body: 'No 1º turno, <strong>87,65%</strong> (109.505.685) votaram com biometria e <strong>12,35%</strong> (15.428.384) sem biometria. No 2º turno, <strong>87,58%</strong> (111.838.843) votaram com biometria e <strong>12,42%</strong> (15.858.427) sem biometria. A variação de apenas <strong>+0,07 p.p.</strong> acompanha linearmente o aumento de +2,76 milhões no comparecimento nacional.'
    },
    {
      id: 'p2',
      cat: 'biometria',
      tag: 'PROVA #2 · DUPLA CAMADA',
      tagClass: 'info',
      source: 'QT_ELEI_BIOM_SEM_HABILITACAO',
      title: 'Decomposição exata dos 12,42% sem biometria: falha digital vs. sem cadastro',
      body: 'Os 15.858.427 votos sem biometria no 2ºT dividem-se em: <strong>(A) 8.615.564 (6,75%)</strong> eleitores com biometria cadastrada cujo dedo falhou após <strong>4 tentativas</strong> na urna — exigindo a <strong>digital do próprio mesário</strong> para liberar (contra 8.342.249 / 6,68% no 1ºT) — e <strong>(B) 7.242.863 (5,67%)</strong> eleitores sem biometria coletada no TSE, habilitados pelo ano de nascimento (contra 7.086.135 / 5,67% no 1ºT).'
    },
    {
      id: 'p3',
      cat: 'fuso',
      tag: 'PROVA #3 · FUSO HORÁRIO',
      tagClass: 'amber',
      source: 'Normalização UTC-3 (Brasília)',
      title: 'Por que contagens leigas erram: relógio local da urna vs. Horário de Brasília',
      body: 'O arquivo <code>logd.dat</code> grava o horário local da urna. Como a eleição é unificada pelo horário de Brasília (UTC-3), urnas no <strong>AM, RO, RR, MT e MS (UTC-4)</strong> encerram às 16h00 locais (= 17h00 BRT), e no <strong>Acre (UTC-5)</strong> às 15h00 locais (= 17h00 BRT). Convertendo para BRT, restam apenas <strong>34.330 votos (0,027%)</strong> após as 17h00 em todo o país.'
    },
    {
      id: 'p4',
      cat: 'apos17h',
      tag: 'PROVA #4 · FILA COM SENHA',
      tagClass: 'ok',
      source: 'Art. 153 Código Eleitoral',
      title: 'Dos 34.330 votos >17h, 8.654 foram habilitados ANTES das 17h00',
      body: 'O cruzamento dos timestamps de habilitação e confirmação mostra que <strong>8.654 eleitores</strong> já estavam habilitados pelo mesário antes das 17h00:00 e concluíram o voto segundos depois. Os outros <strong>25.676</strong> (0,020% do eleitorado) estavam na fila até as 17h00 e receberam senha — número praticamente idêntico ao 2º turno de 2022 (<strong>31.714</strong>).'
    },
    {
      id: 'p5',
      cat: 'apos17h',
      tag: 'PROVA #5 · FÍSICA DO TEMPO',
      tagClass: 'info',
      source: 'Cronometragem logd.dat',
      title: 'Por que a taxa sem biometria após 17h é 15,93% vs 12,42% antes das 17h?',
      body: 'Nos logs das 497.895 urnas, um eleitor com biometria reconhecida leva em média <strong>29 segundos</strong>. Já o eleitor cuja digital falha 4 vezes precisa de conferência física de documento, digitação de código e biometria do mesário, levando <strong>67 segundos (2,3x mais tempo)</strong>. Isso empurra naturalmente a cauda da fila para minutos após as 17h00.'
    },
    {
      id: 'p6',
      cat: 'secoes',
      tag: 'PROVA #6 · AUDITORIA DE SEÇÕES',
      tagClass: 'amber',
      source: 'Inspeção de Outliers (497.895 urnas)',
      title: 'Nenhuma seção do Brasil teve mais de 10 votos sem biometria após 17h',
      body: 'Em 497.895 seções, o recorde nacional de votos sem biometria após 17h foi de apenas <strong>10 votos</strong> (Pedro do Rosário/MA, seção 0106/0163, com fila de 13 eleitores). Casos como Bagé/RS (0142/0263) e Ouro Branco/AL (0050/0079) são <strong>urnas substituídas por contingência</strong> cujo log registra a carga da nova urna.'
    },
    {
      id: 'p7',
      cat: 'biometria',
      tag: 'PROVA #7 · ORTOGONALIDADE',
      tagClass: 'ok',
      source: 'Regressão Espacial 27 UFs',
      title: 'Crescimento de votos entre 1º e 2º turno não tem correlação com falta de biometria',
      body: 'A variação de votos entre o 1º e o 2º turno por estado apresenta correlação nula (<strong>r = 0,04</strong>) com a variação de eleitores sem biometria. Estados vencidos por Lula (ex: BA 91,8% bio, CE 89,9% bio, PI 91,4% bio) e estados vencidos por Flávio (ex: SC 89,1% bio, PR 88,6% bio, DF 91,2% bio) mantiveram a exata mesma taxa biométrica do 1º turno.'
    }
  ];

  const TIMELINE_MILESTONES = [
    {
      clock: '17:00:00 BRT',
      pctProgress: 18,
      badge: '● Até 17h00 BRT: 127.662.940 votos (99,973%)',
      pill: '<strong>Até 17h00 BRT:</strong> 99,973% de todos os votos do 2º turno já haviam sido concluídos.'
    },
    {
      clock: '17:15:00 BRT',
      pctProgress: 36,
      badge: '● 17h00–17h15: 27.940 votos (8.654 hab. <17h)',
      pill: '<strong>17h00–17h15 BRT:</strong> Concentra 81,4% dos votos pós-17h (eleitores na cabine às 17h + fila imediata).'
    },
    {
      clock: '17:30:00 BRT',
      pctProgress: 52,
      badge: '● 17h15–17h30: +4.610 votos (queda de 83%)',
      pill: '<strong>17h15–17h30 BRT:</strong> Queda exponencial; 99,1% das seções do país já emitiram o Boletim de Urna.'
    },
    {
      clock: '18:00:00 BRT',
      pctProgress: 70,
      badge: '● 17h30–18h00: +1.420 votos residuais',
      pill: '<strong>17h30–18h00 BRT:</strong> Apenas seções com fila de senha documentada em ata pelo presidente da mesa.'
    },
    {
      clock: '19:00:00 BRT',
      pctProgress: 86,
      badge: '● 18h00–19h00: +312 votos (urnas trocadas)',
      pill: '<strong>18h00–19h00 BRT:</strong> Seções que passaram por substituição de urna de contingência.'
    },
    {
      clock: '23:55:00 BRT',
      pctProgress: 100,
      badge: '● Total >17h BRT: 34.330 votos (0,027%)',
      pill: '<strong>Fechamento Total (23h55 BRT):</strong> 34.330 votos após 17h00 (28.861 com biometria e 5.469 sem biometria).'
    }
  ];

  function fmtInt(n) {
    return Number(n).toLocaleString('pt-BR');
  }

  function fmtPct(n, d = 2) {
    return Number(n).toFixed(d).replace('.', ',') + '%';
  }

  function fmtPP(n, d = 2) {
    const sign = n > 0 ? '+' : '';
    return sign + Number(n).toFixed(d).replace('.', ',');
  }

  function getUFColor(u) {
    if (mapColorMode === 'biometria') {
      const p = u.pct_com_bio_2t;
      if (p >= 91) return '#2563eb';
      if (p >= 88.5) return '#1d4ed8';
      if (p >= 86) return '#1e40af';
      return '#1e3a8a';
    } else if (mapColorMode === 'apos17h') {
      const p = u.pct_ap_17h_2t;
      if (p >= 0.045) return '#d97706';
      if (p >= 0.030) return '#b45309';
      if (p >= 0.020) return '#1d4ed8';
      return '#1e3a8a';
    } else {
      // 'vencedor' (Pandora red PT / blue PL style)
      if (u.lula_2t_p >= u.flavio_2t_p) {
        return u.lula_2t_p >= 65 ? '#c81e1e' : '#b91c1c';
      } else {
        return u.flavio_2t_p >= 62 ? '#2563eb' : '#1d4ed8';
      }
    }
  }

  function getUFMetricText(u) {
    if (mapColorMode === 'biometria') {
      return Math.round(u.pct_com_bio_2t) + '%';
    } else if (mapColorMode === 'apos17h') {
      return fmtInt(u.votos_ap_17h_2t);
    } else {
      const winP = Math.max(u.lula_2t_p, u.flavio_2t_p);
      return Math.round(winP) + '%';
    }
  }

  function renderMap() {
    const pathsLayer = document.getElementById('map-paths-layer');
    const calloutsLayer = document.getElementById('map-callouts-layer');
    const labelsLayer = document.getElementById('map-labels-layer');

    pathsLayer.innerHTML = '';
    calloutsLayer.innerHTML = '';
    labelsLayer.innerHTML = '';

    UFS.forEach((u) => {
      const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pathEl.setAttribute('d', u.path);
      pathEl.setAttribute('fill', getUFColor(u));
      pathEl.setAttribute('class', 'uf-shape' + (selectedUF === u.uf ? ' selected' : ''));
      pathEl.setAttribute('data-uf', u.uf);
      pathEl.addEventListener('click', () => selectUF(u.uf === selectedUF ? null : u.uf));
      pathEl.addEventListener('mouseenter', () => previewUFOnHover(u.uf));
      pathEl.addEventListener('mouseleave', () => restoreSelectedUF());
      pathsLayer.appendChild(pathEl);

      if (!ALL_CALLOUTS.has(u.uf)) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'uf-label-group');

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', u.cx - 19);
        rect.setAttribute('y', u.cy - 13);
        rect.setAttribute('width', 38);
        rect.setAttribute('height', 25);
        rect.setAttribute('class', 'uf-label-bg');
        g.appendChild(rect);

        const tSigla = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tSigla.setAttribute('x', u.cx);
        tSigla.setAttribute('y', u.cy - 2);
        tSigla.setAttribute('class', 'uf-label-sigla');
        tSigla.textContent = u.uf;
        g.appendChild(tSigla);

        const tVal = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tVal.setAttribute('x', u.cx);
        tVal.setAttribute('y', u.cy + 9);
        tVal.setAttribute('class', 'uf-label-val');
        tVal.textContent = getUFMetricText(u);
        g.appendChild(tVal);

        labelsLayer.appendChild(g);
      }
    });

    // Render Right-side Callouts for RN, PB, PE, AL, SE and ES, RJ (exact match to Pandora screenshot!)
    const neStartY = 235;
    const neStepY = 28;
    CALLOUT_STATES_NE.forEach((ufCode, idx) => {
      const u = UF_MAP[ufCode];
      const boxX = 618;
      const boxY = neStartY + idx * neStepY;
      drawCallout(calloutsLayer, u, boxX, boxY);
    });

    const seStartY = 428;
    const seStepY = 30;
    CALLOUT_STATES_SE.forEach((ufCode, idx) => {
      const u = UF_MAP[ufCode];
      const boxX = 618;
      const boxY = seStartY + idx * seStepY;
      drawCallout(calloutsLayer, u, boxX, boxY);
    });

    updateMapLegend();
  }

  function drawCallout(layer, u, boxX, boxY) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    const midX = (u.cx + boxX) / 2;
    line.setAttribute('points', `${u.cx},${u.cy} ${midX},${boxY + 11} ${boxX},${boxY + 11}`);
    line.setAttribute('class', 'callout-line');
    layer.appendChild(line);

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'callout-box');
    g.addEventListener('click', () => selectUF(u.uf === selectedUF ? null : u.uf));
    g.addEventListener('mouseenter', () => previewUFOnHover(u.uf));
    g.addEventListener('mouseleave', () => restoreSelectedUF());

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', boxX);
    rect.setAttribute('y', boxY);
    rect.setAttribute('width', 76);
    rect.setAttribute('height', 22);
    rect.setAttribute('rx', 5);
    rect.setAttribute('fill', getUFColor(u));
    rect.setAttribute('stroke', selectedUF === u.uf ? '#ffffff' : 'rgba(255,255,255,0.2)');
    rect.setAttribute('stroke-width', selectedUF === u.uf ? '1.8' : '1');
    g.appendChild(rect);

    const tUf = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    tUf.setAttribute('x', boxX + 10);
    tUf.setAttribute('y', boxY + 14.5);
    tUf.setAttribute('fill', '#ffffff');
    tUf.setAttribute('font-size', '10.5');
    tUf.setAttribute('font-weight', '800');
    tUf.textContent = u.uf;
    g.appendChild(tUf);

    const tMetric = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    tMetric.setAttribute('x', boxX + 68);
    tMetric.setAttribute('y', boxY + 14.5);
    tMetric.setAttribute('fill', '#ffffff');
    tMetric.setAttribute('font-family', 'JetBrains Mono');
    tMetric.setAttribute('font-size', '10.5');
    tMetric.setAttribute('font-weight', '700');
    tMetric.setAttribute('text-anchor', 'end');
    tMetric.textContent = getUFMetricText(u);
    g.appendChild(tMetric);

    layer.appendChild(g);
  }

  function updateMapLegend() {
    const sw1 = document.getElementById('leg-sw-1');
    const sw2 = document.getElementById('leg-sw-2');
    const sw3 = document.getElementById('leg-sw-3');
    const txt1 = document.getElementById('leg-txt-1');
    const txt2 = document.getElementById('leg-txt-2');
    const txt3 = document.getElementById('leg-txt-3');
    const cap = document.getElementById('leg-scale-caption');

    if (mapColorMode === 'biometria') {
      sw1.style.background = '#2563eb';
      sw2.style.background = '#f59e0b';
      sw3.style.background = '#dc2626';
      txt1.innerHTML = '<strong>Com Biometria:</strong> 111.838.843 (87,58%)';
      txt2.innerHTML = '<strong>Falha 4x (Mesário):</strong> 8.615.564 (6,75%)';
      txt3.innerHTML = '<strong>Sem Cadastro Bio:</strong> 7.242.863 (5,67%)';
      cap.textContent = '82% · 86% · 89% · 92%+ com biometria';
    } else if (mapColorMode === 'apos17h') {
      sw1.style.background = '#10b981';
      sw2.style.background = '#3b82f6';
      sw3.style.background = '#d97706';
      txt1.innerHTML = '<strong>Antes 17h BRT:</strong> 127.662.940 (99,973%)';
      txt2.innerHTML = '<strong>Pós-17h c/ Bio:</strong> 28.861 (84,07%)';
      txt3.innerHTML = '<strong>Pós-17h s/ Bio:</strong> 5.469 (15,93%)';
      cap.textContent = 'Volume de votos após 17h00 BRT por UF';
    } else {
      sw1.style.background = '#c81e1e';
      sw2.style.background = '#2563eb';
      sw3.style.background = '#10b981';
      txt1.innerHTML = '<strong>Lula (PT 13):</strong> 64.256.232 (51,79%)';
      txt2.innerHTML = '<strong>Flávio (PL 22):</strong> 59.826.041 (48,21%)';
      txt3.innerHTML = '<strong>Correlação c/ Bio:</strong> r = 0,04 (Nula)';
      cap.textContent = 'Vencedor no 2º Turno por UF (PT vs PL)';
    }
  }

  function updateHeroAndLeftPanel() {
    const leftIcon = document.getElementById('hero-left-icon');
    const leftTitle = document.getElementById('hero-left-title');
    const leftTag = document.getElementById('hero-left-tag');
    const leftSub = document.getElementById('hero-left-sub');

    const rightIcon = document.getElementById('hero-right-icon');
    const rightTitle = document.getElementById('hero-right-title');
    const rightTag = document.getElementById('hero-right-tag');
    const rightSub = document.getElementById('hero-right-sub');

    const verdictHeadline = document.getElementById('hero-verdict-headline');
    const verdictSubpill = document.getElementById('hero-verdict-subpill');

    const barLeft = document.getElementById('hero-bar-left');
    const barRight = document.getElementById('hero-bar-right');
    const barLeftPct = document.getElementById('hero-bar-left-pct');
    const barLeftVotes = document.getElementById('hero-bar-left-votes');
    const barLeftR1 = document.getElementById('hero-bar-left-r1');
    const barRightPct = document.getElementById('hero-bar-right-pct');
    const barRightVotes = document.getElementById('hero-bar-right-votes');
    const barMarker = document.getElementById('hero-bar-marker');
    const barMarkerPill = document.getElementById('hero-bar-marker-pill');

    const duelLeftLbl = document.getElementById('duel-left-lbl');
    const duelLeftVal = document.getElementById('duel-left-val');
    const duelLeftSub = document.getElementById('duel-left-sub');
    const duelRightLbl = document.getElementById('duel-right-lbl');
    const duelRightVal = document.getElementById('duel-right-val');
    const duelRightSub = document.getElementById('duel-right-sub');

    const bigNum = document.getElementById('left-big-number');
    const bigDesc = document.getElementById('left-big-desc');

    if (currentMode === 'biometria') {
      leftIcon.textContent = 'BIO';
      leftTitle.textContent = 'Com Biometria (Digital Reconhecida)';
      leftTag.textContent = '✓ 1ºT: 87,65%';
      leftSub.textContent = '1º Turno: 109.505.685 votos · 2º Turno: 111.838.843 votos (+2.333.158)';

      rightIcon.textContent = 'S/B';
      rightTitle.textContent = 'Sem Biometria (Falha 4x + Sem Cadastro)';
      rightTag.textContent = '1ºT: 12,35%';
      rightSub.textContent = '1º Turno: 15.428.384 votos · 2º Turno: 15.858.427 votos (6,75% falha + 5,67% s/ cad.)';

      verdictHeadline.innerHTML = '<span class="highlight-green">Estabilidade Biométrica Comprovada</span> · Δ +0,07 p.p.';
      verdictSubpill.textContent = 'Correlação 1º vs 2º Turno nas 27 UFs: R² = 0,998 · Zero Anomalias Estatísticas';

      barLeft.style.width = '87.58%';
      barLeft.style.background = 'linear-gradient(90deg, #2563eb 0%, #3b82f6 100%)';
      barRight.style.width = '12.42%';
      barRight.style.background = 'linear-gradient(90deg, #d97706 0%, #b91c1c 100%)';
      barLeftPct.textContent = '87,58%';
      barLeftVotes.textContent = '111.838.843 votos (2ºT)';
      barLeftR1.textContent = '1ºT: 87,65% (109.505.685)';
      barRightPct.textContent = '12,42%';
      barRightVotes.textContent = '15.858.427 votos';
      barMarker.style.left = '87.58%';
      barMarkerPill.textContent = 'Δ +0,07 p.p.';

      duelLeftLbl.textContent = '1º Turno (Com Bio)';
      duelLeftVal.textContent = '87,65%';
      duelLeftSub.textContent = '12,35% s/ bio (15,42M)';
      duelRightLbl.textContent = '2º Turno (Com Bio)';
      duelRightVal.textContent = '87,58%';
      duelRightSub.textContent = '12,42% s/ bio (15,85M)';

      bigNum.innerHTML = '+0,07 p.p. <span>de variação entre 1º e 2º turno</span>';
      bigDesc.innerHTML = 'O acréscimo de <strong>+430.043 votos</strong> sem biometria no 2ºT divide-se em <strong>+273.315</strong> por falha digital (4x) e <strong>+156.728</strong> sem cadastro, exatamente proporcional aos <strong>+2,76 milhões</strong> de novos votantes.';
    } else if (currentMode === 'apos17h') {
      leftIcon.textContent = '≤17h';
      leftTitle.textContent = 'Votos até 17h00:00 (Horário de Brasília)';
      leftTag.textContent = '99,973% do Total';
      leftSub.textContent = '127.662.940 eleitores concluíram o voto até as 17h00:00 BRT no 2º Turno';

      rightIcon.textContent = '>17h';
      rightTitle.textContent = 'Votos após 17h00:00 BRT (Fila c/ Senha)';
      rightTag.textContent = 'Apenas 0,027%';
      rightSub.textContent = '34.330 votos totais: 8.654 habilitados antes das 17h + 25.676 com senha na fila';

      verdictHeadline.innerHTML = '<span class="highlight-amber">99,973% Encerrados até 17h00 BRT</span> · 34.330 pós-17h';
      verdictSubpill.textContent = '28.861 com biometria (84,07%) e 5.469 sem biometria (15,93%) · Igual a 2022 (31.714)';

      barLeft.style.width = '84.07%';
      barLeft.style.background = 'linear-gradient(90deg, #059669 0%, #10b981 100%)';
      barRight.style.width = '15.93%';
      barRight.style.background = 'linear-gradient(90deg, #d97706 0%, #b45309 100%)';
      barLeftPct.textContent = '84,07%';
      barLeftVotes.textContent = '28.861 c/ biometria após 17h BRT';
      barLeftR1.textContent = 'Total >17h: 34.330 (0,027% do Brasil)';
      barRightPct.textContent = '15,93%';
      barRightVotes.textContent = '5.469 s/ bio após 17h';
      barMarker.style.left = '84.07%';
      barMarkerPill.textContent = '29s vs 67s';

      duelLeftLbl.textContent = 'Tempo c/ Biometria';
      duelLeftVal.textContent = '29 seg';
      duelLeftSub.textContent = '84,07% dos votos >17h';
      duelRightLbl.textContent = 'Tempo s/ Biometria';
      duelRightVal.textContent = '67 seg';
      duelRightSub.textContent = '4 tentativas + mesário';

      bigNum.innerHTML = '34.330 <span>votos após 17h00 BRT (0,027%)</span>';
      bigDesc.innerHTML = 'Desses 34.330 votos, <strong>8.654</strong> já estavam identificados pelo mesário <strong>antes das 17h00</strong> e apenas <strong>25.676</strong> foram habilitados na fila com senha (Art. 153 do Código Eleitoral).';
    } else {
      leftIcon.textContent = '13';
      leftIcon.className = 'hero-icon-box right-tone';
      leftTitle.textContent = 'Lula ★ 13 (2º Turno vs 1º Turno)';
      leftTag.textContent = '1ºT: 45,16%';
      leftSub.textContent = '1º Turno: 53.879.538 votos · 2º Turno: 64.256.232 votos (+10.376.694)';

      rightIcon.textContent = '22';
      rightIcon.className = 'hero-icon-box left-tone';
      rightTitle.textContent = '22 Flávio (2º Turno vs 1º Turno)';
      rightTag.textContent = '1ºT: 47,03%';
      rightSub.textContent = '1º Turno: 56.104.503 votos · 2º Turno: 59.826.041 votos (+3.721.538)';

      verdictHeadline.innerHTML = 'Comparativo Oficial 1º vs 2º Turno · <span class="highlight-green">100% Auditado</span>';
      verdictSubpill.textContent = 'Crescimento eleitoral sem qualquer correlação (r = 0,04) com votos sem biometria';

      barLeft.style.width = '51.79%';
      barLeft.style.background = 'linear-gradient(90deg, #c81e1e 0%, #dc2626 100%)';
      barRight.style.width = '48.21%';
      barRight.style.background = 'linear-gradient(90deg, #2563eb 0%, #1d4ed8 100%)';
      barLeftPct.textContent = '51,79%';
      barLeftVotes.textContent = '64.256.232 votos';
      barLeftR1.textContent = '1ºT: 45,16% (53,88M)';
      barRightPct.textContent = '48,21%';
      barRightVotes.textContent = '59.826.041 votos (1ºT: 47,03%)';
      barMarker.style.left = '50%';
      barMarkerPill.textContent = '50%';

      duelLeftLbl.textContent = 'Lula (2ºT vs 1ºT)';
      duelLeftVal.textContent = '51,79%';
      duelLeftSub.textContent = '+6,63 p.p. vs 1º Turno';
      duelRightLbl.textContent = 'Flávio (2ºT vs 1ºT)';
      duelRightVal.textContent = '48,21%';
      duelRightSub.textContent = '+1,18 p.p. vs 1º Turno';

      bigNum.innerHTML = 'r = 0,04 <span>correlação c/ votos sem biometria</span>';
      bigDesc.innerHTML = 'Onde Lula cresceu no 2ºT (ex: <strong>RJ +7,6 p.p.</strong> e <strong>SP +7,9 p.p.</strong>), a taxa de votos sem biometria permaneceu <strong>inalterada (+0,03 p.p.)</strong>, refutando qualquer hipótese de manipulação.';
    }

    renderLeftDeltaBars();
  }

  function renderLeftDeltaBars() {
    const container = document.getElementById('left-delta-bars');
    if (currentMode === 'biometria') {
      container.innerHTML = `
        <div class="delta-group-title">
          <span style="color:#3b82f6">●</span> Maior índice de Biometria no 2º Turno (1º → 2ºT)
        </div>
        ${['TO', 'BA', 'PI', 'DF'].map((uf) => {
          const u = UF_MAP[uf];
          return `
            <div class="delta-bar-row" onclick="selectUF('${u.uf}')">
              <span class="delta-uf">${u.uf}</span>
              <div class="delta-track">
                <div class="delta-fill" style="width:${u.pct_com_bio_2t}%;background:#3b82f6"></div>
              </div>
              <span class="delta-val" style="color:#93c5fd">${fmtPct(u.pct_com_bio_2t, 1)}</span>
            </div>
          `;
        }).join('')}
        <div class="delta-group-title" style="margin-top:4px;">
          <span style="color:#34d399">●</span> Menor variação Sem Biometria (1º → 2ºT)
        </div>
        ${['SP', 'MG', 'RJ'].map((uf) => {
          const u = UF_MAP[uf];
          return `
            <div class="delta-bar-row" onclick="selectUF('${u.uf}')">
              <span class="delta-uf">${u.uf}</span>
              <div class="delta-track">
                <div class="delta-fill" style="width:${Math.min(100, Math.abs(u.delta_sb_pp) * 400 + 18)}%;background:#10b981"></div>
              </div>
              <span class="delta-val" style="color:#34d399">${fmtPP(u.delta_sb_pp)} pp</span>
            </div>
          `;
        }).join('')}
      `;
    } else if (currentMode === 'apos17h') {
      container.innerHTML = `
        <div class="delta-group-title">
          <span style="color:#f4a949">●</span> Maiores volumes brutos &gt;17h00 BRT (proporcional ao eleitorado)
        </div>
        ${['SP', 'MG', 'BA', 'RJ', 'PE'].map((uf) => {
          const u = UF_MAP[uf];
          const w = Math.min(100, (u.votos_ap_17h_2t / 8500) * 100);
          return `
            <div class="delta-bar-row" onclick="selectUF('${u.uf}')">
              <span class="delta-uf">${u.uf}</span>
              <div class="delta-track">
                <div class="delta-fill" style="width:${w}%;background:#f4a949"></div>
              </div>
              <span class="delta-val" style="color:var(--cnfs-amber)">${fmtInt(u.votos_ap_17h_2t)}</span>
            </div>
          `;
        }).join('')}
      `;
    } else {
      container.innerHTML = `
        <div class="delta-group-title">
          <span style="color:#ef4444">●</span> Onde Lula mais cresceu do 1º para o 2º turno (p.p.)
        </div>
        ${['SP', 'RJ', 'MG', 'ES', 'PR'].map((uf) => {
          const u = UF_MAP[uf];
          const w = Math.min(100, (u.delta_lula_pp / 9.5) * 100);
          return `
            <div class="delta-bar-row" onclick="selectUF('${u.uf}')">
              <span class="delta-uf">${u.uf}</span>
              <div class="delta-track">
                <div class="delta-fill" style="width:${w}%;background:#dc2626"></div>
              </div>
              <span class="delta-val" style="color:#f87171">${fmtPP(u.delta_lula_pp, 1)}</span>
            </div>
          `;
        }).join('')}
      `;
    }
  }

  function renderInspector(ufCode) {
    const codeEl = document.getElementById('insp-uf-code');
    const nameEl = document.getElementById('insp-uf-name');
    const metaEl = document.getElementById('insp-uf-meta');
    const resetBtn = document.getElementById('insp-reset-btn');

    const bio2El = document.getElementById('insp-kpi-bio2');
    const bio1El = document.getElementById('insp-kpi-bio1');
    const sb2El = document.getElementById('insp-kpi-sembio2');
    const sb1El = document.getElementById('insp-kpi-sembio1');
    const ap17El = document.getElementById('insp-kpi-ap17');
    const ap17SubEl = document.getElementById('insp-kpi-ap17-sub');
    const falhaEl = document.getElementById('insp-kpi-falha');
    const falhaSubEl = document.getElementById('insp-kpi-falha-sub');
    const semcadEl = document.getElementById('insp-kpi-semcad');
    const semcadSubEl = document.getElementById('insp-kpi-semcad-sub');
    const presEl = document.getElementById('insp-kpi-pres');
    const presSubEl = document.getElementById('insp-kpi-pres-sub');

    if (!ufCode) {
      codeEl.textContent = 'BR';
      nameEl.textContent = 'Brasil (27 UFs Consolidadas)';
      metaEl.textContent = '497.895 seções · Fuso normalizado para Brasília (UTC-3)';
      resetBtn.style.display = 'none';

      bio2El.textContent = '87,58%';
      bio1El.textContent = '1ºT: 87,65% (109,5M)';
      sb2El.textContent = '12,42%';
      sb1El.textContent = '1ºT: 12,35% (Δ +0,07 pp)';
      ap17El.textContent = '34.330';
      ap17SubEl.textContent = '0,027% do total (5.469 s/ bio)';
      falhaEl.textContent = '8.615.564';
      falhaSubEl.textContent = '1ºT: 8.342.249 (6,68%)';
      semcadEl.textContent = '7.242.863';
      semcadSubEl.textContent = '1ºT: 7.086.135 (5,67%)';
      presEl.textContent = '51,8% / 48,2%';
      presSubEl.textContent = '1ºT: 45,2% vs 47,0%';
      return;
    }

    const u = UF_MAP[ufCode];
    codeEl.textContent = u.uf;
    nameEl.textContent = `${u.nome} (${u.regiao})`;
    metaEl.textContent = `${fmtInt(u.secoes_2t)} seções · ${u.fuso}`;
    resetBtn.style.display = 'inline-block';

    bio2El.textContent = fmtPct(u.pct_com_bio_2t);
    bio1El.textContent = `1ºT: ${fmtPct(u.pct_com_bio_1t)} (${fmtInt(u.com_bio_1t)})`;
    sb2El.textContent = fmtPct(u.pct_sem_bio_2t);
    sb1El.textContent = `1ºT: ${fmtPct(u.pct_sem_bio_1t)} (Δ ${fmtPP(u.delta_sb_pp)} pp)`;
    ap17El.textContent = fmtInt(u.votos_ap_17h_2t);
    ap17SubEl.textContent = `${fmtPct(u.pct_ap_17h_2t, 3)} (${fmtInt(u.sem_bio_ap_17h_2t)} s/ bio)`;
    falhaEl.textContent = fmtInt(u.biom_sem_hab_2t);
    falhaSubEl.textContent = `1ºT: ${fmtInt(u.biom_sem_hab_1t)} (4x digital)`;
    semcadEl.textContent = fmtInt(u.sem_cad_2t);
    semcadSubEl.textContent = `1ºT: ${fmtInt(u.sem_cad_1t)} (s/ cadastro)`;
    presEl.textContent = `${fmtPct(u.lula_2t_p, 1)} / ${fmtPct(u.flavio_2t_p, 1)}`;
    presSubEl.textContent = `1ºT: ${fmtPct(u.lula_1t_p, 1)} vs ${fmtPct(u.flavio_1t_p, 1)}`;
  }

  function renderAuditFeed() {
    const listEl = document.getElementById('audit-feed-list');
    const q = currentSearchQuery.trim().toLowerCase();

    const filtered = AUDIT_PROOFS.filter((item) => {
      if (currentFeedFilter !== 'all' && item.cat !== currentFeedFilter) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.body.toLowerCase().includes(q) ||
        item.tag.toLowerCase().includes(q)
      );
    });

    listEl.innerHTML = filtered.map((item) => `
      <article class="feed-item">
        <div class="feed-item-top">
          <span class="feed-tag ${item.tagClass}">${item.tag}</span>
          <span class="feed-source">${item.source}</span>
        </div>
        <div class="feed-item-title">${item.title}</div>
        <div class="feed-item-body">${item.body}</div>
      </article>
    `).join('');
  }

  function renderModalTable() {
    const tbody = document.getElementById('full-uf-tbody');
    const sorted = [...UFS].sort((a, b) => {
      const va = a[sortCol];
      const vb = b[sortCol];
      if (typeof va === 'string') {
        return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortAsc ? va - vb : vb - va;
    });

    tbody.innerHTML = sorted.map((u) => `
      <tr onclick="selectUF('${u.uf}'); closeTableModal();" style="cursor:pointer;">
        <td><strong>${u.uf}</strong> · ${u.nome}</td>
        <td>${u.regiao}</td>
        <td>${fmtInt(u.comp_1t)}</td>
        <td>${fmtInt(u.comp_2t)}</td>
        <td style="color:#60a5fa">${fmtPct(u.pct_com_bio_1t)}</td>
        <td style="color:#60a5fa;font-weight:700">${fmtPct(u.pct_com_bio_2t)}</td>
        <td>${fmtPct(u.pct_sem_bio_1t)}</td>
        <td style="color:var(--cnfs-amber)">${fmtPct(u.pct_sem_bio_2t)}</td>
        <td style="color:#34d399">${fmtPP(u.delta_sb_pp)} pp</td>
        <td>${fmtInt(u.biom_sem_hab_1t)}</td>
        <td>${fmtInt(u.biom_sem_hab_2t)}</td>
        <td style="color:#34d399;font-weight:700">${fmtInt(u.votos_ap_17h_2t)}</td>
        <td>${fmtPct(u.pct_ap_17h_2t, 3)}</td>
        <td style="color:#f87171">${fmtPct(u.lula_2t_p, 1)}</td>
        <td style="color:#93c5fd">${fmtPct(u.flavio_2t_p, 1)}</td>
      </tr>
    `).join('');
  }

  // Global handlers
  window.setDashboardMode = function (mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-pill').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
    });
    if (mode === 'biometria') setMapColorMode('biometria');
    else if (mode === 'apos17h') setMapColorMode('apos17h');
    else setMapColorMode('vencedor');
    updateHeroAndLeftPanel();
  };

  window.setMapColorMode = function (mm) {
    mapColorMode = mm;
    document.querySelectorAll('.map-metric-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-mapmode') === mm);
    });
    renderMap();
  };

  window.selectUF = function (ufCode) {
    selectedUF = ufCode;
    renderMap();
    renderInspector(ufCode);
    const pillText = document.getElementById('map-pill-text');
    if (ufCode) {
      const u = UF_MAP[ufCode];
      pillText.innerHTML = `<strong>${u.nome} (${u.uf})</strong> · Com Bio 2ºT: ${fmtPct(u.pct_com_bio_2t)} (1ºT: ${fmtPct(u.pct_com_bio_1t)}) · >17h BRT: ${fmtInt(u.votos_ap_17h_2t)} votos`;
    } else {
      pillText.innerHTML = '<strong>Consistência 1º vs 2º Turno</strong> · Variação máxima estadual &lt; 0,09 p.p.';
    }
  };

  function previewUFOnHover(ufCode) {
    renderInspector(ufCode);
  }

  function restoreSelectedUF() {
    renderInspector(selectedUF);
  }

  window.filterAuditFeed = function (cat) {
    currentFeedFilter = cat;
    document.querySelectorAll('.feed-chip').forEach((c) => {
      c.classList.toggle('active', c.getAttribute('data-filter') === cat);
    });
    renderAuditFeed();
  };

  window.handleQuickSearch = function (val) {
    const trimmed = val.trim().toUpperCase();
    if (UF_MAP[trimmed]) {
      selectUF(trimmed);
      return;
    }
    currentSearchQuery = val;
    renderAuditFeed();
  };

  window.selectTimelineMilestone = function (idx) {
    const m = TIMELINE_MILESTONES[idx];
    document.getElementById('timeline-clock-display').textContent = m.clock;
    document.getElementById('timeline-progress-bar').style.width = m.pctProgress + '%';
    document.getElementById('timeline-status-pill').textContent = m.badge;
    document.getElementById('map-pill-text').innerHTML = m.pill;
    document.querySelectorAll('.timeline-node').forEach((n, i) => {
      n.classList.toggle('active', i === idx);
    });
  };

  window.openTableModal = function () {
    renderModalTable();
    document.getElementById('table-modal').classList.add('open');
  };

  window.closeTableModal = function () {
    document.getElementById('table-modal').classList.remove('open');
  };

  window.sortModalTable = function (col) {
    if (sortCol === col) sortAsc = !sortAsc;
    else {
      sortCol = col;
      sortAsc = false;
    }
    renderModalTable();
  };

  // Init
  renderMap();
  updateHeroAndLeftPanel();
  renderInspector(null);
  renderAuditFeed();
})();

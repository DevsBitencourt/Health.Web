  // ─────────────────────────────────────────────────────────
  // CONFIGURAÇÃO DA API
  // ─────────────────────────────────────────────────────────
  const API_URL = "https://devhealthwestus-gahvedd0c6czeuft.westus-01.azurewebsites.net/api/GetHealthFunctionStatusAsync";
  // ─────────────────────────────────────────────────────────
  // 1. LER O CPF DA URL
  //    Aceita qualquer um desses formatos:
  //      ?cpf=12345678900
  //      ?cpf=123.456.789-00
  // ─────────────────────────────────────────────────────────

  const params   = new URLSearchParams(window.location.search);
  const cpfRaw   = params.get('cpf');                          // valor bruto da URL
  const cpfLimpo = cpfRaw ? cpfRaw.replace(/\D/g, '') : null; // só dígitos

  function cpfValido(cpf) {
    if (!cpf || cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    let soma = 0, r;
    for (let i = 0; i < 9; i++) soma += +cpf[i] * (10 - i);
    r = 11 - (soma % 11); r = r >= 10 ? 0 : r;
    if (r !== +cpf[9]) return false;
    soma = 0;
    for (let i = 0; i < 10; i++) soma += +cpf[i] * (11 - i);
    r = 11 - (soma % 11); r = r >= 10 ? 0 : r;
    return r === +cpf[10];
  }

  function formatarCpf(cpf) {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  // ─────────────────────────────────────────────────────────
  // 2. FUNÇÃO que busca os medicamentos pelo CPF
  //    Substitua o corpo desta função pela chamada real à
  //    sua API:  fetch(`/api/alergias?cpf=${cpf}`)
  // ─────────────────────────────────────────────────────────
  async function fetchMedicamentosComAlergia(cpf) {
    try {
      const response = await fetch(`${API_URL}/${cpf}`, {
        method: "GET"
      });

      // CPF não encontrado
      if (response.status === 404) return null;

      // Erro inesperado
      if (!response.ok) throw new Error(`Erro na API: ${response.status}`);

      // Sucesso — mapeia o retorno para o formato esperado
      const data = await response.json();

      return {
        //nome: "Paciente",  
        meds: data.map(item => ({
          nome:           item.nome,
          principioAtivo: item.ativoPrincipal
        }))
      };

    } catch (error) {
      console.error("Erro ao buscar medicamentos:", error);
      return null;
    }
  }
  // ─────────────────────────────────────────────────────────
  // 3. ESTADO
  // ─────────────────────────────────────────────────────────
  let todosMeds = [];
  let query     = '';
  let viewMode  = 'all';

  function agrupar(lista) {
    return lista.reduce((acc, med) => {
      if (!acc[med.principioAtivo]) acc[med.principioAtivo] = [];
      acc[med.principioAtivo].push(med);
      return acc;
    }, {});
  }

  function hl(text, term) {
    if (!term) return text;
    const re = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(re, '<mark>$1</mark>');
  }

  // ─────────────────────────────────────────────────────────
  // 4. RENDER
  // ─────────────────────────────────────────────────────────
  function render() {
    const list    = document.getElementById('med-list');
    const empty   = document.getElementById('empty');
    const statsEl = document.getElementById('stats-count');
    const q       = query.trim().toLowerCase();

    let filtrados = todosMeds
       .filter(m => m && m.nome && m.principioAtivo) // remove itens quebrados
       .filter(m =>
               m.nome.toLowerCase().includes(q) ||
               m.principioAtivo.toLowerCase().includes(q)
              );


    let grupos = agrupar(filtrados);
    if (viewMode === 'multi') {
      grupos = Object.fromEntries(Object.entries(grupos).filter(([, v]) => v.length > 1));
    }

    const totalGrupos = Object.keys(grupos).length;
    const totalMeds   = Object.values(grupos).reduce((s, m) => s + m.length, 0);

    statsEl.innerHTML = q
      ? `<strong>${totalMeds}</strong> med${totalMeds !== 1 ? 's' : ''} em <strong>${totalGrupos}</strong> grupo${totalGrupos !== 1 ? 's' : ''} para "<strong>${query}</strong>"`
      : `<strong>${totalMeds}</strong> medicamentos em <strong>${totalGrupos}</strong> grupos de princípio ativo`;

    if (totalGrupos === 0) {
      list.innerHTML = '';
      empty.style.display = 'block';
      document.getElementById('empty-term').textContent = query;
      return;
    }
    empty.style.display = 'none';

    list.innerHTML = Object.entries(grupos)
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
      .map(([ativo, meds], i) => {
        const isMulti  = meds.length > 1;
        const isSingle = meds.length === 1;
        return `
          <div class="grupo ${isMulti ? 'multi open' : 'single'}" style="animation-delay:${i * 0.055}s">
            <div class="grupo-header" onclick="toggleGrupo(this)">
              <div class="grupo-ativo">
                <span class="grupo-ativo-label">Ativo</span>
                <span class="grupo-ativo-text">${hl(ativo, query)}</span>
              </div>
              <div class="grupo-right">
                <span class="count-badge ${isSingle ? 'single' : ''}">${meds.length} med${meds.length !== 1 ? 's' : ''}</span>
                <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
            </div>
            <div class="grupo-meds">
              ${meds.map(m => `
                <div class="med-item">
                  <span class="med-name">${hl(m.nome, query)}</span>
                  <span class="alergia-badge">⚠ Alergia</span>
                </div>`).join('')}
            </div>
          </div>`;
      }).join('');
  }

  function toggleGrupo(header) {
    const grupo = header.closest('.grupo');
    if (grupo.classList.contains('single')) return;
    grupo.classList.toggle('open');
  }

  // ─────────────────────────────────────────────────────────
  // 5. EVENTOS
  // ─────────────────────────────────────────────────────────
  document.getElementById('search').addEventListener('input', e => {
    query = e.target.value;
    document.getElementById('clear-btn').classList.toggle('visible', query.length > 0);
    render();
  });
  document.getElementById('clear-btn').addEventListener('click', () => {
    document.getElementById('search').value = ''; query = '';
    document.getElementById('clear-btn').classList.remove('visible');
    document.getElementById('search').focus();
    render();
  });
  document.getElementById('tabs').addEventListener('click', e => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    viewMode = tab.dataset.view;
    render();
  });

  // ─────────────────────────────────────────────────────────
  // 6. INIT — decide o que exibir com base no CPF da URL
  // ─────────────────────────────────────────────────────────
  (async () => {
    // Sem CPF na URL
    if (!cpfLimpo) {
      document.getElementById('estado-sem-cpf').style.display = 'block';
      return;
    }

    // CPF com formato inválido
    if (!cpfValido(cpfLimpo)) {
      const el = document.getElementById('estado-cpf-invalido');
      el.style.display = 'block';
      el.innerHTML = `
        <div style="padding: 2rem clamp(1rem,6vw,4rem)">
          <div class="alert-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div class="alert-box-text">
              <h3>CPF inválido</h3>
              <p>O valor <code>${cpfRaw}</code> não é um CPF válido. Verifique o parâmetro na URL e tente novamente.</p>
            </div>
          </div>
        </div>`;
      return;
    }

    // CPF válido — exibe o conteúdo e busca os dados
    document.getElementById('page-body').style.display = 'block';
    document.getElementById('header-paciente').innerHTML =
      `CPF: <span>${formatarCpf(cpfLimpo)}</span>`;

    const resultado = await fetchMedicamentosComAlergia(cpfLimpo);

    // CPF não encontrado na base
    if (!resultado) {
      document.getElementById('med-list').innerHTML = '';
      const el = document.getElementById('estado-cpf-invalido');
      el.style.display = 'block';
      el.innerHTML = `
        <div style="padding: 0 0 2rem">
          <div class="alert-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div class="alert-box-text">
              <h3>Paciente não encontrado</h3>
              <p>Nenhum registro foi encontrado para o CPF <code>${formatarCpf(cpfLimpo)}</code>.</p>
            </div>
          </div>
        </div>`;
      document.getElementById('stats-count').innerHTML = '';
      return;
    }

    // Sucesso
    document.getElementById('header-paciente').innerHTML =
      `${resultado.nome} &nbsp;·&nbsp; CPF: <span>${formatarCpf(cpfLimpo)}</span>`;

    todosMeds = resultado.meds;
    render();
  })();
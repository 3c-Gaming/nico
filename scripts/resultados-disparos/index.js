#!/usr/bin/env node
/**
 * scripts/resultados-disparos/index.js
 *
 * Lê os CSVs de ./mes, consulta as APIs de controlenumeros.vercel.app e grava
 * as versões repreenchidas em ./resultado (mesmo nome de arquivo).
 *
 * Colunas repreenchidas: ENTREGUES, REGISTROS, FTD, CPAS e CPA (valor).
 * CPA em valor: SuperBet = cpa * 500 | MGM = cpa * 260
 *
 * Estrutura esperada:
 *   resultados-disparos/
 *     ├── index.js
 *     ├── mes/            <- entradas  (RESULTADO-JULHO.csv, ...)
 *     └── resultado/       <- saídas   (criada automaticamente)
 *
 * Uso:
 *   node index.js                          # processa todos os .csv de ./mes
 *   node index.js --file=RESULTADO-JULHO   # só os arquivos que casam com o termo
 *   node index.js --dry-run                # não grava nada, só mostra o log
 *
 * Flags:
 *   --file=<termo>     filtra arquivos de ./mes pelo nome (case-insensitive)
 *   --ano=2026         ano usado quando a DATA vem como "dd/MM"
 *   --in=<pasta>       sobrescreve a pasta de entrada (default: ./mes)
 *   --out=<pasta>      sobrescreve a pasta de saída  (default: ./resultado)
 *   --concurrency=4    requisições em paralelo
 *   --delay=150        pausa (ms) entre requisições de um worker
 *   --only-empty       só preenche células vazias ou zeradas
 *   --dry-run          não escreve arquivos
 *
 * Requer Node 18+ (fetch nativo). Sem dependências externas.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const BASE = 'https://controlenumeros.vercel.app/api/publico';
const CPA_VALOR = { superbet: 500, mgm: 260 };

// ---------------------------------------------------------------- CLI
const flags = {};
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) continue;
  const [k, v] = a.slice(2).split('=');
  flags[k] = v === undefined ? true : v;
}

const IN_DIR = path.resolve(__dirname, flags.in || 'mes');
const OUT_DIR = path.resolve(__dirname, flags.out || 'resultado');
const FILTRO = flags.file && flags.file !== true ? String(flags.file).toLowerCase() : null;
const CONCURRENCY = Math.max(1, Number(flags.concurrency || 4));
const DELAY = Number(flags.delay || 150);
const ONLY_EMPTY = !!flags['only-empty'];
const DRY = !!flags['dry-run'];

// ---------------------------------------------------------------- CSV
function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* ignora */ }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const q = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
const toCSV = (rows) => rows.map((r) => r.map(q).join(',')).join('\r\n') + '\r\n';

// ---------------------------------------------------------- formatação
const nf2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n) => nf2.format(Number(n) || 0);
const brl = (n) => 'R$ ' + nf2.format(Number(n) || 0);

/** tenta achar o ano no nome do arquivo: 2026 | 2K26 | _26 */
function anoDoArquivo(nome) {
  if (flags.ano) return String(flags.ano);
  const m = nome.match(/(20\d{2})/) || nome.match(/2[kK](\d{2})/) || nome.match(/[^\d](\d{2})(?:\D|$)/);
  if (!m) return String(new Date().getFullYear());
  const v = m[1];
  return v.length === 4 ? v : '20' + v;
}

/** "01/07" | "01/07/26" | "2026-07-01" -> "2026-07-01" */
function toISODate(raw, ano) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const yyyy = y ? (y.length === 2 ? '20' + y : y) : ano;
  return `${yyyy}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/** "SuperBet" | "MGMBET" -> "superbet" | "mgm" */
function normalizaCasa(raw) {
  const s = String(raw || '').toLowerCase();
  if (s.includes('mgm')) return 'mgm';
  if (s.includes('super')) return 'superbet';
  return null;
}

/** SuperBet: a API guarda a utm com underscore, a planilha usa hífen */
const normalizaUtm = (utm) => String(utm || '').trim().replace(/-/g, '_');

const vazio = (v) => {
  const s = String(v ?? '').trim();
  if (!s) return true;
  return Number(s.replace(/[^\d,-]/g, '').replace(/\./g, '').replace(',', '.')) === 0;
};

// ------------------------------------------------------------- HTTP
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url, tentativas = 3) {
  let ultimoErro;
  for (let t = 1; t <= tentativas; t++) {
    try {
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      const txt = await res.text();
      let json;
      try { json = JSON.parse(txt); } catch { throw new Error(`resposta não-JSON (${res.status}): ${txt.slice(0, 120)}`); }
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      return json;
    } catch (e) {
      ultimoErro = e;
      if (t < tentativas) await sleep(400 * t);
    }
  }
  throw ultimoErro;
}

const fetchEntregues = (nome, date) =>
  getJSON(`${BASE}/entregues?nome=${encodeURIComponent(nome)}&date=${date}`);

function fetchResultado(casa, chave, date) {
  const p = casa === 'mgm'
    ? `casa=BetMGM&pid=${encodeURIComponent(String(chave).trim())}`
    : `casa=SuperBet&utm=${encodeURIComponent(normalizaUtm(chave))}`;
  return getJSON(`${BASE}/resultado?${p}&date=${date}`);
}

// --------------------------------------------------------- cabeçalhos
const norm = (h) => String(h || '').trim().toUpperCase().replace(/\s+/g, ' ');
const ALIASES = {
  DATA: ['DATA'],
  CASA: ['CASA'],
  PROMO: ['PROMOÇÃO/OBJETIVO', 'PROMOCAO/OBJETIVO', 'PROMOÇÃO', 'PROMOCAO'],
  CHAVE: ['UTMS / PIDS', 'UTMS/PIDS', 'UTM / PID', 'UTMS', 'PIDS'],
  ENTREGUES: ['ENTREGUES'],
  LIDAS: ['LIDAS'],
  REGISTROS: ['REGISTROS'],
  FTD: ['FTD', 'FTDS'],
  CPAS: ['CPAS'],
  CPA_VAL: ['CPA'],
};

function mapearColunas(header) {
  const idx = {};
  const cols = header.map(norm);
  for (const [chave, nomes] of Object.entries(ALIASES)) {
    for (const n of nomes) {
      const i = cols.indexOf(norm(n));
      if (i !== -1) { idx[chave] = i; break; }
    }
  }
  const obrigatorias = ['DATA', 'CASA', 'PROMO', 'CHAVE', 'ENTREGUES', 'REGISTROS', 'FTD', 'CPAS'];
  const faltando = obrigatorias.filter((k) => idx[k] === undefined);
  if (faltando.length) throw new Error('colunas não encontradas: ' + faltando.join(', '));
  return idx;
}

// ------------------------------------------------- processa 1 arquivo
async function processarArquivo(nomeArquivo) {
  const entrada = path.join(IN_DIR, nomeArquivo);
  const saida = path.join(OUT_DIR, nomeArquivo);
  const ano = anoDoArquivo(nomeArquivo);

  console.log(`\n=== ${nomeArquivo} (ano assumido: ${ano}) ===`);

  const rows = parseCSV(fs.readFileSync(entrada, 'utf8'));
  if (!rows.length) { console.log('  arquivo vazio, ignorado'); return null; }

  const idx = mapearColunas(rows[0]);
  const largura = rows[0].length;
  const tarefas = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    while (row.length < largura) row.push('');
    const dataISO = toISODate(row[idx.DATA], ano);
    const casa = normalizaCasa(row[idx.CASA]);
    const promo = String(row[idx.PROMO] || '').trim();
    const chave = String(row[idx.CHAVE] || '').trim();
    if (!dataISO || (!promo && !chave)) continue;
    tarefas.push({ r, row, dataISO, casa, promo, chave });
  }

  const stats = { ok: 0, pulados: 0, erros: 0, total: tarefas.length };
  const log = [];

  async function processarLinha(t) {
    const { row, dataISO, casa, promo, chave, r } = t;
    const linha = r + 1;

    // 1) ENTREGUES / LIDAS — nome da promoção + data
    const precisaEntregues = !ONLY_EMPTY || vazio(row[idx.ENTREGUES]);
    const precisaLidas = idx.LIDAS !== undefined && (!ONLY_EMPTY || vazio(row[idx.LIDAS]));
    if (promo && (precisaEntregues || precisaLidas)) {
      try {
        const d = await fetchEntregues(promo, dataISO);
        if (precisaEntregues) row[idx.ENTREGUES] = num(d.entregues);
        if (precisaLidas) row[idx.LIDAS] = num(d.lidas);
        log.push(`L${linha} entregues "${promo}" ${dataISO} -> entregues ${d.entregues} | lidas ${d.lidas}`);
      } catch (e) {
        stats.erros++;
        log.push(`L${linha} entregues "${promo}" ${dataISO}: ${e.message}`);
      }
      await sleep(DELAY);
    }

    // 2) REGISTROS / FTD / CPAS / CPA em valor
    if (!casa || !chave) {
      stats.pulados++;
      log.push(`L${linha} sem casa/utm-pid reconhecidos -> pulado`);
      return;
    }
    try {
      const d = await fetchResultado(casa, chave, dataISO);
      const registros = Number(d.registros) || 0;
      const ftds = Number(d.ftds) || 0;
      const cpas = Number(d.cpa) || 0;

      if (!ONLY_EMPTY || vazio(row[idx.REGISTROS])) row[idx.REGISTROS] = num(registros);
      if (!ONLY_EMPTY || vazio(row[idx.FTD]))       row[idx.FTD] = num(ftds);
      if (!ONLY_EMPTY || vazio(row[idx.CPAS]))      row[idx.CPAS] = num(cpas);
      if (idx.CPA_VAL !== undefined && (!ONLY_EMPTY || vazio(row[idx.CPA_VAL]))) {
        row[idx.CPA_VAL] = brl(cpas * CPA_VALOR[casa]);
      }
      stats.ok++;
      log.push(`L${linha} ${casa}/${d.utm} ${dataISO} -> reg ${registros} | ftd ${ftds} | cpa ${cpas} (${brl(cpas * CPA_VALOR[casa])})`);
    } catch (e) {
      stats.erros++;
      log.push(`L${linha} resultado ${casa}/${chave} ${dataISO}: ${e.message}`);
    }
    await sleep(DELAY);
  }

  let cursor = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (cursor < tarefas.length) {
        const t = tarefas[cursor++];
        process.stderr.write(`\r  ${cursor}/${tarefas.length} linhas...`);
        await processarLinha(t);
      }
    })
  );
  process.stderr.write('\r' + ' '.repeat(40) + '\r');

  log.sort((a, b) => Number(a.match(/^L(\d+)/)[1]) - Number(b.match(/^L(\d+)/)[1]));
  console.log(log.map((l) => '  ' + l).join('\n'));
  console.log(`  resumo: ${stats.ok} ok | ${stats.pulados} pulados | ${stats.erros} erros | ${stats.total} linhas`);

  if (DRY) {
    console.log('  [dry-run] nada gravado');
  } else {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(saida, toCSV(rows), 'utf8');
    console.log(`  gravado: ${path.relative(process.cwd(), saida)}`);
  }
  return stats;
}

// --------------------------------------------------------------- main
(async () => {
  if (!fs.existsSync(IN_DIR)) {
    throw new Error(`pasta de entrada não encontrada: ${IN_DIR}`);
  }

  let arquivos = fs.readdirSync(IN_DIR)
    .filter((f) => f.toLowerCase().endsWith('.csv'))
    .filter((f) => !f.startsWith('.') && !f.startsWith('~$'))
    .sort();

  if (FILTRO) arquivos = arquivos.filter((f) => f.toLowerCase().includes(FILTRO));

  if (!arquivos.length) {
    console.log(`nenhum .csv encontrado em ${IN_DIR}${FILTRO ? ` com o filtro "${FILTRO}"` : ''}`);
    return;
  }

  console.log(`entrada: ${IN_DIR}`);
  console.log(`saída:   ${OUT_DIR}`);
  console.log(`arquivos: ${arquivos.join(', ')}`);

  const geral = { ok: 0, pulados: 0, erros: 0, total: 0, arquivos: 0 };
  for (const f of arquivos) {
    try {
      const s = await processarArquivo(f);
      if (s) {
        geral.ok += s.ok; geral.pulados += s.pulados;
        geral.erros += s.erros; geral.total += s.total; geral.arquivos++;
      }
    } catch (e) {
      console.error(`\n=== ${f} === falhou: ${e.message}`);
      geral.erros++;
    }
  }

  console.log(`\nTOTAL: ${geral.arquivos} arquivo(s) | ${geral.ok} ok | ${geral.pulados} pulados | ${geral.erros} erros | ${geral.total} linhas`);
})().catch((e) => {
  console.error('falhou:', e.message);
  process.exit(1);
});
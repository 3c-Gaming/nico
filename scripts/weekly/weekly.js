/**
 * consulta_relatorio.js
 *
 * Lê o CSV de disparos (DATA,CASA,UTM), consulta a API de relatório
 * para cada linha e gera um novo CSV com REGISTROS, FTDS e CPAS.
 *
 * Uso:
 *   node consulta_relatorio.js entrada.csv saida.csv
 *
 * Requer Node.js 18+ (usa fetch nativo).
 */

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------
// CONFIGURAÇÃO — ajuste aqui se necessário
// ---------------------------------------------------------------------

// Ano usado para completar as datas do CSV, que vêm só como DD/MM.
const ANO = 2026;

// Mapeamento do nome da casa como aparece no CSV -> valor esperado pela API.
// Ajuste os valores da direita conforme o slug real de cada casa na API.
const CASA_MAP = {
  "MGMBET": "mgm",
  "SuperBet": "superbet",
  "NoviBet": "novibet",
};

// Linhas cuja CASA não estiver nesse mapa, ou cujo UTM for vazio/"-",
// são ignoradas automaticamente (ex: "SEM CASA", utm "-").

// Delay entre requisições (ms) para não sobrecarregar a API.
const DELAY_MS = 150;

// URL base da API.
const API_BASE = "https://controlenumeros.vercel.app/api/campanhas/relatorio/utm";

// Nome dos arquivos de entrada/saída na raiz do projeto (mesma pasta do script),
// usados quando nada é passado por linha de comando.
const ARQUIVO_ENTRADA_PADRAO = "entrada.csv";
const ARQUIVO_SAIDA_PADRAO = "saida.csv";

// ---------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Parser de CSV simples (sem aspas complexas / campos multi-linha).
function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cols = line.split(",");
    return {
      data: (cols[0] || "").trim(),
      casa: (cols[1] || "").trim(),
      utm: (cols[2] || "").trim(),
    };
  });
  return { header, rows };
}

function toCSVValue(value) {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Converte "13/07" -> "2026-07-13"
function formatDate(dataStr) {
  const match = dataStr.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  const [, dd, mm] = match;
  return `${ANO}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

async function consultarUTM(utm, casa, date) {
  const url = `${API_BASE}?utm=${encodeURIComponent(utm)}&casa=${encodeURIComponent(
    casa
  )}&date=${encodeURIComponent(date)}`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      return { erro: `HTTP ${resp.status}` };
    }
    const json = await resp.json();
    return {
      registros: json.registros ?? "",
      ftds: json.ftds ?? "",
      cpas: json.cpas ?? "",
    };
  } catch (err) {
    return { erro: err.message };
  }
}

async function main() {
  const [, , argInput, argOutput] = process.argv;

  // Se não passar argumentos, usa entrada.csv/saida.csv na raiz do projeto
  // (mesma pasta onde este script está).
  const inputPath = argInput || path.join(__dirname, ARQUIVO_ENTRADA_PADRAO);
  const outputPath = argOutput || path.join(__dirname, ARQUIVO_SAIDA_PADRAO);

  if (!fs.existsSync(inputPath)) {
    console.error(`Arquivo de entrada não encontrado: ${inputPath}`);
    console.error("Coloque o CSV na raiz do projeto como 'entrada.csv' ou passe o caminho manualmente:");
    console.error("  node consulta_relatorio.js caminho/entrada.csv caminho/saida.csv");
    process.exit(1);
  }

  console.log(`Lendo: ${inputPath}`);
  const content = fs.readFileSync(inputPath, "utf-8");
  const { rows } = parseCSV(content);

  const resultados = [];
  let ignoradas = 0;

  for (let i = 0; i < rows.length; i++) {
    const { data, casa, utm } = rows[i];
    const progresso = `[${i + 1}/${rows.length}]`;

    // Ignora linhas sem casa mapeada ou sem utm válido
    const casaApi = CASA_MAP[casa];
    const utmValido = utm && utm !== "-";

    if (!casaApi || !utmValido) {
      console.log(`${progresso} IGNORADA -> data=${data} casa=${casa} utm=${utm}`);
      ignoradas++;
      resultados.push({
        data,
        casa,
        utm,
        date_api: "",
        registros: "",
        ftds: "",
        cpas: "",
        status: "ignorada (casa não mapeada ou utm inválido)",
      });
      continue;
    }

    const dateApi = formatDate(data);
    if (!dateApi) {
      console.log(`${progresso} DATA INVÁLIDA -> ${data}`);
      resultados.push({
        data,
        casa,
        utm,
        date_api: "",
        registros: "",
        ftds: "",
        cpas: "",
        status: "data inválida",
      });
      continue;
    }

    const resultado = await consultarUTM(utm, casaApi, dateApi);

    if (resultado.erro) {
      console.log(`${progresso} ERRO -> utm=${utm} casa=${casaApi} date=${dateApi} :: ${resultado.erro}`);
      resultados.push({
        data,
        casa,
        utm,
        date_api: dateApi,
        registros: "",
        ftds: "",
        cpas: "",
        status: `erro: ${resultado.erro}`,
      });
    } else {
      console.log(
        `${progresso} OK -> utm=${utm} casa=${casaApi} date=${dateApi} :: registros=${resultado.registros} ftds=${resultado.ftds} cpas=${resultado.cpas}`
      );
      resultados.push({
        data,
        casa,
        utm,
        date_api: dateApi,
        registros: resultado.registros,
        ftds: resultado.ftds,
        cpas: resultado.cpas,
        status: "ok",
      });
    }

    await sleep(DELAY_MS);
  }

  // Monta CSV de saída
  const headerOut = ["DATA", "CASA", "UTM", "DATE_API", "REGISTROS", "FTDS", "CPAS", "STATUS"];
  const linhasOut = [headerOut.join(",")];

  for (const r of resultados) {
    linhasOut.push(
      [
        toCSVValue(r.data),
        toCSVValue(r.casa),
        toCSVValue(r.utm),
        toCSVValue(r.date_api),
        toCSVValue(r.registros),
        toCSVValue(r.ftds),
        toCSVValue(r.cpas),
        toCSVValue(r.status),
      ].join(",")
    );
  }

  fs.writeFileSync(outputPath, linhasOut.join("\n"), "utf-8");

  console.log(`\nConcluído. ${rows.length - ignoradas} consultadas, ${ignoradas} ignoradas.`);
  console.log(`Arquivo salvo em: ${path.resolve(outputPath)}`);
}

main();
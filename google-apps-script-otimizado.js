// === Configurações principais ===
const HEADERS = ["Data", "Descricao", "Comprador", "Deve", "Valor"];
const COL_INDICE_U = 21; // coluna usada como índice para localizar a próxima linha
const DADOS_INICIO_LINHA = 3;
const ORDEM_DEVEDORES = ["T", "E", "C", "M", "V", "J", "S"]; // ordem visual do grid / invest.

// Meses em português/abreviados conforme usado nas abas
const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

// Função para detectar o mês atual e retornar o nome da aba correspondente
function obterAbaAtual() {
  const hoje = new Date();
  const mesAtual = hoje.getMonth(); // 0-11
  const nomeAba = MESES[mesAtual];
  return nomeAba;
}

// Função auxiliar para obter o SHEET_NAME dinamicamente
function getSHEET_NAME() {
  return obterAbaAtual();
}

// === Utilitários ===
function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function parseValorMonetario(valor) {
  if (typeof valor === "number") return valor;
  if (typeof valor === "string") {
    const numero = parseFloat(valor.replace(/[^\d,-]/g, "").replace(",", "."));
    return isNaN(numero) ? 0 : numero;
  }
  return 0;
}

// === Endpoints ===
function buscarDados() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = getSHEET_NAME();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return respostaErro(`A aba '${sheetName}' não encontrada.`);

    const ultimaLinha = sheet.getLastRow();
    const ultimaCol = sheet.getLastColumn();
    if (ultimaLinha <= 1) return respostaSucesso([]);

    const headers = sheet.getRange(1, 1, 1, ultimaCol).getValues()[0];
    const dados = sheet.getRange(2, 1, ultimaLinha - 1, ultimaCol).getValues();
    const tz = ss.getSpreadsheetTimeZone();

    const resultado = dados.map(linha => {
      const obj = {};
      headers.forEach((header, index) => {
        let v = linha[index];
        if (header === "Data" && v instanceof Date) {
          v = Utilities.formatDate(v, tz, "dd/MM/yyyy");
        }
        obj[header] = v;
      });
      return obj;
    });

    return respostaSucesso(resultado);
  } catch (err) {
    return respostaErro("Erro ao buscar dados: " + err.message);
  }
}

function buscarSaldos() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = getSHEET_NAME();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return respostaErro(`A aba '${sheetName}' não encontrada.`);

    const linhaSaldos = 61; // linha do saldo consolidado
    const colInicio = 14;   // primeira coluna dos saldos
    const totalCols = ORDEM_DEVEDORES.length;

    const valores = sheet.getRange(linhaSaldos, colInicio, 1, totalCols).getValues()[0];
    const saldos = {};
    ORDEM_DEVEDORES.forEach((sigla, idx) => {
      saldos[sigla] = valores[idx] || 0;
    });

    return respostaSucesso(saldos);
  } catch (err) {
    return respostaErro('Erro ao buscar saldos: ' + err.message);
  }
}

// Nova função: Buscar resumo consolidado (Gastos, Acertos, Grana, Valor)
function buscarResumoConsolidado() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 🔧 BUSCAR SEMPRE DE DEZEMBRO
    const sheet = ss.getSheetByName('DEZ');
    if (!sheet) return respostaErro(`A aba 'DEZ' não encontrada.`);

    // Linha onde estão os VALORES FINAIS
    const linhaValor = 50;
    
    // Colunas onde começam os nomes dos participantes
    const colInicio = 13; // Coluna M
    const totalCols = ORDEM_DEVEDORES.length; // 7 pessoas

    const resumo = {};

    // Puxar APENAS a linha de valores finais
    const valoresValor = sheet.getRange(linhaValor, colInicio, 1, totalCols).getValues()[0];

    ORDEM_DEVEDORES.forEach((sigla, idx) => {
      resumo[sigla] = {
        valor: parseValorMonetario(valoresValor[idx])
      };
    });

    return respostaSucesso(resumo);
  } catch (err) {
    return respostaErro('Erro ao buscar resumo consolidado: ' + err.message);
  }
}

function aplicarRateio(sheet, headersLinha1, linhaInicial, valoresInseridos) {
  const headersNormalizados = headersLinha1.map(normalizarTexto);
  const idxValor = headersNormalizados.indexOf("valor");
  if (idxValor === -1) return;

  const colValor = idxValor + 1;
  const colInicioInvest = colValor + 1;
  const totalInvestCols = ORDEM_DEVEDORES.length;

  if (colInicioInvest + totalInvestCols - 1 > sheet.getLastColumn()) {
    console.warn('Não há colunas suficientes para fórmulas de investimento.');
    return;
  }

  const quantidadeLinhas = valoresInseridos.length;
  const primeiraLinha = linhaInicial;
  const linhaAnterior = primeiraLinha - 1;

  if (linhaAnterior >= DADOS_INICIO_LINHA) {
    const origemAnterior = sheet.getRange(linhaAnterior, colInicioInvest, 1, totalInvestCols);
    const formulasAnterior = origemAnterior.getFormulas()[0];
    const temFormula = formulasAnterior.some(f => f && f.length > 0);

    if (temFormula) {
      const destinoRange = sheet.getRange(primeiraLinha, colInicioInvest, quantidadeLinhas, totalInvestCols);
      origemAnterior.copyTo(destinoRange, SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);
      console.log('✅ Fórmulas copiadas da linha anterior');
    }
  }

  sheet.getRange(primeiraLinha, colInicioInvest, quantidadeLinhas, totalInvestCols)
    .setNumberFormat("R$ #,##0.00");
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return respostaErro("Nenhum dado recebido na requisição.");
    }

    let data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (err) {
      return respostaErro("Formato JSON inválido: " + err.message);
    }

    if (!Array.isArray(data) || data.length === 0) {
      return respostaErro("O corpo da requisição deve ser um array de objetos não vazio.");
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = getSHEET_NAME();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      return respostaErro(`A aba '${sheetName}' não foi encontrada na planilha.`);
    }

    let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (headers.length === 0 || !HEADERS.every(h => headers.includes(h))) {
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      headers = HEADERS.slice();
    }

    const ultimaCol = sheet.getLastColumn();
    if (headers.length < ultimaCol) {
      const extras = sheet.getRange(1, headers.length + 1, 1, ultimaCol - headers.length).getValues()[0];
      headers = headers.concat(extras);
    }

    const resultado = _encontrarProximaLinhaPorColunaU_(sheet);
    const proximaSheet = resultado.sheet;
    const proximaLinha = resultado.linha;

    // ⚠️ IMPORTANTE: Após encontrar a próxima aba, ler os headers DELA (não da aba anterior!)
    let headersProximaSheet = proximaSheet.getRange(1, 1, 1, proximaSheet.getLastColumn()).getValues()[0];
    if (headersProximaSheet.length === 0 || !HEADERS.every(h => headersProximaSheet.includes(h))) {
      proximaSheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      headersProximaSheet = HEADERS.slice();
    }

    const ultimaColProxima = proximaSheet.getLastColumn();
    if (headersProximaSheet.length < ultimaColProxima) {
      const extrasProxima = proximaSheet.getRange(1, headersProximaSheet.length + 1, 1, ultimaColProxima - headersProximaSheet.length).getValues()[0];
      headersProximaSheet = headersProximaSheet.concat(extrasProxima);
    }

    // Use os headers da próxima aba para preparar os dados
    headers = headersProximaSheet;

    // ETAPA 1: Preencher linha existente (SEM INSERIR linha nova)
    // Apenas preenchemos as colunas necessárias na linha já existente
    
    const valoresComZero = data.map(item => headers.map(header => {
      const valor = item[header];
      switch (header) {
        case "Data": {
          if (typeof valor === 'string' && valor.includes('/')) {
            const [dia, mes, ano] = valor.split('/');
            const d = new Date(Number(ano), Number(mes) - 1, Number(dia));
            d.setHours(12, 0, 0, 0);
            return d;
          }
          const d = valor ? new Date(valor) : new Date();
          d.setHours(12, 0, 0, 0);
          return d;
        }
        case "Valor":
          return 0; // VALOR ZERO NA PRIMEIRA INSERÇÃO
        case "Deve":
          return Array.isArray(valor) ? valor.join(', ') : String(valor || '');
        default:
          return valor !== undefined && valor !== null ? String(valor).trim() : '';
      }
    }));

    // Preencher APENAS as colunas A-L (1-12) na linha existente
    // NÃO insere linha nova, apenas preenche a que já existe
    const colsNecessarias = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; // A a L
    const valoresNecessarios = valoresComZero.map(linha => colsNecessarias.map(idx => linha[idx - 1] || ''));
    
    proximaSheet.getRange(proximaLinha, 1, valoresComZero.length, colsNecessarias.length).setValues(valoresNecessarios);

    const idxData = headers.indexOf("Data") + 1;
    if (idxData > 0) {
      proximaSheet.getRange(proximaLinha, idxData, valoresComZero.length, 1).setNumberFormat("dd/MM/yyyy");
    }

    const headersLinha1Raw = proximaSheet.getRange(1, 1, 1, proximaSheet.getLastColumn()).getValues()[0];
    const headersLinha1 = headersLinha1Raw.map(normalizarTexto);
    const colComprador = headersLinha1.indexOf("comprador") + 1;
    const colValor = headersLinha1.indexOf("valor") + 1;

    if (colComprador > 0 && colValor > colComprador + 1) {
      // colInicioDeve começa após "Comprador" e vai até antes de "Valor"
      // Para mapear corretamente com ORDEM_DEVEDORES, precisa ter exatamente 7 colunas
      const colInicioDeve = colComprador + 1;
      const qtdColsDeve = colValor - colInicioDeve;

      // DEBUG: Verificar se temos exatamente 7 colunas para os devedores
      if (qtdColsDeve !== ORDEM_DEVEDORES.length) {
        console.warn(`⚠️ AVISO: Esperado ${ORDEM_DEVEDORES.length} colunas, mas encontrado ${qtdColsDeve}`);
      }

      proximaSheet.getRange(proximaLinha, colInicioDeve, valoresComZero.length, qtdColsDeve).clearContent();

      data.forEach((item, idx) => {
        const deveRaw = item.Deve;
        let deveList;
        
        if (Array.isArray(deveRaw)) {
          deveList = deveRaw;
        } else {
          const deveStr = String(deveRaw || "").trim();
          // Se vier "EJS" (siglas sem separador), quebra em caracteres individuais
          // Se vier "E, J, S" ou "E,J,S" (com separador), split por vírgula
          if (deveStr.includes(",")) {
            deveList = deveStr.split(",").map(s => s.trim()).filter(Boolean);
          } else if (/^[A-Z]+$/.test(deveStr)) {
            // String só de letras maiúsculas → quebra em caracteres individuais
            deveList = deveStr.split("");
          } else {
            deveList = deveStr.split(",").map(s => s.trim()).filter(Boolean);
          }
        }

        // Aceita tanto siglas (T, E, C, ...) quanto nomes completos (Tauchen, Emanuel, ...)
        // Converte tudo para a sigla esperada: se não for uma das siglas, usa a primeira letra
        const deveSiglas = deveList
          .map(s => String(s).trim())
          .filter(Boolean)
          .map(s => {
            const up = s.toUpperCase();
            return ORDEM_DEVEDORES.includes(up) ? up : up.charAt(0);
          });
        const deveSet = new Set(deveSiglas);
        console.log(`📋 Linha ${proximaLinha + idx}: deveRaw="${deveRaw}", deveSiglas=[${Array.from(deveSet).join(", ")}]`);

        const rowNum = proximaLinha + idx;
        ORDEM_DEVEDORES.forEach((sigla, ordemIdx) => {
          if (deveSet.has(sigla)) {
            // A coluna do devedor é: colInicioDeve + índice dele na ORDEM_DEVEDORES
            const colDeste = colInicioDeve + ordemIdx;
            proximaSheet.getRange(rowNum, colDeste).setValue("x");
            console.log(`✅ Linha ${rowNum}, Coluna ${colDeste} (${sigla}): marcado "x"`);
          }
        });
      });
      console.log(`✅ Devedores marcados com "x" para ${data.length} registro(s)`);
    }

    aplicarRateio(proximaSheet, headersLinha1Raw, proximaLinha, valoresComZero);

    // Preencher a coluna AD (30) com COUNTIF dos "x"s (D:K = colunas 4 a 11)
    // Fórmula: =COUNTIF(D9:K9,"x")
    data.forEach((item, idx) => {
      const rowNum = proximaLinha + idx;
      // Coluna AD = 30
      const colAD = 30;
      const formulaCountX = `=COUNTIF(D${rowNum}:K${rowNum},"x")`;
      proximaSheet.getRange(rowNum, colAD).setFormula(formulaCountX);
    });

    // ETAPA 2: Atualizar a linha COM O VALOR REAL (última etapa)
    const colValorIdx = headersLinha1.indexOf("valor");
    if (colValorIdx >= 0) {
      data.forEach((item, idx) => {
        const valorReal = parseValorMonetario(item.Valor);
        const colValorNum = colValorIdx + 1; // 1-based
        proximaSheet.getRange(proximaLinha + idx, colValorNum).setValue(valorReal);
      });
    }

    const inseridos = valoresComZero.map((linha, idx) => {
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = linha[i];
      });
      return obj;
    });

    return respostaSucesso({
      mensagem: `${valoresComZero.length} registro(s) inserido(s) com "x", valor adicionado por último.`,
      linhasInseridas: valoresComZero.length,
      proximaLinha: proximaLinha,
      dadosInseridos: inseridos
    });

  } catch (err) {
    console.error("Erro no doPost:", err);
    return respostaErro("Erro interno no servidor: " + err.message);
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action || 'getData';
    switch (action) {
      case 'getData':
        return buscarDados();
      case 'getSaldos':
        return buscarSaldos();
      case 'getResumo':
        return buscarResumoConsolidado();
      case 'clearData':
        return limparDados();
      case 'health':
        return respostaSucesso({ status: "ok", message: "API funcionando corretamente" });
      case 'getDataByPeriod':
        return buscarDadosPorPeriodo(e);
      case 'exportCsv':
        return exportarCsv();
      default:
        return respostaErro("Ação não reconhecida: " + action);
    }
  } catch (err) {
    console.error("Erro no doGet:", err);
    return respostaErro("Erro ao processar requisição GET: " + err.message);
  }
}

function buscarDadosPorPeriodo(e) {
  try {
    const dataIni = e.parameter.dataIni;
    const dataFim = e.parameter.dataFim;
    if (!dataIni || !dataFim) return respostaErro("Parâmetros dataIni e dataFim são obrigatórios.");

    const [di, mi, yi] = dataIni.split('/');
    const [df, mf, yf] = dataFim.split('/');
    const ini = new Date(`${yi}-${mi}-${di}T00:00:00`);
    const fim = new Date(`${yf}-${mf}-${df}T23:59:59`);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = getSHEET_NAME();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return respostaErro(`A aba '${sheetName}' não encontrada.`);

    const ultimaLinha = sheet.getLastRow();
    const ultimaCol = sheet.getLastColumn();
    if (ultimaLinha <= 1) return respostaSucesso([]);

    const headers = sheet.getRange(1, 1, 1, ultimaCol).getValues()[0];
    const dados = sheet.getRange(2, 1, ultimaLinha - 1, ultimaCol).getValues();
    const tz = ss.getSpreadsheetTimeZone();

    const resultado = dados
      .map(linha => {
        const obj = {};
        headers.forEach((header, index) => {
          let v = linha[index];
          if (header === "Data" && v instanceof Date) {
            v = Utilities.formatDate(v, tz, "dd/MM/yyyy");
          }
          obj[header] = v;
        });
        return obj;
      })
      .filter(obj => {
        if (!obj.Data) return false;
        const [d, m, y] = obj.Data.split('/');
        const dt = new Date(`${y}-${m}-${d}T12:00:00`);
        return dt >= ini && dt <= fim;
      });

    return respostaSucesso(resultado);
  } catch (err) {
    return respostaErro("Erro ao buscar dados por período: " + err.message);
  }
}

function exportarCsv() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) return respostaErro(`A aba '${SHEET_NAME}' não encontrada.`);

    const ultimaLinha = sheet.getLastRow();
    const ultimaCol = sheet.getLastColumn();
    if (ultimaLinha <= 1) return respostaSucesso({ csv: '' });

    const headers = sheet.getRange(1, 1, 1, ultimaCol).getValues()[0];
    const dados = sheet.getRange(2, 1, ultimaLinha - 1, ultimaCol).getValues();

    let csv = headers.join(',') + '\n';
    dados.forEach(linha => {
      csv += linha.map(v => {
        if (typeof v === 'string' && v.includes(',')) {
          return '"' + v.replace(/"/g, '""') + '"';
        }
        if (v instanceof Date) {
          return Utilities.formatDate(v, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), "dd/MM/yyyy");
        }
        return v;
      }).join(',') + '\n';
    });

    return ContentService.createTextOutput(csv).setMimeType(ContentService.MimeType.CSV);
  } catch (err) {
    return respostaErro("Erro ao exportar CSV: " + err.message);
  }
}

function limparDados() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) return respostaErro(`A aba '${SHEET_NAME}' não encontrada.`);

    const ultimaLinha = sheet.getLastRow();
    if (ultimaLinha > 1) {
      sheet.getRange(2, 1, ultimaLinha - 1, sheet.getLastColumn()).clear();
    }

    return respostaSucesso({ mensagem: "Dados limpos com sucesso!", linhasLimpas: Math.max(0, ultimaLinha - 1) });
  } catch (err) {
    return respostaErro("Erro ao limpar dados: " + err.message);
  }
}

function respostaSucesso(dados) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: "sucesso",
      dados,
      timestamp: new Date().toISOString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function respostaErro(mensagem) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: "erro",
      mensagem,
      timestamp: new Date().toISOString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function _encontrarProximaLinhaPorColunaU_(sheet) {
  const LINHA_INICIO = 4;   // Primeira linha de dados
  const LINHA_FIM = 28;     // Última linha disponível nesta planilha
  const COL_VERIFICAR = 1;  // Coluna A (Data)

  // Procura a primeira linha vazia no intervalo 4-28 da sheet atual
  for (let i = LINHA_INICIO; i <= LINHA_FIM; i++) {
    const celula = sheet.getRange(i, COL_VERIFICAR).getValue();
    if (!celula || String(celula).trim() === '') {
      return { sheet: sheet, linha: i };
    }
  }

  // Se chegou aqui, o intervalo 4-28 está cheio
  // Vai para a próxima planilha (JUN, JUL, AGO, SET, OUT, NOV, DEZ, JAN...)
  const sheetName = sheet.getName();
  const meses = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  const mesAtual = sheetName.substring(0, 3).toUpperCase();
  let idxAtual = meses.indexOf(mesAtual);

  if (idxAtual < 0) {
    throw new Error("Planilha " + sheetName + " não reconhecida como mês válido");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Loop para procurar próximos meses
  for (let i = 1; i <= 12; i++) {
    const proximoIdx = (idxAtual + i) % 12;
    const proximoMes = meses[proximoIdx];
    const proximaSheet = ss.getSheetByName(proximoMes);

    if (!proximaSheet) {
      // Planilha não existe, pula para a próxima
      console.log("Planilha " + proximoMes + " não encontrada, procurando próxima...");
      continue;
    }

    // Verifica se a próxima planilha tem espaço (linha vazia entre 4-28)
    for (let j = LINHA_INICIO; j <= LINHA_FIM; j++) {
      const celula = proximaSheet.getRange(j, COL_VERIFICAR).getValue();
      if (!celula || String(celula).trim() === '') {
        // Encontrou espaço na próxima planilha
        console.log("✅ Mudando para planilha " + proximoMes + " linha " + j);
        return { sheet: proximaSheet, linha: j };
      }
    }
    // Se a próxima planilha também está cheia, continua procurando
  }

  throw new Error("Nenhuma planilha disponível encontrada com espaço");
}

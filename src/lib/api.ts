/**
 * Busca os saldos exatos da planilha
 */
export async function buscarSaldosGoogleSheets(): Promise<{ [key: string]: number }> {
  try {
    const url = `${GOOGLE_SCRIPT_URL}?action=getSaldos`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
    }

    const resultado = await response.json();

    if (resultado.status === 'erro') {
      throw new Error(resultado.mensagem);
    }

    
    const saldos: { [key: string]: number } = {};
    Object.entries(resultado.dados).forEach(([sigla, valor]) => {
      saldos[sigla] = Number(valor);
    });
    return saldos;
  } catch (error) {
    console.error('❌ Erro ao buscar saldos:', error);
    return {};
  }
}
/**
 * Busca o resumo consolidado (Gastos, Acertos, Grana, Valor por pessoa)
 */
export async function buscarResumoConsolidado(): Promise<{ [key: string]: { gastos: number; acertos: number; grana: number; valor: number } }> {
  try {
    const url = `${GOOGLE_SCRIPT_URL}?action=getResumo`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
    }

    const resultado = await response.json();

    if (resultado.status === 'erro') {
      throw new Error(resultado.mensagem);
    }

    return resultado.dados || {};
  } catch (error) {
    console.error('❌ Erro ao buscar resumo consolidado:', error);
    return {};
  }
}

export interface CompraFormData {
  Data: string;       // formato: DD/MM/YYYY
  Descricao: string;
  Comprador: string;
  Deve: string[];     // ["T", "E", "M"]
  Valor: string;      // formato: R$ 0,00
}

export interface ApiResponse {
  status: 'sucesso' | 'erro';
  mensagem?: string;
  dados?: any;
  timestamp?: string;
}

const GOOGLE_SCRIPT_URL = '';

/**
 * Envia array de compras para o Google Sheets (uma única requisição)
 * O Apps Script cuida de: 1º inserir com Valor=0, 2º atualizar com valor real
 */
export async function enviarParaGoogleSheets(valores: CompraFormData[]): Promise<void> {
  try {
    if (!Array.isArray(valores) || valores.length === 0) {
      throw new Error('Dados inválidos: array vazio ou formato incorreto');
    }

    const payload = valores.map(item => {
      // Debug: verificar o que está sendo enviado
      console.log('📤 Enviando Deve como:', item.Deve, '(tipo:', typeof item.Deve, ')');
      return {
        Data: item.Data.trim(),
        Descricao: item.Descricao.trim(),
        Comprador: item.Comprador.trim(),
        Deve: Array.isArray(item.Deve) ? item.Deve : [item.Deve], // Garantir que é array
        Valor: Number(item.Valor.replace(/[^\d,]/g, '').replace(',', '.'))
      };
    });

    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro Google Apps Script:', errorText);
      throw new Error(`Erro ao enviar para o Google Sheets: ${response.status}`);
    }

    const resultado = await response.json();
    if (resultado.status === 'erro') {
      throw new Error(resultado.mensagem);
    }

    console.log('✅ Dados enviados com sucesso!', resultado);

  } catch (error: any) {
    console.error('❌ Falha ao enviar para o Google Sheets:', error);
    throw new Error(`Falha na comunicação com o Google Sheets: ${error.message}`);
  }
}

/**
 * Busca dados do Google Sheets
 */
export async function buscarDadosGoogleSheets(): Promise<CompraFormData[]> {
  try {
    const url = `${GOOGLE_SCRIPT_URL}?action=getData`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
    }

    const resultado = await response.json();

    if (resultado.status === 'erro') {
      throw new Error(resultado.mensagem);
    }

    return resultado.dados.map((item: any) => ({
      Data: item.Data || '',
      Descricao: item.Descricao || '',
      Comprador: item.Comprador || '',
      Deve: item.Deve ? item.Deve.split(',').map((d: string) => d.trim()) : [],
      Valor: `R$ ${Number(item.Valor).toFixed(2).replace('.', ',')}`
    }));

  } catch (error) {
    console.error('❌ Erro ao buscar dados:', error);
    return [];
  }
}

/**
 * Limpa todos os dados do Google Sheets
 */
export async function limparDadosGoogleSheets(): Promise<void> {
  try {
    const url = `${GOOGLE_SCRIPT_URL}?action=clearData`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
    }

    const resultado = await response.json();

    if (resultado.status === 'erro') {
      throw new Error(resultado.mensagem);
    }

    console.log('✅ Dados limpos com sucesso:', resultado);

  } catch (error: any) {
    console.error('❌ Erro ao limpar dados:', error);
    throw new Error(`Falha ao limpar dados: ${error.message}`);
  }
}

/**
 * Testa conexão com o Google Apps Script
 */
export async function testarConexao(): Promise<boolean> {
  try {
    const url = `${GOOGLE_SCRIPT_URL}?action=health`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) return false;

    const resultado = await response.json();
    return resultado.status === 'sucesso';

  } catch (error) {
    console.error('❌ Falha na conexão:', error);
    return false;
  }
}

/**
 * Valida dados antes de enviar
 */
export function validarDados(dados: CompraFormData[]): string[] {
  const erros: string[] = [];

  if (!Array.isArray(dados) || dados.length === 0) {
    erros.push('Dados devem ser um array não vazio');
    return erros;
  }

  dados.forEach((item, i) => {
    if (!item.Data || !/^\d{2}\/\d{2}\/\d{4}$/.test(item.Data)) {
      erros.push(`Item ${i + 1}: Data inválida ou formato incorreto (DD/MM/YYYY)`);
    }
    if (!item.Descricao || item.Descricao.trim().length === 0) {
      erros.push(`Item ${i + 1}: Descrição é obrigatória`);
    }
    if (!item.Comprador || item.Comprador.trim().length === 0) {
      erros.push(`Item ${i + 1}: Comprador é obrigatório`);
    }
    if (!Array.isArray(item.Deve) || item.Deve.length === 0) {
      erros.push(`Item ${i + 1}: Campo "Deve" deve conter pelo menos um valor`);
    }
    if (!item.Valor || !/^R\$ \d+(,\d{2})?$/.test(item.Valor)) {
      erros.push(`Item ${i + 1}: Valor inválido ou formato incorreto (R$ 0,00)`);
    }
  });

  return erros;
}

// Exportar configurações para uso em outros arquivos
export const config = {
  googleScriptUrl: GOOGLE_SCRIPT_URL,
  sheetName: "JUN",
  headers: ["Data", "Descricao", "Comprador", "Deve", "Valor"]
};

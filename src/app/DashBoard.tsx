import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { buscarDadosGoogleSheets, buscarSaldosGoogleSheets, buscarResumoConsolidado, CompraFormData } from '../lib/api';
import { Ionicons } from '@expo/vector-icons';

const PARTICIPANTES: { [key: string]: string } = {
  T: 'Tauchen',
  E: 'Emanuel',
  C: 'Cassiano',
  M: 'Murilo',
  V: 'Vítor',
  J: 'José',
  S: 'Shirugueru',
};

const CORES_GRADIENTE: { [key: string]: [string, string] } = {
  T: ['#FF6B6B', '#FF5252'],
  E: ['#4ECDC4', '#3AB5A8'],
  C: ['#FFE66D', '#FFD93D'],
  M: ['#95E1D3', '#6FD3C7'],
  V: ['#C1A6FF', '#9E5FD3'],
  J: ['#FF9F71', '#FF7F50'],
  S: ['#87CEEB', '#4A90E2'],
};

const CORES_CHART = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#C1A6FF', '#FF9F71', '#87CEEB'];

const COLORS = {
  background: '#0A0A0A',
  surface: '#111C26',
  card: '#014421',
  accent: '#00D4AA',
  warning: '#9c1c1cff',
  info: '#1B263B',
  text: '#ffffffff',
  textSecondary: '#A3B18A',
  barPositive: '#218838',
  barNegative: '#FF6B6B',
};

const BAR_MAX_WIDTH = Dimensions.get('window').width - 80;
const { width: screenWidth } = Dimensions.get('window');

export default function DashBoard() {
  const [dados, setDados] = useState<CompraFormData[]>([]);
  const [saldos, setSaldos] = useState<{ [key: string]: number }>({});
  const [resumo, setResumo] = useState<{ [key: string]: { gastos: number; acertos: number; grana: number; valor: number } }>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedStats, setExpandedStats] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ultimoMes, setUltimoMes] = useState<number>(new Date().getMonth());

  // Effect para carregar dados iniciais
  useEffect(() => {
    carregarDados();
  }, []);

  // Effect para monitorar mudanças de mês e recarregar automaticamente
  useEffect(() => {
    const intervalo = setInterval(() => {
      const mesAtual = new Date().getMonth();
      if (mesAtual !== ultimoMes) {
        console.log(`📅 Mês alterado! De ${ultimoMes} para ${mesAtual}. Recarregando dados...`);
        setUltimoMes(mesAtual);
        carregarDados();
      }
    }, 60000); // Verifica a cada 1 minuto

    return () => clearInterval(intervalo);
  }, [ultimoMes]);

  const carregarDados = async () => {
    setLoading(true);
    setErro(null);
    try {
      // Timeout de 5 segundos para cada requisição
      const timeoutPromise = (ms: number) => new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), ms)
      );

      const comprasPromise = buscarDadosGoogleSheets();
      const saldosPromise = buscarSaldosGoogleSheets();
      const resumoPromise = buscarResumoConsolidado();

      const [compras, saldosPlanilha, resumoData] = await Promise.all([
        Promise.race([comprasPromise, timeoutPromise(5000)]),
        Promise.race([saldosPromise, timeoutPromise(5000)]),
        Promise.race([resumoPromise, timeoutPromise(5000)])
      ]) as [CompraFormData[], { [key: string]: number }, { [key: string]: { gastos: number; acertos: number; grana: number; valor: number } }];

      setDados(compras || []);
      setSaldos(saldosPlanilha || {});
      setResumo(resumoData || {});
    } catch (e: any) {
      console.error('Erro ao carregar dados:', e);
      setErro(e?.message || 'Erro ao carregar dados');
      setDados([]);
      setSaldos({});
      setResumo({});
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await carregarDados();
    setRefreshing(false);
  };

  function calcularStats(dados: CompraFormData[]): {
    gastouPorPessoa: { [key: string]: number };
    devePorPessoa: { [key: string]: number };
    saldoPorPessoa: { [key: string]: number };
  } {
    if (!dados || dados.length === 0) {
      return {
        gastouPorPessoa: Object.keys(PARTICIPANTES).reduce((acc, p) => ({ ...acc, [p]: 0 }), {}),
        devePorPessoa: Object.keys(PARTICIPANTES).reduce((acc, p) => ({ ...acc, [p]: 0 }), {}),
        saldoPorPessoa: Object.keys(PARTICIPANTES).reduce((acc, p) => ({ ...acc, [p]: 0 }), {}),
      };
    }

    const participantes = Object.keys(PARTICIPANTES);
    const gastouPorPessoa: { [key: string]: number } = {};
    const devePorPessoa: { [key: string]: number } = {};
    const saldoPorPessoa: { [key: string]: number } = {};

    participantes.forEach(p => {
      gastouPorPessoa[p] = 0;
      devePorPessoa[p] = 0;
      saldoPorPessoa[p] = 0;
    });

    dados.forEach(c => {
      const valor = parseFloat(String(c.Valor).replace(/[^\d,]/g, '').replace(',', '.')) || 0;
      const deveArr = Array.isArray(c.Deve) ? c.Deve : String(c.Deve || '').split(',').map(s => s.trim()).filter(Boolean);

      // Quanto o comprador gastou
      if (participantes.includes(c.Comprador)) {
        gastouPorPessoa[c.Comprador] += valor;
      }

      // Quanto cada devedor deve
      if (deveArr.length > 0) {
        const rateio = valor / deveArr.length;
        deveArr.forEach(dev => {
          if (participantes.includes(dev)) {
            devePorPessoa[dev] += rateio;
          }
        });
      }
    });

    // Calcular saldo: se gastou 100 mas deve 30 = +70 (positivo, recebe)
    //                 se gastou 30 mas deve 100 = -70 (negativo, paga)
    participantes.forEach(p => {
      saldoPorPessoa[p] = gastouPorPessoa[p] - devePorPessoa[p];
    });

    return {
      gastouPorPessoa,
      devePorPessoa,
      saldoPorPessoa,
    };
  }

  function formatCurrency(v: number) {
    return `R$ ${v.toFixed(2).replace('.', ',')}`;
  }

  function getName(code: string) {
    return PARTICIPANTES[code] || code;
  }

  const stats = calcularStats(dados);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Carregando dashboard...</Text>
        {erro && <Text style={styles.errorText}>({erro})</Text>}
      </View>
    );
  }

  if (erro && dados.length === 0 && Object.keys(saldos).length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle" size={48} color={COLORS.warning} />
        <Text style={styles.errorMessage}>Erro ao carregar dados</Text>
        <Text style={styles.errorText}>{erro}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => carregarDados()}
        >
          <Text style={styles.retryButtonText}>Tentar Novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Preparar dados para gráficos
  const gastouPorPessoa = (stats?.gastouPorPessoa as { [key: string]: number }) || {};
  const devePorPessoa = (stats?.devePorPessoa as { [key: string]: number }) || {};
  const saldoPorPessoa = (stats?.saldoPorPessoa as { [key: string]: number }) || {};
  // Acerto vindo da planilha (se disponível). Fallback: saldo calculado localmente
  const acertoPorPessoa: { [key: string]: number } = Object.keys(PARTICIPANTES).reduce(
    (acc, p) => ({ ...acc, [p]: saldos?.[p] ?? saldoPorPessoa[p] ?? 0 }),
    {} as { [key: string]: number }
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[COLORS.accent]}
          tintColor={COLORS.accent}
        />
      }
    >
      {/* Header Simples */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>💰 Resumo Financeiro</Text>
      </View>

      {/* 🎯 RESUMO CONSOLIDADO - VERDE E VERMELHO */}
      {Object.keys(resumo).length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💰 Resumo Consolidado</Text>

          {Object.entries(PARTICIPANTES).map(([sigla, nome]) => {
            const dados = resumo[sigla];
            if (!dados) return null;

            const valor = dados.valor; // Valor final da coluna "Valor"
            const isPositive = valor >= 0;

            return (
              <View
                key={`resumo-${sigla}`}
                style={[
                  styles.resumoRow,
                  {
                    backgroundColor: isPositive ? '#0d2620' : '#260d0d',
                    borderLeftColor: isPositive ? '#00D4AA' : '#FF6B6B',
                    borderLeftWidth: 4,
                  },
                ]}
              >
                {/* Nome */}
                <View style={styles.resumoLeft}>
                  <Text style={styles.resumoName}>{nome}</Text>
                </View>

                {/* Valor grande com cor verde/vermelho */}
                <View style={styles.resumoRight}>
                  <Text
                    style={[
                      styles.resumoValueBig,
                      { color: isPositive ? '#00D4AA' : '#FF6B6B' },
                    ]}
                  >
                    {isPositive ? '↓' : '↑'} {formatCurrency(Math.abs(valor))}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    marginTop: 10,
  },
  errorMessage: {
    color: COLORS.warning,
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
  },
  errorText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.accent,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerGradient: {
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  headerContent: {
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.text,
    opacity: 0.9,
  },
  quickStatsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 24,
    gap: 10,
  },
  quickStatCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  quickStatValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 6,
    textAlign: 'center',
  },
  quickStatLabel: {
    fontSize: 11,
    color: COLORS.text,
    marginTop: 2,
    textAlign: 'center',
    opacity: 0.8,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 18,
    elevation: 4,
    shadowColor: COLORS.info,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3.84,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 14,
  },
  cardSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 14,
  },
  financeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
    borderRadius: 12,
  },
  financeLeft: {
    flex: 1,
  },
  financeRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 12,
  },
  financeName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  financeDetails: {
    gap: 4,
  },
  financeDetail: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  saldoRowGradient: {
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  saldoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  saldoInfo: {
    flex: 1,
    marginRight: 12,
  },
  saldoName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },
  saldoBarContainer: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0a0a0a',
    overflow: 'hidden',
  },
  saldoBar: {
    height: '100%',
    borderRadius: 4,
  },
  saldoValue: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 90,
    textAlign: 'right',
  },
  saldoAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  // Estilos para o Resumo Consolidado
  resumoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderRadius: 12,
  },
  resumoLeft: {
    flex: 1,
    marginRight: 12,
  },
  resumoRight: {
    flex: 1.2,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  resumoName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  resumoValueBig: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

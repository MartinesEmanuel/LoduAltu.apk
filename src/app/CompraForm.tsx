import React, { useState, useEffect } from 'react';
import {
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  View,
  ActivityIndicator
} from 'react-native';
import { TextInputMask } from 'react-native-masked-text';
import { enviarParaGoogleSheets, validarDados, CompraFormData } from '../lib/api';

// Mapeamento de nomes para letras
const NOME_PARA_SIGLA: Record<string, string> = {
  tauchen: 'T',
  emanuel: 'E',
  cassiano: 'C',
  murilo: 'M',
  vitor: 'V',
  vítor: 'V',
  jose: 'J',
  josé: 'J',
  shirugueru: 'S',
  t: 'T',
  e: 'E',
  c: 'C',
  m: 'M',
  v: 'V',
  j: 'J',
  s: 'S',
};

// Lista de participantes (sigla + nome para exibição)
const PARTICIPANTES = [
  { sigla: 'T', nome: 'Tauchen' },
  { sigla: 'E', nome: 'Emanuel' },
  { sigla: 'C', nome: 'Cassiano' },
  { sigla: 'M', nome: 'Murilo' },
  { sigla: 'V', nome: 'Vítor' },
  { sigla: 'J', nome: 'José' },
  { sigla: 'S', nome: 'Shirugueru' },
];

export default function CompraForm() {
  const [data, setData] = useState<CompraFormData>({
    Data: '',
    Descricao: '',
    Comprador: '',
    Deve: [],
    Valor: '',
  });

  const [dataError, setDataError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Preenche data padrão com a data atual
  useEffect(() => {
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    setData(prev => ({ ...prev, Data: `${dia}/${mes}/${ano}` }));
  }, []);

  // Normaliza entrada para sigla
  const normalizarParaSigla = (valor: string) => {
    const chave = valor.trim().toLowerCase();
    return NOME_PARA_SIGLA[chave] || valor;
  };

  // Alternar seleção de devedor
  const toggleDevedor = (sigla: string) => {
    setData(prev => {
      const jaSelecionado = prev.Deve.includes(sigla);
      if (jaSelecionado) {
        return { ...prev, Deve: prev.Deve.filter(item => item !== sigla) };
      } else {
        return { ...prev, Deve: [...prev.Deve, sigla] };
      }
    });
  };

  // Obter nome completo a partir da sigla
  const siglaParaNome = (sigla: string) => {
    const participante = PARTICIPANTES.find(p => p.sigla === sigla);
    return participante ? participante.nome : sigla;
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Modal de carregamento bloqueante */}
      {loading && (
        <View style={styles.loadingOverlay} pointerEvents="box-none">
          <View style={styles.loadingModal}>
            {/* Spinner animado */}
            <ActivityIndicator size="large" color="#fff" style={{ marginBottom: 18 }} />
            <Text style={styles.loadingText}>Registrando compra...</Text>
          </View>
        </View>
      )}
      {showSuccess && (
        <View style={{
          position: 'absolute', top: 40, left: 0, right: 0, alignItems: 'center', zIndex: 10
        }}>
          <Text style={{
            backgroundColor: '#218838', color: '#fff', padding: 12, borderRadius: 8, fontWeight: 'bold'
          }}>
            Compra registrada com sucesso!
          </Text>
        </View>
      )}
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>CADASTRO DE COMPRA</Text>

        {/* Data */}
        <Text style={styles.label}>Data:</Text>
        {dataError ? <Text style={styles.errorText}>{dataError}</Text> : null}
        <TextInputMask
          type={'datetime'}
          options={{ format: 'DD/MM/YYYY' }}
          style={styles.input}
          placeholder="Digite a data"
          placeholderTextColor="#555"
          value={data.Data}
          onChangeText={text => {
            const match = text.match(/^(\d{2})\/(\d{2})\/(\d{0,4})$/);
            if (match) {
              const dia = parseInt(match[1], 10);
              const mes = parseInt(match[2], 10);
              if (mes > 12) {
                setDataError('O mês não pode ser maior que 12');
                setData({ ...data, Data: text });
                return;
              }
              if (dia > 31) {
                setDataError('O dia não pode ser maior que 31');
                setData({ ...data, Data: text });
                return;
              }
            }
            setDataError('');
            setData({ ...data, Data: text });
          }}
        />

        {/* Descrição */}
        <Text style={styles.label}>Descrição:</Text>
        <TextInput
          style={styles.input}
          placeholder="Digite a descrição da transação"
          placeholderTextColor="#555"
          value={data.Descricao}
          onChangeText={text => setData({ ...data, Descricao: text })}
        />

        {/* Comprador */}
        <Text style={styles.label}>Comprador:</Text>
        <TextInput
          style={styles.input}
          placeholder="Digite quem comprou"
          placeholderTextColor="#555"
          value={siglaParaNome(data.Comprador)}
          onChangeText={text =>
            setData({ ...data, Comprador: normalizarParaSigla(text) })
          }
        />

        {/* Quem está devendo */}
        <Text style={styles.label}>Quem está devendo?:</Text>
        <View style={styles.checkboxContainer}>
          {PARTICIPANTES.map(({ sigla, nome }) => (
            <TouchableOpacity
              key={sigla}
              style={[
                styles.checkboxItem,
                data.Deve.includes(sigla) && styles.checkboxItemSelected
              ]}
              onPress={() => toggleDevedor(sigla)}
            >
              <Text style={[
                styles.checkboxText,
                data.Deve.includes(sigla) && styles.checkboxTextSelected
              ]}>
                {nome}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Valor */}
        <Text style={styles.label}>Valor:</Text>
        <TextInputMask
          type={'money'}
          style={styles.input}
          placeholder="Digite o valor"
          placeholderTextColor="#555"
          value={data.Valor}
          onChangeText={text => setData({ ...data, Valor: text })}
          options={{
            precision: 2,
            separator: ',',
            delimiter: '.',
            unit: 'R$ ',
            suffixUnit: ''
          }}
          keyboardType="numeric"
        />

        {/* Botão */}
        <TouchableOpacity
          style={styles.button}
          onPress={async () => {
            if (data.Deve.length === 0) {
              Alert.alert('Erro', 'Selecione pelo menos um devedor.');
              return;
            }

            // Preparar dados para envio
            const compraParaEnviar: CompraFormData[] = [{
              Data: data.Data.trim(),
              Descricao: data.Descricao.trim(),
              Comprador: data.Comprador.trim(),
              Deve: data.Deve.map(sigla => sigla.trim()),
              Valor: data.Valor.trim(),
            }];

            // Validar dados antes de enviar
            const erros = validarDados(compraParaEnviar);
            if (erros.length > 0) {
              Alert.alert('Erro de validação', erros.join('\n'));
              return;
            }

            setLoading(true);
            try {
              await enviarParaGoogleSheets(compraParaEnviar);
              setShowSuccess(true);
              setTimeout(() => setShowSuccess(false), 2000);
              setData(prev => ({
                ...prev,
                Descricao: '',
                Comprador: '',
                Deve: [],
                Valor: '',
              }));
            } catch (e) {
              Alert.alert('Erro', 'Não foi possível registrar a compra.');
            } finally {
              setLoading(false);
            }
          }}
        >
          <Text style={styles.buttonText}>Registrar Compra</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    elevation: 10,
  },
  loadingModal: {
    backgroundColor: '#222',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 20,
  },
  loadingText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  container: {
    flexGrow: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  label: {
    color: '#aaa',
    fontSize: 18,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#222',
    color: '#fff',
    fontSize: 18,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  checkboxContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  checkboxItem: {
    backgroundColor: '#222',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
  },
  checkboxItemSelected: {
    backgroundColor: '#218838',
    borderColor: '#1e7e34',
  },
  checkboxText: {
    color: '#aaa',
    fontSize: 16,
  },
  checkboxTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    marginBottom: 4,
    marginTop: -8,
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#218838',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});

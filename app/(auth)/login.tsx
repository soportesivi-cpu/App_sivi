import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { autoLogin } from '../../services/api';
import { ADMIN_EMAIL } from '../../constants/config';
import { useAppStore } from '../../services/store';

export default function LoginScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [status, setStatus]     = useState('');
  const setSession = useAppStore((state) => state.setSession);

async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Error', 'Ingresa email y contraseña');
      return;
    }

    setLoading(true);
    setStatus('Conectando...');

    try {
      const resultado = await autoLogin(email.trim(), password);

      if (!resultado) {
        Alert.alert('Error', 'Credenciales incorrectas o sin acceso');
        return;
      }

      const { workspace, data } = resultado;

      await setSession(workspace.domain, data.jwt, data.user, workspace);

      setStatus(`Conectado a ${workspace.name}`);

      const isAdmin = data.user?.role?.name === 'SuperAdmin';

      if (isAdmin) {
        router.replace('/(admin)/workspaces');
      } else {
        router.replace('/(tabs)/dashboard');
      }

    } catch (error) {
      Alert.alert('Error', 'No se pudo conectar. Verifica tu conexión.');
    } finally {
      setLoading(false);
      setStatus('');
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* LOGO */}
      <View style={styles.logoContainer}>
        <Image 
          source={require('../../bg-grande.png')} 
          style={styles.logoImage} 
          resizeMode="contain" 
        />
      </View>

      {/* CARD */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitulo}>Login</Text>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.inputRow}>
            <Text style={styles.inputIcon}>✉</Text>
            <TextInput
              style={styles.input}
              placeholder="E-mail"
              placeholderTextColor="#ffffff30"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputRow}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#ffffff30"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {/* STATUS */}
          {loading && (
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color="#2196f3" />
              <Text style={styles.statusText}>{status}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.boton, loading && styles.botonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.botonTexto}>
              {loading ? 'VERIFICANDO...' : 'LOGIN'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.footer}>© 2022–2026 · V AG-1.1.2</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoImage: {
    width: 280,
    height: 180,
  },
  card: {
    backgroundColor: '#161622',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ffffff12',
  },
  cardHeader: {
    backgroundColor: '#2196f3',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  cardTitulo: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  cardBody: {
    padding: 18,
    gap: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d0d0d',
    borderRadius: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#ffffff14',
  },
  inputIcon: {
    fontSize: 13,
    marginRight: 10,
    color: '#ffffff50',
  },
  input: {
    flex: 1,
    color: '#ffffff',
    paddingVertical: 13,
    fontSize: 14,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    color: '#2196f3',
    fontSize: 12,
  },
  boton: {
    backgroundColor: '#2196f3',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  botonDisabled: {
    opacity: 0.5,
  },
  botonTexto: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 3,
  },
  footer: {
    color: '#ffffff18',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 32,
  },
});
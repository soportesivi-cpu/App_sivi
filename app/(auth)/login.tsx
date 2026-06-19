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
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { autoLogin } from '../../services/api';
import { useAppStore } from '../../services/store';
import { Colors } from '../../constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  
  const { isDarkMode, toggleTheme, setSession } = useAppStore();
  const styles = getStyles(isDarkMode);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Error', 'Ingresa email y contraseña');
      return;
    }

    setLoading(true);
    setStatus('Conectando...');

    try {
      const resultado = await autoLogin(email.trim(), password.trim());

      if (!resultado) {
        Alert.alert('Error', 'Credenciales incorrectas o sin acceso');
        setLoading(false);
        setStatus('');
        return;
      }

      const { workspace, data } = resultado;

      // Invocar setSession con la firma actualizada pasando: domain, token, jwt, user, workspace, sessions
      await setSession(workspace.domain, data.token, data.jwt, data.user, workspace, data.sessions);

      // Todos van al dashboard. El enrutador interno del dashboard se encarga de mostrar la vista correcta según el rol y la personificación.
      router.replace('/(tabs)/dashboard');

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo conectar. Verifica tu conexión.';
      Alert.alert('Error', msg);
      setLoading(false);
      setStatus('');
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* FLOATING THEME TOGGLE */}
      <TouchableOpacity 
        style={styles.themeToggleBtn} 
        onPress={toggleTheme}
        activeOpacity={0.7}
      >
        <Ionicons 
          name={isDarkMode ? 'sunny-outline' : 'moon-outline'} 
          size={20} 
          color={isDarkMode ? '#ffffff' : '#111827'} 
        />
      </TouchableOpacity>

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
          <View style={[styles.inputRow, isEmailFocused && styles.inputRowFocused]}>
            <Text style={[styles.inputIcon, isEmailFocused && styles.inputIconFocused]}>📧</Text>
            <TextInput
              style={styles.input}
              placeholder="E-mail"
              placeholderTextColor={isDarkMode ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.45)'}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => setIsEmailFocused(true)}
              onBlur={() => setIsEmailFocused(false)}
            />
          </View>

          <View style={[styles.inputRow, isPasswordFocused && styles.inputRowFocused]}>
            <Text style={[styles.inputIcon, isPasswordFocused && styles.inputIconFocused]}>🔒</Text>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={isDarkMode ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.45)'}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              onFocus={() => setIsPasswordFocused(true)}
              onBlur={() => setIsPasswordFocused(false)}
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

function getStyles(isDarkMode: boolean) {
  const theme = isDarkMode ? Colors.dark : Colors.light;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    themeToggleBtn: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 60 : 40,
      right: 20,
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.surface,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4,
      zIndex: 10,
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
      backgroundColor: theme.surface,
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.border,
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
      backgroundColor: isDarkMode ? '#0d0d0d' : theme.surfaceSecondary,
      borderRadius: 8,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    inputRowFocused: {
      borderColor: '#2196f3',
    },
    inputIcon: {
      fontSize: 13,
      marginRight: 10,
      color: isDarkMode ? '#ffffffa0' : '#9CA3AF',
    },
    inputIconFocused: {
      color: '#2196f3',
    },
    input: {
      flex: 1,
      color: theme.text,
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
      color: isDarkMode ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.45)',
      fontSize: 10,
      textAlign: 'center',
      marginTop: 32,
    },
  });
}
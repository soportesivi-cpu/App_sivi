import { useState, useEffect } from 'react';
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
import * as SecureStore from 'expo-secure-store';
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
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const { isDarkMode, toggleTheme, setSession } = useAppStore();
  const styles = getStyles(isDarkMode);

  // Cargar correo guardado al montar la pantalla si existe "Recordarme"
  useEffect(() => {
    async function loadRememberedEmail() {
      try {
        const savedEmail = await SecureStore.getItemAsync('remembered_email');
        if (savedEmail) {
          setEmail(savedEmail);
          setRememberMe(true);
        }
      } catch (err) {
        console.warn('Error cargando correo de Recordarme:', err);
      }
    }
    loadRememberedEmail();
  }, []);

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

      // Guardar o borrar email según el estado de Recordarme
      if (rememberMe) {
        await SecureStore.setItemAsync('remembered_email', email.trim());
      } else {
        await SecureStore.deleteItemAsync('remembered_email');
      }

      // Invocar setSession con la firma actualizada
      await setSession(workspace.domain, data.token, data.jwt, data.user, workspace, data.sessions);

      // Asegurar que no quede ninguna contraseña residual en texto plano en el SecureStore
      await SecureStore.deleteItemAsync('secure_user_pass').catch(() => {});

      // Ir al dashboard
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
        <Text style={styles.cardTitulo}>Bienvenido</Text>
        <Text style={styles.cardSubtitulo}>Ingresa tus credenciales para continuar</Text>

        <View style={styles.cardBody}>
          {/* EMAIL INPUT */}
          <View style={[styles.inputRow, isEmailFocused && styles.inputRowFocused]}>
            <Ionicons 
              name="mail-outline" 
              size={18} 
              color={isEmailFocused ? '#2E9BFF' : (isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)')} 
              style={styles.inputIcon} 
            />
            <TextInput
              style={styles.input}
              placeholder="Correo electrónico"
              placeholderTextColor={isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)'}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => setIsEmailFocused(true)}
              onBlur={() => setIsEmailFocused(false)}
            />
          </View>

          {/* PASSWORD INPUT */}
          <View style={[styles.inputRow, isPasswordFocused && styles.inputRowFocused]}>
            <Ionicons 
              name="lock-closed-outline" 
              size={18} 
              color={isPasswordFocused ? '#2E9BFF' : (isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)')} 
              style={styles.inputIcon} 
            />
            <TextInput
              style={styles.input}
              placeholder="Contraseña"
              placeholderTextColor={isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)'}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              onFocus={() => setIsPasswordFocused(true)}
              onBlur={() => setIsPasswordFocused(false)}
            />
            <TouchableOpacity 
              onPress={() => setShowPassword(!showPassword)} 
              activeOpacity={0.7}
              style={styles.eyeBtn}
            >
              <Ionicons 
                name={showPassword ? "eye-outline" : "eye-off-outline"} 
                size={18} 
                color={isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)'} 
              />
            </TouchableOpacity>
          </View>

          {/* REMEMBER ME ROW */}
          <View style={styles.rememberRow}>
            <TouchableOpacity 
              style={styles.rememberClickable}
              onPress={() => setRememberMe(!rememberMe)}
              activeOpacity={0.8}
            >
              <Ionicons 
                name={rememberMe ? "checkbox" : "square-outline"} 
                size={18} 
                color={rememberMe ? '#0052FF' : (isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)')} 
              />
              <Text style={styles.rememberText}>Recordarme</Text>
            </TouchableOpacity>
          </View>

          {/* STATUS */}
          {loading && (
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color="#0052FF" />
              <Text style={styles.statusText}>{status}</Text>
            </View>
          )}

          {/* SUBMIT BUTTON */}
          <TouchableOpacity
            style={[styles.boton, loading && styles.botonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            <View style={styles.botonContent}>
              <View style={{ width: 18 }} />{/* Spacer to align main text in the center */}
              <Text style={styles.botonTexto}>
                {loading ? 'VERIFICANDO...' : 'INICIAR SESIÓN'}
              </Text>
              <Ionicons 
                name="arrow-forward-outline" 
                size={18} 
                color="#ffffff" 
                style={styles.botonIcon} 
              />
            </View>
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
      paddingHorizontal: 24,
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
      marginBottom: -20,
    },
    logoImage: {
      width: 450,
      height: 260,
      maxWidth: '100%',
    },
    card: {
      backgroundColor: isDarkMode ? 'rgba(26, 28, 44, 0.65)' : 'rgba(255, 255, 255, 0.85)',
      borderRadius: 24,
      padding: 24,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDarkMode ? 0.3 : 0.1,
      shadowRadius: 20,
      elevation: 8,
    },
    cardTitulo: {
      color: theme.text,
      fontSize: 24,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 6,
    },
    cardSubtitulo: {
      color: isDarkMode ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.55)',
      fontSize: 13,
      textAlign: 'center',
      marginBottom: 20,
    },
    cardBody: {
      gap: 16,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.03)',
      borderRadius: 14,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      height: 54,
    },
    inputRowFocused: {
      borderColor: '#0052FF',
    },
    inputIcon: {
      marginRight: 12,
    },
    input: {
      flex: 1,
      color: theme.text,
      fontSize: 14,
      height: '100%',
    },
    eyeBtn: {
      padding: 4,
    },
    rememberRow: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
      marginTop: 2,
    },
    rememberClickable: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 4,
    },
    rememberText: {
      color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
      fontSize: 13,
      fontWeight: '500',
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 4,
    },
    statusText: {
      color: '#0052FF',
      fontSize: 13,
    },
    boton: {
      backgroundColor: '#0052FF',
      borderRadius: 14,
      height: 54,
      justifyContent: 'center',
      marginTop: 10,
      shadowColor: '#0052FF',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    botonDisabled: {
      opacity: 0.5,
    },
    botonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
    },
    botonTexto: {
      color: '#ffffff',
      fontWeight: '700',
      fontSize: 14,
      letterSpacing: 1.5,
      textAlign: 'center',
    },
    botonIcon: {
      marginLeft: 0,
    },
    footer: {
      color: isDarkMode ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.45)',
      fontSize: 10,
      textAlign: 'center',
      marginTop: 32,
    },
  });
}
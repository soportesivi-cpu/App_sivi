import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAppStore } from '../../services/store';
import { WORKSPACES, buildUrls } from '../../constants/config';

type WorkspaceStatus = {
  id: string;
  name: string;
  domain: string;
  online: boolean;
  checking: boolean;
};

export default function WorkspacesScreen() {
  const [workspaces, setWorkspaces] = useState<WorkspaceStatus[]>(
    WORKSPACES.map(ws => ({ ...ws, online: false, checking: true }))
  );
  const { userData: usuario, setSession, clearSession } = useAppStore();

  useEffect(() => {
    verificarWorkspaces();
  }, []);

  async function verificarWorkspaces() {
    // Verificar estado de cada workspace en paralelo
    const checks = WORKSPACES.map(async (ws) => {
      try {
        const { API_URL } = buildUrls(ws.domain);
        const res = await fetch(`${API_URL}/resource`, {
          signal: AbortSignal.timeout(4000),
        });
        return { ...ws, online: res.ok, checking: false };
      } catch {
        return { ...ws, online: false, checking: false };
      }
    });

    const results = await Promise.allSettled(checks);
    const updated = results.map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : { ...WORKSPACES[i], online: false, checking: false }
    );
    setWorkspaces(updated);
  }

  async function entrarWorkspace(ws: WorkspaceStatus) {
    const { jwtToken } = useAppStore.getState();
    await setSession(ws.domain, jwtToken || '', usuario, ws);
    router.replace('/(tabs)/dashboard');
  }

  async function cerrarSesion() {
    await clearSession();
  }

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.titulo}>Workspaces</Text>
          <Text style={styles.subtitulo}>
            {usuario?.first_name} · {usuario?.role?.name}
          </Text>
        </View>
        <TouchableOpacity onPress={cerrarSesion} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>

      {/* LISTA */}
      <FlatList
        data={workspaces}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => entrarWorkspace(item)}
            disabled={item.checking}
          >
            <View style={styles.cardLeft}>
              <Text style={styles.cardNombre}>{item.name}</Text>
              <Text style={styles.cardDomain}>{item.domain}</Text>
            </View>

            <View style={styles.cardRight}>
              {item.checking ? (
                <ActivityIndicator size="small" color="#2196f3" />
              ) : (
                <View style={styles.statusRow}>
                  <View style={[
                    styles.dot,
                    { backgroundColor: item.online ? '#4caf50' : '#ffffff22' }
                  ]} />
                  <Text style={[
                    styles.statusText,
                    { color: item.online ? '#4caf50' : '#ffffff30' }
                  ]}>
                    {item.online ? 'Online' : 'Offline'}
                  </Text>
                </View>
              )}
              <Text style={styles.arrow}>›</Text>
            </View>
          </TouchableOpacity>
        )}

        ListHeaderComponent={
          <View style={styles.refresh}>
            <TouchableOpacity onPress={verificarWorkspaces}>
              <Text style={styles.refreshText}>↻ Verificar estado</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  titulo: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  subtitulo: {
    color: '#ffffff50',
    fontSize: 12,
    marginTop: 4,
  },
  logoutBtn: {
    borderWidth: 1,
    borderColor: '#ffffff18',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutText: {
    color: '#ffffff60',
    fontSize: 13,
  },
  lista: {
    paddingHorizontal: 20,
    gap: 10,
  },
  refresh: {
    marginBottom: 12,
  },
  refreshText: {
    color: '#2196f3',
    fontSize: 13,
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#161622',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ffffff10',
  },
  cardLeft: {
    flex: 1,
  },
  cardNombre: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  cardDomain: {
    color: '#ffffff40',
    fontSize: 11,
    marginTop: 4,
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  arrow: {
    color: '#2196f3',
    fontSize: 20,
    fontWeight: '300',
  },
});
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAlerts } from '../../services/api';
import Loading from '../../components/Loading';

// Asumimos un tipo similar al de Alertas pero pensado en Histórico Forense
type SearchResult = {
  id: number;
  probability: number;
  createdAt: string;
  Device?: { name: string };
  Tags?: { name: string }[];
};

import { useAppStore } from '../../services/store';

export default function SearchScreen() {
  const { isDarkMode } = useAppStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Filtros visuales rápidos simulados
  const [activeFilter, setActiveFilter] = useState('ALL'); 

  async function performSearch() {
    if (!query.trim() && activeFilter === 'ALL') return;
    setLoading(true);
    setHasSearched(true);
    try {
      // TODO: Conectar al endpoint real de búsqueda de tu backend usando la query
      // ej: const data = await axios.get(`.../api/search?q=${query}&type=${activeFilter}`);
      const dummyData = await getAlerts(); 
      // Filtro local simulado para la demo:
      const filtered = (dummyData?.rows || []).filter((item: SearchResult) => {
         const t = item.Tags?.[0]?.name?.toLowerCase() || '';
         if(activeFilter === 'LPR' && !t.includes('plate') && !t.includes('placa')) return false;
         if(activeFilter === 'FACE' && !t.includes('face') && !t.includes('rostro')) return false;
         return true;
      });
      setResults(filtered);
    } catch (error) {
      console.log('Search error', error);
    } finally {
      setLoading(false);
    }
  }

  function formatFecha(fecha: string) {
    if(!fecha) return '--';
    return new Date(fecha).toLocaleString('es-PE', { 
       month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  const FilterButton = ({ label, code }: { label: string, code: string }) => {
     const isActive = activeFilter === code;
     return (
       <TouchableOpacity 
          style={[styles.filterBtn, isActive && styles.filterBtnActive]} 
          onPress={() => setActiveFilter(code)}
       >
         <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{label}</Text>
       </TouchableOpacity>
     );
  };

  const styles = getStyles(isDarkMode);

  return (
    <KeyboardAvoidingView 
       style={styles.container}
       behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* HEADER DE BÚSQUEDA */}
      <View style={styles.header}>
        <Text style={styles.titulo}>Búsqueda Forense</Text>
        <Text style={styles.subtitulo}>Rastrea rostros, placas e incidentes históricos</Text>
        
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#ffffff60" style={styles.searchIcon} />
          <TextInput 
             style={styles.searchInput}
             placeholder="Ej: Placa ABC-123, Rostro VIP..."
             placeholderTextColor="#ffffff40"
             value={query}
             onChangeText={setQuery}
             onSubmitEditing={performSearch}
             returnKeyType="search"
          />
          {query.length > 0 && (
             <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
                <Ionicons name="close-circle" size={18} color="#ffffff60" />
             </TouchableOpacity>
          )}
        </View>

        {/* PILLS DE FILTRO */}
        <View style={styles.filtersRow}>
           <FilterButton label="Todos" code="ALL" />
           <FilterButton label="Vehículos (LPR)" code="LPR" />
           <FilterButton label="Rostros" code="FACE" />
           <FilterButton label="Intrusión" code="ZONE" />
        </View>
      </View>

      {/* RESULTADOS */}
      <View style={styles.body}>
         {loading ? (
           <Loading />
         ) : (
           <FlatList
             data={results}
             keyExtractor={(item, index) => `search-${item.id}-${index}`}
             contentContainerStyle={styles.lista}
             renderItem={({ item }) => (
               <View style={styles.resultCard}>
                  <View style={styles.resultIconWrapper}>
                    <Ionicons name="scan-outline" size={20} color="#2196f3" />
                  </View>
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultType}>{item.Tags?.[0]?.name || 'Evento'}</Text>
                    <Text style={styles.resultDevice}>{item.Device?.name}</Text>
                  </View>
                  <View style={styles.resultMeta}>
                    <Text style={styles.resultDate}>{formatFecha(item.createdAt)}</Text>
                    <Text style={styles.resultProb}>{Math.round(item.probability > 1 ? item.probability : item.probability * 100)}%</Text>
                  </View>
               </View>
             )}
             ListEmptyComponent={
               <View style={styles.emptyContainer}>
                 {hasSearched ? (
                   <>
                     <Ionicons name="document-text-outline" size={48} color="#ffffff20" />
                     <Text style={styles.emptyText}>No hay resultados forenses</Text>
                   </>
                 ) : (
                   <>
                     <Ionicons name="finger-print-outline" size={48} color="#ffffff20" />
                     <Text style={styles.emptyText}>Ingresa un patrón de búsqueda</Text>
                   </>
                 )}
               </View>
             }
           />
         )}
      </View>
    </KeyboardAvoidingView>
  );
}

const getStyles = (isDark: boolean) => {
  const bgMain = isDark ? '#0d0d0d' : '#f3f4f6';
  const bgCard = isDark ? '#161622' : '#ffffff';
  const textPrimary = isDark ? '#ffffff' : '#111827';
  const textSecondary = isDark ? '#ffffff60' : '#6b7280';
  const textMuted = isDark ? '#ffffff40' : '#9ca3af';
  const borderCol = isDark ? '#ffffff20' : '#d1d5db';
  const borderCardCol = isDark ? '#ffffff0a' : '#e5e7eb';

  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: bgMain,
    paddingTop: 60,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  titulo: { color: textPrimary, fontSize: 24, fontWeight: '700' },
  subtitulo: { color: '#2196f3', fontSize: 13, fontWeight: '500', marginTop: 2, marginBottom: 20 },
  
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: borderCol,
    paddingHorizontal: 12,
    height: 50,
    marginBottom: 15,
  },
  searchIcon: { marginRight: 10 },
  searchInput: {
    flex: 1,
    color: textPrimary,
    fontSize: 15,
    height: '100%',
  },
  clearBtn: { padding: 4 },
  
  filtersRow: {
    flexDirection: 'row',
    gap: 10,
  },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: bgCard,
    borderWidth: 1,
    borderColor: borderCardCol,
  },
  filterBtnActive: {
    backgroundColor: isDark ? '#2196f320' : '#e0f2fe',
    borderColor: '#2196f3',
  },
  filterText: {
    color: textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#2196f3',
  },
  
  body: {
    flex: 1,
  },
  lista: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
  resultCard: {
    flexDirection: 'row',
    backgroundColor: bgCard,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: borderCardCol,
  },
  resultIconWrapper: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: isDark ? '#2196f315' : '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  resultInfo: { flex: 1 },
  resultType: { color: textPrimary, fontSize: 14, fontWeight: '600', textTransform: 'capitalize' },
  resultDevice: { color: textMuted, fontSize: 12, marginTop: 2 },
  resultMeta: { alignItems: 'flex-end' },
  resultDate: { color: textMuted, fontSize: 11, marginBottom: 4 },
  resultProb: { color: '#2196f3', fontSize: 14, fontWeight: '700' },
  
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    gap: 15,
  },
  emptyText: {
    color: textMuted,
    fontSize: 14,
  }
});
};

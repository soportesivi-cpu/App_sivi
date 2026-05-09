import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Image,
  TouchableOpacity,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../../services/store';
import { getFaces } from '../../services/api';
import Loading from '../../components/Loading';

type Face = {
  id: number;
  name: string;
  lastname?: string;
  image?: string;
  createdAt: string;
  FaceTraings?: any[];
};

export default function FacesScreen() {
  const { activeDomain: domain } = useAppStore();

  const { data: qData, isLoading: loading } = useQuery({
    queryKey: ['faces'],
    queryFn: () => getFaces(),
  });
  
  const faces: Face[] = qData?.rows || qData || [];

  function getImageUrl(face: Face) {
    if (!face.image || !domain) return null;
    return `https://${domain}/face/${face.image}`;
  }

  function formatFecha(fecha: string) {
    return new Date(fecha).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  if (loading) {
    return <Loading />;
  }

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.titulo}>Rostros</Text>
        <Text style={styles.subtitulo}>{faces.length} registrados</Text>
      </View>

      <FlatList
        data={faces}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.lista}
        numColumns={2}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => {
          const imageUrl = getImageUrl(item);
          const trained  = item.FaceTraings?.length || 0;

          return (
            <View style={styles.card}>
              {/* FOTO */}
              <View style={styles.fotoContainer}>
                {imageUrl ? (
                  <Image
                    source={{ uri: imageUrl }}
                    style={styles.foto}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.fotoPlaceholder}>
                    <Text style={styles.fotoIniciales}>
                      {item.name?.[0]?.toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
              </View>

              {/* INFO */}
              <View style={styles.info}>
                <Text style={styles.nombre} numberOfLines={1}>
                  {item.name} {item.lastname || ''}
                </Text>
                <Text style={styles.fecha}>
                  {formatFecha(item.createdAt)}
                </Text>
                <View style={styles.trainedRow}>
                  <View style={[
                    styles.trainedBadge,
                    { backgroundColor: trained > 0 ? '#2196f318' : '#ffffff08' }
                  ]}>
                    <Text style={[
                      styles.trainedText,
                      { color: trained > 0 ? '#2196f3' : '#ffffff30' }
                    ]}>
                      {trained > 0 ? `${trained} imágenes` : 'Sin entrenar'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          );
        }}

        ListEmptyComponent={
          <View style={styles.centrado}>
            <Text style={styles.vacio}>Sin rostros registrados</Text>
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
  centrado: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  titulo: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
  },
  subtitulo: {
    color: '#ffffff50',
    fontSize: 12,
    marginTop: 4,
  },
  lista: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  row: {
    gap: 10,
    marginBottom: 10,
  },
  card: {
    flex: 1,
    backgroundColor: '#161622',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ffffff10',
  },
  fotoContainer: {
    height: 100,
    backgroundColor: '#0d0d0d',
  },
  foto: {
    width: '100%',
    height: '100%',
  },
  fotoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2196f318',
  },
  fotoIniciales: {
    color: '#2196f3',
    fontSize: 32,
    fontWeight: '700',
  },
  info: {
    padding: 10,
  },
  nombre: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  fecha: {
    color: '#ffffff40',
    fontSize: 10,
    marginTop: 3,
  },
  trainedRow: {
    marginTop: 6,
  },
  trainedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  trainedText: {
    fontSize: 9,
    fontWeight: '600',
  },
  vacio: {
    color: '#ffffff30',
    fontSize: 14,
  },
});

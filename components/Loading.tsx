import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function Loading() {
  return (
    <View style={styles.centrado}>
      <ActivityIndicator size="large" color="#2196f3" />
    </View>
  );
}

const styles = StyleSheet.create({
  centrado: {
    flex: 1,
    backgroundColor: '#0d0d0d',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

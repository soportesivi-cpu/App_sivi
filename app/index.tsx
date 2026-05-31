import { Redirect } from 'expo-router';
import { useAppStore } from '../services/store';

export default function Index() {
  const token = useAppStore((state) => state.jwtToken);

  if (!token) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(tabs)/dashboard" />;
}

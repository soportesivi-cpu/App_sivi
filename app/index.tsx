import { Redirect } from 'expo-router';
import { useAppStore } from '../services/store';

export default function Index() {
  const token = useAppStore((state) => state.jwtToken);
  const user = useAppStore((state) => state.userData);

  if (!token) {
    return <Redirect href="/(auth)/login" />;
  }

  if (user?.role?.name === 'SuperAdmin') {
    return <Redirect href="/(admin)/workspaces" />;
  }

  return <Redirect href="/(tabs)/dashboard" />;
}

import { WORKSPACES } from '../constants/config';
import { useAppStore } from './store';

async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const { activeDomain: domain, jwtToken: token, clearSession } = useAppStore.getState();

  if (!domain) throw new Error('No hay dominio activo configurado');

  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url = `https://${domain}/api/v1${endpoint}`;
  
  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    if (res.status === 401) {
      clearSession();
      throw new Error('Sesión expirada');
    }
    throw new Error(`API Error: ${res.status}`);
  }

  return res.json();
}

export async function autoLogin(email: string, password: string) {
  // Probar primero control (el principal)
  // luego los demás secuencialmente
  for (const ws of WORKSPACES) {
    try {
      const res = await fetch(
        `https://${ws.domain}/api/v1/auth/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        }
      );

      if (!res.ok) continue;

      const data = await res.json();

      if (data.jwt) {
        return { workspace: ws, data };
      }
    } catch (e) {
      continue;
    }
  }
  return null;
}

// ENDPOINTS CONFIRMADOS DEL SISTEMA
export async function getDashboard() {
  return fetchAPI('/dashboard');
}

export async function getWorkspaceState() {
  return fetchAPI('/workspace/state', {
    method: 'POST',
    body: JSON.stringify({ manager_id: 'my_computer' })
  });
}

// Las alertas vienen del endpoint /alerts/
export async function getAlerts(page = 1) {
  return fetchAPI(`/alerts/?page=${page}`);
}

export async function getDevices(page = 1) {
  return fetchAPI(`/device/?page=${page}`);
}

export async function getFaces(page = 1) {
  return fetchAPI(`/face/?page=${page}`);
}

export async function getObjects(page = 1) {
  return fetchAPI(`/object/?page=${page}`);
}

export async function getMotion(page = 1) {
  return fetchAPI(`/motion/?page=${page}`);
}

export async function getTrainedFaces() {
  return fetchAPI('/face/trained/all');
}

export async function getWorkspaces() {
  return fetchAPI('/workspace');
}

export async function getUsers() {
  return fetchAPI('/users_all/');
}

export async function getDisks() {
  return fetchAPI('/disks');
}
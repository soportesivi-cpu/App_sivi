import React from 'react';
import { useAppStore } from '../../services/store';
import AdminDashboard from '../../components/AdminDashboard';
import SuperAdminDashboard from '../../components/SuperAdminDashboard';

export default function DashboardScreen() {
  const { userData, impersonatedWorkspace } = useAppStore();

  // Enrutador Condicional: Si es SuperAdmin y no ha seleccionado un workspace, muestra su lista global.
  const userRole = (typeof userData?.role === 'object' ? userData?.role?.name : userData?.role)?.toLowerCase() || '';
  if (userRole === 'superadmin' && !impersonatedWorkspace) {
    return <SuperAdminDashboard />;
  }

  // Por defecto (Admin regular, o SuperAdmin personificando un workspace)
  return <AdminDashboard />;
}

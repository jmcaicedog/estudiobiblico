import { getCourseStructure, checkAdminAuth } from '@/app/actions';
import AdminDashboardClient from '@/app/components/AdminDashboardClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Panel de Administración - Academia de Estudio Bíblico",
  description: "Administra el contenido, módulos y lecciones del curso virtual.",
};

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const courseData = await getCourseStructure();
  const isAuthenticated = await checkAdminAuth();
  
  return (
    <AdminDashboardClient 
      initialData={courseData} 
      initialAuth={isAuthenticated} 
    />
  );
}

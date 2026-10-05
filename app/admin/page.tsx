import { getCourseStructure, checkAdminAuth } from '@/app/actions';
import AdminDashboardClient from '@/app/components/AdminDashboardClient';
import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: "Panel de Administración - Academia de Estudio Bíblico",
  description: "Administra el contenido, módulos y lecciones del curso virtual.",
};

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const user = await getSessionUser();
  if (user && user.role !== 'admin') redirect('/');
  const isAuthenticated = await checkAdminAuth();
  const courseData = isAuthenticated ? await getCourseStructure() : null;
  
  return (
    <AdminDashboardClient 
      initialData={courseData} 
      initialAuth={isAuthenticated} 
    />
  );
}

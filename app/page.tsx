import { getCourseStructure } from '@/app/actions';
import CoursePortalClient from '@/app/components/CoursePortalClient';
import LoginClient from '@/app/components/LoginClient';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getSessionUser();
  if (!user) return <LoginClient />;
  const courseData = await getCourseStructure();
  
  return (
    <CoursePortalClient initialData={courseData} user={user} />
  );
}

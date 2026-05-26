import { getCourseStructure } from '@/app/actions';
import CoursePortalClient from '@/app/components/CoursePortalClient';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const courseData = await getCourseStructure();
  
  return (
    <CoursePortalClient initialData={courseData} />
  );
}

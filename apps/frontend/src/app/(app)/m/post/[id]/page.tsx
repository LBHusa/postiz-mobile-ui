import { MobilePostDetail } from '@gitroom/frontend/components/mobile/MobilePostDetail';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PostDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <MobilePostDetail postId={id} />;
}

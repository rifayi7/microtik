import { RouterSettingsClient } from "@/components/routers/router-settings-client";

interface RouterDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function RouterDetailPage({ params }: RouterDetailPageProps) {
  const { id } = await params;
  return <RouterSettingsClient routerId={id} />;
}

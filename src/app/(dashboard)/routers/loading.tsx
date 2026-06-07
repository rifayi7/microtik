import { Skeleton } from "@/components/ui/skeleton";

export default function RoutersLoading() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-8 w-32" />
      </div>
      <Skeleton className="h-10 w-full max-w-sm" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft, Router } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-full bg-muted p-4">
        <Router className="size-8 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="max-w-md text-muted-foreground">
        The router or page you&apos;re looking for doesn&apos;t exist or has been removed.
      </p>
      <Button render={<Link href="/" />}>
        <ArrowLeft className="size-4" />
        Back to Dashboard
      </Button>
    </div>
  );
}

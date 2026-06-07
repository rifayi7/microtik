export function MikrotikSetupAlert({
  error,
  configured,
}: {
  error: string | null;
  configured: boolean;
}) {
  if (configured && !error) return null;

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
      {configured ? (
        <p>{error}</p>
      ) : (
        <p>
          MikroTik is not configured. Copy <code className="font-mono">.env.example</code> to{" "}
          <code className="font-mono">.env.local</code> and add your router host, port,
          username, and password. Restart the dev server after saving.
        </p>
      )}
    </div>
  );
}

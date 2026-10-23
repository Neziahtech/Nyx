"use client";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

/**
 * App-level error boundary. Shows a soft, readable recovery screen and logs
 * the raw error to the console.
 */
export default function NyxError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error(error);

  return (
    <Card className="mx-auto max-w-md text-center">
      <h2 className="text-lg font-semibold text-ink">Something went wrong</h2>
      <p className="mt-2 text-sm text-dim">
        Nyx hit an unexpected error on this page. Your funds are unaffected — transactions
        only happen after you approve them in Freighter.
      </p>
      <div className="mt-4">
        <Button onClick={reset}>Try again</Button>
      </div>
    </Card>
  );
}

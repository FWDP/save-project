"use client";
import Link from "next/link";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="standalone-message">
      <span className="eyebrow">LET’S TRY THAT AGAIN</span>
      <h1>We couldn’t load this view.</h1>
      <p>
        Your request could not be completed. Check your connection and try
        again.
      </p>
      <div>
        <button className="button primary" onClick={reset}>
          Try again
        </button>
        <Link className="button secondary" href="/">
          Back to SAVE
        </Link>
      </div>
    </main>
  );
}

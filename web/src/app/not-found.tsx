import Link from "next/link";
export default function NotFound() {
  return (
    <main className="standalone-message">
      <span className="eyebrow">NOT QUITE HERE</span>
      <h1>This page isn’t available.</h1>
      <p>It may have moved, or your account may not have access.</p>
      <Link className="button primary" href="/">
        Back to my workspace
      </Link>
    </main>
  );
}

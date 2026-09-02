const BACKEND_URL = (process.env.SAVE_API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    const backend = await response.json();
    return Response.json(
      {
        status: response.ok ? 'ok' : 'degraded',
        service: 'save-admin',
        backendUrl: BACKEND_URL,
        backend,
      },
      { status: response.ok ? 200 : 503 },
    );
  } catch (error) {
    return Response.json(
      {
        status: 'degraded',
        service: 'save-admin',
        backendUrl: BACKEND_URL,
        error: error instanceof Error ? error.message : 'backend health request failed',
      },
      { status: 503 },
    );
  }
}

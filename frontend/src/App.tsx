import { useEffect, useState } from 'react';
import { getHealth, type HealthResponse } from './api/health';
import './styles/app.css';

type BackendState =
  | { status: 'checking' }
  | { status: 'connected'; health: HealthResponse }
  | { status: 'offline'; message: string };

function App() {
  const [backend, setBackend] = useState<BackendState>({ status: 'checking' });

  useEffect(() => {
    const controller = new AbortController();

    getHealth(controller.signal)
      .then((health) => setBackend({ status: 'connected', health }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setBackend({
          status: 'offline',
          message: error instanceof Error ? error.message : 'Backend unavailable',
        });
      });

    return () => controller.abort();
  }, []);

  const backendLabel =
    backend.status === 'connected'
      ? 'Connected'
      : backend.status === 'checking'
        ? 'Checking...'
        : 'Offline';

  return (
    <main className="app-shell">
      <section className="intro" aria-labelledby="app-title">
        <p className="eyebrow">Italian card game</p>
        <h1 id="app-title">SCOPA</h1>
        <div className={`status status-${backend.status}`} role="status">
          <span aria-hidden="true" />
          Backend: {backendLabel}
        </div>
        {backend.status === 'offline' && <p className="error">{backend.message}</p>}
        <div className="actions" aria-label="Game actions">
          <button type="button" disabled>
            Create game
          </button>
          <button type="button" disabled>
            Join game
          </button>
        </div>
      </section>
    </main>
  );
}

export default App;

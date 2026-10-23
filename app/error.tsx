"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="sitePage" role="alert" aria-labelledby="err-title">
      <p className="sitePageKicker">GALACTIC GAMES</p>
      <h1 id="err-title">Algo ha fallado</h1>
      <p>No se ha podido mostrar esta pantalla. Tu progreso local no se ha borrado.</p>
      {error.digest ? <p className="sitePageCode">Código: {error.digest}</p> : null}
      <button type="button" className="sitePageAction" onClick={reset}>
        Reintentar
      </button>
      <a className="sitePageLink" href="/">
        Ir al inicio
      </a>
    </main>
  );
}

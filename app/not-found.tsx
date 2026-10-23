import Link from "next/link";

export const metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return (
    <main className="sitePage" aria-labelledby="nf-title">
      <p className="sitePageKicker">GALACTIC GAMES</p>
      <h1 id="nf-title">Esta ruta se ha perdido en el espacio</h1>
      <p>La página que buscas no existe o ha cambiado de sitio.</p>
      <Link className="sitePageAction" href="/">
        Volver al inicio
      </Link>
    </main>
  );
}

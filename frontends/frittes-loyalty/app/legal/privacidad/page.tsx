import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politica de privacidad | Club Frittes",
  description: "Tratamiento de datos del programa de fidelidad Club Frittes.",
  robots: { index: false, follow: false },
};

export default function PrivacidadPage(): JSX.Element {
  return (
    <>
      <h1 className="font-display text-4xl">Politica de privacidad</h1>
      <p className="text-sm text-ink-muted">
        Ultima actualizacion: 07 de mayo de 2026.
      </p>
      <p>
        Esta politica describe como Frittes Maison trata los datos personales de quienes usan Club Frittes.
      </p>
      <p>
        <strong>TODO: completar antes de prod</strong> - RUT del responsable, direccion comercial y correo de contacto para derechos ARCO.
      </p>
      <h2>Datos que recolectamos</h2>
      <ul>
        <li>Nombre, telefono y email opcional.</li>
        <li>Balance de sellos y tier del programa.</li>
        <li>Historial de transacciones de acumulacion y canje.</li>
      </ul>
      <h2>Para que los usamos</h2>
      <ul>
        <li>Gestionar el programa de fidelidad y mostrar tu pase.</li>
        <li>Comunicaciones del programa cuando corresponda.</li>
        <li>Metricas internas de uso y operacion.</li>
      </ul>
      <h2>Con quien compartimos datos</h2>
      <ul>
        <li>Apple Wallet y Google Wallet para generar pases digitales.</li>
        <li>Proveedor de SMS OTP para validar titularidad del telefono.</li>
      </ul>
      <h2>Conservacion</h2>
      <p>Mantenemos la cuenta activa y sus datos por el tiempo de uso, y hasta 2 anos tras la baja por obligaciones legales y tributarias.</p>
      <h2>Tus derechos</h2>
      <p>Puedes solicitar acceso, rectificacion o eliminacion de datos al correo de contacto oficial.</p>
      <h2>Cookies</h2>
      <p>Usamos cookie `session_token` HttpOnly para autenticacion. No usamos cookies de tracking publicitario.</p>
    </>
  );
}

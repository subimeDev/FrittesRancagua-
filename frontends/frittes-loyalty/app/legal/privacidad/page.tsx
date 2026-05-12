import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad | Club Frittes",
  description: "Tratamiento de datos del programa de fidelidad Club Frittes.",
  robots: { index: false, follow: false },
};

export default function PrivacidadPage(): JSX.Element {
  return (
    <>
      <h1 className="font-display text-4xl">Política de privacidad</h1>
      <p className="text-sm text-ink-muted">Última actualización: 12 de mayo de 2026.</p>

      <p>
        Frittes Maison (en adelante <strong>"Frittes"</strong>) opera el programa de fidelidad{" "}
        <strong>Club Frittes</strong> accesible en este sitio web. Esta política describe cómo
        recopilamos, usamos y protegemos tus datos personales en el contexto del programa.
      </p>

      <h2>1. Responsable del tratamiento</h2>
      <p>
        Frittes Maison, con domicilio en Rancagua, Región del Libertador General Bernardo O'Higgins,
        Chile. Contacto:{" "}
        <a href="mailto:contacto@frittesmaison.cl" className="underline">
          contacto@frittesmaison.cl
        </a>
        .
      </p>

      <h2>2. Datos que recopilamos</h2>
      <ul>
        <li>
          <strong>Identificación:</strong> nombre y correo electrónico que ingresas al registrarte.
        </li>
        <li>
          <strong>Programa de fidelidad:</strong> balance de sellos, nivel (tier), historial de
          acumulación y canjes, fecha de alta.
        </li>
        <li>
          <strong>Uso del servicio:</strong> fecha y hora de cada transacción, dispositivo desde el
          que accedes (solo para seguridad de sesión).
        </li>
      </ul>

      <h2>3. Para qué usamos tus datos</h2>
      <ul>
        <li>Gestionar tu cuenta y pase digital del programa Club Frittes.</li>
        <li>Enviarte tu código de verificación (OTP) por correo electrónico al iniciar sesión.</li>
        <li>Notificarte cuando canjeas un premio.</li>
        <li>Estadísticas internas de operación del programa (datos agregados, no individuales).</li>
      </ul>

      <h2>4. Base legal</h2>
      <p>
        El tratamiento se basa en tu consentimiento expreso al registrarte y en la ejecución del
        contrato (programa de fidelidad) del que eres parte, conforme a la Ley N° 19.628 sobre
        Protección de la Vida Privada de Chile.
      </p>

      <h2>5. Con quién compartimos datos</h2>
      <ul>
        <li>
          <strong>Resend (resend.com):</strong> proveedor de envío de correos transaccionales (OTP y
          notificaciones). Actúa como encargado de tratamiento bajo acuerdo de confidencialidad.
        </li>
        <li>
          <strong>Google Wallet / Apple Wallet:</strong> si eliges agregar tu pase a Wallet, los
          datos del pase se transmiten a Google LLC o Apple Inc. bajo sus propias políticas.
        </li>
        <li>
          <strong>Railway (railway.app):</strong> proveedor de infraestructura cloud donde se aloja
          el servicio. Los datos se almacenan en servidores en EE. UU.
        </li>
      </ul>
      <p>No vendemos ni cedemos tus datos a terceros con fines comerciales.</p>

      <h2>6. Conservación</h2>
      <p>
        Mantenemos tu cuenta activa mientras uses el programa. Tras 12 meses de inactividad, los
        sellos pueden expirar según las condiciones del programa. Ante solicitud de eliminación,
        borraremos tus datos en un plazo máximo de 30 días hábiles, salvo obligación legal de
        conservación (hasta 6 años por normas tributarias).
      </p>

      <h2>7. Tus derechos (ARCO)</h2>
      <p>
        Puedes ejercer tus derechos de Acceso, Rectificación, Cancelación y Oposición escribiendo a{" "}
        <a href="mailto:contacto@frittesmaison.cl" className="underline">
          contacto@frittesmaison.cl
        </a>{" "}
        con asunto <em>"Derechos ARCO – Club Frittes"</em>. Responderemos en un plazo máximo de 15
        días hábiles.
      </p>

      <h2>8. Cookies y sesión</h2>
      <p>
        Usamos únicamente una cookie técnica <code>loyalty_session</code> (HttpOnly, Secure) para
        mantener tu sesión iniciada. No usamos cookies de publicidad ni de seguimiento de terceros.
      </p>

      <h2>9. Seguridad</h2>
      <p>
        Las comunicaciones entre tu dispositivo y nuestros servidores usan HTTPS. Las contraseñas del
        personal se almacenan con hash bcrypt. Los tokens de sesión tienen tiempo de expiración y
        pueden revocarse.
      </p>

      <h2>10. Cambios a esta política</h2>
      <p>
        Notificaremos cambios relevantes por correo electrónico o mediante aviso en la app con al
        menos 15 días de anticipación.
      </p>
    </>
  );
}

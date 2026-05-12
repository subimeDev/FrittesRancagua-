import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos del programa | Club Frittes",
  description: "Condiciones de uso del programa de fidelidad Club Frittes.",
  robots: { index: false, follow: false },
};

export default function TerminosPage(): JSX.Element {
  return (
    <>
      <h1 className="font-display text-4xl">Términos del programa</h1>
      <p className="text-sm text-ink-muted">Última actualización: 12 de mayo de 2026.</p>

      <p>
        Al registrarte en <strong>Club Frittes</strong>, el programa de fidelidad de Frittes Maison,
        aceptas los siguientes términos y condiciones.
      </p>

      <h2>1. Quiénes pueden participar</h2>
      <p>
        Pueden participar personas mayores de 14 años con residencia en Chile, que tengan una
        dirección de correo electrónico válida. Una persona puede tener solo una cuenta activa.
      </p>

      <h2>2. Cómo funciona</h2>
      <p>
        Recibes <strong>1 sello</strong> por cada compra calificada en local o delivery de Frittes
        Maison. Una compra calificada es aquella que supera el monto mínimo vigente (actualmente
        $5.000 CLP), según criterio del cajero.
      </p>
      <p>
        El sello se acredita al presentar el <strong>código QR de tu pase</strong> en caja, antes de
        cerrar la transacción. No se agregan sellos retroactivamente.
      </p>

      <h2>3. Canje de premios</h2>
      <p>
        Al completar el número de sellos requerido (actualmente <strong>10 sellos</strong>), obtienes
        un cupón de canje. El premio vigente aparece en tu pase digital.
      </p>
      <ul>
        <li>El canje se realiza presentando tu QR en caja, sujeto a disponibilidad de stock.</li>
        <li>El premio no es transferible ni canjeable por dinero en efectivo.</li>
        <li>Un cupón solo puede canjearse una vez.</li>
        <li>Frittes Maison puede modificar el premio con aviso previo de 30 días.</li>
      </ul>

      <h2>4. Vigencia de los sellos</h2>
      <p>
        Los sellos expiran si transcurren <strong>12 meses</strong> sin actividad registrada en tu
        cuenta (sin acumular ni canjear). Recibirás un aviso por correo antes del vencimiento.
      </p>

      <h2>5. Uso fraudulento</h2>
      <p>
        Frittes Maison se reserva el derecho de cancelar cuentas y anular sellos o cupones obtenidos
        mediante prácticas fraudulentas, error técnico o abuso del sistema, sin previo aviso.
      </p>

      <h2>6. Cuenta y datos</h2>
      <p>
        Eres responsable de mantener tu correo electrónico vigente. Para eliminar tu cuenta o tus
        datos, contáctanos en{" "}
        <a href="mailto:contacto@frittesmaison.cl" className="underline">
          contacto@frittesmaison.cl
        </a>
        .
      </p>

      <h2>7. Modificaciones del programa</h2>
      <p>
        Frittes Maison puede modificar estas condiciones (umbral de sellos, premios, vigencia) con un
        preaviso mínimo de <strong>30 días corridos</strong>, comunicado por correo electrónico o
        aviso en la aplicación. El uso continuo del programa tras ese plazo implica aceptación.
      </p>

      <h2>8. Suspensión del programa</h2>
      <p>
        En caso de cierre del programa, Frittes Maison notificará con al menos 60 días de
        anticipación para que los participantes puedan canjear sus sellos acumulados.
      </p>

      <h2>9. Legislación aplicable</h2>
      <p>
        Estos términos se rigen por la legislación chilena. Cualquier conflicto será sometido a los
        tribunales ordinarios de la ciudad de Rancagua, Chile.
      </p>

      <h2>10. Contacto</h2>
      <p>
        Consultas sobre el programa:{" "}
        <a href="mailto:contacto@frittesmaison.cl" className="underline">
          contacto@frittesmaison.cl
        </a>
        .
      </p>
    </>
  );
}

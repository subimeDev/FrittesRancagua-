import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terminos del programa | Club Frittes",
  description: "Condiciones de uso del programa de fidelidad Club Frittes.",
  robots: { index: false, follow: false },
};

export default function TerminosPage(): JSX.Element {
  return (
    <>
      <h1 className="font-display text-4xl">Terminos del programa</h1>
      <p className="text-sm text-ink-muted">Ultima actualizacion: 07 de mayo de 2026.</p>
      <p>
        <strong>TODO: completar antes de prod</strong> - confirmar razon social, RUT y direccion legal de Frittes Maison.
      </p>
      <h2>Participacion</h2>
      <p>Pueden participar personas mayores de 14 anos, residentes en Chile.</p>
      <h2>Acumulacion de sellos</h2>
      <p>Se otorga 1 sello por compra mayor a $5.000 en local o delivery participante.</p>
      <h2>Canje</h2>
      <p>El canje se realiza en local presentando el QR del pase, sujeto a stock disponible.</p>
      <h2>Vigencia</h2>
      <p>Los sellos expiran a los 12 meses desde la ultima visita registrada.</p>
      <h2>Suspension de cuentas</h2>
      <p>Se puede suspender una cuenta por uso fraudulento o abuso del sistema.</p>
      <h2>Cambios del programa</h2>
      <p>Frittes Maison puede modificar condiciones con preaviso de 30 dias corridos.</p>
    </>
  );
}

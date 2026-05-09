// Declaraciones para que el type-check standalone (sin `next dev` previo)
// no se queje de imports CSS. Next genera estas declaraciones en
// `.next/types/` la primera vez que corre, pero antes de eso no existen.

declare module "*.css";
declare module "*.module.css";

import type { MenuCategoryData, MenuItemData } from "@/lib/api";

/**
 * Carta real de Frittes Maison (desde el PDF "Menú Frittes 2026").
 *
 * Estructura: hot dogs y sándwiches son matriz estilo × proteína. Para que la
 * carta digital sea legible, cada ESTILO es un plato: el precio mostrado es la
 * opción más barata y la descripción lista los ingredientes + todas las
 * proteínas con su precio. Así el cliente ve el plato, el "desde $X" y el
 * detalle al tocar.
 *
 * Se carga desde el botón "Cargar menú de Frittes" del editor; el dueño revisa
 * y guarda. Precios en pesos CLP.
 */

function item(
  name: string,
  price: number,
  description: string | null = null,
  badge: string | null = null,
): MenuItemData {
  return {
    id: null,
    name,
    description,
    price_cents: price,
    is_available: true,
    badge,
    image_url: null,
  };
}

// Atajo para hot dog / sándwich: ingredientes + lista proteína→precio.
function styled(
  name: string,
  ingredients: string,
  proteins: Array<[string, number]>,
  badge: string | null = null,
): MenuItemData {
  const base = Math.min(...proteins.map((p) => p[1]));
  const list = proteins.map(([n, p]) => `${n} $${p.toLocaleString("es-CL")}`).join(" · ");
  return item(name, base, `${ingredients}.\nProteínas: ${list}`, badge);
}

const cat = (name: string, items: MenuItemData[]): MenuCategoryData => ({
  id: null,
  name,
  items,
});

export const FRITTES_MENU: MenuCategoryData[] = [
  cat("Para Compartir", [
    item("Nuggets de Pollo", 2500, "6 unidades $2.500 · 12 unidades $4.500 · 18 unidades $6.000"),
    item("Aros de Cebolla", 2500, "6 unidades $2.500 · 12 unidades $4.500 · 18 unidades $6.000"),
    item("Salchipapas", 4500, "Tradicional o vegana"),
    item("Arrollados Primavera", 4500, "4 unidades", "Veggie"),
    item("Baozi", 1500, "Carne de soya o verduras", "Veggie"),
  ]),

  cat("Papas", [
    item("Papas M", 2000, "Sola $2.000 · 1 topping $3.000 · 2 toppings $4.000"),
    item("Papas L", 3000, "Sola $3.000 · 1 topping $4.500 · 2 toppings $5.500"),
    item("Papas XL", 4000, "Sola $4.000 · 1 topping $5.500 · 2 toppings $6.500"),
    item(
      "Toppings disponibles",
      0,
      "Aceituna negra, choclo, chucrut, lechuga, pepinillo, pimentón, poroto negro, poroto verde, salsa americana, tomate, aros de cebolla, carne mechada, cebolla caramelizada, champiñón, churrasco, guacamole, jalapeños, lomito, palta, pollo crispy, queso cheddar, queso cheddar vegano, queso mantecoso, queso mantecoso vegano, seitán, tocino, tofu.",
    ),
  ]),

  cat("Burritos", [
    styled("Premium Carne Mechada", "Carne mechada, guacamole, choclo, cebolla caramelizada, tocino", [["Burrito", 7200]]),
    styled("Premium Pollo Crispy", "Trozos de pollo crispy, guacamole, aceitunas, pimentón, tocino", [["Burrito", 7200]]),
    styled("Premium Seitán", "Seitán grillado, tomate, cebolla caramelizada, aceitunas, poroto negro", [["Burrito", 7200]], "Veggie"),
    styled("Premium Tofu", "Tofu, pimentón, poroto verde, guacamole, choclo", [["Burrito", 7200]], "Veggie"),
    item(
      "Arma tu Burrito",
      4800,
      "3 toppings + salsa $4.800 · 4 toppings + salsa $5.800 · 5 toppings + salsa $6.800.\nToppings: aceitunas, choclo, chucrut, jalapeño, pepinillo, pimentón, porotos negros, porotos verdes, salsa americana, tomate, lechuga.\nPremium: aros de cebolla, carne mechada, cebolla caramelizada, champiñones, churrasco, guacamole, lomito, palta, pollo crispy, queso cheddar, queso mantecoso, tocino.",
    ),
  ]),

  cat("Hot Dog", [
    styled("Completo", "Tomate, chucrut, americana, mayonesa", [["Vienesa", 3400], ["Lomito", 4800], ["Pollo Crispy", 4800], ["Churrasco", 5400], ["Mechada", 5800]]),
    styled("Italiano", "Tomate, palta, mayonesa", [["Vienesa", 3600], ["Lomito", 5000], ["Pollo Crispy", 5000], ["Churrasco", 5600], ["Mechada", 6000]]),
    styled("Luco", "Queso, mayonesa", [["Vienesa", 3200], ["Lomito", 4600], ["Pollo Crispy", 4600], ["Churrasco", 5200], ["Mechada", 5000]]),
    styled("Brasileño", "Queso, palta, mayonesa", [["Vienesa", 3600], ["Lomito", 5000], ["Pollo Crispy", 5000], ["Churrasco", 5600], ["Mechada", 6000]]),
    styled("Chacarero", "Tomate, poroto verde, ají, mayonesa", [["Vienesa", 3400], ["Lomito", 4800], ["Pollo Crispy", 4800], ["Churrasco", 5400], ["Mechada", 5800]]),
    styled("Dinámico", "Tomate, palta, americana, chucrut, mayonesa", [["Vienesa", 3800], ["Lomito", 5200], ["Pollo Crispy", 5200], ["Churrasco", 5800], ["Mechada", 6200]]),
    styled("Frittes", "Queso, tocino, aros de cebolla, salsa BBQ", [["Vienesa", 4300], ["Lomito", 5700], ["Pollo Crispy", 5700], ["Churrasco", 6300], ["Mechada", 6700]]),
    styled("A lo Pobre", "Cebolla caramelizada, papas fritas, huevo", [["Vienesa", 4300], ["Lomito", 5700], ["Pollo Crispy", 5700], ["Churrasco", 6300], ["Mechada", 6700]]),
    styled("Rancagüino", "Tocino, queso cheddar, guacamole, aceitunas", [["Vienesa", 4800], ["Lomito", 6200], ["Pollo Crispy", 6200], ["Churrasco", 6800], ["Mechada", 7200]]),
    styled("Dominga", "Queso, cebolla caramelizada, guacamole, mayonesa", [["Vienesa", 4800], ["Lomito", 6200], ["Pollo Crispy", 6200], ["Churrasco", 6800], ["Mechada", 7200]]),
    styled("Criollo", "Palta, cebolla caramelizada, champiñón, queso, mayonesa", [["Vienesa", 5000], ["Lomito", 6400], ["Pollo Crispy", 6400], ["Churrasco", 7000], ["Mechada", 7400]]),
  ]),

  cat("Hot Dog Veggie", [
    styled("Completo", "Tomate, chucrut, americana, mayonesa vegana", [["Vienesa", 3400], ["Seitán", 4800], ["Tofu", 5400]], "Veggie"),
    styled("Italiano", "Tomate, palta, mayonesa vegana", [["Vienesa", 3600], ["Seitán", 5000], ["Tofu", 5600]], "Veggie"),
    styled("Luco", "Queso vegano, mayonesa vegana", [["Vienesa", 3200], ["Seitán", 4600], ["Tofu", 5200]], "Veggie"),
    styled("Brasileño", "Queso vegano, palta, mayonesa vegana", [["Vienesa", 3600], ["Seitán", 5000], ["Tofu", 5600]], "Veggie"),
    styled("Chacarero", "Tomate, poroto verde, ají, mayonesa vegana", [["Vienesa", 3400], ["Seitán", 4800], ["Tofu", 5400]], "Veggie"),
    styled("Dinámico", "Tomate, palta, americana, chucrut, mayonesa vegana", [["Vienesa", 3800], ["Seitán", 5200], ["Tofu", 5800]], "Veggie"),
    styled("Frittes", "Queso vegano, guacamole, aros de cebolla, salsa BBQ", [["Vienesa", 4300], ["Seitán", 5700], ["Tofu", 6300]], "Veggie"),
    styled("A lo Pobre", "Cebolla caramelizada, papas fritas, champiñón", [["Vienesa", 4300], ["Seitán", 5700], ["Tofu", 6300]], "Veggie"),
    styled("Rancagüino", "Champiñón, queso cheddar vegano, guacamole, aceitunas", [["Vienesa", 4800], ["Seitán", 6200], ["Tofu", 6800]], "Veggie"),
    styled("Dominga", "Queso vegano, cebolla caramelizada, guacamole, mayonesa vegana", [["Vienesa", 4800], ["Seitán", 6200], ["Tofu", 6800]], "Veggie"),
    styled("Criollo", "Palta, cebolla caramelizada, champiñón, queso vegano, mayonesa vegana", [["Vienesa", 5000], ["Seitán", 6400], ["Tofu", 7000]], "Veggie"),
  ]),

  cat("Sándwich", [
    styled("Completo", "Tomate, chucrut, americana, mayonesa", [["Lomito", 6800], ["Pollo Crispy", 6800], ["Churrasco", 7400], ["Hamburguesa", 7600], ["Mechada", 8000]]),
    styled("Italiano", "Tomate, palta, mayonesa", [["Lomito", 7000], ["Pollo Crispy", 7000], ["Churrasco", 7600], ["Hamburguesa", 7800], ["Mechada", 8200]]),
    styled("Luco", "Queso, mayonesa", [["Lomito", 6600], ["Pollo Crispy", 6600], ["Churrasco", 7200], ["Hamburguesa", 7400], ["Mechada", 7700]]),
    styled("Brasileño", "Queso, palta, mayonesa", [["Lomito", 7000], ["Pollo Crispy", 7000], ["Churrasco", 7600], ["Hamburguesa", 7800], ["Mechada", 8200]]),
    styled("Chacarero", "Tomate, poroto verde, ají, mayonesa", [["Lomito", 6800], ["Pollo Crispy", 6800], ["Churrasco", 7400], ["Hamburguesa", 7600], ["Mechada", 8000]]),
    styled("Dinámico", "Tomate, palta, americana, chucrut, mayonesa", [["Lomito", 7200], ["Pollo Crispy", 7200], ["Churrasco", 7800], ["Hamburguesa", 8000], ["Mechada", 8400]]),
    styled("Frittes", "Queso, tocino, aros de cebolla, salsa BBQ", [["Lomito", 7700], ["Pollo Crispy", 7700], ["Churrasco", 8300], ["Hamburguesa", 8500], ["Mechada", 8900]]),
    styled("A lo Pobre", "Cebolla caramelizada, papas fritas, huevo", [["Lomito", 7700], ["Pollo Crispy", 7700], ["Churrasco", 8300], ["Hamburguesa", 8500], ["Mechada", 8900]]),
    styled("Rancagüino", "Tocino, queso cheddar, guacamole, aceitunas", [["Lomito", 8200], ["Pollo Crispy", 8200], ["Churrasco", 8800], ["Hamburguesa", 9000], ["Mechada", 9200]]),
    styled("Dominga", "Queso, cebolla caramelizada, guacamole, mayonesa", [["Lomito", 8200], ["Pollo Crispy", 8200], ["Churrasco", 8800], ["Hamburguesa", 9000], ["Mechada", 9200]]),
    styled("Criollo", "Palta, cebolla caramelizada, champiñón, queso, mayonesa", [["Lomito", 8400], ["Pollo Crispy", 8400], ["Churrasco", 9000], ["Hamburguesa", 9200], ["Mechada", 9400]]),
  ]),

  cat("Sándwich Veggie", [
    styled("Completo", "Tomate, chucrut, americana, mayonesa vegana", [["Seitán", 6800], ["Tofu", 6900], ["Not Burguer", 6900], ["Not Pollo", 6800]], "Veggie"),
    styled("Italiano", "Tomate, palta, mayonesa vegana", [["Seitán", 7000], ["Tofu", 7600], ["Not Burguer", 7600], ["Not Pollo", 7000]], "Veggie"),
    styled("Luco", "Queso vegano, mayonesa vegana", [["Seitán", 6400], ["Tofu", 7200], ["Not Burguer", 7200], ["Not Pollo", 6400]], "Veggie"),
    styled("Brasileño", "Queso vegano, palta, mayonesa vegana", [["Seitán", 7000], ["Tofu", 7600], ["Not Burguer", 7600], ["Not Pollo", 7000]], "Veggie"),
    styled("Chacarero", "Tomate, poroto verde, ají, mayonesa vegana", [["Seitán", 6800], ["Tofu", 6900], ["Not Burguer", 6900], ["Not Pollo", 6800]], "Veggie"),
    styled("Dinámico", "Tomate, palta, americana, chucrut, mayonesa vegana", [["Seitán", 7200], ["Tofu", 7800], ["Not Burguer", 7800], ["Not Pollo", 7200]], "Veggie"),
    styled("Frittes", "Queso vegano, guacamole, aros de cebolla, salsa BBQ", [["Seitán", 7000], ["Tofu", 8300], ["Not Burguer", 8300], ["Not Pollo", 7700]], "Veggie"),
    styled("A lo Pobre", "Cebolla caramelizada, papas fritas, champiñón", [["Seitán", 7000], ["Tofu", 8300], ["Not Burguer", 8300], ["Not Pollo", 7700]], "Veggie"),
    styled("Rancagüino", "Champiñón, queso cheddar vegano, guacamole, aceitunas", [["Seitán", 7200], ["Tofu", 8800], ["Not Burguer", 8800], ["Not Pollo", 8200]], "Veggie"),
    styled("Dominga", "Queso vegano, cebolla caramelizada, guacamole, mayonesa vegana", [["Seitán", 7700], ["Tofu", 8800], ["Not Burguer", 8800], ["Not Pollo", 8200]], "Veggie"),
    styled("Criollo", "Palta, cebolla caramelizada, champiñón, queso vegano, mayonesa vegana", [["Seitán", 7900], ["Tofu", 9000], ["Not Burguer", 9000], ["Not Pollo", 8400]], "Veggie"),
  ]),

  cat("Chorrillanas", [
    item("Clásica", 15000, "Churrasco o lomito, cebolla caramelizada, chorizo, huevos fritos.\nTradicional $15.000 · Monster $20.000"),
    item("Alemana", 15000, "Churrasco o lomito, chorizo, tocino, palta.\nTradicional $15.000 · Monster $20.000"),
    item("Vegetariana", 14000, "Queso, aceitunas, choclo, champiñón.\nTradicional $14.000 · Monster $17.000"),
  ]),

  cat("Chorrillanas Veggie", [
    item("Clásica", 15000, "Seitán, choclo, champiñón, tofu.\nTradicional $15.000 · Monster $20.000", "Veggie"),
    item("Vegetariana", 14000, "Queso vegano, aceitunas, choclo, champiñón.\nTradicional $14.000 · Monster $18.000", "Veggie"),
    item("Senegal", 15000, "Tofu pimentón, aceitunas, queso cheddar vegano.\nTradicional $15.000 · Monster $20.000", "Veggie"),
  ]),

  cat("Bebestibles", [
    item("Jugo Natural", 3000),
    item("Latas 350ml", 1800, "Bebidas y jugos"),
    item("Agua con/sin gas", 1300),
    item("Té / Café Nescafé", 500, "Té $500 · Café $1.200"),
    item("Café variedades", 2000),
  ]),
];

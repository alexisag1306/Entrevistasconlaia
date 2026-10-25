# Organización de estilos

`main.tsx` carga las capas en este orden para mantener la cascada actual:

1. `00-tailwind.css`: fuente y directivas Tailwind.
2. `01-foundation.css`: tokens y estilos base compartidos.
3. `02-screens-and-components.css`: estilos específicos de pantallas y componentes.
4. `03-neutral-theme.css`: paleta global grafito/plata y ajustes comunes.
5. `04-refinements.css`: refinamientos de componentes agregados después del tema.

Las capas se separaron por límites de sección sin reordenar reglas ni cambiar su contenido. Al modificar estilos, actualiza primero la sección de la pantalla/componente; evita sumar más sobrescrituras globales al final.

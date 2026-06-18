# 🌿 Buscaminas Galiza

Versión do clásico **Buscaminas** ambientada na silueta de Galicia. O proxecto
emprega o mapa como recurso lúdico para falar da diversidade forestal, da
prevención e da xestión do territorio.

## Características

- Taboleiro coa silueta de Galicia xerada desde un ficheiro GeoJSON.
- Tres niveis de dificultade.
- Primeiro movemento sempre seguro.
- Contadores e progreso da partida en tempo real.
- Controis con rato, teclado e pantalla táctil.
- Modo bandeira e pulsación longa para dispositivos táctiles.
- Deseño adaptado a escritorio e móbil.
- Sen dependencias de execución.

## Como xogar

1. Inicia un servidor local no directorio do proxecto:

   ```bash
   python3 -m http.server 8000
   ```

2. Abre <http://localhost:8000>.
3. Revela zonas seguras e usa os números para deducir onde están as minas.
4. Marca unha mina con clic dereito, pulsación longa ou co botón
   **Bandeira**.

## Desenvolvemento

As probas da lóxica pura execútanse con:

```bash
npm test
```

## Estrutura

```text
.
├── assets/
│   ├── icons/
│   │   ├── eucalipto.png
│   │   └── lume.png
│   ├── favicon.png
│   └── galicia.geojson
├── test/
│   └── game-core.test.js
├── game-core.js
├── index.html
├── main.js
├── style.css
├── LICENSE
└── README.md
```

## Nota sobre o contido ambiental

Os textos da interface son divulgativos e evitan cifras que poidan quedar
desactualizadas. Para datos ambientais concretos débense consultar fontes
oficiais, indicando sempre a fonte e a data de referencia.

## Licenza

[MIT](LICENSE).

## Créditos

Inspirado no [*Minesweeper* turístico](https://github.com/PlayableDataLab/004_tourist-minesweeper)
de PlayableDataLab.

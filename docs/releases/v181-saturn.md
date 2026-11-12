# v181-saturn — Grupo sin jugadores simulados (12-nov-2026)

Base: v180-saturn.

- **Grupo sin simulados:** NOVA, KAI y RHEA dejan de añadirse a los grupos. El grupo empieza solo contigo, y en «Invita
  a tu gente» aparecerá quien se una de verdad.
- **Competiciones:**
  - «EMPEZAR» queda desactivado mientras el grupo tenga un solo jugador, con el aviso «Invita al menos a otra persona
    al grupo para empezar».
  - Hasta que los grupos funcionen entre dispositivos (servidor), no se pueden jugar competiciones de grupo. Es la
    decisión del propietario («quitarlos del todo»).
- **Datos guardados por versiones anteriores:**
  - el grupo pierde sus miembros simulados (`demo-…`);
  - una competición contra ellos se retira y, si no había terminado, se devuelve la entrada (movimiento «Devolución
    de la entrada · {grupo}»). Comprobado inyectando un estado antiguo: el saldo pasa de 20 a 25 ₡.
- **Otros:**
  - sus nombres siguen contando como cogidos;
  - «1 jugador» en singular.
- **Validación:** `pnpm lint`, `pnpm test:determinism`, `pnpm build`, smoke de 13 juegos, solapes, `git diff --check`
  y capturas.

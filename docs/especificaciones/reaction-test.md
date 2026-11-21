# Shot Gallery — especificación de juego

**Estado de conformidad:** PENDIENTE DE DICTAMEN
**Azar en el resultado:** secuencia oculta (dónde y qué asoma) · **Verificación:** repetición en servidor

## 1. Identificación

| Campo | Valor |
|---|---|
| id · versión | `reaction-test` · 14.0.0 (VERIFIED) |
| Núcleo | `lib/verified/shotGalleryCore.v14.ts` · SHA-256 `ab996670d1b89b137a5b5eab4e17d5c979c7aacf544a0661e025047711770572` |
| Pantallas | `lib/verified/shotGalleryCore.v13.ts` (`galleryTrialsV13`) · SHA-256 `4064d76b997178d3e1d6b3acc3536d380896c7619008e56a4be8a4aa4458f639` |
| Protocolo | `PICK_0` a `PICK_11` (un toque por escondite), versión de entrada 3 |
| Origen | propio |

## 2. Descripción y modo de juego

Doce órdenes en una jungla nocturna. En cada pantalla asoman de 4 a 7 seres desde diez escondites; la orden pide abatir
los de un aura o los de una forma. Gana el menor tiempo de reacción acumulado. Contra otros jugadores.

## 3. Azar y fuentes de variabilidad

| Fuente | ¿Existe? | Detalle |
|---|---|---|
| Generador o semilla | **Sí** | Las 12 pantallas (orden, escondites, formas, auras, señuelos parecidos) salen de la semilla; también el blanco que reaparece tras un fallo (`gallery14:spawn`) |
| Contenido generado | **Sí, común** | Mismas pantallas para los dos rivales |
| Información oculta | **Sí, por diseño** | Es un juego de reacción: lo que asoma es el estímulo y no se puede conocer antes |
| Dependencia de las jugadas | Parcial | El blanco nuevo tras disparar a un señuelo depende de cuándo y a quién falla el jugador |
| Reloj y refresco | No influyen | El tiempo se mide en ticks de la simulación, que el servidor repite (README §2 y §5) |
| Coma flotante | No | La versión vigente no usa `Math.hypot` (las V3–V10 antiguas sí) |

Conclusión: la variación generada es el estímulo del juego y es igual para los dos rivales. Lo que se mide es la reacción
y el reconocimiento ante el mismo estímulo.

## 4. Modelo de simulación

120 ticks/s. Tick final máximo 50 400 (7 min). Hasta 400 entradas. Una pantalla abandonada se cierra a los 30 s.

## 5. Verificación y registro

Común con `SHOT_GALLERY_CORE_V14`.

## 6. Puntuación, desempate y premios

Milisegundos acumulados (menos es mejor): tiempo desde que asoman o desde el blanco anterior; +400 ms por señuelo,
+600 ms por disparar antes de tiempo, +1500 ms por blanco en pie en pantalla abandonada. Desempate: regla online V2.

## 7. Integridad del cliente

Común. **Con la semilla, un programa sabe dónde asomará cada blanco** antes de que aparezca y puede disparar al instante
justo. Es la trampa más grave en un juego de reacción: hace falta ocultar las pantallas futuras y detectar tiempos
inhumanos.

## 8. Equidad económica

Entre jugadores; saldo ficticio hoy.

## 9. Pruebas

| Prueba | Resultado en `e8c476e` |
|---|---|
| Mismas entradas, mismo resultado | Pasa · fixture `reaction-test@14.0.0` (22 700 ms) |
| La destreza importa | «Gallery V14 OK»: rápido 9250 ms, con fallos 20 083 ms, disparo a ciegas 47 450 ms |
| Multitoque | Comprobado en la prueba de presentación |

## 10. Declaración y responsabilidad

Redactada por la plataforma. Pendiente de dictamen y de firma del propietario.

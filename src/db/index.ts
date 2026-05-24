import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import env from "@/shared/configs/env";
import * as schema from "@/drizzle";

/**
 * Pool de conexiones MySQL con resiliencia ante inactividad.
 *
 * Problema original: con `createPool(url_string)` las opciones de keep-alive e
 * idle-timeout no se pueden pasar por URL, así que el pool usaba los defaults del
 * sistema operativo (keepAlive vacío → TCP keep-alive a ~2h en Linux) y el
 * mecanismo `_removeIdleTimeoutConnections` del pool nunca se activaba porque
 * `maxIdle === connectionLimit` es la condición requerida para que lo haga.
 * Resultado: tras un periodo de inactividad MySQL cerraba las conexiones por
 * `wait_timeout` y el pool devolvía conexiones muertas, causando
 * PROTOCOL_CONNECTION_LOST / ECONNRESET en la primera query (login, etc.)
 * y solo un reinicio del servidor recuperaba el estado.
 *
 * Solución:
 * - `uri` en el objeto de opciones permite mezclar la URL de conexión con el
 *   resto de opciones (merge ocurre en ConnectionConfig del propio mysql2).
 * - `enableKeepAlive: true` + `keepAliveInitialDelay: 10_000` activan TCP
 *   keep-alive en el socket a los 10 s de inactividad, mucho antes de que
 *   el `wait_timeout` del servidor cierre la conexión.
 * - `maxIdle: 2` < `connectionLimit: 10` activa la lógica interna de
 *   `_removeIdleTimeoutConnections` del pool, que expulsa conexiones ociosas
 *   tras `idleTimeout` ms y evita acumular conexiones muertas.
 * - `idleTimeout: 60_000` libera conexiones ociosas al minuto, alineado con
 *   el valor por defecto, pero ahora efectivo gracias al `maxIdle` reducido.
 */
export const pool = mysql.createPool({
  uri: env.DATABASE_URL,
  connectionLimit: 10,
  maxIdle: 2,
  idleTimeout: 60_000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10_000,
  waitForConnections: true,
  queueLimit: 0
});

const db = drizzle(pool, {
  schema,
  mode: "default",
  logger: env.NODE_ENV === "development"
});

export default db;

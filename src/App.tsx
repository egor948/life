import { useMemo } from "react";
import LifeApp from "./components/App";
import { loadData } from "./lib/storage";

/**
 * Точка входа статической версии Life.
 * Данные читаются из localStorage — сервер и Postgres больше не нужны.
 */
export default function App() {
  const boot = useMemo(() => loadData(), []);
  return <LifeApp initial={boot.data} fresh={boot.fresh} />;
}

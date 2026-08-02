import type { ReactNode } from "react";
import styles from "./Main.module.scss";

interface MainProps {
  children: ReactNode;
}

export function Main({ children }: MainProps) {
  return <main className={styles.main}>{children}</main>;
}

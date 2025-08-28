import { classNames } from "../db";

export function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={classNames("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border", className)}>{children}</span>;
}
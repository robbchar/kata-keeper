import { classNames } from "../db";

export function Label({ htmlFor, children, className }: { htmlFor?: string; children: React.ReactNode; className?: string }) {
  return <label htmlFor={htmlFor} className={classNames("block text-sm font-medium text-slate-700 dark:text-slate-200", className)}>{children}</label>;
}
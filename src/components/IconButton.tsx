import { classNames } from "../db";

export function IconButton({ children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...rest} className={classNames("inline-flex items-center justify-center rounded-md border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700", className)}>{children}</button>;
}
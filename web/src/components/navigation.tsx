"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from './icon';
const links = [
  ['overview','Overview','overview'], ['transactions','Transactions','transactions'],
  ['budgets','Budgets','reports'], ['categories','Categories','transactions'],
  ['savings','Savings goals','wallet'], ['reports','Reports','reports'], ['settings','Account','workspace'],
] as const;
export function Navigation() {
  const pathname = usePathname();
  return <nav aria-label="Main navigation" className="main-nav">{links.map(([path,label,icon]) => {
    const href = '/' + path, active = pathname === href || pathname.startsWith(href + '/');
    return <Link key={href} href={href} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
      <Icon name={icon} />{label}{active && <span className="nav-dot" />}
    </Link>;
  })}</nav>;
}

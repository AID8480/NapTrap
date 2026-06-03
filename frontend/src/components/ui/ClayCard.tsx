import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
}

export function ClayCard({ children, className = "" }: Props) {
  return (
    <div className={`clay-card ${className}`}>
      {children}
    </div>
  );
}

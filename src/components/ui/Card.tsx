import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export default function Card({ children }: Props) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 20,
        marginTop: 20,
        boxShadow: "0 6px 16px rgba(0,0,0,0.06)",
      }}
    >
      {children}
    </div>
  );
}
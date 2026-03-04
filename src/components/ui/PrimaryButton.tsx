import { type ReactNode } from "react";

interface Props {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

export default function PrimaryButton({
  children,
  onClick,
  disabled,
}: Props) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "8px 14px",
        borderRadius: 8,
        border: "none",
        background: "#2563eb",
        color: "#fff",
        cursor: "pointer",
        fontSize: 14,
        fontWeight: 500,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}
// src/components/common/Toast.tsx
import { useEffect } from "react";

interface Props {
  message: string;
  type?: "success" | "error" | "info";
  onClose: () => void;
}

export default function Toast({ message, type = "success", onClose }: Props) {
  // Auto-dismiss after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    success: { background: "#22c55e", color: "#fff" },
    error: { background: "#ef4444", color: "#fff" },
    info: { background: "#3b82f6", color: "#fff" },
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        backgroundColor: colors[type].background,
        color: colors[type].color,
        padding: "12px 24px",
        borderRadius: 10,
        fontSize: 14,
        fontWeight: 500,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        zIndex: 9999,
        minWidth: 200,
        textAlign: "center",
      }}
    >
      {message}
    </div>
  );
}
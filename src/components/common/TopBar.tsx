import { useAuth } from "../../context/AuthContext";
import LogoutButton from "./LogoutButton";
import NotificationBell from "./NotificationBell";
interface TopBarProps {
  title?: string;
}

export default function TopBar({ title }: TopBarProps) {
  const { user } = useAuth();

  return (
    <header
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 24px",
    background: "#ffffff",
    borderBottom: "1px solid #e5e7eb",
    boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
    position: "sticky",
    top: 0,
    zIndex: 10,
  }}
>
      <div>
        <div
  style={{
    fontWeight: 600,
    fontSize: 18,
    color: "#111827",
  }}
>
          {user?.name || user?.email || title || "Daily Subscription Platform"}
        </div>
        {user && (
          <div
  style={{
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  }}
>
            {user.role}
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <NotificationBell />
        <LogoutButton />
      </div>
    </header>
  );
}

import type { ReactNode } from "react";

interface Props {
  tabs: { key: string; label: string }[];
  activeTab: string;
  setActiveTab: (tab: any) => void;
  children: ReactNode;
}

export default function AppLayout({
  tabs,
  activeTab,
  setActiveTab,
  children,
}: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "220px 1fr",
        minHeight: "100vh",
        background: "#f3f4f6",
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          background: "#111827",
          color: "#fff",
          padding: 20,
        }}
      >
        <div
          style={{
            fontWeight: 600,
            marginBottom: 20,
            fontSize: 18,
          }}
        >
          Customer App
        </div>

        {tabs.map((tab) => (
          <div
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "10px 12px",
              marginBottom: 6,
              borderRadius: 6,
              cursor: "pointer",
              background:
                activeTab === tab.key ? "#374151" : "transparent",
            }}
          >
            {tab.label}
          </div>
        ))}
      </div>

      {/* Content */}
      <div
        style={{
          padding: 24,
        }}
      >
        {children}
      </div>
    </div>
  );
}
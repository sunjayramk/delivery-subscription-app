import type { ReactNode } from "react";

interface Props {
  title?: string; // 1. ADD THIS OPTIONAL PROP
  tabs: { key: string; label: string }[];
  activeTab: string;
  setActiveTab: (tab: any) => void;
  children: ReactNode;
}

export default function AppLayout({
  title, // 2. DESTRUCTURE IT HERE
  tabs,
  activeTab,
  setActiveTab,
  children,
}: Props) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f3f4f6",
        display: "flex",
        justifyContent: "center",
      }}
    >
      {/* Centered container */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "220px 1fr",
          width: "100%",
          maxWidth: 1100,
          minHeight: "100vh",
          background: "#fff",
          boxShadow: "0 0 40px rgba(0,0,0,0.08)",
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
            {/* 3. USE THE PROP, FALLBACK TO "Customer App" IF NONE PROVIDED */}
            {title || "Customer App"} 
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
        <div style={{ padding: 24, overflowY: "auto" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
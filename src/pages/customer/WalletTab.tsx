import { useState } from "react";

interface WalletTabProps {
  walletLoading: boolean;
  walletError: string;
  walletBalance: number;
  walletTotalBilled: number;
  walletTotalPaid: number;
  walletTx: any[];
}

export default function WalletTab({
  walletLoading, walletError, walletBalance, walletTotalBilled, walletTotalPaid, walletTx
}: WalletTabProps) {
  
  const [topupAmount, setTopupAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Quick preset amounts
  const presetAmounts = [500, 1000, 2000];

  const handleInitiatePayment = async () => {
    if (!topupAmount || isNaN(Number(topupAmount)) || Number(topupAmount) <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    
    setIsProcessing(true);
    console.log(`Initiating Razorpay for ₹${topupAmount}...`);
    
    // 🚧 RAZORPAY LOGIC WILL GO HERE IN THE NEXT STEP 🚧
    setTimeout(() => {
      alert(`Razorpay Gateway will open for ₹${topupAmount}`);
      setIsProcessing(false);
    }, 1000);
  };

  if (walletLoading) return <div style={{ padding: 40, textAlign: "center" }}>Loading wallet...</div>;
  if (walletError) return <div style={{ padding: 40, textAlign: "center", color: "#dc2626" }}>{walletError}</div>;

  // 🔴 Dynamic styling: If walletBalance > 0, they owe money (Due).
  const isDue = walletBalance > 0;

  return (
    <div style={{ padding: 16 }}>
      
      {/* 💳 THE WALLET CARD (Dynamically changes color!) */}
      <div style={{ 
        background: isDue 
          ? "linear-gradient(135deg, #991b1b 0%, #dc2626 100%)" // Alarm Red for Dues
          : "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)", // Calm Blue for Credit/Zero
        borderRadius: 20, 
        padding: 24, 
        color: "#fff",
        boxShadow: isDue 
          ? "0 10px 25px rgba(220, 38, 38, 0.4)" 
          : "0 10px 25px rgba(37, 99, 235, 0.3)",
        marginBottom: 24,
        position: "relative",
        overflow: "hidden",
        transition: "background 0.3s ease"
      }}>
        {/* Decorative background circles */}
        <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.1)" }} />
        <div style={{ position: "absolute", bottom: -30, left: -20, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <p style={{ margin: 0, fontSize: 14, opacity: 0.9, fontWeight: 500, textTransform: "uppercase", letterSpacing: 1 }}>Current Balance</p>
          <h2 style={{ margin: "8px 0", fontSize: 36, fontWeight: 800 }}>
            {/* Show the minus sign if they owe money */}
            {isDue ? "-" : ""}₹{Math.abs(walletBalance).toFixed(2)}
            <span style={{ fontSize: 16, fontWeight: 600, marginLeft: 8, opacity: 0.9 }}>
              {isDue ? "Due" : walletBalance < 0 ? "Cr" : ""}
            </span>
          </h2>
          
          <div style={{ display: "flex", gap: 24, marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.2)" }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, opacity: 0.8 }}>Total Recharged</p>
              <p style={{ margin: "4px 0 0 0", fontSize: 15, fontWeight: 700 }}>₹{walletTotalPaid.toFixed(2)}</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 11, opacity: 0.8 }}>Total Consumed</p>
              <p style={{ margin: "4px 0 0 0", fontSize: 15, fontWeight: 700 }}>₹{walletTotalBilled.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ⚡ ADD MONEY SECTION */}
      <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", marginBottom: 24, border: "1px solid #e5e7eb" }}>
        <h3 style={{ margin: "0 0 16px 0", fontSize: 16, color: "#111827" }}>Add Money to Wallet</h3>
        
        {/* Quick Select Chips */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          {presetAmounts.map(amt => (
            <button 
              key={amt}
              onClick={() => setTopupAmount(amt.toString())}
              style={{ 
                flex: 1, padding: "10px 0", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 14, transition: "all 0.2s",
                background: topupAmount === amt.toString() ? "#eff6ff" : "#f9fafb",
                color: topupAmount === amt.toString() ? "#2563eb" : "#4b5563",
                border: topupAmount === amt.toString() ? "2px solid #2563eb" : "1px solid #d1d5db"
              }}
            >
              +₹{amt}
            </button>
          ))}
        </div>

        {/* Custom Input & Pay Button */}
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <span style={{ position: "absolute", left: 14, top: 12, color: "#6b7280", fontWeight: 600 }}>₹</span>
            <input 
              type="number" 
              placeholder="Enter amount" 
              value={topupAmount}
              onChange={(e) => setTopupAmount(e.target.value)}
              style={{ width: "100%", padding: "12px 12px 12px 30px", borderRadius: 10, border: "1px solid #d1d5db", fontSize: 16, fontWeight: 600, boxSizing: "border-box" }}
            />
          </div>
          <button 
            onClick={handleInitiatePayment}
            disabled={isProcessing || !topupAmount}
            style={{ 
              background: !topupAmount ? "#9ca3af" : "#111827", 
              color: "#fff", border: "none", borderRadius: 10, padding: "0 20px", fontWeight: 700, fontSize: 15, cursor: !topupAmount ? "not-allowed" : "pointer", transition: "background 0.2s" 
            }}
          >
            {isProcessing ? "Wait..." : "Proceed"}
          </button>
        </div>
      </div>

      {/* 📜 RECENT TRANSACTIONS */}
      <div>
        <h3 style={{ margin: "0 0 16px 0", fontSize: 16, color: "#111827" }}>Recent Transactions</h3>
        {walletTx.length === 0 ? (
          <div style={{ textAlign: "center", padding: 24, background: "#f9fafb", borderRadius: 12, border: "1px dashed #d1d5db" }}>
            <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>No transactions yet.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {walletTx.map((tx) => (
              <div key={tx.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", padding: 16, borderRadius: 12, border: "1px solid #e5e7eb" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: tx.type === "credit" ? "#dcfce7" : "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                    {tx.type === "credit" ? "↓" : "↑"}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>
                      {tx.note || (tx.type === "credit" ? "Recharge" : "Order Deducted")}
                    </p>
                    <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "#6b7280" }}>
                      {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : "Pending"}
                    </p>
                  </div>
                </div>
                <div style={{ fontWeight: 800, fontSize: 15, color: tx.type === "credit" ? "#16a34a" : "#111827" }}>
                  {tx.type === "credit" ? "+" : "-"}₹{tx.amount.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
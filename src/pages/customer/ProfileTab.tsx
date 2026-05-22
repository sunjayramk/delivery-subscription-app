import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase"; // Pull in the database connection

interface ProfileTabProps {
  user: any;
  handleUpdateProfile: (updates: { name: string; phone: string }) => Promise<void>;
  handleLogout: () => void;
}

export default function ProfileTab({ user, handleUpdateProfile, handleLogout }: ProfileTabProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  // Fetch the extended user profile from Firestore
  useEffect(() => {
    async function fetchUserData() {
      if (user?.uid) {
        setEmail(user.email || ""); // Email comes from auth
        
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setName(data.name || user.name || "");
            setPhone(data.phone || ""); // Phone comes from database!
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      }
    }
    fetchUserData();
  }, [user]);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #ddd",
    fontSize: "16px",
    marginBottom: "16px",
    boxSizing: "border-box"
  };

  const disabledInputStyle: React.CSSProperties = {
    ...inputStyle,
    background: "#f3f4f6",
    color: "#6b7280",
    cursor: "not-allowed",
    border: "1px solid #e5e7eb"
  };

  const onSaveClick = async () => {
    setSaving(true);
    await handleUpdateProfile({ name, phone });
    setSaving(false);
  };

  return (
    <div style={{ paddingBottom: "40px" }}>
      <h2 style={{ marginBottom: "20px" }}>My Profile</h2>
      
      <div style={{ background: "#fff", padding: "20px", borderRadius: "12px", border: "1px solid #eee" }}>
        
        <label style={{ fontSize: "14px", color: "#666", display: "block", marginBottom: "6px" }}>
          Email Address
        </label>
        <input 
          style={disabledInputStyle} 
          value={email} 
          disabled 
          title="Email cannot be changed here"
        />

        <label style={{ fontSize: "14px", color: "#666", display: "block", marginBottom: "6px" }}>
          Full Name
        </label>
        <input 
          style={inputStyle} 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          placeholder="e.g. Rahul Sharma"
        />

        <label style={{ fontSize: "14px", color: "#666", display: "block", marginBottom: "6px" }}>
          Phone Number (WhatsApp)
        </label>
        <input 
          style={inputStyle} 
          type="tel"
          value={phone} 
          onChange={(e) => setPhone(e.target.value)} 
          placeholder="10-digit mobile number"
        />

        <button
          onClick={onSaveClick}
          disabled={saving}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: "8px",
            border: "none",
            background: "#111827",
            color: "#fff",
            fontSize: "16px",
            fontWeight: 600,
            cursor: "pointer",
            marginBottom: "12px"
          }}
        >
          {saving ? "Saving..." : "Update Profile"}
        </button>

        <button
          onClick={handleLogout}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid #dc2626",
            background: "none",
            color: "#dc2626",
            fontSize: "14px",
            fontWeight: 500,
            cursor: "pointer"
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}
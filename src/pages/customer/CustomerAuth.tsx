import { useState } from "react";
// Make sure this path correctly points to your firebase setup file!
import { auth, db } from "../../firebase"; 
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

interface CustomerAuthProps {
  tenantId?: string;
  tenantName?: string;
  onSuccess: () => void;
}

// Notice tenantId is added back here so we can use it!
export default function CustomerAuth({ tenantId, tenantName, onSuccess }: CustomerAuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Authenticate with Firebase
      let userCredential;
      if (isLogin) {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      }

      const userUid = userCredential.user.uid;

      // 2. CRITICAL: Check/Create the Firestore Profile
      const userDocRef = doc(db, "users", userUid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        // If profile doesn't exist, create a "Fresh" one
        await setDoc(userDocRef, {
          uid: userUid,
          email: email.toLowerCase(),
          role: "customer",
          tenantId: tenantId || null, 
          isOnboarded: false,         
          createdAt: new Date().toISOString()
        });
      }

      // 3. Success! Fire the transition
      if (onSuccess) {
        onSuccess();
      }

    } catch (err: any) {
      console.error("Auth error:", err);
      if (err.code === 'auth/wrong-password') setError("Invalid password.");
      else if (err.code === 'auth/user-not-found') setError("No account found with this email.");
      else if (err.code === 'auth/email-already-in-use') setError("Email already in use. Try logging in!");
      else setError(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f4f6", padding: 20 }}>
      <div style={{ background: "#fff", padding: 40, borderRadius: 16, width: "100%", maxWidth: 400, boxShadow: "0 4px 6px rgba(0,0,0,0.05)" }}>
        
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <h2 style={{ fontSize: 14, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, margin: 0 }}>
            {tenantName || "Storefront"}
          </h2>
          <h1 style={{ fontSize: 28, color: "#111827", margin: "8px 0 0 0" }}>
            {isLogin ? "Welcome Back" : "Create Account"}
          </h1>
        </div>

        {error && (
          <div style={{ background: "#fef2f2", color: "#dc2626", padding: 12, borderRadius: 8, fontSize: 14, marginBottom: 20 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Email</label>
            <input 
              type="email" 
              required 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #d1d5db" }} 
              placeholder="you@example.com"
            />
          </div>
          
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Password</label>
            <input 
              type="password" 
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #d1d5db" }} 
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{ width: "100%", padding: 14, background: "#111827", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, marginTop: 8, cursor: loading ? "not-allowed" : "pointer" }}
          >
            {loading ? "Please wait..." : (isLogin ? "Login" : "Sign Up")}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 24 }}>
          <button 
            type="button" 
            onClick={() => {
              setIsLogin(!isLogin);
              setError(""); // Clear errors when switching modes
            }} 
            style={{ background: "none", border: "none", color: "#2563eb", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Log in"}
          </button>
        </div>

      </div>
    </div>
  );
}
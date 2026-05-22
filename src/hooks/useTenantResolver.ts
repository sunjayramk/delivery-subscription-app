import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export function useTenantResolver() {
  const [resolvedTenant, setResolvedTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchTenantFromUrl() {
      try {
        const hostname = window.location.hostname; // e.g., "anssuta.yourdomain.com"
        let searchSlug = "";

        // 🛠️ DEV MODE HACK: If you are testing locally on localhost, 
        // read the URL like this instead: http://localhost:5173/?store=anssuta
        if (hostname === "localhost" || hostname === "127.0.0.1") {
          const urlParams = new URLSearchParams(window.location.search);
          searchSlug = urlParams.get("store") || "anssuta01"; // fallback for local testing
        } else {
          // 🌍 PRODUCTION MODE: Extract the first part of the subdomain
          // e.g., "anssuta.mystore.com" -> "anssuta"
          searchSlug = hostname.split(".")[0]; 
        }

        // Search Firebase for the tenant with this exact slug or code
        // Note: Make sure your Store Admin settings save a 'slug' or 'code' in lowercase!
        const q = query(
          collection(db, "tenants"), 
          where("code", "==", searchSlug.toUpperCase()) // Or use a new "slug" field
        );
        
        const snap = await getDocs(q);

        if (snap.empty) {
          setError(`Store not found for domain: ${searchSlug}`);
        } else {
          setResolvedTenant({ id: snap.docs[0].id, ...snap.docs[0].data() });
        }
      } catch (err) {
        setError("Failed to load store data.");
      } finally {
        setLoading(false);
      }
    }

    fetchTenantFromUrl();
  }, []);

  return { resolvedTenant, loading, error };
}
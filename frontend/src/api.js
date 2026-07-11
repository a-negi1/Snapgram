import { auth } from "./firebase";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export async function apiFetch(path, options = {}) {
  let token = null;
  try {
    token = await auth.currentUser?.getIdToken();
  } catch (e) {
    console.warn("[apiFetch] Could not get auth token:", e?.message);
  }

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data.error || `Request failed: ${res.status}`);
    err.status = res.status;
    err.data   = data;
    throw err;
  }

  return data;
}

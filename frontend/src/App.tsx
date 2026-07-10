import { useState } from "react";
import { Login } from "./Login";
import { Chat } from "./Chat";

export function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));

  function handleLogin(newToken: string) {
    localStorage.setItem("token", newToken);
    setToken(newToken);
  }

  function handleLogout() {
    localStorage.removeItem("token");
    setToken(null);
  }

  return token ? <Chat token={token} onLogout={handleLogout} /> : <Login onLogin={handleLogin} />;
}

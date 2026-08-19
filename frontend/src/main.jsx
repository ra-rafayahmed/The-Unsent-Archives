import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { installGlobalErrorHandlers } from "./utils/reportError";
import "./index.css";

// Catch what React cannot: uncaught errors and unhandled promise rejections.
// Installed before the first render so a crash during startup is reported too.
installGlobalErrorHandlers();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

import "./storage-shim"; // ต้อง import ก่อน App เสมอ เพื่อสร้าง window.storage ให้ทัน
import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

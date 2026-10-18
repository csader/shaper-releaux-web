import { useState } from "react";
import { BowlTool } from "./tools/bowl/BowlTool";
import { RippleTool } from "./tools/ripple/RippleTool";
import "./App.css";

type Tab = "bowl" | "ripple";

export default function App() {
  const [tab, setTab] = useState<Tab>("bowl");

  return (
    <div className="app">
      <header>
        <h1>Reuleaux Web</h1>
        <nav>
          <button className={tab === "bowl" ? "active" : ""} onClick={() => setTab("bowl")}>
            Bowl Generator
          </button>
          <button className={tab === "ripple" ? "active" : ""} onClick={() => setTab("ripple")}>
            Wave / Ripple Generator
          </button>
        </nav>
      </header>
      <main>{tab === "bowl" ? <BowlTool /> : <RippleTool />}</main>
    </div>
  );
}

import { useState } from "react";
import { BowlTool } from "./tools/bowl/BowlTool";
import { RippleTool } from "./tools/ripple/RippleTool";
import type { Unit } from "./units";
import "./App.css";

type Tab = "bowl" | "ripple";

export default function App() {
  const [tab, setTab] = useState<Tab>("bowl");
  const [unit, setUnit] = useState<Unit>("mm");

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
          <div className="unit-toggle">
            <button className={unit === "mm" ? "active" : ""} onClick={() => setUnit("mm")}>
              mm
            </button>
            <button className={unit === "in" ? "active" : ""} onClick={() => setUnit("in")}>
              in
            </button>
          </div>
        </nav>
        {unit === "in" && (
          <p className="unit-note">
            Inputs/preview shown in inches for convenience — exported SVG files are always in mm (required by
            Shaper Origin).
          </p>
        )}
      </header>
      <main>{tab === "bowl" ? <BowlTool unit={unit} /> : <RippleTool unit={unit} />}</main>
    </div>
  );
}

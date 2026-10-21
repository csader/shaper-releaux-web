import { useState } from "react";
import { BowlTool } from "./tools/bowl/BowlTool";
import { RippleTool } from "./tools/ripple/RippleTool";
import { ChordTool } from "./tools/chord/ChordTool";
import { BowlIcon } from "./icons/BowlIcon";
import { WaveIcon } from "./icons/WaveIcon";
import { ChordIcon } from "./icons/ChordIcon";
import type { Unit } from "./units";
import logo from "./assets/logo.svg";
import "./App.css";

type Tab = "bowl" | "ripple" | "chord";

export default function App() {
  const [tab, setTab] = useState<Tab>("bowl");
  const [unit, setUnit] = useState<Unit>("mm");

  return (
    <div className="app-shell">
      <nav className="icon-nav">
        <div className="icon-nav-top">
          <button
            className={`icon-nav-button ${tab === "bowl" ? "active" : ""}`}
            title="Bowl Generator"
            aria-label="Bowl Generator"
            onClick={() => setTab("bowl")}
          >
            <BowlIcon />
          </button>
          <button
            className={`icon-nav-button ${tab === "ripple" ? "active" : ""}`}
            title="Wave / Ripple Generator"
            aria-label="Wave / Ripple Generator"
            onClick={() => setTab("ripple")}
          >
            <WaveIcon />
          </button>
          <button
            className={`icon-nav-button ${tab === "chord" ? "active" : ""}`}
            title="Chord / Flute Groove Generator"
            aria-label="Chord / Flute Groove Generator"
            onClick={() => setTab("chord")}
          >
            <ChordIcon />
          </button>
        </div>
        <div className="icon-nav-unit-toggle" role="group" aria-label="Units">
          <button className={unit === "mm" ? "active" : ""} title="Millimeters" onClick={() => setUnit("mm")}>
            mm
          </button>
          <button className={unit === "in" ? "active" : ""} title="Inches" onClick={() => setUnit("in")}>
            in
          </button>
        </div>
      </nav>

      <div className="app">
        <header>
          <div className="brand">
            <img src={logo} alt="" className="logo" width="36" height="36" />
            <h1>Reuleaux Web</h1>
          </div>
          {unit === "in" && (
            <p className="unit-note">
              Inputs/preview shown in inches for convenience — exported SVG files are always in mm, matching the
              original Reuleaux app's metric-only convention (Shaper Origin itself supports both).
            </p>
          )}
        </header>
        <main>
          {tab === "bowl" ? (
            <BowlTool unit={unit} />
          ) : tab === "ripple" ? (
            <RippleTool unit={unit} />
          ) : (
            <ChordTool unit={unit} />
          )}
        </main>
      </div>
    </div>
  );
}

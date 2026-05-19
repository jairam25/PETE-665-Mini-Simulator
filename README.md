<div align="center">

# 🧪 PETE 665 — PR EOS Mini Simulator

**Peng-Robinson Equation of State (1978) simulator for black oil phase behavior — bubble point, CCE, and differential liberation, running entirely in the browser.**

[![Live Demo](https://img.shields.io/badge/Live_Demo-Vercel-000?style=for-the-badge&logo=vercel)](https://pete-665-mini-simulator.vercel.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://github.com/jairam25/PETE-665-Mini-Simulator)
[![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://github.com/jairam25/PETE-665-Mini-Simulator)

**Spring 2026 · Individual Project · 100% Client-Side**

[Live Demo](https://pete-665-mini-simulator.vercel.app) · [Source Code](https://github.com/jairam25/PETE-665-Mini-Simulator)

</div>

---

## Overview

A browser-based PVT simulator that implements the Peng-Robinson Equation of State (1978) to model black oil phase behavior. Input a multicomponent hydrocarbon composition, and the simulator calculates saturation pressure, runs Constant Composition Expansion (CCE), and performs stepwise Differential Liberation (DL) — all with interactive charts and Excel export. No backend, no installation required.

---

## Simulation Capabilities

### 1. Saturation (Bubble Point) Pressure

Calculates Psat via successive substitution using fugacity equilibrium (φᵢᴸ = φᵢⱽ). Starting from Wilson's K-value correlation for initial estimates, the algorithm iterates until ΣKᵢxᵢ = 1 within tolerance of 10⁻⁷.

### 2. Constant Composition Expansion (CCE)

Simulates a PVT cell expansion at constant temperature and overall composition:

- **Above Psat** — single-phase liquid; computes Z-factor, molar volume, and oil density directly from the cubic EOS
- **Below Psat** — two-phase flash using Rachford-Rice with Newton-Raphson; computes liquid/vapor splits, phase densities, and total relative volume (V/Vsat)

**Output properties:** Relative Volume (Vrel), Oil Density (ρo), Gas Density (ρg)

### 3. Differential Liberation (DL)

Stepwise liberation simulating laboratory DL at reservoir temperature:

1. Flash the current liquid at each pressure stage
2. Remove all liberated gas
3. Flash residual liquid to standard conditions (14.7 psia, 60°F) to obtain Vo,sc
4. Compute all volumetric properties referenced to stock-tank barrel

**Output properties:** Oil FVF (Bo), Total FVF (BtD), Gas FVF (Bg), Solution GOR (RsD), Cumulative Released Gas (RsDb)

---

## Thermodynamic Engine

### Peng-Robinson EOS (1978)

$$P = \frac{RT}{V-b} - \frac{a\alpha}{V(V+b) + b(V-b)}$$

With the 1978 κ correlation:

$$\kappa = 0.379642 + 1.48503\omega - 0.1644\omega^2 + 0.016667\omega^3$$

### Implementation Details

| Component | Method |
|---|---|
| **Cubic solver** | Cardano's method — handles 1-root and 3-root regimes; selects min(Z) for liquid, max(Z) for vapor |
| **Mixing rules** | van der Waals one-fluid (kᵢⱼ = 0) |
| **Fugacity coefficients** | Analytical derivation from the PR EOS with component-specific partial derivatives |
| **Flash convergence** | Successive substitution on K-values; Rachford-Rice solved by Newton-Raphson; convergence criterion: Σ(Kᵢⁿ⁺¹/Kᵢⁿ − 1)² < 10⁻⁹ |
| **DL gas removal** | Moles of liberated gas tracked cumulatively; residual liquid recomposed at each stage |
| **Standard conditions** | Final flash of residual oil to 14.7 psia / 60°F for Bo and RsD normalization |

### Constants

| Symbol | Value | Unit |
|---|---|---|
| R | 10.73146 | psia·ft³/(lb-mol·°R) |
| Ωa | 0.45724 | — |
| Ωb | 0.07780 | — |

---

## Default Composition

| Component | zᵢ | Tc (°R) | Pc (psia) | ω | MW |
|---|---|---|---|---|---|
| Methane | 0.19962 | 343.00 | 666.40 | 0.01142 | 16.043 |
| Ethane | 0.10010 | 549.76 | 706.50 | 0.09950 | 30.070 |
| Propane | 0.18579 | 665.68 | 616.00 | 0.15230 | 44.097 |
| n-Butane | 0.09036 | 765.29 | 550.60 | 0.20020 | 58.124 |
| n-Pentane | 0.18851 | 845.37 | 488.78 | 0.25150 | 72.150 |
| Pseudo C6+ | 0.23563 | 913.32 | 436.29 | 0.29600 | 86.177 |

All values are editable in the UI. Reservoir temperature defaults to 129.7°F.

---

## Project Structure

```
├── eos.ts           # PR EOS class — parameters, cubic solver, fugacity coefficients
├── simulator.ts     # MiniSimulator — Psat, CCE, and DL algorithms
├── App.tsx          # React UI — input panel, charts (Recharts), Excel export
├── utils.ts         # Tailwind utility helpers
├── index.css        # Global styles and CSS theme variables
├── main.tsx         # React entry point
└── vite.config.ts   # Vite build configuration
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript |
| Framework | React 19 |
| Build | Vite 6 |
| Styling | Tailwind CSS 4 |
| Charts | Recharts |
| Animations | Framer Motion |
| Export | SheetJS (xlsx) |
| Deployment | Vercel |

---

## Getting Started

```bash
git clone https://github.com/jairam25/PETE-665-Mini-Simulator.git
cd PETE-665-Mini-Simulator
npm install
npm run dev
# → http://localhost:3000
```

---

## Export

Click **Download Results (.XLSX)** after running a simulation. The Excel workbook contains three sheets:

1. **Fluid Properties** — component table with zᵢ, Tc, Pc, ω, MW
2. **CCE Results** — pressure, V/Vsat, ρo, ρg, Z-factor
3. **DL Results** — pressure, Bo, BtD, Bg, RsD, RsDb, ρo

---

## References

1. Peng, D.-Y. & Robinson, D.B. (1976). A New Two-Constant Equation of State. *Industrial & Engineering Chemistry Fundamentals*, 15(1), 59–64.
2. Peng, D.-Y. & Robinson, D.B. (1978). The Characterization of the Heptanes and Heavier Fractions for the GPA Peng-Robinson Programs. *GPA Research Report RR-28*.
3. Pedersen, K.S., Christensen, P.L., & Shaikh, J.A. *Phase Behavior of Petroleum Reservoir Fluids*, Ch. 4.
4. Rachford, H.H. & Rice, J.D. (1952). Procedure for Use of Electronic Digital Computers in Calculating Flash Vaporization Hydrocarbon Equilibrium. *JPT*, 4(10), 19.

---

## Live Demo

👉 **[pete-665-mini-simulator.vercel.app](https://pete-665-mini-simulator.vercel.app)**

---

<div align="center">

**Built for PETE 665 — Advanced Reservoir Fluid Properties**

</div>

/**
 * Peng-Robinson Equation of State (1978) Implementation
 */

export interface Component {
  name: string;
  zi: number; // overall mole fraction
  Tc: number; // Critical Temperature in Rankine
  Pc: number; // Critical Pressure in psia
  omega: number; // Acentric factor
  MW: number; // Molecular weight
}

export const R_GAS = 10.73146; // psia * ft3 / (lb-mol * R)

export interface EOSResult {
  Z: number;
  phi: number[];
  rho: number; // lb/ft3
  V: number; // ft3/lb-mol
}

export class PREOS {
  components: Component[];
  T: number; // Temperature in Rankine
  P: number; // Pressure in psia
  
  // Mixture parameters
  am: number = 0;
  bm: number = 0;
  Am: number = 0;
  Bm: number = 0;

  constructor(components: Component[], T: number, P: number) {
    this.components = components;
    this.T = T;
    this.P = P;
  }

  // Calculate parameters for a given phase composition (xi or yi)
  calculateParameters(moleFractions: number[]) {
    let am = 0;
    let bm = 0;

    const n = this.components.length;
    const a_vals: number[] = [];
    const b_vals: number[] = [];
    const alpha_vals: number[] = [];

    for (let i = 0; i < n; i++) {
      const comp = this.components[i];
      const Tr = this.T / comp.Tc;
      
      // PR 1978 correlation for m
      const m = 0.379642 + 1.48503 * comp.omega - 0.1644 * Math.pow(comp.omega, 2) + 0.016667 * Math.pow(comp.omega, 3);
      const alpha = Math.pow(1 + m * (1 - Math.sqrt(Tr)), 2);
      
      const ai = 0.45724 * Math.pow(R_GAS * comp.Tc, 2) / comp.Pc;
      const bi = 0.07780 * R_GAS * comp.Tc / comp.Pc;
      
      a_vals.push(ai);
      b_vals.push(bi);
      alpha_vals.push(alpha);
    }

    // Mixing rules (BIPs = 0)
    for (let i = 0; i < n; i++) {
      bm += moleFractions[i] * b_vals[i];
      for (let j = 0; j < n; j++) {
        am += moleFractions[i] * moleFractions[j] * Math.sqrt(a_vals[i] * alpha_vals[i] * a_vals[j] * alpha_vals[j]);
      }
    }

    this.am = am;
    this.bm = bm;
    this.Am = (am * this.P) / Math.pow(R_GAS * this.T, 2);
    this.Bm = (bm * this.P) / (R_GAS * this.T);

    return { a_vals, b_vals, alpha_vals, am, bm, Am: this.Am, Bm: this.Bm };
  }

  solveZ(phase: 'liquid' | 'vapor'): number {
    const A = this.Am;
    const B = this.Bm;

    // Z^3 - (1-B)Z^2 + (A - 2B - 3B^2)Z - (AB - B^2 - B^3) = 0
    const a2 = -(1 - B);
    const a1 = A - 2 * B - 3 * Math.pow(B, 2);
    const a0 = -(A * B - Math.pow(B, 2) - Math.pow(B, 3));

    const roots = this.solveCubic(a2, a1, a0);
    
    // Filter roots to be greater than B and positive
    const validRoots = roots.filter(r => r > B && r > 0);
    
    if (validRoots.length === 0) {
      // Fallback: if no valid root found, use B as a last resort (limit of incompressible fluid)
      return B + 0.001;
    }

    if (phase === 'liquid') {
      return Math.min(...validRoots);
    } else {
      return Math.max(...validRoots);
    }
  }

  solveCubic(a: number, b: number, c: number): number[] {
    const Q = (3 * b - Math.pow(a, 2)) / 9;
    const R = (9 * a * b - 27 * c - 2 * Math.pow(a, 3)) / 54;
    const D = Math.pow(Q, 3) + Math.pow(R, 2);

    if (D > 0) {
      const S = Math.cbrt(R + Math.sqrt(D));
      const T = Math.cbrt(R - Math.sqrt(D));
      return [S + T - a / 3];
    } else if (D === 0) {
      const S = Math.cbrt(R);
      return [2 * S - a / 3, -S - a / 3];
    } else {
      const theta = Math.acos(R / Math.sqrt(-Math.pow(Q, 3)));
      const sqrtQ = Math.sqrt(-Q);
      return [
        2 * sqrtQ * Math.cos(theta / 3) - a / 3,
        2 * sqrtQ * Math.cos((theta + 2 * Math.PI) / 3) - a / 3,
        2 * sqrtQ * Math.cos((theta + 4 * Math.PI) / 3) - a / 3
      ];
    }
  }

  calculateFugacityCoefficients(moleFractions: number[], Z: number): number[] {
    const n = this.components.length;
    const { a_vals, b_vals, alpha_vals, am, bm, Am, Bm } = this.calculateParameters(moleFractions);
    const phi: number[] = [];

    for (let i = 0; i < n; i++) {
      let sum_aj_alpha_j = 0;
      for (let j = 0; j < n; j++) {
        sum_aj_alpha_j += moleFractions[j] * Math.sqrt(a_vals[i] * alpha_vals[i] * a_vals[j] * alpha_vals[j]);
      }

      const term1 = (b_vals[i] / bm) * (Z - 1);
      const term2 = Math.log(Z - Bm);
      const term3 = (Am / (Bm * Math.sqrt(8)));
      const term4 = (2 * sum_aj_alpha_j / am - b_vals[i] / bm);
      const term5 = Math.log((Z + (1 + Math.sqrt(2)) * Bm) / (Z + (1 - Math.sqrt(2)) * Bm));

      const lnPhi = term1 - term2 - term3 * term4 * term5;
      phi.push(Math.exp(lnPhi));
    }

    return phi;
  }
}

export function rachfordRice(zi: number[], Ki: number[]): number {
  let nv = 0.5; // initial guess
  const n = zi.length;

  for (let iter = 0; iter < 100; iter++) {
    let f = 0;
    let df = 0;
    for (let i = 0; i < n; i++) {
      const denominator = 1 + nv * (Ki[i] - 1);
      f += zi[i] * (Ki[i] - 1) / denominator;
      df -= zi[i] * Math.pow(Ki[i] - 1, 2) / Math.pow(denominator, 2);
    }

    const next_nv = nv - f / df;
    if (Math.abs(next_nv - nv) < 1e-10) return next_nv;
    nv = next_nv;
    
    // Keep nv within [0, 1]
    if (nv < 0) nv = 1e-10;
    if (nv > 1) nv = 1 - 1e-10;
  }

  return nv;
}

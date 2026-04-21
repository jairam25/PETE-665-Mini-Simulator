import { PREOS, Component, rachfordRice, R_GAS } from './eos';

export interface SimulationResult {
  pressure: number;
  relativeVolume?: number;
  rhoO?: number;
  rhoG?: number;
  Bg?: number;
  Bo?: number;
  RsD?: number;
  RsDb?: number;
  BtD?: number;
  Z?: number;
}

export class MiniSimulator {
  components: Component[];
  T: number; // Rankine
  Psat: number = 0;
  Vsat: number = 0;

  constructor(components: Component[], T_F: number) {
    this.components = components;
    this.T = T_F + 459.67;
  }

  calculatePsat(): number {
    let P = 2000; // Initial guess
    const n = this.components.length;
    let Ki = this.components.map(c => (c.Pc / P) * Math.exp(5.37 * (1 + c.omega) * (1 - c.Tc / this.T)));
    
    const xi = this.components.map(c => c.zi);
    let yi = xi.map((x, i) => x * Ki[i]);
    let sumYi = yi.reduce((a, b) => a + b, 0);
    yi = yi.map(y => y / sumYi);

    for (let iter = 0; iter < 500; iter++) {
      const eosL = new PREOS(this.components, this.T, P);
      const eosV = new PREOS(this.components, this.T, P);
      
      eosL.calculateParameters(xi);
      const ZL = eosL.solveZ('liquid');
      const phiL = eosL.calculateFugacityCoefficients(xi, ZL);

      eosV.calculateParameters(yi);
      const ZV = eosV.solveZ('vapor');
      const phiV = eosV.calculateFugacityCoefficients(yi, ZV);

      const Ki_new = phiL.map((pL, i) => pL / phiV[i]);
      const next_yi = xi.map((x, i) => x * Ki_new[i]);
      const next_sumYi = next_yi.reduce((a, b) => a + b, 0);

      if (Math.abs(next_sumYi - 1) < 1e-7) {
        this.Psat = P;
        // Calculate Vsat
        const V_mol = ZL * R_GAS * this.T / P;
        this.Vsat = V_mol;
        return P;
      }

      P = P * next_sumYi;
      yi = next_yi.map(y => y / next_sumYi);
    }

    this.Psat = P;
    return P;
  }

  simulateCCE(pressures: number[]): SimulationResult[] {
    const results: SimulationResult[] = [];
    const xi_overall = this.components.map(c => c.zi);
    const MW_avg = this.components.reduce((acc, c) => acc + c.zi * c.MW, 0);

    for (const P of pressures) {
      const eos = new PREOS(this.components, this.T, P);
      
      if (P >= this.Psat) {
        eos.calculateParameters(xi_overall);
        const Z = eos.solveZ('liquid');
        const V_mol = Z * R_GAS * this.T / P;
        const rho = MW_avg / V_mol;
        
        // Ensure relativeVolume is exactly 1.0 at Psat
        const relVol = Math.abs(P - this.Psat) < 1 ? 1.0 : V_mol / this.Vsat;
        
        results.push({
          pressure: P,
          relativeVolume: relVol,
          rhoO: rho,
          rhoG: 0,
          Z: Z
        });
      } else {
        // Flash calculation
        let Ki = this.components.map(c => (c.Pc / P) * Math.exp(5.37 * (1 + c.omega) * (1 - c.Tc / this.T)));
        let nv = 0.5;
        
        // Iterative flash
        for (let fIter = 0; fIter < 100; fIter++) {
          nv = rachfordRice(xi_overall, Ki);
          const xi = xi_overall.map((z, i) => z / (1 + nv * (Ki[i] - 1)));
          const yi = xi.map((x, i) => x * Ki[i]);

          const eosL = new PREOS(this.components, this.T, P);
          eosL.calculateParameters(xi);
          const ZL = eosL.solveZ('liquid');
          const phiL = eosL.calculateFugacityCoefficients(xi, ZL);

          const eosV = new PREOS(this.components, this.T, P);
          eosV.calculateParameters(yi);
          const ZV = eosV.solveZ('vapor');
          const phiV = eosV.calculateFugacityCoefficients(yi, ZV);

          const Ki_new = phiL.map((pL, i) => pL / phiV[i]);
          const diff = Ki_new.reduce((acc, k, i) => acc + Math.pow(k / Ki[i] - 1, 2), 0);
          Ki = Ki_new;
          if (diff < 1e-9) break;
        }

        const xi = xi_overall.map((z, i) => z / (1 + nv * (Ki[i] - 1)));
        const yi = xi.map((x, i) => x * Ki[i]);
        
        const eosL = new PREOS(this.components, this.T, P);
        eosL.calculateParameters(xi);
        const ZL = eosL.solveZ('liquid');
        const VL_mol = ZL * R_GAS * this.T / P;
        const MWL = this.components.reduce((acc, c, i) => acc + xi[i] * c.MW, 0);
        const rhoL = MWL / VL_mol;

        const eosV = new PREOS(this.components, this.T, P);
        eosV.calculateParameters(yi);
        const ZV = eosV.solveZ('vapor');
        const VV_mol = ZV * R_GAS * this.T / P;
        const MWV = this.components.reduce((acc, c, i) => acc + yi[i] * c.MW, 0);
        const rhoV = MWV / VV_mol;

        const V_total_mol = (1 - nv) * VL_mol + nv * VV_mol;

        results.push({
          pressure: P,
          relativeVolume: V_total_mol / this.Vsat,
          rhoO: rhoL,
          rhoG: rhoV
        });
      }
    }

    return results;
  }

  simulateDL(pressures: number[]): SimulationResult[] {
    const results: SimulationResult[] = [];
    let current_zi = this.components.map(c => c.zi);
    let current_moles = 1.0;
    
    // Standard conditions
    const T_sc = 60 + 459.67;
    const P_sc = 14.7;

    const dlSteps: { P: number, nv: number, xi: number[], yi: number[], ZV: number, ZL: number, molesL: number, molesV: number }[] = [];

    // 1. Perform step-wise flash and gas removal
    for (const P of pressures) {
      if (P > this.Psat + 0.1) continue;

      let Ki = this.components.map(c => (c.Pc / P) * Math.exp(5.37 * (1 + c.omega) * (1 - c.Tc / this.T)));
      let nv = 0;

      // For pressures below Psat, we must find a valid nv > 0
      if (P < this.Psat - 0.1) {
        // Initial guess for nv based on Wilson's K-values if it's the first stage below Psat
        nv = rachfordRice(current_zi, Ki);
      }

      for (let fIter = 0; fIter < 100; fIter++) {
        nv = rachfordRice(current_zi, Ki);
        const xi = current_zi.map((z, i) => z / (1 + nv * (Ki[i] - 1)));
        const yi = xi.map((x, i) => x * Ki[i]);

        const eosL = new PREOS(this.components, this.T, P);
        eosL.calculateParameters(xi);
        const ZL = eosL.solveZ('liquid');
        const phiL = eosL.calculateFugacityCoefficients(xi, ZL);

        const eosV = new PREOS(this.components, this.T, P);
        eosV.calculateParameters(yi);
        const ZV = eosV.solveZ('vapor');
        const phiV = eosV.calculateFugacityCoefficients(yi, ZV);

        const Ki_new = phiL.map((pL, i) => pL / phiV[i]);
        const diff = Ki_new.reduce((acc, k, i) => acc + Math.pow(k / Ki[i] - 1, 2), 0);
        Ki = Ki_new;
        if (diff < 1e-9) break;
      }

      const xi = current_zi.map((z, i) => z / (1 + nv * (Ki[i] - 1)));
      const yi = xi.map((x, i) => x * Ki[i]);
      const eosL = new PREOS(this.components, this.T, P);
      eosL.calculateParameters(xi);
      const ZL = eosL.solveZ('liquid');
      const eosV = new PREOS(this.components, this.T, P);
      eosV.calculateParameters(yi);
      const ZV = eosV.solveZ('vapor');

      const molesV = current_moles * nv;
      const molesL = current_moles * (1 - nv);

      dlSteps.push({ P, nv, xi, yi, ZV, ZL, molesL, molesV });

      current_zi = [...xi];
      current_moles = molesL;
    }

    // 2. Final flash of residual oil to SC
    const zi_last = current_zi;
    let Ki_sc = this.components.map(c => (c.Pc / P_sc) * Math.exp(5.37 * (1 + c.omega) * (1 - c.Tc / T_sc)));
    let nv_sc = rachfordRice(zi_last, Ki_sc);
    const xi_sc = zi_last.map((z, i) => z / (1 + nv_sc * (Ki_sc[i] - 1)));
    const eosL_sc = new PREOS(this.components, T_sc, P_sc);
    eosL_sc.calculateParameters(xi_sc);
    const ZL_sc = eosL_sc.solveZ('liquid');
    
    const molesL_sc = current_moles * (1 - nv_sc);
    const Vo_sc = molesL_sc * ZL_sc * R_GAS * T_sc / P_sc;
    const Vo_sc_bbl = Vo_sc / 5.615;

    // 3. Calculate properties
    const stepResults: any[] = [];
    let total_gas_sc = (current_moles * nv_sc) * 379.6; // Gas from final SC flash
    for (const step of dlSteps) {
      total_gas_sc += step.molesV * 379.6;
    }

    let cum_released_gas_sc = 0;
    for (const step of dlSteps) {
      const Vgas_step_sc = step.molesV * 379.6;
      cum_released_gas_sc += Vgas_step_sc;
      
      // RsD is the gas remaining in solution AFTER this stage's gas is removed
      const RsD_gas_sc = total_gas_sc - cum_released_gas_sc;
      
      const VL = step.molesL * step.ZL * R_GAS * this.T / step.P;
      const VL_bbl = VL / 5.615;
      
      const Bo = VL_bbl / Vo_sc_bbl;
      const RsD = RsD_gas_sc / Vo_sc_bbl;
      const RsDb = total_gas_sc / Vo_sc_bbl;
      const Bg = 0.005035 * step.ZV * this.T / step.P; // bbl/scf
      
      const MWL = this.components.reduce((acc, c, j) => acc + step.xi[j] * c.MW, 0);
      const VL_mol = step.ZL * R_GAS * this.T / step.P;
      const rhoO = MWL / VL_mol;

      stepResults.push({
        pressure: step.P,
        Bo,
        RsD,
        RsDb,
        Bg,
        rhoO
      });
    }

    return stepResults.map(r => ({
      pressure: r.pressure,
      Bo: r.Bo,
      RsD: r.RsD,
      RsDb: r.RsDb,
      Bg: r.Bg,
      BtD: r.Bo + r.Bg * (r.RsDb - r.RsD),
      rhoO: r.rhoO
    }));
  }
}

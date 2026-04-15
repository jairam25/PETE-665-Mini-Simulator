import React, { useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { 
  Beaker, 
  Settings, 
  Play, 
  TrendingUp, 
  Droplets, 
  Wind,
  Info,
  ChevronRight,
  Database,
  Presentation,
  LayoutDashboard,
  ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import pptxgen from "pptxgenjs";
import * as XLSX from 'xlsx';
import { cn } from './utils';
import { MiniSimulator, SimulationResult } from './simulator';
import { Component } from './eos';

const INITIAL_COMPOSITION: Component[] = [
  { name: 'Methane', zi: 0.19962, Tc: 343.0, Pc: 666.4, omega: 0.01142, MW: 16.043 },
  { name: 'Ethane', zi: 0.10010, Tc: 549.76, Pc: 706.5, omega: 0.0995, MW: 30.070 },
  { name: 'Propane', zi: 0.18579, Tc: 665.68, Pc: 616.0, omega: 0.1523, MW: 44.097 },
  { name: 'n-Butane', zi: 0.09036, Tc: 765.29, Pc: 550.6, omega: 0.2002, MW: 58.124 },
  { name: 'n-Pentane', zi: 0.18851, Tc: 845.37, Pc: 488.78, omega: 0.2515, MW: 72.150 },
  { name: 'PSEUDO+', zi: 0.23563, Tc: 913.32, Pc: 436.293, omega: 0.296, MW: 86.177 },
];

export default function App() {
  const SLIDES = [
    {
      title: "PETE 665: Hydrocarbon Property Mini-Simulator",
      subtitle: "Phase Behavior Modeling using Peng-Robinson EOS (1978)",
      content: ["Presented by: Somesh Dhamanskar", "Date: April 21, 2026", "Focus: Black Oil PVT Simulation"],
      icon: Beaker
    },
    {
      title: "Project Objectives",
      content: [
        "Develop a computational tool to simulate laboratory PVT tests.",
        "Implement the Peng-Robinson 1978 Equation of State.",
        "Model a specific Black Oil composition at 129.7°F.",
        "Compare manual Excel calculations with an automated simulator.",
        "Analyze the effect of pressure depletion on phase properties."
      ],
      icon: Info
    },
    {
      title: "Fluid Characterization & Input Data",
      content: [
        "Fluid Type: Black Oil",
        "Methane (19.96%) to n-Pentane (18.85%)",
        "PSEUDO+ Fraction: 23.56% mole fraction (MW = 86.177)",
        "Temperature: 129.7°F (589.37°R)",
        "BIPs (Binary Interaction Parameters) set to zero."
      ],
      icon: Database
    },
    {
      title: "Thermodynamic Foundation: PR EOS (1978)",
      content: [
        "Improved accuracy for heavy fractions and acentric factor correlations.",
        "m parameter: Calculated using the 1978 cubic correlation for omega.",
        "alpha(T): Temperature correction factor for molecular attraction.",
        "Cubic Equation: Solved for Z (Compressibility Factor) to derive molar volume."
      ],
      icon: TrendingUp
    },
    {
      title: "Excel Implementation Workflow",
      content: [
        "Pure Component Constants: Tc, Pc, omega setup.",
        "Intermediate Calculations: Tri, mi, alpha_i, ai, bi.",
        "Mixing Rules: van der Waals one-fluid mixing rules for am and bm.",
        "Solver Integration: Using Goal Seek to find the root of the cubic equation.",
        "Verification: Residual value driven to zero for consistency."
      ],
      icon: Settings
    },
    {
      title: "Mini Simulator Architecture",
      content: [
        "Frontend: React.js with Tailwind CSS for a modern dashboard.",
        "Engine: TypeScript implementation of PR-EOS and Rachford-Rice.",
        "Visualization: Interactive Recharts for real-time trend analysis.",
        "Design: 'Elegant Dark' theme for professional presentation."
      ],
      icon: LayoutDashboard
    },
    {
      title: "Saturation Pressure (Psat) Solver",
      content: [
        "Algorithm: Successive Substitution Iteration (SSI).",
        "Initial Guess: Wilson Equation for K-values.",
        "Convergence: Reached when fugacities are equal (phi_L * xi = phi_V * yi).",
        "Result: The pressure where the sum of mole fractions in the vapor phase equals 1.0."
      ],
      icon: Droplets
    },
    {
      title: "CCE Simulation",
      content: [
        "Process: Isothermal expansion of a fixed mass of fluid.",
        "Relative Volume (V/Vsat): Tracking the PV relationship.",
        "Phase Densities: Monitoring the divergence of oil and gas densities.",
        "Transition: Identifying the bubble point boundary."
      ],
      icon: Wind
    },
    {
      title: "DL Simulation",
      content: [
        "Process: Step-wise pressure reduction with continuous gas removal.",
        "Bo (Oil FVF): Shrinkage of oil due to gas evolution.",
        "Rs (Solution GOR): Depletion of dissolved gas.",
        "Standard Conditions: Final flash to 60°F and 14.7 psia."
      ],
      icon: Wind
    },
    {
      title: "Conclusion & Model Validation",
      content: [
        "Built a dual-platform solution (Excel + Web App).",
        "Excel Z-factor (0.4977 at 2000 psia) aligns with simulator logic.",
        "PR-EOS provides a robust framework for complex Black Oil behavior.",
        "Tool is ready for field-scale sensitivity studies."
      ],
      icon: Beaker
    }
  ];

  const [view, setView] = useState<'simulator' | 'presentation'>('simulator');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [tempF, setTempF] = useState(129.7);
  const [composition, setComposition] = useState<Component[]>(INITIAL_COMPOSITION);
  const [psat, setPsat] = useState<number | null>(null);
  const [cceResults, setCceResults] = useState<SimulationResult[]>([]);
  const [dlResults, setDlResults] = useState<SimulationResult[]>([]);
  const [loading, setLoading] = useState(false);

  const runSimulation = () => {
    setLoading(true);
    setTimeout(() => {
      try {
        const sim = new MiniSimulator(composition, tempF);
        const calculatedPsat = sim.calculatePsat();
        setPsat(calculatedPsat);

        // CCE Pressures: Full range to show two-phase behavior
        const ccePressures = [
          2000, 1750, 1500, 1250, 1000, 
          calculatedPsat, 
          700, 600, 500, 400, 300, 200, 100
        ].filter(p => p > 0).sort((a, b) => b - a);
        const cce = sim.simulateCCE(ccePressures);
        setCceResults(cce);

        // DL Pressures: Psat down to 100
        const dlPressures = [calculatedPsat, 500, 300, 100].sort((a, b) => b - a);
        const dl = sim.simulateDL(dlPressures);
        setDlResults(dl);
      } catch (error) {
        console.error("Simulation error:", error);
      } finally {
        setLoading(false);
      }
    }, 100);
  };

  const nextSlide = () => setCurrentSlide(prev => Math.min(prev + 1, SLIDES.length - 1));
  const prevSlide = () => setCurrentSlide(prev => Math.max(prev - 1, 0));

  const downloadPPT = () => {
    const pres = new pptxgen();
    
    SLIDES.forEach((slideData) => {
      const slide = pres.addSlide();
      
      // Title
      slide.addText(slideData.title, { 
        x: 0.5, y: 0.5, w: 9, h: 1, 
        fontSize: 32, bold: true, color: "00D1FF", align: "center" 
      });

      if (slideData.subtitle) {
        slide.addText(slideData.subtitle, { 
          x: 0.5, y: 1.5, w: 9, h: 0.5, 
          fontSize: 18, italic: true, color: "666666", align: "center" 
        });
      }

      // Content
      slideData.content.forEach((text, index) => {
        slide.addText(text, { 
          x: 1, y: 2.5 + (index * 0.6), w: 8, h: 0.5, 
          fontSize: 14, bullet: true, color: "333333" 
        });
      });
    });

    pres.writeFile({ fileName: "PETE665_Simulator_Presentation.pptx" });
  };

  const downloadExcel = () => {
    if (cceResults.length === 0 && dlResults.length === 0) return;

    const wb = XLSX.utils.book_new();
    
    // 1. Fluid Properties Sheet
    const propData = composition.map(c => ({
      'Component': c.name,
      'Mole Fraction (zi)': c.zi,
      'Tc (Rankine)': c.Tc,
      'Pc (psia)': c.Pc,
      'Acentric Factor (omega)': c.omega,
      'MW (lb/lb-mol)': c.MW
    }));
    const wsProps = XLSX.utils.json_to_sheet(propData);
    XLSX.utils.book_append_sheet(wb, wsProps, "Fluid Properties");

    // 2. CCE Results Sheet
    if (cceResults.length > 0) {
      const cceData = cceResults.map(r => ({
        'Pressure (psia)': r.pressure,
        'Relative Volume (V/Vsat)': r.relativeVolume,
        'Oil Density (lb/ft3)': r.rhoO,
        'Gas Density (lb/ft3)': r.rhoG,
        'Z-Factor': r.Z
      }));
      const wsCCE = XLSX.utils.json_to_sheet(cceData);
      XLSX.utils.book_append_sheet(wb, wsCCE, "CCE Results");
    }

    if (dlResults.length > 0) {
      const dlData = dlResults.map(r => ({
        'Pressure (psia)': r.pressure,
        'Oil FVF (Bo, bbl/STB)': r.Bo,
        'Total FVF (Bt, bbl/STB)': r.BtD,
        'Gas FVF (Bg, bbl/scf)': r.Bg,
        'Solution GOR (RsD, scf/STB)': r.RsD,
        'Released Gas (RsDb, scf/STB)': r.RsDb,
        'Oil Density (lb/ft3)': r.rhoO
      }));
      const wsDL = XLSX.utils.json_to_sheet(dlData);
      XLSX.utils.book_append_sheet(wb, wsDL, "DL Results");
    }

    XLSX.writeFile(wb, "PETE665_Simulation_Results.xlsx");
  };

  const SlideIcon = SLIDES[currentSlide].icon;

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-bg-deep text-text-primary font-sans">
      {/* Header */}
      <header className="h-16 shrink-0 bg-bg-surface border-b border-border-theme flex items-center px-6 justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-accent-theme/15 text-accent-theme px-2 py-1 rounded text-[11px] font-bold uppercase tracking-wider">
            Project PETE665
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Hydrocarbon Property Simulator</h1>
        </div>
        
        <div className="flex items-center gap-4">
          {view === 'presentation' && (
            <button 
              onClick={downloadPPT}
              className="flex items-center gap-2 px-3 py-1.5 bg-accent-theme/10 border border-accent-theme/20 rounded-lg text-[11px] font-bold text-accent-theme hover:bg-accent-theme/20 transition-all"
            >
              <Database className="w-3.5 h-3.5" />
              Download .PPTX
            </button>
          )}
          {view === 'simulator' && (cceResults.length > 0 || dlResults.length > 0) && (
            <button 
              onClick={downloadExcel}
              className="flex items-center gap-2 px-3 py-1.5 bg-accent-theme/10 border border-accent-theme/20 rounded-lg text-[11px] font-bold text-accent-theme hover:bg-accent-theme/20 transition-all"
            >
              <Database className="w-3.5 h-3.5" />
              Download Results (.XLSX)
            </button>
          )}
          <div className="flex bg-bg-control p-1 rounded-lg border border-border-theme">
            <button 
              onClick={() => setView('simulator')}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                view === 'simulator' ? "bg-accent-theme text-bg-deep" : "text-text-secondary hover:text-text-primary"
              )}
            >
              <LayoutDashboard className="w-4 h-4" />
              Simulator
            </button>
            <button 
              onClick={() => setView('presentation')}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                view === 'presentation' ? "bg-accent-theme text-bg-deep" : "text-text-secondary hover:text-text-primary"
              )}
            >
              <Presentation className="w-4 h-4" />
              Presentation
            </button>
          </div>
          <div className="h-6 w-px bg-border-theme" />
          <div className="text-xs text-text-secondary hidden sm:block">
            Spring 2026 • v1.0
          </div>
        </div>
      </header>

      {view === 'simulator' ? (
        <div className="flex-1 overflow-hidden grid grid-rows-[1fr_200px] grid-cols-[280px_1fr]">
          {/* Sidebar - Inputs */}
          <aside className="bg-bg-surface border-r border-border-theme p-6 flex flex-col gap-5 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-[11px] text-text-secondary uppercase tracking-widest font-bold">
                  Reservoir Temp
                </label>
                <div className="flex items-center gap-3 bg-bg-control px-3 py-2 border border-border-theme rounded">
                  <input 
                    type="number" 
                    value={tempF}
                    onChange={(e) => setTempF(parseFloat(e.target.value))}
                    className="bg-transparent border-none text-text-primary font-mono text-sm w-full outline-none"
                  />
                  <span className="text-[11px] text-text-secondary">°F</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] text-text-secondary uppercase tracking-widest font-bold">
                  Molar Composition
                </label>
                <div className="space-y-2">
                  {composition.map((comp, idx) => (
                    <div key={comp.name} className="flex flex-col gap-1">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[10px] text-text-secondary font-medium">{comp.name}</span>
                      </div>
                      <div className="flex items-center gap-2 bg-bg-control px-3 py-1.5 border border-border-theme rounded">
                        <input 
                          type="number" 
                          step="0.00001"
                          value={comp.zi}
                          onChange={(e) => {
                            const newComp = [...composition];
                            newComp[idx].zi = parseFloat(e.target.value);
                            setComposition(newComp);
                          }}
                          className="bg-transparent border-none text-text-primary font-mono text-xs w-full outline-none"
                        />
                        <span className="text-[10px] text-text-secondary">zi</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button 
              onClick={runSimulation}
              disabled={loading}
              className="mt-auto bg-accent-theme hover:brightness-110 text-bg-deep font-bold py-3 rounded text-[13px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-bg-deep/30 border-t-bg-deep rounded-full animate-spin" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
              Calculate Properties
            </button>
          </aside>

          {/* Main Content - Charts */}
          <main className="p-6 bg-bg-deep overflow-y-auto space-y-6">
            {cceResults.length > 0 ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 h-full overflow-y-auto pr-2 custom-scrollbar">
                <div className="bg-bg-surface border border-border-theme rounded-lg flex flex-col h-[300px]">
                  <div className="p-4 border-b border-border-theme flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">CCE: Relative Volume</span>
                    <span className="text-[10px] text-accent-theme font-mono">V/Vsat</span>
                  </div>
                  <div className="flex-1 p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={cceResults}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#222" />
                        <XAxis 
                          dataKey="pressure" 
                          type="number" 
                          domain={['auto', 'auto']} 
                          reversed
                          stroke="#444"
                          tick={{ fill: '#666', fontSize: 10 }}
                        />
                        <YAxis 
                          stroke="#444" 
                          tick={{ fill: '#666', fontSize: 10 }} 
                          domain={[0, 2]}
                          allowDataOverflow={true}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1F2227', border: '1px solid #2D3139', borderRadius: '4px', fontSize: '12px' }}
                          itemStyle={{ color: '#00D1FF' }}
                        />
                        <Line type="monotone" dataKey="relativeVolume" stroke="#00D1FF" strokeWidth={2} dot={{ r: 3, fill: '#00D1FF' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-bg-surface border border-border-theme rounded-lg flex flex-col h-[300px]">
                  <div className="p-4 border-b border-border-theme flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">DL: Black Oil Properties</span>
                    <span className="text-[10px] text-accent-theme font-mono">Bo & Bt</span>
                  </div>
                  <div className="flex-1 p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dlResults}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#222" />
                        <XAxis 
                          dataKey="pressure" 
                          type="number" 
                          domain={['auto', 'auto']} 
                          reversed
                          stroke="#444"
                          tick={{ fill: '#666', fontSize: 10 }}
                        />
                        <YAxis stroke="#444" tick={{ fill: '#666', fontSize: 10 }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1F2227', border: '1px solid #2D3139', borderRadius: '4px', fontSize: '12px' }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                        <Line name="Bo" type="monotone" dataKey="Bo" stroke="#00D1FF" strokeWidth={2} dot={{ r: 3 }} />
                        <Line name="Bt" type="monotone" dataKey="BtD" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-bg-surface border border-border-theme rounded-lg flex flex-col h-[300px]">
                  <div className="p-4 border-b border-border-theme flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">CCE: Oil Density</span>
                    <span className="text-[10px] text-accent-theme font-mono">lb/ft³</span>
                  </div>
                  <div className="flex-1 p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={cceResults}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#222" />
                        <XAxis 
                          dataKey="pressure" 
                          type="number" 
                          domain={['auto', 'auto']} 
                          reversed
                          stroke="#444"
                          tick={{ fill: '#666', fontSize: 10 }}
                        />
                        <YAxis stroke="#444" tick={{ fill: '#666', fontSize: 10 }} domain={['auto', 'auto']} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1F2227', border: '1px solid #2D3139', borderRadius: '4px', fontSize: '12px' }}
                          itemStyle={{ color: '#10B981' }}
                        />
                        <Line name="Oil Density" type="monotone" dataKey="rhoO" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-bg-surface border border-border-theme rounded-lg flex flex-col h-[300px]">
                  <div className="p-4 border-b border-border-theme flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">CCE: Gas Density</span>
                    <span className="text-[10px] text-accent-theme font-mono">lb/ft³</span>
                  </div>
                  <div className="flex-1 p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={cceResults.filter(r => r.rhoG > 0)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#222" />
                        <XAxis 
                          dataKey="pressure" 
                          type="number" 
                          domain={['auto', 'auto']} 
                          reversed
                          stroke="#444"
                          tick={{ fill: '#666', fontSize: 10 }}
                        />
                        <YAxis stroke="#444" tick={{ fill: '#666', fontSize: 10 }} domain={['auto', 'auto']} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1F2227', border: '1px solid #2D3139', borderRadius: '4px', fontSize: '12px' }}
                          itemStyle={{ color: '#F59E0B' }}
                        />
                        <Line name="Gas Density" type="monotone" dataKey="rhoG" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-bg-surface border border-border-theme rounded-lg flex flex-col h-[300px]">
                  <div className="p-4 border-b border-border-theme flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">DL: Gas Evolution</span>
                    <span className="text-[10px] text-accent-theme font-mono">RsD & RsDb</span>
                  </div>
                  <div className="flex-1 p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dlResults}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#222" />
                        <XAxis 
                          dataKey="pressure" 
                          type="number" 
                          domain={['auto', 'auto']} 
                          reversed
                          stroke="#444"
                          tick={{ fill: '#666', fontSize: 10 }}
                        />
                        <YAxis stroke="#444" tick={{ fill: '#666', fontSize: 10 }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1F2227', border: '1px solid #2D3139', borderRadius: '4px', fontSize: '12px' }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                        <Line name="RsD (Solution)" type="monotone" dataKey="RsD" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                        <Line name="RsDb (Released)" type="monotone" dataKey="RsDb" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-bg-surface border border-border-theme rounded-lg flex flex-col h-[300px]">
                  <div className="p-4 border-b border-border-theme flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">DL: Gas FVF</span>
                    <span className="text-[10px] text-accent-theme font-mono">Bg (bbl/scf)</span>
                  </div>
                  <div className="flex-1 p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dlResults}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#222" />
                        <XAxis 
                          dataKey="pressure" 
                          type="number" 
                          domain={['auto', 'auto']} 
                          reversed
                          stroke="#444"
                          tick={{ fill: '#666', fontSize: 10 }}
                        />
                        <YAxis stroke="#444" tick={{ fill: '#666', fontSize: 10 }} domain={['auto', 'auto']} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1F2227', border: '1px solid #2D3139', borderRadius: '4px', fontSize: '12px' }}
                          itemStyle={{ color: '#8B5CF6' }}
                        />
                        <Line name="Bg" type="monotone" dataKey="Bg" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full border border-dashed border-border-theme rounded-xl flex flex-col items-center justify-center text-center p-12">
                <Database className="w-12 h-12 text-bg-control mb-4" />
                <h3 className="text-lg font-medium text-text-secondary">No Simulation Data</h3>
                <p className="text-sm text-text-secondary/50 max-w-xs mt-2">
                  Configure parameters and click calculate to generate phase behavior models.
                </p>
              </div>
            )}
          </main>

          {/* Results Panel */}
          <div className="col-span-full bg-bg-surface border-t border-border-theme p-6 grid grid-cols-4 gap-8">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-text-secondary uppercase font-bold tracking-widest">Saturation Pressure</span>
              <span className="text-3xl font-mono text-accent-theme">{psat ? psat.toFixed(2) : '--'}</span>
              <span className="text-[11px] text-text-secondary">psia at {tempF}°F</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-text-secondary uppercase font-bold tracking-widest">Sat. Rel. Volume</span>
              <span className="text-3xl font-mono text-accent-theme">
                {psat ? "1.000" : '--'}
              </span>
              <span className="text-[11px] text-text-secondary">V/Vsat ratio</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-text-secondary uppercase font-bold tracking-widest">Final Bo</span>
              <span className="text-3xl font-mono text-accent-theme">
                {dlResults.length > 0 ? dlResults[dlResults.length - 1].Bo?.toFixed(3) : '--'}
              </span>
              <span className="text-[11px] text-text-secondary">bbl/STB at 100 psia</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-text-secondary uppercase font-bold tracking-widest">Solution GOR</span>
              <span className="text-3xl font-mono text-accent-theme">
                {dlResults.length > 0 ? dlResults[0].RsD?.toFixed(1) : '--'}
              </span>
              <span className="text-[11px] text-text-secondary">scf/STB (Initial)</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 bg-bg-deep flex flex-col items-center justify-center p-12 relative">
          <AnimatePresence mode="wait">
            <motion.div 
              key={currentSlide}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl w-full bg-bg-surface border border-border-theme rounded-3xl p-16 shadow-2xl"
            >
              <div className="flex flex-col items-center text-center gap-8">
                <div className="p-6 bg-bg-control rounded-full border border-border-theme shadow-inner">
                  <SlideIcon className="w-12 h-12 text-accent-theme" />
                </div>
                <div>
                  <h2 className="text-4xl font-bold tracking-tight mb-4">{SLIDES[currentSlide].title}</h2>
                  {SLIDES[currentSlide].subtitle && (
                    <p className="text-xl text-accent-theme font-medium">{SLIDES[currentSlide].subtitle}</p>
                  )}
                </div>
                <div className="w-full max-w-2xl space-y-4 text-left">
                  {SLIDES[currentSlide].content.map((item, i) => (
                    <div key={i} className="flex items-start gap-4 p-4 bg-bg-control/50 rounded-xl border border-border-theme/50">
                      <ChevronRight className="w-5 h-5 text-accent-theme shrink-0 mt-0.5" />
                      <p className="text-lg text-text-primary/90 leading-relaxed">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Slide Controls */}
          <div className="absolute bottom-12 flex items-center gap-8">
            <button 
              onClick={prevSlide}
              disabled={currentSlide === 0}
              className="p-4 rounded-full bg-bg-surface border border-border-theme hover:bg-bg-control transition-all disabled:opacity-20"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="flex gap-2">
              {SLIDES.map((_, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    i === currentSlide ? "bg-accent-theme w-8" : "bg-border-theme"
                  )} 
                />
              ))}
            </div>
            <button 
              onClick={nextSlide}
              disabled={currentSlide === SLIDES.length - 1}
              className="p-4 rounded-full bg-bg-surface border border-border-theme hover:bg-bg-control transition-all disabled:opacity-20"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          <div className="absolute bottom-12 right-12 flex items-center gap-4">
            <div className="text-xs text-text-secondary font-mono">
              SLIDE {currentSlide + 1} / {SLIDES.length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

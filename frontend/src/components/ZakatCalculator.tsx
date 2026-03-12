import { useState } from 'react';
import { Calculator, ArrowRight, DollarSign, HandCoins } from 'lucide-react';

export default function ZakatCalculator() {
  const [cash, setCash] = useState<number>(0);
  const [gold, setGold] = useState<number>(0);
  const [silver] = useState<number>(0);
  const [investments, setInvestments] = useState<number>(0);
  const [debts, setDebts] = useState<number>(0);

  // Approximation in USD for 2026
  const NISAB_SILVER_VALUE = 450; // ~ 595g of silver

  const totalAssets = cash + gold + silver + investments;
  const netAssets = Math.max(0, totalAssets - debts);
  
  // Zakat is eligible if net assets exceed Nisab threshold (usually Silver is used to be safe/generous)
  const isEligible = netAssets >= NISAB_SILVER_VALUE;
  const zakatPayable = isEligible ? netAssets * 0.025 : 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-6 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white flex items-center gap-4">
        <div className="p-3 bg-white/20 rounded-xl">
          <Calculator className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Zakat Calculator</h2>
          <p className="text-emerald-100 text-sm">Calculate your 2.5% obligation accurately</p>
        </div>
      </div>

      <div className="p-6 md:p-8 grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <p className="text-sm text-slate-500 font-medium uppercase tracking-wider">Your Assets</p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cash (Home & Bank)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <DollarSign className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="number"
                  min="0"
                  value={cash || ''}
                  onChange={(e) => setCash(Number(e.target.value))}
                  className="pl-9 w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Gold & Silver Value</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <DollarSign className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="number"
                  min="0"
                  value={gold || ''}
                  onChange={(e) => setGold(Number(e.target.value))}
                  className="pl-9 w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Investments & Shares</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <DollarSign className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="number"
                  min="0"
                  value={investments || ''}
                  onChange={(e) => setInvestments(Number(e.target.value))}
                  className="pl-9 w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
               <label className="block text-sm font-medium text-red-600 mb-1">Deductible Debts & Liabilities</label>
               <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <DollarSign className="h-4 w-4 text-red-400" />
                </div>
                <input
                  type="number"
                  min="0"
                  value={debts || ''}
                  onChange={(e) => setDebts(Number(e.target.value))}
                  className="pl-9 w-full rounded-lg border-red-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-emerald-50/50 rounded-2xl border border-emerald-100 p-6 flex flex-col justify-center">
          <div className="space-y-6">
            <div className="flex justify-between items-center text-sm border-b border-emerald-100 pb-3">
              <span className="text-slate-600">Total Net Assets</span>
              <span className="font-semibold text-slate-900">${netAssets.toLocaleString()}</span>
            </div>
            
            <div className="flex justify-between items-center text-sm border-b border-emerald-100 pb-3">
              <span className="text-slate-600 flex items-center gap-2">
                Nisab Threshold
                <div className="group relative">
                  <HandCoins className="h-4 w-4 text-emerald-600 cursor-help" />
                  <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 text-white text-xs rounded-lg text-center z-10">
                    Using Silver Nisab (~595g) to maximize giving.
                  </div>
                </div>
              </span>
              <span className="font-semibold text-slate-900">${NISAB_SILVER_VALUE.toLocaleString()}</span>
            </div>

            <div className="pt-2 text-center space-y-2">
              <p className="text-sm font-medium text-emerald-800 uppercase tracking-widest">Your Zakat Due</p>
              <div className="text-5xl font-extrabold text-emerald-600">
                ${zakatPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {!isEligible && netAssets > 0 && (
              <div className="p-3 bg-emerald-100/50 text-emerald-800 text-sm rounded-xl text-center font-medium">
                Your net assets are below the Nisab threshold. Zakat is not obligatory.
              </div>
            )}

            <button 
              disabled={zakatPayable === 0}
              onClick={() => window.location.href='/donate?fund=zakat&amount=' + zakatPayable}
              className={`w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-semibold transition-all ${
                zakatPayable > 0 
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200 hover:-translate-y-0.5' 
                : 'bg-emerald-100 text-emerald-400 cursor-not-allowed'
              }`}
            >
              Pay My Zakat Now
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

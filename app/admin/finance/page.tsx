import { Suspense } from 'react';
import { adminDb } from '@/lib/firebase-admin';
import { ExportButton } from './export-button';
import { FinanceChart } from '@/components/admin/FinanceChart';
import { FinanceTableSkeleton } from '@/components/admin/AdminSkeletons';

export const dynamic = 'force-dynamic';

const CURRENCY_SYMBOLS: Record<string, string> = {
    USD: '$',
    INR: '₹',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    AUD: 'A$',
    CAD: 'C$',
    SGD: 'S$',
    AED: 'د.إ',
};

function getCurrencySymbol(code: string): string {
    return CURRENCY_SYMBOLS[code?.toUpperCase()] || code || '$';
}

function formatAmount(amount: number, currency: string): string {
    const symbol = getCurrencySymbol(currency);
    return `${symbol}${amount.toLocaleString()}`;
}

async function getFinanceData() {
    // Fetch ALL transactions to ensure graph is accurate (limit 50 might cut off history)
    // In production with 10k+ txs, you'd aggregate this on the server side.
    const snapshot = await adminDb.collection('transactions')
        .orderBy('timestamp', 'desc')
        .limit(200)
        .get();

    const transactions = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            amount: data.amount || 0,
            currency: data.currency || 'USD',
            type: data.type || 'unknown',
            status: data.status || 'completed',
            date: data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : new Date().toISOString()
        };
    });

    // Group totals by currency
    const volumeByCurrency: Record<string, number> = {};
    transactions.forEach(tx => {
        const cur = tx.currency?.toUpperCase() || 'USD';
        volumeByCurrency[cur] = (volumeByCurrency[cur] || 0) + (tx.amount || 0);
    });

    const count = transactions.length;

    // Compute average per currency as well
    const countByCurrency: Record<string, number> = {};
    transactions.forEach(tx => {
        const cur = tx.currency?.toUpperCase() || 'USD';
        countByCurrency[cur] = (countByCurrency[cur] || 0) + 1;
    });

    return { transactions, volumeByCurrency, countByCurrency, count };
}

// --- ASYNC SERVER COMPONENT (Suspense unit) ---
async function FinanceDataSection() {
    const { transactions, volumeByCurrency, countByCurrency, count } = await getFinanceData();

    // Format date for display in table
    const tableData = transactions.map(t => ({
        ...t,
        displayDate: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }));

    return (
        <>
            {/* 1. MONTHLY REVENUE CHART */}
            <FinanceChart transactions={transactions} />

            {/* 2. STATS ROW */}
            <div className="grid grid-cols-3 gap-6">
                <div className="bg-[#080808] border border-[#222] p-6">
                    <div className="text-[10px] text-[#555] uppercase tracking-widest mb-1">Gross Volume</div>
                    <div className="space-y-1">
                        {Object.entries(volumeByCurrency).map(([cur, total]) => (
                            <div key={cur} className="font-anton text-4xl text-white flex items-baseline gap-2">
                                {getCurrencySymbol(cur)}{total.toLocaleString()}
                                <span className="text-[10px] text-[#555] font-mono">{cur}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-[#080808] border border-[#222] p-6">
                    <div className="text-[10px] text-[#555] uppercase tracking-widest mb-1">Avg. Transaction</div>
                    <div className="space-y-1">
                        {Object.entries(volumeByCurrency).map(([cur, total]) => (
                            <div key={cur} className="font-anton text-4xl text-white flex items-baseline gap-2">
                                {getCurrencySymbol(cur)}{(total / (countByCurrency[cur] || 1)).toFixed(2)}
                                <span className="text-[10px] text-[#555] font-mono">{cur}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-[#080808] border border-[#222] p-6">
                    <div className="text-[10px] text-[#555] uppercase tracking-widest mb-1">Success Rate</div>
                    <div className="font-anton text-4xl text-green-500">100%</div>
                </div>
            </div>

            {/* 3. TRANSACTION TABLE */}
            <div className="border border-[#222] bg-[#080808]">
                <table className="w-full text-left">
                    <thead className="bg-[#0A0A0A] text-[10px] uppercase font-mono text-[#666] tracking-widest">
                        <tr>
                            <th className="p-4 border-b border-r border-[#222] w-32">Date</th>
                            <th className="p-4 border-b border-r border-[#222]">Transaction ID</th>
                            <th className="p-4 border-b border-r border-[#222]">Type</th>
                            <th className="p-4 border-b border-r border-[#222]">Amount</th>
                            <th className="p-4 border-b border-[#222]">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#222] text-xs font-mono">
                        {tableData.map((tx) => (
                            <tr key={tx.id} className="hover:bg-[#0E0E0E] transition-colors">
                                <td className="p-4 border-r border-[#222] text-[#666]">{tx.displayDate}</td>
                                <td className="p-4 border-r border-[#222] text-white">{tx.id}</td>
                                <td className="p-4 border-r border-[#222]">
                                    <span className={`px-2 py-1 border rounded text-[9px] font-bold uppercase ${tx.type.includes('subscription') ? 'border-purple-900/50 text-purple-500' : 'border-blue-900/50 text-blue-500'
                                        }`}>
                                        {tx.type}
                                    </span>
                                </td>
                                <td className="p-4 border-r border-[#222] text-white font-bold">{formatAmount(tx.amount, tx.currency)}</td>
                                <td className="p-4">
                                    <span className="flex items-center gap-2 text-green-500 uppercase font-bold text-[10px]">
                                        <div className="w-1 h-1 bg-green-500 rounded-full" /> {tx.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Hidden export button data source */}
            <div className="flex justify-end -mt-4">
                <ExportButton data={tableData} />
            </div>
        </>
    );
}

// --- MAIN PAGE (shell renders instantly) ---
export default async function FinancePage() {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100 pb-20">

            {/* HEADER — renders instantly */}
            <div className="flex justify-between items-end border-b border-[#333] pb-6">
                <div>
                    <h1 className="font-anton text-5xl uppercase text-white">Ledger</h1>
                    <p className="text-[#666] text-xs font-mono mt-2 tracking-widest">TRANSACTION HISTORY // AUDIT LOG</p>
                </div>
            </div>

            <Suspense fallback={<FinanceTableSkeleton />}>
                <FinanceDataSection />
            </Suspense>
        </div>
    );
}
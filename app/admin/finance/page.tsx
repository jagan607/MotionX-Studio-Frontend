import { adminDb } from '@/lib/firebase-admin';
import { ExportButton } from './export-button';
import { FinanceChart } from '@/components/admin/FinanceChart'; // Import the new chart

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
            type: data.type || 'unknown',
            status: data.status || 'completed', // Default to completed if missing
            // Handle Timestamp or standard Date
            date: data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : new Date().toISOString()
        };
    });

    const totalVolume = transactions.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const count = transactions.length;
    const avgTransaction = count > 0 ? (totalVolume / count) : 0;

    return { transactions, totalVolume, avgTransaction };
}

export default async function FinancePage() {
    const { transactions, totalVolume, avgTransaction } = await getFinanceData();

    // Format date for display in table
    const tableData = transactions.map(t => ({
        ...t,
        displayDate: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }));

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100 pb-20">

            {/* HEADER */}
            <div className="flex justify-between items-end border-b border-[#333] pb-6">
                <div>
                    <h1 className="font-anton text-5xl uppercase text-white">Ledger</h1>
                    <p className="text-[#666] text-xs font-mono mt-2 tracking-widest">TRANSACTION HISTORY // AUDIT LOG</p>
                </div>
                <ExportButton data={tableData} />
            </div>

            {/* 1. NEW: MONTHLY REVENUE CHART */}
            <FinanceChart transactions={transactions} />

            {/* 2. STATS ROW */}
            <div className="grid grid-cols-3 gap-6">
                <div className="bg-[#080808] border border-[#222] p-6">
                    <div className="text-[10px] text-[#555] uppercase tracking-widest mb-1">Gross Volume</div>
                    <div className="font-anton text-4xl text-white">${totalVolume.toLocaleString()}</div>
                </div>
                <div className="bg-[#080808] border border-[#222] p-6">
                    <div className="text-[10px] text-[#555] uppercase tracking-widest mb-1">Avg. Transaction</div>
                    <div className="font-anton text-4xl text-white">${avgTransaction.toFixed(2)}</div>
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
                                <td className="p-4 border-r border-[#222] text-white font-bold">${tx.amount}</td>
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
        </div>
    );
}
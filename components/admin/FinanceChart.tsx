"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useMemo } from 'react';

const CURRENCY_SYMBOLS: Record<string, string> = {
    USD: '$', INR: '₹', EUR: '€', GBP: '£', JPY: '¥', AUD: 'A$', CAD: 'C$', SGD: 'S$', AED: 'د.إ',
};

function getCurrencySymbol(code: string): string {
    return CURRENCY_SYMBOLS[code?.toUpperCase()] || code || '$';
}

export const FinanceChart = ({ transactions }: { transactions: any[] }) => {
    // Process Data: Group by Month
    const data = useMemo(() => {
        const grouped = new Map();

        const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        sorted.forEach(tx => {
            if (tx.status !== 'completed') return;

            const date = new Date(tx.date);
            const key = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            const currency = tx.currency?.toUpperCase() || 'USD';

            const current = grouped.get(key) || { totals: {} as Record<string, number> };
            current.totals[currency] = (current.totals[currency] || 0) + tx.amount;
            grouped.set(key, current);
        });

        return Array.from(grouped.entries()).map(([name, { totals }]) => ({
            name,
            ...totals,
            // Keep a combined total for bar height
            total: Object.values(totals as Record<string, number>).reduce((a: number, b: number) => a + b, 0),
        }));
    }, [transactions]);

    return (
        <div className="h-[300px] w-full bg-[#080808] border border-[#222] p-6 relative">
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h3 className="font-anton text-xl text-white uppercase tracking-wide">Revenue Trend</h3>
                    <p className="text-[10px] font-mono text-[#666]">MONTHLY AGGREGATION</p>
                </div>
            </div>

            <ResponsiveContainer width="100%" height="80%">
                <BarChart data={data}>
                    <XAxis
                        dataKey="name"
                        stroke="#444"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontFamily: 'monospace' }}
                        dy={10}
                    />
                    <YAxis
                        stroke="#444"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontFamily: 'monospace' }}
                        tickFormatter={(value) => {
                            // Detect dominant currency from data
                            const currencies = new Set<string>();
                            transactions.forEach(tx => currencies.add(tx.currency?.toUpperCase() || 'USD'));
                            const symbol = currencies.size === 1 ? getCurrencySymbol([...currencies][0]) : '';
                            return `${symbol}${value}`;
                        }}
                    />
                    <Tooltip
                        cursor={{ fill: '#111' }}
                        contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }}
                        itemStyle={{ color: '#fff', fontFamily: 'monospace', fontSize: '12px' }}
                        labelStyle={{ color: '#666', fontFamily: 'monospace', fontSize: '10px', marginBottom: '5px' }}
                        // ⬇️ FIX: Change type from 'number' to 'any' or 'number | string'
                        formatter={(value: any, _name: string, props: any) => {
                            // Try to show per-currency breakdown in tooltip
                            const entry = props?.payload;
                            if (entry) {
                                const parts: string[] = [];
                                Object.keys(entry).forEach(key => {
                                    if (key !== 'name' && key !== 'total' && CURRENCY_SYMBOLS[key]) {
                                        parts.push(`${getCurrencySymbol(key)}${entry[key].toLocaleString()} ${key}`);
                                    }
                                });
                                if (parts.length > 0) return [parts.join(' + '), 'Revenue'];
                            }
                            return [`${value}`, 'Revenue'];
                        }}
                    />
                    <Bar dataKey="total" barSize={40}>
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === data.length - 1 ? '#E50914' : '#333'} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};
"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useMemo } from 'react';

export const FinanceChart = ({ transactions }: { transactions: any[] }) => {
    // Process Data: Group by Month
    const data = useMemo(() => {
        const grouped = new Map();

        // Sort by date first (oldest to newest)
        const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        sorted.forEach(tx => {
            if (tx.status !== 'completed') return; // Only count real money

            const date = new Date(tx.date);
            const key = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }); // e.g. "Jan 26"

            const current = grouped.get(key) || 0;
            grouped.set(key, current + tx.amount);
        });

        return Array.from(grouped.entries()).map(([name, total]) => ({
            name,
            total
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
                        tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip
                        cursor={{ fill: '#111' }}
                        contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }}
                        itemStyle={{ color: '#fff', fontFamily: 'monospace', fontSize: '12px' }}
                        labelStyle={{ color: '#666', fontFamily: 'monospace', fontSize: '10px', marginBottom: '5px' }}
                        // ⬇️ FIX: Change type from 'number' to 'any' or 'number | string'
                        formatter={(value: any) => [`$${value}`, 'Revenue']}
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
"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export const OverviewChart = ({ data }: { data: any[] }) => {
    return (
        <div className="h-[300px] w-full bg-[#080808] border border-[#222] p-4 relative group">
            {/* Decorative Corner Markers */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-red-600" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-red-600" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-red-600" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-red-600" />

            <h3 className="font-mono text-[10px] uppercase text-[#666] mb-4 tracking-widest flex justify-between">
                <span>User Acquisition</span>
                <span className="text-red-500">LIVE DATA</span>
            </h3>

            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="colorRed" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#FF0000" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#FF0000" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                    <XAxis
                        dataKey="date"
                        stroke="#444"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontFamily: 'monospace' }}
                    />
                    <YAxis
                        stroke="#444"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontFamily: 'monospace' }}
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#000', border: '1px solid #FF0000', borderRadius: '0px' }}
                        itemStyle={{ color: '#FFF', fontFamily: 'monospace', fontSize: '12px' }}
                        labelStyle={{ color: '#666', fontFamily: 'monospace', fontSize: '10px', marginBottom: '5px' }}
                        cursor={{ stroke: '#FF0000', strokeWidth: 1 }}
                    />
                    <Area
                        type="monotone"
                        dataKey="users"
                        stroke="#FF0000"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorRed)"
                        animationDuration={1500}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};
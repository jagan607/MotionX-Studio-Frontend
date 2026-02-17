"use client";

import { Download } from 'lucide-react';

export function ExportButton({ data }: { data: any[] }) {
    const handleExport = () => {
        // 1. Define Headers
        const headers = ["Date", "Transaction ID", "Type", "Amount", "Status"];

        // 2. Format Rows
        const rows = data.map(tx => [
            tx.date,
            tx.id,
            tx.type,
            tx.amount,
            tx.status
        ]);

        // 3. Construct CSV Content
        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.join(","))
        ].join("\n");

        // 4. Trigger Download
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `ledger_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-[#111] border border-[#333] hover:border-white px-4 py-2 text-[10px] font-bold uppercase text-white transition-all"
        >
            <Download size={14} /> Export CSV
        </button>
    );
}
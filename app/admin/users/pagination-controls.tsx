"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function PaginationControls({ hasNextPage }: { hasNextPage: boolean }) {
    const searchParams = useSearchParams();
    const { replace } = useRouter();

    const page = Number(searchParams.get('page')) || 1;

    const changePage = (newPage: number) => {
        const params = new URLSearchParams(searchParams);
        params.set('page', newPage.toString());
        replace(`/admin/users?${params.toString()}`);
    };

    return (
        <div className="flex justify-end items-center gap-4 border-t border-[#222] p-4 bg-[#0A0A0A]">
            <span className="text-[10px] font-mono text-[#444]">PAGE {page}</span>
            <div className="flex gap-2">
                <button
                    disabled={page <= 1}
                    onClick={() => changePage(page - 1)}
                    className="p-2 border border-[#333] text-white hover:bg-[#222] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                >
                    <ChevronLeft size={14} />
                </button>
                <button
                    disabled={!hasNextPage}
                    onClick={() => changePage(page + 1)}
                    className="p-2 border border-[#333] text-white hover:bg-[#222] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                >
                    <ChevronRight size={14} />
                </button>
            </div>
        </div>
    );
}
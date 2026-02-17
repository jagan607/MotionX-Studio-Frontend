"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDebouncedCallback } from "use-debounce";

export function UserSearch() {
    const searchParams = useSearchParams();
    const { replace } = useRouter();

    const handleSearch = useDebouncedCallback((term: string) => {
        const params = new URLSearchParams(searchParams);
        params.set('page', '1'); // Reset to page 1 on new search

        if (term) {
            params.set('query', term);
        } else {
            params.delete('query');
        }

        replace(`/admin/users?${params.toString()}`);
    }, 300); // Wait 300ms after typing stops

    return (
        <div className="bg-[#111] border border-[#333] flex items-center px-4 py-2 w-64 group focus-within:border-red-600 transition-colors">
            <Search size={14} className="text-[#666] mr-2" />
            <input
                type="text"
                placeholder="SEARCH EMAIL OR ID"
                className="bg-transparent border-none outline-none text-xs font-mono text-white w-full placeholder-[#444]"
                onChange={(e) => handleSearch(e.target.value)}
                defaultValue={searchParams.get('query')?.toString()}
            />
        </div>
    );
}
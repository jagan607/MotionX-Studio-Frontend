import { adminDb } from '@/lib/firebase-admin';
import { Shield, Zap, MoreVertical, Plus, HardDrive, RefreshCw } from 'lucide-react';
import { updateUserCredits, calculateUserStorage } from '../actions';
import { UserSearch } from './user-search'; // Import Client Component
import { PaginationControls } from './pagination-controls'; // Import Client Component

// --- HELPER FUNCTIONS ---
function formatBytes(bytes: number, decimals = 2) {
    if (!bytes) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// --- DATA FETCHING ---
async function getUsers(query: string, page: number) {
    const PAGE_SIZE = 10;
    let usersRef = adminDb.collection('users');
    let snapshot;

    // 1. SEARCH LOGIC
    // Firestore lacks full-text search. We'll support Exact ID OR Email Prefix.
    if (query) {
        // Try finding by Exact ID first
        const docById = await usersRef.doc(query).get();
        if (docById.exists) {
            snapshot = { docs: [docById], empty: false };
        } else {
            // Fallback: Search by Email Prefix
            // This mimics "starts with" logic in Firestore
            snapshot = await usersRef
                .where('email', '>=', query)
                .where('email', '<=', query + '\uf8ff')
                .limit(PAGE_SIZE)
                .get();
        }
    } else {
        // 2. PAGINATION LOGIC (Standard Offset)
        // Note: 'offset' gets expensive with thousands of docs, but perfectly fine for <5000 users.
        const offset = (page - 1) * PAGE_SIZE;
        snapshot = await usersRef
            .orderBy('createdAt', 'desc')
            .limit(PAGE_SIZE)
            .offset(offset)
            .get();
    }

    // Check if we might have a next page
    // (Simplified check: if we got full page size, assume there's more)
    const hasNextPage = snapshot.docs.length === PAGE_SIZE;

    const users = snapshot.docs.map(doc => {
        // ⬇️ FIX: Add "|| {}" to handle cases where data might be undefined
        const data = doc.data() || {};

        return {
            id: doc.id,
            email: data.email,
            name: data.displayName || 'Anonymous',
            credits: data.credits || 0,
            role: data.role || 'user',
            storage: data.storageUsage || 0,
            lastScan: data.storageLastUpdated ? 'Checked' : 'Never'
        };
    });

    return { users, hasNextPage };
}

// --- MAIN COMPONENT ---
export default async function UsersPage(props: { searchParams?: Promise<{ query?: string; page?: string }> }) {
    const searchParams = await props.searchParams;
    const query = searchParams?.query || '';
    const currentPage = Number(searchParams?.page) || 1;

    const { users, hasNextPage } = await getUsers(query, currentPage);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-end border-b border-[#333] pb-6">
                <h1 className="font-anton text-5xl uppercase text-white">Operatives</h1>
                {/* NEW: CLIENT SEARCH COMPONENT */}
                <UserSearch />
            </div>

            <div className="border border-[#222] bg-[#080808]">
                <table className="w-full text-left">
                    <thead className="bg-[#0A0A0A] text-[10px] uppercase font-mono text-[#666] tracking-widest">
                        <tr>
                            <th className="p-4 border-b border-r border-[#222] w-16">Status</th>
                            <th className="p-4 border-b border-r border-[#222]">Identity</th>
                            <th className="p-4 border-b border-r border-[#222]">Storage</th>
                            <th className="p-4 border-b border-r border-[#222]">Balance</th>
                            <th className="p-4 border-b border-r border-[#222]">Role</th>
                            <th className="p-4 border-b border-[#222] text-right">Controls</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#222]">
                        {users.length > 0 ? (
                            users.map((user) => (
                                <tr key={user.id} className="hover:bg-[#0E0E0E] group transition-colors">
                                    <td className="p-4 border-r border-[#222] text-center">
                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full mx-auto shadow-[0_0_8px_#22c55e]" />
                                    </td>
                                    <td className="p-4 border-r border-[#222]">
                                        <div className="text-white font-bold text-sm">{user.name}</div>
                                        <div className="text-[#444] text-[10px] font-mono">{user.email}</div>
                                    </td>

                                    {/* STORAGE COLUMN */}
                                    <td className="p-4 border-r border-[#222]">
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <HardDrive size={12} className="text-[#666]" />
                                                    <span className="font-mono text-sm text-white">{formatBytes(user.storage)}</span>
                                                </div>
                                                <span className="text-[8px] text-[#444] uppercase tracking-wider">{user.lastScan}</span>
                                            </div>
                                            <form action={async (fd) => { "use server"; await calculateUserStorage(fd) }}>
                                                <input type="hidden" name="userId" value={user.id} />
                                                <button type="submit" className="p-1.5 hover:bg-[#222] text-[#444] hover:text-white rounded transition-colors">
                                                    <RefreshCw size={12} />
                                                </button>
                                            </form>
                                        </div>
                                    </td>

                                    {/* CREDITS COLUMN */}
                                    <td className="p-4 border-r border-[#222]">
                                        <div className="flex items-center gap-2">
                                            <Zap size={12} className="text-yellow-500" />
                                            <span className="font-mono text-lg text-white">{user.credits}</span>
                                        </div>
                                    </td>

                                    {/* ROLE COLUMN */}
                                    <td className="p-4 border-r border-[#222]">
                                        <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-[#111] border border-[#333] rounded text-[9px] font-bold text-[#888] uppercase">
                                            <Shield size={10} /> {user.role}
                                        </span>
                                    </td>

                                    {/* CONTROLS COLUMN */}
                                    <td className="p-4 text-right">
                                        <form action={async (fd) => { "use server"; await updateUserCredits(fd) }} className="flex items-center justify-end gap-2">
                                            <input type="hidden" name="userId" value={user.id} />
                                            <div className="flex items-center border border-[#333] bg-[#0A0A0A] focus-within:border-white transition-colors h-8">
                                                <input type="number" name="amount" placeholder="Qty" className="w-16 bg-transparent text-white text-xs font-mono px-2 outline-none text-right placeholder-[#444]" required />
                                                <button type="submit" className="h-full px-3 bg-[#111] hover:bg-green-900 hover:text-green-400 border-l border-[#333] transition-colors flex items-center justify-center text-[#666]">
                                                    <Plus size={12} strokeWidth={3} />
                                                </button>
                                            </div>
                                        </form>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-[#444] font-mono text-xs">
                                    NO OPERATIVES FOUND MATCHING PROTOCOL "{query}"
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {/* NEW: PAGINATION CONTROLS */}
                {!query && <PaginationControls hasNextPage={hasNextPage} />}
            </div>
        </div>
    );
}
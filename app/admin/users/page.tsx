import { adminDb } from '@/lib/firebase-admin';
import { Shield, Zap, MoreVertical, Plus, HardDrive, RefreshCw } from 'lucide-react';
import { updateUserCredits, calculateUserStorage } from '../actions';
import { UserSearch } from './user-search'; // Import Client Component

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
async function getUsers(query: string) {
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
            snapshot = await usersRef
                .where('email', '>=', query)
                .where('email', '<=', query + '\uf8ff')
                .get();
        }
    } else {
        // Fetch ALL users (no orderBy to avoid excluding docs missing createdAt)
        snapshot = await usersRef.get();
    }

    const users = await Promise.all(snapshot.docs.map(async doc => {
        const data = doc.data() || {};

        // Fetch transactions subcollection
        const txSnap = await adminDb.collection('users').doc(doc.id).collection('transactions').get();
        const transactionsCount = txSnap.size;
        const creditsSpent = txSnap.docs.reduce((sum, txDoc) => {
            const txData = txDoc.data();
            if (txData.amount < 0) {
                return sum + Math.abs(txData.amount);
            }
            return sum;
        }, 0);

        const formatDate = (date: Date) => {
            return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
        };

        const displayName = data.displayName || (data.email ? data.email.split('@')[0] : 'Unknown User');

        return {
            id: doc.id,
            email: data.email,
            name: displayName,
            credits: data.credits || 0,
            role: data.role || 'user',
            storage: data.storageUsage || 0,
            lastScan: data.storageLastUpdated ? 'Checked' : 'Never',
            transactionsCount,
            creditsSpent,
            createdAtRaw: data.createdAt?.toDate() || null,
            lastActiveRaw: data.lastActiveAt?.toDate() || null,
            createdAtFormatted: data.createdAt ? formatDate(data.createdAt.toDate()) : "N/A",
            lastActiveFormatted: data.lastActiveAt ? formatDate(data.lastActiveAt.toDate()) : "N/A",
        };
    }));

    // Sort users descending by createdAt (fallback to lastActiveAt)
    users.sort((a, b) => {
        const dateA = a.createdAtRaw || a.lastActiveRaw || new Date(0);
        const dateB = b.createdAtRaw || b.lastActiveRaw || new Date(0);
        return dateB.getTime() - dateA.getTime();
    });

    return users;
}

// --- MAIN COMPONENT ---
export default async function UsersPage(props: { searchParams?: Promise<{ query?: string }> }) {
    const searchParams = await props.searchParams;
    const query = searchParams?.query || '';

    const users = await getUsers(query);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-end border-b border-[#333] pb-6">
                <h1 className="font-anton text-5xl uppercase text-white">Operatives</h1>
                {/* NEW: CLIENT SEARCH COMPONENT */}
                <UserSearch />
            </div>

            <div className="border border-[#222] bg-[#080808] max-h-[80vh] overflow-y-auto">
                <table className="w-full text-left">
                    <thead className="bg-[#0A0A0A] text-[10px] uppercase font-mono text-[#666] tracking-widest sticky top-0 z-10">
                        <tr>
                            <th className="p-4 border-b border-r border-[#222] w-16 bg-[#0A0A0A]">Status</th>
                            <th className="p-4 border-b border-r border-[#222] bg-[#0A0A0A]">Identity</th>
                            <th className="p-4 border-b border-r border-[#222] bg-[#0A0A0A]">Storage</th>
                            <th className="p-4 border-b border-r border-[#222] bg-[#0A0A0A]">Timeline</th>
                            <th className="p-4 border-b border-r border-[#222] bg-[#0A0A0A]">Activity</th>
                            <th className="p-4 border-b border-r border-[#222] bg-[#0A0A0A]">Balance</th>
                            <th className="p-4 border-b border-r border-[#222] bg-[#0A0A0A]">Role</th>
                            <th className="p-4 border-b border-[#222] text-right bg-[#0A0A0A]">Controls</th>
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

                                    {/* TIMELINE COLUMN */}
                                    <td className="p-4 border-r border-[#222]">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex justify-between text-xs">
                                                <span className="text-[#666]">Joined:</span>
                                                <span className="text-white font-mono">{user.createdAtFormatted}</span>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span className="text-[#666]">Active:</span>
                                                <span className="text-[#00FF41] font-mono">{user.lastActiveFormatted}</span>
                                            </div>
                                        </div>
                                    </td>

                                    {/* ACTIVITY COLUMN (TRANSACTIONS / SPENT) */}
                                    <td className="p-4 border-r border-[#222]">
                                        <div className="flex flex-col gap-1 text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-[#666]">Transactions:</span>
                                                <span className="text-white font-mono" title="Total number of generations, upscales, and credit updates">{user.transactionsCount}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-[#666]">Spent:</span>
                                                <span className="text-[#E50914] font-mono">{user.creditsSpent}</span>
                                            </div>
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
                                <td colSpan={8} className="p-8 text-center text-[#444] font-mono text-xs">
                                    NO OPERATIVES FOUND MATCHING PROTOCOL "{query}"
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
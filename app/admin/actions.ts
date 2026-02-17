'use server'

import { adminDb, adminStorage } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin'; // <--- ADD THIS LINE
import { revalidatePath } from 'next/cache';

export async function updateUserCredits(formData: FormData) {
    const userId = formData.get('userId') as string;
    const amount = parseInt(formData.get('amount') as string);

    if (!userId || isNaN(amount)) return;

    try {
        const userRef = adminDb.collection('users').doc(userId);

        // Atomic increment (Safe way to add credits without race conditions)
        await userRef.update({
            credits: admin.firestore.FieldValue.increment(amount)
        });

        // Log the action
        await adminDb.collection('system_logs').add({
            action: 'ADMIN_CREDIT_ADJUST',
            adminId: 'SYSTEM',
            targetUserId: userId,
            amount: amount,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        revalidatePath('/admin/users');
        return { success: true };
    } catch (error) {
        console.error("Update failed", error);
        return { success: false };
    }
}

export async function calculateUserStorage(formData: FormData) {
    const userId = formData.get('userId') as string;
    if (!userId) return;

    try {
        // 1. Find all projects owned by this user
        const projectsSnap = await adminDb.collection('projects')
            .where('owner_id', '==', userId)
            .get();

        const projectIds = projectsSnap.docs.map(doc => doc.id);

        if (projectIds.length === 0) {
            // No projects = 0 storage
            await adminDb.collection('users').doc(userId).update({
                storageUsage: 0,
                storageLastUpdated: admin.firestore.FieldValue.serverTimestamp()
            });
            revalidatePath('/admin/users');
            return { success: true };
        }

        // 2. Sum up file sizes for all projects
        // We assume files are stored as: projects/{projectId}/...
        const bucket = adminStorage.bucket("motionx-studio.firebasestorage.app");

        let totalBytes = 0;

        // Run in parallel for speed
        await Promise.all(projectIds.map(async (pid) => {
            const [files] = await bucket.getFiles({ prefix: `projects/${pid}/` });
            const projectTotal = files.reduce((acc, file) => acc + parseInt(file.metadata.size || '0'), 0);
            totalBytes += projectTotal;
        }));

        // 3. Update User Record
        await adminDb.collection('users').doc(userId).update({
            storageUsage: totalBytes,
            storageLastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });

        revalidatePath('/admin/users');
        return { success: true };

    } catch (error) {
        console.error("Storage scan failed", error);
        return { success: false };
    }
}
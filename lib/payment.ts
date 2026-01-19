import { useState } from "react";
import { useRazorpay } from "react-razorpay";
import { API_BASE_URL } from "./config";
import { auth } from "./firebase";

// --- TYPES ---
interface SubscriptionOptions {
    planType: "starter" | "pro" | "agency";
    onSuccess?: () => void;
    onError?: (error: any) => void;
}

interface TopUpOptions {
    packageId: "pack_50" | "pack_100" | "pack_200";
    onSuccess?: () => void;
    onError?: (error: any) => void;
}

export const usePayment = () => {
    const { Razorpay } = useRazorpay();
    const [isProcessing, setIsProcessing] = useState(false);

    // --- HELPER: GET AUTH HEADERS ---
    const getAuthHeaders = async () => {
        const user = auth.currentUser;
        if (!user) throw new Error("User not authenticated");
        const token = await user.getIdToken();
        return { Authorization: `Bearer ${token}` };
    };

    // --- HELPER: VERIFY PAYMENT ON SERVER ---
    const verifyPayment = async (payload: any, endpoint: string) => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`${API_BASE_URL}/api/v1/payment/${endpoint}`, {
                method: "POST",
                headers: { ...headers, "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error("Payment verification failed on server");
            return true;
        } catch (error) {
            console.error("Verification Error:", error);
            return false;
        }
    };

    // --- 1. HANDLE SUBSCRIPTION (Monthly) ---
    const subscribe = async ({ planType, onSuccess, onError }: SubscriptionOptions) => {
        if (isProcessing) return; // Prevent double-clicks
        setIsProcessing(true);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        try {
            const headers = await getAuthHeaders();
            const user = auth.currentUser;
            const formData = new FormData();
            formData.append("plan_type", planType);

            // A. Create Subscription
            const response = await fetch(`${API_BASE_URL}/api/v1/payment/create-subscription`, {
                method: "POST",
                headers: headers,
                body: formData,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Failed to create subscription");
            }

            const { subscription_id, key_id } = await response.json();

            // B. Open Razorpay Modal
            // We cast to 'any' here to fix the TypeScript error about missing 'amount'/'currency'
            const options: any = {
                key: key_id,
                subscription_id: subscription_id,
                name: "MotionX Studio",
                description: `${planType.toUpperCase()} Tier Subscription`,
                prefill: {
                    name: user?.displayName || "",
                    email: user?.email || "",
                },
                // C. Handle Success with Verification
                handler: async (response: any) => {
                    const isValid = await verifyPayment({
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_subscription_id: response.razorpay_subscription_id,
                        razorpay_signature: response.razorpay_signature,
                        plan_type: planType
                    }, "verify-subscription");

                    setIsProcessing(false); // Reset UI state
                    if (isValid) onSuccess?.();
                    else onError?.(new Error("Payment verification failed. If you were charged, please contact support."));
                },
                modal: {
                    ondismiss: () => setIsProcessing(false)
                },
                theme: { color: "#22c55e" }
            };

            const rzp = new Razorpay(options);

            rzp.on("payment.failed", (resp: any) => {
                setIsProcessing(false);
                onError?.(resp.error);
            });

            rzp.open();

        } catch (error: any) {
            clearTimeout(timeoutId);
            setIsProcessing(false);
            console.error("❌ Subscription Flow Error:", error);
            if (onError) onError(error);
        }
    };

    // --- 2. HANDLE ONE-TIME CREDITS (Top-up) ---
    const buyCredits = async ({ packageId, onSuccess, onError }: TopUpOptions) => {
        if (isProcessing) return;
        setIsProcessing(true);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
            const headers = await getAuthHeaders();
            const user = auth.currentUser;
            const formData = new FormData();
            formData.append("package_id", packageId);

            // A. Create Order
            const response = await fetch(`${API_BASE_URL}/api/v1/payment/buy-credits`, {
                method: "POST",
                headers: headers,
                body: formData,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Failed to create order");
            }

            const { order_id, amount, currency, key_id } = await response.json();

            // B. Open Razorpay Modal
            // Cast to 'any' to ensure flexibility with the SDK types
            const options: any = {
                key: key_id,
                amount: amount,
                currency: currency,
                name: "MotionX Studio",
                description: "Credit Top-up",
                order_id: order_id,
                prefill: {
                    name: user?.displayName || "",
                    email: user?.email || "",
                },
                // C. Handle Success with Verification
                handler: async (response: any) => {
                    const isValid = await verifyPayment({
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_signature: response.razorpay_signature,
                    }, "verify-payment");

                    setIsProcessing(false);
                    if (isValid) onSuccess?.();
                    else onError?.(new Error("Payment verification failed. If you were charged, please contact support."));
                },
                modal: {
                    ondismiss: () => setIsProcessing(false)
                },
                theme: { color: "#22c55e" }
            };

            const rzp = new Razorpay(options);

            rzp.on("payment.failed", (resp: any) => {
                setIsProcessing(false);
                onError?.(resp.error);
            });

            rzp.open();

        } catch (error: any) {
            clearTimeout(timeoutId);
            setIsProcessing(false);
            console.error("❌ Top-up Flow Error:", error);
            if (onError) onError(error);
        }
    };

    return { subscribe, buyCredits, isProcessing };
};
import { useState, useCallback } from "react";
import { auth } from "@/lib/firebase";
import { api } from "@/lib/api";

// Ensure Razorpay type exists on window
declare global {
    interface Window {
        Razorpay: any;
    }
}

// --- HELPER: DETECT CURRENCY (EXPORTED) ---
export const getUserCurrency = (): "USD" | "INR" => {
    try {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        // Check for Indian Standard Time zones
        if (timeZone === "Asia/Calcutta" || timeZone === "Asia/Kolkata" || timeZone === "IST") {
            return "INR";
        }
    } catch (e) {
        console.warn("Timezone detection failed, defaulting to USD");
    }
    return "USD"; // Default for everyone else
};

// Helper to extract the real backend error message from Axios
const extractError = (error: any): string => {
    return error.response?.data?.detail || error.message || "An unexpected error occurred";
};

export const usePayment = () => {
    const [loading, setLoading] = useState(false);

    // --- SUBSCRIPTION LOGIC ---
    const subscribe = useCallback(async ({ planType, currency, onSuccess, onError }: any) => {
        setLoading(true);
        // Safety check for Razorpay script
        if (typeof window === "undefined" || !window.Razorpay) {
            setLoading(false);
            if (onError) onError("Payment Gateway failed to load. Please refresh.");
            return;
        }

        const activeCurrency = currency || getUserCurrency();

        try {
            const formData = new FormData();
            formData.append("plan_type", planType);
            formData.append("currency", activeCurrency);

            const res = await api.post("/api/v1/payment/create-subscription", formData);
            const data = res.data;

            // ── Upgrade / Downgrade / Already Active: no checkout needed ──
            if (data.status === "upgraded" || data.status === "downgraded" || data.status === "already_active") {
                setLoading(false);
                if (onSuccess) onSuccess(data);
                return;
            }

            // ── New subscription: open Razorpay Checkout ──
            const options = {
                key: data.key_id,
                subscription_id: data.subscription_id,
                name: "Motion X Studio",
                description: `${planType.toUpperCase()} Subscription`,
                // Adding prefill here ensures the user doesn't have to re-type their email!
                prefill: {
                    email: auth.currentUser?.email || "", 
                    name: auth.currentUser?.displayName || "",
                },
                handler: async (response: any) => {
                    try {
                        const verifyRes = await api.post("/api/v1/payment/verify-subscription", {
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_subscription_id: response.razorpay_subscription_id,
                            razorpay_signature: response.razorpay_signature,
                            plan_type: planType
                        });

                        if (verifyRes.status === 200) {
                            if (onSuccess) onSuccess();
                        }
                    } catch (verifyErr) {
                        if (onError) onError("Verification Failed");
                    }
                },
                theme: { color: "#E50914" },
                modal: {
                    ondismiss: () => {
                        setLoading(false);
                        if (onError) onError("Payment cancelled");
                    }
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.on("payment.failed", (resp: any) => {
                setLoading(false);
                if (onError) onError(resp.error.description || "Payment Failed");
            });
            rzp.open();

        } catch (error: any) {
            setLoading(false);
            if (onError) onError(extractError(error));
        }
    }, []);

    // --- ONE-TIME TOP UP LOGIC ---
    const buyCredits = useCallback(async ({ packageId, currency, onSuccess, onError }: any) => {
        setLoading(true);

        // Safety Check
        if (typeof window === "undefined" || !window.Razorpay) {
            setLoading(false);
            if (onError) onError("Payment Gateway failed to load. Please refresh.");
            return;
        }

        const activeCurrency = currency || getUserCurrency();

        try {
            const formData = new FormData();
            formData.append("package_id", packageId);
            formData.append("currency", activeCurrency);

            const res = await api.post("/api/v1/payment/buy-credits", formData);
            const data = res.data;

            const options = {
                key: data.key_id,
                amount: data.amount,
                currency: data.currency,
                name: "Motion X Studio",
                description: data.description,
                order_id: data.order_id,
                prefill: {
                    email: data.user_email || auth.currentUser?.email || "",
                    name: data.user_name || auth.currentUser?.displayName || "",
                },
                handler: async (response: any) => {
                    try {
                        await api.post("/api/v1/payment/verify-payment", {
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_signature: response.razorpay_signature
                        });
                        setLoading(false);
                        if (onSuccess) onSuccess();
                    } catch {
                        setLoading(false);
                        if (onError) onError("Verification Failed");
                    }
                },
                theme: { color: "#E50914" },
                modal: {
                    ondismiss: () => {
                        setLoading(false);
                        if (onError) onError("Payment cancelled");
                    }
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.on("payment.failed", (resp: any) => {
                setLoading(false);
                if (onError) onError(resp.error.description || "Payment Failed");
            });
            rzp.open();

        } catch (error: any) {
            setLoading(false);
            if (onError) onError(extractError(error));
        }
    }, []);

    // --- 3. CANCEL SUBSCRIPTION ---
    const cancelSubscription = useCallback(async ({ onSuccess, onError }: any) => {
        setLoading(true);
        try {
            await api.post("/api/v1/payment/cancel-subscription");
            if (onSuccess) onSuccess();

        } catch (error: any) {
            if (onError) onError(extractError(error));
        } finally {
            setLoading(false);
        }
    }, []);

    return { subscribe, buyCredits, cancelSubscription, loading };

};
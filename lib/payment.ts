import { useState, useCallback } from "react";
import { auth } from "@/lib/firebase";
import { API_BASE_URL } from "@/lib/config";

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
            const token = await auth.currentUser?.getIdToken();

            const formData = new FormData();
            formData.append("plan_type", planType);
            formData.append("currency", activeCurrency);

            const res = await fetch(`${API_BASE_URL}/api/v1/payment/create-subscription`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "Subscription Init Failed");

            const options = {
                key: data.key_id,
                subscription_id: data.subscription_id,
                name: "Motion X Studio",
                description: `${planType.toUpperCase()} Subscription`,
                handler: async (response: any) => {
                    const verifyRes = await fetch(`${API_BASE_URL}/api/v1/payment/verify-subscription`, {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_subscription_id: response.razorpay_subscription_id,
                            razorpay_signature: response.razorpay_signature,
                            plan_type: planType
                        }),
                    });

                    if (verifyRes.ok) {
                        if (onSuccess) onSuccess();
                    } else {
                        if (onError) onError("Verification Failed");
                    }
                },
                theme: { color: "#E50914" },
                modal: {
                    ondismiss: () => {
                        setLoading(false);
                        if (onError) onError("Cancelled");
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
            if (onError) onError(error.message);
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
            const token = await auth.currentUser?.getIdToken();

            const formData = new FormData();
            formData.append("package_id", packageId);
            formData.append("currency", activeCurrency);

            const res = await fetch(`${API_BASE_URL}/api/v1/payment/buy-credits`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "Order Creation Failed");

            const options = {
                key: data.key_id,
                amount: data.amount,
                currency: data.currency,
                name: "Motion X Studio",
                description: data.description,
                order_id: data.order_id,
                handler: async (response: any) => {
                    const verifyRes = await fetch(`${API_BASE_URL}/api/v1/payment/verify-payment`, {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_signature: response.razorpay_signature
                        }),
                    });

                    if (verifyRes.ok) {
                        setLoading(false);
                        if (onSuccess) onSuccess();
                    } else {
                        setLoading(false);
                        if (onError) onError("Verification Failed");
                    }
                },
                theme: { color: "#E50914" },
                modal: {
                    ondismiss: () => {
                        setLoading(false);
                        if (onError) onError("Cancelled");
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
            if (onError) onError(error.message);
        }
    }, []);

    // --- 3. CANCEL SUBSCRIPTION (NEW) ---
    const cancelSubscription = useCallback(async ({ onSuccess, onError }: any) => {
        setLoading(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch(`${API_BASE_URL}/api/v1/payment/cancel-subscription`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "Cancellation Failed");

            if (onSuccess) onSuccess();

        } catch (error: any) {
            if (onError) onError(error.message);
        } finally {
            setLoading(false);
        }
    }, []);

    return { subscribe, buyCredits, cancelSubscription, loading };

};
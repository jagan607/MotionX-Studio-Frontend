import toast from "react-hot-toast";

type ToastType = "success" | "error" | "info";

/**
 * Terminal-styled toast for MotionX Studio
 * Use this instead of alert() throughout the app
 */
export const terminalToast = (message: string, type: ToastType = "info") => {
    const colors = {
        success: { text: "#00FF00", border: "#00FF00", icon: "🟩" },
        error: { text: "#FF0000", border: "#FF0000", icon: "🟥" },
        info: { text: "#00BFFF", border: "#00BFFF", icon: "🟦" },
    };

    const config = colors[type];

    toast(message, {
        icon: config.icon,
        style: {
            borderRadius: "0px",
            background: "#111",
            color: config.text,
            border: `1px solid ${config.border}`,
            fontFamily: "monospace",
            letterSpacing: "1px",
            fontSize: "12px",
            textTransform: "uppercase",
        },
    });
};

// Convenience methods
export const toastSuccess = (msg: string) => terminalToast(msg, "success");
export const toastError = (msg: string) => terminalToast(msg, "error");
export const toastInfo = (msg: string) => terminalToast(msg, "info");

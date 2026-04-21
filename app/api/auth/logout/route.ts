import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
    const response = NextResponse.json({ status: "logged_out" });

    // Delete the session cookie by setting it to empty with immediate expiry
    response.cookies.set("session", "", {
        maxAge: 0,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
    });

    return response;
}

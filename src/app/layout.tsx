import type { Metadata } from "next";
// import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers";

// const geistSans = Geist({
//   variable: "--font-geist-sans",
//   subsets: ["latin"],
// });

// const geistMono = Geist_Mono({
//   variable: "--font-geist-mono",
//   subsets: ["latin"],
// });

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
    title: "Explicitize - A rhythm annotating tool",
    description: "A local-first rhythm annotation editor with waveform, spectrum, and chart editing",
    icons: {
        icon: [
            {
                url: `${basePath}/favicon.ico`,
                type: "image/x-icon",
                sizes: "16x16 32x32 48x48 64x64 128x128 256x256",
            },
            {
                url: `${basePath}/icon.png`,
                type: "image/png",
                sizes: "512x512",
            },
        ],
        apple: {
            url: `${basePath}/apple-icon.png`,
            type: "image/png",
            sizes: "180x180",
        },
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body
            // className={`${geistSans.variable} ${geistMono.variable} antialiased`}
            >
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}

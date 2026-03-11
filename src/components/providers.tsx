"use client";

import React from "react";
import { AppSettingsProvider } from "./appSettingsContext";

export default function Providers({ children }: { children: React.ReactNode }) {
    return <AppSettingsProvider>{children}</AppSettingsProvider>;
}

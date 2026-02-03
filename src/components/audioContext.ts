import { createContext } from "react";
export const AudioDataCtx = createContext<
    { id: string; file: string; buffer: ArrayBuffer; duration: number }[]
>([]);

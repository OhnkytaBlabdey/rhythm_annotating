import { createContext } from "react";
export const AudioDataCtx = createContext<
    { file: string; buffer: ArrayBuffer; duration: number }[]
>([]);

import { createContext } from "react";
import { AudioData } from "@/interface/audioData";

export const AudioDataCtx = createContext<AudioData[]>([]);

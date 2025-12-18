import { note } from "./note";
export interface measure {
  noBeat: boolean;
  bpm?: number;
  notes: Array<note>;
}

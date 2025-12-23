"use client";
import "./soundLane.module.css";
import SoundFileTitleBar from "./soundFileTitleBar";
import { NoteLane } from "./noteArea/noteLane";
import { notelane } from "@/interface/soundLane/noteLane/notelane";
import SoundMenu from "./soundMenu/soundMenu";
import { soundlane } from "@/interface/soundLane/soundlane";
import WaveLane from "./waveArea/waveLane";
import { wavelane } from "@/interface/soundLane/waveLane/wavelane";
import SpectrumLane from "./spectrumArea/spectrumLane";
import { spectrumlane } from "@/interface/soundLane/spectrumLane/spectrumlane";
import WaveMenu from "./soundMenu/waveMenu/waveMenu";
import SpectrumMenu from "./soundMenu/spectrumMenu/spectrumMenu";
import NoteMenu from "./soundMenu/noteMenu/noteMenu";
import { measure } from "@/interface/soundLane/noteLane/measure/measure";

interface _prop {
    index: number;
    soundFile: string;
    timeRange: [number, number];
    refSoundLane: soundlane;
    setSoundLane: (i: number, l: soundlane) => void;
}

export default function SoundLane(prop: _prop) {
    function handleClickToActivate() {
        const updatedSoundLane = {
            ...prop.refSoundLane,
            isActive: !prop.refSoundLane.isActive,
        };
        prop.setSoundLane(prop.index, updatedSoundLane);
    }

    function setNoteLanes(newNoteLanes: notelane[]) {
        const updatedSoundLane = {
            ...prop.refSoundLane,
            noteLanes: newNoteLanes,
        };
        prop.setSoundLane(prop.index, updatedSoundLane);
    }
    function setWaveLane(newwavelane: wavelane) {
        const updatedSoundLane = {
            ...prop.refSoundLane,
            waveLane: newwavelane,
        };
        prop.setSoundLane(prop.index, updatedSoundLane);
    }
    function setSpectrumLane(newspectrumlane: spectrumlane) {
        const updatedSoundLane = {
            ...prop.refSoundLane,
            spectrumLane: newspectrumlane,
        };
        prop.setSoundLane(prop.index, updatedSoundLane);
    }
    function setAmplitudeMultiplier(newampmulti: number) {
        setWaveLane({
            ...prop.refSoundLane.waveLane,
            amplitudeMultiplier: newampmulti,
        });
    }
    // const activeNotelane = prop.refSoundLane.noteLanes.filter(
    //     (lane) => lane.isActive
    // )[0];

    return (
        <div
            className="SoundLane flex flex-col h-full cursor-pointer"
            onClick={handleClickToActivate}
        >
            <div className="w-auto">
                <SoundFileTitleBar
                    soundFile={prop.soundFile}
                    isActive={prop.refSoundLane.isActive || false}
                />
                <div>
                    {prop.timeRange[0].toFixed(4)} -{" "}
                    {prop.timeRange[1].toFixed(4)} second
                </div>
            </div>
            <div className="flex flex-1">
                <div className="w-auto" onClick={(e) => e.stopPropagation()}>
                    <SoundMenu
                        refNoteLanes={prop.refSoundLane.noteLanes}
                        setNoteLanes={setNoteLanes}
                    />
                    <WaveMenu
                        refAmplitudeMultiplier={
                            prop.refSoundLane.waveLane.amplitudeMultiplier
                        }
                        setAmplitudeMultiplier={setAmplitudeMultiplier}
                        refIsFold={prop.refSoundLane.waveLane.isFolded}
                        setIsFold={(fold: boolean) => {
                            setWaveLane({
                                ...prop.refSoundLane.waveLane,
                                isFolded: fold,
                            });
                        }}
                    />
                    <SpectrumMenu
                        refIsFold={prop.refSoundLane.spectrumLane.isFolded}
                        setIsFold={(fold: boolean) => {
                            setSpectrumLane({
                                ...prop.refSoundLane.spectrumLane,
                                isFolded: fold,
                            });
                        }}
                    />
                    <NoteMenu
                        refMeasures={
                            prop.refSoundLane.noteLanes.find(
                                (lane) => lane.isActive
                            )?.measures ?? []
                        }
                        setMeasures={(newmss: measure[]) => {}}
                    />
                </div>
                <div className="flex-1">
                    {/* <div className="time-axis-container"> */}
                    {/* wave */}
                    <WaveLane
                        mediaFilePath={prop.soundFile}
                        waveLane={prop.refSoundLane.waveLane}
                        setWaveLane={setWaveLane}
                        arrayBuffer={prop.refSoundLane.audioBuffer}
                        key={`${prop.index}-wave`}
                        timeRange={prop.timeRange}
                    />
                    {/* spectrum */}
                    <SpectrumLane
                        mediaFilePath={prop.soundFile}
                        spectrumLane={prop.refSoundLane.spectrumLane}
                        setSpectrumLane={setSpectrumLane}
                        arrayBuffer={prop.refSoundLane.audioBuffer}
                        key={`${prop.index}-spectrum`}
                        timeRange={prop.timeRange}
                    />
                    {/* notes */}
                    {prop.refSoundLane.noteLanes.map((lane, index) => (
                        <NoteLane
                            key={`${prop.index}-${index}`}
                            Key={`${prop.index}-${index}`}
                            index={index}
                            refNoteLane={lane}
                            setNoteLane={(newlane) => {
                                const newlanes = prop.refSoundLane.noteLanes;
                                newlanes[index] = newlane;
                                setNoteLanes(newlanes);
                            }}
                        />
                    ))}
                    {/* </div> */}
                </div>
            </div>
        </div>
    );
}

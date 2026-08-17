/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { AUDIO_ASSETS, AUDIO_CUES, BGM_DEFINITION } from "../data/audio-definitions";
const runtimeFiles=import.meta.glob("../../public/assets/audio/*.{ogg,wav}",{eager:true,query:"?url",import:"default"});
describe("audio manifest",()=>{
  it("uses unique CC0 runtime asset paths that exist",()=>{const keys=new Set<string>();const paths=new Set<string>();for(const asset of AUDIO_ASSETS){expect(asset.license).toBe("CC0-1.0");expect(keys.has(asset.key)).toBe(false);expect(paths.has(asset.path)).toBe(false);expect(asset.path).toMatch(/^assets\/audio\/.+\.(ogg|wav)$/);expect(runtimeFiles[`../../public/${asset.path}`]).toBeTruthy();keys.add(asset.key);paths.add(asset.path);}expect(keys.has(BGM_DEFINITION.asset)).toBe(true);expect(BGM_DEFINITION).toMatchObject({loop:true,category:"bgm"});});
  it("references only manifest assets and defines the minimum gameplay cues",()=>{const keys=new Set(AUDIO_ASSETS.map((asset)=>asset.key));for(const definition of Object.values(AUDIO_CUES))for(const asset of definition.assets)expect(keys.has(asset)).toBe(true);expect(Object.keys(AUDIO_CUES)).toEqual(expect.arrayContaining(["ui","pickup","pistol-shot","smg-shot","shotgun-shot","rifle-shot","player-hurt","zombie-hit","zombie-death","zombie-growl"]));});
  it("keeps UI non-spatial and zombie moans concurrency-limited",()=>{expect(AUDIO_CUES.ui.category).toBe("ui");expect(AUDIO_CUES.ui.spatialRange).toBeUndefined();expect(AUDIO_CUES["zombie-growl"].maxInstances).toBeLessThanOrEqual(3);});
});
/// <reference types="vite/client" />

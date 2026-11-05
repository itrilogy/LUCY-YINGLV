export const GENERATED_ASSETS: {
  id: string;
  name: string;
  zhName: string;
  sourceScene: string;
  layerRole: 'background' | 'imagery' | 'accent' | 'typography';
  styles: string[];
  imageries: string[];
  acousticFocus: ('kick' | 'snare' | 'hat' | 'bass' | 'lead-vocal' | 'ambient')[];
  recommendedPaces: ('fast' | 'medium' | 'slow' | 'outro')[];
  description: string;
  promptGuidance: string;
  ownsLyrics?: boolean;
  origin: 'generated';
  kind: 'layer';
}[] = [
];

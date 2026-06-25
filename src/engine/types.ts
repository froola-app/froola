export type GestureSignal = {
  x: number;
  y: number;
  present: boolean;
  handId: 'primary' | 'secondary';
};

export type MusicalCommand = {
  chord: string;
  voicing: number[];
  register: number;
  texture: number;
  tension: number;
};

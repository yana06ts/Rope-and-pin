export interface Point {
  x: number;
  y: number;
}

export enum RopeType {
  Static = 'static',
  Elastic = 'elastic',
  Rusty = 'rusty',
}

export interface NailData {
  id: string;
  position: Point;
  type: RopeType;
  moved?: boolean;
}

export interface Level {
  id: number;
  name: string;
  rule: string;
  targetPath: string;
  nails: NailData[];
  inventoryNails?: NailData[];
  ropeOrder: string[]; // IDs of nails in order
  threshold: number;
}

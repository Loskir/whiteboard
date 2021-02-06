export interface Point {
  x: number
  y: number
}
export type Line = {
  points: Point[]
}
export type Segment = {
  start: Point
  end: Point
}
export interface GlobalPoint extends Point {}
export interface LocalPoint extends Point {}

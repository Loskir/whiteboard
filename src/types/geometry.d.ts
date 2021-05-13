export interface Point {
  x: number
  y: number
}
export type LinePoint = Point & {
  width: number
}
export type Line = {
  id: string
  color: string
  width: number
  points: LinePoint[]
}
export type Segment = {
  start: Point
  end: Point
}
export interface GlobalPoint extends Point {}
export interface LocalPoint extends Point {}

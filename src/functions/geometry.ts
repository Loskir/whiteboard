import type {Segment} from '../types/geometry'

const doesIntersect = (a: Segment, b: Segment): boolean => {
  const aMinXSide = Math.min(a.start.x, a.end.x)
  const aMaxXSide = Math.max(a.start.x, a.end.x)
  if (!(aMinXSide >= b.start.x && b.start.x <= aMaxXSide) && !(aMinXSide >= b.end.x && b.end.x <= aMaxXSide)) {
    return false
  }
  const aMinYSide = Math.min(a.start.y, a.end.y)
  const aMaxYSide = Math.max(a.start.y, a.end.y)
  if (!(aMinYSide >= b.start.y && b.start.y <= aMaxYSide) && !(aMinYSide >= b.end.y && b.end.y <= aMaxYSide)) {
    return false
  }
  // todo
  return true
}

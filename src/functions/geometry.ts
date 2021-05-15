import type {Line, Point, Rectangle} from '../types/geometry'

export function getDistance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

export function middlePoint(a: Point, b: Point): Point {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  }
}

export function doesIntersect(a: Rectangle, b: Rectangle): boolean {
  return !(a.left > b.right ||
    a.right < b.left ||
    a.top > b.bottom ||
    a.bottom < b.top)
}

export function getLineBoundary(line: Line): Rectangle {
  console.log('lb', line)
  let minX = line.points[0].x
  let minY = line.points[0].y
  let maxX = line.points[0].x
  let maxY = line.points[0].y
  for (let i = 1; i < line.points.length; ++i) {
    const point = line.points[i]
    if (point.x < minX) {
      minX = point.x
    }
    if (point.y < minY) {
      minY = point.y
    }
    if (point.x > maxX) {
      maxX = point.x
    }
    if (point.y > maxY) {
      maxY = point.y
    }
  }
  return {
    left: minX,
    top: minY,
    right: maxX,
    bottom: maxY,
  }
}

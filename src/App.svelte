<script lang="ts">
  import {
    onMount,
    tick,
  } from 'svelte'

  import type {
    Point,
    Line,
    GlobalPoint,
    LocalPoint,
  } from './types/geometry'

  let isMounted = false
  onMount(() => {
    isMounted = true
  })

  let canvas

  let canvasWidth = document.body.clientWidth
  let canvasHeight = document.body.clientHeight

  const updateCanvasSize = () => {
    canvasWidth = document.body.clientWidth
    canvasHeight = document.body.clientHeight
  }

  const lines: Line[] = []

  let currentToolName = 'pencil'

  abstract class Tool {
    name: string = 'Abstract tool'
    cursor: string = 'default'

    onDown(point: Point): void {
    }

    onMove(point: Point): void {
    }

    onUp(point?: Point): void {
    }
  }

  class Pencil extends Tool {
    name = 'pencil'
    cursor = 'crosshair'
    isDown: boolean
    currentLineIndex: number

    onDown({ x, y, force = 0.25 }) {
      if (this.isDown) {
        console.warn('Already down')
        return
      }
      this.isDown = true
      this.currentLineIndex = lines.length
      lines.push({
        color: `hsl(${Math.floor(Math.random() * 360)}, 50%, 50%)`,
        points: [
          { x: convertGlobalToLocalX(x), y: convertGlobalToLocalY(y), width: 1 + force * 4 },
        ],
      })
    }

    onMove({ x, y, force = 0.25 }) {
      if (!this.isDown) {
        return
      }
      const localPoint = { x: convertGlobalToLocalX(x), y: convertGlobalToLocalY(y), width: 1 + force * 4 }
      const currentLine = lines[this.currentLineIndex]
      if (currentLine.points.length === 0) {
        currentLine.points.push(localPoint)
      }
      const lastPoint = currentLine.points[currentLine.points.length - 1]
      if (lastPoint.x === localPoint.x && lastPoint.y === localPoint.y) {
        return // the same as the previous point
      }
      currentLine.points.push(localPoint)
      draw()
    }

    onUp() {
      if (!this.isDown) {
        return
      }
      this.isDown = false
      let currentLine = lines[this.currentLineIndex]
      if (currentLine.points.length === 1) {
        lines.splice(this.currentLineIndex, 1) // "empty"
      } else if (currentLine.points.length > 2) {
        const newLine: Line = {
          color: currentLine.color,
          points: [
            currentLine.points[0],
          ],
        }
        for (let i = 1; i < currentLine.points.length - 1; ++i) {
          const prevPoint = currentLine.points[i - 1]
          const thisPoint = currentLine.points[i]
          const nextPoint = currentLine.points[i + 1]
          const tg1 = (thisPoint.y - prevPoint.y) / (thisPoint.x - prevPoint.x)
          const tg2 = (nextPoint.y - thisPoint.y) / (nextPoint.x - thisPoint.x)
          if (tg1 !== tg2) {
            newLine.points.push(thisPoint)
          }
        }
        newLine.points.push(currentLine.points[currentLine.points.length - 1])
        lines[this.currentLineIndex] = newLine
        console.log(`${currentLine.points.length} → ${newLine.points.length} points`)
      }
      this.currentLineIndex = -1
      console.log(lines)
      draw()
    }
  }

  class Pan extends Tool {
    name = 'pan'
    cursor = 'move'
    isDown: boolean
    initialPanX: number
    initialPanY: number
    downX: number
    downY: number

    updatePan(point: GlobalPoint) {
      panX = this.initialPanX + (point.x - this.downX)
      panY = this.initialPanY + (point.y - this.downY)
    }

    onDown(point: GlobalPoint) {
      if (this.isDown) {
        console.warn('Already down')
        return
      }
      this.isDown = true
      this.initialPanX = panX
      this.initialPanY = panY
      this.downX = point.x
      this.downY = point.y
    }

    onMove(point: GlobalPoint) {
      if (!this.isDown) {
        return
      }
      this.updatePan(point)
      draw()
    }

    onUp(point?: GlobalPoint) {
      if (!this.isDown) {
        return
      }
      this.isDown = false
      if (point) {
        this.updatePan(point)
      }
    }
  }

  const tools: Tool[] = [
    new Pencil(),
    new Pan(),
  ]
  const toolsMap = new Map<string, Tool>()
  for (const tool of tools) {
    toolsMap.set(tool.name, tool)
  }

  $: currentTool = toolsMap.get(currentToolName)
  $: canvasCursor = currentTool.cursor || 'default'

  let panX = 0
  let panY = 0

  const convertGlobalToLocalX = (x) => x - canvasWidth / 2 - panX
  const convertGlobalToLocalY = (y) => y - canvasHeight / 2 - panY
  const convertLocalToGlobalX = (x) => x + canvasWidth / 2 + panX
  const convertLocalToGlobalY = (y) => y + canvasHeight / 2 + panY
  const convertGlobalToLocal = (point: GlobalPoint): LocalPoint => ({
    x: convertGlobalToLocalX(point.x),
    y: convertGlobalToLocalY(point.y),
  })
  const convertLocalToGlobal = (point: LocalPoint): GlobalPoint => ({
    x: convertLocalToGlobalX(point.x),
    y: convertLocalToGlobalY(point.y),
  })

  const isOutOfBounds = ({ x, y }: GlobalPoint) => {
    const P = 10
    return (x < -P || x > canvasWidth + P || y < -P || y > canvasHeight + P)
  }

  const drawLine = (ctx: CanvasRenderingContext2D, line: Line) => {
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.strokeStyle = line.color
    if (line.points.length === 0) {
      return
    }
    ctx.beginPath()
    ctx.moveTo(
      convertLocalToGlobalX(line.points[0].x),
      convertLocalToGlobalY(line.points[0].y),
    )
    for (let i = 1; i < line.points.length; ++i) {
      const point = line.points[i]
      ctx.lineTo(
        convertLocalToGlobalX(point.x),
        convertLocalToGlobalY(point.y),
      )
    }
    ctx.stroke()
  }
  const drawLineOptimized = (ctx: CanvasRenderingContext2D, line: Line) => {
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.strokeStyle = line.color
    if (line.points.length === 0) {
      return
    }
    ctx.beginPath()
    ctx.moveTo(
      convertLocalToGlobalX(line.points[0].x),
      convertLocalToGlobalY(line.points[0].y),
    )
    for (let i = 1; i < line.points.length; ++i) {
      const point = line.points[i]
      const globalPoint: GlobalPoint = convertLocalToGlobal(point)
      const prevGlobalPoint = convertLocalToGlobal(line.points[i - 1])
      const nextPoint = line.points[i + 1]
      if (isOutOfBounds(prevGlobalPoint) && isOutOfBounds(globalPoint) && nextPoint && isOutOfBounds(convertLocalToGlobal(nextPoint))) {
        continue
      }
      ctx.lineTo(globalPoint.x, globalPoint.y)
    }
    ctx.stroke()
  }
  const drawLineVariableWidthOptimized = (ctx: CanvasRenderingContext2D, line: Line) => {
    ctx.strokeStyle = line.color
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (line.points.length === 0) {
      return
    }
    for (let i = 1; i < line.points.length; ++i) {
      const point = line.points[i]
      const globalPoint: GlobalPoint = convertLocalToGlobal(point)
      const prevGlobalPoint = convertLocalToGlobal(line.points[i - 1])
      const nextPoint = line.points[i + 1]
      if (isOutOfBounds(prevGlobalPoint) && isOutOfBounds(globalPoint) && nextPoint && isOutOfBounds(convertLocalToGlobal(nextPoint))) {
        continue
      }
      ctx.beginPath()
      ctx.lineWidth = point.width
      ctx.moveTo(prevGlobalPoint.x, prevGlobalPoint.y)
      ctx.lineTo(globalPoint.x, globalPoint.y)
      ctx.stroke()
    }
  }
  const drawLineVariableWidthOptimized2 = (ctx: CanvasRenderingContext2D, line: Line) => {
    ctx.strokeStyle = line.color
    ctx.fillStyle = line.color
    ctx.lineCap = 'butt'
    ctx.lineJoin = 'bevel'
    if (line.points.length === 0) {
      return
    }
    for (let i = 1; i < line.points.length; ++i) {
      const point = line.points[i]
      const globalPoint: GlobalPoint = convertLocalToGlobal(point)
      const prevGlobalPoint = convertLocalToGlobal(line.points[i - 1])
      const nextPoint = line.points[i + 1]
      if (isOutOfBounds(prevGlobalPoint) && isOutOfBounds(globalPoint) && nextPoint && isOutOfBounds(convertLocalToGlobal(nextPoint))) {
        continue
      }
      ctx.beginPath()
      ctx.lineWidth = point.width
      ctx.moveTo(prevGlobalPoint.x, prevGlobalPoint.y)
      ctx.lineTo(globalPoint.x, globalPoint.y)
      ctx.stroke()
      ctx.beginPath()
      const r = point.width / 2 * 0.8
      ctx.arc(globalPoint.x, globalPoint.y, r, 0, 2 * Math.PI)
      ctx.fill()
    }
  }

  const drawMethods = {
    default: drawLine,
    optimized: drawLineOptimized,
    variableWidth: drawLineVariableWidthOptimized,
    variableWidth2: drawLineVariableWidthOptimized2,
  }
  let currentDrawMethod = 'default'

  const draw = () => {
    const ctx: CanvasRenderingContext2D = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)
    lines.forEach((line) => {
      let method = drawMethods[currentDrawMethod]
      if (!method) {
        console.warn('Draw method not found, fallback to default')
        method = drawLine
      }
      method(ctx, line)
    })
  }
  $: {
    if (isMounted) {
      currentDrawMethod
      draw()
    }
  }

  const handleDown = (point: Point) => {
    return currentTool.onDown(point)
  }
  const handleMove = (point: Point) => {
    return currentTool.onMove(point)
  }
  const handleUp = (point?: Point) => {
    return currentTool.onUp(point)
  }

  const getPointFromEvent = (event: MouseEvent): GlobalPoint => ({
    x: event.pageX - canvas.offsetLeft,
    y: event.pageY - canvas.offsetTop,
  })
  const getPointFromTouch = (touch: Touch) => ({
    x: touch.pageX - canvas.offsetLeft,
    y: touch.pageY - canvas.offsetTop,
    ...touch.force && { force: touch.force },
  })

  const handleResize = async () => {
    updateCanvasSize()
    await tick()
    draw()
  }
  const handleMousedown = (e: MouseEvent) => {
    const point = getPointFromEvent(e)
    if (e.button !== 0) {
      return toolsMap.get('pan').onDown(point)
    }
    return currentTool.onDown(getPointFromEvent(e))
  }
  const handleMousemove = (e: MouseEvent) => {
    const point = getPointFromEvent(e)
    if (e.button !== 0) {
      return toolsMap.get('pan').onMove(point)
    }
    currentTool.onMove(point)
  }
  const handleMouseup = (e: MouseEvent) => {
    const point = getPointFromEvent(e)
    if (e.button !== 0) {
      return toolsMap.get('pan').onUp(point)
    }
    currentTool.onUp(point)
  }
  const handleTouchstart = (event: TouchEvent) => {
    const touch = event.touches[0]
    if (!touch) {
      return
    }
    return handleDown(getPointFromTouch(touch))
  }
  const handleTouchmove = (event: TouchEvent) => {
    const touch = event.touches[0]
    if (!touch) {
      return
    }
    return currentTool.onMove(getPointFromTouch(touch))
  }
  const handleTouchend = (event: TouchEvent) => {
    return handleUp()
  }
</script>

<svelte:window
  on:resize={handleResize}
  on:mousemove={handleMousemove}
  on:mouseup={handleMouseup}
  on:touchmove|passive={handleTouchmove}
  on:touchend={handleTouchend}
/>

<main>
  <canvas
    bind:this={canvas}
    width={canvasWidth}
    height={canvasHeight}
    style="cursor: {canvasCursor}"
    on:mousedown={handleMousedown}
    on:touchstart|passive={handleTouchstart}
    on:contextmenu|preventDefault|stopPropagation=""
  />
  <div class="controls" on:mousedown|stopPropagation="" on:touchstart|passive|stopPropagation="">
    <label>
      Draw method:
      <select bind:value={currentDrawMethod}>
        {#each Object.keys(drawMethods) as drawMethodName}
          <option value={drawMethodName}>{drawMethodName}</option>
        {/each}
      </select>
    </label>
    <label>
      Tool:
      <select bind:value={currentToolName}>
        {#each tools as tool}
          <option value={tool.name}>{tool.name}</option>
        {/each}
      </select>
    </label>
  </div>
</main>

<style lang="stylus">
  main
    display flex
    flex-direction column
    justify-content center
    align-items center

  .controls
    position fixed
    top 0
    right 0
    display flex
    flex-direction column
    align-items flex-end
</style>

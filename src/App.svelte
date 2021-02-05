<script lang="ts">
  import {
    tick,
  } from 'svelte'

  import type {
    Point,
    Line,
  } from './types/geometry'

  let canvas

  let canvasWidth = document.body.clientWidth
  let canvasHeight = document.body.clientHeight

  const updateCanvasSize = () => {
    canvasWidth = document.body.clientWidth
    canvasHeight = document.body.clientHeight
  }

  const lines: Line[] = []

  let currentToolName = 'pencil'

  interface Tool {
    name: string
    cursor?: string
    onDown(point: Point): void
    onMove(point: Point): void
    onUp(point: Point): void
  }

  const tools: Tool[] = [
    {
      name: 'pencil',
      cursor: 'crosshair',
      isDrawing: false,
      currentLineIndex: -1,
      onDown(point: Point) {
        this.isDrawing = true
        this.currentLineIndex = lines.length
        lines.push({
          points: [point],
        })
      },
      onMove(point: Point) {
        if (!this.isDrawing) {
          return
        }
        lines[this.currentLineIndex].points.push(point)
      },
      onUp() {
        this.isDrawing = false
        this.currentLineIndex = -1
        console.log(lines)
      },
    },
  ]
  const toolsMap = new Map<string, Tool>()
  for (const tool of tools) {
    toolsMap.set(tool.name, tool)
  }

  $: currentTool = toolsMap.get(currentToolName)
  $: canvasCursor = currentTool.cursor || 'default'

  let panX = 0
  let panY = 0

  const convertCanvasToDataX = (x) => x - canvasWidth / 2 - panX
  const convertCanvasToDataY = (y) => y - canvasHeight / 2 - panY
  const convertDataToCanvasX = (x) => x + canvasWidth / 2 + panX
  const convertDataToCanvasY = (y) => y + canvasHeight / 2 + panY

  const draw = () => {
    const ctx: CanvasRenderingContext2D = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)
    ctx.strokeStyle = 'red'
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    lines.forEach((line) => {
      if (line.points.length === 0) {
        return
      }
      ctx.beginPath()
      ctx.moveTo(
        convertDataToCanvasX(line.points[0].x),
        convertDataToCanvasY(line.points[0].y),
      )
      for (let i = 1; i < line.points.length; ++i) {
        const point = line.points[i]
        ctx.lineTo(
          convertDataToCanvasX(point.x),
          convertDataToCanvasY(point.y),
        )
      }
      ctx.stroke()
    })
  }

  const handleDown = (point: Point) => {
    return currentTool.onDown(point)
  }
  const handleMove = (point: Point) => {
    currentTool.onMove(point)
    draw()
  }
  const handleUp = (point: Point) => {
    return currentTool.onUp(point)
  }

  const getPointFromEvent = (e: MouseEvent) => ({
    x: convertCanvasToDataX(e.clientX),
    y: convertCanvasToDataY(e.clientY),
  })

  const handleMousedown = (e: MouseEvent) => handleDown(getPointFromEvent(e))
  const handleMousemove = (e: MouseEvent) => handleMove(getPointFromEvent(e))
  const handleMouseup = (e: MouseEvent) => handleUp(getPointFromEvent(e))
  const handleResize = async () => {
    updateCanvasSize()
    await tick()
    draw()
  }
</script>

<svelte:window
  on:resize={handleResize}
  on:mousemove={handleMousemove}
  on:mouseup={handleMouseup}
/>

<main>
  <canvas
    bind:this={canvas}
    width={canvasWidth}
    height={canvasHeight}
    style="cursor: {canvasCursor}"
    on:mousedown={handleMousedown}
  />
  <div class="tool-select">
    <label>
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

  .tool-select
    position fixed
    top 0
    right 0
</style>

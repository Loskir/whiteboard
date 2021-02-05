<script lang="ts">
  import {
    tick,
  } from 'svelte'

  import type {
    Point,
    Line,
  } from './types/geometry'

  type Tool = 'pencil' | 'eraser' | 'pan'
  let tool: Tool = 'pencil'

  const getCanvasCursor = () => {
    switch (tool) {
      case 'pencil':
        return 'crosshair'
      default:
        return 'default'
    }
  }

  const convertCanvasToDataX = (x) => x - canvasWidth / 2
  const convertCanvasToDataY = (y) => y - canvasHeight / 2
  const convertDataToCanvasX = (x) => x + canvasWidth / 2
  const convertDataToCanvasY = (y) => y + canvasHeight / 2

  $: canvasCursor = getCanvasCursor()

  let canvas

  let canvasWidth = document.body.clientWidth
  let canvasHeight = document.body.clientHeight

  const updateCanvasSize = () => {
    canvasWidth = document.body.clientWidth
    canvasHeight = document.body.clientHeight
  }

  let isDrawing = false

  const lines: Line[] = []
  let currentLineIndex = 0

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

  const startLine = () => {
    isDrawing = true
    currentLineIndex = lines.length
    lines.push({
      points: [],
    })
  }
  const endLine = () => {
    isDrawing = false
    currentLineIndex = -1
    console.log(lines)
  }

  const handleMove = (point: Point) => {
    if (!isDrawing) {
      return
    }
    lines[currentLineIndex].points.push(point)
    draw()
  }

  const handleMousemove = (e: MouseEvent) => handleMove({
    x: convertCanvasToDataX(e.clientX),
    y: convertCanvasToDataY(e.clientY),
  })
  const handleResize = async () => {
    updateCanvasSize()
    await tick()
    draw()
  }
</script>

<svelte:window
  on:resize={handleResize}
  on:mousedown={startLine}
  on:mouseup={endLine}
  on:mousemove={handleMousemove}
/>

<main>
  <canvas
    bind:this={canvas}
    width={canvasWidth}
    height={canvasHeight}
    style="cursor: {canvasCursor}"
  />
</main>

<style lang="stylus">
  main
    display flex
</style>

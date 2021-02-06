<script lang="ts">
  import {
    tick,
  } from 'svelte'

  import type {
    Point,
    Line,
    GlobalPoint,
    LocalPoint,
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

  class Pencil implements Tool {
    name: string = 'pencil'
    cursor: string = 'crosshair'
    isDown: boolean
    currentLineIndex: number

    onDown(point: GlobalPoint) {
      if (this.isDown) {
        console.warn('Already down')
        return
      }
      this.isDown = true
      this.currentLineIndex = lines.length
      lines.push({
        points: [convertGlobalToLocal(point)],
      })
    }

    onMove(point: GlobalPoint) {
      if (!this.isDown) {
        return
      }
      const localPoint = convertGlobalToLocal(point)
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
      this.isDown = false
      let currentLine = lines[this.currentLineIndex]
      if (currentLine.points.length === 1) {
        lines.splice(this.currentLineIndex, 1) // "empty"
      } else if (currentLine.points.length > 2) {
        const newLine: Line = {
          points: [
            currentLine.points[0]
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
      }
      this.currentLineIndex = -1
      console.log(lines)
      draw()
    }
  }

  class Pan implements Tool {
    name: string = 'pan'
    cursor: string = 'move'
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

    onUp(point: GlobalPoint) {
      this.isDown = false
      this.updatePan(point)
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
    })
  }

  const handleDown = (point: Point) => {
    return currentTool.onDown(point)
  }
  const handleMove = (point: Point) => {
    return currentTool.onMove(point)
  }
  const handleUp = (point: Point) => {
    return currentTool.onUp(point)
  }

  const getPointFromEvent = (e: MouseEvent): GlobalPoint => ({
    x: e.pageX - canvas.offsetLeft,
    y: e.pageY - canvas.offsetTop,
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

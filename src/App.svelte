<script lang="ts">
  import {
    onMount,
    tick,
    onDestroy,
  } from 'svelte'
  import {io} from 'socket.io-client'
  import {nanoid} from 'nanoid/non-secure'

  import type {
    Point,
    Line,
    GlobalPoint,
    LocalPoint,
  } from './types/geometry'

  const socket = io('http://10.200.200.151:10000/?board=test')

  let isMounted = false

  const dpr = window.devicePixelRatio || 1

  let canvas

  let canvasPixelWidth = 0
  let canvasPixelHeight = 0
  let canvasWidth = 0
  let canvasHeight = 0

  const updateCanvasSize = () => {
    canvasPixelWidth = document.body.clientWidth
    canvasPixelHeight = document.body.clientHeight
  }
  $: {
    canvasWidth = canvasPixelWidth * dpr
    canvasHeight = canvasPixelHeight * dpr
  }

  let lines: Line[] = []

  let stylusOnlyMode = true

  let selectedMainToolName = 'pencil'
  let currentToolName = 'pencil'
  $: {
    currentToolName = selectedMainToolName
  }

  abstract class Tool {
    name: string = 'Abstract tool'
    cursor: string = 'default'
    isDown: boolean

    touchIdentifier: number

    onDown(point: Point): void {
    }

    onMove(point: Point): void {
    }

    onUp(point?: Point): void {
    }

    onMousedown(event: MouseEvent): void {
    }

    onMousemove(event: MouseEvent): void {
    }

    onMouseup(event: MouseEvent): void {
    }

    onTouchstart(touch: Touch): void {
    }

    onTouchmove(touch: Touch): void {
    }

    onTouchend(touch: Touch): void {
    }
  }

  class Pencil extends Tool {
    name = 'pencil'
    cursor = 'crosshair'
    currentLineIndex: number

    onDown({ x, y, force = 0.25 }) {
      if (this.isDown) {
        console.warn('Already down')
        return
      }
      this.isDown = true
      this.currentLineIndex = lines.length
      lines.push({
        id: nanoid(),
        color: `hsl(${Math.floor(Math.random() * 360)}, 50%, 50%)`,
        points: [
          // { x: convertGlobalToLocalX(x), y: convertGlobalToLocalY(y), width: 1 + force * 4 },
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
          id: currentLine.id,
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
        socket.emit('update', {
          add: [{
            stroke_id: currentLine.id,
            content: JSON.stringify(currentLine),
          }],
        })
        console.log(`${currentLine.points.length} → ${newLine.points.length} points`)
      }
      this.currentLineIndex = -1
      console.log(lines)
      draw()
    }

    onMousedown(event: MouseEvent) {
      this.onDown(getPointFromEvent(event))
    }

    onMousemove(event: MouseEvent) {
      this.onMove(getPointFromEvent(event))
    }

    onMouseup() {
      this.onUp()
    }

    onTouchstart(touch: Touch) {
      if (this.isDown) {
        return
      }
      this.touchIdentifier = touch.identifier
      this.onDown(getPointFromTouch(touch))
    }

    onTouchmove(touch: Touch) {
      if (!this.isDown) {
        return
      }
      this.onMove(getPointFromTouch(touch))
    }

    onTouchend(touch: Touch) {
      this.touchIdentifier = null
      this.onUp()
    }
  }

  class Pan extends Tool {
    name = 'pan'
    cursor = 'move'
    initialPanX: number
    initialPanY: number
    downX: number
    downY: number

    updatePan(point: GlobalPoint) {
      panX = this.initialPanX + (point.x - this.downX) / scale
      panY = this.initialPanY + (point.y - this.downY) / scale
      draw()
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

    onMousedown(event: MouseEvent): void {
      this.onDown(getPointFromEvent(event))
    }

    onMousemove(event: MouseEvent) {
      this.onMove(getPointFromEvent(event))
    }

    onMouseup(event: MouseEvent) {
      this.onUp(getPointFromEvent(event))
    }

    onTouchstart(touch: Touch) {
      if (this.isDown) {
        return
      }
      this.touchIdentifier = touch.identifier
      this.onDown(getPointFromTouch(touch))
    }

    onTouchmove(touch: Touch) {
      if (!this.isDown) {
        return
      }
      this.onMove(getPointFromTouch(touch))
    }

    onTouchend(touch: Touch) {
      this.touchIdentifier = null
      this.onUp()
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

  $: canvasCursor = toolsMap.get(currentToolName)?.cursor || 'default'

  let panX = 0
  let panY = 0
  let scale = 1

  // local — on canvas (endless), global — on screen
  const convertGlobalToLocalX = (x) => (x - canvasPixelWidth / 2) / scale - panX
  const convertGlobalToLocalY = (y) => (y - canvasPixelHeight / 2) / scale - panY
  const convertLocalToGlobalX = (x) => (x + panX) * scale + canvasPixelWidth / 2
  const convertLocalToGlobalY = (y) => (y + panY) * scale + canvasPixelHeight / 2
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
    return (x < -P || x > canvasPixelWidth + P || y < -P || y > canvasPixelHeight + P)
  }

  const drawLine = (ctx: CanvasRenderingContext2D, line: Line) => {
    ctx.lineWidth = 2 * dpr
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.strokeStyle = line.color
    if (line.points.length === 0) {
      return
    }
    ctx.beginPath()
    ctx.moveTo(
      convertLocalToGlobalX(line.points[0].x) * dpr,
      convertLocalToGlobalY(line.points[0].y) * dpr,
    )
    for (let i = 1; i < line.points.length; ++i) {
      const point = line.points[i]
      ctx.lineTo(
        convertLocalToGlobalX(point.x) * dpr,
        convertLocalToGlobalY(point.y) * dpr,
      )
    }
    ctx.stroke()
  }
  const drawLineOptimized = (ctx: CanvasRenderingContext2D, line: Line) => {
    ctx.lineWidth = 2 * dpr
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.strokeStyle = line.color
    if (line.points.length === 0) {
      return
    }
    ctx.beginPath()
    ctx.moveTo(
      convertLocalToGlobalX(line.points[0].x) * dpr,
      convertLocalToGlobalY(line.points[0].y) * dpr,
    )
    for (let i = 1; i < line.points.length; ++i) {
      const point = line.points[i]
      const globalPoint: GlobalPoint = convertLocalToGlobal(point)
      const prevGlobalPoint = convertLocalToGlobal(line.points[i - 1])
      const nextPoint = line.points[i + 1]
      if (isOutOfBounds(prevGlobalPoint) && isOutOfBounds(globalPoint) && nextPoint && isOutOfBounds(convertLocalToGlobal(nextPoint))) {
        continue
      }
      ctx.lineTo(globalPoint.x * dpr, globalPoint.y * dpr)
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
      ctx.lineWidth = point.width * dpr
      ctx.moveTo(prevGlobalPoint.x * dpr, prevGlobalPoint.y * dpr)
      ctx.lineTo(globalPoint.x * dpr, globalPoint.y * dpr)
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
    {
      const point = line.points[0]
      const globalPoint: GlobalPoint = convertLocalToGlobal(point)
      const r = point.width / 2 * 0.9
      ctx.arc(globalPoint.x * dpr, globalPoint.y * dpr, r * dpr * scale, 0, 2 * Math.PI)
    }
    for (let i = 1; i < line.points.length; ++i) {
      const point = line.points[i]
      const globalPoint: GlobalPoint = convertLocalToGlobal(point)
      const prevGlobalPoint = convertLocalToGlobal(line.points[i - 1])
      // const nextPoint = line.points[i + 1]
      // if (isOutOfBounds(prevGlobalPoint) && isOutOfBounds(globalPoint) && nextPoint && isOutOfBounds(convertLocalToGlobal(nextPoint))) {
      //   continue
      // }
      ctx.beginPath()
      ctx.lineWidth = point.width * dpr * scale
      ctx.moveTo(prevGlobalPoint.x * dpr, prevGlobalPoint.y * dpr)
      ctx.lineTo(globalPoint.x * dpr, globalPoint.y * dpr)
      ctx.stroke()
      ctx.beginPath()
      const r = point.width / 2
      ctx.arc(globalPoint.x * dpr, globalPoint.y * dpr, r * dpr * scale, 0, 2 * Math.PI)
      ctx.fill()
    }
  }

  const drawMethods = {
    default: drawLine,
    optimized: drawLineOptimized,
    variableWidth: drawLineVariableWidthOptimized,
    variableWidth2: drawLineVariableWidthOptimized2,
  }
  let currentDrawMethod = 'variableWidth2'

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

  const getPointFromEvent = (event: MouseEvent) => ({
    x: event.pageX - canvas.offsetLeft,
    y: event.pageY - canvas.offsetTop,
    ...(event as any).webkitForce && { force: (event as any).webkitForce - 1 },
  })
  const getPointFromTouch = (touch: Touch) => ({
    x: touch.pageX - canvas.offsetLeft,
    y: touch.pageY - canvas.offsetTop,
    ...touch.force && { force: touch.force },
  })

  function scaleBy(deltaScale, basePoint: GlobalPoint) {
    scale *= 1 + deltaScale
    panX = panX - (basePoint.x - canvasPixelWidth / 2) * deltaScale / scale
    panY = panY - (basePoint.y - canvasPixelHeight / 2) * deltaScale / scale
    draw()
  }

  const handleResize = async () => {
    updateCanvasSize()
    await tick()
    draw()
  }
  const handleMousedown = (event: MouseEvent) => {
    if (event.button !== 0) {
      currentToolName = 'pan'
    }
    return toolsMap.get(currentToolName).onMousedown(event)
  }
  const handleMousemove = (event: MouseEvent) => {
    toolsMap.get(currentToolName).onMousemove(event)
  }
  const handleMouseup = (event: MouseEvent) => {
    toolsMap.get(currentToolName).onMouseup(event)
    currentToolName = selectedMainToolName
  }
  const handleMousewheel = (event: WheelEvent) => {
    console.log(event)
    const deltaScale = -(event.deltaY / 100)
    scaleBy(deltaScale, getPointFromEvent(event))
  }
  const handleTouchstart = (event: TouchEvent) => {
    console.log(event)
    if (stylusOnlyMode) {
      const stylusTool = toolsMap.get(currentToolName)
      if (!stylusTool.isDown) {
        const stylusTouch = [...event.changedTouches].find(
          (touch: Touch) => touch.touchType === 'stylus',
        )
        stylusTouch && stylusTool.onTouchstart(stylusTouch)
      }
      const directTool = toolsMap.get('pan')
      if (!directTool.isDown) {
        const directTouch = [...event.changedTouches].find(
          (touch: Touch) => touch.touchType === 'direct',
        )
        directTouch && directTool.onTouchstart(directTouch)
      }
    } else {
      const tool = toolsMap.get(currentToolName)
      if (!tool.isDown) {
        const touch = event.changedTouches.item(0)
        touch && tool.onTouchstart(touch)
      }
    }
  }
  const handleTouchmove = (event: TouchEvent) => {
    // console.log(event)
    const changedTouches = Array.from(event.changedTouches)
    if (stylusOnlyMode) {
      const stylusTool = toolsMap.get(currentToolName)
      const directTool = toolsMap.get('pan')
      if (stylusTool.isDown) {
        const stylusTouch = changedTouches.find(
          (touch: Touch) => touch.touchType === 'stylus' && touch.identifier === stylusTool.touchIdentifier,
        )
        stylusTouch && stylusTool.onTouchmove(stylusTouch)
      }
      if (directTool.isDown) {
        const directTouch = changedTouches.find(
          (touch: Touch) => touch.touchType === 'direct' && touch.identifier === directTool.touchIdentifier,
        )
        directTouch && directTool.onTouchmove(directTouch)
      }
    } else {
      const tool = toolsMap.get(currentToolName)
      if (tool.isDown) {
        const touch = [...event.changedTouches].find((touch: Touch) => touch.identifier === tool.touchIdentifier)
        touch && tool.onTouchmove(touch)
      }
    }
  }
  const handleTouchend = (event: TouchEvent) => {
    console.log(event)
    const changedTouches = Array.from(event.changedTouches)
    if (stylusOnlyMode) {
      const stylusTool = toolsMap.get(currentToolName)
      const directTool = toolsMap.get('pan')
      if (stylusTool.isDown) {
        const stylusTouch = changedTouches.find(
          (touch: Touch) => touch.touchType === 'stylus' && touch.identifier === stylusTool.touchIdentifier,
        )
        stylusTouch && stylusTool.onTouchend(stylusTouch)
      }
      if (directTool.isDown) {
        const directTouch = changedTouches.find(
          (touch: Touch) => touch.touchType === 'direct' && touch.identifier === directTool.touchIdentifier,
        )
        directTouch && directTool.onTouchend(directTouch)
      }
    } else {
      const tool = toolsMap.get(currentToolName)
      if (tool.isDown) {
        const touch = [...event.changedTouches].find((touch: Touch) => touch.identifier === tool.touchIdentifier)
        touch && tool.onTouchend(touch)
      }
    }
  }

  onMount(() => {
    isMounted = true
    updateCanvasSize()
    socket.on('update', (data) => {
      console.log(data)
      if (data.add) {
        for (const stroke of data.add) {
          lines.push(JSON.parse(stroke.content))
        }
      }
      if (data.delete) {
        for (const stroke of data.delete) {
          lines = lines.filter((v) => v.id !== stroke.stroke_id)
        }
      }
      draw()
    })
  })
  onDestroy(() => {
    socket.disconnect()
  })
  const clear = () => {
    socket.emit('update', { delete: lines.map((v) => ({ stroke_id: v.id })) })
    lines = []
    draw()
  }
</script>

<svelte:window
  on:resize={handleResize}
  on:mousemove={handleMousemove}
  on:mouseup={handleMouseup}
  on:touchmove|preventDefault={handleTouchmove}
  on:touchend={handleTouchend}
  on:touchcancel={handleTouchend}
  on:mousewheel={handleMousewheel}
/>

<main>
  <canvas
    id="canvas"
    bind:this={canvas}
    width={canvasWidth}
    height={canvasHeight}
    style="cursor: {canvasCursor}; width: {canvasPixelWidth}px; height: {canvasPixelHeight}px"
    on:mousedown={handleMousedown}
    on:touchstart|preventDefault={handleTouchstart}
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
      <select bind:value={selectedMainToolName}>
        {#each tools as tool}
          <option value={tool.name}>{tool.name}</option>
        {/each}
      </select>
    </label>
    <button on:click={clear}>Clear</button>
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

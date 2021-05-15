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
  } from '../types/geometry'
  import {getDistance, middlePoint} from '../functions/geometry'

  export let ctx

  const socket = io({ path: '/api/socket.io', query: { board: ctx.params.id } })

  let isMounted = false

  const dpr = window.devicePixelRatio || 1

  let canvas
  let canvasForUnfinishedLine

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

    onDown(point?: Point): void {
    }

    onMove(point?: Point): void {
    }

    onUp(point?: Point): void {
    }

    onMousedown(event?: MouseEvent): void {
    }

    onMousemove(event?: MouseEvent): void {
    }

    onMouseup(event?: MouseEvent): void {
    }

    onTouchstart(touch?: Touch): void {
    }

    onTouchmove(touch?: Touch): void {
    }

    onTouchend(touch?: Touch): void {
    }
  }

  class Pencil extends Tool {
    name = 'pencil'
    cursor = 'crosshair'
    unfinishedLine: Line

    onDown({ x, y, force = 0.25 }) {
      if (this.isDown) {
        console.warn('Already down')
        return
      }
      this.isDown = true
      this.unfinishedLine = {
        id: nanoid(),
        color: lineColor,
        width: lineWidth,
        points: [
          // { x: convertGlobalToLocalX(x), y: convertGlobalToLocalY(y), width: 1 + force * 4 },
        ],
      }
    }

    onMove({ x, y, force = 0.25 }) {
      if (!this.isDown) {
        return
      }
      const localPoint = {
        x: convertGlobalToLocalX(x),
        y: convertGlobalToLocalY(y),
        width: 1 + force * 4,
      }
      const currentLine = this.unfinishedLine
      if (currentLine.points.length === 0) {
        currentLine.points.push(localPoint)
      }
      const lastPoint = currentLine.points[currentLine.points.length - 1]
      if (lastPoint.x === localPoint.x && lastPoint.y === localPoint.y) {
        return // the same as the previous point
      }
      currentLine.points.push(localPoint)
      drawUnfinishedLine(this.unfinishedLine)
    }

    onUp() {
      if (!this.isDown) {
        return
      }
      this.isDown = false
      let currentLine = this.unfinishedLine
      if (currentLine.points.length <= 1) {
        return
      }
      if (currentLine.points.length > 2) {
        const newLine: Line = {
          id: currentLine.id,
          color: currentLine.color,
          width: currentLine.width,
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
        lines.push(newLine)
        socket.emit('update', {
          add: [{
            stroke_id: currentLine.id,
            content: JSON.stringify(currentLine),
          }],
        })
        console.log(`${currentLine.points.length} → ${newLine.points.length} points`)
      } else {
        lines.push(currentLine)
      }
      console.log(lines)
      clearUnfinishedLineCanvas()
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

    onTouchend(touch?: Touch) {
      this.touchIdentifier = null
      this.onUp()
    }
  }

  class Eraser extends Pencil {
    name = 'eraser'

    onDown({ x, y, force = 0.25 }) {
      if (this.isDown) {
        console.warn('Already down')
        return
      }
      this.isDown = true
      this.unfinishedLine = {
        id: nanoid(),
        color: 'white',
        width: lineWidth,
        points: [
          // { x: convertGlobalToLocalX(x), y: convertGlobalToLocalY(y), width: 1 + force * 4 },
        ],
      }
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
    new Eraser(),
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

  let widthScaleInsensitive = false
  let lineColor = '#000000'
  let lineWidth = 1

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
    ctx.lineWidth = 2 * dpr * line.width
    if (!widthScaleInsensitive) {
      ctx.lineWidth *= scale
    }
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
      ctx.lineWidth = point.width * lineWidth * dpr
      if (!widthScaleInsensitive) {
        ctx.lineWidth *= scale
      }
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
      ctx.lineWidth = point.width * line.width * dpr
      if (!widthScaleInsensitive) {
        ctx.lineWidth *= scale
      }
      ctx.moveTo(prevGlobalPoint.x * dpr, prevGlobalPoint.y * dpr)
      ctx.lineTo(globalPoint.x * dpr, globalPoint.y * dpr)
      ctx.stroke()
      ctx.beginPath()
      let r = point.width * line.width * dpr / 2
      if (!widthScaleInsensitive) {
        r *= scale
      }
      ctx.arc(globalPoint.x * dpr, globalPoint.y * dpr, r, 0, 2 * Math.PI)
      ctx.fill()
    }
  }

  const drawMethods = {
    default: drawLine,
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
  const clearUnfinishedLineCanvas = () => {
    const ctx: CanvasRenderingContext2D = canvasForUnfinishedLine.getContext('2d')
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)
  }
  const drawUnfinishedLine = (unfinishedLine: Line) => {
    clearUnfinishedLineCanvas()
    const ctx: CanvasRenderingContext2D = canvasForUnfinishedLine.getContext('2d')
    let method = drawMethods[currentDrawMethod]
    if (!method) {
      console.warn('Draw method not found, fallback to default')
      method = drawLine
    }
    method(ctx, unfinishedLine)
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

  class TouchScaleController {
    isDown = false
    touchIdentifiers: [number, number]
    initialPoints: [GlobalPoint, GlobalPoint]
    previousPoints: [GlobalPoint, GlobalPoint]
    initialScale: number
    initialPanX: number
    initialPanY: number
    initialBasePoint: GlobalPoint

    onStart(touches: [Touch, Touch]) {
      this.isDown = true
      this.touchIdentifiers = touches.map((v) => v.identifier)
      this.initialPoints = touches.map((v) => getPointFromTouch(v))
      this.previousPoints = this.initialPoints
      this.initialScale = scale
      this.initialPanX = panX
      this.initialPanY = panY
      this.initialBasePoint = middlePoint(this.initialPoints[0], this.initialPoints[1])
    }

    onMove(changedTouches: Touch[]) {
      let newPoints: GlobalPoint[] = []
      {
        const touch = changedTouches.find((v) => v.identifier === this.touchIdentifiers[0])
        if (touch) {
          const point = getPointFromTouch(touch)
          newPoints.push(point)
        } else {
          newPoints.push(this.previousPoints[0])
        }
      }
      {
        const touch = changedTouches.find((v) => v.identifier === this.touchIdentifiers[1])
        if (touch) {
          const point = getPointFromTouch(touch)
          newPoints.push(point)
        } else {
          newPoints.push(this.previousPoints[1])
        }
      }
      const relativeScale = getDistance(newPoints[0], newPoints[1]) / getDistance(this.initialPoints[0], this.initialPoints[1])
      const deltaScale = relativeScale - 1
      const newScale = this.initialScale * relativeScale
      const basePoint: GlobalPoint = {
        x: (newPoints[0].x + newPoints[1].x) / 2,
        y: (newPoints[1].y + newPoints[0].y) / 2,
      }
      panX = this.initialPanX + (basePoint.x - this.initialBasePoint.x) / this.initialScale - (basePoint.x - canvasPixelWidth / 2) * deltaScale / newScale
      panY = this.initialPanY + (basePoint.y - this.initialBasePoint.y) / this.initialScale - (basePoint.y - canvasPixelHeight / 2) * deltaScale / newScale
      scale = newScale
      // console.log(scale, panX, panY)
      draw()
      this.previousPoints = newPoints
    }

    onEnd() {
      this.isDown = false
      this.touchIdentifiers = null
      this.initialPoints = null
    }
  }

  const touchScaleController = new TouchScaleController()

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
    // console.log(event)
    const deltaScale = -(event.deltaY / 100)
    scaleBy(deltaScale, getPointFromEvent(event))
  }
  const handleTouchstart = (event: TouchEvent) => {
    // console.log(event)
    const touches = Array.from(event.touches)
    if (stylusOnlyMode) {
      const stylusTool = toolsMap.get(currentToolName)
      const directTool = toolsMap.get('pan')
      if (!stylusTool.isDown) {
        const stylusTouch = [...event.changedTouches].find(
          (touch: Touch) => touch.touchType === 'stylus',
        )
        stylusTouch && stylusTool.onTouchstart(stylusTouch)
      }
      if (touches.filter((v) => v.touchType === 'direct').length === 2) {
        if (directTool.isDown) {
          const directTouch = touches.find(
            (touch: Touch) => touch.touchType === 'direct' && touch.identifier === directTool.touchIdentifier,
          )
          directTool.onTouchend(directTouch)
        }
        touchScaleController.onStart(touches.filter((v) => v.touchType === 'direct'))
      } else if (!directTool.isDown) {
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
      if (touchScaleController.isDown) {
        touchScaleController.onMove(changedTouches)
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
    // console.log(event)
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
      if (touchScaleController.isDown && changedTouches.find((v) => touchScaleController.touchIdentifiers.includes(v.identifier))) {
        touchScaleController.onEnd()
        if (!directTool.isDown) {
          const directTouch = Array.from(event.touches).find(
            (touch: Touch) => touch.touchType === 'direct' && !changedTouches.find((v) => v.identifier === touch.identifier),
          )
          directTouch && directTool.onTouchstart(directTouch)
        }
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
          try {
            lines.push(JSON.parse(stroke.content))
          } catch (e) {
            console.warn("Unable to parse stroke")
            console.warn(stroke.content)
          }
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

  const resetScale = () => {
    scale = 1
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
    class="canvas"
    id="canvas"
    bind:this={canvas}
    width={canvasWidth}
    height={canvasHeight}
    style="width: {canvasPixelWidth}px; height: {canvasPixelHeight}px"
  />
  <canvas
    class="canvas"
    bind:this={canvasForUnfinishedLine}
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
    <label>
      Color: {lineColor}
      <input type="color" bind:value={lineColor}/>
    </label>
    <label>
      Width:
      <select bind:value={lineWidth}>
        <option value={0.25}>1/4</option>
        <option value={0.5}>1/2</option>
        <option value={1}>1</option>
        <option value={2}>2</option>
        <option value={3}>3</option>
        <option value={4}>4</option>
        <option value={5}>5</option>
      </select>
    </label>
    <label>
      Scale insensitive line width
      <input type="checkbox" bind:checked={widthScaleInsensitive} on:change={draw}/>
    </label>
    <span>Scale: {(scale * 100).toFixed(0)}% <button on:click={resetScale}>100%</button></span>
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

  .canvas
    position fixed
    left 0
    top 0
</style>

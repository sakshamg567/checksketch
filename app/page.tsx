"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import html2canvas from "html2canvas"

interface CheckboxGrid {
  rows: number
  cols: number
  data: boolean[][]
}

interface VideoFrame {
  grid: CheckboxGrid
  timestamp: number
  frameIndex: number
}

export default function CheckboxSketchTool() {
  const [resolution, setResolution] = useState<number>(80)
  const [threshold, setThreshold] = useState<number>(150)
  const [grid, setGrid] = useState<CheckboxGrid | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [exportSize, setExportSize] = useState<number>(8)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [maintainAspectRatio, setMaintainAspectRatio] = useState<boolean>(true)

  // Video states
  const [isVideo, setIsVideo] = useState(false)
  const [videoFrames, setVideoFrames] = useState<VideoFrame[]>([])
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [videoDuration, setVideoDuration] = useState(0)
  const [fps, setFps] = useState(30)
  const [isExportingVideo, setIsExportingVideo] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [processingProgress, setProcessingProgress] = useState(0)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const checkboxGridRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const animationFrameRef = useRef<number>()
  const videoCanvasRef = useRef<HTMLCanvasElement>(null)
  const workerRef = useRef<Worker>()

  // Initialize Web Worker
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // For now, let's use a simpler approach without Web Workers to get it working
      // We'll add Web Workers in the next iteration
    }
  }, [])

  const processImage = useCallback(
    (file: File) => {
      setIsProcessing(true)
      setGrid(null)

      const img = new Image()
      img.crossOrigin = "anonymous"

      img.onload = () => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext("2d")
        if (!ctx) return

        let canvasWidth = resolution
        let canvasHeight = resolution

        if (maintainAspectRatio) {
          const imgAspectRatio = img.width / img.height
          const targetAspectRatio = 1

          if (imgAspectRatio > targetAspectRatio) {
            canvasWidth = resolution
            canvasHeight = Math.round(resolution / imgAspectRatio)
          } else {
            canvasWidth = Math.round(resolution * imgAspectRatio)
            canvasHeight = resolution
          }
        }

        canvas.width = canvasWidth
        canvas.height = canvasHeight

        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, canvasWidth, canvasHeight)
        ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight)

        const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight)
        const data = imageData.data

        const newGrid: boolean[][] = []

        for (let y = 0; y < canvasHeight; y++) {
          const row: boolean[] = []
          for (let x = 0; x < canvasWidth; x++) {
            const index = (y * canvasWidth + x) * 4
            const r = data[index]
            const g = data[index + 1]
            const b = data[index + 2]

            const grayscale = (r + g + b) / 3
            const isDark = grayscale < threshold

            row.push(isDark)
          }
          newGrid.push(row)
        }

        setGrid({
          rows: canvasHeight,
          cols: canvasWidth,
          data: newGrid,
        })
        setIsProcessing(false)
      }

      img.src = URL.createObjectURL(file)
    },
    [resolution, threshold, maintainAspectRatio],
  )

  const reprocessImage = useCallback(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    const newGrid: boolean[][] = []

    for (let y = 0; y < canvas.height; y++) {
      const row: boolean[] = []
      for (let x = 0; x < canvas.width; x++) {
        const index = (y * canvas.width + x) * 4
        const r = data[index]
        const g = data[index + 1]
        const b = data[index + 2]

        const grayscale = (r + g + b) / 3
        const isDark = grayscale < threshold

        row.push(isDark)
      }
      newGrid.push(row)
    }

    setGrid({
      rows: canvas.height,
      cols: canvas.width,
      data: newGrid,
    })
  }, [threshold])

  const toggleCheckbox = useCallback((row: number, col: number) => {
    setGrid((prevGrid) => {
      if (!prevGrid) return null

      const newData = prevGrid.data.map((r, rowIndex) =>
        r.map((cell, colIndex) => (rowIndex === row && colIndex === col ? !cell : cell)),
      )

      return {
        ...prevGrid,
        data: newData,
      }
    })
  }, [])

  const invertColors = useCallback(() => {
    setGrid((prevGrid) => {
      if (!prevGrid) return null

      const newData = prevGrid.data.map((row) => row.map((cell) => !cell))

      return {
        ...prevGrid,
        data: newData,
      }
    })
  }, [])

  const clearGrid = useCallback(() => {
    setGrid(null)
    setUploadedFile(null)
    setIsVideo(false)
    setVideoFrames([])
  }, [])

  const autoOptimizeThreshold = useCallback(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    let totalBrightness = 0
    const pixelCount = canvas.width * canvas.height

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const grayscale = (r + g + b) / 3
      totalBrightness += grayscale
    }

    const averageBrightness = totalBrightness / pixelCount
    setThreshold(Math.round(averageBrightness))
  }, [])

  const saveAsImage = useCallback(() => {
    if (!grid) return

    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = grid.cols * exportSize
    canvas.height = grid.rows * exportSize

    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = "#000000"
    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.cols; x++) {
        if (grid.data[y][x]) {
          ctx.fillRect(x * exportSize, y * exportSize, exportSize, exportSize)
        }
      }
    }

    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "checkbox-sketch.png"
        a.click()
        URL.revokeObjectURL(url)
      }
    })
  }, [grid, exportSize])

  const saveAsCheckboxImage = useCallback(async () => {
    if (!grid || !checkboxGridRef.current) return

    try {
      const canvas = await html2canvas(checkboxGridRef.current, {
        backgroundColor: "#f9f9f9",
        scale: 2,
        useCORS: true,
      })

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = "checkbox-sketch-checkboxes.png"
          a.click()
          URL.revokeObjectURL(url)
        }
      })
    } catch (error) {
      console.error("Error capturing checkbox image:", error)
    }
  }, [grid])

  // Simple video processing without Web Workers for now
  const processVideo = useCallback(async (file: File) => {
    setIsProcessing(true)
    setIsVideo(true)
    setVideoFrames([])
    setCurrentFrameIndex(0)
    setIsPlaying(false)
    setProcessingProgress(0)

    const video = videoRef.current
    if (!video) return

    video.src = URL.createObjectURL(file)

    await new Promise<void>((resolve) => {
      video.onloadedmetadata = () => {
        setVideoDuration(video.duration)
        resolve()
      }
    })

    // Simple frame extraction for now
    const frames: VideoFrame[] = []
    const frameInterval = 1000 / fps
    const totalFrames = Math.floor(video.duration * fps)

    for (let i = 0; i < totalFrames; i++) {
      const timestamp = (i * frameInterval) / 1000
      video.currentTime = timestamp

      await new Promise<void>((resolve) => {
        video.onseeked = () => {
          const canvas = videoCanvasRef.current
          if (!canvas) {
            resolve()
            return
          }

          const ctx = canvas.getContext("2d")
          if (!ctx) {
            resolve()
            return
          }

          let canvasWidth = resolution
          let canvasHeight = resolution

          if (maintainAspectRatio) {
            const videoAspectRatio = video.videoWidth / video.videoHeight
            if (videoAspectRatio > 1) {
              canvasWidth = resolution
              canvasHeight = Math.round(resolution / videoAspectRatio)
            } else {
              canvasWidth = Math.round(resolution * videoAspectRatio)
              canvasHeight = resolution
            }
          }

          canvas.width = canvasWidth
          canvas.height = canvasHeight

          ctx.fillStyle = "#ffffff"
          ctx.fillRect(0, 0, canvasWidth, canvasHeight)
          ctx.drawImage(video, 0, 0, canvasWidth, canvasHeight)

          const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight)
          const data = imageData.data

          const grid: boolean[][] = []

          for (let y = 0; y < canvasHeight; y++) {
            const row: boolean[] = []
            for (let x = 0; x < canvasWidth; x++) {
              const index = (y * canvasWidth + x) * 4
              const r = data[index]
              const g = data[index + 1]
              const b = data[index + 2]

              const grayscale = (r + g + b) / 3
              const isDark = grayscale < threshold

              row.push(isDark)
            }
            grid.push(row)
          }

          frames.push({
            grid: {
              rows: canvasHeight,
              cols: canvasWidth,
              data: grid,
            },
            timestamp,
            frameIndex: i
          })

          setProcessingProgress((i / totalFrames) * 100)
          resolve()
        }
      })
    }

    setVideoFrames(frames)
    if (frames.length > 0) {
      setGrid(frames[0].grid)
    }
    setIsProcessing(false)
    setProcessingProgress(0)
  }, [fps, resolution, threshold, maintainAspectRatio])

  const playVideo = useCallback(() => {
    if (videoFrames.length === 0) return

    setIsPlaying(true)
    let startTime = Date.now()
    const frameInterval = 1000 / fps

    const animate = () => {
      const elapsed = Date.now() - startTime
      const frameIndex = Math.floor((elapsed / frameInterval) % videoFrames.length)

      setCurrentFrameIndex(frameIndex)
      setGrid(videoFrames[frameIndex].grid)

      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(animate)
      }
    }

    animate()
  }, [videoFrames, fps, isPlaying])

  const pauseVideo = useCallback(() => {
    setIsPlaying(false)
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
  }, [])

  const seekToFrame = useCallback((frameIndex: number) => {
    if (frameIndex >= 0 && frameIndex < videoFrames.length) {
      setCurrentFrameIndex(frameIndex)
      setGrid(videoFrames[frameIndex].grid)
    }
  }, [videoFrames])

  const exportVideo = useCallback(async () => {
    if (videoFrames.length === 0) return

    setIsExportingVideo(true)
    setExportProgress(0)

    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const firstFrame = videoFrames[0].grid
    canvas.width = firstFrame.cols * exportSize
    canvas.height = firstFrame.rows * exportSize

    const stream = canvas.captureStream(fps)
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp9"
    })

    const chunks: Blob[] = []
    mediaRecorder.ondataavailable = (event) => {
      chunks.push(event.data)
    }

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "checkbox-video.webm"
      a.click()
      URL.revokeObjectURL(url)
      setIsExportingVideo(false)
      setExportProgress(0)
    }

    mediaRecorder.start()

    // Use requestAnimationFrame for precise timing
    const frameInterval = 1000 / fps
    let frameIndex = 0
    let lastFrameTime = 0

    const renderFrame = (currentTime: number) => {
      if (frameIndex >= videoFrames.length) {
        mediaRecorder.stop()
        return
      }

      // Check if enough time has passed for the next frame
      if (currentTime - lastFrameTime >= frameInterval) {
        const frame = videoFrames[frameIndex]

        // Clear canvas
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // Draw checkboxes
        ctx.fillStyle = "#000000"
        for (let y = 0; y < frame.grid.rows; y++) {
          for (let x = 0; x < frame.grid.cols; x++) {
            if (frame.grid.data[y][x]) {
              ctx.fillRect(x * exportSize, y * exportSize, exportSize, exportSize)
            }
          }
        }

        setExportProgress((frameIndex / videoFrames.length) * 100)

        frameIndex++
        lastFrameTime = currentTime
      }

      requestAnimationFrame(renderFrame)
    }

    requestAnimationFrame(renderFrame)
  }, [videoFrames, fps, exportSize])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.type.startsWith("image/")) {
      setIsVideo(false)
      setUploadedFile(file)
      processImage(file)
    } else if (file.type.startsWith("video/")) {
      setUploadedFile(file)
      processVideo(file)
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  // Load rickroll.jpg as default placeholder
  useEffect(() => {
    if (!grid && !uploadedFile) {
      const img = new Image()
      img.crossOrigin = "anonymous"

      img.onload = () => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext("2d")
        if (!ctx) return

        let canvasWidth = resolution
        let canvasHeight = resolution

        if (maintainAspectRatio) {
          const imgAspectRatio = img.width / img.height
          const targetAspectRatio = 1

          if (imgAspectRatio > targetAspectRatio) {
            canvasWidth = resolution
            canvasHeight = Math.round(resolution / imgAspectRatio)
          } else {
            canvasWidth = Math.round(resolution * imgAspectRatio)
            canvasHeight = resolution
          }
        }

        canvas.width = canvasWidth
        canvas.height = canvasHeight

        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, canvasWidth, canvasHeight)
        ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight)

        const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight)
        const data = imageData.data

        const newGrid: boolean[][] = []

        for (let y = 0; y < canvasHeight; y++) {
          const row: boolean[] = []
          for (let x = 0; x < canvasWidth; x++) {
            const index = (y * canvasWidth + x) * 4
            const r = data[index]
            const g = data[index + 1]
            const b = data[index + 2]

            const grayscale = (r + g + b) / 3
            const isDark = grayscale < threshold

            row.push(isDark)
          }
          newGrid.push(row)
        }

        setGrid({
          rows: canvasHeight,
          cols: canvasWidth,
          data: newGrid,
        })
      }

      img.src = "/rickroll.jpg"
    }
  }, [resolution, maintainAspectRatio, uploadedFile])

  // Handle threshold changes for uploaded files (both images and videos)
  useEffect(() => {
    if (uploadedFile && grid) {
      if (isVideo && videoFrames.length > 0) {
        // Reprocess video frames with new threshold
        reprocessVideoWithNewThreshold()
      } else {
        // Reprocess image with new threshold
        reprocessImage()
      }
    }
  }, [threshold, uploadedFile, isVideo, videoFrames.length])

  // Function to reprocess video frames with new threshold
  const reprocessVideoWithNewThreshold = useCallback(() => {
    if (videoFrames.length === 0) return

    const reprocessedFrames: VideoFrame[] = videoFrames.map(frame => {
      // Create a temporary canvas to reprocess the frame
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!

      // Set canvas size to match the frame grid
      canvas.width = frame.grid.cols
      canvas.height = frame.grid.rows

      // Draw the current frame as pixels
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.fillStyle = "#000000"
      for (let y = 0; y < frame.grid.rows; y++) {
        for (let x = 0; x < frame.grid.cols; x++) {
          if (frame.grid.data[y][x]) {
            ctx.fillRect(x, y, 1, 1)
          }
        }
      }

      // Get image data and reprocess with new threshold
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data

      const newGrid: boolean[][] = []

      for (let y = 0; y < canvas.height; y++) {
        const row: boolean[] = []
        for (let x = 0; x < canvas.width; x++) {
          const index = (y * canvas.width + x) * 4
          const r = data[index]
          const g = data[index + 1]
          const b = data[index + 2]

          const grayscale = (r + g + b) / 3
          const isDark = grayscale < threshold

          row.push(isDark)
        }
        newGrid.push(row)
      }

      return {
        ...frame,
        grid: {
          rows: canvas.height,
          cols: canvas.width,
          data: newGrid
        }
      }
    })

    setVideoFrames(reprocessedFrames)

    // Update current frame if playing
    if (currentFrameIndex < reprocessedFrames.length) {
      setGrid(reprocessedFrames[currentFrameIndex].grid)
    }
  }, [videoFrames, threshold, currentFrameIndex])

  // Separate useEffect for placeholder threshold changes
  useEffect(() => {
    if (!uploadedFile && grid && canvasRef.current) {
      // Only reprocess placeholder when threshold changes and no file is uploaded
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data

      const newGrid: boolean[][] = []

      for (let y = 0; y < canvas.height; y++) {
        const row: boolean[] = []
        for (let x = 0; x < canvas.width; x++) {
          const index = (y * canvas.width + x) * 4
          const r = data[index]
          const g = data[index + 1]
          const b = data[index + 2]

          const grayscale = (r + g + b) / 3
          const isDark = grayscale < threshold

          row.push(isDark)
        }
        newGrid.push(row)
      }

      setGrid({
        rows: canvas.height,
        cols: canvas.width,
        data: newGrid,
      })
    }
  }, [threshold, uploadedFile])

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Checkbox Sketch Tool</h1>
          <p className="text-gray-600">Upload an image or video and convert it to a checkbox sketch</p>
        </div>

        <Card className="p-6 mb-8">
          <div className="flex flex-col items-center gap-4">
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Resolution Controls */}
            <div className="flex flex-col items-center gap-2">
              <label className="text-sm font-medium">Resolution</label>
              <div className="flex gap-2">
                <Button variant={resolution === 30 ? "default" : "outline"} size="sm" onClick={() => setResolution(30)}>
                  Low (30×30)
                </Button>
                <Button variant={resolution === 50 ? "default" : "outline"} size="sm" onClick={() => setResolution(50)}>
                  Medium (50×50)
                </Button>
                <Button variant={resolution === 80 ? "default" : "outline"} size="sm" onClick={() => setResolution(80)}>
                  High (80×80)
                </Button>
              </div>
            </div>

            {/* Aspect Ratio Controls */}
            <div className="flex flex-col items-center gap-2">
              <label className="text-sm font-medium">Aspect Ratio</label>
              <div className="flex gap-2">
                <Button
                  variant={!maintainAspectRatio ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMaintainAspectRatio(false)}
                >
                  Square
                </Button>
                <Button
                  variant={maintainAspectRatio ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMaintainAspectRatio(true)}
                >
                  Original
                </Button>
              </div>
            </div>

            {/* Video FPS Control */}
            {isVideo && (
              <div className="flex flex-col items-center gap-2">
                <label className="text-sm font-medium">Video FPS</label>
                <div className="flex gap-2">
                  <Button variant={fps === 15 ? "default" : "outline"} size="sm" onClick={() => setFps(15)}>
                    15 FPS
                  </Button>
                  <Button variant={fps === 30 ? "default" : "outline"} size="sm" onClick={() => setFps(30)}>
                    30 FPS
                  </Button>
                  <Button variant={fps === 60 ? "default" : "outline"} size="sm" onClick={() => setFps(60)}>
                    60 FPS
                  </Button>
                </div>
              </div>
            )}

            {/* Brightness Threshold */}
            <div className="flex flex-col items-center gap-2">
              <label className="text-sm font-medium">Brightness Threshold</label>
              <div className="flex items-center gap-3 w-full max-w-xs">
                <span className="text-xs text-gray-500">Dark</span>
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-xs text-gray-500">Light</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{threshold}/255</span>
                {canvasRef.current && (
                  <Button size="sm" variant="ghost" onClick={autoOptimizeThreshold}>
                    Auto
                  </Button>
                )}
              </div>
            </div>

            {/* Processing Progress */}
            {isProcessing && (
              <div className="w-full max-w-md">
                <div className="flex justify-between text-sm mb-2">
                  <span>Processing {isVideo ? 'video' : 'image'}...</span>
                  <span>{Math.round(processingProgress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${processingProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Upload Button */}
            <Button onClick={handleUploadClick} disabled={isProcessing} size="lg">
              {isProcessing ? "Processing..." : "Upload Image/Video"}
            </Button>

            {/* Video Controls */}
            {isVideo && videoFrames.length > 0 && (
              <div className="flex flex-col items-center gap-4 w-full max-w-md">
                {/* Video Timeline */}
                <div className="w-full">
                  <input
                    type="range"
                    min="0"
                    max={videoFrames.length - 1}
                    value={currentFrameIndex}
                    onChange={(e) => seekToFrame(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Frame {currentFrameIndex + 1} / {videoFrames.length}</span>
                    <span>{((currentFrameIndex / videoFrames.length) * videoDuration).toFixed(1)}s / {videoDuration.toFixed(1)}s</span>
                  </div>
                </div>

                {/* Playback Controls */}
                <div className="flex gap-2">
                  <Button
                    onClick={isPlaying ? pauseVideo : playVideo}
                    variant="outline"
                    size="sm"
                  >
                    {isPlaying ? "Pause" : "Play"}
                  </Button>
                  <Button
                    onClick={() => seekToFrame(0)}
                    variant="outline"
                    size="sm"
                  >
                    Reset
                  </Button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {grid && (
              <div className="flex flex-wrap gap-2 justify-center">
                <Button onClick={invertColors} variant="outline" size="sm">
                  Invert Colors
                </Button>
                <Button onClick={clearGrid} variant="outline" size="sm">
                  Clear
                </Button>
                <div className="flex items-center gap-2">
                  <label className="text-xs">Export size:</label>
                  <select
                    value={exportSize}
                    onChange={(e) => setExportSize(Number(e.target.value))}
                    className="text-xs border rounded px-1"
                  >
                    <option value={4}>Small</option>
                    <option value={8}>Medium</option>
                    <option value={16}>Large</option>
                  </select>
                </div>
                <Button onClick={saveAsImage} variant="outline" size="sm">
                  Save as Pixels
                </Button>
                <Button onClick={saveAsCheckboxImage} variant="outline" size="sm">
                  Save as Checkboxes
                </Button>
                {isVideo && (
                  <Button
                    onClick={exportVideo}
                    variant="outline"
                    size="sm"
                    disabled={isExportingVideo}
                  >
                    {isExportingVideo ? `Exporting ${Math.round(exportProgress)}%` : "Export Video"}
                  </Button>
                )}
              </div>
            )}

            <p className="text-sm text-gray-500">Supports JPG, PNG, GIF, WebP, MP4, WebM, MOV</p>
          </div>
        </Card>

        {/* Checkbox Grid Display */}
        {grid && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 text-center">
              {isVideo ? "Video Checkbox Sketch" : "Checkbox Sketch"}
            </h2>
            <div className="overflow-auto">
              <div className="flex justify-center">
                <div
                  ref={checkboxGridRef}
                  className="inline-grid gap-0 border"
                  style={{
                    gridTemplateColumns: `repeat(${grid.cols}, 1fr)`,
                    backgroundColor: "#f9f9f9",
                  }}
                >
                  {grid.data.map((row, rowIndex) =>
                    row.map((isChecked, colIndex) => (
                      <input
                        key={`${rowIndex}-${colIndex}`}
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCheckbox(rowIndex, colIndex)}
                        className="w-2 h-2 cursor-pointer hover:scale-110 transition-transform"
                        style={{ margin: "0.5px" }}
                      />
                    )),
                  )}
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-500 text-center mt-4">
              {isVideo
                ? `Frame ${currentFrameIndex + 1} of ${videoFrames.length} • Click checkboxes to edit current frame`
                : "Click checkboxes to manually edit • Checked = dark pixels, unchecked = background"
              }
            </p>
          </Card>
        )}

        {/* Hidden elements */}
        <canvas ref={canvasRef} className="hidden" />
        <canvas ref={videoCanvasRef} className="hidden" />
        <video ref={videoRef} className="hidden" />
      </div>
    </div>
  )
}

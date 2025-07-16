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

export default function CheckboxSketchTool() {
  const [resolution, setResolution] = useState<number>(80)
  const [threshold, setThreshold] = useState<number>(150)
  const [grid, setGrid] = useState<CheckboxGrid | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [exportSize, setExportSize] = useState<number>(8)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [maintainAspectRatio, setMaintainAspectRatio] = useState<boolean>(true)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const checkboxGridRef = useRef<HTMLDivElement>(null)

  const processImage = useCallback(
    (file: File) => {
      setIsProcessing(true)
      // Clear any existing grid (including placeholder)
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
          // Calculate dimensions to maintain aspect ratio
          const imgAspectRatio = img.width / img.height
          const targetAspectRatio = 1 // square

          if (imgAspectRatio > targetAspectRatio) {
            // Image is wider than square
            canvasWidth = resolution
            canvasHeight = Math.round(resolution / imgAspectRatio)
          } else {
            // Image is taller than square
            canvasWidth = Math.round(resolution * imgAspectRatio)
            canvasHeight = resolution
          }
        }

        // Set canvas size
        canvas.width = canvasWidth
        canvas.height = canvasHeight

        // Clear canvas with white background
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, canvasWidth, canvasHeight)

        // Draw and scale image to canvas
        ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight)

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight)
        const data = imageData.data

        // Convert to checkbox grid (inverted logic)
        const newGrid: boolean[][] = []

        for (let y = 0; y < canvasHeight; y++) {
          const row: boolean[] = []
          for (let x = 0; x < canvasWidth; x++) {
            const index = (y * canvasWidth + x) * 4
            const r = data[index]
            const g = data[index + 1]
            const b = data[index + 2]

            // Convert to grayscale and determine if it's dark (inverted)
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

    // Get existing image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    // Convert to checkbox grid with new threshold
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
  }, [])

  const autoOptimizeThreshold = useCallback(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const imageData = ctx.getImageData(0, 0, resolution, resolution)
    const data = imageData.data

    // Calculate average brightness
    let totalBrightness = 0
    const pixelCount = resolution * resolution

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const grayscale = (r + g + b) / 3
      totalBrightness += grayscale
    }

    const averageBrightness = totalBrightness / pixelCount
    setThreshold(Math.round(averageBrightness))
  }, [resolution])

  const saveAsImage = useCallback(() => {
    if (!grid) return

    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = grid.cols * exportSize
    canvas.height = grid.rows * exportSize

    // Fill background (unchecked boxes)
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw checked boxes
    ctx.fillStyle = "#000000"
    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.cols; x++) {
        if (grid.data[y][x]) {
          ctx.fillRect(x * exportSize, y * exportSize, exportSize, exportSize)
        }
      }
    }

    // Download the image
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
        scale: 2, // Higher resolution
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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith("image/")) {
      setUploadedFile(file)
      processImage(file)
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  useEffect(() => {
    if (grid && canvasRef.current) {
      reprocessImage()
    }
  }, [threshold, reprocessImage])

  // Add new useEffect to reprocess image when resolution changes
  useEffect(() => {
    if (uploadedFile) {
      processImage(uploadedFile)
    }
  }, [resolution, uploadedFile, processImage])

  // Load rickroll.jpg as default placeholder
  useEffect(() => {
    if (!grid) {
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
          // Calculate dimensions to maintain aspect ratio
          const imgAspectRatio = img.width / img.height
          const targetAspectRatio = 1 // square

          if (imgAspectRatio > targetAspectRatio) {
            // Image is wider than square
            canvasWidth = resolution
            canvasHeight = Math.round(resolution / imgAspectRatio)
          } else {
            // Image is taller than square
            canvasWidth = Math.round(resolution * imgAspectRatio)
            canvasHeight = resolution
          }
        }

        // Set canvas size
        canvas.width = canvasWidth
        canvas.height = canvasHeight

        // Clear canvas with white background
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, canvasWidth, canvasHeight)

        // Draw and scale image to canvas
        ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight)

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight)
        const data = imageData.data

        // Convert to checkbox grid (inverted logic)
        const newGrid: boolean[][] = []

        for (let y = 0; y < canvasHeight; y++) {
          const row: boolean[] = []
          for (let x = 0; x < canvasWidth; x++) {
            const index = (y * canvasWidth + x) * 4
            const r = data[index]
            const g = data[index + 1]
            const b = data[index + 2]

            // Convert to grayscale and determine if it's dark (inverted)
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
  }, [resolution, threshold, maintainAspectRatio])

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Checkbox Sketch Tool</h1>
          <p className="text-gray-600">Upload an image and convert it to a checkbox sketch</p>
        </div>

        <Card className="p-6 mb-8">
          <div className="flex flex-col items-center gap-4">
            <Input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

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

            <Button onClick={handleUploadClick} disabled={isProcessing} size="lg">
              {isProcessing ? "Processing..." : "Upload Image"}
            </Button>

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
              </div>
            )}

            <p className="text-sm text-gray-500">Supports JPG, PNG, GIF, WebP</p>
          </div>
        </Card>

        {grid && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 text-center">Checkbox Sketch</h2>
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
              {!canvasRef.current
                ? "Example placeholder pattern • Upload an image to get started"
                : "Click checkboxes to manually edit • Checked = dark pixels, unchecked = background"}
            </p>
          </Card>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  )
}

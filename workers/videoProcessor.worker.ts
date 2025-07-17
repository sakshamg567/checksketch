// Video Processing Web Worker
interface VideoFrameData {
   imageData: ImageData
   timestamp: number
   frameIndex: number
}

interface ProcessedFrame {
   grid: boolean[][]
   timestamp: number
   frameIndex: number
}

interface WorkerMessage {
   type: 'processVideo'
   data: {
      frames: VideoFrameData[]
      resolution: number
      threshold: number
      maintainAspectRatio: boolean
   }
}

interface WorkerResponse {
   type: 'processedFrames'
   data: ProcessedFrame[]
}

// Process a single frame
function processFrame(
   imageData: ImageData,
   resolution: number,
   threshold: number,
   maintainAspectRatio: boolean
): boolean[][] {
   const { width, height, data } = imageData

   let canvasWidth = resolution
   let canvasHeight = resolution

   if (maintainAspectRatio) {
      const aspectRatio = width / height
      if (aspectRatio > 1) {
         canvasWidth = resolution
         canvasHeight = Math.round(resolution / aspectRatio)
      } else {
         canvasWidth = Math.round(resolution * aspectRatio)
         canvasHeight = resolution
      }
   }

   // Create a temporary canvas for resizing
   const canvas = new OffscreenCanvas(canvasWidth, canvasHeight)
   const ctx = canvas.getContext('2d')!

   // Create ImageData for the resized frame
   const resizedImageData = new ImageData(canvasWidth, canvasHeight)

   // Simple nearest-neighbor scaling (can be improved with bilinear interpolation)
   for (let y = 0; y < canvasHeight; y++) {
      for (let x = 0; x < canvasWidth; x++) {
         const srcX = Math.floor((x / canvasWidth) * width)
         const srcY = Math.floor((y / canvasHeight) * height)

         const srcIndex = (srcY * width + srcX) * 4
         const dstIndex = (y * canvasWidth + x) * 4

         resizedImageData.data[dstIndex] = data[srcIndex]     // R
         resizedImageData.data[dstIndex + 1] = data[srcIndex + 1] // G
         resizedImageData.data[dstIndex + 2] = data[srcIndex + 2] // B
         resizedImageData.data[dstIndex + 3] = data[srcIndex + 3] // A
      }
   }

   // Convert to checkbox grid
   const grid: boolean[][] = []

   for (let y = 0; y < canvasHeight; y++) {
      const row: boolean[] = []
      for (let x = 0; x < canvasWidth; x++) {
         const index = (y * canvasWidth + x) * 4
         const r = resizedImageData.data[index]
         const g = resizedImageData.data[index + 1]
         const b = resizedImageData.data[index + 2]

         const grayscale = (r + g + b) / 3
         const isDark = grayscale < threshold

         row.push(isDark)
      }
      grid.push(row)
   }

   return grid
}

// Handle messages from main thread
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
   const { type, data } = event.data

   if (type === 'processVideo') {
      const { frames, resolution, threshold, maintainAspectRatio } = data

      // Process frames in parallel using Promise.all
      const processedFrames: ProcessedFrame[] = []

      // Process frames in batches to avoid overwhelming the worker
      const batchSize = 10
      const processBatch = async (startIndex: number) => {
         const endIndex = Math.min(startIndex + batchSize, frames.length)
         const batch = frames.slice(startIndex, endIndex)

         const batchResults = await Promise.all(
            batch.map(async (frame) => {
               const grid = processFrame(
                  frame.imageData,
                  resolution,
                  threshold,
                  maintainAspectRatio
               )

               return {
                  grid,
                  timestamp: frame.timestamp,
                  frameIndex: frame.frameIndex
               }
            })
         )

         processedFrames.push(...batchResults)

         // Report progress
         self.postMessage({
            type: 'progress',
            data: {
               processed: processedFrames.length,
               total: frames.length,
               percentage: (processedFrames.length / frames.length) * 100
            }
         })

         // Process next batch if available
         if (endIndex < frames.length) {
            // Use setTimeout to allow other tasks to run
            setTimeout(() => processBatch(endIndex), 0)
         } else {
            // All frames processed
            const response: WorkerResponse = {
               type: 'processedFrames',
               data: processedFrames.sort((a, b) => a.frameIndex - b.frameIndex)
            }
            self.postMessage(response)
         }
      }

      // Start processing
      processBatch(0)
   }
}

export { } 
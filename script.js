/**
 * Waveground is an audiovisual interactive installation on particle-wave duality
 * Have fun interacting!
 * (careful with your precious ears, turn sound low)
 */

let mode = 1 // 1 to 5

let cycleMode = (step) => {
  const modes = 5
  mode = ((mode - 1 + step + modes) % modes) + 1
  start()
}

// Common base for exposed parameters
const baseParams = {
  gridDimension: 80, // dim - Ready for some CPU sweat?
  population: 2000, // pop - Particles population
  fieldDiffusion: 30, // Dp - Amplitude of diffusion
  fieldDiffusionTau: 100, // τp - Typical time of diffusion
  viscosity1: 5, // ν1 - Physical viscosity
  viscosity3: 5, // ν3 - Physical viscosity for cube of field
  numericalIntensityViscosity: 0, // η_i Numerical relaxation 1
  numericalVariationViscosity: 0, // η_v Numerical relaxation 2
  injectionAmplitude: 1, // Mouse/rain injection
  raindropsPerStep: 0, // Spontaneous random injection on grid (raindrops)
  particlesPosDiffusion: 0, // Dp - Brownian position
  particlesRotDiffusion: .1, // Dr - Brownian rotation
  particlesSelfPropulsionSpeed: 0, // v0 - Self propulsion speed
  particlesRotCoupling: -10, // ω - Angular sensitivity to field
  particlesGradCoupling: 10, // µ - Motion sensitivity to field
  particlesEnergyTau: 20, // τu - La moutarde monte au nez
  particlesEnergyCoupling: 20, // λ - Encore plus avec le champ là
  activateEnergyRelease: true,
  particlesEnergyInjection: 80, // Inject only a portion to grid
  energyThresholdStochasticity: 0, // α [0, 1]
  neighborMode: "vn2", // "vn1", "vn2h", "moo1"
  minGridValue: -1, // Clamp grid values (explosion protect)
  maxGridValue: 1, // Clamp grid values (explosion protect)
  wallPotentialScale: 1, // σ - Particles sensitivity to walls
  wallType: 0, // 0 is empty, 1 is middle square, 2 and 3 are slits
  wallCage: false,
  drawGrid: true,
  drawParticles: true,
  drawParticlesPartners: false,
  audioEnableParticles: false,
  audioEnableBasicGrid: false,
  audioEnableRawGrid: false,
  audioEnableFft: false,
  modeName: "base"
}
let params = structuredClone(baseParams)
let updateModeParams = () => {
  params = structuredClone(baseParams)
  if (mode == 5) {
    // Slits
    params.modeName = "slits"
    params.wallCage = true
    params.wallType = 3
    params.population = 20
    params.particlesGradCoupling = 0
    params.particlesEnergyInjection = 3000
    params.fieldDiffusion = 800
    
    // Audio
    params.audioEnableParticles = false
    params.audioEnableBasicGrid = false
    params.audioEnableRawGrid = false
    params.audioEnableFft = true
  }
  if (mode == 4) {
    // Bouncing
    params.modeName = "bouncing"
    params.population = 6
    params.particlesPosDiffusion = 0
    params.particlesRotDiffusion = 0
    params.particlesSelfPropulsionSpeed = 2
    params.particlesGradCoupling = 50
    params.injectionAmplitude = 0.02 * baseParams.injectionAmplitude
    
    // Audio
    params.audioEnableParticles = false
    params.audioEnableBasicGrid = false
    params.audioEnableRawGrid = true
    params.audioEnableFft = false
  }
  if (mode == 3) {
    // Constellations
    params.modeName = "constellations"
    params.population = 3000
    params.drawParticlesPartners = true
    params.viscosity1 = 10
    
    // Audio
    params.audioEnableParticles = false
    params.audioEnableBasicGrid = true
    params.audioEnableRawGrid = true
    params.audioEnableFft = false
    
  }
  if (mode == 2) {
    // Rain
    params.modeName = "rain"
    params.raindropsPerStep = 1
    
    // Audio
    params.audioEnableParticles = true
    params.audioEnableBasicGrid = false
    params.audioEnableRawGrid = false
    params.audioEnableFft = true
  }
  if (mode == 1) {
    // Base
    params.modeName = "base"
    
    // Audio
    params.audioEnableParticles = false//true
    params.audioEnableBasicGrid = false//true
    params.audioEnableRawGrid = false
    params.audioEnableFft = true
  }
}
 
// Setup
let can1
let can2
let ctx1
let ctx2
let size
let setup = () => {
  let body = document.getElementsByTagName("body")[0]
  can1 = document.createElement("canvas")
  can2 = document.createElement("canvas")
  let dpr = window.devicePixelRatio
  can1.id = "can-1"
  can2.id = "can-2"
  ctx1 = can1.getContext("2d")
  ctx2 = can2.getContext("2d")
  size = Math.max(300, Math.min(0.85 * window.innerWidth, 0.85 * window.innerHeight))
  can1.width = size * dpr
  can1.height = size * dpr
  ctx1.scale(dpr, dpr)
  can1.style.width = size + "px"
  can1.style.height = size + "px"
  can1.width = size
  can1.height = size
  can2.width = size * dpr
  can2.height = size * dpr
  ctx2.scale(dpr, dpr)
  can2.style.width = size + "px"
  can2.style.height = size + "px"
  can2.width = size
  can2.height = size

  body.appendChild(can1)
  body.appendChild(can2)
}
setup()

// Simulation globals
let dt = 0.1
let step = 0
let deltaTms = 20 // updated deltaT for physics
const dim = params.gridDimension
let cellSize = size / dim
let audioMetrics = {
  iGridMax: 100,
  particlesTotalSpeed: 0
}
const vonNeumannNeighborhood1 = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0]
]
const mooreNeighborhood1 = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1]
]
const vonNeumannNeighborhood2hollow = [
  [0, -2],
  [1, -1],
  [2, 0],
  [1, 1],
  [0, 2],
  [-1, 1],
  [-2, 0],
  [-1, -1]
]
let remap = (value, sourceMin, sourceMax, targetMin, targetMax) => {
    return Math.min(targetMax, Math.max(targetMin, targetMin + (targetMax - targetMin) * (value - sourceMin) / (sourceMax - sourceMin)))
}
let getNormalRandoms = () => {
  // Generate gaussian random numbers (Box-Muller transform)
  let r1 = Math.random()
  let r2 = Math.random()
  let theta = 2 * Math.PI * r1
  let r = Math.sqrt(-2 * Math.log(r2))
  return [r * Math.cos(theta), r * Math.sin(theta)]
}

class Grid {
  constructor(initValue) {
    let grid = new Float32Array(dim * dim)
    for (let i = 0; i < dim * dim; i++) {
      grid[i] = initValue
    }
    this.grid = grid
  }
  getGridCXCY(x, y) {
    // Periodic check
    x = (x + 2 * size) % size
    y = (y + 2 * size) % size
    
    return { cx: Math.floor(x / cellSize), cy: Math.floor(y / cellSize) }
  }
  getGridIndex(x, y) {
    return Math.floor(y / cellSize) * dim + Math.floor(x / cellSize)
  }
  getGridXY(index) {
    let x = cellSize * (index % dim)
    let y = cellSize * (Math.floor(index / dim))
    return { x: x, y: y }
  }
  getNeighborPattern(mode) {
    return (mode == "vn1" ? vonNeumannNeighborhood1 : (mode == "vn2h" ? vonNeumannNeighborhood2hollow : mooreNeighborhood1))
  }
  getNeighborsIndexes(cx, cy, mode) {
    let indexes = []
    let pattern = this.getNeighborPattern(mode)
    
    pattern.forEach(p => {
      let neighIndex = ((cy + p[1] + dim) % dim) * dim + ((cx + p[0] + dim) % dim)
      indexes.push(neighIndex)
    })
    
    return indexes
  }
  getValue(cx, cy) {
    if (cx < 0 || cx > dim || cy < 0 || cy > dim) {
      console.error("Grid.getValue() given cell indexes are out of range")
    }
    let index = cy * dim + cx
    return this.grid[index]
  }
  getLocalLaplacian(cx, cy, mode) {
    let lap = 0
    let sumOfNorms = 0
    
    let intensity = this.getValue(cx, cy)
    let pattern = this.getNeighborPattern(mode)
    pattern.forEach(p => {
      // Get index of neighbor (careful close to edges)
      let neighIndex = ((cy + p[1] + dim) % dim) * dim + ((cx + p[0] + dim) % dim)
      
      // Get laplacian intensity & add to lap value
      let neighIntensity = this.grid[neighIndex] - intensity
      lap += neighIntensity
      
      // Increment sum of squared norms of cell-neighbor distance
      sumOfNorms += (Math.pow(p[0], 2) + Math.pow(p[1], 2)) * Math.pow(cellSize, 2)
    })
    
    // Divide by sum of squared norms of cell distance
    lap /= sumOfNorms
    
    // Double
    lap *= 2
    
    return lap
  }
  getLocalGradient(cx, cy, mode) {
    let grad = { x: 0, y: 0 }
    
    let pattern = this.getNeighborPattern(mode)
    pattern.forEach(p => {
      let neighIndex = ((cy + p[1] + dim) % dim) * dim + ((cx + p[0] + dim) % dim)
      let neighIntensity = this.grid[neighIndex] / pattern.length
      let neighVector = p
      grad.x += neighIntensity * neighVector[0] * cellSize
      grad.y += neighIntensity * neighVector[1] * cellSize
    })
    
    return grad
  }
  setValue(x, y, val) {
    let index = this.getGridIndex(x, y)
    this.grid[index] = val
  }
  addValue(x, y, val) {
    let index = this.getGridIndex(x, y)
    this.grid[index] += val
  }
  setCellValue(cx, cy, val) {
    if (cx < 0 || cx > dim || cy < 0 || cy > dim) {
      console.error("Grid.setCellValue() given cell indexes are out of range")
    }
    let index = cy * dim + cx
    this.grid[index] = val
  }
  printWallPattern(type) {
    // Big square in the middle
    if (type == 1) {
      for (let cx = Math.floor(0.3 * dim); cx < Math.ceil(0.7 * dim); cx++) {
        for (let cy = Math.floor(0.3 * dim); cy < Math.ceil(0.7 * dim); cy++) {
          this.setCellValue(cx, cy, 1)
        }
      }
    }
    // Thin vertical wall & single or double slit
    else if (type == 2 || type == 3) {
      let wallWid = Math.floor(0.03 * dim)
      let slitWid = Math.floor(0.03  * dim)
      let slitsGap = Math.floor(0.25 * dim)
      let slit1center = Math.floor(dim / 2) - Math.floor(slitsGap / 2)
      let slit2center = Math.floor(dim / 2) + Math.floor(slitsGap / 2)
      for (let cx = Math.floor(0.5 * dim) - wallWid; cx < Math.floor(0.5 * dim) + wallWid; cx++) {
        if (type == 2) {
          // Single slit
          for (let cy = 0; cy < dim/2 - slitWid; cy++) {
            // Upper part
            this.setCellValue(cx, cy, 1)
            
            // Lower part
            this.setCellValue(cx, dim - cy, 1)
          }
        }
        else if (type == 3) {
          // Double slit
          for (let cy = 0; cy < dim; cy++) {
            let isWall1 = (cy < slit1center - slitWid)
            let isWall2 = ((cy > slit1center + slitWid) && (cy < slit2center - slitWid))
            let isWall3 = cy > slit2center + slitWid
            if (isWall1 || isWall2 || isWall3) {
              this.setCellValue(cx, cy, 1)
            }
          }
        }
      }
    }
    // Add box walls
    if (params.wallCage) {
      let cageWid = 3
      
      // Vertical
      for (let cx = 0; cx < cageWid; cx++) {
        for (let cy = 0; cy < dim; cy++) {
          this.setCellValue(cx, cy, 1)
          this.setCellValue(dim - cx, cy, 1)
        }
      }
      // Horizontal
      for (let cy = 0; cy < cageWid; cy++) {
        for (let cx = 0; cx < dim; cx++) {
          this.setCellValue(cx, cy, 1)
          this.setCellValue(cx, dim - cy, 1)
          let a  = 0
        }
      }
      
    }
  }
  draw() {
    this.grid.forEach((val, index) => {
      ctx1.beginPath()
      let h = 0, s = 75, l = 50, a = 0.5
      
      if (params.modeName == "base" || params.modeName == "bouncing") {
        const minU = 0, maxU = 1
        let v = 100 * Math.pow(remap(val, minU, maxU, 0, 1), .3)
        let sensitivity = params.modeName == "base" ? 1 : 2
        h = 250 + 2 * v * sensitivity
        l = v * sensitivity
      } else if (params.modeName == "rain") {
        let v = remap(val, -1, 1, 0, 1)
        h = 240 - 60 * v
        l = 0 + 90 * Math.pow(remap(val, -.25, .25, 0, 1), 4)
        a = 1
      } else if (params.modeName == "constellations") {
        s = 0
        l = 0 + 40 * Math.pow(remap(val, -.5, .5, 0, 1), 2)
      }
      else if (params.modeName == "slits") {
        let v = Math.pow(remap(val, -1, 1, 0, 1), 4)
        h = 140 + 30 * v
        l = 0 + 90 * v
      }
      
      ctx1.fillStyle = "hsla(" + h + ", " + s + "%, " + l + "%, " + a + ")"
      let xy = this.getGridXY(index)
      ctx1.rect(xy.x, xy.y, cellSize, cellSize)
      ctx1.fill()
      ctx1.closePath()
    })
  }
  gridDraw() {
    this.grid.forEach((val, index) => {
      ctx1.beginPath()
      let h = 0
      let s = 0
      let l = 0
      let a = val > 0 ? 1 : 0;
      ctx1.fillStyle = "hsla(" + h + ", " + s + "%, " + l + "%, " + a + ")"
      let xy = this.getGridXY(index)
      ctx1.rect(xy.x, xy.y, cellSize, cellSize)
      ctx1.fill()
      ctx1.closePath()
    })
  }
}
class System {
  constructor(intensityGrid, variationGrid, wallGrid) {
    this.iGrid = intensityGrid
    this.vGrid = variationGrid
    this.wGrid = wallGrid
    
    this.wGrid.printWallPattern(params.wallType)
    
    this.slidingGridChunkIndex = 0 // Sliding index to read grid with offset, without using more costly Grid value retrieving methods
    this.gridChunkForWorklet = null
    this.gridChunkForFft = new Float32Array(dim * dim)
  }
  getIntensityLaplacianWithWalls(cx, cy, mode) {
    let lap = 0
    let sumOfNorms = 0
    
    let intensity = this.iGrid.getValue(cx, cy)
    let wallValue = this.wGrid.getValue(cx, cy)
    
    let pattern = this.iGrid.getNeighborPattern(mode)
    pattern.forEach(p => {
      // Get index of neighbor (careful close to edges)
      let neighIndex = ((cy + p[1] + dim) % dim) * dim + ((cx + p[0] + dim) % dim)
      
      // Get laplacian intensity & add to lap value, use wall potential
      let neighWallValue = this.wGrid.grid[neighIndex]
      let wallImpact = 1 - 1/2 * (neighWallValue + wallValue)
      let neighIntensity = wallImpact * (this.iGrid.grid[neighIndex] - intensity)
      lap += neighIntensity
      
      // Increment sum of squared norms of cell-neighbor distance
      sumOfNorms += (Math.pow(p[0], 2) + Math.pow(p[1], 2)) * Math.pow(cellSize, 2)
    })
    
    // Divide by sum of squared norms of cell distance
    lap /= sumOfNorms
    
    // Double
    lap *= 2
    
    return lap
  }
  updateGrids() {
    this.updateVariationGrid()
    this.updateIntensityGrid()
    
    // Update minmax for coloring (occasionally + probe just 1 random cell)
    /*
    if (step % 5 == 0) {
      // Slide minmaxU back to center
      minmaxU.minU += 0.005
      minmaxU.maxU -= 0.005
      
      // Update minmaxU
      let randomIndex = Math.floor(Math.random() * dim * dim)
      let sample = this.iGrid[randomIndex]
      if (sample < minmaxU.minU) minmaxU.minU = sample
      if (sample > minmaxU.maxU) minmaxU.maxU = sample
    }
    */
  }
  updateVariationGrid() {
    let newVgrid = new Float32Array(dim * dim)
    
    // Numerical viscosity of variation grid
    let vVisc = params.numericalVariationViscosity

    // Field spatial diffusion and characteristic time
    let Dc = params.fieldDiffusion
    let tau = params.fieldDiffusionTau
    let visc1 = params.viscosity1 / 100
    let visc3 = params.viscosity3 / 100
    
    // Check surrounding laplacian to increment value of variation (2nd order time derivative == intensity laplacian)
    for (let cy = 0; cy < dim; cy++) {
      for (let cx = 0; cx < dim; cx++) {
        // Δc(x,y)
        let intensityLaplacian = this.getIntensityLaplacianWithWalls(cx, cy, "moo1")
        
        // dc/dt(x,y)
        let variation = this.vGrid.getValue(cx, cy)
        
        // c(x,y)
        let intensity = this.iGrid.getValue(cx, cy)
        
        // Wall presence
        let w = this.wGrid.getValue(cx, cy)
        
        // Final new value of variation
        let newValue = 0
        let dtt = deltaTms * dt
        
        // First order
        newValue += (1 - vVisc) * (1 - dtt / tau) * variation
        
        // Laplacian
        if (w == 1) intensityLaplacian = 0
        newValue += intensityLaplacian * Dc * dtt / tau
        
        // Physical viscosity
        newValue += -visc1 * intensity * dtt / tau
        
        // Physical viscosity of cube (prevents explosions)
        newValue += -visc3 * Math.pow(intensity, 3) * dtt / tau
        
        let index = cy * dim + cx
        newVgrid[index] = newValue
      }
    }
    
    this.vGrid.grid = newVgrid
    
  }
  updateIntensityGrid() {
    let newIgrid = new Float32Array(dim * dim)
    let dtt = deltaTms * dt
    audioMetrics.iGridMax = 0
    
    for (let cy = 0; cy < dim; cy++) {
      for (let cx = 0; cx < dim; cx++) {
        // dc/dt(x,y)
        let variation = this.vGrid.getValue(cx, cy)
        
        // c(x,y)
        let intensity = this.iGrid.getValue(cx, cy)
        
        // Numerical viscosity of intensity grid
        let iVisc = params.numericalIntensityViscosity
        
        // Wall presence
        let w = this.wGrid.getValue(cx, cy)
        
        let newValue = intensity * (1 - iVisc * dtt) + variation * dtt
        
        // Clamp
        if (newValue < params.minGridValue) newValue = params.minGridValue
        if (newValue > params.maxGridValue) newValue = params.maxGridValue
        
        // Wall
        if (w == 1) newValue = 0
        
        // Detect max for audio
        if (Math.abs(newValue) > audioMetrics.iGridMax) audioMetrics.iGridMax = Math.abs(newValue)
        
        let index = cy * dim + cx
        newIgrid[index] = newValue
      }
    }
    
    this.iGrid.grid = newIgrid
  }
  updateGridChunkForAudioWorklet(deltaTms) {
    // Push some new grid values to the worklet buffer
    // Note: the audio worklet runs at 44100Hz while the main JS loop runs at 60FPS
    // 44100 / 60 = 735 values must be posted to the worker each time
    // Since the simulation has a variable loop time, we need to compute the right buffer size

    let size = Math.ceil(deltaTms / 1000 * 44100)
    
    const maxIndex = dim * dim

    /*
    // 1. Calculate where this chunk is supposed to end
    let endIndex = this.slidingGridChunkIndex + size

    if (endIndex <= maxIndex) {
      // NORMAL CASE: The entire chunk fits neatly before the edge of the grid
      this.gridChunk = this.iGrid.grid.subarray(this.slidingGridChunkIndex, endIndex)
    } else {
      // SPLIT CASE: The chunk straddles the boundary!
      // Calculate how many samples are left at the tail end
      let tailSize = maxIndex - this.slidingGridChunkIndex
      // Calculate how many samples we need to grab from the head (beginning)
      let headSize = size - tailSize

      // Extract the two pieces
      let tail = this.iGrid.grid.subarray(this.slidingGridChunkIndex, maxIndex)
      let head = this.iGrid.grid.subarray(0, headSize)

      // Because subarray just points to memory, we must combine them into a single array.
      // We allocate a small temporary Float32Array for this frame's chunk:
      this.gridChunk = new Float32Array(size)
      this.gridChunk.set(tail, 0)        // Put the tail at the beginning
      this.gridChunk.set(head, tailSize) // Stack the head right after it
    }

    // 2. Advance the index smoothly using Modulo (%) to wrap it back to 0 perfectly
    this.slidingGridChunkIndex = (this.slidingGridChunkIndex + size) % maxIndex
    */
    
    const factor = 4.41 * 4
    const step = 1 / factor // How far to move in the grid per audio sample (1/n of 1 natural grid step)

    // 1. We must allocate a new array because we are calculating completely new blended values
    this.gridChunkForWorklet = new Float32Array(size)

    for (let i = 0; i < size; i++) {
      // Calculate the fractional index for this specific sample
      let floatIndex = (this.slidingGridChunkIndex + (i * step)) % maxIndex

      // Find the two neighboring cell indices
      let indexA = Math.floor(floatIndex)
      let indexB = (indexA + 1) % maxIndex // Perfect torus wrap for the second sample

      // Calculate how far we are between cell A and cell B (a value between 0.0 and 1.0)
      let weight = floatIndex - indexA

      // Grab the two actual grid values
      let sampleA = this.iGrid.grid[indexA]
      let sampleB = this.iGrid.grid[indexB]

      // Mix them together linearly and save to our chunk
      this.gridChunkForWorklet[i] = sampleA * (1 - weight) + sampleB * weight
    }

    // 2. Advance the index smoothly by the fractional distance covered this frame
    // JavaScript handles floating-point modulo (%) perfectly here.
    this.slidingGridChunkIndex = (this.slidingGridChunkIndex + (size * step)) % maxIndex
  }
  updateGridChunkForFft() {
    // Pass the whole grid
    let size = dim * dim
    this.gridChunkForFft = this.iGrid.grid.slice(0, size)
  }
}
class Particle {
  constructor(iGrid, vGrid, wGrid, x, y, u, theta) {
    this.iGrid = iGrid
    this.vGrid = vGrid
    this.wGrid = wGrid
    this.x = x
    this.y = y
    this.u = u
    this.uThreshold = 1 * Math.random()
    this.theta = theta
    this.vx = 0
    this.vy = 0
    this.speed = 0
    this.partnerIndex = -1
  }
  interact() {
    /*
    // Inject some u
    if (Math.random() < 0.001) {
      let u = 0.16 * this.u
      this.inject(u, "vn2h")
    }
    
    // Absorb some u
    this.absorb(5, "vn1")
    */
    // Time resacling
    let dtt = dt * deltaTms
    
    // 0 - Useful values
    let cxcy = this.iGrid.getGridCXCY(this.x, this.y)
    let grad = this.iGrid.getLocalGradient(cxcy.cx, cxcy.cy, params.neighborMode)
    let wallGrad = this.wGrid.getLocalGradient(cxcy.cx, cxcy.cy, params.neighborMode)
    let intensity = this.iGrid.getValue(cxcy.cx, cxcy.cy)
    let wallValue = this.wGrid.getValue(cxcy.cx, cxcy.cy)
    let rands = getNormalRandoms()
    let ran1 = rands[0]
    let ran2 = rands[1]
    let ran3 = getNormalRandoms()[0]
    let omega = params.particlesRotCoupling
    let Dp = params.particlesPosDiffusion
    let Dr = params.particlesRotDiffusion
    let v0 = params.particlesSelfPropulsionSpeed / 100
    let mu = params.particlesGradCoupling
    let uTau = params.particlesEnergyTau
    let lambda = params.particlesEnergyCoupling
    
    // 1 - Update theta
    let newTheta = this.theta
    newTheta += omega * (Math.cos(this.theta) * grad.y - Math.sin(this.theta) * grad.x) * dtt
    newTheta += Math.sqrt(2 * Dr * dtt) * ran3
    newTheta = newTheta % (2 * Math.PI)
    this.theta = newTheta
     
    // 2 - Update velocity
    // 2.1 - Speed up particles in walls so they exit
    v0 += wallValue * 3
    // 2.2 - Phoretic & field gradient
    this.vx = v0 * Math.cos(newTheta) - mu * grad.x
    this.vy = v0 * Math.sin(newTheta) - mu * grad.y
    this.speed = Math.sqrt(Math.pow(this.vx, 2) + Math.pow(this.vy, 2))
    // 2.3 - Wall standard repulsion
    this.vx += -params.wallPotentialScale * wallGrad.x
    this.vy += -params.wallPotentialScale * wallGrad.y
    
    // 3 - Update position
    let dx = this.vx * dtt + Math.sqrt(2 * Dp * dtt) * ran1
    let dy = this.vy * dtt + Math.sqrt(2 * Dp * dtt) * ran2
    this.moveBy(dx, dy)
    
    // 4 - Update energy
    this.u = this.u + dtt / uTau + lambda * dtt * Math.abs(intensity)
    
    // 5 - Release energy (maybe)
    let shouldRelease = this.u > this.uThreshold && params.activateEnergyRelease
    if (shouldRelease) {
      // Inject to grid
      this.inject(this.u, params.neighborMode)
      
      // Draw new value for energy threshold
      let ran = 1 - Math.random() // prevents ran == zero
      let alpha = params.energyThresholdStochasticity
      let threshold = alpha * (-Math.log(ran)) + (1 - alpha) * 1
      this.uThreshold = threshold
    }
   
    // Apply motion
    this.moveBy(dx * dtt, dy * dtt)
  }
  inject(u, mode) {
    // Give to grid
    let cxcy = this.iGrid.getGridCXCY(this.x, this.y)
    let neighIndexes = this.iGrid.getNeighborsIndexes(cxcy.cx, cxcy.cy, mode)
    let uPerNeigh = u / neighIndexes.length
    neighIndexes.forEach(ind => {
      // Use global injection parameter to scale how much energy is injected (special case for one of the modes where the left half injection is forced)
      let injectedNrjScale = params.particlesEnergyInjection / 5000
      
      if (params.modeName == "slits" && (this.x < size / 2)) injectedNrjScale = 3000 / 5000
      
      this.iGrid.grid[ind] += uPerNeigh * injectedNrjScale / Math.pow(params.population / 10, 0.5)
    })
    
    // Remove from particle
    this.u -= u
  }
  absorb(percent, mode) {
    // Absorb from grid
    let uAbsorbed = 0
    let cxcy = this.iGrid.getGridCXCY(this.x, this.y)
    let neighIndexes = this.iGrid.getNeighborsIndexes(cxcy.cx, cxcy.cy, mode)
    
    neighIndexes.forEach(ind => {
      let uAbs = this.iGrid.grid[ind] * percent / 100
      this.iGrid.grid[ind] -= uAbs
      uAbsorbed += uAbs
    })
    
    // Give to particle
    this.u += uAbsorbed
  }
  moveBy(dx, dy) {
    // Increment x and y
    this.x += dx
    this.y += dy
    
    // Update norm of velocity (just for drawing)
    this.speed = Math.sqrt(dx * dx + dy * dy)
    
    // Periodic boundaries
    this.x = (this.x + 10 * size) % size
    this.y = (this.y + 10 * size) % size
  }
  draw() {
    // Dot
    ctx2.beginPath()
    let h = 220// + 50 * this.speed
    let l = 80//20 + 50 * Math.pow(this.speed / 2, 0.75)
    let a = 0.6
    if (params.population < 50) a = 1
    ctx2.fillStyle = "hsla(" + h + ", 55%, " + l + "%, " + a + ")"
    let rad = 1 / Math.pow(params.population / 1000, 0.25)
    ctx2.arc(this.x, this.y, rad, 0, 2 * Math.PI, false)
    ctx2.fill()
    ctx2.closePath()
    
    // Potential line with neighbor
    if (params.drawParticlesPartners) this.drawPartner()
    
  }
  drawPartner() {
    if (this.partnerIndex > -1) {
      // Check distance to partner
      let partner = particles[this.partnerIndex]
      let dist = Math.sqrt(Math.pow(partner.x - this.x, 2) + Math.pow(partner.y - this.y, 2))
      
      // Change partner if too far (or is myself), otherwise draw line
      let sight = 75
      if (dist > sight || dist == 0) {
        this.partnerIndex = Math.floor(Math.random() * particles.length)
      } else {
        ctx2.beginPath()
        ctx2.moveTo(this.x, this.y)
        ctx2.lineTo(partner.x, partner.y)
        ctx2.strokeStyle = "#FFF7"
        ctx2.lineWidth = 1
        ctx2.stroke()
        ctx2.closePath()
      }
    }
    else {
      this.partnerIndex = Math.floor(Math.random() * particles.length)
    }
  }
}
class UI {
  constructor (gamepad) {
    this.panelIndex = 0
    this.panels = document.querySelectorAll(".control-panel")
    this.nb = this.panels.length
    this.panel0name = this.panels[0].querySelector("p.name")
    this.panel0value = this.panels[0].querySelector("p.value")
    this.panel1name = this.panels[1].querySelector("p.name")
    this.panel1value = this.panels[1].querySelector("p.value")
    this.deltaTmsReadout = document.getElementById("delta-tms")
    this.deltaTmsValue = this.deltaTmsReadout ? this.deltaTmsReadout.querySelector(".value") : null
    this.audioHasBooted = false
    this.virtualPointer = { x: size / 2, y: size / 2 }
    this.gamepad = gamepad
    this.updatePanelsMode(baseParams.modeName)
    this.updateDeltaTms()
    this.initInteractions()
  }
  bootAudio () {
    if (!this.audioHasBooted) {
      audio = new Explaudio()
      this.audioHasBooted = true
    }
  }
  injectAlongPath (fromX, fromY, toX, toY) {
    const halts = 4
    for (let h = 1; h <= halts; h++) {
      let haltX = fromX + h / halts * (toX - fromX)
      let haltY = fromY + h / halts * (toY - fromY)
      iGrid.addValue(haltX, haltY, params.injectionAmplitude)
    }
  }
  updateVirtualPointer (xAxis, yAxis, deadzone) {
    const center = size / 2
    const maxCoord = size - 1e-6
    const amplitude = Math.sqrt(xAxis * xAxis + yAxis * yAxis)
    const prevX = this.virtualPointer.x
    const prevY = this.virtualPointer.y
    const nextX = Math.min(maxCoord, Math.max(0, center + xAxis * center))
    const nextY = Math.min(maxCoord, Math.max(0, center + yAxis * center))

    this.virtualPointer.x = nextX
    this.virtualPointer.y = nextY

    if (amplitude <= deadzone) {
      return
    }

    this.injectAlongPath(prevX, prevY, nextX, nextY)
  }
  adjustActivePanel (way) {
    this.updatePanel(way)
  }
  initInteractions () {
    document.querySelectorAll(".control-panel")[this.panelIndex].classList.add("active")
    // Mouse motion on grid
    let lastX, lastY
    can2.addEventListener("pointermove", ev => {
      let x = ev.offsetX, y = ev.offsetY
      if (lastX !== undefined && lastY !== undefined) {
        this.injectAlongPath(lastX, lastY, x, y)
      }
      lastX = x
      lastY = y
    })

    window.addEventListener("keydown", ev => {
      this.bootAudio()

      if (ev.code == "ArrowLeft" || ev.code == "ArrowRight" || ev.code == "ArrowUp" || ev.code == "ArrowDown") {
        ev.preventDefault()
      }
    })
    window.addEventListener("keyup", ev => {
      // Left Arrow -> previous panel
      if (ev.code == "ArrowLeft") {
        ev.preventDefault()
        // Change panel index
        this.panelIndex = 0
        document.querySelectorAll(".control-panel").forEach((panel, i) => {
          if (i === this.panelIndex) {
            panel.classList.add("active")
          } else {
            panel.classList.remove("active")
          }
        })
      }
      // Right Arrow -> next panel
      else if (ev.code == "ArrowRight") {
        ev.preventDefault()
        // Change panel index
        this.panelIndex = 1
        document.querySelectorAll(".control-panel").forEach((panel, i) => {
          if (i === this.panelIndex) {
            panel.classList.add("active")
          } else {
            panel.classList.remove("active")
          }
        })
      }
      // Up arrow -> increase current active variable
      // Down arrow -> decrease current active variable
      else if (ev.code == "ArrowUp" || ev.code == "ArrowDown") {
        ev.preventDefault()
        let way = ev.code == "ArrowUp" ? "up" : "down"
        this.adjustActivePanel(way)
      }
      else if (ev.code == "KeyB") {
        let guide = document.getElementById('guide-overlay')
        if (guide) guide.style.display = guide.style.display === 'none' ? 'flex' : 'none'
      }
    })

    this.gamepad.setInteractionHandler(() => {
      // Audio engine requires explicit user gesture across window, not joystick touches
    })
    this.gamepad.setLeftJoystickHandler((xAxis, yAxis, deadzone) => {
      this.updateVirtualPointer(xAxis, yAxis, deadzone)
    })
    this.gamepad.setDpadVerticalHandler((way) => {
      this.adjustActivePanel(way)
    })
    
    // Mode toggle
    window.addEventListener("keyup", ev => {
      if (ev.code == "KeyQ") {
        cycleMode(-1)
      } else if (ev.code == "KeyW") {
        cycleMode(1)
      }
    })
  }
  updateDeltaTms() {
    if (!this.deltaTmsValue) return
    this.deltaTmsValue.textContent = `${deltaTms.toFixed(1)} ms`
  }
  updatePanelsMode(modeName) {
    if (modeName == "base") {
      this.panel0name.innerHTML = "Energy injection"
      this.panel1name.innerHTML = "Field diffusion"
      this.panel0value.innerHTML = params.particlesEnergyInjection
      this.panel1value.innerHTML = params.fieldDiffusion
    }
    else if (modeName == "rain") {
      this.panel0name.innerHTML = "Rain intensity"
      this.panel1name.innerHTML = "Rain quantity"
      this.panel0value.innerHTML = params.injectionAmplitude
      this.panel1value.innerHTML = params.raindropsPerStep
    }
    else if (modeName == "constellations") {
      this.panel0name.innerHTML = "Energy injection"
      this.panel1name.innerHTML = "Viscosity"
      this.panel0value.innerHTML = params.particlesEnergyInjection
      this.panel1value.innerHTML = params.viscosity1
    }
    else if (modeName == "bouncing") {
      this.panel0name.innerHTML = "Energy injection"
      this.panel1name.innerHTML = "Gradient coupling"
      this.panel0value.innerHTML = params.particlesEnergyInjection
      this.panel1value.innerHTML = params.particlesGradCoupling
    }
    else if (modeName == "slits") {
      this.panel0name.innerHTML = "Field diffusion"
      this.panel1name.innerHTML = "Energy injection<br/>(right side)"
      this.panel0value.innerHTML = params.fieldDiffusion
      this.panel1value.innerHTML = params.particlesEnergyInjection
    }
  }
  updatePanel(way) {
    let pIndex = this.panelIndex
    let modeName = params.modeName
    
    // Init/default values
    let value
    let upMult = 4/3
    let downMult = 3/4
    let minValue = 0
    let maxValue = 1000
    
    let isEnergyInjection = ((modeName == "base" || modeName == "constellations" || modeName == "bouncing") && pIndex == 0) || (modeName == "slits" && pIndex == 1)
    let isDiffusion = (modeName == "base" && pIndex == 1) || (modeName == "slits" && pIndex == 0)
    let isRainIntensity = modeName == "rain" && pIndex == 0
    let isRainQuantity = modeName == "rain" && pIndex == 1
    let isViscosity = modeName == "constellations" && pIndex == 1
    let isGradientCoupling = modeName == "bouncing" && pIndex == 1
    
    // Energy injection param
    if (isEnergyInjection) {
      value = params.particlesEnergyInjection
      upMult = 8/7
      downMult = 7/8
      maxValue = 10000
    }
    // Field diffusion param
    else if (isDiffusion) {
      value = params.fieldDiffusion
      maxValue = 3000
    }
    // Rain intensity
    else if (isRainIntensity) {
      value = params.injectionAmplitude
      maxValue = 100
    }
    // Rain quantity
    else if (isRainQuantity) {
      value = params.raindropsPerStep
      maxValue = 100
    }
    // Viscosity
    else if (isViscosity) {
      value = params.viscosity1
      maxValue = 500
    }
    // Gradient coupling
    else if (isGradientCoupling) {
      value = params.particlesGradCoupling
      maxValue = 500
    }
    
    // Update
    let newValue = value * (way == "up" ? upMult : downMult)
    newValue = Math.round(newValue)
    if (way =="down" && newValue == value && newValue > minValue) { // Apply -1 when multiplying and rounding doesn't change value but we haven't reached lowest value
      newValue = value - 1
    }
    else if (way == "up" && newValue == value && newValue < maxValue) { // Same with +1 and highest value
      newValue = value + 1
    }
    newValue = Math.min(newValue, maxValue)
    newValue = Math.max(newValue, minValue)
    
    // Write back to variable
    if (isEnergyInjection) {
      params.particlesEnergyInjection = newValue
    }
    else if (isDiffusion) {
      params.fieldDiffusion = newValue
    }
    else if (isRainIntensity) {
      params.injectionAmplitude = newValue
    }
    else if (isRainQuantity) {
      params.raindropsPerStep = newValue
    }
    else if (isViscosity) {
      params.viscosity1 = newValue
    }
    else if (isGradientCoupling) {
      params.particlesGradCoupling = newValue
    }
    
    // Update UI
    if (pIndex == 0) this.panel0value.innerHTML = newValue.toString().substring(0, 5)
    else if (pIndex == 1) this.panel1value.innerHTML = newValue.toString().substring(0, 5)
  }
}
class Explaudio {
  constructor() {
    this.audioCtx = new AudioContext()
    this.initAudioWorklet()
    this.initBuses()
    this.start()
  }
  initAudioWorklet() {
    let workletScope = () => {
      class GridAudioProcessor extends AudioWorkletProcessor {
        constructor() {
          super()
          this.buffer = []
          this.port.onmessage = (e) => {
            // Message passed back to the main browser console:
            //console.log("Received data length:", e.data.length)
            this.buffer.push(...e.data)
          }
        }
        process(inputs, outputs, parameters) {
          
          const output = outputs[0]
          const channel = output[0] // Select the first audio channel (Mono)
          const sampleBlockSize = channel.length // This is guaranteed to be 128

          for (let i = 0; i < sampleBlockSize; i++) {
            if (this.buffer.length > 0) {
              // 1. Pull the next sample out of the queue
              channel[i] = this.buffer.shift()
            } else {
              // 2. Safety Net: If the simulation lags and the queue is completely empty, 
              // output 0 (silence) to avoid a horrible digital popping noise.
              channel[i] = 0
            }
          }

          // 3. CRITICAL: Return true so the browser keeps this thread alive.
          // If you return false, it shuts down permanently after the first 128 samples.
          return true
          
        }
      }
      registerProcessor('grid-audio-interpreter', GridAudioProcessor)
    }
    // Extracts just the code INSIDE the function as a string
    const workletCode = workletScope.toString().match(/\{([\s\S]*)\}/)[1]
    // Turn it into a Blob URL
    const blob = new Blob([workletCode], { type: 'application/javascript' })
    this.audioWorkletUrl = URL.createObjectURL(blob)
  }
  initBuses() {
    // Master
    this.masterGainNode = this.audioCtx.createGain()
    this.masterGainNode.connect(this.audioCtx.destination)
    
    // Grid sub-master
    this.gridGainNode = this.audioCtx.createGain()
    this.gridGainNode.connect(this.masterGainNode)
    
    // Particles sub-master
    this.particlesGainNode = this.audioCtx.createGain()
    this.particlesGainNode.connect(this.masterGainNode)
    
    // Particles single oscillator
    this.particleOscillator = this.audioCtx.createOscillator()
    this.particleOscillator.type = "square"
    this.particleOscillator.connect(this.particlesGainNode)
    
    // Grid single oscillator and gain
    this.gridOscillator = this.audioCtx.createOscillator()
    this.gridOscillator.type = "sine"
    this.gridOscillatorGainNode = this.audioCtx.createGain()
    this.gridOscillator.connect(this.gridOscillatorGainNode)
    this.gridOscillatorGainNode.connect(this.gridGainNode)
    
    // Grid master low-pass
    this.gridLowPassNode = this.audioCtx.createBiquadFilter()
    this.gridLowPassNode.type = "lowpass"
    this.gridLowPassNode.frequency.value = 3000 // Initial cutoff frequency in Hz
    this.gridLowPassNode.Q.value = 0.707 // Standard smooth slope, no resonant peak
    this.gridLowPassNode.connect(this.gridGainNode)
    
    // Grid master high-pass (chained with low pass)
    this.gridHighPassNode = this.audioCtx.createBiquadFilter()
    this.gridHighPassNode.type = "highpass"
    this.gridHighPassNode.frequency.value = 50 // Initial cutoff frequency in Hz
    this.gridHighPassNode.Q.value = 0.707 // Standard smooth slope, no resonant peak
    this.gridHighPassNode.connect(this.gridLowPassNode)
    
    // Grid FFT analyser and corresponding re-synthesis sinusoidal orchestra
    this.gridFftAnalyser = this.audioCtx.createAnalyser()
    this.gridFftAnalyser.fftSize = 256
    this.gridFftLength = this.gridFftAnalyser.frequencyBinCount
    this.gridFftData = new Float32Array(this.gridFftLength)
    this.gridBuffer = this.audioCtx.createBuffer(1, dim * dim, this.audioCtx.sampleRate) // Contains grid data, updated
    
    // Grid FFT harmonic comb: connect FFT output to a chain of peaking filters (boosting only some freqs)
    
    // WARNING COMB NOT USED ATM
    const fundamental = 38.35
    const numberOfHarmonics = 12
    this.combGainNode = this.audioCtx.createGain()
    this.combGainNode.gain.value = 0.075
    
    let node = this.combGainNode
    for (let i = 1; i <= numberOfHarmonics; i++) {
      const filter = this.audioCtx.createBiquadFilter()
      filter.type = "peaking"
      let freq = fundamental * i * Math.sqrt(2)
      //let freq = fundamental * (2 ** (i/4))
      filter.frequency.setValueAtTime(freq, this.audioCtx.currentTime)
      filter.Q.setValueAtTime(20, this.audioCtx.currentTime) // High Q, very narrow, sharp teeth
      const dBboost = 35
      filter.gain.setValueAtTime(dBboost * Math.exp(-i/10), this.audioCtx.currentTime)
      
      // Plug to chain
      node.connect(filter)
      node = filter
    }
    node.connect(this.gridHighPassNode)
    
    // Init FFT re-synthesized orchestra
    this.oscBankMasterGain = this.audioCtx.createGain()
    this.oscBankMasterGain.gain.value = 0.25
    //this.oscBankMasterGain.connect(this.combGainNode)
    this.oscBankMasterGain.connect(this.gridLowPassNode)
    
    this.initSinusoidalOrchestra(32)
    
    // Grid audio worklet
    this.audioCtx.audioWorklet.addModule(this.audioWorkletUrl).then(() => {
      this.gridValuesNode = new AudioWorkletNode(this.audioCtx, "grid-audio-interpreter")
      this.gridValuesNode.connect(this.gridHighPassNode)
    }).catch(err => {
      console.error("Failed to load worklet:", err)
    })
    
  }
  initSinusoidalOrchestra(requestedPopulation = 16) {
    // A pristine C-Minor Pentatonic scale matrix (Root frequencies across 4 octaves)
    const baseScale = [65.41, 73.42, 78.39, 87.31, 97.99] // C2, D2, Eb2, G2, Bb2
    
    this.oscillatorBank = []
    this.gainBank = []
    
    // Coerce the requested population to the nearest power of two
    const exponent = Math.round(Math.log2(requestedPopulation))
    this.orchestraPopulation = Math.pow(2, exponent)

    // Ensure we do not exceed the boundary of the maximum available FFT bins
    if (this.orchestraPopulation > this.gridFftLength) {
      this.orchestraPopulation = this.gridFftLength
    }

    console.log(`Synthesizer initialized with an exact power-of-two population: ${this.orchestraPopulation}`)

    // Determine the precise frequency width of each discrete FFT bin
    // For fftSize = 256, binSpacing is typically 44100 / 256 = 172.26 Hz
    const binSpacing = this.audioCtx.sampleRate / this.gridFftAnalyser.fftSize
    
    // Because both terms are powers of two, the stride is guaranteed to be a perfect integer
  const stride = this.gridFftLength / this.orchestraPopulation

    for (let i = 0; i < this.orchestraPopulation; i++) {
      const oscillator = this.audioCtx.createOscillator()
      const gainNode = this.audioCtx.createGain()
      
      oscillator.type = "sine"
      
      /*
      // LOGARITHMIC MAPPING: Distribute oscillators exponentially (like piano keys)
      // This breaks the harmonic fusion illusion, allowing you to hear rich chords
      let minFreq = 60
      let maxFreq = 6000
      const logNormalized = i / (this.orchestraPopulation - 1)
      const exponentialFrequency = minFreq * Math.pow(maxFreq / minFreq, logNormalized)
      oscillator.frequency.setValueAtTime(exponentialFrequency, this.audioCtx.currentTime)
      */
      
      // Distribute population across the mathematical scale array cyclically across octaves
      const scaleIndex = i % baseScale.length
      const octaveOffset = Math.floor(i / baseScale.length)
      const frequency = baseScale[scaleIndex] * Math.pow(2, octaveOffset)
      oscillator.frequency.setValueAtTime(frequency, this.audioCtx.currentTime)

      // Initialize the constituent wave as completely silent
      gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime)

      // Assemble the local component pipeline
      oscillator.connect(gainNode)
      gainNode.connect(this.oscBankMasterGain)

      // Store references to manipulate during the runtime loop
      this.oscillatorBank.push(oscillator)
      this.gainBank.push(gainNode)
    }
  }
  start() {
    this.masterGainNode.gain.value = 1
    
    // Temporary gains
    this.particlesGainNode.gain.value = 0
    this.gridOscillatorGainNode.gain.value = 0
    this.gridOscillator.frequency.setValueAtTime(30, this.audioCtx.currentTime)
   
    this.particleOscillator.start()
    this.gridOscillator.start()
    
    // FFT sinusoidal orchestra (start oscillators)
    this.oscillatorBank.forEach(o => o.start())
  }
  update(gridChunkForWorklet) {
    // Update gains
    this.particlesGainNode.gain.value = params.audioEnableParticles ? 0.01 : 0
    this.gridOscillatorGainNode.gain.value = params.audioEnableBasicGrid ? 0.125 : 0
    
    // Particles oscillator
    let particlesFreq = Math.min(10000, audioMetrics.particlesTotalSpeed * .5)
    this.particleOscillator.frequency.setValueAtTime(particlesFreq, this.audioCtx.currentTime)
    //let particleGainValue = 0.05 * Math.min(1, 0.25 + 0.75 * audioMetrics.particlesTotalSpeed * .05)
    //this.particlesGainNode.gain.setTargetAtTime(particleGainValue, this.audioCtx.currentTime + 0.25, 0.5)
    
    // Grid oscillator
    this.gridOscillator.frequency.setValueAtTime(20 + Math.sqrt(audioMetrics.iGridMax * 500), this.audioCtx.currentTime)
    //let gridGainValue = Math.min(1, 0.25 + 0.75 * Math.exp(-Math.pow((audioMetrics.iGridMax - 0.15) / 0.75, 2)))
    //this.gridOscillatorGainNode.gain.setTargetAtTime(gridGainValue, this.audioCtx.currentTime + 0.25, 0.5)
    
    // Posting data to audio worklet for raw grid signal listening
    if (this.gridValuesNode && params.audioEnableRawGrid) {
       this.gridValuesNode.port.postMessage(gridChunkForWorklet)
    }
  }
  updateOscillatorBank(gridChunkForFft) {
    // 1 (create temporary buffer to paste grid data into...)
    // 1.1 - Capture the instantaneous spectral footprint of the simulation grid
    this.gridBuffer.copyToChannel(gridChunkForFft, 0)

    // 1.2 - Instantiate an ephemeral, ultra-lightweight playback wrapper
    const transientSource = this.audioCtx.createBufferSource()
    transientSource.buffer = this.gridBuffer

    // 1.3 - Route the ephemeral stream through the analyzer node
    transientSource.connect(this.gridFftAnalyser)

    // 1.4 - Fire the node instantly and schedule its automatic disposal
    transientSource.start(0)
    
    // 2 Now get the data...
    this.gridFftAnalyser.getFloatFrequencyData(this.gridFftData)

    const now = this.audioCtx.currentTime
    const frameDuration = 0.0167 // Approximate duration of a single 60 FPS frame (16.67ms)

    // Re-establish the precise integer step factor
    const stride = this.gridFftLength / this.orchestraPopulation
  
    for (let i = 0; i < this.orchestraPopulation; i++) {
      // Directly sample the decimated subset of Fourier bins
      const targetBin = i * stride
      let decibels = this.gridFftData[targetBin]

      // Convert the logarithmic Decibel value back to a Linear Amplitude coefficient
      // Web Audio API returns values ranging from 0 dB (maximum) down to -Infinity (silence)
      let linearGain = 0
      if (!params.audioEnableFft) decibels = -Infinity
      decibels += 10
      if (decibels > -100 && isFinite(decibels)) {
        // Standard acoustic conversion: g = 10^(dB / 20)
        linearGain = Math.pow(10, decibels / 20)
      }

      // Performance Optimization & Linear Interpolation
      // Rather than letting the value snap instantly (which induces scratchy clicks), 
      // we smoothly ramp the gain node to its new destination over the frame interval
      this.gainBank[i].gain.linearRampToValueAtTime(linearGain, now + frameDuration)
    }
  }
}
class Gamepad {
  constructor() {
    this.activeGamepads = {}
    this.isLoopRunning = false
    this.onInteraction = null
    this.onLeftJoystick = null
    this.onDpadVertical = null
    this.buttonPressedState = {}
    this.initConnectionListeners()
  }
  setInteractionHandler(handler) {
    this.onInteraction = handler
  }
  setLeftJoystickHandler(handler) {
    this.onLeftJoystick = handler
  }
  setDpadVerticalHandler(handler) {
    this.onDpadVertical = handler
  }
  notifyInteraction() {
    if (this.onInteraction) {
      this.onInteraction()
    }
  }
  notifyLeftJoystick(xAxis, yAxis, deadzone) {
    if (this.onLeftJoystick) {
      this.onLeftJoystick(xAxis, yAxis, deadzone)
    }
  }
  notifyDpadVertical(way) {
    if (this.onDpadVertical) {
      this.onDpadVertical(way)
    }
  }
  resetButtonStates(gamepadIndex) {
    for (let buttonIndex = 0; buttonIndex <= 16; buttonIndex++) {
      delete this.buttonPressedState[`${gamepadIndex}:${buttonIndex}`]
    }
  }
  isNewButtonPress(gamepadIndex, buttonIndex, isPressed) {
    const key = `${gamepadIndex}:${buttonIndex}`
    const wasPressed = this.buttonPressedState[key] === true
    this.buttonPressedState[key] = isPressed
    return isPressed && !wasPressed
  }
  initConnectionListeners() {
    // Detect plug
    window.addEventListener("gamepadconnected", (event) => {
      console.log(`Gamepad connected at index ${event.gamepad.index}: ${event.gamepad.id}`)

      // Store the gamepad reference in our global object
      this.activeGamepads[event.gamepad.index] = event.gamepad
      this.resetButtonStates(event.gamepad.index)
      this.startGamepadLoop()
    })

    // Detect unplug
    window.addEventListener("gamepaddisconnected", (event) => {
      console.log(`Gamepad disconnected from index ${event.gamepad.index}`)

      // Remove the device from our tracking object
      delete this.activeGamepads[event.gamepad.index]
      this.resetButtonStates(event.gamepad.index)
    })
  }
  startGamepadLoop() {
    if (!this.isLoopRunning) {
      this.isLoopRunning = true
      requestAnimationFrame(() => this.processGamepadInputs())
    }
  }
  processGamepadInputs() {
    // 1. Fetch the absolute freshest snapshot of all connected gamepads
    const gamepads = navigator.getGamepads()

    // 2. Iterate through our active devices
    for (const index in this.activeGamepads) {
      const gp = gamepads[index]

      if (gp) {
        // Handle inputs for this specific controller
        this.readButtons(gp)
        this.readJoysticks(gp)
      }
    }

    // 3. Keep the loop executing if devices are still connected
    if (Object.keys(this.activeGamepads).length > 0) {
      requestAnimationFrame(() => this.processGamepadInputs())
    } else {
      this.isLoopRunning = false // Halt the loop if all controllers are unplugged
    }
    
  }
  readButtons(gamepad) {
    let hasButtonInteraction = false

    gamepad.buttons.forEach(button => {
      if (button.pressed || button.value > 0.1) {
        hasButtonInteraction = true
      }
    })

    if (hasButtonInteraction) {
      this.notifyInteraction()
    }

    // Standard gamepad mapping reference:
    // 0  A / Cross
    // 1  B / Circle
    // 2  X / Square
    // 3  Y / Triangle
    // 4  Left bumper (LB)
    // 5  Right bumper (RB)
    // 6  Left trigger (LT)
    // 7  Right trigger (RT)
    // 8  Back / Select
    // 9  Start
    // 10 Left stick press (L3)
    // 11 Right stick press (R3)
    // 12 D-pad up
    // 13 D-pad down
    // 14 D-pad left
    // 15 D-pad right
    // 16 Guide / Home button (browser support varies)
    const [
      primaryButton,
      buttonB,
      buttonX,
      buttonY,
      leftBumper,
      rightBumper,
      leftTrigger,
      rightTrigger,
      backButton,
      startButton,
      leftStickPress,
      rightStickPress,
      dpadUp,
      dpadDown,
      dpadLeft,
      dpadRight,
      guideButton
    ] = gamepad.buttons

    if (primaryButton.pressed) {
      console.log(`Button 0 is actively held down! Pressure: ${primaryButton.value}`)
      console.log("JS object: primaryButton (A / Cross)")
      // Action for A / Cross
    }

    if (buttonB?.pressed) {
      if (this.isNewButtonPress(gamepad.index, 1, true)) {
        console.log("JS object: buttonB (B / Circle)")
        let guide = document.getElementById('guide-overlay')
        if (guide) guide.style.display = guide.style.display === 'none' ? 'flex' : 'none'
      }
    } else {
      this.isNewButtonPress(gamepad.index, 1, false)
    }

    if (buttonX?.pressed) {
      console.log("JS object: buttonX (X / Square)")
      // Action for X / Square
    }

    if (buttonY?.pressed) {
      console.log("JS object: buttonY (Y / Triangle)")
      // Action for Y / Triangle
    }

    if (leftBumper?.pressed) {
      if (this.isNewButtonPress(gamepad.index, 4, true)) {
        console.log("JS object: leftBumper (LB)")
        cycleMode(-1)
      }
    } else {
      this.isNewButtonPress(gamepad.index, 4, false)
    }

    // Index 6 and 7 are traditionally Left and Right analog triggers
    if ((leftTrigger?.value ?? 0) > 0.1) {
      if (this.isNewButtonPress(gamepad.index, 6, true)) {
        console.log(`Left trigger depressed to: ${leftTrigger?.value * 100}%`)
        console.log("JS object: leftTrigger (LT)")
        cycleMode(-1)
      }
    } else {
      this.isNewButtonPress(gamepad.index, 6, false)
    }

    if ((rightTrigger?.value ?? 0) > 0.1) {
      if (this.isNewButtonPress(gamepad.index, 7, true)) {
        console.log("JS object: rightTrigger (RT)")
        cycleMode(1)
      }
    } else {
      this.isNewButtonPress(gamepad.index, 7, false)
    }

    if (rightBumper?.pressed) {
      if (this.isNewButtonPress(gamepad.index, 5, true)) {
        console.log("JS object: rightBumper (RB)")
        cycleMode(1)
      }
    } else {
      this.isNewButtonPress(gamepad.index, 5, false)
    }

    if (backButton?.pressed) {
      console.log("JS object: backButton (Back / Select)")
      // Action for Back / Select
    }

    if (startButton?.pressed) {
      console.log("JS object: startButton (Start)")
      // Action for Start
    }

    if (leftStickPress?.pressed) {
      console.log("JS object: leftStickPress (L3)")
      // Action for left stick press
    }

    if (rightStickPress?.pressed) {
      console.log("JS object: rightStickPress (R3)")
      // Action for right stick press
    }

    if (dpadUp?.pressed) {
      if (this.isNewButtonPress(gamepad.index, 12, true)) {
        console.log("JS object: dpadUp")
        this.notifyDpadVertical("up")
      }
      // Action for D-pad up
    } else {
      this.isNewButtonPress(gamepad.index, 12, false)
    }

    if (dpadDown?.pressed) {
      if (this.isNewButtonPress(gamepad.index, 13, true)) {
        console.log("JS object: dpadDown")
        this.notifyDpadVertical("down")
      }
      // Action for D-pad down
    } else {
      this.isNewButtonPress(gamepad.index, 13, false)
    }

    if (dpadLeft?.pressed) {
      console.log("JS object: dpadLeft")
      if (this.isNewButtonPress(gamepad.index, 14, true)) {
        ui.panelIndex = 0
        document.querySelectorAll(".control-panel").forEach((panel, i) => {
          if (i === ui.panelIndex) {
            panel.classList.add("active")
          } else {
            panel.classList.remove("active")
          }
        })
      }
      // Action for D-pad left
    } else {
      this.isNewButtonPress(gamepad.index, 14, false)
    }

    if (dpadRight?.pressed) {
      console.log("JS object: dpadRight")
      if (this.isNewButtonPress(gamepad.index, 15, true)) {
        ui.panelIndex = 1
        document.querySelectorAll(".control-panel").forEach((panel, i) => {
          if (i === ui.panelIndex) {
            panel.classList.add("active")
          } else {
            panel.classList.remove("active")
          }
        })
      }
      // Action for D-pad right
    } else {
      this.isNewButtonPress(gamepad.index, 15, false)
    }

    if (guideButton?.pressed) {
      console.log("JS object: guideButton (Guide / Home)")
      // Action for Guide / Home
    }
  }
  readJoysticks(gamepad) {
    // Index 0 & 1 govern the Horizontal and Vertical axes of the LEFT joystick
    let leftXAxis = gamepad.axes[0]
    let leftYAxis = gamepad.axes[1]

    // Index 2 & 3 govern the Horizontal and Vertical axes of the RIGHT joystick
    let rightXAxis = gamepad.axes[2]
    let rightYAxis = gamepad.axes[3]

    const DEADZONE = 0.15 // Ignore any microscopic hardware vibrations below 15%

    let hasAxisInteraction = gamepad.axes.some(axis => Math.abs(axis) > DEADZONE)
    if (hasAxisInteraction) {
      this.notifyInteraction()
    }

    this.notifyLeftJoystick(leftXAxis, leftYAxis, DEADZONE)

    if (Math.abs(leftXAxis) > DEADZONE) {
      console.log(`Left joystick tilted horizontally: ${leftXAxis}`)
      // Execute page navigation, character movement, etc.
    }

    if (Math.abs(leftYAxis) > DEADZONE) {
      console.log(`Left joystick tilted vertically: ${leftYAxis}`)
    }

    if (Math.abs(rightXAxis) > DEADZONE) {
      console.log(`Right joystick tilted horizontally: ${rightXAxis}`)
      // Execute page navigation, character movement, etc.
    }

    if (Math.abs(rightYAxis) > DEADZONE) {
      console.log(`Right joystick tilted vertically: ${rightYAxis}`)
    }
  }
}

// Setup audio
let audio = null

// Setup Gamepad
let gamepad = new Gamepad()

// Setup UI
let ui = new UI(gamepad)

// Setup grid set
let iGrid
let vGrid
let wGrid
let initGrids = () => {
  iGrid = new Grid(0) // intensity grid
  vGrid = new Grid(0) // variation grid
  wGrid = new Grid(0) // wall grid
}

// Setup system
let system
let initSystem = (iGrid, vGrid, wGrid) => {
  system = new System(iGrid, vGrid, wGrid)
}

// Setup particles
let particles
let initParticles = (iGrid, vGrid, wGrid) => {
  particles = []
  for (let i = 0; i < params.population; i++) {
    let x = size * Math.random(),
        y = size * Math.random(),
        u = 1 * Math.random(),
        theta = 2 * Math.random() * Math.PI
    
    let particle = new Particle(iGrid, vGrid, wGrid, x, y, u, theta)
    particles.push(particle)
  }
}

// Start
let start = () => {
  updateModeParams()
  ui.updatePanelsMode(params.modeName)
  initGrids()
  initSystem(iGrid, vGrid, wGrid)
  initParticles(iGrid, vGrid, wGrid)
}
start()

// Main loop
let update = () => {
  // Capture deltaTms (1/2)
  let now1 = performance.now()
  ctx2.clearRect(0, 0, size, size)
  
  // Update particles (and audio metrics)
  audioMetrics.particlesTotalSpeed = 0
  particles.forEach(p => {
    p.interact()
    audioMetrics.particlesTotalSpeed += p.speed
    if (params.drawParticles) p.draw()
  })
  
  // Update system grids
  system.updateGrids()
  
  // Randomly inject intensity on a random cell
  let rps = params.raindropsPerStep / 30
  let raindrops = rps > 1 ? rps : (Math.random() < rps ? 1 : 0)
  for (let r = 0; r < raindrops; r++) {
    let randX = Math.random() * size
    let randY = Math.random() * size
    iGrid.setValue(randX, randY, params.injectionAmplitude / 10)
  }
  
  // Draw grid
  if (params.drawGrid) {
    iGrid.draw()
    wGrid.gridDraw()
  }
  
  // Update audio
  if (audio) {
    system.updateGridChunkForAudioWorklet(deltaTms) // Previous deltaTms but bon ("but bon" is a patented English-French expression invented by Tine Colman")
    audio.update(system.gridChunkForWorklet)
    
    if (step % 1 == 0) { // Inject every ~100ms instead of 30ms
      // Passing data from FFT analyser to sinusoidal constellation to analyse grid signal
      system.updateGridChunkForFft()
      audio.updateOscillatorBank(system.gridChunkForFft)
    }
  }
  
  // Increment main step counter
  step++
  
  // Capture deltaTms (2/2)
  let now2 = performance.now()
  deltaTms = now2 - now1
  ui.updateDeltaTms()
}

// Boot
let frame = () => {
  update()
  window.requestAnimationFrame(frame)
}
window.addEventListener("load", event => {
  frame()
})

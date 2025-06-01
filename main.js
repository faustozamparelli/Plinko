console.clear();

// Game Configuration
const GAME_WIDTH = 620;
const GAME_HEIGHT = 534;
const SPHERE_RADIUS = 7;
const PIN_SPACING = 32;
const PIN_RADIUS = 4;
const PRIZE_VALUES = [50, 20, 7, 4, 3, 1, 1, 0, 0, 0, 1, 1, 3, 4, 7, 20, 50];

// Audio System
class AudioController {
  constructor(noteFrequency) {
    this.synthesizer = new Tone.PolySynth().toDestination();
    this.synthesizer.set({ volume: -6 });
    this.frequency = noteFrequency;
  }

  playSound() {
    return this.synthesizer.triggerAttackRelease(
      this.frequency,
      "32n",
      Tone.context.currentTime
    );
  }
}

// Game State Management
class GameStateManager {
  constructor() {
    this.sphereCount = 10;
    this.isAutoMode = false;
    this.autoDropTimer = null;
    this.sphereCountDisplay = document.getElementById("balls");
    this.actionButton = document.getElementById("drop-button");
    this.autoModeToggle = document.getElementById("checkbox");
    this.clickSound = new Tone.NoiseSynth({ volume: -26 }).toDestination();

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.actionButton.addEventListener("click", () => this.handleButtonClick());
    this.autoModeToggle.addEventListener("input", (event) =>
      this.toggleAutoMode(event)
    );
  }

  handleButtonClick() {
    if (this.isAutoMode && this.autoDropTimer) {
      this.stopAutoMode();
    } else if (this.isAutoMode && !this.autoDropTimer) {
      this.startAutoMode();
    } else {
      this.releaseSphere();
    }
  }

  toggleAutoMode(event) {
    this.isAutoMode = event.target.checked;

    if (this.isAutoMode) {
      this.actionButton.innerHTML = "Start";
    } else {
      this.actionButton.innerHTML = "Drop";
    }

    if (this.autoDropTimer) {
      this.stopAutoMode();
    }
  }

  startAutoMode() {
    this.actionButton.innerHTML = "Stop";
    this.releaseSphere();
    this.autoDropTimer = setInterval(() => this.releaseSphere(), 600);
  }

  stopAutoMode() {
    this.actionButton.innerHTML = "Start";
    clearInterval(this.autoDropTimer);
    this.autoDropTimer = null;
  }

  releaseSphere() {
    if (this.sphereCount > 0) {
      this.sphereCount -= 1;
    }

    const dropZoneLeft = GAME_WIDTH / 2 - PIN_SPACING;
    const dropZoneRight = GAME_WIDTH / 2 + PIN_SPACING;
    const dropZoneWidth = dropZoneRight - dropZoneLeft;
    const spawnX = Math.random() * dropZoneWidth + dropZoneLeft;
    const spawnY = -PIN_RADIUS;

    const newSphere = PhysicsManager.createCircle(
      spawnX,
      spawnY,
      SPHERE_RADIUS,
      {
        label: "Ball",
        restitution: 0.6,
        render: { fillStyle: "#f23" },
      }
    );

    this.clickSound.triggerAttackRelease("32n", Tone.context.currentTime);
    PhysicsManager.addToWorld([newSphere]);
  }

  updateSphereDisplay() {
    this.sphereCountDisplay.innerHTML = this.sphereCount;
  }

  addSpheres(amount) {
    this.sphereCount += Math.floor(amount);
  }
}

// Physics Engine Management
class PhysicsManager {
  static Engine = Matter.Engine;
  static Events = Matter.Events;
  static Render = Matter.Render;
  static Runner = Matter.Runner;
  static Bodies = Matter.Bodies;
  static Composite = Matter.Composite;

  static createEngine() {
    return this.Engine.create({
      gravity: { scale: 0.0007 },
    });
  }

  static createRenderer(canvasElement, engineInstance) {
    return this.Render.create({
      canvas: canvasElement,
      engine: engineInstance,
      options: {
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        wireframes: false,
      },
    });
  }

  static createCircle(x, y, radius, options) {
    return this.Bodies.circle(x, y, radius, options);
  }

  static createRectangle(x, y, width, height, options) {
    return this.Bodies.rectangle(x, y, width, height, options);
  }

  static addToWorld(bodies) {
    this.Composite.add(gameEngine.world, bodies);
  }

  static removeFromWorld(body) {
    this.Composite.remove(gameEngine.world, body);
  }
}

// Game World Setup
class GameWorld {
  constructor() {
    this.obstacles = [];
    this.obstacleAnimations = [];
    this.audioNotes = [];
    this.initializeAudio();
    this.initializePrizeDisplay();
    this.createObstacles();
    this.createBoundaries();
    this.setupCollisionHandling();
  }

  initializeAudio() {
    const noteFrequencies = [
      "C#5",
      "C5",
      "B5",
      "A#5",
      "A5",
      "G#4",
      "G4",
      "F#4",
      "F4",
      "F#4",
      "G4",
      "G#4",
      "A5",
      "A#5",
      "B5",
      "C5",
      "C#5",
    ];
    this.audioNotes = noteFrequencies.map((freq) => new AudioController(freq));
  }

  initializePrizeDisplay() {
    PRIZE_VALUES.forEach((value, index) => {
      document.getElementById(`note-${index}`).innerHTML = value;
    });
  }

  createObstacles() {
    for (let rowIndex = 0; rowIndex < 16; rowIndex++) {
      const obstaclesInRow = rowIndex + 3;
      for (let colIndex = 0; colIndex < obstaclesInRow; colIndex++) {
        const obstacleX =
          GAME_WIDTH / 2 + (colIndex - (obstaclesInRow - 1) / 2) * PIN_SPACING;
        const obstacleY = PIN_SPACING + rowIndex * PIN_SPACING;

        const obstacle = PhysicsManager.createCircle(
          obstacleX,
          obstacleY,
          PIN_RADIUS,
          {
            isStatic: true,
            label: "Peg",
            render: { fillStyle: "#fff" },
          }
        );

        this.obstacles.push(obstacle);
      }
    }

    PhysicsManager.addToWorld(this.obstacles);
    this.obstacleAnimations = new Array(this.obstacles.length).fill(null);
  }

  createBoundaries() {
    const floor = PhysicsManager.createRectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT + 22,
      GAME_WIDTH * 2,
      40,
      { isStatic: true, label: "Ground" }
    );
    PhysicsManager.addToWorld([floor]);
  }

  setupCollisionHandling() {
    Matter.Events.on(gameEngine, "collisionStart", (collisionEvent) => {
      collisionEvent.pairs.forEach(({ bodyA, bodyB }) => {
        this.handleSphereGroundCollision(collisionEvent, "Ball", "Ground");
        this.handleSphereObstacleCollision(collisionEvent, "Peg", "Ball");
      });
    });
  }

  handleSphereGroundCollision(collisionEvent, label1, label2) {
    this.processCollision(collisionEvent, label1, label2, (sphereToRemove) => {
      PhysicsManager.removeFromWorld(sphereToRemove);

      const slotIndex = Math.floor(
        (sphereToRemove.position.x - GAME_WIDTH / 2) / PIN_SPACING + 17 / 2
      );

      if (slotIndex >= 0 && slotIndex < 17) {
        const prizeValue = PRIZE_VALUES[slotIndex];
        gameState.addSpheres(prizeValue);

        const slotElement = document.getElementById(`note-${slotIndex}`);
        if (slotElement.dataset.pressed !== "true") {
          this.audioNotes[slotIndex].playSound();
          slotElement.dataset.pressed = true;
          setTimeout(() => {
            slotElement.dataset.pressed = false;
          }, 500);
        }
      }
    });
  }

  handleSphereObstacleCollision(collisionEvent, label1, label2) {
    this.processCollision(
      collisionEvent,
      label1,
      label2,
      (obstacleToAnimate) => {
        const obstacleIndex = this.obstacles.findIndex(
          (obstacle) => obstacle === obstacleToAnimate
        );
        if (obstacleIndex === -1) {
          throw new Error(
            "Obstacle not found in obstacles array during collision"
          );
        }
        if (!this.obstacleAnimations[obstacleIndex]) {
          this.obstacleAnimations[obstacleIndex] = new Date().getTime();
        }
      }
    );
  }

  processCollision(collisionEvent, targetLabel1, targetLabel2, callback) {
    collisionEvent.pairs.forEach(({ bodyA, bodyB }) => {
      let primaryBody, secondaryBody;

      if (bodyA.label === targetLabel1 && bodyB.label === targetLabel2) {
        primaryBody = bodyA;
        secondaryBody = bodyB;
      } else if (bodyA.label === targetLabel2 && bodyB.label === targetLabel1) {
        primaryBody = bodyB;
        secondaryBody = bodyA;
      }

      if (primaryBody && secondaryBody) {
        callback(primaryBody, secondaryBody);
      }
    });
  }

  renderObstacleEffects(canvasContext) {
    const currentTime = new Date().getTime();

    this.obstacleAnimations.forEach((animationTime, index) => {
      if (!animationTime) return;

      const timeDelta = currentTime - animationTime;
      if (timeDelta > 1200) {
        this.obstacleAnimations[index] = null;
        return;
      }

      const obstacle = this.obstacles[index];
      if (!obstacle) throw new Error("Unknown obstacle at index " + index);

      const animationProgress = timeDelta / 1200;
      const expansionProgress = 1 - Math.abs(animationProgress * 2 - 1);
      const effectRadius = expansionProgress * 12;

      canvasContext.fillStyle = "#fff2";
      canvasContext.beginPath();
      canvasContext.arc(
        obstacle.position.x,
        obstacle.position.y,
        effectRadius,
        0,
        2 * Math.PI
      );
      canvasContext.fill();
    });
  }
}

// Main Game Loop
class GameRenderer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.renderingContext = this.canvas.getContext("2d");
  }

  startRenderLoop() {
    const renderFrame = () => {
      gameWorld.renderObstacleEffects(this.renderingContext);
      PhysicsManager.Engine.update(gameEngine, 1000 / 60);
      gameState.updateSphereDisplay();
      requestAnimationFrame(renderFrame);
    };
    renderFrame();
  }
}

// Initialize Game
const gameCanvas = document.getElementById("canvas");
const gameEngine = PhysicsManager.createEngine();
const gameRenderer = PhysicsManager.createRenderer(gameCanvas, gameEngine);
const gameState = new GameStateManager();
const gameWorld = new GameWorld();
const gameRenderLoop = new GameRenderer(gameCanvas);

// Start the game
PhysicsManager.Render.run(gameRenderer);
gameRenderLoop.startRenderLoop();

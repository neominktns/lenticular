* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    margin: 0;
    padding: 0;
    overflow: hidden;
    width: 100vw;
    height: 100vh;
    background-color: #000;
}

.canvas-container {
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
}

canvas {
    cursor: crosshair;
    max-width: 90vw;
    max-height: 90vh;
    display: block;
}

video {
    display: none;
}
var hi = 1;
console.log("Herro World!");


var State = {
    S: 0, // Susceptible
    I: 1, // Infected
    R: 2, // Removed
};

class Board {

    constructor(width, height, n) {
        this.width = width;
        this.height = height;
        this.nodes = [];
        for (var i = 0; i < n; i++) {
            this.nodes.push(new Node(width, height));
        }
    }

    updateNodes(dt) {
        for (var i = 0; i < this.nodes.length; i++) {
            this.nodes[i].updatePosition(dt);
        }
    }

    drawNodes() {
        for (var i = 0; i < this.nodes.length; i++) {
            this.nodes[i].draw();
        }
    }

    iterate(dt) {
        var ctx = Simulation.canvas.getContext('2d');
        ctx.clearRect(0, 0, this.width, this.height);
        this.updateNodes(dt);
        this.drawNodes();
    }

    toString() {
        var str = "";
        for (var i = 0; i < this.nodes.length; i++) {
            str += this.nodes[i].toString();
            str += "\n";
        }
        return str;
    }
}

class Node {
    max_speed = 3;
    p_symptomatic_on_infection = 1;
    infection_radius = 0.5;
    stepSize = 1;
    stepDurration = 1;
    stepStrength = 1;
    socialDistanceStrength = 1;
    wallBuffer = 1;

    constructor(boardWidth, boardHeight) {
        this.state = State.S;
        this.x = Util.round(boardWidth * Math.random(), 5)
        this.y = Util.round(boardHeight * Math.random(), 5);
        this.dlBound = [-boardWidth / 2, -boardHeight / 2];
        this.urBound = [boardWidth / 2, boardHeight / 2];
        this.velocity = [0, 0];
        this.stepVector = [0, 0];
        this.repulsionPoints = [];
        this.time = 0;
        this.lastStepTime = this.time - this.stepDurration - 1;
    }

    updatePosition(dt) {
        var netForce = this.calculateNetForce();

        this.velocity = Util.vectSum(Util.vectMult(dt, netForce), this.velocity);

        // limit speed
        var speed = Util.norm(this.velocity)
        if (speed > this.max_speed) {
            this.velocity = Util.vectMult(this.max_speed / speed, this.velocity);
        }

        this.move(Util.vectMult(dt, this.velocity));
        this.time += dt;
    }

    calculateNetForce() {
        var netForce = [0, 0];

        // walking
        if (this.stepSize != 0) {
            netForce = Util.vectSum(netForce, this.calculateStepForce());
        }

        // social distancing
        if (this.socialDistanceStrength > 0) {
            netForce = Util.vectSum(netForce, this.calculateSocialDistanceForce());
        }

        // wall repulsion
        netForce = Util.vectSum(netForce, this.calculateWallForce());

        return netForce;
    }

    calculateStepForce() {
        var stepForce = [0, 0];

        // updates step vector
        if (this.time - this.lastStepTime > this.stepDurration) { // if time since last step exceeds time of step
            this.stepVector = Util.random2DVector(this.stepSize);
            this.lastStepTime = this.time;
        }

        // adds step vector component to netForceVector
        var dist = Util.norm(this.stepVector);
        if (dist != 0) {
            stepForce = Util.vectMult(this.stepStrength / Util.pow(dist, 3), this.stepVector);
        }
        return stepForce;
    }

    calculateSocialDistanceForce() {
        var repulsionForce = [0, 0];
        var minDist = Infinity;

        for (var i = 0; i < this.repulsionPoints.length; i++) {
            var toPoint = this.repulsionPoints[i] - getPos()[i];
            var dist = Util.norm(toPoint);

            if (0 < dist < minDist) {
                minDist = dist;
            }

            // adds step vector component to netForceVector
            if (dist > 0) {
                repulsionForce -= this.socialDistanceStrength * toPoint / Util.pow(dist, 3);
            }
        }

        return repulsionForce;
    }

    calculateWallForce() {
        var wallForce = [0, 0];

        for (var i = 0; i < 2; i++) {
            var toLower = this.getPos()[i] - this.dlBound[i];
            var toUpper = this.urBound[i] - this.getPos()[i];

            if (toLower < 0) {
                this.velocity[i] = Math.abs(this.velocity[i]);
                this.setPos(this.dlBound[i], i);
            }

            if (toUpper < 0) {
                this.velocity[i] = -Math.abs(this.velocity[i]);
                this.setPos(this.urBound[i], i);
            }

            wallForce[i] += Math.max((-1 / this.wallBuffer + 1 / toLower), 0);
            wallForce[i] -= Math.max((-1 / this.wallBuffer + 1 / toUpper), 0)
        }

        return wallForce;
    }

    move(vect) {
        this.x += vect[0];
        this.y += vect[1];
    }

    getPos() {
        return [this.x, this.y];
    }

    setPos(coord, i) {
        if (i == 0) {
            this.x = coord;
        } else if (i == 1) {
            this.y = coord;
        }
    }

    toString() {
        return "(" + this.x + ", " + this.y + ")";
    }

    draw() {
        var ctx = Simulation.canvas.getContext('2d');

        ctx.beginPath();
        ctx.arc(this.x, this.y, Simulation.config.nodeRadius, 0, 2 * Math.PI, false);
        ctx.fillStyle = Simulation.config.colors[this.state];
        ctx.fill()
    }
}

class Util {
    static random2DVector(magnitude) {
        return Util.rotate2DVector([magnitude, 0], Math.random() * 2 * Math.PI);
    }

    static rotate2DVector(vector, theta) { // rotates vector by theta radians
        var x = Math.cos(theta) * vector[0] - Math.sin(theta) * vector[1];
        var y = Math.sin(theta) * vector[0] + Math.cos(theta) * vector[1];
        return [Util.round(x, 5), Util.round(y, 5)];
    }

    static norm(vector) {
        var sum = 0;
        for (var i = 0; i < vector.length; i++) {
            sum += Util.pow(vector[i], 2)
        }
        return Math.sqrt(sum, 0.5);
    }

    static round(x, dec) {
        return Math.round(x * Util.pow(10, dec)) / Util.pow(10, dec);
    }

    static pow(x, n) {
        var y = 1;
        for (var i = 0; i < n; i++) {
            y *= x;
        }
        return y;
    }

    static vectMult(scalar, vect) {
        var product = new Array(vect.length);
        for (var i = 0; i < vect.length; i++) {
            product[i] = vect[i] * scalar;
        }
        return product;
    }

    static vectSum(vect1, vect2) {
        var len = vect1.length > vect2.length ? vect1.length : vect2.length;
        var sum = new Array(len);
        for (var i = 0; i < len; i++) {
            sum[i] = ((vect1[i] === undefined) ? 0 : vect1[i]) + ((vect2[i] === undefined) ? 0 : vect2[i])
        }
        return sum;
    }

}

var Simulation = {
    canvas: document.createElement("canvas"),
    setupCanvas: function () {
        this.canvas.width = 500;
        this.canvas.height = 500;
        this.context = this.canvas.getContext("2d");
        document.body.insertBefore(this.canvas, document.body.childNodes[0]);
    },
    boardConfig: {
        width: 500,
        height: 500,
        n: 5,
    },
    board: new Board(),
    setupBoard: function() {
        this.board = new Board(this.boardConfig.width, this.boardConfig.height, this.boardConfig.n);
    },
    config: {
        colors: {
            0: "#00FF00",
            1: "#FF0000",
            2: "#0000FF",
        },
        nodeRadius: 5,
    }
}
// console.log(b.toString());
// console.log("\n");
// console.log(b.toString());

function startGame() {
    Simulation.setupCanvas();
    Simulation.setupBoard();
    Simulation.board.iterate(2);
    console.log(Simulation.board.toString());
}
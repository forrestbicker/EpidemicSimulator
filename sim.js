var hi = 1;
console.log("Herro World!");


var Infectivity = {
    S: 0, // Susceptible
    I: 1, // Infected
    R: 2, // Removed
};

class Board {
    limit_social_distancing_to_infectious = false;
    socialDistanceN = 5;

    constructor(width, height, population) {
        this.width = width;
        this.height = height;
        this.nodes = [];
        for (var i = 0; i < population; i++) {
            this.addNode(width, height);
        }
    }

    addNode() {
        this.nodes.push(new Node(this.width, this.height));
    }

    removeNode() {
        this.nodes.pop();
    }

    updatePositions(dt) {
        for (const node of this.nodes) {
            node.updatePosition(dt);
        }
    }

    updateInfectivitys(dt) {
        var sNodes = [];
        var iNodes = []; // TODO: efficent stored so dont have to loop
        for (var i = 0; i < this.nodes.length; i++) {
            if (this.nodes[i].infectivity == Infectivity.S) {
                sNodes.push(this.nodes[i]);
            } else if (this.nodes[i].infectivity == Infectivity.I) {
                iNodes.push(this.nodes[i])
            }
        }

        for (const sNode of sNodes) {
            for (const iNode of iNodes) {
                var dist = Util.dist(sNode.getPos(), iNode.getPos());
                if (dist < iNode.infectionRadius && Math.random() < sNode.pInfectionOnContact * dt) {
                    sNode.setInfectivity(Infectivity.I);
                }
            }
        }

        for (const iNode of iNodes) {
            if (iNode.time - iNode.timeOfInfection > iNode.durrationOfInfection) {
                iNode.setInfectivity(Infectivity.R);
            }
        }
    }

    updateSocialDistancing() {
        var repulsionPoints = [];
        if (this.limit_social_distancing_to_infectious) {
            for (const node of this.nodes) {
                if (node.isSymptomatic) {
                    repulsionPoints.push(node.getPos());
                }
            }
        } else {
            for (const node of this.nodes) {
                repulsionPoints.push(node.getPos());
            }
        }

        if (repulsionPoints.length > 0) {
            for (const node of this.nodes) {
                if (node.socialDistanceStrength != 0) {
                    repulsionPoints.sort(function (a, b) { return Util.closest(node.getPos(), a, b) });
                    // repulsionPoints are the closest N nodes, excluding itself
                    node.repulsionPoints = repulsionPoints.slice(1, this.socialDistanceN + 1);
                }
            }
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

        this.updatePositions(dt);
        this.updateInfectivitys(dt);
        this.updateSocialDistancing();
        this.drawNodes();
    }

    getRandomNode() {
        return this.nodes[Math.floor(Simulation.board.nodes.length * Math.random())];
    }

    updateParams(population) {
        this.updatePopulation(population);
    }

    updatePopulation(population) {
        if (this.nodes.length > population) {
            while (this.nodes.length > population) {
                this.removeNode();
            }
        } else if (this.nodes.length < population) {
            while (this.nodes.length < population) {
                this.addNode();
            }
        }
    }

    infectRandomNode() {
        var i = this.nodes.length - 1;
        while (this.nodes[i].infectivity != Infectivity.S) {
            i--;
        }
        this.nodes[i].setInfectivity(Infectivity.I);
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
    pSymptomaticOnInfection = 1;
    infectionRadius = 15;
    pInfectionOnContact = 0.8;
    stepSize = 2;
    stepDurration = 2;
    wallBuffer = 10;
    stepStrength = 1;
    socialDistanceStrength = 10;
    durrationOfInfection = 100;

    constructor(boardWidth, boardHeight) {
        this.infectivity = Infectivity.S;
        this.x = Util.round(boardWidth * Math.random(), 5)
        this.y = Util.round(boardHeight * Math.random(), 5);
        this.dlBound = [0, 0];
        this.urBound = [boardWidth, boardHeight];
        this.velocity = [0, 0];
        this.stepVector = [0, 0];
        this.repulsionPoints = [];
        this.time = 0;
        this.lastStepTime = this.time - this.stepDurration - 1;
        this.timeOfRemoval;
        this.timeOfInfection;
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
        if (this.socialDistanceStrength != 0) {
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
            var toPoint = [this.repulsionPoints[i][0] - this.x, this.repulsionPoints[i][1] - this.y];
            var dist = Util.norm(toPoint);

            if (0 < dist < minDist) {
                minDist = dist;
            }

            // adds step vector component to netForceVector
            if (dist > 0) {
                repulsionForce = Util.vectSum(repulsionForce, Util.vectMult(-this.socialDistanceStrength / Util.pow(dist, 3), toPoint));
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

    setInfectivity(infectivity) {
        if (infectivity > this.infectivity) {
            this.infectivity = infectivity;

            if (infectivity = Infectivity.I) {
                this.timeOfInfection = this.time;
                if (Math.random() < this.pSymptomaticOnInfection) {
                    this.isSymptomatic = true;
                }
            } else if (infectivity = Infectivity.R) {
                this.timeOfRemoval = this.time;
                this.symptomatic = false;
            }
        }
    }

    toString() {
        return "(" + this.x + ", " + this.y + ")";
    }

    draw() {
        var ctx = Simulation.canvas.getContext('2d');

        ctx.beginPath();
        ctx.arc(this.x, this.y, Simulation.config.nodeRadius, 0, 2 * Math.PI, false);
        ctx.fillStyle = Simulation.config.colors[this.infectivity];
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

    static norm(vector) { // TODO: de-abstract this
        var sum = 0;
        for (var i = 0; i < vector.length; i++) {
            sum += Util.pow(vector[i], 2)
        }
        return Math.sqrt(sum);
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

    static vectMult(scalar, vect) { // TODO: de-abstract this
        var product = new Array(vect.length);
        for (var i = 0; i < vect.length; i++) {
            product[i] = vect[i] * scalar;
        }
        return product;
    }

    static vectSum(vect1, vect2) { // TODO: de-abstract this
        var len = vect1.length > vect2.length ? vect1.length : vect2.length;
        var sum = new Array(len);
        for (var i = 0; i < len; i++) {
            sum[i] = ((vect1[i] === undefined) ? 0 : vect1[i]) + ((vect2[i] === undefined) ? 0 : vect2[i])
        }
        return sum;
    }

    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static dist(coord1, coord2) {
        return Math.sqrt(this.pow(coord1[0] - coord2[0], 2) + this.pow(coord1[1] - coord2[1], 2))
    }

    static closest(target, coord1, coord2) {
        return this.dist(coord1, target) - this.dist(coord2, target);
    }

}

var Simulation = {
    canvas: document.getElementById("sim"),
    setupCanvas: function () {
        this.canvas.width = 500;
        this.canvas.height = 500;
        this.context = this.canvas.getContext("2d");
        document.body.insertBefore(this.canvas, document.body.childNodes[0]);
    },
    boardConfig: {
        width: 500,
        height: 500,
        n: 50,
    },
    board: new Board(),
    setupBoard: function () {
        this.board = new Board(this.boardConfig.width, this.boardConfig.height, this.boardConfig.n);
    },
    config: {
        colors: {
            0: "#5AF7B0",
            1: "#F0719B",
            2: "#DEE6E7",
        },
        nodeRadius: 5,
    },
    inputs: {
        getPopulation: function () {
            return document.getElementById("uPopulation").value;
        }
    },
}


function startGame() {
    Simulation.setupCanvas();
    Simulation.setupBoard();
    document.getElementById("uInfect").onclick = function () { Simulation.board.infectRandomNode() };
    Simulation.board.getRandomNode().setInfectivity(Infectivity.I);
    this.interval = setInterval(update, 20)
    // console.log(Simulation.board.toString());
}

function update() {
    Simulation.board.updateParams(Simulation.inputs.getPopulation());
    Simulation.board.iterate(1);
}
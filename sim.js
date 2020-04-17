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

    constructor(width, height) {
        // dummy default values, will be updated on load by slider
        this.contagion = {
            infectionRadius: -1,
            pInfectedOnContact: -1,
            infectionDurration: -1,
            pSymptomaticOnInfection: -1,
        };
        this.behaviors = {
            socialDistancing: {
                intensity: -1,
                percentObserving: -1,
                startThreshold: -1,
                isAvoider: -1,
                isAvoided: -1,
            },
        };

        this.width = width;
        this.height = height;
        this.nodes = [];
    }

    addNode() {
        this.nodes.push(new Node(this));
    }

    removeNode() {
        this.nodes.pop();
    }

    updateNodePositions(dt) {
        for (const node of this.nodes) {
            node.updatePosition(node.calculateNetForce(this.behaviors.socialDistancing.intensity), dt);
        }
    }

    updateNodeInfectivitys(dt) {
        var sNodes = [];
        var iNodes = []; // TODO: efficent stored so dont have to loop
        for (const node of this.nodes) {
            if (node.infectivity == Infectivity.S) {
                sNodes.push(node);
            } else if (node.infectivity == Infectivity.I) {
                iNodes.push(node)
            }
        }

        for (const sNode of sNodes) {
            for (const iNode of iNodes) {
                var dist = Util.dist(sNode.getPos(), iNode.getPos());
                if (dist < this.contagion.infectionRadius && Math.random() < this.contagion.pInfectedOnContact * dt) { // iNode.getInfectionRadius(), sNode.getPInfectedOnContact()
                    sNode.setInfectivity(Infectivity.I);
                    if (Math.random() < this.contagion.pSymptomaticOnInfection) {
                        sNode.isSymptomatic = true;
                    }
                }
            }
        }

        for (const iNode of iNodes) {
            if (iNode.time - iNode.timeOfInfection > this.contagion.infectionDurration) {
                iNode.setInfectivity(Infectivity.R);
                iNode.isSymptomatic = false;
            }
        }
    }

    updateNodeSocialDistancing() {
        var repulsionPoints = [];
        for (const node of this.nodes) {
            if (this.behaviors.socialDistancing.isAvoided(node)) {
                repulsionPoints.push(node.getPos());
            }
        }

        for (const node of this.nodes) {
            if (this.behaviors.socialDistancing.isAvoider(node)) {
                repulsionPoints.sort(function (a, b) { return Util.closest(node.getPos(), a, b) });
                // repulsionPoints are the closest N nodes, excluding itself
                node.repulsionPoints = repulsionPoints.slice(1, this.socialDistanceN + 1);
            } else {
                node.repulsionPoints = [];
            }
        }
    }

    drawNodes(context) {
        for (var i = 0; i < this.nodes.length; i++) {
            this.nodes[i].draw(context);
        }
    }

    iterate(dt) {
        var context = Simulation.canvas.getContext('2d');
        context.clearRect(0, 0, this.width, this.height);

        this.updateNodePositions(dt);
        this.updateNodeInfectivitys(dt);
        this.updateNodeSocialDistancing();
        this.drawNodes(context);
    }

    getRandomNode() {
        return this.nodes[Math.floor(Simulation.board.nodes.length * Math.random())];
    }


    updatePopulation(newPopulation) {
        if (this.nodes.length > newPopulation) {
            while (this.nodes.length > newPopulation) {
                this.removeNode();
            }
        } else if (this.nodes.length < newPopulation) {
            while (this.nodes.length < newPopulation) {
                this.addNode();
            }
        }
    }

    updateContagion(infectionRadius, pInfectedOnContact, infectionDurration, pSymptomaticOnInfection) {
        this.contagion.infectionRadius = infectionRadius;
        this.contagion.pInfectedOnContact = pInfectedOnContact;
        this.contagion.pInfectedOnContact = pInfectedOnContact;
        this.contagion.infectionDurration = infectionDurration;
        this.contagion.pSymptomaticOnInfection = pSymptomaticOnInfection;
    }

    updateBehavior(intensity, percentObserving, startThreshold, isAvoiderFunc, isAvoidedFunc) {
        this.behaviors.socialDistancing.intensity = intensity;
        this.behaviors.socialDistancing.percentObserving = percentObserving;
        this.behaviors.socialDistancing.startThreshold = startThreshold;
        this.behaviors.socialDistancing.isAvoider = isAvoiderFunc;
        this.behaviors.socialDistancing.isAvoided = isAvoidedFunc;
    }

    infectRandomNode() {
        var i = this.nodes.length - 1;
        while (i >= 0 && this.nodes[i].infectivity != Infectivity.S) {
            i--;
        }
        if (i >= 0) {
            this.nodes[i].setInfectivity(Infectivity.I);
        }
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
    stepSize = 2;
    stepDurration = 2;
    wallBuffer = 10;
    stepStrength = 1;
    socialDistanceIntensity = 10;

    constructor(board) {
        this.infectivity = Infectivity.S;
        this.x = Util.round(board.width * Math.random(), 5)
        this.y = Util.round(board.height * Math.random(), 5);
        this.dlBound = [0, 0];
        this.urBound = [board.width, board.height];
        this.velocity = [0, 0];
        this.stepVector = [0, 0];
        this.repulsionPoints = [];
        this.time = 0;
        this.lastStepTime = this.time - this.stepDurration - 1;
        this.timeOfRemoval;
        this.timeOfInfection;
        this.isSymptomatic = false;
    }

    updatePosition(force, dt) {
        this.velocity = Util.vectSum(Util.vectMult(dt, force), this.velocity);

        // limit speed
        var speed = Util.norm(this.velocity)
        if (speed > this.max_speed) {
            this.velocity = Util.vectMult(this.max_speed / speed, this.velocity);
        }

        this.move(Util.vectMult(dt, this.velocity));
        this.time += dt;
    }

    calculateNetForce(socialDistanceIntensity) {
        var netForce = [0, 0];

        // walking
        if (this.stepSize != 0) {
            netForce = Util.vectSum(netForce, this.calculateStepForce());
        }

        // social distancing
        if (this.socialDistanceIntensity != 0) {
            netForce = Util.vectSum(netForce, this.calculateSocialDistanceForce(socialDistanceIntensity));
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

    calculateSocialDistanceForce(intensity) {
        var repulsionForce = [0, 0];
        var minDist = Infinity;

        for (const repulsionPoint of this.repulsionPoints) {
            var toPoint = [repulsionPoint[0] - this.x, repulsionPoint[1] - this.y];
            var dist = Util.norm(toPoint);

            if (0 < dist < minDist) {
                minDist = dist;
            }

            // adds step vector component to netForceVector
            if (dist > 0) {
                repulsionForce = Util.vectSum(repulsionForce, Util.vectMult(-intensity / Util.pow(dist, 3), toPoint));
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
            } else if (infectivity = Infectivity.R) {
                this.timeOfRemoval = this.time;
                this.isSymptomatic = false;
            }
        }
    }

    toString() {
        return "(" + this.x + ", " + this.y + ")";
    }

    draw(context) {
        context.beginPath();
        if (this.isSymptomatic) {
            context.arc(this.x, this.y, Simulation.config.nodeRadius - 1, 0, 2 * Math.PI, false);
            context.lineWidth = 3;
            context.strokeStyle = Simulation.config.colors[Infectivity.I];
            context.stroke();
        } else {
            context.arc(this.x, this.y, Simulation.config.nodeRadius, 0, 2 * Math.PI, false);
            context.fillStyle = Simulation.config.colors[this.infectivity];
            context.fill();
        }
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
        "Population": {
            "default": 5,
        },
        "PInfectedOnContact": {
            "default": 0.20,
        },
        "InfectionRadius": {
            "default": 10,
        },
        "InfectionDurration": {
            "default": 100,
        },
        "PSymptomaticOnInfection": {
            "default": 0.8,
        },
        "SocialDistanceIntensity": {
            "default": 0,
        },
        "PercentSocialDistancing": {
            "default": 100,
        },
        "SocialDistancingThreshold": {
            "default": 10,
        },
        "Avoider": {
            "default": null,
        },
        "Avoided": {
            "default": null,
        },
    },
    nodeUtil: {
        Everyone: function (node) {
            return true;
        },
        Susceptible: function (node) {
            return node.infectivity == Infectivity.S;
        },
        Infected: function (node) {
            return node.infectivity == Infectivity.I;
        },
        Removed: function (node) {
            return node.infectivity == Infectivity.R;
        },
        Symptomatic: function (node) {
            return node.isSymptomatic;
        },
    }
}


function startGame() {
    setupUI();
    Simulation.setupCanvas();
    Simulation.setupBoard();
    this.interval = setInterval(update, 20)
    // console.log(Simulation.board.toString());
}

function update() {
    Simulation.board.updatePopulation(Simulation.inputs.Population.u.value);
    Simulation.board.updateContagion(
        Simulation.inputs.InfectionRadius.u.value * 10,
        Simulation.inputs.PInfectedOnContact.u.value,
        Simulation.inputs.InfectionDurration.u.value,
        Simulation.inputs.PSymptomaticOnInfection.u.value
    );
    Simulation.board.updateBehavior(
        Simulation.inputs.SocialDistanceIntensity.u.value * 5000,
        Simulation.inputs.PercentSocialDistancing.u.value,
        Simulation.inputs.SocialDistancingThreshold.u.value,
        Simulation.nodeUtil[Simulation.inputs.Avoider.u.value],
        Simulation.nodeUtil[Simulation.inputs.Avoided.u.value]
    );
    Simulation.board.iterate(1);
}


function setupInput(id) {
    // finds slider input and output
    Simulation.inputs[id].u = document.getElementById("u" + id);
    Simulation.inputs[id].o = document.getElementById("o" + id);

    // sets slider default if one is specified
    if (Simulation.inputs[id].defaut != null) {
        Simulation.inputs[id].u.value = Simulation.inputs[id].defaut;
    }

    if (Simulation.inputs[id].o != null) {
        Simulation.inputs[id].o.innerHTML = Simulation.inputs[id].u.value;

        // asigns slider updating rule
        Simulation.inputs[id].u.oninput = function () {
            Simulation.inputs[id].o.innerHTML = this.value;
        }
    }
    // }
}

function setupUI() {
    for (const input in Simulation.inputs) {
        setupInput(input);
    }
    document.getElementById("uInfect").onclick = function () { Simulation.board.infectRandomNode() };
}

var rangeslider = document.getElementById("uPopulation");
var output = document.getElementById("oPopulation");
output.innerHTML = rangeslider.value;

rangeslider.oninput = function () {
    output.innerHTML = this.value;
} 

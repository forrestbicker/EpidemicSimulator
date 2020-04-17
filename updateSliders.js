// sliders = {
//     "Population": {
//         "default": 5,
//     },
// }

// function setupSlider(id) {
//     // finds slider input and output
//     sliders[id]["u"] = document.getElementById("u" + id);
//     sliders[id]["o"] = document.getElementById("o" + id);

//     // sets slider default
//     sliders[id]["u"].value = sliders[id]["default"];
//     sliders[id]["o"].innerHTML = sliders[id]["u"].value;

//     // asigns slider updating rule
//     sliders[id]["u"].oninput = function () {
//         sliders[id]["o"].innerHTML = this.value;
//     }

// }

// for (const slider in sliders) {
//     setupSlider(slider);
// }

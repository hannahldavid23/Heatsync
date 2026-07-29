let rotationTime = 45;

const positions = [
  "Cash 1",
  "Cash 2",
  "IPOS 1",
  "IPOS 2",
  "IPOS 3",
  "IPOS 4",
  "Expo 1",
  "Expo 2"
];


function setRotation(minutes) {
  rotationTime = minutes;

  document.getElementById("rotationDisplay").innerText =
    "Current Rotation: " + minutes + " Minutes";
}


function loadPositions() {

  const container = document.getElementById("positions");

  positions.forEach(position => {

    const card = document.createElement("div");

    card.className = "position-card";

    card.innerHTML = `
      <h3>${position}</h3>

      <label>Outside Employee</label>
      <input 
        id="${position}-outside"
        placeholder="Outside name"
      >

      <label>Inside Partner</label>
      <input 
        id="${position}-inside"
        placeholder="Inside name"
      >
    `;

    container.appendChild(card);

  });

}


function startShift(){

  const shiftData = [];

  positions.forEach(position => {

    const outside =
      document.getElementById(`${position}-outside`).value;

    const inside =
      document.getElementById(`${position}-inside`).value;


    shiftData.push({
      position: position,
      outside: outside,
      inside: inside,
      timer: rotationTime
    });

  });


  localStorage.setItem(
    "heatSyncShift",
    JSON.stringify(shiftData)
  );


  alert(
    "🔥 HeatSync Shift Started!\n\nRotation: "
    + rotationTime
    + " minutes"
  );

}


window.onload = loadPositions;

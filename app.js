let rotationTime = 45;
let shiftData = [];
let timerIntervals = {};

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

      <input id="${position}-outside"
      placeholder="Outside employee">

      <input id="${position}-inside"
      placeholder="Inside partner">
    `;

    container.appendChild(card);

  });

}


function startShift(){

  shiftData = [];

  positions.forEach(position => {

    const outside =
    document.getElementById(`${position}-outside`).value || "None";

    const inside =
    document.getElementById(`${position}-inside`).value || "None";


    shiftData.push({

      position,
      outside,
      inside,

      secondsRemaining:
      rotationTime * 60

    });

  });


  document.querySelector(".card").style.display = "none";
  document.getElementById("dashboard").style.display = "block";

  document.getElementById("dashboardRotation").innerText =
  "Current Rotation: " + rotationTime + " Minutes";


  renderDashboard();

}


function renderDashboard(){

const container =
document.getElementById("dashboardPositions");

container.innerHTML="";


shiftData.forEach((person,index)=>{


const card=document.createElement("div");

card.className="position-card";


card.innerHTML=`

<h3>${person.position}</h3>

<p>
Outside: <b>${person.outside}</b>
</p>

<p>
Inside: <b>${person.inside}</b>
</p>

<h2 id="timer-${index}">
${formatTime(person.secondsRemaining)}
</h2>


<button onclick="switchConfirm(${index})">
I’M BACK — START PARTNER TIMER
</button>

`;


container.appendChild(card);


startTimer(index);


});


}



function startTimer(index){

clearInterval(timerIntervals[index]);


timerIntervals[index]=setInterval(()=>{


shiftData[index].secondsRemaining--;


const timer =
document.getElementById(`timer-${index}`);


if(timer){

timer.innerText =
formatTime(shiftData[index].secondsRemaining);


if(shiftData[index].secondsRemaining <=0){

timer.innerText =
"🔴 OVERDUE " +
formatTime(Math.abs(
shiftData[index].secondsRemaining
));

playAlert();

}

}


},1000);

}



function switchConfirm(index){

const person = shiftData[index];


const confirmSwitch =
confirm(
person.outside +
" is back.\n\nStart timer for "
+ person.inside +
"?"
);


if(confirmSwitch){

const oldOutside = person.outside;

person.outside = person.inside;

person.inside = oldOutside;


person.secondsRemaining =
rotationTime * 60;


renderDashboard();

}

}



function formatTime(seconds){

let minutes=Math.floor(seconds/60);

let secs=seconds%60;


return minutes +
":" +
secs.toString().padStart(2,"0");

}


function playAlert(){

const sound =
new Audio(
"https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
);

sound.play();

}


window.onload=loadPositions;

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

  if(document.getElementById("dashboardRotation")){
    document.getElementById("dashboardRotation").innerText =
    "Current Rotation: " + minutes + " Minutes (New switches)";
  }

}



function loadPositions(){

  const container =
  document.getElementById("positions");

  container.innerHTML = "";

  positions.forEach(position => {

    const card = document.createElement("div");

    card.className = "position-card";

    card.innerHTML = `

      <h3>${position}</h3>

      <input id="${position}-outside"
      placeholder="Outside Employee">

      <input id="${position}-inside"
      placeholder="Inside Partner">

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

      position: position,
      outside: outside,
      inside: inside,
      secondsRemaining: rotationTime * 60

    });


  });


  document.getElementById("setupCard").style.display="none";
  document.getElementById("teamSetup").style.display="none";
  document.querySelector(".start-button").style.display="none";

  document.getElementById("dashboard").style.display="block";


  renderDashboard();

}




function renderDashboard(){

  const container =
  document.getElementById("dashboardPositions");

  container.innerHTML = "";


  updateAttentionBanner();


  shiftData.forEach((person,index)=>{


    let status = "green";


    if(person.secondsRemaining <= 300 &&
       person.secondsRemaining > 0){

      status = "yellow";

    }


    if(person.secondsRemaining <= 0){

      status = "red";

    }



    const card = document.createElement("div");

    card.className =
    "position-card " + status;



    card.innerHTML = `

      <h2>${person.position}</h2>

      <p>
      Outside:
      <b>${person.outside}</b>
      </p>


      <p>
      Inside:
      <b>${person.inside}</b>
      </p>


      <h1>

      ${
        person.secondsRemaining <= 0

        ?

        "🔴 SWITCH NOW<br>OVERDUE " +
        formatTime(Math.abs(person.secondsRemaining))

        :

        formatTime(person.secondsRemaining)

      }

      </h1>



      <button onclick="switchConfirm(${index})">

      I'M BACK — START PARTNER TIMER

      </button>

    `;


    container.appendChild(card);


    startTimer(index);


  });

}




function startTimer(index){

  clearInterval(timerIntervals[index]);


  timerIntervals[index] = setInterval(()=>{


    shiftData[index].secondsRemaining--;


    renderDashboard();


  },1000);


}





function switchConfirm(index){


  const person = shiftData[index];


  const answer = confirm(

    "CONFIRM SWITCH\n\n" +

    person.outside +

    " is back inside.\n\n" +

    person.inside +

    " is now outside.\n\n" +

    "Start " +

    rotationTime +

    " minute timer?"

  );



  if(answer){


    const oldOutside =
    person.outside;


    person.outside =
    person.inside;


    person.inside =
    oldOutside;



    person.secondsRemaining =
    rotationTime * 60;


    renderDashboard();

  }


}





function updateAttentionBanner(){

  const banner =
  document.getElementById("attentionBanner");


  if(!banner) return;


  let alerts = [];



  shiftData.forEach(person=>{


    if(person.secondsRemaining <= 0){


      alerts.push(

        "🚨 " +
        person.position +
        ": " +
        person.outside +
        " switch with " +
        person.inside +
        " — OVERDUE " +
        formatTime(Math.abs(person.secondsRemaining))

      );


    }


  });



  if(alerts.length === 0){


    banner.innerHTML =
    "✅ ALL ROTATIONS ON TRACK";


    banner.style.background =
    "#dcfce7";


  }

  else{


    banner.innerHTML =
    alerts.join("<br><br>");


    banner.style.background =
    "#fee2e2";


  }



  banner.style.padding = "20px";

  banner.style.borderRadius = "15px";

  banner.style.fontSize = "22px";

  banner.style.fontWeight = "bold";


}





function formatTime(seconds){

  let minutes =
  Math.floor(seconds / 60);


  let secs =
  seconds % 60;


  return minutes +
  ":" +
  secs.toString().padStart(2,"0");

}




window.onload = loadPositions;

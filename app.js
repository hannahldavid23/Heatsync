let rotationTime = 45;
let shiftData = [];
let timerIntervals = {};
let timersPaused = false;
let alertedPositions = [];


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



function loadPositions(){

  const container =
  document.getElementById("positions");

  container.innerHTML = "";


  positions.forEach(position=>{


    let card=document.createElement("div");

    card.className="position-card";


    card.innerHTML=`

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

  shiftData=[];


  positions.forEach(position=>{


    let outside =
    document.getElementById(`${position}-outside`).value || "None";


    let inside =
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


  document.getElementById("dashboardRotation").innerText =
  "Current Rotation: " + rotationTime + " Minutes";


  renderDashboard();

}







function renderDashboard(){

  const container =
  document.getElementById("dashboardPositions");


  container.innerHTML="";


  updateAttentionBanner();



  shiftData.forEach((person,index)=>{


    let status="green";


    if(person.secondsRemaining <=300 &&
       person.secondsRemaining >0){

      status="yellow";

    }


    if(person.secondsRemaining <=0){

      status="red";

    }



    let card=document.createElement("div");


    card.className =
    "position-card " + status;



    card.innerHTML=`

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
      person.secondsRemaining <=0

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


  });


  startTimers();

}







function startTimers(){


  Object.values(timerIntervals).forEach(timer=>{
    clearInterval(timer);
  });


  timerIntervals={};



  shiftData.forEach((person,index)=>{


    timerIntervals[index]=setInterval(()=>{


      if(timersPaused){
        return;
      }


      person.secondsRemaining--;


      renderDashboard();


    },1000);


  });


}







function changeShiftRotation(minutes){


  let oldRotation =
  rotationTime;


  let difference =
  oldRotation - minutes;


  rotationTime = minutes;



  shiftData.forEach(person=>{


    person.secondsRemaining =
    Math.max(
      0,
      person.secondsRemaining - (difference * 60)
    );


  });



  document.getElementById("dashboardRotation").innerText =
  "Current Rotation: " + minutes + " Minutes";


  document.getElementById("rotationMessage").innerText =
  "🔥 Heat increased. Timers adjusted from "
  + oldRotation +
  " to "
  + minutes +
  " minutes.";



  renderDashboard();

}







function pauseTimers(){

  timersPaused=true;


  document.getElementById("pauseMessage").innerText =
  "⏸ HEATSYNC PAUSED — TIMERS FROZEN";

}





function resumeTimers(){

  timersPaused=false;


  document.getElementById("pauseMessage").innerText =
  "🔥 HEATSYNC ACTIVE";

}







function switchConfirm(index){


  let person =
  shiftData[index];


  let answer = confirm(

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


    let oldOutside =
    person.outside;


    person.outside =
    person.inside;


    person.inside =
    oldOutside;


    person.secondsRemaining =
    rotationTime * 60;



    alertedPositions =
    alertedPositions.filter(
      item => item !== person.position
    );


    renderDashboard();


  }

}







function announceSwitch(person){


  if(alertedPositions.includes(person.position)){
    return;
  }


  alertedPositions.push(person.position);



  let message =
  person.position +
  ". " +
  person.outside +
  " switch with " +
  person.inside;



  let speech =
  new SpeechSynthesisUtterance(message);


  speech.rate = 1;

  speech.pitch = 1;


  window.speechSynthesis.speak(speech);



  let beep =
  new Audio(
  "https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
  );


  beep.play();


}







function updateAttentionBanner(){


let banner =
document.getElementById("attentionBanner");


if(!banner){
return;
}



let alerts=[];



shiftData.forEach(person=>{


if(person.secondsRemaining <=0){


announceSwitch(person);



alerts.push(

"🚨 " +
person.position +
"<br>" +

person.outside +
" switch with " +
person.inside +

"<br>OVERDUE " +

formatTime(Math.abs(person.secondsRemaining))

);


}


});



if(alerts.length===0){


banner.innerHTML =
"✅ ALL ROTATIONS ON TRACK";


banner.style.background="#dcfce7";

banner.style.color="#166534";


}

else{


banner.innerHTML =
alerts.join("<br><br>");


banner.style.background="#fee2e2";

banner.style.color="#991b1b";


}



banner.style.padding="25px";

banner.style.borderRadius="18px";

banner.style.fontSize="24px";

banner.style.fontWeight="bold";

banner.style.textAlign="center";


}







function formatTime(seconds){

let minutes =
Math.floor(seconds/60);


let secs =
seconds % 60;


return minutes +
":" +
secs.toString().padStart(2,"0");

}




window.onload = loadPositions;

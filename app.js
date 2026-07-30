// 🔥 HEATSYNC v2.0
// Main Application Controller


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



let rotationTime = 45;

let shiftData = [];

let timersPaused = false;



// =========================
// STARTUP
// =========================


window.onload = function(){


loadPositionsUI(positions);


loadSavedShift();


startTimerEngine();


};




// =========================
// SHIFT CREATION
// =========================


function startShift(){


shiftData = [];


positions.forEach(position=>{


let outside =
document.getElementById(
`${position}-outside`
).value;


let inside =
document.getElementById(
`${position}-inside`
).value;



// Ignore completely empty positions

if(!outside && !inside){

return;

}



shiftData.push({

position: position,

outside: outside || "None",

inside: inside || "None",

status:"scheduled",

switchTime:null

});


});



saveCurrentShift();


showDashboard();


renderDashboard();


}
// =========================
// SAVE / LOAD
// =========================


function saveCurrentShift(){

saveShiftData(
shiftData,
rotationTime,
timersPaused
);

}




function loadSavedShift(){


let data =
loadShiftData();


if(!data){

return;

}



rotationTime =
data.rotationTime || 45;


shiftData =
data.shiftData || [];


timersPaused =
data.timersPaused || false;



if(shiftData.length > 0){


showDashboard();


renderDashboard();


updateAttentionBanner();


startTimerEngine();


}
}




function endShift(){


shiftData = [];

timersPaused = false;


clearShiftData();


clearDashboard();


location.reload();


}
// =========================
// DASHBOARD RENDERING
// =========================


function renderDashboard(){


const container =
document.getElementById("dashboardPositions");


if(!container){

return;

}



container.innerHTML = "";



shiftData.forEach((person,index)=>{



// Only show active positions
// on the team dashboard


if(person.status !== "active"){

return;

}



let seconds =
Math.floor(
(person.switchTime - Date.now()) / 1000
);



let statusClass = "green";



if(seconds <= 300 && seconds > 0){

statusClass = "yellow";

}



if(seconds <= 0){

statusClass = "red";

}



let card =
document.createElement("div");


card.className =
"position-card " + statusClass;



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
seconds <= 0

?

"🔴 SWITCH NOW<br>" +
formatTime(Math.abs(seconds))

:

formatTime(seconds)

}

</h1>


<button onclick="switchConfirm(${index})">

I'M BACK

</button>


`;



container.appendChild(card);



});



renderManagerConsole();


}





function formatTime(seconds){


if(seconds < 0){

seconds = 0;

}



let minutes =
Math.floor(seconds / 60);


let secs =
seconds % 60;



return minutes +
":" +
secs.toString().padStart(2,"0");


}
// =========================
// MANAGER CONSOLE
// =========================


function renderManagerConsole(){


const container =
document.getElementById("managerPositions");


if(!container){

return;

}



container.innerHTML = "";



shiftData.forEach((person,index)=>{


let card =
document.createElement("div");


card.className =
"position-card";



let buttonText = "";



if(person.status === "scheduled"){


buttonText = `

<button onclick="activatePosition(${index})">

ACTIVATE

</button>

`;


}



if(person.status === "active"){


buttonText = `

<p>🟢 ACTIVE</p>

<button onclick="finishPosition(${index})">

END POSITION

</button>

`;

}



if(person.status === "finished"){


buttonText = `

<p>⚫ FINISHED</p>

`;

}



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


${buttonText}


`;



container.appendChild(card);


});


}





// =========================
// POSITION ACTIVATION
// =========================


function activatePosition(index){


let person =
shiftData[index];



person.status = "active";


person.switchTime =
Date.now() +
(rotationTime * 60 * 1000);



saveCurrentShift();


renderDashboard();


}





function finishPosition(index){


let person =
shiftData[index];


person.status = "finished";


person.switchTime = null;



saveCurrentShift();


renderDashboard();


}
// =========================
// TIMER ENGINE
// =========================


let timerInterval = null;



function startTimerEngine(){


if(timerInterval){

clearInterval(timerInterval);

}



timerInterval =
setInterval(()=>{


if(!timersPaused){


checkAlerts();

renderDashboard();


}


},1000);



}




function pauseTimers(){


timersPaused = true;


saveCurrentShift();


let msg =
document.getElementById("pauseMessage");


if(msg){

msg.innerText =
"⏸ HEATSYNC PAUSED";

}


}




function resumeTimers(){


timersPaused = false;


saveCurrentShift();


let msg =
document.getElementById("pauseMessage");


if(msg){

msg.innerText =
"🔥 HEATSYNC ACTIVE";

}


renderDashboard();


}
// =========================
// ROTATION SWITCH
// =========================


function switchConfirm(index){


let person =
shiftData[index];



if(!person){

return;

}



let oldOutside =
person.outside;



person.outside =
person.inside;


person.inside =
oldOutside;



person.switchTime =
Date.now() +
(rotationTime * 60 * 1000);



saveCurrentShift();



renderDashboard();


}
// =========================
// ALERT SYSTEM
// =========================


let announcedSwitches = [];



function checkAlerts(){


shiftData.forEach(person=>{


if(person.status !== "active"){

return;

}



let seconds =
Math.floor(
(person.switchTime - Date.now()) / 1000
);



if(seconds <= 0){


if(
!announcedSwitches.includes(person.position)
){



let message =
person.outside +
", it's time to switch with " +
person.inside +
" at " +
person.position;



speakSwitch(message);


playAlertSound();



announcedSwitches.push(
person.position
);



}


}


});


}

// =========================
// ROTATION CONTROLS
// =========================

function setRotation(minutes){

rotationTime = minutes;


let display =
document.getElementById("rotationDisplay");


if(display){

display.innerText =
"Current Rotation: " + minutes + " Minutes";

}


saveCurrentShift();

}



function changeShiftRotation(minutes){


let oldRotation =
rotationTime;


rotationTime = minutes;



shiftData.forEach(person=>{


if(person.status === "active"){


let remaining =
person.switchTime - Date.now();


let newRemaining =
remaining * (minutes / oldRotation);


person.switchTime =
Date.now() + newRemaining;


}


});



updateDashboardHeader(rotationTime);


saveCurrentShift();


renderDashboard();


}

// =========================
// ATTENTION BANNER
// =========================


function updateAttentionBanner(){


let banner =
document.getElementById("attentionBanner");


if(!banner){

return;

}



let alerts = [];



shiftData.forEach(person=>{


if(person.status !== "active"){

return;

}



let seconds =
Math.floor(
(person.switchTime - Date.now()) / 1000
);



if(seconds <= 0){


alerts.push(

"🚨 " +
person.position +
"<br>" +

person.outside +
" switch with " +
person.inside +

"<br>OVERDUE " +

formatTime(Math.abs(seconds))

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



banner.style.padding =
"25px";


banner.style.borderRadius =
"18px";


banner.style.fontSize =
"24px";


banner.style.fontWeight =
"bold";


banner.style.textAlign =
"center";


}

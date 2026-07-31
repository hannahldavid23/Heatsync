function loadPositionsUI(positions){

const container =
document.getElementById("positions");


if(!container) return;


container.innerHTML="";


positions.forEach(position=>{


let card =
document.createElement("div");


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




function showDashboard(){

let setup =
document.getElementById("setupCard");

let team =
document.getElementById("teamSetup");

let button =
document.querySelector(".start-button");

let dashboard =
document.getElementById("dashboard");


if(setup)
setup.style.display="none";


if(team)
team.style.display="none";


if(button)
button.style.display="none";


if(dashboard)
dashboard.style.display="block";


}




function updateDashboardHeader(rotationTime){

let dashRotation =
document.getElementById("dashboardRotation");


if(dashRotation){

dashRotation.innerText =
"Current Rotation: " + rotationTime + " Minutes";

}

}




function clearDashboard(){

let container =
document.getElementById("dashboardPositions");


if(container){

container.innerHTML="";

}

}

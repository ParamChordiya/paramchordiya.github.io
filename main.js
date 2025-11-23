var audio = document.getElementById("audioPlayer"),
  loader = document.getElementById("preloader");

function settingtoggle() {
  document.getElementById("setting-container").classList.toggle("settingactivate"),
    document
      .getElementById("visualmodetogglebuttoncontainer")
      .classList.toggle("visualmodeshow"),
    document
      .getElementById("soundtogglebuttoncontainer")
      .classList.toggle("soundmodeshow");
}

function playpause() {
  false == document.getElementById("switchforsound").checked
    ? audio.pause()
    : audio.play();
}

function visualmode() {
  document.body.classList.toggle("light-mode"),
    document.querySelectorAll(".needtobeinvert").forEach(function (e) {
      e.classList.toggle("invertapplied");
    });
}

window.addEventListener("load", function () {
  loader.style.display = "none";
  document.querySelector(".hey").classList.add("popup");
});

let mobileTogglemenu = document.getElementById("mobiletogglemenu");
function hamburgerMenu() {
  document.body.classList.toggle("stopscrolling"),
    document
      .getElementById("mobiletogglemenu")
      .classList.toggle("show-toggle-menu"),
    document
      .getElementById("burger-bar1")
      .classList.toggle("hamburger-animation1"),
    document
      .getElementById("burger-bar2")
      .classList.toggle("hamburger-animation2"),
    document
      .getElementById("burger-bar3")
      .classList.toggle("hamburger-animation3");
}

function hidemenubyli() {
  document.body.classList.toggle("stopscrolling"),
    document
      .getElementById("mobiletogglemenu")
      .classList.remove("show-toggle-menu"),
    document
      .getElementById("burger-bar1")
      .classList.remove("hamburger-animation1"),
    document
      .getElementById("burger-bar2")
      .classList.remove("hamburger-animation2"),
    document
      .getElementById("burger-bar3")
      .classList.remove("hamburger-animation3");
}

const sections = document.querySelectorAll("section"),
  navLi = document.querySelectorAll(".navbar .navbar-tabs .navbar-tabs-ul li"),
  mobilenavLi = document.querySelectorAll(
    ".mobiletogglemenu .mobile-navbar-tabs-ul li"
  );

window.addEventListener("scroll", () => {
  let current = "";
  sections.forEach((section) => {
    let sectionTop = section.offsetTop;
    // You can adjust "200" to tweak when the active state updates
    if (pageYOffset >= sectionTop - 200) {
      current = section.getAttribute("id");
    }
  });

  mobilenavLi.forEach((li) => {
    li.classList.remove("activeThismobiletab");
    if (li.classList.contains(current)) {
      li.classList.add("activeThismobiletab");
    }
  });

  navLi.forEach((li) => {
    li.classList.remove("activeThistab");
    if (li.classList.contains(current)) {
      li.classList.add("activeThistab");
    }
  });
});

console.log(
  "%c Param's Portfolio ",
  "background-image: linear-gradient(90deg,#8000ff,#6bc5f8); color: white;font-weight:900;font-size:1rem; padding:20px;"
);

let mybutton = document.getElementById("backtotopbutton");
function scrollFunction() {
  document.body.scrollTop > 400 || document.documentElement.scrollTop > 400
    ? (mybutton.style.display = "block")
    : (mybutton.style.display = "none");
}
function scrolltoTopfunction() {
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;
}
window.onscroll = function () {
  scrollFunction();
};

// Prevent right-click on images
document.addEventListener(
  "contextmenu",
  function (e) {
    if (e.target.nodeName === "IMG") {
      e.preventDefault();
    }
  },
  false
);

// Eye tracking in footer
let Pupils = document.getElementsByClassName("footer-pupil"),
  pupilsArr = Array.from(Pupils),
  pupilStartPoint = -10,
  pupilRangeX = 20,
  pupilRangeY = 15,
  mouseXStartPoint = 0,
  mouseXEndPoint = window.innerWidth,
  currentXPosition = 0,
  fracXValue = 0,
  mouseYEndPoint = window.innerHeight,
  currentYPosition = 0,
  fracYValue = 0,
  mouseXRange = mouseXEndPoint - mouseXStartPoint;

const mouseMove = (e) => {
  currentXPosition = e.clientX - mouseXStartPoint;
  fracXValue = currentXPosition / mouseXRange;
  currentYPosition = e.clientY;
  fracYValue = currentYPosition / mouseYEndPoint;

  let translateX = pupilStartPoint + fracXValue * pupilRangeX;
  let translateY = pupilStartPoint + fracYValue * pupilRangeY;

  pupilsArr.forEach((pupil) => {
    pupil.style.transform = `translate(${translateX}px, ${translateY}px)`;
  });
};

const windowResize = (e) => {
  mouseXEndPoint = window.innerWidth;
  mouseYEndPoint = window.innerHeight;
  mouseXRange = mouseXEndPoint - mouseXStartPoint;
};

window.addEventListener("mousemove", mouseMove);
window.addEventListener("resize", windowResize);

// (Optional) Function to load random images from Unsplash
// You can remove if you don't need random images loaded dynamically
function loadRandomImages() {
  const imageElements = document.querySelectorAll(".dynamic-img");
  const topics = ["technology", "programming", "coding", "computer", "developer"];

  imageElements.forEach((img) => {
    const randomTopic = topics[Math.floor(Math.random() * topics.length)];
    const width = img.parentElement.classList.contains("large")
      ? 1200
      : img.parentElement.classList.contains("medium")
      ? 800
      : 400;
    const height =
      width *
      (img.parentElement.classList.contains("small") ? 1 : 9 / 16);

    img.src = `https://source.unsplash.com/random/${width}x${height}?${randomTopic}`;
  });
}

// document.addEventListener('DOMContentLoaded', loadRandomImages);
// setInterval(loadRandomImages, 300000); // Refresh every 5 minutes
(() => {
  "use strict";
  const forms = document.querySelectorAll(".needs-validation");
  Array.from(forms).forEach((form) => {
    form.addEventListener(
      "submit",
      (event) => {
        if (!form.checkValidity()) {
          event.preventDefault();
          event.stopPropagation();
        }
        form.classList.add("was-validated");
      },
      false
    );
  });
})();

let taxSwitch = document.getElementById("flexSwitchCheckDefault");
if (taxSwitch) {
  taxSwitch.addEventListener("click", () => {
    let taxInfo = document.getElementsByClassName("tax-info");
    for (info of taxInfo) {
      if (info.style.display != "inline") {
        info.style.display = "inline";
      } else {
        info.style.display = "none";
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  const leftBtn = document.querySelector(".left-btn");
  const rightBtn = document.querySelector(".right-btn");
  const filtersContainer = document.getElementById("filters-container");

  if (leftBtn && rightBtn && filtersContainer) {
    const filterWidth = document.querySelector(".filter").offsetWidth + 32;

    leftBtn.addEventListener("click", function () {
      filtersContainer.scrollLeft -= filterWidth;
    });

    rightBtn.addEventListener("click", function () {
      filtersContainer.scrollLeft += filterWidth;
    });
  }
});

document.addEventListener("DOMContentLoaded", function () {
  const container = document.getElementById("filters-container");

  if (container) {
    let startX;
    let scrollLeft;

    container.addEventListener("touchstart", (e) => {
      startX = e.touches[0].pageX;
      scrollLeft = container.scrollLeft;
    });

    container.addEventListener("touchmove", (e) => {
      const x = e.touches[0].pageX;
      const walk = startX - x;
      container.scrollLeft = scrollLeft + walk;
    });
  }
});

// API FDA
const API = "https://api.fda.gov";
const RESULTS_PER_PAGE = 6;

// Get the Anime.js methods 
const {
  animate,
  stagger,
  utils
} = anime;

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

// Page elements
const totalRecallsElement = document.getElementById("totalRecalls");
const recallSearchForm = document.getElementById("recallSearchForm");
const productTypeElement = document.getElementById("productType");
const searchTermElement = document.getElementById("searchTerm");
const recallClassElement = document.getElementById("recallClass");
const searchStatusElement = document.getElementById("searchStatus");
const recallCardsElement = document.getElementById("recallCards");
const loadMoreButton = document.getElementById("loadMoreButton");
const errorMessageElement = document.getElementById("errorMessage");

const recallDetailsDialog = document.getElementById(
  "recallDetailsDialog"
);

const recallDetailsTitle = document.getElementById(
  "recallDetailsTitle"
);

const recallDetailsBody = document.getElementById(
  "recallDetailsBody"
);

const closeDetailsButton = document.getElementById(
  "closeDetailsButton"
);

// Protects recall text before adding it to the page.
function escapeHtml(text) {
  return String(text ?? "").replace(
    /[&<>"']/g,
    character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]
  );
}
// FDA recall classes
// Class I is the most serious and may cause serious health problems or death.
// Class II may cause temporary or medically reversible health problems.
// Class III is unlikely to cause health problems.
const recallClassColors = {
  "Class I": "var(--classOneColor)",
  "Class II": "var(--classTwoColor)",
  "Class III": "var(--classThreeColor)"
};

// Meanings of the FDA recall classes
const recallClassMeanings = {
  "Class I":
    "Most serious: reasonable chance of serious health problems or death.",

  "Class II":
    "May cause temporary or medically reversible health problems.",

  "Class III":
    "Unlikely to cause health problems."
};

// Stores the current page data and search choices.
// Current search information, default 
let recallResults = [];
let numberOfSkippedResults = 0;
let totalNumberOfRecalls = 0;
let previouslyShownRecallTotal = 0;

let currentSearch = {
  productType: "food",
  recallClass: "",
  searchTerm: ""
};


// Changes dates into a readable date.
function formatDate(date) {
  if (!/^\d{8}$/.test(date || "")) {
    return "Not listed";
  }

  return new Date(
    Number(date.slice(0, 4)),
    Number(date.slice(4, 6)) - 1,
    Number(date.slice(6))
  ).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}


// Creates the web address used to request recall information.
function buildRecallRequestUrl() {
  const searchConditions = [];

  if (currentSearch.searchTerm) {
    const encodedSearchTerm = encodeURIComponent(
      `"${currentSearch.searchTerm}"`
    );

    searchConditions.push(
      `(product_description:${encodedSearchTerm}+OR+reason_for_recall:${encodedSearchTerm})`
    );
  }

  if (currentSearch.recallClass) {
    const encodedRecallClass = encodeURIComponent(
      `"${currentSearch.recallClass}"`
    );

    searchConditions.push(
      `classification:${encodedRecallClass}`
    );
  }

  const searchQuery = searchConditions.length
    ? `search=${searchConditions.join("+AND+")}&`
    : "";

  return (
    `${API}/${currentSearch.productType}/enforcement.json?` +
    `${searchQuery}` +
    `sort=report_date:desc&` +
    `limit=${RESULTS_PER_PAGE}&` +
    `skip=${numberOfSkippedResults}`
  );
}


// Loads recall information from the Food and Drug Administration.
async function loadRecalls(appendResults) {
  errorMessageElement.hidden = true;
  searchStatusElement.textContent = "Loading…";

  try {
    const response = await fetch(buildRecallRequestUrl());

    if (response.status === 404) {
      recallResults = [];
      totalNumberOfRecalls = 0;

      displayRecallCards(false);

      searchStatusElement.textContent =
        "No recalls matched. Try a different word or class.";

      return;
    }

    if (!response.ok) {
      throw new Error(
        "The Food and Drug Administration returned status " +
        response.status
      );
    }

    const responseData = await response.json();
    const newRecallResults = responseData.results || [];

    totalNumberOfRecalls =
      responseData.meta?.results?.total ??
      newRecallResults.length;

    recallResults = appendResults
      ? recallResults.concat(newRecallResults)
      : newRecallResults;

    displayRecallCards(
      appendResults,
      newRecallResults.length
    );

    searchStatusElement.textContent =
      `Showing ${recallResults.length} of ` +
      `${totalNumberOfRecalls.toLocaleString()}`;
  } catch (error) {
    searchStatusElement.textContent = "";
    errorMessageElement.hidden = false;

    errorMessageElement.textContent =
      "Could not load recalls (" + error.message + 
      ") Please try again";
  }
}


// Creates one recall card for the page
function createRecallCard(recall, recallIndex) {
  const recallClass = recall.classification || "Class III";

  const recallClassColor =
    recallClassColors[recallClass] ||
    "var(--classThreeColor)";

  return `
    <li>
      <button
        type="button"
        data-recall-index="${recallIndex}"
        style="--recallClassColor: ${recallClassColor}">
        <span class="recallClassBadge">
          ${escapeHtml(recallClass)}
        </span>

        <span class="companyName">
          ${escapeHtml(recall.recalling_firm)}
        </span>

        <p class="productDescription">
          ${escapeHtml(recall.product_description)}
        </p>

        <p class="recallMetadata">
          Reported ${formatDate(recall.report_date)}·
          ${escapeHtml(recall.status)}
        </p>
      </button>
    </li>`;
  }


// Displays recall cards on the page
function displayRecallCards(
  appendResults,
  numberOfNewResults = 0
) {
  if (appendResults) {
    const newRecallCards = recallResults
      .slice(-numberOfNewResults)
      .map((recall, position) =>
        createRecallCard(
          recall,
          recallResults.length - numberOfNewResults + position
        )
      )
      .join("");

    recallCardsElement.insertAdjacentHTML(
      "beforeend",
      newRecallCards
    );
  } else {
    recallCardsElement.innerHTML = recallResults
      .map(createRecallCard)
      .join("");
  }

  loadMoreButton.hidden =
    recallResults.length >= totalNumberOfRecalls;

  updateRecallTotal();

  if (prefersReducedMotion) {
    return;
  }

  const newlyDisplayedCards = appendResults
    ? [...recallCardsElement.children].slice(-numberOfNewResults)
    : recallCardsElement.children;

 animate(newlyDisplayedCards, {
  opacity: [0, 1],
  translateY: [24, 0],
  delay: stagger(40),
  duration: 500,
  ease: "outCubic"
  });
}


// Animates the total number of matching recalls.
function updateRecallTotal() {
  if (prefersReducedMotion) {
    totalRecallsElement.textContent =
      totalNumberOfRecalls.toLocaleString();

    previouslyShownRecallTotal = totalNumberOfRecalls;
    return;
  }

  const animatedRecallTotal = {
    number: previouslyShownRecallTotal
  };

animate(animatedRecallTotal, {
  number: totalNumberOfRecalls,
  modifier: utils.round(0),
  duration: 1100,
  ease: "outExpo",

  onUpdate: () => {
    totalRecallsElement.textContent =
      animatedRecallTotal.number.toLocaleString();
  }
});
  previouslyShownRecallTotal = totalNumberOfRecalls;
}
// search button 
recallSearchForm.addEventListener("submit", event => {
  event.preventDefault();

  currentSearch = {
    productType: productTypeElement.value,
    recallClass: recallClassElement.value,
    searchTerm: searchTermElement.value
      .replace(/[^\w\s-]/g, " ")
      .trim()
  };

  numberOfSkippedResults = 0;
  loadRecalls(false);
});


// Loads the next page of results
loadMoreButton.addEventListener("click", () => {
  numberOfSkippedResults += RESULTS_PER_PAGE;
  loadRecalls(true);
});


// Opens the details pop up when a recall card is clicked
recallCardsElement.addEventListener("click", event => {
  const selectedRecallButton = event.target.closest(
    "button[data-recall-index]"
  );

  if (!selectedRecallButton) {
    return;
  }

  const selectedRecall =
    recallResults[selectedRecallButton.dataset.recallIndex];

  const recallClass = selectedRecall.classification || "";

  recallDetailsDialog.style.setProperty(
    "--recallClassColor",
    recallClassColors[recallClass] || "var(--textColor)"
  );

  recallDetailsTitle.textContent =
    selectedRecall.recalling_firm || "Recall";

  const recallDetails = [
    [
      "Class",
      recallClass +
        (
          recallClassMeanings[recallClass]
            ? `: ${recallClassMeanings[recallClass]}`
            : ""
        )
    ],

    ["Status", selectedRecall.status],
    ["Product", selectedRecall.product_description],
    ["Reason", selectedRecall.reason_for_recall],
    ["Where sold", selectedRecall.distribution_pattern],

    [
      "Firm location",
      [
        selectedRecall.city,
        selectedRecall.state,
        selectedRecall.country
      ]
        .filter(Boolean)
        .join(", ")
    ],

    [
      "Recall started",
      formatDate(selectedRecall.recall_initiation_date)
    ],

    [
      "Food and Drug Administration report date",
      formatDate(selectedRecall.report_date)
    ],

    ["Initiated by", selectedRecall.voluntary_mandated],
    ["Recall number", selectedRecall.recall_number]
  ];

  recallDetailsBody.innerHTML = recallDetails
    .filter(detail => detail[1])
    .map(
      ([label, value]) =>
        `<dt>${label}</dt><dd>${escapeHtml(value)}</dd>`
    )
    .join("");

  recallDetailsDialog.showModal();

 if (!prefersReducedMotion) {
  animate("#recallDetailsDialog", {
    scale: [0.94, 1],
    opacity: [0, 1],
    duration: 280,
    ease: "outCubic"
  });
}});

// Closes the recall details pop up 
closeDetailsButton.addEventListener("click", () => {
  recallDetailsDialog.close();
});


// Closes the pop up when clicks outside the container
recallDetailsDialog.addEventListener("click", event => {
  if (event.target === recallDetailsDialog) {
    recallDetailsDialog.close();
  }
});


// DEFAULT: Loads the newest food (6) recalls when the page opens
loadRecalls(false);
// FDA Recall Search
// Loads product recall data from the openFDA API

const API = "https://api.fda.gov";
const RESULTS_PER_PAGE = 6;

// Pull the methods we need out of the Anime.js library
const {
  animate,  
  stagger,  
  utils     
} = anime;


// Page elements 
const matchingRecallsCountElement = document.getElementById("totalRecalls");    
const recallSearchForm = document.getElementById("recallSearchForm");   
const productTypeElement = document.getElementById("productType");       
const searchTermElement = document.getElementById("searchTerm");         
const recallClassElement = document.getElementById("recallClass");       
const searchStatusElement = document.getElementById("searchStatus");     
const recallCardsElement = document.getElementById("recallCards");       
const loadMoreButton = document.getElementById("loadMoreButton");       
const errorMessageElement = document.getElementById("errorMessage");     

// Elements for the details popup 
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

// Converts special HTML characters into safe text 
// prevents text returned by the API from being interpreted as HTML 
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


// Maps each class to a CSS color variable 
const recallClassColors = {
  "Class I": "var(--classOneColor)",
  "Class II": "var(--classTwoColor)",
  "Class III": "var(--classThreeColor)"
};

// FDA recall classes
const recallClassMeanings = {
  "Class I":
    "Most serious: reasonable chance of serious health problems or death.",

  "Class II":
    "May cause temporary or medically reversible health problems.",

  "Class III":
    "Unlikely to cause health problems."
};

// Stores current page data and updates search choices
let recallResults = [];              
let numberOfSkippedResults = 0;       
let matchingRecallsCount = 0;         
let previousMatchingRecallsCount = 0;   


// On default, search for newest food recalls
let currentSearch = {
  productType: "food",
  recallClass: "",
  searchTerm: ""
};


// Reformats date as month, date, year 
function formatDate(date) {
  if (!/^\d{8}$/.test(date || "")) {
    return "Not listed";
  }

  return new Date(
    Number(date.slice(0, 4)),       // year
    Number(date.slice(4, 6)) - 1,   // month 
    Number(date.slice(6))           // day
  ).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

// Creates the web address based on search choices
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
  //combine filters for req
  const searchQuery = searchConditions.length
    ? `search=${searchConditions.join("+AND+")}&`
    : "";

  // Final URL
  return (
    `${API}/${currentSearch.productType}/enforcement.json?` +
    `${searchQuery}` +
    `sort=report_date:desc&` +
    `limit=${RESULTS_PER_PAGE}&` +
    `skip=${numberOfSkippedResults}`
  );
}


// Loads/fetches recall information from the Food and Drug Administration
async function loadRecalls(appendResults) {
  // Show a loading message
  errorMessageElement.hidden = true;
  searchStatusElement.textContent = "Loading…";

  try {
    // Build a URL and send the request to the FDA API
    const response = await fetch(buildRecallRequestUrl());

    // The FDA API returns 404 when a search has no matches
    if (response.status === 404) {
      recallResults = [];
      matchingRecallsCount = 0;

      displayRecallCards(false);

      searchStatusElement.textContent =
        "No recalls matched. Try a different word or class.";

      return;
    }

    // Any other errors
    if (!response.ok) {
      throw new Error(
        "The Food and Drug Administration returned status " + response.status
      );
    }

    // Wait for the response and convert it to JavaScript 
    //Show results on page as cards and update the count of matching recalls
    const responseData = await response.json();
    const newRecallResults = responseData.results || [];

    // Get the total number of matching recalls for this search
    matchingRecallsCount =
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
      `${matchingRecallsCount.toLocaleString()}`;

  } catch (error) {
    searchStatusElement.textContent = "";
    errorMessageElement.hidden = false;

    errorMessageElement.textContent =
      "Could not load recalls (" + error.message +
      ") Please try again";
  }
}

//creates recall cards for each result 
function createRecallCard(recall, recallIndex) {
  const recallClass = recall.classification;
  const recallClassColor = recallClassColors[recallClass];

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

// Displays the recall cards 
// Loads more cards / replaces default cards 
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

  // Hides load more button when there isn't anything else to load
  loadMoreButton.hidden = recallResults.length >= matchingRecallsCount;
  // Update matching results counter
  RecallsCount();

  const newlyDisplayedCards = appendResults
    ? [...recallCardsElement.children].slice(-numberOfNewResults)
    : recallCardsElement.children;

  // Fade the new cards in one after another
  animate(newlyDisplayedCards, {
    opacity: [0, 1],
    delay: stagger(40),   
    duration: 1500,
    ease: "outCubic"
  });
}


// Animates the counter from the previous count to the new one.
function RecallsCount() {
  const animatedCount = {
    number: previousMatchingRecallsCount
  };

  animate(animatedCount, {
    number: matchingRecallsCount,
    modifier: utils.round(0),   
    duration: 2000,
    ease: "outExpo",

    // Counts the number up and adds commas
    onUpdate: () => {
      matchingRecallsCountElement.textContent =
        animatedCount.number.toLocaleString();
    }
  });

  // Saves previous count for updated value 
  previousMatchingRecallsCount = matchingRecallsCount;
}

// Search button
recallSearchForm.addEventListener("submit", event => {
  event.preventDefault();

  currentSearch = {
    productType: productTypeElement.value,
    recallClass: recallClassElement.value,
    searchTerm: searchTermElement.value
      .replaceAll("&", " ")
      .trim()
  };
  numberOfSkippedResults = 0;
  loadRecalls(false);
});


// Loads more results on click 
loadMoreButton.addEventListener("click", () => {
  numberOfSkippedResults += RESULTS_PER_PAGE;
  loadRecalls(true);
});


// Opens the  popup when clicked.
recallCardsElement.addEventListener("click", event => {
  const selectedRecallButton = event.target.closest("button[data-recall-index]"
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

  //Popup Detais
  recallDetailsTitle.textContent =
    selectedRecall.recalling_firm ;
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
    ["Recall started",
      formatDate(selectedRecall.recall_initiation_date)
    ],
    
    ["FDA report date",
      formatDate(selectedRecall.report_date)
    ],
     
    ["Initiated by", selectedRecall.voluntary_mandated],
    ["Where sold", selectedRecall.distribution_pattern],
    ["Firm location",
      [ selectedRecall.city,
        selectedRecall.state,
        selectedRecall.country
      ]
        .filter(Boolean)
        .join(", ")
    ],
    ["Recall number", selectedRecall.recall_number]
  ];

  recallDetailsBody.innerHTML = recallDetails
    .filter(detail => detail[1])
    .map(([label, value]) =>
        `<dt>${label}</dt><dd>${escapeHtml(value)}</dd>`
    )
    .join("");
  recallDetailsDialog.showModal();

// Make the popup grow and fade in when it opens  
  animate("#recallDetailsDialog", {
    scale: [0.7, 1],
    opacity:[0, 1],
    duration: 1200,
    ease: "outCubic"
  });
});
//close popup
closeDetailsButton.addEventListener("click", () => {
  recallDetailsDialog.close();
});

recallDetailsDialog.addEventListener("click", event => {
  if (event.target === recallDetailsDialog) {
    recallDetailsDialog.close();
  }
});
loadRecalls(false);

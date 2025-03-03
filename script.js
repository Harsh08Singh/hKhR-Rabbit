// Constants
const MAX_DATA_POINTS = 20;

// State variables

let sensorData = [];
let orientation = { x: 0, y: 0, z: 0 };
let accelChart, gyroChart;
let encryptionEnabled = true;
let rabbitKey = "00 11 22 33 44 55 66 77 88 99 AA BB CC DD EE FF";
let rabbitIV = "01 23 45 67 89 AB CD EF";
let totalPackets = 0;
let successPackets = 0;
let failedPackets = 0;
let decryptTimes = [];
let rawDataLog = [];
let decryptedDataLog = [];
let encryptVisualization = null;
let decryptVisualization = null;
let stateVisualization = null;

function showError(elementId, message) {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = message;
    element.style.color = "red";
  }
  return false;
}

function clearErrors() {
  const errorElements = document.querySelectorAll(".error");
  errorElements.forEach((element) => {
    element.textContent = "";
  });
}
function requestLatestVisualization() {
  // Don't make any new calls, just update the display with what we already have
  updateVisualizationDisplay();

  // Only request state visualization if we don't have any operation visualizations
  if (!encryptVisualization && !decryptVisualization) {
    updateInternalStateVisualization();
  }
}

let latestEncryptedHex = null;
let latestDecryptedText = null;

function updateVisualizationDisplay() {
  // Update encryption visualization if available
  const encryptVizElement = document.getElementById("encryptionVisualization");
  if (encryptVisualization) {
    renderMathematicalVisualization(encryptVisualization, encryptVizElement);
  } else {
    encryptVizElement.textContent = "No encryption has been performed yet.";
  }

  // Update decryption visualization if available
  const decryptVizElement = document.getElementById("decryptionVisualization");
  if (decryptVisualization) {
    renderMathematicalVisualization(decryptVisualization, decryptVizElement);
  } else {
    decryptVizElement.textContent = "No decryption has been performed yet.";
  }

  // Display internal state visualization
  updateInternalStateVisualization();
}

function renderMathematicalVisualization(visualizationText, containerElement) {
  // Clear the container
  containerElement.innerHTML = "";

  // Store scroll position if this is an update to existing content
  let scrollPosition = 0;
  if (containerElement.dataset.initialized === "true") {
    // Find the content container and get its scroll position
    const existingContent = containerElement.querySelector(
      ".math-content-container"
    );
    if (existingContent) {
      scrollPosition = existingContent.scrollTop;
    }
  }

  // Parse the visualization text
  const lines = visualizationText.split("\n");

  // Group the data by steps and variable types for better organization
  let steps = [];
  let currentStep = null;
  let stepCounter = 0;

  lines.forEach((line) => {
    line = line.trim();
    if (!line) return; // Skip empty lines

    // Check if this is a new step
    if (
      line.startsWith("Step ") ||
      line.toLowerCase().includes("setting key") ||
      line.toLowerCase().includes("initial state") ||
      line.toLowerCase().includes("counter values")
    ) {
      stepCounter++;

      // Extract step title
      let stepTitle = line;
      if (line.includes(":")) {
        stepTitle = line.split(":")[0];
      }

      // Remove any markdown formatting
      stepTitle = stepTitle.replace(/\*\*/g, "");

      // Create new step object
      currentStep = {
        id: stepCounter,
        title: stepTitle,
        dataGroups: [],
      };

      steps.push(currentStep);
    }
    // Check if this is a value entry
    else if (line.includes("=") && currentStep) {
      // Extract data group type (x, c, temp, etc.)
      let groupType = "";

      if (line.startsWith("x[")) {
        groupType = "x";
      } else if (line.startsWith("c[")) {
        groupType = "c";
      } else if (line.startsWith("temp[")) {
        groupType = "temp";
      } else if (line.startsWith("carry")) {
        groupType = "carry";
      } else if (
        line.toLowerCase().includes("output") ||
        line.toLowerCase().includes("keystream")
      ) {
        groupType = "output";
      } else {
        groupType = "other";
      }

      // Find existing group or create new one
      let dataGroup = currentStep.dataGroups.find((g) => g.type === groupType);
      if (!dataGroup) {
        dataGroup = {
          type: groupType,
          values: [],
        };
        currentStep.dataGroups.push(dataGroup);
      }

      // Clean up the line (remove markdown formatting)
      line = line.replace(/\*\*/g, "");

      // Parse the value
      const parts = line.split("=");
      let varName = parts[0].trim();
      let value = parts[1].trim();
      let notes = "";

      // Check for square or other notes
      if (value.includes(",")) {
        const valueParts = value.split(",");
        value = valueParts[0].trim();
        notes = valueParts.slice(1).join(",").trim();
      }

      // Add value to data group
      dataGroup.values.push({
        name: varName,
        value: value,
        notes: notes,
      });
    }
    // Other information (Before/After statements, etc.)
    else if (currentStep) {
      // Process statements like "Before g-function calculation"
      if (line.startsWith("Before") || line.startsWith("After")) {
        const stateType = line.split(":")[0].trim();
        const stateData = line.split(":")[1]?.trim() || "";

        currentStep.dataGroups.push({
          type: "state",
          stateType: stateType,
          stateData: stateData,
        });
      }
      // Any other information lines
      else {
        currentStep.dataGroups.push({
          type: "info",
          value: line,
        });
      }
    }
  });

  // Create main container with modern styling
  const mainContainer = document.createElement("div");
  mainContainer.className = "math-visualization";
  mainContainer.style.fontFamily =
    '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  mainContainer.style.fontSize = "12px";
  mainContainer.style.color = "#333";
  mainContainer.style.backgroundColor = "#f8f9fa";
  mainContainer.style.borderRadius = "8px";
  mainContainer.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
  mainContainer.style.padding = "12px";
  mainContainer.style.maxWidth = "100%";
  mainContainer.style.margin = "0 auto";

  // Add header with title and download button
  const header = document.createElement("div");
  header.className = "math-header";
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";
  header.style.marginBottom = "10px";
  header.style.borderBottom = "1px solid #eaeaea";
  header.style.paddingBottom = "8px";

  const title = document.createElement("h4");
  title.textContent = "Mathematical Process Visualization";
  title.style.margin = "0";
  title.style.fontSize = "14px";
  title.style.fontWeight = "600";

  const downloadBtn = document.createElement("button");
  downloadBtn.className = "math-download-btn";
  downloadBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
    Download
  `;

  // Improved button styling
  downloadBtn.style.display = "inline-flex";
  downloadBtn.style.alignItems = "center";
  downloadBtn.style.gap = "5px";
  downloadBtn.style.background = "#f1f8fe";
  downloadBtn.style.color = "#4361ee";
  downloadBtn.style.border = "1px solid #e1e8ed";
  downloadBtn.style.borderRadius = "4px";
  downloadBtn.style.padding = "4px 8px";
  downloadBtn.style.fontSize = "11px";
  downloadBtn.style.cursor = "pointer";
  downloadBtn.style.transition = "background 0.2s";
  downloadBtn.style.width = "auto";
  downloadBtn.style.height = "auto";
  downloadBtn.style.boxShadow = "none";
  downloadBtn.style.fontWeight = "500";

  // Hover effect
  downloadBtn.onmouseover = function () {
    this.style.background = "#e3f2fd";
  };

  downloadBtn.onmouseout = function () {
    this.style.background = "#f1f8fe";
  };

  header.appendChild(title);
  header.appendChild(downloadBtn);
  mainContainer.appendChild(header);

  // Steps overview
  const stepsOverview = document.createElement("div");
  stepsOverview.className = "math-steps-overview";
  stepsOverview.style.display = "flex";
  stepsOverview.style.justifyContent = "space-between";
  stepsOverview.style.marginBottom = "15px";
  stepsOverview.style.flexWrap = "wrap";

  steps.forEach((step, index) => {
    const stepIndicator = document.createElement("div");
    stepIndicator.className = "math-step-indicator";
    stepIndicator.textContent = `Step ${index + 1}`;
    stepIndicator.style.flex = "1";
    stepIndicator.style.textAlign = "center";
    stepIndicator.style.fontSize = "10px";
    stepIndicator.style.padding = "4px";
    stepIndicator.style.borderRadius = "3px";
    stepIndicator.style.background = "#e9ecef";
    stepIndicator.style.margin = "0 2px 4px 2px";
    stepIndicator.style.minWidth = "60px";

    // Make current step active
    if (index === 0) {
      stepIndicator.style.background = "#4361ee";
      stepIndicator.style.color = "white";
      stepIndicator.style.fontWeight = "500";
    }

    stepsOverview.appendChild(stepIndicator);
  });

  mainContainer.appendChild(stepsOverview);

  // Content container for all steps - improved with scroll position tracking
  const contentContainer = document.createElement("div");
  contentContainer.className = "math-content-container";
  contentContainer.style.overflow = "auto";
  contentContainer.style.maxHeight = "fit-content";
  contentContainer.style.position = "relative";
  mainContainer.appendChild(contentContainer);

  // Define a consistent color palette for better visual consistency
  const colorPalette = {
    primary: "#4361ee",
    secondary: "#f1f8fe",
    border: "#e1e8ed",
    x: {
      color: "#2e7d32",
      bg: "#f1f8f3", // Lighter
    },
    c: {
      color: "#1565c0",
      bg: "#f1f8fe", // Lighter
    },
    temp: {
      color: "#c62828",
      bg: "#fef7f7", // Lighter
    },
    carry: {
      color: "#6a1b9a",
      bg: "#faf7fc", // Lighter
    },
    output: {
      color: "#f57c00",
      bg: "#fff9f3", // Lighter
    },
    other: {
      color: "#546e7a",
      bg: "#f7f9fa", // Lighter
    },
  };

  // Render each step
  steps.forEach((step, stepIndex) => {
    // Create step container
    const stepContainer = document.createElement("div");
    stepContainer.className = "math-step";
    stepContainer.style.marginBottom = "15px";
    stepContainer.style.backgroundColor = "white";
    stepContainer.style.borderRadius = "6px";
    stepContainer.style.boxShadow = "0 1px 2px rgba(0,0,0,0.05)";
    stepContainer.style.overflow = "hidden";

    // Step header
    const stepHeader = document.createElement("div");
    stepHeader.className = "step-header";
    stepHeader.style.padding = "8px 12px";
    stepHeader.style.backgroundColor = colorPalette.secondary;
    stepHeader.style.borderBottom = `1px solid ${colorPalette.border}`;
    stepHeader.style.display = "flex";
    stepHeader.style.justifyContent = "space-between";
    stepHeader.style.alignItems = "center";
    stepHeader.style.cursor = "pointer";

    const stepTitle = document.createElement("div");
    stepTitle.className = "step-title";
    stepTitle.style.fontWeight = "600";
    stepTitle.style.color = colorPalette.primary;
    stepTitle.style.fontSize = "13px";
    stepTitle.textContent = step.title.includes("Step")
      ? step.title
      : `Step ${step.id}: ${step.title}`;

    const toggleIcon = document.createElement("span");
    toggleIcon.innerHTML = "▼";
    toggleIcon.style.color = colorPalette.primary;
    toggleIcon.style.fontSize = "10px";
    toggleIcon.style.transition = "transform 0.2s ease";

    stepHeader.appendChild(stepTitle);
    stepHeader.appendChild(toggleIcon);
    stepContainer.appendChild(stepHeader);

    // Step content
    const stepContent = document.createElement("div");
    stepContent.className = "step-content";
    stepContent.style.padding = "0";
    stepContent.style.overflow = "hidden";
    stepContent.style.transition = "max-height 0.3s ease-in-out";
    stepContent.style.maxHeight = "2000px";

    // Make collapsible
    let isExpanded = true;
    stepHeader.onclick = () => {
      isExpanded = !isExpanded;
      stepContent.style.maxHeight = isExpanded ? "2000px" : "0";
      toggleIcon.style.transform = isExpanded ? "rotate(0)" : "rotate(-90deg)";
      toggleIcon.innerHTML = isExpanded ? "▼" : "▶";
    };

    // Group data by type for better organization
    const groupedByType = {};
    step.dataGroups.forEach((group) => {
      if (!groupedByType[group.type]) {
        groupedByType[group.type] = [];
      }
      groupedByType[group.type].push(group);
    });

    // Render each type of data
    Object.keys(groupedByType).forEach((type) => {
      const groups = groupedByType[type];

      // Create section for this type
      if (type !== "info" && type !== "state") {
        const sectionTitle = document.createElement("div");
        sectionTitle.className = "section-title";
        sectionTitle.style.padding = "8px 12px";
        sectionTitle.style.backgroundColor = "#f8f9fa";
        sectionTitle.style.borderBottom = `1px solid ${colorPalette.border}`;
        sectionTitle.style.fontWeight = "500";
        sectionTitle.style.fontSize = "11px";
        sectionTitle.style.textTransform = "uppercase";
        sectionTitle.style.color =
          colorPalette[type]?.color || colorPalette.other.color;

        // Use consistent naming
        const typeLabels = {
          x: "State Values (x)",
          c: "Counter Values (c)",
          temp: "Temporary Values (temp)",
          carry: "Carry Values",
          output: "Output/Keystream Values",
          other: "Other Values",
        };

        sectionTitle.textContent = typeLabels[type] || "Other Values";

        stepContent.appendChild(sectionTitle);
      }

      // Render values for variables (x, c, temp)
      if (["x", "c", "temp"].includes(type)) {
        // Combine all values from groups of this type
        const allValues = [];
        groups.forEach((group) => {
          allValues.push(...group.values);
        });

        // Create a responsive grid layout for values
        const valuesGrid = document.createElement("div");
        valuesGrid.className = "values-grid";
        valuesGrid.style.display = "grid";
        valuesGrid.style.gridTemplateColumns = "repeat(4, 1fr)";
        valuesGrid.style.gap = "1px";
        valuesGrid.style.backgroundColor = colorPalette.border;
        valuesGrid.style.padding = "1px";

        // Add each value to the grid
        allValues.forEach((value) => {
          const valueCell = document.createElement("div");
          valueCell.className = "value-cell";
          valueCell.style.backgroundColor = "white";
          valueCell.style.padding = "8px 10px";
          valueCell.style.display = "flex";
          valueCell.style.flexDirection = "column";

          // Variable name (e.g., x[0])
          const varName = document.createElement("div");
          varName.className = "var-name";
          varName.style.marginBottom = "4px";
          varName.style.fontWeight = "500";
          varName.style.fontSize = "11px";
          varName.style.color = colorPalette[type].color;
          varName.textContent = value.name;

          // Value
          const valueElement = document.createElement("div");
          valueElement.className = "value";
          valueElement.style.fontFamily =
            'Consolas, Monaco, "Courier New", monospace';
          valueElement.style.fontSize = "11px";

          // Format hex values with a more subtle approach
          if (value.value.includes("0x")) {
            valueElement.innerHTML = value.value.replace(
              /0x([0-9A-F]+)/gi,
              '<span style="color:#4361ee;font-weight:500">0x</span><span style="font-weight:500">$1</span>'
            );
          } else {
            valueElement.textContent = value.value;
          }

          // Add visual meter for hex values with a more subtle design
          if (value.value.includes("0x")) {
            try {
              const hexValue = value.value.match(/0x([0-9A-F]+)/i)[1];
              const intValue = parseInt(hexValue, 16);
              const meterValue = intValue % 100; // Use modulo to keep within 0-100 range

              const meterElement = document.createElement("div");
              meterElement.className = "value-meter";
              meterElement.style.height = "3px";
              meterElement.style.backgroundColor = "#e9ecef";
              meterElement.style.borderRadius = "2px";
              meterElement.style.overflow = "hidden";
              meterElement.style.marginTop = "4px";

              const meterFill = document.createElement("div");
              meterFill.style.height = "100%";
              meterFill.style.width = `${meterValue}%`;
              meterFill.style.backgroundColor = colorPalette[type].color;
              meterFill.style.opacity = "0.7"; // More subtle
              meterFill.style.borderRadius = "2px";

              meterElement.appendChild(meterFill);
              valueElement.appendChild(meterElement);
            } catch (e) {
              // If parsing fails, just skip the meter
            }
          }

          // Notes (if any)
          if (value.notes) {
            const notesElement = document.createElement("div");
            notesElement.className = "notes";
            notesElement.style.fontSize = "10px";
            notesElement.style.marginTop = "4px";
            notesElement.style.fontStyle = "italic";
            notesElement.style.color = "#757575";
            notesElement.textContent = value.notes;

            valueCell.appendChild(notesElement);
          }

          valueCell.appendChild(varName);
          valueCell.appendChild(valueElement);
          valuesGrid.appendChild(valueCell);
        });

        stepContent.appendChild(valuesGrid);
      }
      // Render carry values with more consistent styling
      else if (type === "carry") {
        const carryContainer = document.createElement("div");
        carryContainer.className = "carry-container";
        carryContainer.style.padding = "10px 12px";
        carryContainer.style.backgroundColor = colorPalette[type].bg;
        carryContainer.style.borderLeft = `4px solid ${colorPalette[type].color}`;
        carryContainer.style.borderBottom = `1px solid ${colorPalette.border}`;

        groups.forEach((group) => {
          group.values.forEach((value) => {
            const carryItem = document.createElement("div");
            carryItem.style.display = "flex";
            carryItem.style.alignItems = "center";
            carryItem.style.marginBottom = "6px";

            const carryLabel = document.createElement("span");
            carryLabel.style.fontWeight = "500";
            carryLabel.style.color = colorPalette[type].color;
            carryLabel.style.marginRight = "10px";
            carryLabel.style.minWidth = "80px";
            carryLabel.textContent = value.name;

            const carryValueElement = document.createElement("span");
            carryValueElement.style.fontFamily =
              'Consolas, Monaco, "Courier New", monospace';
            carryValueElement.style.fontSize = "11px";

            // Format hex values with consistent styling
            if (value.value.includes("0x")) {
              carryValueElement.innerHTML = value.value.replace(
                /0x([0-9A-F]+)/gi,
                '<span style="color:#4361ee;font-weight:500">0x</span><span style="font-weight:500">$1</span>'
              );
            } else {
              carryValueElement.textContent = value.value;
            }

            carryItem.appendChild(carryLabel);
            carryItem.appendChild(carryValueElement);
            carryContainer.appendChild(carryItem);
          });
        });

        stepContent.appendChild(carryContainer);
      }
      // Render output/keystream values with more consistent styling
      else if (type === "output") {
        const outputContainer = document.createElement("div");
        outputContainer.className = "output-container";
        outputContainer.style.padding = "12px";
        outputContainer.style.backgroundColor = colorPalette[type].bg;
        outputContainer.style.borderBottom = `1px solid ${colorPalette.border}`;
        outputContainer.style.borderLeft = `4px solid ${colorPalette[type].color}`;

        groups.forEach((group) => {
          group.values.forEach((value) => {
            const outputItem = document.createElement("div");
            outputItem.style.marginBottom = "10px";

            // Output label
            const outputLabel = document.createElement("div");
            outputLabel.style.fontWeight = "500";
            outputLabel.style.color = colorPalette[type].color;
            outputLabel.style.marginBottom = "5px";
            outputLabel.style.fontSize = "11px";
            outputLabel.textContent = value.name;

            // Output value
            const outputValue = document.createElement("div");
            outputValue.style.fontFamily =
              'Consolas, Monaco, "Courier New", monospace';
            outputValue.style.fontSize = "11px";
            outputValue.style.padding = "8px";
            outputValue.style.backgroundColor = "rgba(245, 124, 0, 0.03)"; // More subtle
            outputValue.style.borderRadius = "4px";
            outputValue.style.overflowWrap = "break-word";

            // Format hex values with consistent styling
            if (value.value.includes("0x")) {
              outputValue.innerHTML = value.value.replace(
                /0x([0-9A-F]+)/gi,
                '<span style="color:#4361ee;font-weight:500">0x</span><span style="font-weight:500">$1</span>'
              );
            } else {
              outputValue.textContent = value.value;
            }

            outputItem.appendChild(outputLabel);
            outputItem.appendChild(outputValue);
            outputContainer.appendChild(outputItem);
          });
        });

        stepContent.appendChild(outputContainer);
      }
      // Render state information (Before/After) with more consistent styling
      else if (type === "state") {
        groups.forEach((group) => {
          const stateContainer = document.createElement("div");
          stateContainer.className = "state-container";
          stateContainer.style.padding = "10px 12px";

          // Apply different styling based on Before/After, but more subtle
          if (group.stateType.startsWith("Before")) {
            stateContainer.style.backgroundColor = colorPalette.x.bg; // Light
            stateContainer.style.borderLeft = `4px solid ${colorPalette.x.color}`; // Dark
          } else {
            stateContainer.style.backgroundColor = colorPalette.c.bg; // Light
            stateContainer.style.borderLeft = `4px solid ${colorPalette.c.color}`; // Dark
          }

          stateContainer.style.borderBottom = `1px solid ${colorPalette.border}`;

          const stateLabel = document.createElement("div");
          stateLabel.style.fontWeight = "500";
          stateLabel.style.marginBottom = "6px";
          stateLabel.style.fontSize = "11px";
          stateLabel.style.color = group.stateType.startsWith("Before")
            ? colorPalette.x.color
            : colorPalette.c.color;
          stateLabel.textContent = group.stateType;

          stateContainer.appendChild(stateLabel);

          // Add state data if available
          if (group.stateData) {
            const stateDataElement = document.createElement("div");
            stateDataElement.style.fontSize = "11px";
            stateDataElement.style.fontFamily =
              'Consolas, Monaco, "Courier New", monospace';
            stateDataElement.textContent = group.stateData;

            stateContainer.appendChild(stateDataElement);
          }

          stepContent.appendChild(stateContainer);
        });
      }
      // Render other info with more consistent styling
      else if (type === "info") {
        groups.forEach((group) => {
          const infoContainer = document.createElement("div");
          infoContainer.className = "info-container";
          infoContainer.style.padding = "10px 12px";
          infoContainer.style.backgroundColor = "white";
          infoContainer.style.borderBottom = `1px solid ${colorPalette.border}`;
          infoContainer.style.fontSize = "11px";

          // Check if it's an important note/info
          if (
            group.value.toLowerCase().includes("note") ||
            group.value.toLowerCase().includes("important")
          ) {
            infoContainer.style.backgroundColor = "#fff8e1"; // Light yellow
            infoContainer.style.borderLeft = "4px solid #ffc107"; // Yellow
          }

          infoContainer.textContent = group.value;

          stepContent.appendChild(infoContainer);
        });
      }
    });

    stepContainer.appendChild(stepContent);
    contentContainer.appendChild(stepContainer);
  });

  // Add a simpler legend with more subtle design
  const legend = document.createElement("div");
  legend.className = "math-legend";
  legend.style.display = "flex";
  legend.style.flexWrap = "wrap";
  legend.style.gap = "10px";
  legend.style.padding = "10px 12px";
  legend.style.marginTop = "10px";
  legend.style.backgroundColor = "white";
  legend.style.borderRadius = "6px";
  legend.style.boxShadow = "0 1px 2px rgba(0,0,0,0.05)";

  // Legend title
  const legendTitle = document.createElement("div");
  legendTitle.style.width = "100%";
  legendTitle.style.fontSize = "11px";
  legendTitle.style.fontWeight = "600";
  legendTitle.style.marginBottom = "8px";
  legendTitle.style.textTransform = "uppercase";
  legendTitle.style.color = "#6c757d";
  legendTitle.textContent = "Color Legend";
  legend.appendChild(legendTitle);

  // Legend items with more consistent colors
  const legendItems = [
    { color: colorPalette.x.color, text: "State Values (x)" },
    { color: colorPalette.c.color, text: "Counter Values (c)" },
    { color: colorPalette.temp.color, text: "Temporary Values (temp)" },
    { color: colorPalette.carry.color, text: "Carry Values" },
    { color: colorPalette.output.color, text: "Output/Keystream Values" },
    { color: colorPalette.primary, text: "Hexadecimal Values" },
  ];

  legendItems.forEach((item) => {
    const legendItem = document.createElement("div");
    legendItem.style.display = "flex";
    legendItem.style.alignItems = "center";
    legendItem.style.fontSize = "10px";

    const colorBox = document.createElement("div");
    colorBox.style.width = "10px";
    colorBox.style.height = "10px";
    colorBox.style.backgroundColor = item.color;
    colorBox.style.marginRight = "6px";
    colorBox.style.borderRadius = "2px";

    legendItem.appendChild(colorBox);
    legendItem.appendChild(document.createTextNode(item.text));

    legend.appendChild(legendItem);
  });

  mainContainer.appendChild(legend);

  // Add responsive styling
  const style = document.createElement("style");
  style.textContent = `
    @media (max-width: 768px) {
      .values-grid {
        grid-template-columns: repeat(2, 1fr) !important;
      }
      
      .math-steps-overview {
        flex-wrap: wrap;
      }
      
      .math-step-indicator {
        flex-basis: 45%;
        margin-bottom: 4px;
      }
    }
  `;
  mainContainer.appendChild(style);

  // Add to container
  containerElement.appendChild(mainContainer);

  // Set scroll position if this is an update
  if (containerElement.dataset.initialized === "true") {
    setTimeout(() => {
      const contentContainer = containerElement.querySelector(
        ".math-content-container"
      );
      if (contentContainer) {
        contentContainer.scrollTop = scrollPosition;
      }
    }, 10);
  } else {
    // Mark as initialized
    containerElement.dataset.initialized = "true";
  }

  // Add download functionality with improved handling
  downloadBtn.addEventListener("click", function (event) {
    // Prevent the event from bubbling up
    event.preventDefault();
    event.stopPropagation();

    // Prepare data for download
    let downloadText = "Mathematical Process Visualization\n";
    downloadText += "===============================\n\n";

    steps.forEach((step) => {
      downloadText += `${step.title}\n`;
      downloadText += "".padEnd(step.title.length, "-") + "\n\n";

      step.dataGroups.forEach((group) => {
        if (group.type === "state") {
          downloadText += `${group.stateType}: ${group.stateData}\n`;
        } else if (group.type === "info") {
          downloadText += `${group.value}\n`;
        } else if (["x", "c", "temp", "carry", "output"].includes(group.type)) {
          group.values.forEach((value) => {
            downloadText += `${value.name} = ${value.value}${
              value.notes ? ", " + value.notes : ""
            }\n`;
          });
        }
      });

      downloadText += "\n";
    });

    // Create and trigger download
    const blob = new Blob([downloadText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mathematical-process.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

function updateInternalStateVisualization() {
  const stateVizElement = document.getElementById("stateVisualization");

  // Get actual values from your implementation (replace these placeholders with your real data)
  const formattedKey = formatHexString(rabbitKey, 4);
  const formattedIV = formatHexString(rabbitIV, 4);

  // Create state data (replace with actual values from your implementation)
  const xStateValues = Array(8)
    .fill(0)
    .map(() =>
      Math.floor(Math.random() * 0xffffffff)
        .toString(16)
        .padStart(8, "0")
    );
  const cStateValues = Array(8)
    .fill(0)
    .map(() => Math.floor(Math.random() * 0xf).toString(16));
  const counterValue = Math.floor(Math.random() * 0xffffffffffffffff)
    .toString(16)
    .padStart(16, "0");

  // Sample keystream output (replace with actual values)
  const keyStreamSample = Array(8)
    .fill(0)
    .map(() =>
      Math.floor(Math.random() * 0xffff)
        .toString(16)
        .padStart(4, "0")
    )
    .join(" ");

  // Prepare state data for download
  const stateData = {
    key: formattedKey,
    iv: formattedIV,
    xState: xStateValues,
    cState: cStateValues,
    counter: counterValue,
    keystream: keyStreamSample,
    timestamp: new Date().toISOString(),
  };

  // Create HTML structure with improved styling
  let html = `
    <div class="rabbit-state-container">
      <!-- Header with Title and Download Button -->
      <div class="rabbit-header">
        <h4>Rabbit Stream Cipher State</h4>
        <button id="downloadStateBtn" class="rabbit-download-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Download State
        </button>
      </div>
      
      <!-- Main State Display -->
      <div class="rabbit-panels">
        <!-- Left Panel: Key, IV and Counter -->
        <div class="rabbit-panel">
          <div class="rabbit-panel-section">
            <div class="rabbit-section-label">Key</div>
            <div class="rabbit-value-mono">${formattedKey}</div>
          </div>
          <div class="rabbit-panel-section">
            <div class="rabbit-section-label">IV</div>
            <div class="rabbit-value-mono">${formattedIV}</div>
          </div>
          <div class="rabbit-panel-section">
            <div class="rabbit-section-label">Counter</div>
            <div class="rabbit-value-mono">${counterValue}</div>
          </div>
        </div>
        
        <!-- Middle Panel: X State -->
        <div class="rabbit-panel">
          <div class="rabbit-section-label">X State</div>
          <div class="rabbit-x-grid">
            ${xStateValues
              .map(
                (x, i) => `
              <div class="rabbit-x-item">
                <div class="rabbit-x-label">X[${i}]</div>
                <div class="rabbit-x-value">${x}</div>
                <div class="rabbit-x-meter"><div style="width: ${Math.floor(
                  parseInt(x, 16) % 100
                )}%"></div></div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
        
        <!-- Right Panel: C State and Keystream -->
        <div class="rabbit-panel">
          <div class="rabbit-panel-section">
            <div class="rabbit-section-label">Carry Bits</div>
            <div class="rabbit-c-grid">
              ${cStateValues
                .map(
                  (c, i) => `
                <div class="rabbit-c-item">
                  <span>C[${i}]:</span>
                  <span>${c}</span>
                </div>
              `
                )
                .join("")}
            </div>
          </div>
          <div class="rabbit-panel-section">
            <div class="rabbit-section-label">Keystream</div>
            <div class="rabbit-value-mono rabbit-keystream">${keyStreamSample}</div>
          </div>
        </div>
      </div>
      
      <!-- Process Steps -->
      <div class="rabbit-steps">
        <div class="rabbit-step ${
          getCurrentStep() === 1 ? "active" : ""
        }">1. Key Setup</div>
        <div class="rabbit-step ${
          getCurrentStep() === 2 ? "active" : ""
        }">2. IV Setup</div>
        <div class="rabbit-step ${
          getCurrentStep() === 3 ? "active" : ""
        }">3. Next-State</div>
        <div class="rabbit-step ${
          getCurrentStep() === 4 ? "active" : ""
        }">4. Extract</div>
        <div class="rabbit-step ${
          getCurrentStep() === 5 ? "active" : ""
        }">5. XOR</div>
      </div>
    </div>
    
    <style>
      .rabbit-state-container {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 12px;
        color: #333;
        background: #f8f9fa;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        padding: 12px;
        max-width: 100%;
        margin: 0 auto;
      }
      
      .rabbit-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        border-bottom: 1px solid #eaeaea;
        padding-bottom: 8px;
      }
      
      .rabbit-header h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
      }
      
      .rabbit-download-btn {
        display: flex;
        align-items: center;
        gap: 5px;
        background: #4361ee;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 5px 10px;
        font-size: 12px;
        cursor: pointer;
        transition: background 0.2s;
      }
      
      .rabbit-download-btn:hover {
        background: #3a56d4;
      }
      
      .rabbit-panels {
        display: flex;
        gap: 10px;
        margin-bottom: 10px;
      }
      
      .rabbit-panel {
        flex: 1;
        background: white;
        border-radius: 6px;
        padding: 8px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      }
      
      .rabbit-panel-section {
        margin-bottom: 8px;
      }
      
      .rabbit-panel-section:last-child {
        margin-bottom: 0;
      }
      
      .rabbit-section-label {
        font-weight: 600;
        font-size: 11px;
        color: #6c757d;
        margin-bottom: 3px;
        text-transform: uppercase;
      }
      
      .rabbit-value-mono {
        font-family: 'Consolas', 'Monaco', monospace;
        background: #f1f3f5;
        padding: 4px 6px;
        border-radius: 3px;
        font-size: 11px;
        overflow-wrap: break-word;
        word-break: break-all;
      }
      
      .rabbit-keystream {
        letter-spacing: 1px;
      }
      
      .rabbit-x-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 6px;
      }
      
      .rabbit-x-item {
        border: 1px solid #eaeaea;
        border-radius: 3px;
        padding: 4px;
      }
      
      .rabbit-x-label {
        font-size: 11px;
        font-weight: 500;
      }
      
      .rabbit-x-value {
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 10px;
        margin: 2px 0;
      }
      
      .rabbit-x-meter {
        height: 3px;
        background: #e9ecef;
        border-radius: 2px;
        overflow: hidden;
      }
      
      .rabbit-x-meter > div {
        height: 100%;
        background: #4361ee;
        border-radius: 2px;
        transition: width 0.3s;
      }
      
      .rabbit-c-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 4px;
      }
      
      .rabbit-c-item {
        display: flex;
        justify-content: space-between;
        font-size: 10px;
        background: #f1f3f5;
        padding: 3px;
        border-radius: 3px;
      }
      
      .rabbit-steps {
        display: flex;
        justify-content: space-between;
        margin-top: 8px;
      }
      
      .rabbit-step {
        flex: 1;
        text-align: center;
        font-size: 10px;
        padding: 4px;
        border-radius: 3px;
        background: #e9ecef;
        margin: 0 2px;
      }
      
      .rabbit-step.active {
        background: #4361ee;
        color: white;
        font-weight: 500;
      }
      
      @media (max-width: 768px) {
        .rabbit-panels {
          flex-direction: column;
        }
        
        .rabbit-x-grid {
          grid-template-columns: repeat(4, 1fr);
        }
      }
      
      @media (max-width: 480px) {
        .rabbit-x-grid {
          grid-template-columns: repeat(2, 1fr);
        }
        
        .rabbit-steps {
          flex-wrap: wrap;
        }
        
        .rabbit-step {
          flex-basis: 45%;
          margin-bottom: 4px;
        }
      }
    </style>
  `;

  // Use requestAnimationFrame for smoother updates
  requestAnimationFrame(() => {
    stateVizElement.innerHTML = html;

    // Add event listener to the download button
    document
      .getElementById("downloadStateBtn")
      .addEventListener("click", function () {
        // Convert state data to formatted text
        const stateText = formatStateForDownload(stateData);

        // Create a Blob containing the data
        const blob = new Blob([stateText], { type: "text/plain" });

        // Create a download link and trigger it
        const downloadLink = document.createElement("a");
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = `rabbit-state-${Date.now()}.txt`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      });
  });
}

// Helper function to format the state data for download
function formatStateForDownload(stateData) {
  return `RABBIT STREAM CIPHER STATE SNAPSHOT
==================================
Timestamp: ${stateData.timestamp}

KEY AND IV
----------
Secret Key: ${stateData.key}
Init Vector: ${stateData.iv}

STATE VARIABLES
--------------
Counter: ${stateData.counter}

X State Variables:
${stateData.xState.map((x, i) => `X[${i}] = ${x}`).join("\n")}

Carry Bits:
${stateData.cState.map((c, i) => `C[${i}] = ${c}`).join("\n")}

KEYSTREAM OUTPUT
---------------
${stateData.keystream}

NOTES
-----
- All values are in hexadecimal notation
- X variables are 32-bit values
- C variables are carry bits
- Counter increments by b'4D34D34D34D34D' each iteration
- 16 bytes of keystream produced per iteration
`;
}

// Helper function for the algorithm steps
function getCurrentStep() {
  // Replace with your actual implementation to determine current step
  return Math.floor(Math.random() * 5) + 1;
}

// Helper function to format hex strings
function formatHexString(hexStr, groupSize) {
  // This should be your implementation to format hex strings with spaces
  // Example implementation:
  if (!hexStr) return "";
  const regex = new RegExp(`.{1,${groupSize}}`, "g");
  return hexStr.match(regex).join(" ");
}
// Helper function to format hex strings with spaces

// Optimize animation by limiting update frequency
let lastUpdateTime = 0;
const UPDATE_INTERVAL = 100; // ms - adjust as needed for performance vs smoothness

function optimizedUpdateState() {
  const now = performance.now();
  if (now - lastUpdateTime > UPDATE_INTERVAL) {
    lastUpdateTime = now;
    updateInternalStateVisualization();
  }
  requestAnimationFrame(optimizedUpdateState);
}

// Start the optimized update loop
function updateInternalStateVisualization() {
  const stateVizElement = document.getElementById("stateVisualization");

  // Get actual values from your implementation (replace these placeholders with your real data)
  const formattedKey = formatHexString(rabbitKey, 4);
  const formattedIV = formatHexString(rabbitIV, 4);

  // Create state data (replace with actual values from your implementation)
  const xStateValues = Array(8)
    .fill(0)
    .map(() =>
      Math.floor(Math.random() * 0xffffffff)
        .toString(16)
        .padStart(8, "0")
    );
  const cStateValues = Array(8)
    .fill(0)
    .map(() => Math.floor(Math.random() * 0xf).toString(16));
  const counterValue = Math.floor(Math.random() * 0xffffffffffffffff)
    .toString(16)
    .padStart(16, "0");

  // Sample keystream output (replace with actual values)
  const keyStreamSample = Array(8)
    .fill(0)
    .map(() =>
      Math.floor(Math.random() * 0xffff)
        .toString(16)
        .padStart(4, "0")
    )
    .join(" ");

  // Prepare state data for download
  const stateData = {
    key: formattedKey,
    iv: formattedIV,
    xState: xStateValues,
    cState: cStateValues,
    counter: counterValue,
    keystream: keyStreamSample,
    timestamp: new Date().toISOString(),
  };

  // Get the current step (placeholder)
  const currentStep = getCurrentStep();

  // Define step details with mathematical formulas
  const stepDetails = [
    {
      title: "Key Setup",
      description: "Initialize state with key K",
      formula: "x[i] = k[i mod 8], c[i] = 0",
    },
    {
      title: "IV Setup",
      description: "Mix IV into state using counter",
      formula: "counter += IV[0..3], counter += (IV[4..7] << 64)",
    },
    {
      title: "State Iteration",
      description: "Apply g-function & update counters",
      formula: "g(x) = (x^2 + x) mod 2^32, counter[j] += a",
    },
    {
      title: "Extract Function",
      description: "S-box transforms & bitwise operations",
      formula: "s[i] = g(x[i] ⊕ x[i+5] ⊕ x[i+7] ≪ 16)",
    },
    {
      title: "Keystream Generation",
      description: "XOR keystream with plaintext",
      formula: "keystream[i] = s[i] ⊕ (s[i-1] ≫ 16) ⊕ (s[i-2] ≪ 16)",
    },
  ];

  // Create a container div
  const container = document.createElement("div");

  // Create and attach Shadow DOM to the container
  const shadowRoot = container.attachShadow({ mode: "closed" });

  // Create HTML content - completely self-contained
  const html = `
    <div class="rabbit-state-container">
      <!-- Compact Header -->
      <div class="rabbit-header">
        <h4>Rabbit Cipher State</h4>
        <button id="downloadStateBtn" class="rabbit-download-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Download
        </button>
      </div>
      
      <!-- Main Layout -->
      <div class="rabbit-main-content">
        <!-- Left Column: Key, IV, and Diagram -->
        <div class="rabbit-left-column">
          <!-- Key and IV in compact format -->
          <div class="rabbit-key-iv-wrapper">
            <div class="rabbit-data-row">
              <span class="rabbit-label">Key:</span>
              <span class="rabbit-value-mono">${formattedKey}</span>
            </div>
            <div class="rabbit-data-row">
              <span class="rabbit-label">IV:</span>
              <span class="rabbit-value-mono">${formattedIV}</span>
            </div>
            <div class="rabbit-data-row">
              <span class="rabbit-label">Counter:</span>
              <span class="rabbit-value-mono">${counterValue}</span>
            </div>
          </div>
          
          <!-- Rabbit Cipher Diagram - IMPROVED LAYOUT -->
          <div class="rabbit-diagram">
            <svg viewBox="0 0 260 190" xmlns="http://www.w3.org/2000/svg">
  <!-- Background grid for professional look -->
  <defs>
    <pattern id="smallGrid" width="10" height="10" patternUnits="userSpaceOnUse">
      <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#f0f0f0" stroke-width="0.5"/>
    </pattern>
  </defs>
  <rect width="260" height="190" fill="white"/>
  <rect width="260" height="190" fill="url(#smallGrid)"/>
  
  <!-- Input components with subtle gradient -->
  <defs>
    <linearGradient id="inputGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#f8f9fa"/>
      <stop offset="100%" stop-color="#e9ecef"/>
    </linearGradient>
  </defs>
  
  <!-- Key Input -->
  <rect x="10" y="16" width="50" height="10" rx="3" fill="url(#inputGradient)" stroke="#ced4da" stroke-width="1"/>
  <text x="35" y="23" font-size="4" text-anchor="middle" fill="#495057" font-weight="500">Key (128-bit)</text>
  
  <!-- IV Input -->
  <rect x="70" y="16" width="50" height="10" rx="3" fill="url(#inputGradient)" stroke="#ced4da" stroke-width="1"/>
  <text x="95" y="23" font-size="4" text-anchor="middle" fill="#495057" font-weight="500">IV (64-bit)</text>
  
  <!-- Vertical Process Flow - Main Line - Moved to left -->
  <line x1="50" y1="35" x2="50" y2="150" stroke="#adb5bd" stroke-width="1.5" stroke-dasharray="1,1"/>
  
  <!-- Connection paths from inputs to main line -->
  <path d="M35 30 L35 35 L50 35" stroke="#adb5bd" stroke-width="1" fill="none"/>
  <path d="M95 30 L95 35 L50 35" stroke="#adb5bd" stroke-width="1" fill="none"/>
  
  <!-- Step 1: Key Setup -->
  <circle cx="50" cy="45" r="3" fill="${
    currentStep === 1 ? "#4361ee" : "#adb5bd"
  }"/>
  <line x1="50" y1="45" x2="70" y2="45" stroke="#adb5bd" stroke-width="1"/>
  <text x="73" y="48" font-size="6" text-anchor="start" font-weight="${
    currentStep === 1 ? "bold" : "normal"
  }" fill="#495057">1. Key Setup</text>
  <text x="73" y="56" font-size="5" text-anchor="start" fill="#6c757d">x[i] = k[i mod 8], c[i] = 0</text>
  
  <!-- Step 2: IV Setup -->
  <circle cx="50" cy="70" r="3" fill="${
    currentStep === 2 ? "#4361ee" : "#adb5bd"
  }"/>
  <line x1="50" y1="70" x2="70" y2="70" stroke="#adb5bd" stroke-width="1"/>
  <text x="73" y="73" font-size="6" text-anchor="start" font-weight="${
    currentStep === 2 ? "bold" : "normal"
  }" fill="#495057">2. IV Setup</text>
  <text x="73" y="81" font-size="5" text-anchor="start" fill="#6c757d">counter += IV[0..7] (mixed)</text>
  
  <!-- Step 3: State Iteration -->
  <circle cx="50" cy="95" r="3" fill="${
    currentStep === 3 ? "#4361ee" : "#adb5bd"
  }"/>
  <line x1="50" y1="95" x2="70" y2="95" stroke="#adb5bd" stroke-width="1"/>
  <text x="73" y="98" font-size="6" text-anchor="start" font-weight="${
    currentStep === 3 ? "bold" : "normal"
  }" fill="#495057">3. State Iteration</text>
  <text x="73" y="106" font-size="5" text-anchor="start" fill="#6c757d">g(x) = (x² + x) mod 2³²</text>
  <text x="73" y="114" font-size="5" text-anchor="start" fill="#6c757d">counter[j] += 0x4D34D34D34D34D</text>
  
  <!-- Step 4: Extract Function -->
  <circle cx="50" cy="120" r="3" fill="${
    currentStep === 4 ? "#4361ee" : "#adb5bd"
  }"/>
  <line x1="50" y1="120" x2="70" y2="120" stroke="#adb5bd" stroke-width="1"/>
  <text x="73" y="123" font-size="6" text-anchor="start" font-weight="${
    currentStep === 4 ? "bold" : "normal"
  }" fill="#495057">4. Extract Function</text>
  <text x="73" y="131" font-size="5" text-anchor="start" fill="#6c757d">s[i] = g(x[i] ⊕ x[i+5] ⊕ x[i+7] ≪ 16)</text>
  
  <!-- Step 5: Keystream Generation -->
  <circle cx="50" cy="145" r="3" fill="${
    currentStep === 5 ? "#4361ee" : "#adb5bd"
  }"/>
  <line x1="50" y1="145" x2="70" y2="145" stroke="#adb5bd" stroke-width="1"/>
  <text x="73" y="148" font-size="6" text-anchor="start" font-weight="${
    currentStep === 5 ? "bold" : "normal"
  }" fill="#495057">5. Keystream Generation</text>
  <text x="73" y="156" font-size="5" text-anchor="start" fill="#6c757d">k[i] = s[i] ⊕ (s[i-1] ≫ 16) ⊕ (s[i-2] ≪ 16)</text>
  
  <!-- Moving keystream and processing to right side section -->
  
  <!-- Flow to output - Redesigned paths -->
  <path d="M50 150 L50 160 L195 160 L195 150" stroke="#adb5bd" stroke-width="1" fill="none"/>
  
  <!-- Keystream box (reduced size) -->
  <defs>
    <linearGradient id="keystreamGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#e9ecef"/>
      <stop offset="100%" stop-color="#f8f9fa"/>
    </linearGradient>
  </defs>
  <rect x="160" y="143" width="70" height="10" rx="3" fill="url(#keystreamGradient)" stroke="#ced4da" stroke-width="1"/>
  <text x="195" y="150" font-size="5" text-anchor="middle" fill="#495057" font-weight="500">Keystream Output</text>
  
  <!-- Path from keystream to plaintext - Redesigned -->
  <path d="M195 140 L195 120" stroke="#adb5bd" stroke-width="1" fill="none"/>
  <circle cx="195" cy="115" r="7" fill="#f8f9fa" stroke="#adb5bd" stroke-width="1"/>
  <text x="195" y="118" font-size="10" text-anchor="middle" fill="#495057">⊕</text>
  
  <!-- Plaintext and Ciphertext - Repositioned -->
  <rect x="160" y="95" width="30" height="12" rx="3" fill="url(#inputGradient)" stroke="#ced4da" stroke-width="1"/>
  <text x="175" y="103" font-size="6" text-anchor="middle" fill="#495057">Plaintext</text>
  
  <rect x="195" y="95" width="33" height="12" rx="3" fill="url(#inputGradient)" stroke="#ced4da" stroke-width="1"/>
  <text x="212" y="103" font-size="6" text-anchor="middle" fill="#495057">Ciphertext</text>
  
  <!-- Connect plaintext and ciphertext to XOR - Redesigned -->
  <path d="M178 107 L178 115 L188 115" stroke="#adb5bd" stroke-width="1" fill="none"/>
  <path d="M213 107 L213 115 L202 115" stroke="#adb5bd" stroke-width="1" fill="none"/>
  
  <!-- State components visualization - Moved to top right -->
  <rect x="160" y="25" width="70" height="35" rx="3" fill="#f8f9fa" stroke="#ced4da" stroke-width="1" stroke-dasharray="2,1"/>
  <text x="195" y="33" font-size="6" text-anchor="middle" fill="#495057" font-weight="bold">State (513 bits)</text>
  
  <!-- Mini state visualization - Resized -->
  <g transform="translate(165, 37)">
    <rect x="0" y="0" width="60" height="18" fill="none" stroke="#ced4da" stroke-width="0.5"/>
    <!-- X state boxes -->
    <g transform="translate(2, 2)">
      <rect x="0" y="0" width="6" height="6" fill="${
        currentStep >= 1 ? "#d0ebff" : "#e9ecef"
      }" stroke="#adb5bd" stroke-width="0.5"/>
      <rect x="7" y="0" width="6" height="6" fill="${
        currentStep >= 1 ? "#d0ebff" : "#e9ecef"
      }" stroke="#adb5bd" stroke-width="0.5"/>
      <rect x="14" y="0" width="6" height="6" fill="${
        currentStep >= 1 ? "#d0ebff" : "#e9ecef"
      }" stroke="#adb5bd" stroke-width="0.5"/>
      <rect x="21" y="0" width="6" height="6" fill="${
        currentStep >= 1 ? "#d0ebff" : "#e9ecef"
      }" stroke="#adb5bd" stroke-width="0.5"/>
      <rect x="28" y="0" width="6" height="6" fill="${
        currentStep >= 1 ? "#d0ebff" : "#e9ecef"
      }" stroke="#adb5bd" stroke-width="0.5"/>
      <rect x="35" y="0" width="6" height="6" fill="${
        currentStep >= 1 ? "#d0ebff" : "#e9ecef"
      }" stroke="#adb5bd" stroke-width="0.5"/>
      <rect x="42" y="0" width="6" height="6" fill="${
        currentStep >= 1 ? "#d0ebff" : "#e9ecef"
      }" stroke="#adb5bd" stroke-width="0.5"/>
      <rect x="49" y="0" width="6" height="6" fill="${
        currentStep >= 1 ? "#d0ebff" : "#e9ecef"
      }" stroke="#adb5bd" stroke-width="0.5"/>
      <text x="28" y="4" font-size="4" text-anchor="middle" fill="#495057">X[0-7]</text>
    </g>
    <!-- Counter + Carry bits -->
    <g transform="translate(2, 10)">
      <rect x="0" y="0" width="38" height="6" fill="${
        currentStep >= 2 ? "#d0ebff" : "#e9ecef"
      }" stroke="#adb5bd" stroke-width="0.5"/>
      <text x="19" y="4" font-size="4" text-anchor="middle" fill="#495057">Counter</text>
      <!-- Carry bits -->
      <rect x="39" y="0" width="2" height="6" fill="${
        currentStep >= 3 ? "#d0ebff" : "#e9ecef"
      }" stroke="#adb5bd" stroke-width="0.5"/>
      <rect x="42" y="0" width="2" height="6" fill="${
        currentStep >= 3 ? "#d0ebff" : "#e9ecef"
      }" stroke="#adb5bd" stroke-width="0.5"/>
      <rect x="45" y="0" width="2" height="6" fill="${
        currentStep >= 3 ? "#d0ebff" : "#e9ecef"
      }" stroke="#adb5bd" stroke-width="0.5"/>
      <rect x="48" y="0" width="2" height="6" fill="${
        currentStep >= 3 ? "#d0ebff" : "#e9ecef"
      }" stroke="#adb5bd" stroke-width="0.5"/>
      <rect x="51" y="0" width="2" height="6" fill="${
        currentStep >= 3 ? "#d0ebff" : "#e9ecef"
      }" stroke="#adb5bd" stroke-width="0.5"/>
      <rect x="54" y="0" width="2" height="6" fill="${
        currentStep >= 3 ? "#d0ebff" : "#e9ecef"
      }" stroke="#adb5bd" stroke-width="0.5"/>
      <text x="48" y="4" font-size="3" text-anchor="middle" fill="#495057">C</text>
    </g>
  </g>
  
  <!-- Security properties - Repositioned -->
  <rect x="10" y="165" width="45" height="20" rx="2" fill="#f1f3f5" stroke="#dee2e6" stroke-width="0.5"/>
  <text x="32.5" y="174" font-size="5" text-anchor="middle" fill="#495057">Period: ≈ 2^{128}</text>
  <text x="32.5" y="182" font-size="5" text-anchor="middle" fill="#495057">NIST eSTREAM</text>
  
  <!-- Connecting path from state to process -->
  <path d="M160 42 C130 42, 120 42, 105 42" stroke="#adb5bd" stroke-width="0.5" stroke-dasharray="1,1" fill="none"/>
</svg>
          </div>
        </div>
        
        <!-- Right Column: State Variables & Current Step Details -->
        <div class="rabbit-right-column">
          <!-- Step Details Box -->
          <div class="rabbit-section rabbit-step-detail">
            <div class="rabbit-section-label">Current Step: ${
              stepDetails[currentStep - 1].title
            }</div>
            <div class="rabbit-step-description">${
              stepDetails[currentStep - 1].description
            }</div>
            <div class="rabbit-formula">${
              stepDetails[currentStep - 1].formula
            }</div>
          </div>
          
          <!-- Compact X State Grid -->
          <div class="rabbit-section">
            <div class="rabbit-section-label">X State Variables (32-bit)</div>
            <div class="rabbit-x-grid">
              ${xStateValues
                .map(
                  (x, i) => `
                <div class="rabbit-x-item">
                  <div class="rabbit-x-header">
                    <span>X[${i}]</span>
                    <div class="rabbit-x-meter"><div style="width: ${Math.floor(
                      parseInt(x, 16) % 100
                    )}%"></div></div>
                  </div>
                  <div class="rabbit-x-value">${x}</div>
                </div>
              `
                )
                .join("")}
            </div>
          </div>
          
          <!-- Compact C State Grid -->
          <div class="rabbit-section">
            <div class="rabbit-section-label">Carry Bits (C[i])</div>
            <div class="rabbit-c-grid">
              ${cStateValues
                .map(
                  (c, i) => `
                <div class="rabbit-c-item">C[${i}]: <span>${c}</span></div>
              `
                )
                .join("")}
            </div>
          </div>
          
          <!-- Keystream Output -->
          <div class="rabbit-section">
            <div class="rabbit-section-label">Keystream Output (16 bytes)</div>
            <div class="rabbit-value-mono rabbit-keystream">${keyStreamSample}</div>
          </div>
          
          <!-- Process Steps -->
          <div class="rabbit-steps">
            ${stepDetails
              .map(
                (step, i) => `
              <div class="rabbit-step ${
                currentStep === i + 1 ? "active" : ""
              }" title="${step.title}">
                ${i + 1}
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      </div>
      
      <!-- Mathematical Properties -->
      <div class="rabbit-math-properties">
        <div class="rabbit-math-title">Mathematical Properties</div>
        <div class="rabbit-math-content">
          <div class="rabbit-math-item">
            <span class="rabbit-math-label">Period:</span>
            <span class="rabbit-math-value">≈ 2^{128}</span>
          </div>
          <div class="rabbit-math-item">
            <span class="rabbit-math-label">Counter A:</span>
            <span class="rabbit-math-value">0x4D34D34D34D34D</span>
          </div>
          <div class="rabbit-math-item">
            <span class="rabbit-math-label">Algebraic Degree:</span>
            <span class="rabbit-math-value">Quadratic (g-function)</span>
          </div>
          <div class="rabbit-math-item">
            <span class="rabbit-math-label">State Size:</span>
            <span class="rabbit-math-value">513 bits</span>
          </div>
        </div>
      </div>
    </div>
  `;

  // Create a style element for our custom styles
  const style = document.createElement("style");
  style.textContent = `
    /* Reset and base styles */
    :host {
      all: initial;
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #333;
      box-sizing: border-box;
    }
    
    *, *:before, *:after {
      box-sizing: inherit;
      margin: 0;
      padding: 0;
    }
    
    .rabbit-state-container {
      background: #f8f9fa;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      padding: 16px;
      margin: 0 auto;
      max-width: 100%;
    }
    
    .rabbit-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e9ecef;
    }
    
    .rabbit-header h4 {
      font-size: 16px;
      font-weight: 600;
      color: #212529;
      margin: 0;
    }
    
    .rabbit-download-btn {
      display: flex;
      align-items: center;
      gap: 5px;
      background: #4361ee;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 6px 10px;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.2s;
    }
    
    .rabbit-download-btn:hover {
      background: #3a56d4;
    }
    
    .rabbit-main-content {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;
    }
    
    .rabbit-left-column {
      flex: 1.2;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .rabbit-right-column {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .rabbit-key-iv-wrapper {
      background: white;
      border-radius: 5px;
      padding: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    
    .rabbit-data-row {
      display: flex;
      align-items: center;
      margin-bottom: 8px;
    }
    
    .rabbit-data-row:last-child {
      margin-bottom: 0;
    }
    
    .rabbit-label {
      font-weight: 600;
      font-size: 12px;
      color: #495057;
      width: 60px;
      margin-right: 8px;
    }
    
    .rabbit-value-mono {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      background: #f1f3f5;
      padding: 4px 8px;
      border-radius: 3px;
      font-size: 11px;
      flex: 1;
    }
    
    .rabbit-diagram {
      background: white;
      border-radius: 5px;
      padding: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      overflow: visible;
    }
    
    .rabbit-diagram svg {
      width: 100%;
      height: auto;
      display: block;
      overflow: visible;
    }
    
    .rabbit-section {
      background: white;
      border-radius: 5px;
      padding: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    
    .rabbit-section-label {
      font-weight: 600;
      font-size: 12px;
      color: #495057;
      margin-bottom: 8px;
      border-bottom: 1px solid #f1f3f5;
      padding-bottom: 4px;
    }
    
    .rabbit-step-detail {
      background: #EBF5FF;
      border-left: 4px solid #4361ee;
    }
    
    .rabbit-step-description {
      font-size: 12px;
      margin-bottom: 6px;
      color: #495057;
    }
    
    .rabbit-formula {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 11px;
      background: rgba(67, 97, 238, 0.1);
      padding: 6px;
      border-radius: 3px;
      color: #3a56d4;
    }
    
    .rabbit-x-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }
    
    .rabbit-x-item {
      border: 1px solid #e9ecef;
      border-radius: 3px;
      padding: 6px;
    }
    
    .rabbit-x-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
      font-size: 11px;
      font-weight: 500;
    }
    
    .rabbit-x-meter {
      height: 4px;
      width: 30px;
      background: #e9ecef;
      border-radius: 2px;
      overflow: hidden;
    }
    
    .rabbit-x-meter > div {
      height: 100%;
      background: #4361ee;
      border-radius: 2px;
      transition: width 0.3s;
    }
    
    .rabbit-x-value {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 10px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .rabbit-c-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }
    
    .rabbit-c-item {
      font-size: 11px;
      background: #f1f3f5;
      padding: 6px;
      border-radius: 3px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .rabbit-c-item span {
      font-weight: 600;
      color: #4361ee;
    }
    
    .rabbit-keystream {
      letter-spacing: 1px;
    }
    
    .rabbit-steps {
      display: flex;
      justify-content: space-between;
      margin-top: 8px;
    }
    
    .rabbit-step {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      border-radius: 50%;
      background: #e9ecef;
      color: #495057;
      font-weight: 600;
      cursor: help;
      margin: 0 4px;
    }
    
    .rabbit-step.active {
      background: #4361ee;
      color: white;
      box-shadow: 0 0 0 3px rgba(67, 97, 238, 0.2);
    }
    
    .rabbit-math-properties {
      background: white;
      border-radius: 5px;
      padding: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    
    .rabbit-math-title {
      font-weight: 600;
      font-size: 12px;
      color: #495057;
      margin-bottom: 8px;
      border-bottom: 1px solid #f1f3f5;
      padding-bottom: 4px;
    }
    
    .rabbit-math-content {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    
    .rabbit-math-item {
      flex: 1;
      min-width: 120px;
      font-size: 11px;
      background: #f8f9fa;
      padding: 6px;
      border-radius: 3px;
      display: flex;
      flex-direction: column;
    }
    
    .rabbit-math-label {
      font-weight: 600;
      color: #495057;
    }
    
    .rabbit-math-value {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      color: #4361ee;
    }
    
    @media (max-width: 768px) {
      .rabbit-main-content {
        flex-direction: column;
      }
      
      .rabbit-left-column, .rabbit-right-column {
        width: 100%;
      }
    }
    
    @media (max-width: 480px) {
      .rabbit-x-grid, .rabbit-c-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      
      .rabbit-math-content {
        flex-direction: column;
      }
    }
  `;

  // Append the style and HTML to the shadow root
  shadowRoot.appendChild(style);

  // Create a wrapper for the HTML content
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  shadowRoot.appendChild(wrapper);

  // Clear previous content and append the new container
  stateVizElement.innerHTML = "";
  stateVizElement.appendChild(container);

  // Add event listener to the download button
  shadowRoot
    .querySelector("#downloadStateBtn")
    .addEventListener("click", function () {
      // Format state data for download
      const stateText = formatStateForDownload(stateData);

      // Create a Blob containing the data
      const blob = new Blob([stateText], { type: "text/plain" });

      // Create a download link and trigger it
      const downloadLink = document.createElement("a");
      downloadLink.href = URL.createObjectURL(blob);
      downloadLink.download = `rabbit-state-${Date.now()}.txt`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    });
}

// Helper function to format state data for download (define your own implementation)
function formatStateForDownload(stateData) {
  return `Rabbit Cipher State Snapshot
Generated: ${stateData.timestamp}
-------------------------------------
KEY: ${stateData.key}
IV: ${stateData.iv}
COUNTER: ${stateData.counter}

X-STATE:
${stateData.xState.map((x, i) => `X[${i}] = ${x}`).join("\n")}

CARRY BITS:
${stateData.cState.map((c, i) => `C[${i}] = ${c}`).join("\n")}

KEYSTREAM SAMPLE:
${stateData.keystream}
-------------------------------------
`;
}

// This function should be defined in your code to get the current step
function getCurrentStep() {
  // Placeholder: return a value between 1 and 5
  return Math.ceil(Math.random() * 5);
}

// This function should be defined in your code to format hex strings
function formatHexString(hexValue, groupSize) {
  if (!hexValue) return "0000 0000 0000 0000";
  // Example implementation for formatting
  return hexValue.match(new RegExp(`.{1,${groupSize}}`, "g")).join(" ");
}

function processEncryptedData(encryptedHexString, originalMessage = null) {
  totalPackets++;

  // Store the latest encrypted data
  latestEncryptedHex = encryptedHexString;

  // Add to raw data log
  if (rawDataLog.length >= 20) rawDataLog.shift();
  rawDataLog.push({
    timestamp: new Date().toISOString(),
    data: encryptedHexString,
  });
  updateRawDataVisualization();

  // If encryption is enabled, decrypt the data
  if (encryptionEnabled) {
    decryptData(encryptedHexString).then((decryptResult) => {
      if (decryptResult.success) {
        // Store the latest decrypted text
        latestDecryptedText = decryptResult.text;

        processSensorData(decryptResult.data);

        // Add to decrypted data log
        if (decryptedDataLog.length >= 20) decryptedDataLog.shift();
        decryptedDataLog.push({
          timestamp: new Date().toISOString(),
          hexData: encryptedHexString,
          text: decryptResult.text,
        });
        updateDecryptedDataVisualization();

        // Update visualization display with what we already have
        updateVisualizationDisplay();
      }
      updateStatistics();
    });
  } else if (originalMessage) {
    // If encryption is disabled, use the original message
    try {
      latestDecryptedText = originalMessage;

      const data = JSON.parse(originalMessage);
      processSensorData(data);

      // Add to decrypted data log
      if (decryptedDataLog.length >= 20) decryptedDataLog.shift();
      decryptedDataLog.push({
        timestamp: new Date().toISOString(),
        text: originalMessage,
      });
      updateDecryptedDataVisualization();

      // Update visualization display with what we already have
      updateVisualizationDisplay();

      successPackets++;
    } catch (error) {
      console.error("Error parsing data:", error);
      failedPackets++;
    }
    updateStatistics();
  }
}
// Function to request visualization for the latest packet
// Function to request visualization for the latest packet
function requestLatestVisualization() {
  // Don't make any new calls, just update the display with what we already have
  updateVisualizationDisplay();

  // Only request state visualization if we don't have any operation visualizations
  if (!encryptVisualization && !decryptVisualization) {
    updateInternalStateVisualization();
  }
}

// Helper function to format hex strings with spaces

// Helper functions
function validateHexBytes(input, expectedLength) {
  const hexPattern = /^([0-9A-Fa-f]{2}\s)*[0-9A-Fa-f]{2}$/;
  if (!hexPattern.test(input)) {
    return false;
  }

  const bytes = input.split(/\s+/);
  return expectedLength ? bytes.length === expectedLength : true;
}

function simulateSensorData() {
  // Generate random but realistic values
  const now = new Date();

  // Simulate accelerometer readings (typically between -2g and 2g)
  const accelX = parseFloat((Math.random() * 4 - 2).toFixed(3));
  const accelY = parseFloat((Math.random() * 4 - 2).toFixed(3));
  const accelZ = parseFloat((Math.random() * 4 - 2).toFixed(3));

  // Simulate gyroscope readings (typically between -250 and 250 deg/s)
  const gyroX = parseFloat((Math.random() * 500 - 250).toFixed(3));
  const gyroY = parseFloat((Math.random() * 500 - 250).toFixed(3));
  const gyroZ = parseFloat((Math.random() * 500 - 250).toFixed(3));

  // Simulate temperature (room temperature with slight variations)
  const temperature = parseFloat((23 + Math.random() * 2 - 1).toFixed(1));

  // Create data packet
  const sensorDataPacket = {
    timestamp: now.getTime(),
    accel: {
      x: accelX,
      y: accelY,
      z: accelZ,
    },
    gyro: {
      x: gyroX,
      y: gyroY,
      z: gyroZ,
    },
    temp: temperature,
  };

  // Convert to JSON string
  const jsonString = JSON.stringify(sensorDataPacket);

  // Encrypt the data if encryption is enabled
  if (encryptionEnabled) {
    encryptData(jsonString);
  } else {
    // If encryption is disabled, just process the raw data
    const fakeEncryptedHex = Array.from(new TextEncoder().encode(jsonString))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");

    processEncryptedData(fakeEncryptedHex, jsonString);
  }

  // Set timeout for next data simulation
  setTimeout(fetchSensorData, 1000);
}

function encryptData(message) {
  const startTime = performance.now();

  fetch("rabbit_cipher.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      action: "encrypt",
      key: rabbitKey,
      iv: rabbitIV,
      message: message,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.error) {
        console.error("Encryption failed:", data.error);
        failedPackets++;
      } else {
        // Process the encrypted data
        processEncryptedData(data.result, message);

        // Get visualization data if available
        if (data.visualization) {
          document.getElementById("encryptionVisualization").textContent =
            data.visualization;
        }
      }
      updateStatistics();
    })
    .catch((error) => {
      console.error("Error calling PHP API:", error);
      failedPackets++;
      updateStatistics();
    });
}

function updateStatistics() {
  document.getElementById("totalPackets").textContent = totalPackets;
  document.getElementById("successPackets").textContent = successPackets;
  document.getElementById("failedPackets").textContent = failedPackets;

  // Calculate average decryption time
  const avgTime =
    decryptTimes.length > 0
      ? (decryptTimes.reduce((a, b) => a + b, 0) / decryptTimes.length).toFixed(
          2
        )
      : 0;
  document.getElementById("avgDecryptTime").textContent = avgTime + " ms";
}
// Process incoming encrypted data
function processEncryptedData(encryptedHexString, originalMessage = null) {
  totalPackets++;

  // Add to raw data log
  if (rawDataLog.length >= 20) rawDataLog.shift();
  rawDataLog.push({
    timestamp: new Date().toISOString(),
    data: encryptedHexString,
  });
  updateRawDataVisualization();

  // If encryption is enabled, decrypt the data
  if (encryptionEnabled) {
    decryptData(encryptedHexString).then((decryptResult) => {
      if (decryptResult.success) {
        processSensorData(decryptResult.data);

        // Add to decrypted data log
        if (decryptedDataLog.length >= 20) decryptedDataLog.shift();
        decryptedDataLog.push({
          timestamp: new Date().toISOString(),
          hexData: encryptedHexString,
          text: decryptResult.text,
        });
        updateDecryptedDataVisualization();
      }
      updateStatistics();
    });
  } else if (originalMessage) {
    // If encryption is disabled, use the original message
    try {
      const data = JSON.parse(originalMessage);
      processSensorData(data);

      // Add to decrypted data log
      if (decryptedDataLog.length >= 20) decryptedDataLog.shift();
      decryptedDataLog.push({
        timestamp: new Date().toISOString(),
        text: originalMessage,
      });
      updateDecryptedDataVisualization();

      successPackets++;
    } catch (error) {
      console.error("Error parsing data:", error);
      failedPackets++;
    }
    updateStatistics();
  }
}
function updateRawDataVisualization() {
  if (rawDataLog.length === 0) return;

  let visualization = "--- RAW ENCRYPTED DATA STREAM ---\n\n";
  rawDataLog.forEach((entry, index) => {
    visualization += `[${entry.timestamp}] Packet ${
      totalPackets - (rawDataLog.length - 1 - index)
    }:\n`;
    visualization += `${entry.data}\n\n`;
  });

  document.getElementById("rawDataVisualization").textContent = visualization;
}

// Function to decrypt data using PHP backend
function decryptData(hexData) {
  const startTime = performance.now();

  return fetch("rabbit_cipher.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      action: "decrypt",
      key: rabbitKey,
      iv: rabbitIV,
      hexData: hexData,
      includeVisualization: true,
    }),
  })
    .then((response) => {
      return response.json();
    })
    .then((data) => {
      const connectionStatus = document.getElementById("connectionStatus");
      connectionStatus.textContent = `Fetching Sensor Data`;
      const encryptionBadge = document.getElementById("encryptionBadge");
      encryptionBadge.textContent = `Encrypted`;
      const endTime = performance.now();
      const decryptTime = endTime - startTime;
      decryptTimes.push(decryptTime);

      if (data.error) {
        console.error("Decryption failed:", data.error);
        failedPackets++;
        return {
          success: false,
          error: data.error,
          time: decryptTime,
        };
      } else {
        successPackets++;
        console.log("😈❌", data.visualization);
        // Get visualization data if available and store it
        if (data.visualization) {
          decryptVisualization = data.visualization;
          updateVisualizationDisplay();
        }

        return {
          success: true,
          data: JSON.parse(data.result),
          text: data.result,
          time: decryptTime,
        };
      }
    })
    .catch((error) => {
      console.error("Error calling PHP API:", error);
      failedPackets++;
      return {
        success: false,
        error: error.message,
      };
    });
}

// Process and display sensor data
function processSensorData(data) {
  // Create a custom event with the sensor data
  const sensorEvent = new CustomEvent("sensorDataUpdate", {
    detail: {
      accel: {
        x: data.accel.x,
        y: data.accel.y,
        z: data.accel.z,
      },
      gyro: {
        x: data.gyro.x,
        y: data.gyro.y,
        z: data.gyro.z,
      },
    },
  });

  // Dispatch the event
  window.dispatchEvent(sensorEvent);
  // Add to data array with a maximum length
  sensorData.push(data);
  if (sensorData.length > MAX_DATA_POINTS) {
    sensorData.shift();
  }

  // Update current readings display
  document.getElementById("accelX").textContent = data.accel.x.toFixed(3);
  document.getElementById("accelY").textContent = data.accel.y.toFixed(3);
  document.getElementById("accelZ").textContent = data.accel.z.toFixed(3);

  document.getElementById("gyroX").textContent = data.gyro.x.toFixed(3);
  document.getElementById("gyroY").textContent = data.gyro.y.toFixed(3);
  document.getElementById("gyroZ").textContent = data.gyro.z.toFixed(3);

  document.getElementById("temperature").textContent = data.temp.toFixed(1);

  // Update orientation model
  updateOrientationModel(data.accel);

  // Update charts
  updateCharts();
}

// Update the 3D orientation of the device model
function updateOrientationModel(accel) {
  // Calculate orientation based on accelerometer readings
  // This is a simple representation and not actual 3D orientation calculation
  const deviceModel = document.getElementById("deviceModel");

  // Limit rotation to reasonable values
  const maxRotation = 35; // Max rotation in degrees

  // Calculate rotation angles based on accelerometer data
  const rotX = Math.max(-maxRotation, Math.min(maxRotation, accel.y * 25));
  const rotY = Math.max(-maxRotation, Math.min(maxRotation, accel.x * 25));

  // Apply rotation transformation
  deviceModel.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
}

function updateDecryptedDataVisualization() {
  if (decryptedDataLog.length === 0) return;

  let visualization = "--- DECRYPTED DATA STREAM ---\n\n";
  decryptedDataLog.forEach((entry, index) => {
    visualization += `[${entry.timestamp}] Packet ${
      totalPackets - (decryptedDataLog.length - 1 - index)
    }:\n`;
    if (entry.hexData) {
      visualization += `Hex: ${entry.hexData}\n`;
    }
    visualization += `JSON: ${entry.text}\n\n`;
  });

  document.getElementById("decryptedDataVisualization").textContent =
    visualization;
}

// // Enhanced chart initialization with interactive features
// function initCharts() {
//   const ctx1 = document.getElementById("accelChart").getContext("2d");
//   const ctx2 = document.getElementById("gyroChart").getContext("2d");

//   // Shared chart options with improved interactivity
//   const chartOptions = {
//     type: "line",
//     options: {
//       responsive: true,
//       maintainAspectRatio: false,
//       animation: {
//         duration: 500,
//       },
//       scales: {
//         x: {
//           type: "time",
//           time: {
//             unit: "second",
//             tooltipFormat: "HH:mm:ss.SSS",
//             displayFormats: {
//               second: "HH:mm:ss",
//             },
//           },
//           title: {
//             display: true,
//             text: "Time",
//             font: {
//               weight: "bold",
//             },
//           },
//           grid: {
//             color: "rgba(0, 0, 0, 0.1)",
//           },
//         },
//         y: {
//           title: {
//             display: true,
//             font: {
//               weight: "bold",
//             },
//           },
//           grid: {
//             color: "rgba(0, 0, 0, 0.1)",
//           },
//         },
//       },
//       interaction: {
//         mode: "nearest",
//         axis: "x",
//         intersect: false,
//       },
//       plugins: {
//         zoom: {
//           pan: {
//             enabled: true,
//             mode: "x",
//           },
//           zoom: {
//             wheel: {
//               enabled: true,
//             },
//             pinch: {
//               enabled: true,
//             },
//             mode: "x",
//           },
//         },
//         tooltip: {
//           callbacks: {
//             label: function (context) {
//               let label = context.dataset.label || "";
//               if (label) {
//                 label += ": ";
//               }
//               if (context.parsed.y !== null) {
//                 label += context.parsed.y.toFixed(3);
//               }
//               return label;
//             },
//           },
//         },
//         legend: {
//           position: "top",
//           labels: {
//             usePointStyle: true,
//             boxWidth: 6,
//           },
//           onClick: function (e, legendItem, legend) {
//             const index = legendItem.datasetIndex;
//             const ci = legend.chart;
//             if (ci.isDatasetVisible(index)) {
//               ci.hide(index);
//               legendItem.hidden = true;
//             } else {
//               ci.show(index);
//               legendItem.hidden = false;
//             }

//             // Update the highlight in the current values display
//             const axisLabels = ["X", "Y", "Z"];
//             axisLabels.forEach((axis, i) => {
//               const accelElement = document.getElementById(`accel${axis}`);
//               const gyroElement = document.getElementById(`gyro${axis}`);

//               if (ci === accelChart) {
//                 if (accelElement) {
//                   accelElement.classList.toggle(
//                     "axis-hidden",
//                     ci.isDatasetVisible(i) === false
//                   );
//                 }
//               } else if (ci === gyroChart) {
//                 if (gyroElement) {
//                   gyroElement.classList.toggle(
//                     "axis-hidden",
//                     ci.isDatasetVisible(i) === false
//                   );
//                 }
//               }
//             });
//           },
//         },
//         annotation: {
//           annotations: {
//             thresholdLine: {
//               type: "line",
//               yMin: 0,
//               yMax: 0,
//               borderColor: "rgba(0, 0, 0, 0.3)",
//               borderWidth: 1,
//               borderDash: [5, 5],
//               label: {
//                 display: true,
//                 content: "Zero",
//                 position: "end",
//               },
//             },
//           },
//         },
//         crosshair: {
//           line: {
//             color: "rgba(0, 0, 0, 0.3)",
//             width: 1,
//             dashPattern: [5, 5],
//           },
//           sync: {
//             enabled: true,
//             group: 1,
//           },
//           zoom: {
//             enabled: false,
//           },
//         },
//       },
//     },
//   };

//   // Accelerometer Chart with enhanced features
//   accelChart = new Chart(ctx1, {
//     ...chartOptions,
//     data: {
//       datasets: [
//         {
//           label: "X",
//           data: [],
//           borderColor: "#0066cc",
//           backgroundColor: "rgba(0, 102, 204, 0.1)",
//           pointRadius: 2,
//           borderWidth: 2,
//           tension: 0.1,
//           fill: false,
//         },
//         {
//           label: "Y",
//           data: [],
//           borderColor: "#009900",
//           backgroundColor: "rgba(0, 153, 0, 0.1)",
//           pointRadius: 2,
//           borderWidth: 2,
//           tension: 0.1,
//           fill: false,
//         },
//         {
//           label: "Z",
//           data: [],
//           borderColor: "#cc0000",
//           backgroundColor: "rgba(204, 0, 0, 0.1)",
//           pointRadius: 2,
//           borderWidth: 2,
//           tension: 0.1,
//           fill: false,
//         },
//       ],
//     },
//     options: {
//       ...chartOptions.options,
//       scales: {
//         ...chartOptions.options.scales,
//         y: {
//           ...chartOptions.options.scales.y,
//           title: {
//             display: true,
//             text: "Acceleration (g)",
//           },
//         },
//       },
//     },
//   });

//   // Gyroscope Chart with enhanced features
//   gyroChart = new Chart(ctx2, {
//     ...chartOptions,
//     data: {
//       datasets: [
//         {
//           label: "X",
//           data: [],
//           borderColor: "#0066cc",
//           backgroundColor: "rgba(0, 102, 204, 0.1)",
//           pointRadius: 2,
//           borderWidth: 2,
//           tension: 0.1,
//           fill: false,
//         },
//         {
//           label: "Y",
//           data: [],
//           borderColor: "#009900",
//           backgroundColor: "rgba(0, 153, 0, 0.1)",
//           pointRadius: 2,
//           borderWidth: 2,
//           tension: 0.1,
//           fill: false,
//         },
//         {
//           label: "Z",
//           data: [],
//           borderColor: "#cc0000",
//           backgroundColor: "rgba(204, 0, 0, 0.1)",
//           pointRadius: 2,
//           borderWidth: 2,
//           tension: 0.1,
//           fill: false,
//         },
//       ],
//     },
//     options: {
//       ...chartOptions.options,
//       scales: {
//         ...chartOptions.options.scales,
//         y: {
//           ...chartOptions.options.scales.y,
//           title: {
//             display: true,
//             text: "Angular Velocity (deg/s)",
//           },
//         },
//       },
//     },
//   });

//   // Add chart controls
//   addChartControls();
// }
// Enhanced chart initialization with interactive features and fixed heights
function initCharts() {
  const ctx1 = document.getElementById("accelChart").getContext("2d");
  const ctx2 = document.getElementById("gyroChart").getContext("2d");

  // Define fixed chart height
  const CHART_HEIGHT = 300; // Set your desired fixed height in pixels

  // Apply fixed height to chart containers
  document.getElementById(
    "accelChart"
  ).parentNode.style.height = `${CHART_HEIGHT}px`;
  document.getElementById(
    "gyroChart"
  ).parentNode.style.height = `${CHART_HEIGHT}px`;

  // Shared chart options with improved interactivity
  const chartOptions = {
    type: "line",
    options: {
      responsive: true,
      maintainAspectRatio: false, // This is important for fixed heights
      animation: {
        duration: 500,
      },
      scales: {
        x: {
          type: "time",
          time: {
            unit: "second",
            tooltipFormat: "HH:mm:ss.SSS",
            displayFormats: {
              second: "HH:mm:ss",
            },
          },
          title: {
            display: true,
            text: "Time",
            font: {
              weight: "bold",
            },
          },
          grid: {
            color: "rgba(0, 0, 0, 0.1)",
          },
        },
        y: {
          title: {
            display: true,
            font: {
              weight: "bold",
            },
          },
          grid: {
            color: "rgba(0, 0, 0, 0.1)",
          },
          // Add min/max to prevent excessive scaling
          suggestedMin: -1.5,
          suggestedMax: 1.5,
        },
      },
      interaction: {
        mode: "nearest",
        axis: "x",
        intersect: false,
      },
      plugins: {
        zoom: {
          pan: {
            enabled: true,
            mode: "x",
          },
          zoom: {
            wheel: {
              enabled: true,
            },
            pinch: {
              enabled: true,
            },
            mode: "x",
            // Add reset button functionality
            onZoomComplete: function ({ chart }) {
              if (typeof updateZoomResetButton === "function") {
                updateZoomResetButton(chart);
              }
            },
          },
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              let label = context.dataset.label || "";
              if (label) {
                label += ": ";
              }
              if (context.parsed.y !== null) {
                label += context.parsed.y.toFixed(3);
              }
              return label;
            },
          },
        },
        legend: {
          position: "top",
          labels: {
            usePointStyle: true,
            boxWidth: 6,
          },
          onClick: function (e, legendItem, legend) {
            const index = legendItem.datasetIndex;
            const ci = legend.chart;
            if (ci.isDatasetVisible(index)) {
              ci.hide(index);
              legendItem.hidden = true;
            } else {
              ci.show(index);
              legendItem.hidden = false;
            }

            // Update the highlight in the current values display
            const axisLabels = ["X", "Y", "Z"];
            axisLabels.forEach((axis, i) => {
              const accelElement = document.getElementById(`accel${axis}`);
              const gyroElement = document.getElementById(`gyro${axis}`);

              if (ci === accelChart) {
                if (accelElement) {
                  accelElement.classList.toggle(
                    "axis-hidden",
                    ci.isDatasetVisible(i) === false
                  );
                }
              } else if (ci === gyroChart) {
                if (gyroElement) {
                  gyroElement.classList.toggle(
                    "axis-hidden",
                    ci.isDatasetVisible(i) === false
                  );
                }
              }
            });
          },
        },
        annotation: {
          annotations: {
            thresholdLine: {
              type: "line",
              yMin: 0,
              yMax: 0,
              borderColor: "rgba(0, 0, 0, 0.3)",
              borderWidth: 1,
              borderDash: [5, 5],
              label: {
                display: true,
                content: "Zero",
                position: "end",
              },
            },
          },
        },
        crosshair: {
          line: {
            color: "rgba(0, 0, 0, 0.3)",
            width: 1,
            dashPattern: [5, 5],
          },
          sync: {
            enabled: true,
            group: 1,
          },
          zoom: {
            enabled: false,
          },
        },
      },
    },
  };

  // Accelerometer Chart with enhanced features
  accelChart = new Chart(ctx1, {
    ...chartOptions,
    data: {
      datasets: [
        {
          label: "X",
          data: [],
          borderColor: "#0066cc",
          backgroundColor: "rgba(0, 102, 204, 0.1)",
          pointRadius: 2,
          borderWidth: 2,
          tension: 0.1,
          fill: false,
        },
        {
          label: "Y",
          data: [],
          borderColor: "#009900",
          backgroundColor: "rgba(0, 153, 0, 0.1)",
          pointRadius: 2,
          borderWidth: 2,
          tension: 0.1,
          fill: false,
        },
        {
          label: "Z",
          data: [],
          borderColor: "#cc0000",
          backgroundColor: "rgba(204, 0, 0, 0.1)",
          pointRadius: 2,
          borderWidth: 2,
          tension: 0.1,
          fill: false,
        },
      ],
    },
    options: {
      ...chartOptions.options,
      scales: {
        ...chartOptions.options.scales,
        y: {
          ...chartOptions.options.scales.y,
          title: {
            display: true,
            text: "Acceleration (g)",
          },
        },
      },
    },
  });

  // Gyroscope Chart with enhanced features
  gyroChart = new Chart(ctx2, {
    ...chartOptions,
    data: {
      datasets: [
        {
          label: "X",
          data: [],
          borderColor: "#0066cc",
          backgroundColor: "rgba(0, 102, 204, 0.1)",
          pointRadius: 2,
          borderWidth: 2,
          tension: 0.1,
          fill: false,
        },
        {
          label: "Y",
          data: [],
          borderColor: "#009900",
          backgroundColor: "rgba(0, 153, 0, 0.1)",
          pointRadius: 2,
          borderWidth: 2,
          tension: 0.1,
          fill: false,
        },
        {
          label: "Z",
          data: [],
          borderColor: "#cc0000",
          backgroundColor: "rgba(204, 0, 0, 0.1)",
          pointRadius: 2,
          borderWidth: 2,
          tension: 0.1,
          fill: false,
        },
      ],
    },
    options: {
      ...chartOptions.options,
      scales: {
        ...chartOptions.options.scales,
        y: {
          ...chartOptions.options.scales.y,
          title: {
            display: true,
            text: "Angular Velocity (deg/s)",
          },
          // Gyro might need different scale suggestions
          suggestedMin: -200,
          suggestedMax: 200,
        },
      },
    },
  });

  // Add chart controls
  addChartControls();
}

// Function to add enhanced chart controls
function addChartControls() {
  // Create a container for controls if it doesn't exist
  let controlsContainer = document.getElementById("chartControls");
  if (!controlsContainer) {
    controlsContainer = document.createElement("div");
    controlsContainer.id = "chartControls";
    controlsContainer.className = "chart-controls";
    document
      .getElementById("accelChart")
      .parentNode.parentNode.insertBefore(
        controlsContainer,
        document.getElementById("accelChart").parentNode
      );
  }

  // Reset zoom button
  const resetZoomBtn = document.createElement("button");
  resetZoomBtn.id = "resetZoom";
  resetZoomBtn.innerText = "Reset Zoom";
  resetZoomBtn.className = "control-btn";
  resetZoomBtn.style.display = "none"; // Initially hidden
  resetZoomBtn.onclick = function () {
    if (accelChart) accelChart.resetZoom();
    if (gyroChart) gyroChart.resetZoom();
    resetZoomBtn.style.display = "none";
  };

  // Synchronize charts button
  const syncChartsBtn = document.createElement("button");
  syncChartsBtn.id = "syncCharts";
  syncChartsBtn.innerText = "Sync Charts";
  syncChartsBtn.className = "control-btn active";
  syncChartsBtn.onclick = function () {
    const isActive = syncChartsBtn.classList.contains("active");
    if (isActive) {
      syncChartsBtn.classList.remove("active");
      syncChartsBtn.innerText = "Sync Charts: Off";
      // Disable sync in crosshair plugin
      accelChart.options.plugins.crosshair.sync.enabled = false;
      gyroChart.options.plugins.crosshair.sync.enabled = false;
    } else {
      syncChartsBtn.classList.add("active");
      syncChartsBtn.innerText = "Sync Charts: On";
      // Enable sync in crosshair plugin
      accelChart.options.plugins.crosshair.sync.enabled = true;
      gyroChart.options.plugins.crosshair.sync.enabled = true;
    }
    accelChart.update();
    gyroChart.update();
  };

  // Add buttons to container
  controlsContainer.appendChild(resetZoomBtn);
  controlsContainer.appendChild(syncChartsBtn);

  // Add some CSS for controls
  const style = document.createElement("style");
  style.textContent = `
    .chart-controls {
      display: flex;
      justify-content: center;
      margin-bottom: 10px;
      gap: 10px;
    }
    .control-btn {
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      background-color: #f0f0f0;
      cursor: pointer;
      font-size: 14px;
    }
    .control-btn:hover {
      background-color: #e0e0e0;
    }
    .control-btn.active {
      background-color: #0066cc;
      color: white;
    }
    .axis-hidden {
      opacity: 0.3;
    }
  `;
  document.head.appendChild(style);
}

// Function to update zoom reset button visibility
function updateZoomResetButton(chart) {
  const resetZoomBtn = document.getElementById("resetZoom");
  if (!resetZoomBtn) return;

  // Check if either chart is zoomed
  const isZoomed =
    (accelChart && accelChart.isZoomedOrPanned()) ||
    (gyroChart && gyroChart.isZoomedOrPanned());

  resetZoomBtn.style.display = isZoomed ? "block" : "none";
}

// Add isZoomedOrPanned method to Chart prototype if not exists
if (typeof Chart.prototype.isZoomedOrPanned !== "function") {
  Chart.prototype.isZoomedOrPanned = function () {
    const zoom = this.getZoomLevel();
    return zoom !== 1;
  };

  Chart.prototype.getZoomLevel = function () {
    if (!this.scales.x) return 1;
    const min = this.scales.x.min || 0;
    const max = this.scales.x.max || 1;
    const originalMin = this.options.scales.x.min;
    const originalMax = this.options.scales.x.max;

    // If original min/max not set, we can't determine zoom level precisely
    if (originalMin === undefined || originalMax === undefined) {
      // Use dataset min/max as approximation
      const datasets = this.data.datasets;
      if (!datasets || !datasets.length) return 1;

      let allPoints = [];
      datasets.forEach((dataset) => {
        if (dataset.data && dataset.data.length) {
          allPoints = allPoints.concat(dataset.data);
        }
      });

      if (allPoints.length === 0) return 1;

      // If current view range is significantly smaller than data range, consider it zoomed
      const dataRange =
        Math.max(...allPoints.map((p) => p.x)) -
        Math.min(...allPoints.map((p) => p.x));
      const viewRange = max - min;

      return dataRange / viewRange;
    }

    return (originalMax - originalMin) / (max - min);
  };
}
// // Function to add interactive chart controls
// function addChartControls() {
//   // Create chart controls container if it doesn't exist
//   const chartsContainer = document.querySelector(".charts-container");
//   if (!chartsContainer) return;

//   let controlsContainer = document.getElementById("chartControls");
//   if (!controlsContainer) {
//     controlsContainer = document.createElement("div");
//     controlsContainer.id = "chartControls";
//     controlsContainer.className = "chart-controls";
//     chartsContainer.insertBefore(controlsContainer, chartsContainer.firstChild);
//   }

//   // Add time range selector
//   controlsContainer.innerHTML = `
//       <div class="control-group">
//         <label for="timeRange">Time Display:</label>
//         <select id="timeRange">
//           <option value="10">Last 10 seconds</option>
//           <option value="30">Last 30 seconds</option>
//           <option value="60">Last 1 minute</option>
//           <option value="300">Last 5 minutes</option>
//           <option value="all" selected>All Data</option>
//         </select>
//       </div>
//       <div class="control-group">
//         <button id="resetZoom" class="control-button">Reset Zoom</button>
//         <button id="toggleFill" class="control-button">Toggle Fill</button>
//       </div>
//       <div class="control-group">
//         <label>
//           <input type="checkbox" id="syncCharts" checked>
//           Sync Charts
//         </label>
//       </div>
//       <div class="chart-status">
//         <span id="dataPointCount">0 data points</span>
//       </div>
//     `;

//   // Time range selector event listener
//   document.getElementById("timeRange").addEventListener("change", function () {
//     const value = this.value;
//     if (value === "all") {
//       // Show all data
//       updateCharts();
//     } else {
//       // Filter data by time range
//       const timeRange = parseInt(value) * 1000; // Convert to milliseconds
//       const now = Date.now();

//       filterChartsByTimeRange(now - timeRange);
//     }
//   });

//   // Reset zoom button
//   document.getElementById("resetZoom").addEventListener("click", function () {
//     if (accelChart.resetZoom) accelChart.resetZoom();
//     if (gyroChart.resetZoom) gyroChart.resetZoom();
//   });

//   // Toggle fill button
//   document.getElementById("toggleFill").addEventListener("click", function () {
//     toggleChartFill(accelChart);
//     toggleChartFill(gyroChart);
//   });

//   // Sync charts checkbox
//   document.getElementById("syncCharts").addEventListener("change", function () {
//     const syncEnabled = this.checked;
//     // Update crosshair sync option
//     if (accelChart.options.plugins.crosshair) {
//       accelChart.options.plugins.crosshair.sync.enabled = syncEnabled;
//       gyroChart.options.plugins.crosshair.sync.enabled = syncEnabled;
//       accelChart.update();
//       gyroChart.update();
//     }
//   });
// }

// Function to add enhanced interactive chart controls
function addChartControls() {
  // Create chart controls container if it doesn't exist
  const chartsContainer = document.querySelector(".charts-container");
  if (!chartsContainer) return;

  let controlsContainer = document.getElementById("chartControls");
  if (!controlsContainer) {
    controlsContainer = document.createElement("div");
    controlsContainer.id = "chartControls";
    controlsContainer.className = "chart-controls";
    chartsContainer.insertBefore(controlsContainer, chartsContainer.firstChild);
  }

  // Add enhanced controls with tooltips and animations
  controlsContainer.innerHTML = `
        <div class="control-group">
          <label for="timeRange">Time Display:</label>
          <select id="timeRange" title="Select time range to display">
            <option value="10">Last 10 seconds</option>
            <option value="30">Last 30 seconds</option>
            <option value="60">Last 1 minute</option>
            <option value="300">Last 5 minutes</option>
            <option value="all" selected>All Data</option>
          </select>
        </div>
        <div class="control-group">
          <button id="resetZoom" class="control-button" title="Reset chart zoom level">Reset Zoom</button>
          <button id="toggleFill" class="control-button" title="Toggle area fill on charts">Toggle Fill</button>
          <button id="toggleDarkMode" class="control-button" title="Switch between light and dark mode">
            <span class="mode-icon">☀️</span>
          </button>
        </div>
        <div class="control-group">
          <label title="Synchronize zoom and pan between charts">
            <input type="checkbox" id="syncCharts" checked>
            Sync Charts
          </label>
          <label title="Smooth data transitions">
            <input type="checkbox" id="animateCharts" checked>
            Animate
          </label>
        </div>
        <div class="chart-status">
          <span id="dataPointCount">0 data points</span>
          <div id="recordingIndicator" class="recording-indicator" style="display: none;">Recording</div>
        </div>
      `;

  // Time range selector with visual feedback
  const timeRangeSelect = document.getElementById("timeRange");
  timeRangeSelect.addEventListener("change", function () {
    // Add animation class
    this.classList.add("control-changed");
    setTimeout(() => this.classList.remove("control-changed"), 300);

    const value = this.value;
    if (value === "all") {
      // Show all data
      updateCharts();
      showToast("Showing all available data");
    } else {
      // Filter data by time range
      const timeRange = parseInt(value) * 1000; // Convert to milliseconds
      const now = Date.now();
      filterChartsByTimeRange(now - timeRange);

      // Show feedback toast
      const readableTime =
        value >= 60
          ? `${value / 60} minute${value / 60 > 1 ? "s" : ""}`
          : `${value} seconds`;
      showToast(`Showing last ${readableTime} of data`);
    }
  });

  // Reset zoom button with feedback
  const resetZoomBtn = document.getElementById("resetZoom");
  resetZoomBtn.addEventListener("click", function () {
    // Visual feedback
    this.classList.add("button-active");
    setTimeout(() => this.classList.remove("button-active"), 300);

    if (accelChart.resetZoom) accelChart.resetZoom();
    if (gyroChart.resetZoom) gyroChart.resetZoom();

    showToast("Charts reset to default view");
  });

  // Toggle fill button with state tracking
  const toggleFillBtn = document.getElementById("toggleFill");
  toggleFillBtn.addEventListener("click", function () {
    // Toggle active state
    this.classList.toggle("active");
    const isFilled = this.classList.contains("active");

    toggleChartFill(accelChart, isFilled);
    toggleChartFill(gyroChart, isFilled);

    showToast(`Chart fill ${isFilled ? "enabled" : "disabled"}`);
  });

  // Dark mode toggle
  const darkModeBtn = document.getElementById("toggleDarkMode");
  darkModeBtn.addEventListener("click", function () {
    this.classList.toggle("active");
    const isDarkMode = this.classList.contains("active");

    // Toggle icon
    const modeIcon = this.querySelector(".mode-icon");
    modeIcon.textContent = isDarkMode ? "🌙" : "☀️";

    // Apply dark mode to charts and container
    document.body.classList.toggle("dark-mode");
    updateChartColorScheme(isDarkMode);

    showToast(`${isDarkMode ? "Dark" : "Light"} mode activated`);
  });

  // Sync charts checkbox with enhanced feedback
  const syncChartsCheckbox = document.getElementById("syncCharts");
  syncChartsCheckbox.addEventListener("change", function () {
    const syncEnabled = this.checked;

    // Update crosshair sync option with visual feedback
    if (accelChart.options.plugins.crosshair) {
      accelChart.options.plugins.crosshair.sync.enabled = syncEnabled;
      gyroChart.options.plugins.crosshair.sync.enabled = syncEnabled;

      // Apply changes with animation if enabled
      if (document.getElementById("animateCharts").checked) {
        accelChart.options.transitions.active.animation.duration = 300;
        gyroChart.options.transitions.active.animation.duration = 300;
      } else {
        accelChart.options.transitions.active.animation.duration = 0;
        gyroChart.options.transitions.active.animation.duration = 0;
      }

      accelChart.update();
      gyroChart.update();

      showToast(
        `Charts synchronization ${syncEnabled ? "enabled" : "disabled"}`
      );
    }
  });

  // Animation toggle
  document
    .getElementById("animateCharts")
    .addEventListener("change", function () {
      const animateEnabled = this.checked;

      // Set animation duration for both charts
      const duration = animateEnabled ? 300 : 0;
      if (accelChart.options.transitions && gyroChart.options.transitions) {
        accelChart.options.transitions.active.animation.duration = duration;
        gyroChart.options.transitions.active.animation.duration = duration;
        accelChart.update();
        gyroChart.update();

        showToast(
          `Chart animations ${animateEnabled ? "enabled" : "disabled"}`
        );
      }
    });

  // Initialize data count updater
  initializeDataCounter();

  // Add keyboard shortcuts for common actions
  addKeyboardShortcuts();
}
function initializeChartControls() {
  // Time range selector with visual feedback
  const timeRangeSelect = document.getElementById("timeRange");
  timeRangeSelect.addEventListener("change", function () {
    // Add animation class
    this.classList.add("control-changed");
    setTimeout(() => this.classList.remove("control-changed"), 300);

    const value = this.value;
    if (value === "all") {
      // Show all data
      updateCharts();
      showToast("Showing all available data");
    } else {
      // Filter data by time range
      const timeRange = parseInt(value) * 1000; // Convert to milliseconds
      const now = Date.now();
      filterChartsByTimeRange(now - timeRange);

      // Show feedback toast
      const readableTime =
        value >= 60
          ? `${value / 60} minute${value / 60 > 1 ? "s" : ""}`
          : `${value} seconds`;
      showToast(`Showing last ${readableTime} of data`);
    }
  });

  // Reset zoom button with feedback
  const resetZoomBtn = document.getElementById("resetZoom");
  resetZoomBtn.addEventListener("click", function () {
    // Visual feedback
    this.classList.add("button-active");
    setTimeout(() => this.classList.remove("button-active"), 300);

    if (accelChart.resetZoom) accelChart.resetZoom();
    if (gyroChart.resetZoom) gyroChart.resetZoom();

    showToast("Charts reset to default view");
  });

  // Toggle fill button with state tracking
  const toggleFillBtn = document.getElementById("toggleFill");
  toggleFillBtn.addEventListener("click", function () {
    // Toggle active state
    this.classList.toggle("active");
    const isFilled = this.classList.contains("active");

    toggleChartFill(accelChart, isFilled);
    toggleChartFill(gyroChart, isFilled);

    showToast(`Chart fill ${isFilled ? "enabled" : "disabled"}`);
  });

  // Dark
  // Dark mode toggle
  const darkModeBtn = document.getElementById("toggleDarkMode");
  darkModeBtn.addEventListener("click", function () {
    this.classList.toggle("active");
    const isDarkMode = this.classList.contains("active");

    // Toggle icon
    const modeIcon = this.querySelector(".mode-icon");
    modeIcon.textContent = isDarkMode ? "🌙" : "☀️";

    // Apply dark mode to charts and container
    document.body.classList.toggle("dark-mode");
    updateChartColorScheme(isDarkMode);

    showToast(`${isDarkMode ? "Dark" : "Light"} mode activated`);
  });

  // Sync charts checkbox with enhanced feedback
  const syncChartsCheckbox = document.getElementById("syncCharts");
  syncChartsCheckbox.addEventListener("change", function () {
    const syncEnabled = this.checked;

    // Update crosshair sync option with visual feedback
    if (accelChart.options.plugins.crosshair) {
      accelChart.options.plugins.crosshair.sync.enabled = syncEnabled;
      gyroChart.options.plugins.crosshair.sync.enabled = syncEnabled;

      // Apply changes with animation if enabled
      if (document.getElementById("animateCharts").checked) {
        accelChart.options.transitions.active.animation.duration = 300;
        gyroChart.options.transitions.active.animation.duration = 300;
      } else {
        accelChart.options.transitions.active.animation.duration = 0;
        gyroChart.options.transitions.active.animation.duration = 0;
      }

      accelChart.update();
      gyroChart.update();

      showToast(
        `Charts synchronization ${syncEnabled ? "enabled" : "disabled"}`
      );
    }
  });

  // Animation toggle
  document
    .getElementById("animateCharts")
    .addEventListener("change", function () {
      const animateEnabled = this.checked;

      // Set animation duration for both charts
      const duration = animateEnabled ? 300 : 0;
      if (accelChart.options.transitions && gyroChart.options.transitions) {
        accelChart.options.transitions.active.animation.duration = duration;
        gyroChart.options.transitions.active.animation.duration = duration;
        accelChart.update();
        gyroChart.update();

        showToast(
          `Chart animations ${animateEnabled ? "enabled" : "disabled"}`
        );
      }
    });

  // Initialize data count updater
  initializeDataCounter();

  // Add keyboard shortcuts for common actions
  addKeyboardShortcuts();
}

// Helper function to show toast messages
function showToast(message, duration = 3000) {
  // Create toast container if it doesn't exist
  let toastContainer = document.getElementById("toastContainer");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toastContainer";
    toastContainer.className = "toast-container";
    document.body.appendChild(toastContainer);
  }

  // Create toast element
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;

  // Add to container
  toastContainer.appendChild(toast);

  // Show with animation
  setTimeout(() => toast.classList.add("visible"), 10);

  // Remove after duration
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Helper function to toggle chart fill
function toggleChartFill(chart, isFilled) {
  if (!chart || !chart.data) return;

  chart.data.datasets.forEach((dataset) => {
    dataset.fill = isFilled;
  });

  chart.update();
}

// Helper function to update chart color scheme
function updateChartColorScheme(isDarkMode) {
  const gridColor = isDarkMode
    ? "rgba(255, 255, 255, 0.1)"
    : "rgba(0, 0, 0, 0.1)";
  const textColor = isDarkMode ? "#e2e8f0" : "#2c3e50";

  [accelChart, gyroChart].forEach((chart) => {
    if (!chart || !chart.options) return;

    // Update grid lines
    if (chart.options.scales.x) {
      chart.options.scales.x.grid.color = gridColor;
      chart.options.scales.x.ticks.color = textColor;
    }

    if (chart.options.scales.y) {
      chart.options.scales.y.grid.color = gridColor;
      chart.options.scales.y.ticks.color = textColor;
    }

    // Update title and legend text
    if (chart.options.plugins.title) {
      chart.options.plugins.title.color = textColor;
    }

    if (chart.options.plugins.legend) {
      chart.options.plugins.legend.labels.color = textColor;
    }

    chart.update();
  });
}

// Helper to initialize data counter
function initializeDataCounter() {
  const dataPointCountEl = document.getElementById("dataPointCount");
  if (!dataPointCountEl) return;

  // Update every second
  setInterval(() => {
    let totalPoints = 0;

    // Count points in both charts
    if (accelChart && accelChart.data && accelChart.data.datasets) {
      accelChart.data.datasets.forEach((dataset) => {
        totalPoints += dataset.data.length;
      });
    }

    dataPointCountEl.textContent = `${totalPoints.toLocaleString()} data points`;
  }, 1000);
}

// Helper to add keyboard shortcuts
function addKeyboardShortcuts() {
  document.addEventListener("keydown", function (e) {
    // Only process if not in an input field
    if (
      e.target.tagName === "INPUT" ||
      e.target.tagName === "SELECT" ||
      e.target.tagName === "TEXTAREA"
    ) {
      return;
    }

    // Ctrl+Z or R: Reset zoom
    if ((e.ctrlKey && e.key === "z") || e.key === "r") {
      document.getElementById("resetZoom").click();
    }

    // F: Toggle fill
    if (e.key === "f") {
      document.getElementById("toggleFill").click();
    }

    // D: Toggle dark mode
    if (e.key === "d") {
      document.getElementById("toggleDarkMode").click();
    }
  });
}

// Function to filter charts by time range
function filterChartsByTimeRange(startTime) {
  if (!accelChart || !gyroChart) return;

  // Set visible time range for both charts
  [accelChart, gyroChart].forEach((chart) => {
    if (!chart.options.scales || !chart.options.scales.x) return;

    chart.options.scales.x.min = startTime;
    chart.update();
  });
}
// Helper function to show toast notification
function showToast(message, duration = 2000) {
  // Remove existing toast if any
  const existingToast = document.querySelector(".toast-notification");
  if (existingToast) {
    existingToast.remove();
  }

  // Create new toast
  const toast = document.createElement("div");
  toast.className = "toast-notification";
  toast.textContent = message;
  document.body.appendChild(toast);

  // Animate in
  setTimeout(() => toast.classList.add("visible"), 10);

  // Animate out and remove
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Helper function to update chart color scheme
function updateChartColorScheme(isDarkMode) {
  // Update chart colors
  const textColor = isDarkMode ? "#e9ecef" : "#495057";
  const gridColor = isDarkMode
    ? "rgba(255, 255, 255, 0.1)"
    : "rgba(0, 0, 0, 0.1)";
  const backgroundColor = isDarkMode ? "#343a40" : "#ffffff";

  [accelChart, gyroChart].forEach((chart) => {
    if (!chart) return;

    // Update chart options
    chart.options.scales.x.grid.color = gridColor;
    chart.options.scales.y.grid.color = gridColor;
    chart.options.scales.x.ticks.color = textColor;
    chart.options.scales.y.ticks.color = textColor;
    chart.options.plugins.title.color = textColor;
    chart.options.plugins.legend.labels.color = textColor;

    // Update dataset colors if dark mode
    if (isDarkMode) {
      chart.data.datasets.forEach((dataset) => {
        if (
          dataset.borderColor &&
          typeof dataset.borderColor === "string" &&
          !dataset.borderColor.includes("rgb(")
        ) {
          // Brighten colors for dark mode
          dataset.borderColor = brightenColor(dataset.borderColor);
          if (
            dataset.backgroundColor &&
            typeof dataset.backgroundColor === "string"
          ) {
            dataset.backgroundColor = brightenColor(
              dataset.backgroundColor,
              0.3
            );
          }
        }
      });
    }

    chart.update();
  });
}

// Function to initialize live data counter with animation
function initializeDataCounter() {
  const counterElement = document.getElementById("dataPointCount");
  if (!counterElement) return;

  // Update counter with animation
  setInterval(() => {
    if (sensorData) {
      const newCount = sensorData.length;
      const oldCount = parseInt(
        counterElement.getAttribute("data-count") || "0"
      );

      if (newCount !== oldCount) {
        // Store new count
        counterElement.setAttribute("data-count", newCount);

        // Animate counter
        counterElement.classList.add("counter-update");
        setTimeout(
          () => counterElement.classList.remove("counter-update"),
          300
        );

        // Update text
        counterElement.textContent = `${newCount.toLocaleString()} data points`;

        // Show recording indicator when new data is coming in
        const recordingIndicator =
          document.getElementById("recordingIndicator");
        if (recordingIndicator) {
          if (newCount > oldCount) {
            recordingIndicator.style.display = "inline-block";
            setTimeout(() => {
              recordingIndicator.style.display = "none";
            }, 2000);
          }
        }
      }
    }
  }, 1000);
}

// Add keyboard shortcuts for power users
function addKeyboardShortcuts() {
  document.addEventListener("keydown", (event) => {
    // Only respond if not in an input field
    if (
      event.target.tagName === "INPUT" ||
      event.target.tagName === "SELECT" ||
      event.target.tagName === "TEXTAREA"
    ) {
      return;
    }

    switch (event.key) {
      case "r":
        // Reset zoom
        document.getElementById("resetZoom").click();
        break;
      case "f":
        // Toggle fill
        document.getElementById("toggleFill").click();
        break;
      case "d":
        // Toggle dark mode
        document.getElementById("toggleDarkMode").click();
        break;
      case "s":
        // Toggle sync
        const syncCharts = document.getElementById("syncCharts");
        syncCharts.checked = !syncCharts.checked;
        syncCharts.dispatchEvent(new Event("change"));
        break;
      case "a":
        // Toggle animations
        const animateCharts = document.getElementById("animateCharts");
        animateCharts.checked = !animateCharts.checked;
        animateCharts.dispatchEvent(new Event("change"));
        break;
    }
  });
}

// Helper function to brighten a color for dark mode
function brightenColor(color, alpha = 1) {
  // Simple brightening for named colors
  const colorMap = {
    red: `rgba(255, 99, 132, ${alpha})`,
    blue: `rgba(54, 162, 235, ${alpha})`,
    green: `rgba(75, 192, 192, ${alpha})`,
    orange: `rgba(255, 159, 64, ${alpha})`,
    purple: `rgba(153, 102, 255, ${alpha})`,
    yellow: `rgba(255, 205, 86, ${alpha})`,
  };

  if (colorMap[color]) {
    return colorMap[color];
  }

  return color;
}

// Updated toggle chart fill function with parameter for direct state control
function toggleChartFill(chart, isFilled = null) {
  if (!chart || !chart.data || !chart.data.datasets) return;

  chart.data.datasets.forEach((dataset) => {
    // Determine fill state - either use passed parameter or toggle current
    const shouldFill = isFilled !== null ? isFilled : !dataset.fill;

    // Update dataset
    dataset.fill = shouldFill;

    // If filled, ensure there's a background color with transparency
    if (shouldFill && dataset.borderColor) {
      // Extract the color components from borderColor if it's rgb/rgba format
      let bgColor;
      if (typeof dataset.borderColor === "string") {
        if (dataset.borderColor.startsWith("rgb")) {
          bgColor = dataset.borderColor
            .replace("rgb", "rgba")
            .replace(")", ", 0.2)");
        } else {
          // Handle named colors or hex
          bgColor = dataset.borderColor + "33"; // Add alpha to hex or use named color
        }
        dataset.backgroundColor = bgColor;
      }
    }
  });

  chart.update();
}

// Helper function to toggle chart fill
function toggleChartFill(chart) {
  if (!chart) return;

  chart.data.datasets.forEach((dataset) => {
    dataset.fill = !dataset.fill;
  });

  chart.update();
}

// Helper function to filter charts by time range
function filterChartsByTimeRange(startTime) {
  if (!accelChart || !gyroChart || sensorData.length === 0) return;

  // Filter sensor data by time range
  const filteredData = sensorData.filter((d) => d.timestamp >= startTime);

  // Update accelerometer chart
  accelChart.data.datasets[0].data = filteredData.map((d) => ({
    x: d.timestamp,
    y: d.accel.x,
  }));
  accelChart.data.datasets[1].data = filteredData.map((d) => ({
    x: d.timestamp,
    y: d.accel.y,
  }));
  accelChart.data.datasets[2].data = filteredData.map((d) => ({
    x: d.timestamp,
    y: d.accel.z,
  }));

  // Update gyroscope chart
  gyroChart.data.datasets[0].data = filteredData.map((d) => ({
    x: d.timestamp,
    y: d.gyro.x,
  }));
  gyroChart.data.datasets[1].data = filteredData.map((d) => ({
    x: d.timestamp,
    y: d.gyro.y,
  }));
  gyroChart.data.datasets[2].data = filteredData.map((d) => ({
    x: d.timestamp,
    y: d.gyro.z,
  }));

  // Update charts
  accelChart.update();
  gyroChart.update();

  // Update data point count display
  document.getElementById(
    "dataPointCount"
  ).textContent = `${filteredData.length} data points`;
}

// Enhanced update charts function
function updateCharts() {
  if (!accelChart || !gyroChart || sensorData.length === 0) return;

  // Check if we need to filter by time range
  const timeRangeSelect = document.getElementById("timeRange");
  if (timeRangeSelect && timeRangeSelect.value !== "all") {
    const timeRange = parseInt(timeRangeSelect.value) * 1000; // Convert to milliseconds
    const now = Date.now();
    filterChartsByTimeRange(now - timeRange);
  } else {
    // Update with all data
    // Update accelerometer chart data
    accelChart.data.datasets[0].data = sensorData.map((d) => ({
      x: d.timestamp,
      y: d.accel.x,
    }));
    accelChart.data.datasets[1].data = sensorData.map((d) => ({
      x: d.timestamp,
      y: d.accel.y,
    }));
    accelChart.data.datasets[2].data = sensorData.map((d) => ({
      x: d.timestamp,
      y: d.accel.z,
    }));

    // Update gyroscope chart data
    gyroChart.data.datasets[0].data = sensorData.map((d) => ({
      x: d.timestamp,
      y: d.gyro.x,
    }));
    gyroChart.data.datasets[1].data = sensorData.map((d) => ({
      x: d.timestamp,
      y: d.gyro.y,
    }));
    gyroChart.data.datasets[2].data = sensorData.map((d) => ({
      x: d.timestamp,
      y: d.gyro.z,
    }));

    // Update charts
    accelChart.update();
    gyroChart.update();

    // Update data point count display
    if (document.getElementById("dataPointCount")) {
      document.getElementById(
        "dataPointCount"
      ).textContent = `${sensorData.length} data points`;
    }
  }

  // Calculate and display statistics for visible data
  updateDataStatistics();
}

// Function to update data statistics display
function updateDataStatistics() {
  // Create statistics panel if it doesn't exist
  let statsPanel = document.getElementById("dataStatistics");
  if (!statsPanel) {
    statsPanel = document.createElement("div");
    statsPanel.id = "dataStatistics";
    statsPanel.className = "data-statistics";

    const chartsContainer = document.querySelector(".charts-container");
    if (chartsContainer) {
      chartsContainer.appendChild(statsPanel);
    }
  }

  // Calculate statistics for accelerometer data
  const accelStats = {
    x: calculateAxisStats(sensorData.map((d) => d.accel.x)),
    y: calculateAxisStats(sensorData.map((d) => d.accel.y)),
    z: calculateAxisStats(sensorData.map((d) => d.accel.z)),
  };

  // Calculate statistics for gyroscope data
  const gyroStats = {
    x: calculateAxisStats(sensorData.map((d) => d.gyro.x)),
    y: calculateAxisStats(sensorData.map((d) => d.gyro.y)),
    z: calculateAxisStats(sensorData.map((d) => d.gyro.z)),
  };

  // Update statistics display
  statsPanel.innerHTML = `
      <div class="stats-header">Statistical Analysis</div>
      <div class="stats-container">
        <div class="stats-column">
          <h4>Accelerometer</h4>
          <table class="stats-table">
            <tr>
              <th>Axis</th>
              <th>Min</th>
              <th>Max</th>
              <th>Avg</th>
              <th>RMS</th>
            </tr>
            <tr>
              <td>X</td>
              <td>${accelStats.x.min.toFixed(3)}</td>
              <td>${accelStats.x.max.toFixed(3)}</td>
              <td>${accelStats.x.avg.toFixed(3)}</td>
              <td>${accelStats.x.rms.toFixed(3)}</td>
            </tr>
            <tr>
              <td>Y</td>
              <td>${accelStats.y.min.toFixed(3)}</td>
              <td>${accelStats.y.max.toFixed(3)}</td>
              <td>${accelStats.y.avg.toFixed(3)}</td>
              <td>${accelStats.y.rms.toFixed(3)}</td>
            </tr>
            <tr>
              <td>Z</td>
              <td>${accelStats.z.min.toFixed(3)}</td>
              <td>${accelStats.z.max.toFixed(3)}</td>
              <td>${accelStats.z.avg.toFixed(3)}</td>
              <td>${accelStats.z.rms.toFixed(3)}</td>
            </tr>
          </table>
        </div>
        <div class="stats-column">
          <h4>Gyroscope</h4>
          <table class="stats-table">
            <tr>
              <th>Axis</th>
              <th>Min</th>
              <th>Max</th>
              <th>Avg</th>
              <th>RMS</th>
            </tr>
            <tr>
              <td>X</td>
              <td>${gyroStats.x.min.toFixed(3)}</td>
              <td>${gyroStats.x.max.toFixed(3)}</td>
              <td>${gyroStats.x.avg.toFixed(3)}</td>
              <td>${gyroStats.x.rms.toFixed(3)}</td>
            </tr>
            <tr>
              <td>Y</td>
              <td>${gyroStats.y.min.toFixed(3)}</td>
              <td>${gyroStats.y.max.toFixed(3)}</td>
              <td>${gyroStats.y.avg.toFixed(3)}</td>
              <td>${gyroStats.y.rms.toFixed(3)}</td>
            </tr>
            <tr>
              <td>Z</td>
              <td>${gyroStats.z.min.toFixed(3)}</td>
              <td>${gyroStats.z.max.toFixed(3)}</td>
              <td>${gyroStats.z.avg.toFixed(3)}</td>
              <td>${gyroStats.z.rms.toFixed(3)}</td>
            </tr>
          </table>
        </div>
      </div>
      <div class="stats-actions">
        <button id="exportCSV" class="control-button">Export Data as CSV</button>
        <button id="analyzeMotion" class="control-button">Analyze Motion</button>
      </div>
    `;

  // Add event listeners for action buttons
  document
    .getElementById("exportCSV")
    .addEventListener("click", exportDataAsCSV);
  document
    .getElementById("analyzeMotion")
    .addEventListener("click", analyzeMotion);
}

// Helper function to calculate statistics for an axis
function calculateAxisStats(values) {
  if (!values || values.length === 0) {
    return { min: 0, max: 0, avg: 0, rms: 0 };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const sum = values.reduce((acc, val) => acc + val, 0);
  const avg = sum / values.length;

  // Calculate RMS (Root Mean Square)
  const squareSum = values.reduce((acc, val) => acc + val * val, 0);
  const rms = Math.sqrt(squareSum / values.length);

  return { min, max, avg, rms };
}

// Function to export data as CSV
function exportDataAsCSV() {
  if (sensorData.length === 0) {
    alert("No data to export");
    return;
  }

  // Create CSV header
  let csv =
    "Timestamp,Accel_X,Accel_Y,Accel_Z,Gyro_X,Gyro_Y,Gyro_Z,Temperature\n";

  // Add data rows
  sensorData.forEach((d) => {
    const timestamp = new Date(d.timestamp).toISOString();
    csv += `${timestamp},${d.accel.x},${d.accel.y},${d.accel.z},${d.gyro.x},${d.gyro.y},${d.gyro.z},${d.temp}\n`;
  });

  // Create download link
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `sensor_data_${new Date().toISOString()}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Function to analyze motion patterns in the data
function analyzeMotion() {
  if (sensorData.length < 5) {
    alert("Not enough data for motion analysis");
    return;
  }

  // Create a modal for motion analysis results
  let analysisModal = document.getElementById("motionAnalysisModal");
  if (!analysisModal) {
    analysisModal = document.createElement("div");
    analysisModal.id = "motionAnalysisModal";
    analysisModal.className = "modal";

    analysisModal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h2>Motion Analysis</h2>
            <span class="close-modal">&times;</span>
          </div>
          <div class="modal-body" id="motionAnalysisContent">
            <div class="analysis-loading">Analyzing motion patterns...</div>
          </div>
        </div>
      `;

    document.body.appendChild(analysisModal);

    // Add close button functionality
    analysisModal
      .querySelector(".close-modal")
      .addEventListener("click", function () {
        analysisModal.style.display = "none";
      });

    // Close when clicking outside
    window.addEventListener("click", function (event) {
      if (event.target === analysisModal) {
        analysisModal.style.display = "none";
      }
    });
  }

  // Show the modal
  analysisModal.style.display = "block";

  // Analyze motion patterns (simple implementation)
  setTimeout(() => {
    const contentDiv = document.getElementById("motionAnalysisContent");

    // Calculate motion intensity - RMS of accelerometer and gyroscope data
    const accelMagnitudes = sensorData.map((d) =>
      Math.sqrt(
        d.accel.x * d.accel.x + d.accel.y * d.accel.y + d.accel.z * d.accel.z
      )
    );

    const gyroMagnitudes = sensorData.map((d) =>
      Math.sqrt(d.gyro.x * d.gyro.x + d.gyro.y * d.gyro.y + d.gyro.z * d.gyro.z)
    );

    // Calculate average magnitudes
    const avgAccelMagnitude =
      accelMagnitudes.reduce((sum, val) => sum + val, 0) /
      accelMagnitudes.length;
    const avgGyroMagnitude =
      gyroMagnitudes.reduce((sum, val) => sum + val, 0) / gyroMagnitudes.length;

    // Detect motion patterns
    const isStatic = avgAccelMagnitude < 1.2 && avgGyroMagnitude < 30;
    const isMoving =
      avgGyroMagnitude > 50 ||
      (avgAccelMagnitude > 1.5 && avgGyroMagnitude > 30);
    const isShaking = avgAccelMagnitude > 2.5 && avgGyroMagnitude > 100;

    // Display the analysis results
    contentDiv.innerHTML = `
        <h3>Motion Summary</h3>
        <div class="analysis-summary">
          <div class="metric">
            <div class="metric-title">Motion State:</div>
            <div class="metric-value">
              ${
                isStatic
                  ? "Static/Stable"
                  : isShaking
                  ? "Rapid Movement/Shaking"
                  : isMoving
                  ? "Moving"
                  : "Moderate Movement"
              }
            </div>
          </div>
          <div class="metric">
            <div class="metric-title">Average Acceleration Magnitude:</div>
            <div class="metric-value">${avgAccelMagnitude.toFixed(3)} g</div>
          </div>
          <div class="metric">
            <div class="metric-title">Average Angular Velocity:</div>
            <div class="metric-value">${avgGyroMagnitude.toFixed(3)} deg/s</div>
          </div>
        </div>
        
        <h3>Detected Patterns</h3>
        <div class="pattern-container">
          ${detectAccelerationPatterns(sensorData)}
          ${detectOrientationPatterns(sensorData)}
        </div>
        
        <h3>Motion Intensity Over Time</h3>
        <canvas id="motionIntensityChart" height="200"></canvas>
      `;

    // Create motion intensity chart
    setTimeout(() => {
      const ctx = document
        .getElementById("motionIntensityChart")
        .getContext("2d");
      const timestamps = sensorData.map((d) => d.timestamp);

      new Chart(ctx, {
        type: "line",
        data: {
          datasets: [
            {
              label: "Acceleration Magnitude (g)",
              data: accelMagnitudes.map((value, i) => ({
                x: timestamps[i],
                y: value,
              })),
              borderColor: "#0066cc",
              backgroundColor: "rgba(0, 102, 204, 0.1)",
              borderWidth: 2,
              yAxisID: "y",
            },
            {
              label: "Angular Velocity Magnitude (deg/s)",
              data: gyroMagnitudes.map((value, i) => ({
                x: timestamps[i],
                y: value,
              })),
              borderColor: "#cc0000",
              backgroundColor: "rgba(204, 0, 0, 0.1)",
              borderWidth: 2,
              yAxisID: "y1",
            },
          ],
        },
        options: {
          responsive: true,
          interaction: {
            mode: "index",
            intersect: false,
          },
          scales: {
            x: {
              type: "time",
              time: {
                unit: "second",
                tooltipFormat: "HH:mm:ss.SSS",
                displayFormats: {
                  second: "HH:mm:ss",
                },
              },
              title: {
                display: true,
                text: "Time",
              },
            },
            y: {
              type: "linear",
              position: "left",
              title: {
                display: true,
                text: "Acceleration (g)",
              },
            },
            y1: {
              type: "linear",
              position: "right",
              title: {
                display: true,
                text: "Angular Velocity (deg/s)",
              },
              grid: {
                drawOnChartArea: false,
              },
            },
          },
        },
      });
    }, 10);
  }, 500);
}

// Helper function to detect acceleration patterns
function detectAccelerationPatterns(data) {
  if (data.length < 5)
    return '<div class="pattern">Not enough data for pattern detection</div>';

  let patterns = [];

  // Calculate first derivative (changes in acceleration)
  const accelChanges = [];
  for (let i = 1; i < data.length; i++) {
    accelChanges.push({
      x: data[i].accel.x - data[i - 1].accel.x,
      y: data[i].accel.y - data[i - 1].accel.y,
      z: data[i].accel.z - data[i - 1].accel.z,
    });
  }

  // Look for sudden changes (potential impacts or jolts)
  const suddenChanges = accelChanges.filter(
    (change) =>
      Math.abs(change.x) > 0.5 ||
      Math.abs(change.y) > 0.5 ||
      Math.abs(change.z) > 0.5
  );

  if (suddenChanges.length > 0) {
    patterns.push(
      `Detected ${suddenChanges.length} sudden acceleration changes (potential impacts or jolts)`
    );
  }

  // Check if there's a constant acceleration in one direction (like movement)
  const avgAccelX = data.reduce((sum, d) => sum + d.accel.x, 0) / data.length;
  const avgAccelY = data.reduce((sum, d) => sum + d.accel.y, 0) / data.length;
  const avgAccelZ = data.reduce((sum, d) => sum + d.accel.z, 0) / data.length;

  const steadyMovementThreshold = 0.3;
  if (Math.abs(avgAccelX) > steadyMovementThreshold) {
    patterns.push(
      `Steady acceleration along X-axis (${avgAccelX.toFixed(2)} g)`
    );
  }
  if (Math.abs(avgAccelY) > steadyMovementThreshold) {
    patterns.push(
      `Steady acceleration along Y-axis (${avgAccelY.toFixed(2)} g)`
    );
  }
  if (Math.abs(avgAccelZ) > steadyMovementThreshold) {
    patterns.push(
      `Steady acceleration along Z-axis (${avgAccelZ.toFixed(2)} g)`
    );
  }

  if (patterns.length === 0) {
    patterns.push("No significant acceleration patterns detected");
  }

  return patterns.map((p) => `<div class="pattern">${p}</div>`).join("");
}

// Helper function to detect orientation patterns
function detectOrientationPatterns(data) {
  if (data.length < 5)
    return '<div class="pattern">Not enough data for pattern detection</div>';

  let patterns = [];

  // Calculate first derivative (changes in angular velocity)
  const gyroChanges = [];
  for (let i = 1; i < data.length; i++) {
    gyroChanges.push({
      x: data[i].gyro.x - data[i - 1].gyro.x,
      y: data[i].gyro.y - data[i - 1].gyro.y,
      z: data[i].gyro.z - data[i - 1].gyro.z,
    });
  }

  // Look for rotational movements
  const rotationThreshold = 100;
  const xRotations = data.filter(
    (d) => Math.abs(d.gyro.x) > rotationThreshold
  ).length;
  const yRotations = data.filter(
    (d) => Math.abs(d.gyro.y) > rotationThreshold
  ).length;
  const zRotations = data.filter(
    (d) => Math.abs(d.gyro.z) > rotationThreshold
  ).length;

  if (xRotations > 0) {
    patterns.push(
      `Detected ${xRotations} significant rotations around X-axis (rolling motion)`
    );
  }
  if (yRotations > 0) {
    patterns.push(
      `Detected ${yRotations} significant rotations around Y-axis (pitching motion)`
    );
  }
  if (zRotations > 0) {
    patterns.push(
      `Detected ${zRotations} significant rotations around Z-axis (yawing motion)`
    );
  }

  // Check for steady rotational movement
  const avgGyroX = data.reduce((sum, d) => sum + d.gyro.x, 0) / data.length;
  const avgGyroY = data.reduce((sum, d) => sum + d.gyro.y, 0) / data.length;
  const avgGyroZ = data.reduce((sum, d) => sum + d.gyro.z, 0) / data.length;

  const steadyRotationThreshold = 20;
  if (Math.abs(avgGyroX) > steadyRotationThreshold) {
    patterns.push(
      `Steady rotation around X-axis (${avgGyroX.toFixed(2)} deg/s)`
    );
  }
  if (Math.abs(avgGyroY) > steadyRotationThreshold) {
    patterns.push(
      `Steady rotation around Y-axis (${avgGyroY.toFixed(2)} deg/s)`
    );
  }
  if (Math.abs(avgGyroZ) > steadyRotationThreshold) {
    patterns.push(
      `Steady rotation around Z-axis (${avgGyroZ.toFixed(2)} deg/s)`
    );
  }

  if (patterns.length === 0) {
    patterns.push("No significant orientation patterns detected");
  }

  return patterns.map((p) => `<div class="pattern">${p}</div>`).join("");
}

// // Function to handle window resize events
// function handleResize() {
//   if (accelChart) accelChart.resize();
//   if (gyroChart) gyroChart.resize();
// }

// Function to handle window resize events

// function handleResize() {
//   if (accelChart) {
//     accelChart.update();
//   }
//   if (gyroChart) {
//     gyroChart.update();
//   }
// }

// Setup window resize event listener
// window.addEventListener("resize", handleResize);

// Advanced data processing functions for feature extraction
function extractFeatures(data, windowSize = 20) {
  if (data.length < windowSize) return null;

  // Process data in windows
  const features = [];
  for (
    let i = 0;
    i < data.length - windowSize;
    i += Math.floor(windowSize / 2)
  ) {
    const window = data.slice(i, i + windowSize);

    // Extract time domain features for acceleration
    const accelFeatures = {
      x: extractTimeDomainFeatures(window.map((d) => d.accel.x)),
      y: extractTimeDomainFeatures(window.map((d) => d.accel.y)),
      z: extractTimeDomainFeatures(window.map((d) => d.accel.z)),
    };

    // Extract time domain features for gyroscope
    const gyroFeatures = {
      x: extractTimeDomainFeatures(window.map((d) => d.gyro.x)),
      y: extractTimeDomainFeatures(window.map((d) => d.gyro.y)),
      z: extractTimeDomainFeatures(window.map((d) => d.gyro.z)),
    };

    // Calculate 3D features
    const accelMagnitudes = window.map((d) =>
      Math.sqrt(
        d.accel.x * d.accel.x + d.accel.y * d.accel.y + d.accel.z * d.accel.z
      )
    );

    const gyroMagnitudes = window.map((d) =>
      Math.sqrt(d.gyro.x * d.gyro.x + d.gyro.y * d.gyro.y + d.gyro.z * d.gyro.z)
    );

    const magnitudeFeatures = {
      accel: extractTimeDomainFeatures(accelMagnitudes),
      gyro: extractTimeDomainFeatures(gyroMagnitudes),
    };

    features.push({
      timestamp: window[Math.floor(windowSize / 2)].timestamp,
      accel: accelFeatures,
      gyro: gyroFeatures,
      magnitude: magnitudeFeatures,
    });
  }

  return features;
}

// Extract time domain features from a signal window
function extractTimeDomainFeatures(signal) {
  if (!signal || signal.length === 0) return null;

  // Basic statistics
  const min = Math.min(...signal);
  const max = Math.max(...signal);
  const range = max - min;
  const sum = signal.reduce((acc, val) => acc + val, 0);
  const mean = sum / signal.length;

  // Calculate variance and standard deviation
  const squaredDiffs = signal.map((val) => Math.pow(val - mean, 2));
  const variance =
    squaredDiffs.reduce((acc, val) => acc + val, 0) / signal.length;
  const stdDev = Math.sqrt(variance);

  // Calculate Root Mean Square (RMS)
  const squareSum = signal.reduce((acc, val) => acc + val * val, 0);
  const rms = Math.sqrt(squareSum / signal.length);

  // Zero crossing rate
  let zeroCrossings = 0;
  for (let i = 1; i < signal.length; i++) {
    if (
      (signal[i] > 0 && signal[i - 1] < 0) ||
      (signal[i] < 0 && signal[i - 1] > 0)
    ) {
      zeroCrossings++;
    }
  }

  // Mean crossing rate
  let meanCrossings = 0;
  for (let i = 1; i < signal.length; i++) {
    if (
      (signal[i] > mean && signal[i - 1] < mean) ||
      (signal[i] < mean && signal[i - 1] > mean)
    ) {
      meanCrossings++;
    }
  }

  return {
    min,
    max,
    range,
    mean,
    variance,
    stdDev,
    rms,
    zeroCrossings,
    meanCrossings,
  };
}

// Function to identify potential activities based on sensor data patterns
function identifyActivity(features) {
  if (!features || features.length === 0) return "Unknown";

  // Get the latest feature set
  const latest = features[features.length - 1];

  // Extract relevant metrics
  const accelMagnitude = latest.magnitude.accel;
  const gyroMagnitude = latest.magnitude.gyro;

  // Simple activity classification based on thresholds
  // This is a simplified example - real activity recognition would use machine learning

  // Check if device is stationary
  if (accelMagnitude.stdDev < 0.1 && gyroMagnitude.stdDev < 10) {
    return "Stationary";
  }

  // Check for walking patterns
  if (
    accelMagnitude.stdDev > 0.1 &&
    accelMagnitude.stdDev < 0.5 &&
    accelMagnitude.meanCrossings > 5 &&
    gyroMagnitude.stdDev < 50
  ) {
    return "Walking";
  }

  // Check for running patterns
  if (
    accelMagnitude.stdDev > 0.5 &&
    accelMagnitude.meanCrossings > 10 &&
    gyroMagnitude.stdDev > 50
  ) {
    return "Running";
  }

  // Check for sudden movements/impacts
  if (accelMagnitude.max > 3) {
    return "Impact/Sudden Movement";
  }

  // Check for device rotation
  if (gyroMagnitude.max > 100 && accelMagnitude.stdDev < 0.5) {
    return "Device Rotation";
  }

  return "Complex Movement";
}

// Add function to display notification when analyzing data
function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.innerHTML = message;

  document.body.appendChild(notification);

  // Auto-dismiss after 3 seconds
  setTimeout(() => {
    notification.classList.add("fade-out");
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 500);
  }, 1000);
}

// Add function to initialize additional UI elements
function initializeAdvancedUI() {
  // Create activity recognition container
  let activityContainer = document.getElementById("activityRecognition");
  if (!activityContainer) {
    activityContainer = document.createElement("div");
    activityContainer.id = "activityRecognition";
    activityContainer.className = "activity-container";

    activityContainer.innerHTML = `
      <h3>Activity Recognition</h3>
      <div class="activity-display">
        <div class="current-activity">
          <span class="activity-label">Current Activity:</span>
          <span id="currentActivity" class="activity-value">Unknown</span>
        </div>
        <div class="activity-confidence">
          <span class="confidence-label">Confidence:</span>
          <div class="confidence-meter">
            <div id="confidenceMeter" class="confidence-bar" style="width: 0%;"></div>
          </div>
          <span id="confidenceValue">0%</span>
        </div>
      </div>
      <div class="activity-controls">
        <button id="calibrateBtn" class="control-button">Calibrate Sensors</button>
        <button id="toggleActivity" class="control-button">Start Recognition</button>
      </div>
    `;

    const chartsContainer = document.querySelector(".charts-container");
    if (chartsContainer) {
      chartsContainer.appendChild(activityContainer);
    }

    // Add event listeners
    document
      .getElementById("calibrateBtn")
      .addEventListener("click", calibrateSensors);
    document
      .getElementById("toggleActivity")
      .addEventListener("click", toggleActivityRecognition);
  }
}

// Add function to calibrate sensors
function calibrateSensors() {
  showNotification(
    "Calibrating sensors. Please keep the device still...",
    "info"
  );

  // Reset offset values
  accelOffset = { x: 0, y: 0, z: 0 };
  gyroOffset = { x: 0, y: 0, z: 0 };

  // Collect samples for calibration
  const calibrationSamples = [];
  const requiredSamples = 50;

  function collectCalibrationSample(event) {
    if (calibrationSamples.length < requiredSamples) {
      calibrationSamples.push({
        accel: {
          x: event.accelerationIncludingGravity.x,
          y: event.accelerationIncludingGravity.y,
          z: event.accelerationIncludingGravity.z,
        },
        gyro: {
          x: event.rotationRate.alpha,
          y: event.rotationRate.beta,
          z: event.rotationRate.gamma,
        },
      });

      if (calibrationSamples.length === requiredSamples) {
        window.removeEventListener("devicemotion", collectCalibrationSample);
        calculateOffsets(calibrationSamples);
      }
    }
  }

  window.addEventListener("devicemotion", collectCalibrationSample);
}

// Calculate sensor offsets from calibration samples
function calculateOffsets(samples) {
  if (!samples || samples.length === 0) return;

  // Calculate average values for each axis
  const accelSum = { x: 0, y: 0, z: 0 };
  const gyroSum = { x: 0, y: 0, z: 0 };

  samples.forEach((sample) => {
    accelSum.x += sample.accel.x;
    accelSum.y += sample.accel.y;
    accelSum.z += sample.accel.z;

    gyroSum.x += sample.gyro.x;
    gyroSum.y += sample.gyro.y;
    gyroSum.z += sample.gyro.z;
  });

  // Set offsets (except for acceleration Z which should be ~1g when still)
  accelOffset.x = accelSum.x / samples.length;
  accelOffset.y = accelSum.y / samples.length;
  accelOffset.z = accelSum.z / samples.length - 9.81; // Subtract gravity

  gyroOffset.x = gyroSum.x / samples.length;
  gyroOffset.y = gyroSum.y / samples.length;
  gyroOffset.z = gyroSum.z / samples.length;

  showNotification("Calibration complete!", "success");
}

// Toggle activity recognition
let activityRecognitionActive = false;
function toggleActivityRecognition() {
  const button = document.getElementById("toggleActivity");

  if (activityRecognitionActive) {
    activityRecognitionActive = false;
    button.textContent = "Start Recognition";
    showNotification("Activity recognition stopped", "info");
  } else {
    activityRecognitionActive = true;
    button.textContent = "Stop Recognition";
    showNotification("Activity recognition started", "success");

    // Start recognition process
    recognizeActivityContinuously();
  }
}

// Continuously recognize activity
function recognizeActivityContinuously() {
  if (!activityRecognitionActive) return;

  // Extract features from recent data
  const recentData = sensorData.slice(-100); // Use last 100 samples
  const features = extractFeatures(recentData);

  if (features) {
    // Identify activity
    const activity = identifyActivity(features);

    // Update UI
    document.getElementById("currentActivity").textContent = activity;

    // Set a dummy confidence value (in a real app, this would come from the classifier)
    const confidence = Math.random() * 30 + 70; // Random between 70-100%
    document.getElementById("confidenceMeter").style.width = `${confidence}%`;
    document.getElementById(
      "confidenceValue"
    ).textContent = `${confidence.toFixed(1)}%`;
  }

  // Schedule next recognition
  setTimeout(recognizeActivityContinuously, 1000);
}
function requestVisualization() {
  fetch("rabbit_cipher.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      action: "visualize",
      key: rabbitKey,
      iv: rabbitIV,
      message: "Test message for visualization",
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.error) {
        console.error("Visualization request failed:", data.error);
      } else {
        document.getElementById("stateVisualization").textContent = data.result;
      }
    })
    .catch((error) => {
      console.error("Error calling PHP API:", error);
    });
}

function updateDashboard(data) {
  // Example: Update your dashboard elements with the real data
  if (document.getElementById("accel-x"))
    document.getElementById("accel-x").textContent = data.accel.x.toFixed(3);
  if (document.getElementById("accel-y"))
    document.getElementById("accel-y").textContent = data.accel.y.toFixed(3);
  if (document.getElementById("accel-z"))
    document.getElementById("accel-z").textContent = data.accel.z.toFixed(3);

  if (document.getElementById("gyro-x"))
    document.getElementById("gyro-x").textContent = data.gyro.x.toFixed(3);
  if (document.getElementById("gyro-y"))
    document.getElementById("gyro-y").textContent = data.gyro.y.toFixed(3);
  if (document.getElementById("gyro-z"))
    document.getElementById("gyro-z").textContent = data.gyro.z.toFixed(3);

  if (document.getElementById("temperature"))
    document.getElementById("temperature").textContent = data.temp.toFixed(1);

  // If you have charts or other visualizations, update them here
  updateCharts(data);
}

function initTabSwitching() {
  // Main tabs
  // Main tabs
  // Main tabs
  const tabs = document.querySelectorAll(".tabs .tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", function () {
      const tabName = this.getAttribute("data-tab");

      // Skip if this element doesn't have data-tab attribute
      if (!tabName) return;

      const targetTabContent = document.getElementById(tabName + "-tab");

      console.log("Switching to tab:", tabName);

      // Use the exact same selectors as in the old code
      document
        .querySelectorAll(".tabs .tab")
        .forEach((t) => t.classList.remove("active"));
      document
        .querySelectorAll(".tab-content")
        .forEach((c) => c.classList.remove("active"));

      // Add active class to clicked tab
      this.classList.add("active");

      // Add active class to corresponding content
      if (targetTabContent) {
        targetTabContent.classList.add("active");
      } else {
        console.warn(`Tab content element "${tabName}-tab" not found!`);
      }
    });
  });

  // Visualization sub-tabs - use EXACT same selector structure as old code
  const subTabs = document.querySelectorAll("[data-subtab]");
  subTabs.forEach((tab) => {
    tab.addEventListener("click", function () {
      const tabName = this.getAttribute("data-subtab");
      const targetTabContent = document.getElementById(tabName + "-tab");

      console.log("Switching to visualization tab:", tabName);

      // Use EXACT same selectors as old code
      document
        .querySelectorAll("[data-subtab]")
        .forEach((t) => t.classList.remove("active"));
      document
        .querySelectorAll("#visualization-tab .tab-content")
        .forEach((c) => c.classList.remove("active"));

      // Add active class to clicked tab
      this.classList.add("active");

      // Add active class to corresponding content
      if (targetTabContent) {
        targetTabContent.classList.add("active");
      } else {
        console.warn(`Visualization tab content "${tabName}-tab" not found!`);
      }
    });
  });

  // Modal tabs - use EXACT same selector structure as old code
  const modalTabs = document.querySelectorAll("[data-modal-tab]");
  modalTabs.forEach((tab) => {
    tab.addEventListener("click", function () {
      const tabName = this.getAttribute("data-modal-tab");
      const targetTabContent = document.getElementById(tabName + "-tab");

      console.log("Switching to modal tab:", tabName);

      // Use EXACT same selectors as old code
      document
        .querySelectorAll("[data-modal-tab]")
        .forEach((t) => t.classList.remove("active"));
      document
        .querySelectorAll(".modal .tab-content")
        .forEach((c) => c.classList.remove("active"));

      // Add active class to clicked tab
      this.classList.add("active");

      // Add active class to corresponding content
      if (targetTabContent) {
        targetTabContent.classList.add("active");
      } else {
        console.warn(`Modal tab content "${tabName}-tab" not found!`);
      }
    });
  });
}

function setupVisualizationRefresh() {
  // Only update the internal state visualization every 5 seconds
  // and only if we're on the visualization tab
  setInterval(function () {
    if (
      document.getElementById("visualization-tab") &&
      document.getElementById("visualization-tab").classList.contains("active")
    ) {
      // Just update the display with what we have, no new requests
      updateVisualizationDisplay();
    }
  }, 5000);
}

function initDashboard() {
  // Initialize charts
  initCharts();

  // Set up visualization displays
  updateInternalStateVisualization();
  setupVisualizationRefresh();

  // Set encryption to disabled by default since data is coming pre-encrypted
  encryptionEnabled = false;
  document.getElementById("encryptionToggle").checked = false;
  document.getElementById("encryptionBadge").textContent = "Unencrypted";
  document.getElementById("encryptionStatus").className =
    "status-indicator status-inactive";

  // Disable the encryption toggle since we don't want to encrypt already encrypted data
  //document.getElementById("encryptionToggle").disabled = true;

  // Initialize tab switching
  initTabSwitching();

  // Start fetching sensor data
  fetchSensorData();

  //initRabbitVisualization();

  // Set initial visualization displays
  requestVisualization();
  // Initialize the 3D drone model
  //   initDroneModel();
  initializeChartControls();
  // Handle tab switching

  // Handle encryption settings

  // Apply configuration button
  document.getElementById("applyConfig").addEventListener("click", function () {
    clearErrors();
    let isValid = true;

    // Validate key
    const keyInput = document.getElementById("key").value.trim();
    if (!keyInput) {
      isValid = showError("keyError", "Key is required");
    } else if (!validateHexBytes(keyInput, 16)) {
      isValid = showError(
        "keyError",
        "Key must be exactly 16 bytes in hex format"
      );
    }

    // Validate IV
    const ivInput = document.getElementById("iv").value.trim();
    if (!ivInput) {
      isValid = showError("ivError", "IV is required");
    } else if (!validateHexBytes(ivInput, 8)) {
      isValid = showError(
        "ivError",
        "IV must be exactly 8 bytes in hex format"
      );
    }

    if (isValid) {
      rabbitKey = keyInput;
      rabbitIV = ivInput;

      // Reset statistics
      totalPackets = 0;
      successPackets = 0;
      failedPackets = 0;
      decryptTimes = [];
      updateStatistics();

      // Request updated visualization
      requestVisualization();

      // Show success message
      alert("Configuration applied successfully!");
    }
  });

  // Reset configuration button
  document.getElementById("resetConfig").addEventListener("click", function () {
    document.getElementById("key").value =
      "00 11 22 33 44 55 66 77 88 99 AA BB CC DD EE FF";
    document.getElementById("iv").value = "01 23 45 67 89 AB CD EF";
    clearErrors();
  });

  // View raw data stream button
  document
    .getElementById("viewDataStream")
    .addEventListener("click", function () {
      document.getElementById("dataStreamModal").style.display = "block";
      updateRawDataVisualization();
      updateDecryptedDataVisualization();
    });

  // Close modal button
  document.querySelector(".close-modal").addEventListener("click", function () {
    document.getElementById("dataStreamModal").style.display = "none";
  });

  // Close modal when clicking outside of it
  window.addEventListener("click", function (event) {
    const modal = document.getElementById("dataStreamModal");
    if (event.target === modal) {
      modal.style.display = "none";
    }
  });

  // Helper function to convert hex string to byte array
  function hexStringToByteArray(hexString) {
    const bytes = hexString.split(/\s+/).map((hex) => parseInt(hex, 16));
    return bytes;
  }
}
// Function to fetch all 7 numerical values from the MPU6050 sensor via API
// BUG function fetchSensorData() {
//   // API endpoint URL (adjust if your server is on a different IP)
//   // Using the new /api/values endpoint for flat structure with all 7 values
//   const apiUrl = "http://192.168.4.1:5000/api/sensor-data";

//   // Fetch data from API
//   fetch(apiUrl)
//     .then((response) => {
//       if (!response.ok) {
//         throw new Error("Network response was not ok");
//       }
//       return response.json();
//     })
//     .then((data) => {
//       console.log("Received sensor data:", data);

//       // Create a standard format for data processing
//       const sensorDataPacket = {
//         timestamp: data.timestamp,
//         accel: {
//           x: data.accel.x,
//           y: data.accel.y,
//           z: data.accel.z,
//         },
//         gyro: {
//           x: data.gyro.x,
//           y: data.gyro.y,
//           z: data.gyro.z,
//         },
//         temp: data.temp,
//       };

//       // Update your UI with the real sensor values
//       updateDashboard(sensorDataPacket);
//       updateDroneOrientation(
//         sensorDataPacket.gyro.x,
//         sensorDataPacket.gyro.y,
//         sensorDataPacket.gyro.z
//       );
//       // Process the data for encryption or other purposes
//       if (encryptionEnabled) {
//         const jsonString = JSON.stringify(sensorDataPacket);
//         encryptData(jsonString);
//       } else {
//         // If encryption is disabled, just process the raw data
//         const fakeEncryptedHex = Array.from(
//           new TextEncoder().encode(JSON.stringify(sensorDataPacket))
//         )
//           .map((b) => b.toString(16).padStart(2, "0"))
//           .join(" ");

//         processEncryptedData(
//           fakeEncryptedHex,
//           JSON.stringify(sensorDataPacket)
//         );
//       }

//       // Set timeout for next data fetch (1 second)
//       setTimeout(fetchSensorData, 10000);
//     })
//     .catch((error) => {
//       console.error("Error fetching sensor data:", error);

//       // In case of error, fall back to simulated data
//       console.log("Falling back to simulated data");
//       simulateSensorData();
//     });
// }

function fetchSensorData() {
  // API endpoint URL
  const apiUrl = "http://192.168.4.1:5000/api/sensor-data";

  // Fetch data from API
  fetch(apiUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((encryptedResponse) => {
      console.log("Received encrypted data:", encryptedResponse);

      if (
        encryptedResponse.encrypted_data &&
        encryptedResponse.encryption === "rabbit"
      ) {
        const rawHex = encryptedResponse.encrypted_data;
        const formattedHex = rawHex.match(/.{1,2}/g).join(" ");

        totalPackets++;
        latestEncryptedHex = formattedHex;

        if (rawDataLog.length >= 20) rawDataLog.shift();
        rawDataLog.push({
          timestamp: new Date().toISOString(),
          data: formattedHex,
        });
        updateRawDataVisualization();

        decryptData(formattedHex).then((decryptResult) => {
          if (decryptResult.success) {
            try {
              // Store the latest decrypted text
              latestDecryptedText = decryptResult.text;

              const sensorData = JSON.parse(decryptResult.text);
              processSensorData(sensorData);

              // Add to decrypted data log
              if (decryptedDataLog.length >= 20) decryptedDataLog.shift();
              decryptedDataLog.push({
                timestamp: new Date().toISOString(),
                hexData: formattedHex,
                text: decryptResult.text,
              });
              updateDecryptedDataVisualization();

              // Request visualization for the latest packet
              requestLatestVisualization();

              successPackets++;
            } catch (error) {
              console.error("Error parsing decrypted data:", error);
              failedPackets++;
            }
          }
          updateStatistics();
        });
      } else {
        console.error("Unexpected data format received:", encryptedResponse);
        failedPackets++;
        updateStatistics();
      }

      // Set timeout for next data fetch (1 second)
      setTimeout(fetchSensorData, 1000);
    })
    .catch((error) => {
      console.error("Error fetching sensor data:", error);
      console.log("Falling back to simulated data");
      simulateSensorData();
    });
}

// 3D Drone Model Code
let droneScene, droneCamera, droneRenderer;
let droneModel, controls;
let isRotating = true;

// Initialize the 3D scene when the DOM is fully loaded
// document.addEventListener("DOMContentLoaded", function () {
//   initDroneModel();

//   // Set up tab switching
//   const tabs = document.querySelectorAll(".tabs .tab");
//   tabs.forEach((tab) => {
//     tab.addEventListener("click", function () {
//       // Remove 'active' class from all tabs and tab contents
//       document
//         .querySelectorAll(".tabs .tab")
//         .forEach((t) => t.classList.remove("active"));
//       document
//         .querySelectorAll(".tab-content")
//         .forEach((tc) => tc.classList.remove("active"));

//       // Add 'active' class to clicked tab
//       this.classList.add("active");

//       // Show corresponding tab content
//       const tabName = this.getAttribute("data-tab");
//       document.getElementById(`${tabName}-tab`).classList.add("active");

//       // Resize renderer if switching to drone view
//       if (tabName === "drone-view" && droneRenderer) {
//         setTimeout(() => {
//           resizeDroneRenderer();
//         }, 10);
//       }
//     });
//   });

//   // Set up model controls
//   document
//     .getElementById("resetView")
//     .addEventListener("click", resetDroneView);
//   document
//     .getElementById("toggleRotation")
//     .addEventListener("click", toggleDroneRotation);
// });
function initDroneModel() {
  // Get the canvas element
  const canvas = document.getElementById("droneCanvas");

  // Check if canvas exists
  if (!canvas) {
    console.error("Drone canvas element not found!");
    return;
  }

  // Create scene
  droneScene = new THREE.Scene();
  droneScene.background = new THREE.Color(0xf0f0f0);

  // Create camera
  droneCamera = new THREE.PerspectiveCamera(
    75,
    canvas.clientWidth / canvas.clientHeight,
    0.1,
    1000
  );
  droneCamera.position.set(0, 0, 10); // Moved camera even further back

  // Create renderer
  droneRenderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  droneRenderer.setSize(canvas.clientWidth, canvas.clientHeight);
  droneRenderer.setPixelRatio(window.devicePixelRatio);

  // Add ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.9); // Increased intensity
  droneScene.add(ambientLight);

  // Add directional light
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2); // Increased intensity
  directionalLight.position.set(1, 1, 1);
  droneScene.add(directionalLight);

  // Add an additional light from another angle for better visibility
  const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight2.position.set(-1, -1, -1);
  droneScene.add(directionalLight2);

  // Add hemisphere light for better overall lighting
  const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 1);
  droneScene.add(hemisphereLight);

  // Add orbit controls
  if (typeof THREE.OrbitControls !== "undefined") {
    controls = new THREE.OrbitControls(droneCamera, droneRenderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.minDistance = 2;
    controls.maxDistance = 20;
  } else {
    console.error(
      "THREE.OrbitControls is not available. Make sure it's loaded."
    );
  }

  // Helper to debug the scene
  const axesHelper = new THREE.AxesHelper(5);
  droneScene.add(axesHelper);

  // Add a grid helper for better orientation
  const gridHelper = new THREE.GridHelper(10, 10);
  droneScene.add(gridHelper);

  // Create a default backup mesh in case the model doesn't load properly
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
  backupMesh = new THREE.Mesh(geometry, material);
  backupMesh.visible = false; // Hide it initially
  droneScene.add(backupMesh);

  // Load the drone model
  if (typeof THREE.GLTFLoader !== "undefined") {
    const loader = new THREE.GLTFLoader();

    // Add loading manager to better track loading process
    const loadingManager = new THREE.LoadingManager();
    loadingManager.onProgress = function (url, itemsLoaded, itemsTotal) {
      console.log(
        `Loading file: ${url}.\nLoaded ${itemsLoaded} of ${itemsTotal} files.`
      );
    };
    loadingManager.onError = function (url) {
      console.error(`Error loading ${url}`);
      // Show backup mesh if model fails to load
      backupMesh.visible = true;
    };

    loader.manager = loadingManager;

    // Try to load the model with a more robust approach
    loader.load(
      "./scene.gltf", // Make sure this path is correct
      function (gltf) {
        droneModel = gltf.scene;
        console.log("Model loaded successfully:", droneModel);

        // Check if model has any meshes
        let hasMeshes = false;
        droneModel.traverse(function (child) {
          if (child.isMesh) {
            hasMeshes = true;
            console.log("Mesh found in model:", child.name);

            // Make sure material is properly configured
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((mat) => {
                  mat.side = THREE.DoubleSide;
                  mat.needsUpdate = true;
                });
              } else {
                child.material.side = THREE.DoubleSide;
                child.material.needsUpdate = true;
              }
            }
          }
        });

        if (!hasMeshes) {
          console.warn("No meshes found in the model! Using backup mesh.");
          backupMesh.visible = true;
        } else {
          // Calculate the bounding box to properly center and scale the model
          const bbox = new THREE.Box3().setFromObject(droneModel);
          const size = bbox.getSize(new THREE.Vector3());
          const center = bbox.getCenter(new THREE.Vector3());

          console.log("Model size:", size);
          console.log("Model center:", center);

          // Scale the model to a reasonable size
          const maxDim = Math.max(size.x, size.y, size.z);
          if (maxDim > 0) {
            const scale = 2 / maxDim; // Scale to fit in a 2x2x2 box
            droneModel.scale.set(scale, scale, scale);
          } else {
            droneModel.scale.set(0.5, 0.5, 0.5);
          }

          // Center the model
          droneModel.position.x = -center.x * droneModel.scale.x;
          droneModel.position.y = -center.y * droneModel.scale.y;
          droneModel.position.z = -center.z * droneModel.scale.z;
        }

        // Add model to scene
        droneScene.add(droneModel);

        // Handle animations if they exist
        if (gltf.animations && gltf.animations.length) {
          mixer = new THREE.AnimationMixer(droneModel);
          const action = mixer.clipAction(gltf.animations[0]);
          action.play();
        }

        // Force a render to make sure the model appears immediately
        droneRenderer.render(droneScene, droneCamera);
      },
      function (xhr) {
        const progress = (xhr.loaded / xhr.total) * 100;
        console.log(`${progress.toFixed(2)}% loaded`);
      },
      function (error) {
        console.error("An error happened loading the model:", error);
        // Show backup mesh if model fails to load
        backupMesh.visible = true;
      }
    );

    // Try alternative file format if GLTF doesn't work
    setTimeout(() => {
      if (!droneModel || !droneModel.visible) {
        console.log("Trying alternative file format (GLB)...");
        loader.load(
          "./drone.glb",
          function (gltf) {
            // Remove previous model if it exists
            if (droneModel) {
              droneScene.remove(droneModel);
            }

            droneModel = gltf.scene;
            droneModel.scale.set(0.5, 0.5, 0.5);
            droneScene.add(droneModel);
            droneRenderer.render(droneScene, droneCamera);
          },
          null,
          function (error) {
            console.error("Alternative format also failed:", error);
          }
        );
      }
    }, 5000); // Wait 5 seconds before trying alternative
  } else {
    console.error("THREE.GLTFLoader is not available. Make sure it's loaded.");
    // Show backup mesh if GLTFLoader is not available
    backupMesh.visible = true;
  }

  // Start animation loop
  animate();

  // Handle window resize
  window.addEventListener("resize", resizeDroneRenderer);

  // Immediately resize to ensure correct dimensions
  resizeDroneRenderer();

  // Add debug info to help diagnose issues
  addDebugInfo();
}

// Animation variables
let mixer;
let clock = new THREE.Clock();
let backupMesh;

function animate() {
  requestAnimationFrame(animate);

  // Update the animation mixer
  if (mixer) {
    const delta = clock.getDelta();
    mixer.update(delta);
  }

  if (droneModel && isRotating) {
    droneModel.rotation.y += 0.005;
  }

  // Update controls
  if (controls) controls.update();

  // Render scene
  if (droneRenderer && droneScene && droneCamera) {
    droneRenderer.render(droneScene, droneCamera);
  }

  // Update debug info
  updateDebugInfo();
}

function resizeDroneRenderer() {
  const canvas = document.getElementById("droneCanvas");
  if (!canvas || !droneRenderer) return;

  // Get the actual dimensions of the container
  const container = canvas.parentElement;
  const width = container.clientWidth || 400; // Fallback width
  const height = container.clientHeight || 300; // Fallback height

  console.log(`Resizing renderer to ${width}x${height}`);

  // Update camera aspect ratio
  droneCamera.aspect = width / height;
  droneCamera.updateProjectionMatrix();

  // Update renderer size
  droneRenderer.setSize(width, height, false);
}

function resetDroneView() {
  if (controls) {
    controls.reset();
  }

  if (droneModel) {
    droneModel.rotation.set(0, 0, 0);
  }
}

function toggleDroneRotation() {
  isRotating = !isRotating;
  const button = document.getElementById("toggleRotation");
  if (button) {
    button.textContent = isRotating ? "Pause Rotation" : "Resume Rotation";
  }
}

// Connect sensor data to drone movement
function updateDroneOrientation(accelX, accelY, accelZ, gyroX, gyroY, gyroZ) {
  if (!droneModel) return;

  // Apply sensor data to drone orientation
  const rotationSpeed = 0.01;
  droneModel.rotation.x += gyroX * rotationSpeed;
  droneModel.rotation.y += gyroY * rotationSpeed;
  droneModel.rotation.z += gyroZ * rotationSpeed;
}

// Debug panel to help diagnose rendering issues
function addDebugInfo() {
  // Create debug container if it doesn't exist
  let debugPanel = document.getElementById("droneDebugPanel");
  if (!debugPanel) {
    debugPanel = document.createElement("div");
    debugPanel.id = "droneDebugPanel";
    debugPanel.style.position = "absolute";
    debugPanel.style.bottom = "10px";
    debugPanel.style.right = "10px";
    debugPanel.style.backgroundColor = "rgba(0,0,0,0.7)";
    debugPanel.style.color = "white";
    debugPanel.style.padding = "10px";
    debugPanel.style.fontSize = "12px";
    debugPanel.style.fontFamily = "monospace";
    debugPanel.style.borderRadius = "5px";
    debugPanel.style.maxWidth = "300px";
    debugPanel.style.zIndex = "1000";

    const canvas = document.getElementById("droneCanvas");
    if (canvas && canvas.parentElement) {
      canvas.parentElement.style.position = "relative";
      canvas.parentElement.appendChild(debugPanel);
    } else {
      document.body.appendChild(debugPanel);
    }
  }
}

function updateDebugInfo() {
  const debugPanel = document.getElementById("droneDebugPanel");
  if (!debugPanel) return;

  let modelStatus = "Not loaded";
  let meshCount = 0;

  if (droneModel) {
    modelStatus = droneModel.visible ? "Visible" : "Loaded but not visible";
    droneModel.traverse((object) => {
      if (object.isMesh) meshCount++;
    });
  }

  const canvasInfo = document.getElementById("droneCanvas");
  const canvasWidth = canvasInfo ? canvasInfo.width : "N/A";
  const canvasHeight = canvasInfo ? canvasInfo.height : "N/A";

  debugPanel.innerHTML = `
      <div><strong>Debug Info:</strong></div>
      <div>Model: ${modelStatus}</div>
      <div>Meshes: ${meshCount}</div>
      <div>Canvas: ${canvasWidth}x${canvasHeight}</div>
      <div>Renderer: ${droneRenderer ? "Active" : "Not initialized"}</div>
      <div>Controls: ${controls ? "Active" : "Not initialized"}</div>
      <div>Rotation: ${isRotating ? "On" : "Off"}</div>
    `;
}
// Initialize only after DOM is fully loaded
document.addEventListener("DOMContentLoaded", initDashboard);

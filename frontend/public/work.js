let currentSelectedEdge = null; // Ensure this line is at the top of your script.js

function showMessage(message, type = 'info') {
    const messageBox = document.createElement('div');
    messageBox.className = `custom-message-box ${type}`;
    messageBox.innerText = message;
    document.body.appendChild(messageBox);
    void messageBox.offsetWidth;

    messageBox.classList.add('show');

    // Set a timeout to start the fade-out after 3 seconds
    setTimeout(() => {
        // Remove the 'show' class to trigger the fade-out animation
        messageBox.classList.remove('show');

        // Listen for the 'transitionend' event. This ensures the element is
        // only removed from the DOM AFTER its fade-out animation has completed.
        messageBox.addEventListener('transitionend', function handler() {
            messageBox.remove(); // Remove the element from the DOM
            // Remove the event listener itself to prevent memory leaks and
            // ensure it only fires once.
            messageBox.removeEventListener('transitionend', handler);
        }, { once: true }); // The { once: true } option automatically removes the listener after it's been invoked once.

    }, 1500); // The message will be visible for 3 seconds, then start fading out.
}

        // --- DOM Elements ---
        const drawingArea = document.getElementById("drawingArea");
        const svgConnections = document.getElementById("svgConnections");
        const calculateBtn = document.getElementById("calculateBtn");
        const transferFunctionResultDisplay = document.getElementById(
          "transferFunctionResult"
        );
        const inputButton = document.getElementById("inputButton");
        const outputButton = document.getElementById("outputButton");
        const addBlockButton = document.getElementById("addBlockButton");
        const connectButton = document.getElementById("connectButton");

        // --- Global State ---
        let graphNodes = [];
        let graphEdges = [];
        let currentInputNodeId = null;
        let currentOutputNodeId = null;
        let nextBlockId = 1;
        let nextEdgeId = 1;

        // --- Dragging State (for nodes) ---
        let draggedNodeElement = null; // Reference to the DOM element being dragged
        let isDraggingNode = false;
        let offsetX, offsetY; // Offset from mouse to node's top-left corner
        let animationFrameId = null; // To manage requestAnimationFrame

        // --- Connection Drawing State (for ports) ---
        let isConnectionModeActive = false; // Toggled by the 'Connect' button
        let isDrawingConnection = false;    // True when dragging a connection from a port
        let startPortElement = null;        // The node-port element where connection started
        let tempLine = null;                // The SVG line representing the temporary connection

        // --- Helper Functions ---

        // Get node position (center) relative to drawing area's top-left
        function getNodePos(nodeId) {
            const nodeData = graphNodes.find((n) => n.id === nodeId);
            if (!nodeData || !nodeData.element) return null;

            // Use the stored x,y coordinates which are kept updated
            // and the node's actual dimensions
            const rect = nodeData.element.getBoundingClientRect();
            return {
                x: nodeData.x + rect.width / 2,
                y: nodeData.y + rect.height / 2,
            };
        }

        // Redraw connections specifically for a given node
        function redrawConnectionsForNode(nodeId) {
            graphEdges.forEach((edge) => {
                // Only redraw if the edge is connected to the specified nodeId
                if (edge.from === nodeId || edge.to === nodeId) {
                    const fromPos = getNodePos(edge.from);
                    const toPos = getNodePos(edge.to);
                    if (fromPos && toPos && edge.lineElement) {
                        edge.lineElement.setAttribute("x1", fromPos.x);
                        edge.lineElement.setAttribute("y1", fromPos.y);
                        edge.lineElement.setAttribute("x2", toPos.x);
                        edge.lineElement.setAttribute("y2", toPos.y);

                        // Position gain input (midpoint)
                        if (edge.gainInputElem) {
                            // Calculate midpoint of the line
                            edge.gainInputElem.style.left = `${(fromPos.x + toPos.x) / 2}px`;
                            edge.gainInputElem.style.top = `${(fromPos.y + toPos.y) / 2}px`;
                        }
                    }
                }
            });
        }

        // Deselect any currently selected edge
        function deselectEdge() {
            if (currentSelectedEdge) {
                currentSelectedEdge.lineElement.classList.remove("selected");
                currentSelectedEdge = null;
            }
        }

        // --- Node Creation Functions ---

        function createNodeElement(id, type, initialX, initialY) {
            const nodeElem = document.createElement("div");
            nodeElem.className = `graph-node ${type}-node`; // e.g., 'graph-node input-node'
            nodeElem.id = id;
            if (type === "input") nodeElem.innerText = `(R)`;
            else if (type === "output") nodeElem.innerText = `(C)`;
            else nodeElem.innerText = id;

            nodeElem.style.left = `${initialX}px`;
            nodeElem.style.top = `${initialY}px`;

            // Append input/output ports
            if (type === "input" || type === "block") {
                const outputPort = document.createElement("div");
                outputPort.className = "node-port output";
                outputPort.dataset.portType = "output";
                outputPort.dataset.nodeId = id; // Reference to the parent node
                nodeElem.appendChild(outputPort);
                addPortEventListeners(outputPort);
            }
            if (type === "output" || type === "block") {
                const inputPort = document.createElement("div");
                inputPort.className = "node-port input";
                inputPort.dataset.portType = "input";
                inputPort.dataset.nodeId = id; // Reference to the parent node
                nodeElem.appendChild(inputPort);
                addPortEventListeners(inputPort);
            }

            // MOUSE DOWN on NODE (for dragging the node itself)
            nodeElem.addEventListener("mousedown", (e) => {
                console.log(`[Node Mousedown] Target: ${e.target.className}, isConnectionModeActive: ${isConnectionModeActive}`);

                // If a port or gain input was clicked, let their specific handlers run
                if (e.target.classList.contains("node-port") || e.target.classList.contains("gain-input")) {
                    e.stopPropagation();
                    return;
                }

                // IMPORTANT: Node dragging is ONLY allowed when 'Connect' mode is OFF.
                if (e.button === 0 && !isConnectionModeActive) { // Left mouse button
                    deselectEdge(); // Always deselect any line when interacting with a node
                    isDraggingNode = true;
                    draggedNodeElement = nodeElem;
                    const nodeRect = nodeElem.getBoundingClientRect();
                    offsetX = e.clientX - nodeRect.left;
                    offsetY = e.clientY - nodeRect.top;
                    nodeElem.style.cursor = "grabbing";
                    nodeElem.style.zIndex = 100; // Bring dragged node to front
                    console.log(`[Node Mousedown] Started dragging node: ${nodeElem.id}`);
                } else if (isConnectionModeActive) {
                    showMessage("Switch 'Connect' mode OFF to drag nodes.", 'info');
                }
                e.stopPropagation(); // Prevent drawing area's mousedown from firing
            });

            // MOUSE UP on NODE (to stop dragging, or to complete a click-based connection)
            nodeElem.addEventListener("mouseup", (e) => {
                // This mouseup primarily serves to stop dragging if a node was being dragged
                // and to prevent event bubbling if a port was clicked.
                if (isDraggingNode && draggedNodeElement) {
                    isDraggingNode = false;
                    draggedNodeElement.style.cursor = "grab";
                    draggedNodeElement.style.zIndex = 10; // Reset z-index
                    // Note: draggedNodeElement is cleared in the global mouseup
                    console.log(`[Node Mouseup] Stopped dragging node: ${nodeElem.id}`);
                }
                // Connection completion logic is handled by addPortEventListeners mouseup
                e.stopPropagation();
            });

            drawingArea.appendChild(nodeElem);
            return nodeElem;
        }

        function addPortEventListeners(portElem) {
            // MOUSE DOWN on PORT (to start drawing a connection)
            portElem.addEventListener("mousedown", (e) => {
                e.stopPropagation(); // Prevent node dragging and drawing area clicks
                console.log(`[Port Mousedown] Target: ${e.target.className}, isConnectionModeActive: ${isConnectionModeActive}`);

                // Only allow connection drawing if 'Connect' mode is active
                if (!isConnectionModeActive) {
                    showMessage("Activate 'Connect' mode to draw connections.", 'info');
                    return;
                }

                if (e.button === 0) { // Left mouse button
                    deselectEdge(); // Deselect any active line
                    isDrawingConnection = true;
                    startPortElement = portElem; // Store the port element that started the connection

                    const startPos = getNodePos(startPortElement.dataset.nodeId);
                    if (startPos) {
                        tempLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
                        tempLine.setAttribute("x1", startPos.x);
                        tempLine.setAttribute("y1", startPos.y);
                        // Initial end point is current mouse position
                        tempLine.setAttribute("x2", e.clientX - drawingArea.getBoundingClientRect().left);
                        tempLine.setAttribute("y2", e.clientY - drawingArea.getBoundingClientRect().top);
                        tempLine.setAttribute("stroke", "blue"); // Temporary line color
                        tempLine.setAttribute("stroke-width", "2");
                        tempLine.setAttribute("stroke-dasharray", "5,5"); // Dashed line
                        svgConnections.appendChild(tempLine);
                        console.log(`[Port Mousedown] Started drawing connection from: ${startPortElement.dataset.nodeId}`);
                    }
                }
            });

            // MOUSE UP on PORT (to complete a connection)
            portElem.addEventListener("mouseup", (e) => {
                e.stopPropagation(); // Prevent further bubbling
                console.log(`[Port Mouseup] Target: ${e.target.className}`);

                if (isDrawingConnection && startPortElement && tempLine) {
                    const endPortElement = e.target.closest('.node-port'); // Ensure release was on a port
                    if (endPortElement && endPortElement !== startPortElement) {
                        // Validate connection: ensure different nodes and compatible port types
                        const startNodeId = startPortElement.dataset.nodeId;
                        const endNodeId = endPortElement.dataset.nodeId;
                        const startPortType = startPortElement.dataset.portType;
                        const endPortType = endPortElement.dataset.portType;

                        // Check for self-connection to the same node
                        if (startNodeId === endNodeId) {
                            showMessage("Invalid connection: Cannot connect a port to another port on the same node.", 'error');
                        }
                        // Only allow output to input or input to output connections
                        else if ((startPortType === 'output' && endPortType === 'input') ||
                                 (startPortType === 'input' && endPortType === 'output')) {

                            const gainVal = prompt(
                                `Enter gain for connection from ${startNodeId} to ${endNodeId}:`,
                                "1"
                            );
                            if (gainVal !== null && gainVal.trim() !== "") {
                                addConnection(startNodeId, endNodeId, gainVal.trim());
                            } else {
                                showMessage("Connection cancelled: No gain entered.", 'info');
                            }
                        } else {
                            showMessage("Invalid connection: Cannot connect two inputs or two outputs.", 'error');
                        }
                    } else {
                        // User released mouse on the same port or not on a valid port
                        showMessage("Connection cancelled.", 'info');
                    }
                }

                // Clean up temporary line and reset connection state
                if (tempLine) {
                    svgConnections.removeChild(tempLine);
                    tempLine = null;
                }
                isDrawingConnection = false;
                startPortElement = null;
            });
        }


        function addNode(type, initialX, initialY) {
            let id;
            if (type === "input") {
                if (currentInputNodeId) {
                    showMessage("Input node already exists. Only one input node (R) is allowed.", 'error');
                    return;
                }
                id = "R";
                currentInputNodeId = id;
            } else if (type === "output") {
                if (currentOutputNodeId) {
                    showMessage("Output node already exists. Only one output node (C) is allowed.", 'error');
                    return;
                }
                id = "C";
                currentOutputNodeId = id;
            } else {
                // block
                id = `B${nextBlockId++}`;
            }

            const nodeElem = document.createElement("div"); // Create node element here
            nodeElem.className = `graph-node ${type}-node`;
            nodeElem.id = id;
            if (type === "input") nodeElem.innerText = `(R)`;
            else if (type === "output") nodeElem.innerText = `(C)`;
            else nodeElem.innerText = id;

            nodeElem.style.left = `${initialX}px`;
            nodeElem.style.top = `${initialY}px`;

            // Append input/output ports
            if (type === "input" || type === "block") {
                const outputPort = document.createElement("div");
                outputPort.className = "node-port output";
                outputPort.dataset.portType = "output";
                outputPort.dataset.nodeId = id; // Reference to the parent node
                nodeElem.appendChild(outputPort);
                addPortEventListeners(outputPort);
            }
            if (type === "output" || type === "block") {
                const inputPort = document.createElement("div");
                inputPort.className = "node-port input";
                inputPort.dataset.portType = "input";
                inputPort.dataset.nodeId = id; // Reference to the parent node
                nodeElem.appendChild(inputPort);
                addPortEventListeners(inputPort);
            }

            // MOUSE DOWN on NODE (for dragging the node itself)
            nodeElem.addEventListener("mousedown", (e) => {
                console.log(`[Node Mousedown] Target: ${e.target.className}, isConnectionModeActive: ${isConnectionModeActive}`);

                // If a port or gain input was clicked, let their specific handlers run
                if (e.target.classList.contains("node-port") || e.target.classList.contains("gain-input")) {
                    e.stopPropagation();
                    return;
                }

                // IMPORTANT: Node dragging is ONLY allowed when 'Connect' mode is OFF.
                if (e.button === 0 && !isConnectionModeActive) { // Left mouse button
                    deselectEdge(); // Always deselect any line when interacting with a node
                    isDraggingNode = true;
                    draggedNodeElement = nodeElem;
                    const nodeRect = nodeElem.getBoundingClientRect();
                    offsetX = e.clientX - nodeRect.left;
                    offsetY = e.clientY - nodeRect.top;
                    nodeElem.style.cursor = "grabbing";
                    nodeElem.style.zIndex = 100; // Bring dragged node to front
                    console.log(`[Node Mousedown] Started dragging node: ${nodeElem.id}`);
                } else if (isConnectionModeActive) {
                    showMessage("Switch 'Connect' mode OFF to drag nodes.", 'info');
                }
                e.stopPropagation(); // Prevent drawing area's mousedown from firing
            });

            // MOUSE UP on NODE (to stop dragging, or to complete a click-based connection)
            nodeElem.addEventListener("mouseup", (e) => {
                // This mouseup primarily serves to stop dragging if a node was being dragged
                // and to prevent event bubbling if a port was clicked.
                if (isDraggingNode && draggedNodeElement) {
                    isDraggingNode = false;
                    draggedNodeElement.style.cursor = "grab";
                    draggedNodeElement.style.zIndex = 10; // Reset z-index
                    // Note: draggedNodeElement is cleared in the global mouseup
                    console.log(`[Node Mouseup] Stopped dragging node: ${nodeElem.id}`);
                }
                // Connection completion logic is handled by addPortEventListeners mouseup
                e.stopPropagation();
            });

            drawingArea.appendChild(nodeElem); // Append element to the DOM
            graphNodes.push({
                id: id,
                type: type,
                x: initialX, // Store initial position
                y: initialY, // Store initial position
                element: nodeElem, // Reference to the DOM element
            });
            showMessage(`Added ${type} node: ${id}`, 'info');
        }

        // --- Connection (Edge) Management ---

        function addConnection(fromId, toId, gain) {
            // Check for duplicate or self-loop
            if (
                fromId === toId || // Should already be handled by port logic, but good double-check
                graphEdges.some((e) => e.from === fromId && e.to === toId)
            ) {
                showMessage("Invalid connection: self-loop or duplicate connection already exists.", 'error');
                return;
            }

            const fromPos = getNodePos(fromId);
            const toPos = getNodePos(toId);

            if (!fromPos || !toPos) {
                console.error("Could not find positions for nodes:", fromId, toId);
                showMessage("Error: Could not find node positions for connection.", 'error');
                return;
            }

            const lineElem = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "line"
            );
            lineElem.setAttribute("x1", fromPos.x);
            lineElem.setAttribute("y1", fromPos.y);
            lineElem.setAttribute("x2", toPos.x);
            lineElem.setAttribute("y2", toPos.y);
            lineElem.setAttribute("class", "connection-line");
            svgConnections.appendChild(lineElem);

            const edgeId = `E${nextEdgeId++}`;
            lineElem.id = edgeId; // Assign ID to SVG line for reference

            // Create gain input element
            const gainInputElem = document.createElement("input");
            gainInputElem.type = "text";
            gainInputElem.value = gain;
            gainInputElem.className = "gain-input";
            drawingArea.appendChild(gainInputElem); // Append to drawing area directly

            // Position gain input (initially midpoint)
            gainInputElem.style.left = `${(fromPos.x + toPos.x) / 2}px`;
            gainInputElem.style.top = `${(fromPos.y + toPos.y) / 2}px`;

            // Event listener for gain input
            gainInputElem.addEventListener("change", (e) => {
                const targetEdge = graphEdges.find(
                    (ed) => ed.gainInputElem === e.target
                );
                if (targetEdge) {
                    targetEdge.gain = e.target.value;
                    console.log(
                        `Edge ${targetEdge.id} gain updated to: ${targetEdge.gain}`
                    );
                }
            });

            // Click listener for gain input itself to select the line
            gainInputElem.addEventListener("click", (e) => {
                e.stopPropagation(); // Prevent deselecting line when clicking its gain input
                const targetEdge = graphEdges.find(
                    (ed) => ed.gainInputElem === e.target
                );
                if (targetEdge) {
                    deselectEdge(); // Deselect previously selected
                    targetEdge.lineElement.classList.add("selected");
                    currentSelectedEdge = targetEdge;
                }
            });

            const newEdge = {
                id: edgeId,
                from: fromId,
                to: toId,
                gain: gain,
                lineElement: lineElem,
                gainInputElem: gainInputElem,
            };
            graphEdges.push(newEdge);

            // Add click listener to select the line for visual feedback
            lineElem.addEventListener("click", (e) => {
                e.stopPropagation(); // Prevent drawing area click from deselecting
                deselectEdge(); // Deselect previously selected
                lineElem.classList.add("selected");
                currentSelectedEdge = newEdge;
            });

            console.log(`Added connection: ${fromId} -> ${toId} (Gain: ${gain})`);
            console.log("Current edges:", graphEdges);
            showMessage(`Connection added: ${fromId} -> ${toId}`, 'info');
        }

        // --- Global Mouse Events for Dragging and Connection Drawing ---

        drawingArea.addEventListener("mousemove", (e) => {
            const drawingAreaRect = drawingArea.getBoundingClientRect();
            // Raw mouse position relative to drawing area
            const mouseX = e.clientX - drawingAreaRect.left;
            const mouseY = e.clientY - drawingAreaRect.top;

            if (isDraggingNode && draggedNodeElement) {
                // If an animation frame is already scheduled, cancel it to prevent redundant updates
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                }

                // Schedule the next animation frame for the drag update
                animationFrameId = requestAnimationFrame(() => {
                    let newX = mouseX - offsetX;
                    let newY = mouseY - offsetY;

                    // Clamp to drawing area boundaries
                    newX = Math.max(
                        0,
                        Math.min(newX, drawingAreaRect.width - draggedNodeElement.offsetWidth)
                    );
                    newY = Math.max(
                        0,
                        Math.min(newY, drawingAreaRect.height - draggedNodeElement.offsetHeight)
                    );

                    // Apply the new position
                    draggedNodeElement.style.left = `${newX}px`;
                    draggedNodeElement.style.top = `${newY}px`;

                    // Update node's stored position in our data model
                    const nodeData = graphNodes.find((n) => n.element === draggedNodeElement);
                    if (nodeData) {
                        nodeData.x = newX;
                        nodeData.y = newY;
                    }
                    // Only redraw connections related to the currently dragged node
                    redrawConnectionsForNode(draggedNodeElement.id);
                    animationFrameId = null; // Reset for next frame
                });
            } else if (isDrawingConnection && tempLine) {
                // Handle temporary line movement, also using requestAnimationFrame for smoothness
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                }
                animationFrameId = requestAnimationFrame(() => {
                    tempLine.setAttribute("x2", mouseX);
                    tempLine.setAttribute("y2", mouseY);
                    animationFrameId = null;
                });
            }
        });

        // Global mouseup event listener on the document to catch releases anywhere
        document.addEventListener("mouseup", (e) => {
            console.log(`[Global Mouseup] isDraggingNode: ${isDraggingNode}, isDrawingConnection: ${isDrawingConnection}`);

            // Stop dragging logic
            if (isDraggingNode) {
                isDraggingNode = false;
                if (draggedNodeElement) {
                    draggedNodeElement.style.cursor = "grab";
                    draggedNodeElement.style.zIndex = 10; // Reset z-index
                    draggedNodeElement = null;
                }
                if (animationFrameId) { // Cancel any pending animation frame for dragging
                    cancelAnimationFrame(animationFrameId);
                    animationFrameId = null;
                }
            }
            // If drawing a connection and mouseup happened not on a target port, cancel it
            if (isDrawingConnection && tempLine) {
                svgConnections.removeChild(tempLine);
                tempLine = null;
                showMessage("Connection cancelled.", 'info'); // Provide feedback
                if (animationFrameId) { // Cancel any pending animation frame for temp line
                    cancelAnimationFrame(animationFrameId);
                    animationFrameId = null;
                }
            }
            isDrawingConnection = false; // Always reset this flag
            startPortElement = null; // Clear starting port
        });

        // Click on drawing area (or svg-container) to deselect any selected edge
        drawingArea.addEventListener("click", (e) => {
            console.log(`[Drawing Area Click] Target: ${e.target.className}`);

            // If in connection mode and clicked on drawing area (not a node/port), reset connection attempt
            if (
                isConnectionModeActive &&
                (e.target === drawingArea || e.target === svgConnections)
            ) {
                if (tempLine) {
                    svgConnections.removeChild(tempLine);
                    tempLine = null;
                }
                isDrawingConnection = false;
                startPortElement = null;
                showMessage("Connection attempt cancelled.", 'info'); // Feedback
            }

            // Always deselect edge if clicked on background
            if (e.target === drawingArea || e.target === svgConnections) {
                deselectEdge();
            }
        });

        // --- Button Event Listeners ---
        inputButton.addEventListener("click", () => addNode("input", 50, 50));
        outputButton.addEventListener("click", () =>
            addNode("output", drawingArea.offsetWidth - 120, 50)
        );
        addBlockButton.addEventListener("click", () =>
            addNode("block", 200, 150)
        );

        // Connect Button Logic
        connectButton.addEventListener("click", () => {
            isConnectionModeActive = !isConnectionModeActive; // Toggle the mode
            if (isConnectionModeActive) {
                connectButton.classList.add("active-mode");
                drawingArea.classList.add("connection-mode-cursor");
                showMessage("Connection Mode ON: Click and drag from a node's port to another node's port to create a connection.", 'info');
            } else {
                connectButton.classList.remove("active-mode");
                drawingArea.classList.remove("connection-mode-cursor");
                // Reset any pending connection if mode is turned off
                if (tempLine) {
                    svgConnections.removeChild(tempLine);
                    tempLine = null;
                }
                isDrawingConnection = false;
                startPortElement = null;
                // Important: Also reset dragging node state if connect mode is turned off
                if (isDraggingNode) {
                    isDraggingNode = false;
                    if (draggedNodeElement) {
                        draggedNodeElement.style.cursor = "grab";
                        draggedNodeElement.style.zIndex = 10;
                        draggedNodeElement = null;
                    }
                    if (animationFrameId) {
                        cancelAnimationFrame(animationFrameId);
                        animationFrameId = null;
                    }
                }
                showMessage("Connection Mode OFF: You can now drag nodes.", 'info');
            }
            deselectEdge(); // Deselect any selected edge when changing modes
        });

        // --- Calculate Transfer Function (from previous examples) ---
        calculateBtn.addEventListener("click", async () => {
            // Ensure input and output nodes are set
            if (!currentInputNodeId || !currentOutputNodeId) {
                transferFunctionResultDisplay.innerText =
                    "Please define Input and Output nodes (R and C).";
                transferFunctionResultDisplay.style.color = "red";
                return;
            }

            // Prepare data for backend. Extract only relevant info.
            const nodesForBackend = graphNodes.map((node) => node.id);
            // Validate edges to ensure gain is present
            const edgesForBackend = graphEdges.map((edge) => ({
                from: edge.from,
                to: edge.to,
                gain: edge.gain, // Use the actual gain string
            }));

            const dataToSend = {
                nodes: nodesForBackend,
                edges: edgesForBackend,
                input_node: currentInputNodeId,
                output_node: currentOutputNodeId,
            };

            transferFunctionResultDisplay.innerText = "Calculating...";
            transferFunctionResultDisplay.style.color = "gray";

            try {
                // Placeholder for actual API call to compute transfer function
                // This URL will need to be replaced with your actual backend endpoint
                const response = await fetch(
                    "http://localhost:5000/compute-transfer-function",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(dataToSend),
                    }
                );

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(
                        errorData.error ||
                            `HTTP error! status: ${response.status} ${response.statusText}`
                    );
                }

                const data = await response.json();

                if (data.result) {
                    transferFunctionResultDisplay.innerText = data.result;
                    transferFunctionResultDisplay.style.color = "green";
                } else if (data.error) {
                    transferFunctionResultDisplay.innerText = `Error from server: ${data.error}`;
                    transferFunctionResultDisplay.style.color = "red";
                }
            } catch (error) {
                console.error("Fetch error:", error);
                transferFunctionResultDisplay.innerText = `Could not connect to backend or error: ${error.message}. Please check console and backend server.`;
                transferFunctionResultDisplay.style.color = "red";
            }
        });

        // Handle window resize to redraw all connections
        window.addEventListener("resize", () => {
             graphNodes.forEach(node => redrawConnectionsForNode(node.id));
        });
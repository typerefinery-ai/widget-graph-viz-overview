# Refine Force Graph Behaviour

The force graph visualisation in src\js\widget.js uses the D3.js library to create an interactive force-directed graph. It effectively shows the force-graph with icons, and provides mouse-over behaviour (expand icon size and tooltip). 

We need to refine the behaviour, and note the following issues:

1. **Node Overlap**: When nodes are too close together, they can overlap, making it difficult to distinguish between them. We need to implement a better collision detection mechanism to prevent this. We want the nodes to stay within the visible area of the graph, but be slightly smaller (65-70%) so the nodes can be relatively further apart. The text on the edges should be changed in font and size so it is more readable.
2. **Zoom and Pan**: The current zoom and pan functionality is not implemented. We need to ensure that users can smoothly zoom in and out, and pan across the graph without losing context.
3. **Left-Click Node Selection**: We need to make sure a node can be left-clicked to select it, and that the selected node is highlighted.
4. **Drag and Fix Position, Double-click to Unfix**: Users should be able to drag nodes to new positions and fix them there. Double-clicking a fixed node should unfix it, allowing it to move freely again.
5. **Dynamic Arrow head location**: The arrow heads on the edges should dynamically adjust their position based on the distance between nodes, ensuring they always point correctly to the target node. There are three trypes of icons used in the graph, two are circular, and so having the arrow heads a fixed distance (radius) from the center of the node is sufficient. But one of the shapes is a rounded rectangle, where the diagaonals are equal to the circle diameter, but the sides and tops are shorter. The arrow heads need to be adjusted accordingly.

Can you look through the existing code in src\js\widget.js and suggest the necessary changes to address these issues? Please create a detailed plan outlining the steps needed to implement these refinements.
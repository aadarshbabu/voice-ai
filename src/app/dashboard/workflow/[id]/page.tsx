"use client";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

export default function WorkflowBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const onConnect = (connection) => setEdges((eds) => addEdge(connection, eds));

  return (
    <div className="mx-2 my-1">
      <div className="w-full h-[90vh]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}

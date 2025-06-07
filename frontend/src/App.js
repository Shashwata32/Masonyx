import React, { useCallback, useState, useRef } from 'react';
import ReactFlow, {
  addEdge,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle, // Import Handle component
  Position // For handle positioning
} from 'react-flow-renderer';
import axios from 'axios';
import './App.css';

// Custom node components with handles
const InputNode = ({ data }) => (
  <div style={{
    background: '#ff0072',
    color: 'white',
    borderRadius: '50%',
    width: 60,
    height: 60,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    border: '2px solid #fff',
    boxShadow: '0 0 10px rgba(255,0,114,0.5)'
  }}>
    <div>{data.label}</div>
    <Handle
      type="source"
      position={Position.Right}
      style={{ background: '#555' }}
    />
  </div>
);

const OutputNode = ({ data }) => (
  <div style={{
    background: '#0041d0',
    color: 'white',
    borderRadius: '50%',
    width: 60,
    height: 60,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    border: '2px solid #fff',
    boxShadow: '0 0 10px rgba(0,65,208,0.5)'
  }}>
    <div>{data.label}</div>
    <Handle
      type="target"
      position={Position.Left}
      style={{ background: '#555' }}
    />
  </div>
);

const BlockNode = ({ data }) => (
  <div style={{
    background: '#f0f0f0',
    color: '#333',
    borderRadius: '5px',
    padding: '10px',
    border: '1px solid #999',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
    minWidth: 80,
    textAlign: 'center'
  }}>
    <Handle
      type="target"
      position={Position.Left}
      style={{ background: '#555' }}
    />
    <div>{data.label}</div>
    <Handle
      type="source"
      position={Position.Right}
      style={{ background: '#555' }}
    />
  </div>
);

// ... rest of the code remains the same ...

const nodeTypes = {
  input: InputNode,
  output: OutputNode,
  block: BlockNode
};

function App() {
  const idRef = useRef(0);
  const getId = () => `node_${idRef.current++}`;

  const initialNodes = [
    {
      id: getId(),
      type: 'input',
      data: { label: 'Input' },
      position: { x: 100, y: 50 },
    },
  ];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [result, setResult] = useState(null);
  const [inputNodeId, setInputNodeId] = useState(initialNodes[0].id);
  const [outputNodeId, setOutputNodeId] = useState(null);

  const onConnect = useCallback(
    (params) => {
      const gain = prompt('Enter gain (e.g., G1):') || '1';
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            label: gain,
            labelBgPadding: [8, 4],
            labelBgBorderRadius: 4,
            labelBgStyle: { fill: '#FFCC00', color: '#fff', fillOpacity: 0.7 },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const addNode = (type = 'block') => {
    const newNode = {
      id: getId(),
      data: { 
        label: type === 'input' ? 'Input' : 
               type === 'output' ? 'Output' : 
               `Block ${idRef.current}`
      },
      position: { x: 100 + Math.random() * 300, y: 50 + Math.random() * 300 },
      type: type
    };

    setNodes((nds) => {
      const updatedNodes = nds.map(n => {
        if (type === 'input' && n.type === 'input') {
          return { ...n, type: 'block', data: { label: 'Block' } };
        }
        if (type === 'output' && n.type === 'output') {
          return { ...n, type: 'block', data: { label: 'Block' } };
        }
        return n;
      });
      
      return updatedNodes.concat(newNode);
    });

    if (type === 'input') setInputNodeId(newNode.id);
    if (type === 'output') setOutputNodeId(newNode.id);
  };

  const sendToBackend = async () => {
    try {
      if (!inputNodeId || !outputNodeId) {
        setResult('Please specify input and output nodes');
        return;
      }

      if (edges.length === 0) {
        setResult('No connections between nodes');
        return;
      }

      const payload = {
        nodes: nodes.map((n) => n.id),
        edges: edges.map((e) => ({
          from: e.source,
          to: e.target,
          gain: e.label || '1',
        })),
        input_node: inputNodeId,
        output_node: outputNodeId
      };

      const res = await axios.post(
      'http://localhost:5000/compute-transfer-function', 
      payload,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    setResult(res.data.result);
      
    } catch (err) {
    console.error('Full error:', err);
    console.error('Response:', err.response);
    setResult(`Error: ${err.message} - ${err.response?.data?.error || 'No response'}`);
  }
};

  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <h2 style={{ textAlign: 'center' }}>Mason Gain Tool</h2>
      <div style={{ textAlign: 'center', marginBottom: '10px' }}>
        <button onClick={() => addNode('input')}>🏁 Input</button>
        <button onClick={() => addNode('output')}>🎯 Output</button>
        <button onClick={() => addNode('block')}>🧱 Add Block</button>
        <button onClick={sendToBackend} style={{ marginLeft: '10px' }}>
          🧮 Compute Transfer Function
        </button>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <MiniMap />
        <Controls />
        <Background />
      </ReactFlow>
      {result && (
        <div style={{ 
          position: 'absolute', 
          bottom: 0,
          left: 0,
          right: 0,
          padding: '20px', 
          background: '#f5f5f5', 
          borderRadius: '8px',
          border: '1px solid #ddd',
          zIndex: 10
        }}>
          <h3>Transfer Function Result:</h3>
          <div style={{ 
            fontFamily: 'monospace',
            background: '#333',
            color: '#0f0',
            padding: '15px',
            borderRadius: '4px',
            overflowX: 'auto',
            maxHeight: '200px',
            overflowY: 'auto'
          }}>
            {result}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;